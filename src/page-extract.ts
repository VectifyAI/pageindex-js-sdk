import type {
  DeleteExtractResponse,
  ExtractConfiguration,
  ExtractJob,
  ExtractTier,
  ListExtractsOptions,
  ListExtractsResponse,
  SubmitDocumentResponse,
} from "./api/types.js";
import type { PageIndexClient } from "./client.js";
import { PageIndexError } from "./errors.js";
import { type FileInput, readFileInput, sleep } from "./internal.js";
import { type ProductClientConfig, productClient } from "./product-client.js";

/** The collection that files given to `extract()` are uploaded to by default. */
export const PAGE_EXTRACT_COLLECTION = "Page Extract";

const DEFAULT_TIMEOUT = 3_600_000;
const POLL_INTERVAL = 3000;

/** A JSON Schema whose top is an object or an array. */
export type JsonSchema = Record<string, unknown>;

export interface PageExtractOptions {
  /** Default: `"standard"`. */
  tier?: ExtractTier;
  /**
   * Extract from these pages only: `"3-9"`, `[3, 9]` or `3`. The extraction is
   * charged for them alone.
   */
  pages?: string | number | [first: number, last: number];
  /** Give the page each list item is on, under `extract_metadata`. */
  citeSources?: boolean;
  /** Your own instructions for the extraction. */
  systemPrompt?: string;
  /**
   * Resolve with the job once it is completed (default), up to `timeout`.
   * Rejects if it failed or was cancelled, or is not done in time; it goes on
   * running, so read it with `getExtract()`. `false` resolves with the job
   * pending once it starts.
   */
  wait?: boolean;
  /**
   * Milliseconds to wait, the file's upload and processing included.
   * Default: 3,600,000 (an hour).
   */
  timeout?: number;
  /**
   * Where a file is uploaded: a collection's name (any case) or ID. A name
   * none of your collections has makes one. `null` stores the document outside
   * any collection. Default: `"Page Extract"`.
   */
  collection?: string | null;
  /** The name to store a file under. Default: the file's own name. */
  fileName?: string;
  signal?: AbortSignal;
}

export interface WaitExtractOptions {
  /** Milliseconds to wait. Default: 3,600,000 (an hour). */
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Page Extract over your PageIndex cloud documents: JSON that fits a schema,
 * extracted from a PDF.
 *
 * ```ts
 * const client = new PageExtractClient(); // reads PAGEINDEX_API_KEY
 * const job = await client.extract({ path: "invoice.pdf" }, schema);
 * job.extract_result;
 * ```
 *
 * A file is uploaded to the "Page Extract" collection, with no outline index
 * built. The documents are the ones `PageIndexClient` and `PageSearchClient`
 * see with the same key; `client.pageindex` is that `PageIndexClient`.
 */
export class PageExtractClient {
  readonly pageindex: PageIndexClient;
  /** Collection IDs found or made, by the name or ID they were asked for. */
  private readonly collections = new Map<string, string>();

  constructor(config: ProductClientConfig = {}) {
    this.pageindex = productClient(
      config,
      "PageExtractClient",
      "PAGEINDEX_EXTRACT_API_KEY",
    );
  }

  /**
   * Extracts JSON that fits `schema` from a PDF.
   *
   * @param document The `doc_id` of an uploaded document; one still
   *   processing is waited for first, and with `wait: false` rejects with HTTP
   *   409. Or a file: it is uploaded to `collection` with the job, with no
   *   outline index built. Only the extraction is charged, once the job
   *   completes, and the file is kept as a document from then on; a job that
   *   fails or is cancelled is not charged, and the file is not kept. Uploading
   *   the same file again uses the stored document.
   * @param schema A JSON Schema whose top is an object or an array. With Zod,
   *   pass `z.toJSONSchema(schema)`.
   * @returns The job. Once completed, `extract_result` holds the JSON.
   */
  async extract<T = unknown>(
    document: string | FileInput,
    schema: JsonSchema,
    options: PageExtractOptions = {},
  ): Promise<ExtractJob<T>> {
    const api = this.pageindex.api;
    const configuration = configurationOf(schema, options);
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const deadline = Date.now() + timeout;
    const remaining = () => Math.max(0, deadline - Date.now());

    let docId: string;
    if (typeof document === "string") {
      if (document.toLowerCase().endsWith(".pdf")) {
        throw new PageIndexError(
          `"${document}" looks like a file name, not a doc_id: pass { path: "${document}" } to upload the file.`,
          "INVALID_INPUT",
        );
      }
      docId = document;
    } else {
      const file = await readFileInput(document, options.fileName);
      const collection =
        options.collection === undefined
          ? PAGE_EXTRACT_COLLECTION
          : options.collection;
      for (let last = false; ; last = true) {
        const stored = await this.store(file, collection, configuration);
        if (stored.extract_job_id) {
          const job = await this.readStarted<T>(
            stored.extract_job_id,
            options.signal,
          );
          return options.wait === false
            ? job
            : this.done(job, deadline, timeout, options.signal);
        }
        // No job started: the file is stored already and still processing,
        // or the server is older than extraction on upload.
        try {
          await api.waitDocument(stored.doc_id, {
            timeout: remaining(),
            signal: options.signal,
          });
          docId = stored.doc_id;
          break;
        } catch (error) {
          // The job it was stored with did not complete, and deleted it.
          const deleted =
            error instanceof PageIndexError && error.statusCode === 404;
          if (!deleted || last) throw error;
        }
      }
    }

    let job: ExtractJob<T>;
    try {
      job = await api.createExtract<T>({
        docId,
        configuration,
        signal: options.signal,
      });
    } catch (error) {
      const notReady =
        error instanceof PageIndexError && error.statusCode === 409;
      if (options.wait === false || !notReady) throw error;
      await api.waitDocument(docId, {
        timeout: remaining(),
        signal: options.signal,
      });
      job = await api.createExtract<T>({
        docId,
        configuration,
        signal: options.signal,
      });
    }
    return options.wait === false
      ? job
      : this.done(job, deadline, timeout, options.signal);
  }

  /**
   * Waits for an extract job, and resolves with it once it is completed.
   * Rejects if it failed or was cancelled, or is not done within `timeout`
   * (it goes on running).
   */
  async waitExtract<T = unknown>(
    jobId: string,
    options: WaitExtractOptions = {},
  ): Promise<ExtractJob<T>> {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const deadline = Date.now() + timeout;
    const job = await this.pageindex.api.getExtract<T>(jobId, options.signal);
    return this.done(job, deadline, timeout, options.signal);
  }

  /** An extract job, with its result once it is completed. */
  getExtract<T = unknown>(jobId: string): Promise<ExtractJob<T>> {
    return this.pageindex.api.getExtract<T>(jobId);
  }

  /** Your extract jobs, newest first, without their results. */
  listExtracts(options?: ListExtractsOptions): Promise<ListExtractsResponse> {
    return this.pageindex.api.listExtracts(options);
  }

  /**
   * Stops a pending or running extract job: nothing is charged, and a file
   * uploaded with it is not kept. A job that has already ended rejects with
   * HTTP 409.
   */
  cancelExtract(jobId: string): Promise<ExtractJob> {
    return this.pageindex.api.cancelExtract(jobId);
  }

  /** Deletes an extract job and its result. The document it read stays. */
  deleteExtract(jobId: string): Promise<DeleteExtractResponse> {
    return this.pageindex.api.deleteExtract(jobId);
  }

  /**
   * Uploads a file with the extraction's configuration, so the upload starts
   * the job. A file stored already that is still processing starts none: its
   * document comes back with `duplicate`.
   */
  private async store(
    file: { blob: Blob; fileName: string },
    collection: string | null,
    configuration: ExtractConfiguration,
  ): Promise<SubmitDocumentResponse> {
    const upload = async () =>
      this.pageindex.api.submitDocument(file.blob, file.fileName, {
        collectionId: await this.collectionId(collection),
        index: false,
        extract: configuration,
      });
    try {
      try {
        return await upload();
      } catch (error) {
        // The collection found earlier is gone: find or make it again.
        const gone =
          error instanceof PageIndexError &&
          error.statusCode === 404 &&
          collection !== null &&
          this.collections.delete(collection);
        if (!gone) throw error;
        return await upload();
      }
    } catch (error) {
      const docId = storedDocumentOf(error);
      if (docId === undefined) throw error;
      return { doc_id: docId, duplicate: true };
    }
  }

  /** Reads the job an upload started; a failure names the job. */
  private async readStarted<T>(
    jobId: string,
    signal?: AbortSignal,
  ): Promise<ExtractJob<T>> {
    try {
      return await this.pageindex.api.getExtract<T>(jobId, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new PageIndexError(
        `The upload started extract job ${jobId}, which could not be read: ${(error as Error).message}. It may be running in the cloud: read it with getExtract(jobId), or stop it with cancelExtract(jobId).`,
        error instanceof PageIndexError ? error.code : undefined,
        { jobId },
        error instanceof PageIndexError ? error.statusCode : undefined,
      );
    }
  }

  private async done<T>(
    job: ExtractJob<T>,
    deadline: number,
    timeout: number,
    signal?: AbortSignal,
  ): Promise<ExtractJob<T>> {
    const api = this.pageindex.api;
    let current = job;
    while (current.status === "pending" || current.status === "running") {
      if (Date.now() > deadline) {
        throw new PageIndexError(
          `Extract job ${current.id} is still ${current.status} after ${Math.round(timeout / 1000)}s. It goes on running in the cloud: read it with getExtract(jobId), or stop it with cancelExtract(jobId).`,
          undefined,
          { job: current },
        );
      }
      await sleep(POLL_INTERVAL, signal);
      try {
        current = await api.getExtract<T>(current.id, signal);
      } catch (error) {
        if (signal?.aborted) throw error;
        throw new PageIndexError(
          `Could not read extract job ${current.id}: ${(error as Error).message}. It may still be running in the cloud: read it with getExtract(jobId), or stop it with cancelExtract(jobId).`,
          error instanceof PageIndexError ? error.code : undefined,
          { job: current },
          error instanceof PageIndexError ? error.statusCode : undefined,
        );
      }
    }
    if (current.status !== "completed") {
      throw new PageIndexError(
        `Extract job ${current.id} ${current.status}${current.error_message ? `: ${current.error_message}` : "."}`,
        undefined,
        { job: current },
      );
    }
    return current;
  }

  /** The ID of the collection named or identified, found or made. */
  private async collectionId(
    collection: string | null,
  ): Promise<string | undefined> {
    if (collection === null) return undefined;
    const cached = this.collections.get(collection);
    if (cached !== undefined) return cached;
    const api = this.pageindex.api;
    const name = collection.trim().toLowerCase();
    const stored = async () =>
      (await api.listCollections()).collections.find(
        (c) => c.id === collection || c.name.toLowerCase() === name,
      )?.id;

    let found = await stored();
    if (found === undefined) {
      try {
        found = (await api.createCollection({ name: collection })).collection
          .id;
      } catch (error) {
        if (!(error instanceof PageIndexError && error.statusCode === 409)) {
          throw error;
        }
        found = await stored();
        if (found === undefined) {
          throw new PageIndexError(
            `A collection named like '${collection}' exists, but not by that spelling: pass its exact name or ID.`,
            "INVALID_INPUT",
            undefined,
            409,
          );
        }
      }
    }
    this.collections.set(collection, found);
    return found;
  }
}

function configurationOf(
  schema: JsonSchema,
  options: PageExtractOptions,
): ExtractConfiguration {
  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
    throw new PageIndexError(
      "schema must be a JSON Schema object.",
      "INVALID_INPUT",
    );
  }
  const configuration: ExtractConfiguration = {
    data_schema: schema,
    tier: options.tier ?? "standard",
  };
  if (options.pages !== undefined) {
    configuration.target_pages = Array.isArray(options.pages)
      ? `${options.pages[0]}-${options.pages[1]}`
      : String(options.pages);
  }
  if (options.citeSources) configuration.cite_sources = true;
  if (options.systemPrompt) configuration.system_prompt = options.systemPrompt;
  return configuration;
}

/**
 * The stored document a 409 upload names: the same file, uploaded already,
 * still processing.
 */
function storedDocumentOf(error: unknown): string | undefined {
  if (!(error instanceof PageIndexError) || error.statusCode !== 409) {
    return undefined;
  }
  const detail = error.details?.detail;
  if (detail && typeof detail === "object") {
    const { doc_id } = detail as { doc_id?: unknown };
    if (typeof doc_id === "string" && doc_id) return doc_id;
  }
  return undefined;
}
