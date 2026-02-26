// REST API response types — field names match actual API responses

export interface SubmitDocumentOptions {
  mode?: string;
  folderId?: string;
}

export interface SubmitDocumentResponse {
  doc_id: string;
}

export interface GetDocumentMetadataResponse {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  pageNum?: number;
  folderId?: string | null;
}

export interface ListDocumentsOptions {
  limit?: number;
  offset?: number;
  folderId?: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  pageNum?: number;
  folderId?: string | null;
}

export interface ListDocumentsResponse {
  documents: DocumentItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface DeleteDocumentResponse {
  message: string;
}

export interface ChatCompletionsParams {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  doc_id?: string;
  doc_ids?: string[];
  model?: string;
  stream?: boolean;
  temperature?: number;
  enable_citations?: boolean;
  stream_metadata?: boolean;
}

export interface ChatCompletionsResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}