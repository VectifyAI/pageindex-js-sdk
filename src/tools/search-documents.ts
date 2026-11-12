import type { McpTransport } from "../transport.js";
import type {
  DocumentListItem,
  DocumentMetadata,
  MetadataFilter,
  NextSteps,
} from "./types.js";

interface SearchScope {
  /**
   * Folder as a library path (e.g. `"Research/2024"`); `""` is the library
   * root. Exclusive with `collection`.
   */
  path?: string;
  /** Include descendant folders. Server default: `true`. */
  recursive?: boolean;
  /** Search one collection, by name, instead of a folder. */
  collection?: string;
}

/**
 * Finds the documents likely to answer each question. Priced by the
 * documents it looks at, so list with `browseDocuments()` / `listDocuments()`
 * first when a folder or metadata can pick the documents out.
 */
export interface SearchDocumentsParams extends SearchScope {
  /** 1–10 questions, each up to 2,000 characters. */
  questions: string[];
  /** Documents per question (1–50). Without it, close calls come back as `more_documents`. */
  topK?: number;
  /** Narrows the search to documents whose metadata matches. */
  metadataFilter?: MetadataFilter;
}

export interface FoundDocument {
  name: string;
  folder_id?: string;
  /** The document's library path; collection documents have none. */
  path?: string;
  collection?: string;
  pages: number;
  metadata?: DocumentMetadata;
  /** How likely the document is to answer the question, 0–1. */
  relevance: number;
}

export interface SearchDocumentsResult {
  /** One entry per question, in the order asked. */
  results: Array<{
    question: string;
    documents: FoundDocument[];
    /** Less likely documents; only when `topK` is not set. */
    more_documents?: FoundDocument[];
  }>;
  documents_still_processing?: number;
  documents_not_judged?: number;
  next_steps: NextSteps;
}

/**
 * @deprecated Keyword matching on file names and descriptions. Pass
 * `questions` instead; the server still accepts this form.
 */
export interface KeywordSearchDocumentsParams extends SearchScope {
  query: string;
  metadataFilter?: MetadataFilter;
  limit?: number;
  /** @deprecated Pass `path` instead. */
  folderId?: string;
}

export interface SearchDocumentResultItem extends DocumentListItem {
  relevance?: number;
}

/** @deprecated The result of the keyword form. */
export interface KeywordSearchDocumentsResult {
  documents: SearchDocumentResultItem[];
  metadata_filter_truncated?: true;
  next_steps: NextSteps;
}

export function searchDocuments(
  transport: McpTransport,
  params: SearchDocumentsParams | KeywordSearchDocumentsParams,
): Promise<SearchDocumentsResult | KeywordSearchDocumentsResult> {
  const scope = {
    path: params.path,
    recursive: params.recursive,
    collection: params.collection,
    metadata_filter: params.metadataFilter,
  };
  if ("questions" in params) {
    return transport.callTool<SearchDocumentsResult>("search_documents", {
      questions: params.questions,
      top_k: params.topK,
      ...scope,
    });
  }
  return transport.callTool<KeywordSearchDocumentsResult>("search_documents", {
    query: params.query,
    folder_id: params.folderId,
    limit: params.limit,
    ...scope,
  });
}
