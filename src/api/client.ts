import { PageIndexError } from "../errors.js";
import type {
  ChatCompletionChunk,
  ChatCompletionsParams,
  ChatCompletionsResponse,
  CreateFolderOptions,
  CreateFolderResponse,
  DeleteDocumentResponse,
  GetDocumentMetadataResponse,
  GetTreeOptions,
  GetTreeResponse,
  ListDocumentsOptions,
  ListDocumentsResponse,
  ListFoldersOptions,
  ListFoldersResponse,
  SubmitDocumentOptions,
  SubmitDocumentResponse,
} from "./types.js";

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
    if (options?.mode) {
      formData.append("mode", options.mode);
    }
    const folderId = options?.folderId ?? this.folderScope;
    if (folderId) {
      formData.append("folder_id", folderId);
    }
    return this.requestMultipart<SubmitDocumentResponse>("/doc/", formData);
  }

  async getDocument(docId: string): Promise<GetDocumentMetadataResponse> {
    return this.request<GetDocumentMetadataResponse>(
      `/doc/${encodeURIComponent(docId)}/metadata`,
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
    const response = await fetch(url, {
      ...init,
      headers: {
        api_key: this.apiKey,
        ...init?.headers,
      },
    });
    return this.handleResponse<T>(response);
  }

  private async requestMultipart<T>(
    path: string,
    formData: FormData,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
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
    const response = await fetch(url, {
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
      let errorCode = this.mapStatusToErrorCode(response.status);
      let details: Record<string, unknown> | undefined;

      try {
        const json = JSON.parse(text) as Record<string, unknown>;
        if (json.error && typeof json.error === "string") {
          message = json.error;
        }
        if (json.errorCode && typeof json.errorCode === "string") {
          errorCode = json.errorCode as typeof errorCode;
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
      case 403:
        return "PLAN_REQUIRED" as const;
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
