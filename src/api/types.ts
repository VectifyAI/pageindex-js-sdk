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

export interface CreateFolderOptions {
  name: string;
  description?: string;
  parentFolderId?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  description: string | null;
  parent_folder_id: string | null;
  created_at: string;
  updated_at: string;
  file_count: number;
  children_count: number;
}

export interface CreateFolderResponse {
  folder: FolderItem;
}

export interface ListFoldersOptions {
  /**
   * Use "root" for root-level folders only, a folder ID for subfolders, or omit for all folders.
   */
  parentFolderId?: string;
}

export interface ListFoldersResponse {
  folders: FolderItem[];
  total: number;
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
