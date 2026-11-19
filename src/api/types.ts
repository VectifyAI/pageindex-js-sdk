/** Your own tags for a document, keyed by name. */
export type DocumentTags = Record<string, string | number | boolean>;

export interface SubmitDocumentOptions {
  /** Defaults to the client's `folderScope` when no `collectionId` is given. */
  folderId?: string;
  /** The collection to store the document in, in place of a folder. */
  collectionId?: string;
  metadata?: DocumentTags;
  /**
   * `false` stores the document's pages and builds no outline index: the
   * upload is charged less, and `buildOutlineIndex()` builds the index later.
   * Defaults to `true`.
   */
  index?: boolean;
  /**
   * With a PDF and `index: false`: an extract job's configuration, as
   * `createExtract()` takes it. The job starts on the document, its id is the
   * answer's `extract_job_id`. Only the extraction is charged, once the job
   * completes; a job that does not complete fails the document this upload
   * made and deletes its file. A file
   * stored already that is still processing starts no job: the upload
   * rejects with status 409, and the error's `details.detail.doc_id` names
   * the stored document.
   */
  extract?: ExtractConfiguration;
}

export interface SubmitDocumentResponse {
  doc_id: string;
  /** The stored name; a taken name gains a numeric suffix. */
  name?: string;
  /** The same file was stored already; this is that document. */
  duplicate?: boolean;
  /** With `extract`: the job the upload started. */
  extract_job_id?: string;
}

export interface GetDocumentMetadataResponse {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  pageNum?: number;
  folderId?: string | null;
  collectionId?: string | null;
  metadata?: DocumentTags | null;
}

export interface WaitDocumentOptions {
  /** Milliseconds to wait. Default: 1,800,000 (30 minutes). */
  timeout?: number;
  signal?: AbortSignal;
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
  collectionId?: string | null;
  metadata?: DocumentTags | null;
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
  /** `"skipped"` for a document stored without an outline index. */
  index_status?: string;
  result?: TreeNode[];
}

export interface BuildOutlineIndexResponse {
  doc_id: string;
  index_status: "queued" | "processing" | "completed";
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

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  created_at?: string;
  document_count?: number;
}

export interface ListCollectionsResponse {
  collections: Collection[];
  total: number;
}

export interface CreateCollectionOptions {
  /** Unique among your collections. */
  name: string;
  description?: string;
}

export interface CreateCollectionResponse {
  collection: Collection;
}

export interface DeleteCollectionResponse {
  collection_id: string;
  deleted: true;
  deleted_documents?: number;
}

/**
 * A filter over documents' metadata, e.g. `{ year: { $gte: 2023 } }`.
 */
export type DocumentFilter = Record<string, unknown>;

/** A page that page search judged. */
export interface SearchedPage {
  /** Numbered from 1. */
  page: number;
  /** How likely the page helps answer the question, 0 to 1. */
  relevance: number;
  /** `"image"`: the page is held as a picture (a scan, a chart). */
  read: "text" | "image";
  /** Present with `includeText`. */
  text?: string;
}

export interface SearchPagesOptions {
  /** 1 to 10 questions. */
  questions: string[];
  /**
   * List exactly this many pages for each question. Without it, the pages
   * likely to help, possibly none, and the next most relevant as `more_pages`.
   */
  topK?: number;
  includeText?: boolean;
  /** The first page to search, from 1. */
  startPage?: number;
  /** The last page to search, included. */
  endPage?: number;
  signal?: AbortSignal;
}

export interface SearchPagesResponse {
  id: string;
  doc_id: string;
  /** One entry for each question, in the order asked. */
  results: Array<{
    question: string;
    pages: SearchedPage[];
    more_pages?: SearchedPage[];
  }>;
  /** Pages that could not be judged; not charged. */
  failed_pages: number[];
  usage: {
    pages: number;
    questions: number;
    billable_pages: number;
    credits: number;
    balance: number | null;
  };
  seconds: number;
}

export interface SearchDocumentsOptions {
  /** 1 to 10 questions. */
  questions: string[];
  /** Judge only these documents. */
  documentIds?: string[];
  collectionId?: string;
  /** A folder ID; `"root"` is the library root. */
  folderId?: string;
  /** With `folderId`, the documents of its descendant folders too. */
  recursive?: boolean;
  metadataFilter?: DocumentFilter;
  /**
   * List exactly this many documents for each question. Without it, the
   * documents likely to help, possibly none, and the next most relevant as
   * `more_documents`.
   */
  topK?: number;
  signal?: AbortSignal;
}

/** A document that document search judged. */
export interface MatchedDocument {
  id: string;
  name: string;
  pageNum: number;
  folderId: string | null;
  collectionId: string | null;
  metadata: DocumentTags | null;
  /** How likely the document holds the answer, 0 to 1. */
  relevance: number;
}

export interface SearchDocumentsResponse {
  id: string;
  /** One entry for each question, in the order asked. */
  results: Array<{
    question: string;
    documents: MatchedDocument[];
    more_documents?: MatchedDocument[];
  }>;
  /** Documents that could not be judged; not charged. */
  failed_documents: string[];
  /** Documents not ready yet; not judged. */
  processing_documents: string[];
  usage: {
    documents: number;
    questions: number;
    billable_documents: number;
    credits: number;
    balance: number | null;
  };
  seconds: number;
}

export type ExtractTier = "standard" | "pro";

export interface ExtractConfiguration {
  /** A JSON Schema whose top is an object or an array. */
  data_schema: Record<string, unknown>;
  tier?: ExtractTier;
  cite_sources?: boolean;
  /** E.g. `"3-9"`. */
  target_pages?: string;
  system_prompt?: string;
}

export type ExtractJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ExtractJob<T = unknown> {
  id: string;
  status: ExtractJobStatus;
  doc_id: string | null;
  configuration: ExtractConfiguration;
  created_at: string;
  updated_at: string;
  /** Present once completed: the JSON that fits the schema. */
  extract_result?: T;
  /**
   * Present once completed. With `cite_sources`, `field_metadata` gives the
   * page of each list item by its JSON Pointer, as `{ "/rows/0": { page: 3 } }`.
   */
  extract_metadata?: {
    field_metadata?: Record<string, { page?: number }>;
    [key: string]: unknown;
  };
  /** Present once completed. */
  usage?: { pages: number; credits: number };
  /** Present once failed. */
  error_message?: string;
}

export interface CreateExtractOptions {
  /** An uploaded document whose pages are ready. */
  docId: string;
  configuration: ExtractConfiguration;
  signal?: AbortSignal;
}

export interface ListExtractsOptions {
  /** 1 to 100. Default: 20. */
  limit?: number;
  /** The previous page's `next`. */
  after?: string;
}

export interface ListExtractsResponse {
  /** Newest first, without their results. */
  jobs: ExtractJob[];
  /** The value to pass as `after` for the next page; `null` on the last page. */
  next: string | null;
}

export interface DeleteExtractResponse {
  id: string;
  deleted: true;
}
