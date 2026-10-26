import type { McpTransport } from "../transport.js";
import type { NextSteps } from "./types.js";

export interface SearchDocumentsParams {
  query: string;
  /**
   * Folder as a library path (e.g. `"Research/2024"`), copied from a folder's
   * `path`; `""` is the library root. Takes precedence over `folderId`.
   */
  path?: string;
  /** @deprecated Pass `path` instead. */
  folderId?: string;
  recursive?: boolean;
  limit?: number;
}

export interface SearchDocumentResultItem {
  name: string;
  description: string;
  status: string;
  created_at: string;
  folder_id?: string;
  /**
   * The document's own library path (folders included, e.g.
   * `"Research/2024/Q3 Report.pdf"`); pass it back as `path` to address it.
   */
  path?: string;
  /** LLM relevance score, 6-10. Higher is more relevant. */
  score: number;
}

export interface SearchDocumentsResult {
  documents: SearchDocumentResultItem[];
  next_steps: NextSteps;
}

export async function searchDocuments(
  transport: McpTransport,
  params: SearchDocumentsParams,
): Promise<SearchDocumentsResult> {
  return transport.callTool<SearchDocumentsResult>("search_documents", {
    query: params.query,
    path: params.path,
    folder_id: params.folderId,
    recursive: params.recursive,
    limit: params.limit,
  });
}
