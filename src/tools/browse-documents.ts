import type { McpTransport } from "../transport.js";
import type { DocumentMetadata, NextSteps } from "./types.js";

export type BrowseSortMode = "time" | "relevance";

export interface BrowseDocumentsParams {
  /**
   * Folder as a library path (e.g. `"Research/2024"`), copied from a folder's
   * `path`; `""` is the library root. Takes precedence over `folderId`.
   */
  path?: string;
  /** @deprecated Pass `path` instead. */
  folderId?: string;
  recursive?: boolean;
  sort?: BrowseSortMode;
  query?: string;
  offset?: number;
  limit?: number;
}

export interface BrowseFolderItem {
  id: string;
  name: string;
  /** The folder's library path; pass it back as `path` to scope into it. */
  path: string;
  description: string | null;
  children_count: number;
  file_count: number;
  created_at: string;
}

export interface BrowseDocumentItem {
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
  metadata?: DocumentMetadata;
}

export interface BrowseDocumentsResult {
  folders?: BrowseFolderItem[];
  documents: BrowseDocumentItem[];
  sort: BrowseSortMode;
  next_offset: number | null;
  has_more: boolean;
  next_steps: NextSteps;
}

export async function browseDocuments(
  transport: McpTransport,
  params?: BrowseDocumentsParams,
): Promise<BrowseDocumentsResult> {
  return transport.callTool<BrowseDocumentsResult>("browse_documents", {
    path: params?.path,
    folder_id: params?.folderId,
    recursive: params?.recursive,
    sort: params?.sort,
    query: params?.query,
    offset: params?.offset,
    limit: params?.limit,
  });
}
