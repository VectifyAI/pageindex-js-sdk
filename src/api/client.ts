import { PageIndexError, type PageIndexErrorCode } from "../errors.js";
import { sleep } from "../internal.js";
import { fetchWithRetry } from "../retry.js";
import type {
  BuildOutlineIndexResponse,
  ChatCompletionChunk,
  ChatCompletionsParams,
  ChatCompletionsResponse,
  CreateCollectionOptions,
  CreateCollectionResponse,
  CreateExtractOptions,
  CreateFolderOptions,
  CreateFolderResponse,
  DeleteCollectionResponse,
  DeleteDocumentResponse,
  DeleteExtractResponse,
  ExtractJob,
  GetDocumentMetadataResponse,
  GetTreeOptions,
  GetTreeResponse,
  ListCollectionsResponse,
  ListDocumentsOptions,
  ListDocumentsResponse,
  ListExtractsOptions,
  ListExtractsResponse,
  ListFoldersOptions,
  ListFoldersResponse,
  SearchDocumentsOptions,
  SearchDocumentsResponse,
  SearchPagesOptions,
  SearchPagesResponse,
  SubmitDocumentOptions,
  SubmitDocumentResponse,
  WaitDocumentOptions,
} from "./types.js";

const DEFAULT_DOCUMENT_TIMEOUT = 1_800_000;

export interface PageIndexApiConfig {
  apiUrl: string;
  apiKey: string;
  folderScope?: string;
}

export class PageIndexApi {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly folderScope?: string;

  constructor(config: PageIndexApiConfig) {
    this.baseUrl = config.apiUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
    this.folderScope = config.folderScope;
  }

  async submitDocument(
    file: Blob | Buffer | ArrayBuffer,
    fileName: string,
    options?: SubmitDocumentOptions,
  ): Promise<SubmitDocumentResponse> {
    const formData = new FormData();
    const blob =
      file instanceof Blob
        ? file
        : new Blob([file], { type: "application/octet-stream" });
    formData.append("file", blob, fileName);
    if (options?.index === false) {
      formData.append("algorithm", "none");
    }
    const folderId =
      options?.folderId ??
      (options?.collectionId === undefined ? this.folderScope : undefined);
    if (folderId) {
      formData.append("folder_id", folderId);
    }
    if (options?.collectionId !== undefined) {
      formData.append("collection_id", options.collectionId);
    }
    if (options?.metadata !== undefined) {
      formData.append("metadata", JSON.stringify(options.metadata));
    }
    if (options?.extract !== undefined) {
      formData.append("extract", JSON.stringify(options.extract));
    }
    return this.requestMultipart<SubmitDocumentResponse>("/doc/", formData);
  }

  /**
   * Waits until a document's processing is done, and returns it as
   * `getDocument()` does. Rejects if the processing failed, or is not done
   * within `timeout` (it goes on in the cloud). Three poll failures in a row
   * reject too; a 401, 403 or 404 rejects at once.
   */
  async waitDocument(
    docId: string,
    options?: WaitDocumentOptions,
  ): Promise<GetDocumentMetadataResponse> {
    const timeout = options?.timeout ?? DEFAULT_DOCUMENT_TIMEOUT;
    const deadline = Date.now() + timeout;
    let interval = 2000;
    let pollFailures = 0;
    while (true) {
      let status: string | undefined;
      try {
        const doc = await this.getDocument(docId, options?.signal);
        pollFailures = 0;
        if (doc.status === "completed") return doc;
        status = doc.status;
      } catch (error) {
        if (options?.signal?.aborted) throw error;
        if (
          error instanceof PageIndexError &&
          [401, 403, 404].includes(error.statusCode ?? 0)
        ) {
          throw error;
        }
        pollFailures += 1;
        if (pollFailures >= 3) {
          throw new PageIndexError(
            `Could not poll document status (doc_id: ${docId}): ${(error as Error).message}. Processing continues in the cloud; poll getDocument() for status.`,
            error instanceof PageIndexError ? error.code : "INTERNAL_ERROR",
            undefined,
            error instanceof PageIndexError ? error.statusCode : undefined,
          );
        }
      }
      if (status === "failed") {
        throw new PageIndexError(
          `Document processing failed (doc_id: ${docId}).`,
          "INTERNAL_ERROR",
        );
      }
      if (Date.now() >= deadline) {
        throw new PageIndexError(
          `Timed out after ${Math.round(timeout / 1000)}s waiting for document processing (doc_id: ${docId}, last status: ${status}). Processing continues in the cloud; poll getDocument() for status.`,
          "INTERNAL_ERROR",
        );
      }
      await sleep(interval, options?.signal);
      interval = Math.min(interval * 1.5, 15_000);
    }
  }

  /**
   * Starts building the outline index of a document stored without one
   * (`index: false`). Charged as an upload that builds its index. Read
   * `getTree()`'s `index_status` to see when it is built.
   */
  async buildOutlineIndex(docId: string): Promise<BuildOutlineIndexResponse> {
    return this.request<BuildOutlineIndexResponse>(
      `/doc/${encodeURIComponent(docId)}/index`,
      { method: "POST" },
    );
  }

  async getDocument(
    docId: string,
    signal?: AbortSignal,
  ): Promise<GetDocumentMetadataResponse> {
    return this.request<GetDocumentMetadataResponse>(
      `/doc/${encodeURIComponent(docId)}/metadata`,
      { signal },
    );
  }

  async getTree(
    docId: string,
    options?: GetTreeOptions,
  ): Promise<GetTreeResponse> {
    const params = new URLSearchParams({ type: "tree" });
    if (options?.nodeSummary) {
      params.set("summary", "true");
    }
    return this.request<GetTreeResponse>(
      `/doc/${encodeURIComponent(docId)}/?${params.toString()}`,
    );
  }

  async listDocuments(
    options?: ListDocumentsOptions,
  ): Promise<ListDocumentsResponse> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) {
      params.set("limit", String(options.limit));
    }
    if (options?.offset !== undefined) {
      params.set("offset", String(options.offset));
    }
    const folderId = options?.folderId ?? this.folderScope;
    if (folderId) {
      params.set("folder_id", folderId);
    }
    const qs = params.toString();
    return this.request<ListDocumentsResponse>(`/docs${qs ? `?${qs}` : ""}`);
  }

  async deleteDocument(docId: string): Promise<DeleteDocumentResponse> {
    return this.request<DeleteDocumentResponse>(
      `/doc/${encodeURIComponent(docId)}/`,
      { method: "DELETE" },
    );
  }

  /** One page, 1-based, as JPEG bytes. */
  async pageImage(docId: string, page: number): Promise<Uint8Array> {
    const { images } = await this.request<{
      images: { page: number; url: string | null }[];
    }>(`/doc/s3/${encodeURIComponent(docId)}/images?start=${page}&end=${page}`);
    const url = images.find((image) => image.page === page)?.url;
    if (!url) {
      throw new PageIndexError(
        `No image URL returned for page ${page}.`,
        "INTERNAL_ERROR",
      );
    }
    // a presigned URL: the API key stays off it
    const response = await fetchWithRetry(url);
    if (!response.ok) await this.handleResponse(response);
    return new Uint8Array(await response.arrayBuffer());
  }

  async createFolder(
    options: CreateFolderOptions,
  ): Promise<CreateFolderResponse> {
    const payload: Record<string, string> = { name: options.name };
    if (options.description !== undefined) {
      payload.description = options.description;
    }
    if (options.parentFolderId !== undefined) {
      payload.parent_folder_id = options.parentFolderId;
    }
    return this.request<CreateFolderResponse>("/folder/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async listFolders(
    options?: ListFoldersOptions,
  ): Promise<ListFoldersResponse> {
    const params = new URLSearchParams();
    if (options?.parentFolderId !== undefined) {
      params.set("parent_folder_id", options.parentFolderId);
    }
    const qs = params.toString();
    return this.request<ListFoldersResponse>(`/folders/${qs ? `?${qs}` : ""}`);
  }

  async listCollections(): Promise<ListCollectionsResponse> {
    return this.request<ListCollectionsResponse>("/collections/");
  }

  async createCollection(
    options: CreateCollectionOptions,
  ): Promise<CreateCollectionResponse> {
    return this.requestJson<CreateCollectionResponse>("POST", "/collection/", {
      name: options.name,
      description: options.description,
    });
  }

  /** Deletes a collection and every document in it. */
  async deleteCollection(
    collectionId: string,
  ): Promise<DeleteCollectionResponse> {
    return this.request<DeleteCollectionResponse>(
      `/collection/${encodeURIComponent(collectionId)}/`,
      { method: "DELETE" },
    );
  }

  /**
   * Judges each page of one document on how likely it helps answer each
   * question. Every page searched is charged. A document still processing is
   * refused with HTTP 409.
   */
  async searchPages(
    docId: string,
    options: SearchPagesOptions,
  ): Promise<SearchPagesResponse> {
    return this.requestJson<SearchPagesResponse>(
      "POST",
      `/doc/${encodeURIComponent(docId)}/page-search/`,
      {
        questions: options.questions,
        top_k: options.topK,
        include_text: options.includeText ?? false,
        start_page: options.startPage,
        end_page: options.endPage,
      },
      options.signal,
    );
  }

  /**
   * Judges each document in scope on how likely it holds what answers each
   * question. Every document judged is charged. Without `documentIds`, every
   * document in scope, up to 1,000; more is refused with HTTP 400.
   */
  async searchDocuments(
    options: SearchDocumentsOptions,
  ): Promise<SearchDocumentsResponse> {
    return this.requestJson<SearchDocumentsResponse>(
      "POST",
      "/docs/search/",
      {
        questions: options.questions,
        document_ids: options.documentIds,
        collection_id: options.collectionId,
        folder_id: options.folderId,
        recursive: options.recursive ?? false,
        metadata_filter: options.metadataFilter,
        top_k: options.topK,
      },
      options.signal,
    );
  }

  /**
   * Starts an extract job on an uploaded document. A document still
   * processing is refused with HTTP 409.
   */
  async createExtract<T = unknown>(
    options: CreateExtractOptions,
  ): Promise<ExtractJob<T>> {
    return this.request<ExtractJob<T>>("/extract/", {
      method: "POST",
      body: new URLSearchParams({
        configuration: JSON.stringify(options.configuration),
        doc_id: options.docId,
      }),
      signal: options.signal,
    });
  }

  /** An extract job, with its result once it is completed. */
  async getExtract<T = unknown>(
    jobId: string,
    signal?: AbortSignal,
  ): Promise<ExtractJob<T>> {
    return this.request<ExtractJob<T>>(
      `/extract/${encodeURIComponent(jobId)}/`,
      { signal },
    );
  }

  /** Your extract jobs, newest first, without their results. */
  async listExtracts(
    options?: ListExtractsOptions,
  ): Promise<ListExtractsResponse> {
    const params = new URLSearchParams({
      limit: String(options?.limit ?? 20),
    });
    if (options?.after !== undefined) {
      params.set("after", options.after);
    }
    return this.request<ListExtractsResponse>(
      `/extracts/?${params.toString()}`,
    );
  }

  /**
   * Stops a pending or running extract job; nothing is charged. A job that
   * has already ended is refused with HTTP 409.
   */
  async cancelExtract(jobId: string): Promise<ExtractJob> {
    return this.request<ExtractJob>(
      `/extract/${encodeURIComponent(jobId)}/cancel/`,
      { method: "POST" },
    );
  }

  /** Deletes an extract job and its result. The document it read stays. */
  async deleteExtract(jobId: string): Promise<DeleteExtractResponse> {
    return this.request<DeleteExtractResponse>(
      `/extract/${encodeURIComponent(jobId)}/`,
      { method: "DELETE" },
    );
  }

  async chatCompletions(
    params: ChatCompletionsParams & { stream: true },
  ): Promise<AsyncIterable<ChatCompletionChunk>>;
  async chatCompletions(
    params: ChatCompletionsParams & { stream?: false },
  ): Promise<ChatCompletionsResponse>;
  async chatCompletions(
    params: ChatCompletionsParams,
  ): Promise<ChatCompletionsResponse | AsyncIterable<ChatCompletionChunk>> {
    if (params.stream) {
      return this.requestStream("/chat/completions", params);
    }
    return this.request<ChatCompletionsResponse>("/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetchWithRetry(url, {
      ...init,
      headers: {
        api_key: this.apiKey,
        ...init?.headers,
      },
    });
    return this.handleResponse<T>(response);
  }

  /** A JSON request; fields set to `undefined` are left out. */
  private requestJson<T>(
    method: string,
    path: string,
    payload: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.request<T>(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  }

  private async requestMultipart<T>(
    path: string,
    formData: FormData,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: { api_key: this.apiKey },
      body: formData,
    });
    return this.handleResponse<T>(response);
  }

  private async requestStream(
    path: string,
    params: ChatCompletionsParams,
  ): Promise<AsyncIterable<ChatCompletionChunk>> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_key: this.apiKey,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      await this.handleResponse(response);
    }

    if (!response.body) {
      throw new PageIndexError(
        "Response body is empty",
        "INTERNAL_ERROR",
        undefined,
        response.status,
      );
    }

    return this.parseSSEStream(response.body);
  }

  private async *parseSSEStream(
    body: ReadableStream<Uint8Array>,
  ): AsyncIterable<ChatCompletionChunk> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;
          yield JSON.parse(data) as ChatCompletionChunk;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let message = `API request failed with status ${response.status}`;
      let errorCode: PageIndexErrorCode = this.mapStatusToErrorCode(
        response.status,
      );
      let details: Record<string, unknown> | undefined;

      try {
        const json = JSON.parse(text) as Record<string, unknown>;
        const said = messageOf(json.error) ?? messageOf(json.detail);
        if (said) message = said;
        if (response.status === 403) errorCode = forbiddenCode(json.error);
        if (json.errorCode && typeof json.errorCode === "string") {
          errorCode = json.errorCode as PageIndexErrorCode;
        }
        details = json;
      } catch {
        if (text) message = text;
      }

      throw new PageIndexError(message, errorCode, details, response.status);
    }

    return response.json() as Promise<T>;
  }

  private mapStatusToErrorCode(status: number) {
    switch (status) {
      case 401:
        return "UNAUTHORIZED" as const;
      case 402:
        return "USAGE_LIMIT_REACHED" as const;
      case 403:
        return "FORBIDDEN" as const;
      case 404:
        return "NOT_FOUND" as const;
      case 429:
        return "RATE_LIMITED" as const;
      case 503:
        return "SERVICE_UNAVAILABLE" as const;
      default:
        return "INTERNAL_ERROR" as const;
    }
  }
}

/** A message the API sent: a string, or an object's `message`. */
function messageOf(value: unknown): string | undefined {
  if (typeof value === "string") return value || undefined;
  if (value && typeof value === "object") {
    const { message } = value as { message?: unknown };
    if (typeof message === "string" && message) return message;
  }
  return undefined;
}

/** The API's codes for a 403 that a plan or a subscription lifts. */
const PLAN_LIMITS = new Set([
  "page_limit_reached",
  "query_limit_reached",
  "thinking_limit_reached",
  "chat_page_limit_reached",
  "teamspace_page_limit_reached",
]);
const NO_SUBSCRIPTION = new Set([
  "subscription_required",
  "teamspace_no_subscription",
]);

/**
 * A 403 by the API's `error.code`: a plan's limit, no subscription, or
 * anything else (an invalid API key, a missing permission) as FORBIDDEN.
 */
function forbiddenCode(error: unknown) {
  const code =
    error && typeof error === "object"
      ? (error as { code?: unknown }).code
      : undefined;
  if (typeof code === "string" && PLAN_LIMITS.has(code)) {
    return "PLAN_REQUIRED" as const;
  }
  if (typeof code === "string" && NO_SUBSCRIPTION.has(code)) {
    return "SUBSCRIPTION_REQUIRED" as const;
  }
  return "FORBIDDEN" as const;
}
