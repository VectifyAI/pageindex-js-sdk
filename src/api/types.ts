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

export interface GetTreeOptions {
  nodeSummary?: boolean;
}

export interface TreeNode {
  title: string;
  node_id: string;
  page_index: number;
  text: string;
  summary?: string;
  nodes?: TreeNode[];
}

export interface GetTreeResponse {
  doc_id: string;
  status: string;
  retrieval_ready?: boolean;
  result?: TreeNode[];
}

export interface ChatCompletionsParams {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  doc_id?: string | string[];
  model?: string;
  stream?: boolean;
  temperature?: number;
  enable_citations?: boolean;
  stream_metadata?: boolean;
}

export interface ChatCompletionsResponse {
  id: string;
  object?: string;
  created?: number;
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

export interface ChatCompletionChunk {
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string | null;
  }>;
  block_metadata?: {
    type: string;
    tool_name?: string;
    [key: string]: unknown;
  };
}
