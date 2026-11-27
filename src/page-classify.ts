import type {
  ClassifyClass,
  ClassifyConfiguration,
  ClassifyGranularity,
  ClassifyJob,
} from "./api/types.js";
import type { PageIndexClient } from "./client.js";
import { PageIndexError } from "./errors.js";
import { type FileInput, readFileInput, sleep } from "./internal.js";
import { collectionIdOf, storedDocumentOf } from "./page-extract.js";
import { type ProductClientConfig, productClient } from "./product-client.js";

/** The collection that files given to `classify()` are uploaded to by default. */
export const PAGE_CLASSIFY_COLLECTION = "Page Classify";

const DEFAULT_TIMEOUT = 1_800_000;
const POLL_INTERVAL = 1000;

/**
 * The classes, by name: `{ name: description }` (a description may be
 * `null`), or a list of names, or of `{ name, description }`.
 */
export type ClassifyClasses =
  | Record<string, string | null | undefined>
  | Array<string | ClassifyClass>;

export interface PageClassifyOptions {
  /**
   * `"document"` (default): one class for the document, from its first 5
   * pages unless `pages` names others. `"page"`: a class for each page, every
   * page unless `pages` names fewer.
   */
  granularity?: ClassifyGranularity;
  /** Read these pages only: `"3-9"`, `[3, 9]` or `3`. */
  pages?: string | number | [first: number, last: number];
  /**
   * Resolve with the job once it is completed (default), up to `timeout`.
   * Rejects if it failed, or is not done in time; it goes on running, so read
   * it with `getClassify()`. `false` resolves with the job pending once it
   * starts.
   */
  wait?: boolean;
  /**
   * Milliseconds to wait, the file's upload and processing included.
   * Default: 1,800,000 (30 minutes).
   */
  timeout?: number;
  /**
   * Where a file is uploaded: a collection's name (any case) or ID. A name
   * none of your collections has makes one. `null` stores the document outside
   * any collection. Default: `"Page Classify"`.
   */
  collection?: string | null;
  /** The name to store a file under. Default: the file's own name. */
  fileName?: string;
  signal?: AbortSignal;
}

export interface WaitClassifyOptions {
  /** Milliseconds to wait. Default: 1,800,000 (30 minutes). */
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Page Classify over your PageIndex cloud documents: the class of a PDF, or
 * of each of its pages, among the classes you name.
 *
 * ```ts
 * const client = new PageClassifyClient(); // reads PAGEINDEX_API_KEY
 * const job = await client.classify({ path: "invoice.pdf" }, {
 *   invoice: "A bill asking for payment",
 *   receipt: "Proof of a purchase already paid",
 * });
 * job.class; // "invoice"
 * ```
 *
 * A file is uploaded to the "Page Classify" collection, with no outline index
 * built. The documents are the ones `PageIndexClient`, `PageSearchClient` and
 * `PageExtractClient` see with the same key; `client.documents` is that
 * `PageIndexClient`.
 */
export class PageClassifyClient {
  readonly documents: PageIndexClient;
  /** Collection IDs found or made, by the name or ID they were asked for. */
  private readonly collections = new Map<string, string>();

  constructor(config: ProductClientConfig = {}) {
    this.documents = productClient(config, "PageClassifyClient");
  }

  /**
   * Classifies a PDF, or each of its pages, among `classes`.
   *
   * @param document The `doc_id` of an uploaded document; one still
   *   processing is waited for first, and with `wait: false` rejects with HTTP
   *   409. Or a file: it is uploaded to `collection` with the job, with no
   *   outline index built, and kept as a document from then on. Only the
   *   classification is charged, once the job completes; a job that fails is
   *   not charged, and leaves a file it uploaded as a failed document, with its
   *   name and file but no pages, until you delete it. Uploading the same file
   *   again uses the stored document.
   * @param classes 1 to 50 classes: `{ name: description }`, or a list of
   *   names. Names and descriptions hold 8,000 characters, all told.
   * @returns The job. Once completed it has `class` and `confidence`
   *   (`"document"`), or `pages` (`"page"`); a class is `null` for a document
   *   or page of none of the classes.
   */
  async classify(
    document: string | FileInput,
    classes: ClassifyClasses,
    options: PageClassifyOptions = {},
  ): Promise<ClassifyJob> {
    const api = this.documents.api;
    const configuration = configurationOf(classes, options);
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const deadline = Date.now() + timeout;
    const remaining = () => Math.max(0, deadline - Date.now());
    const finish = (job: ClassifyJob) =>
      options.wait === false
        ? job
        : this.done(job, deadline, timeout, options.signal);

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
          ? PAGE_CLASSIFY_COLLECTION
          : options.collection;
      for (let last = false; ; last = true) {
        const sent = await this.send(
          file,
          collection,
          configuration,
          options.signal,
        );
        if ("id" in sent) return finish(sent);
        // The file is stored already, and its document still processing.
        try {
          await api.waitDocument(sent.doc_id, {
            timeout: remaining(),
            signal: options.signal,
          });
          docId = sent.doc_id;
          break;
        } catch (error) {
          // It failed or was deleted meanwhile: the file is sent again.
          const again =
            !last &&
            error instanceof PageIndexError &&
            (error.statusCode === 404 ||
              (await api.getDocument(sent.doc_id, options.signal)).status ===
                "failed");
          if (!again) throw error;
        }
      }
    }

    let job: ClassifyJob;
    try {
      job = await api.createClassify({
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
      job = await api.createClassify({
        docId,
        configuration,
        signal: options.signal,
      });
    }
    return finish(job);
  }

  /**
   * Waits for a classify job, and resolves with it once it is completed.
   * Rejects if it failed, or is not done within `timeout` (it goes on
   * running).
   */
  async waitClassify(
    jobId: string,
    options: WaitClassifyOptions = {},
  ): Promise<ClassifyJob> {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const deadline = Date.now() + timeout;
    const job = await this.documents.api.getClassify(jobId, options.signal);
    return this.done(job, deadline, timeout, options.signal);
  }

  /** A classify job, with its result once it is completed. */
  getClassify(jobId: string): Promise<ClassifyJob> {
    return this.documents.api.getClassify(jobId);
  }

  /**
   * Sends a file with the job. A file stored already whose document is still
   * processing starts none: its document comes back.
   */
  private async send(
    file: { blob: Blob; fileName: string },
    collection: string | null,
    configuration: ClassifyConfiguration,
    signal?: AbortSignal,
  ): Promise<ClassifyJob | { doc_id: string }> {
    const api = this.documents.api;
    const create = async () =>
      api.createClassify({
        file: file.blob,
        fileName: file.fileName,
        collectionId: await collectionIdOf(api, this.collections, collection),
        configuration,
        signal,
      });
    try {
      try {
        return await create();
      } catch (error) {
        // The collection found earlier is gone: find or make it again.
        const gone =
          error instanceof PageIndexError &&
          error.statusCode === 404 &&
          collection !== null &&
          this.collections.delete(collection);
        if (!gone) throw error;
        return await create();
      }
    } catch (error) {
      const docId = storedDocumentOf(error);
      if (docId === undefined) throw error;
      return { doc_id: docId };
    }
  }

  private async done(
    job: ClassifyJob,
    deadline: number,
    timeout: number,
    signal?: AbortSignal,
  ): Promise<ClassifyJob> {
    const api = this.documents.api;
    let current = job;
    while (current.status === "pending" || current.status === "running") {
      if (Date.now() > deadline) {
        throw new PageIndexError(
          `Classify job ${current.id} is still ${current.status} after ${Math.round(timeout / 1000)}s. It goes on running in the cloud: read it with getClassify(jobId).`,
          undefined,
          { job: current },
        );
      }
      await sleep(POLL_INTERVAL, signal);
      try {
        current = await api.getClassify(current.id, signal);
      } catch (error) {
        if (signal?.aborted) throw error;
        throw new PageIndexError(
          `Could not read classify job ${current.id}: ${(error as Error).message}. It may still be running in the cloud: read it with getClassify(jobId).`,
          error instanceof PageIndexError ? error.code : undefined,
          { job: current },
          error instanceof PageIndexError ? error.statusCode : undefined,
        );
      }
    }
    if (current.status !== "completed") {
      throw new PageIndexError(
        `Classify job ${current.id} ${current.status}${current.error_message ? `: ${current.error_message}` : "."}`,
        undefined,
        { job: current },
      );
    }
    return current;
  }
}

function configurationOf(
  classes: ClassifyClasses,
  options: PageClassifyOptions,
): ClassifyConfiguration {
  const named = Array.isArray(classes)
    ? classes.map((c) => (typeof c === "string" ? { name: c } : c))
    : Object.entries(classes).map(([name, description]) =>
        description ? { name, description } : { name },
      );
  const configuration: ClassifyConfiguration = {
    classes: named,
    granularity: options.granularity ?? "document",
  };
  if (options.pages !== undefined) {
    configuration.target_pages = Array.isArray(options.pages)
      ? `${options.pages[0]}-${options.pages[1]}`
      : String(options.pages);
  }
  return configuration;
}
