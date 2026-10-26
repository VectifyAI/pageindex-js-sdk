import type { McpTransport } from "../transport.js";
import type { NextSteps } from "./types.js";

export interface RecentDocumentsParams {
  folderId?: string | null;
  cursor?: string;
  limit?: number;
}

export interface RecentDocumentItem {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  pageNum?: number;
  /** The document's library path; absent for documents that have none. */
  path?: string;
}

export interface RecentDocumentsResult {
  docs: RecentDocumentItem[];
  total_shown: number;
  next_cursor?: string;
  has_more: boolean;
  processing_count: number;
  ready_count: number;
  failed_count: number;
  next_steps: NextSteps;
}

/**
 * @deprecated Use {@link browseDocuments} instead. The server still accepts
 * `recent_documents` calls for backward compatibility, but the tool is hidden
 * from MCP `tools/list` and may be removed in a future release.
 */
export async function recentDocuments(
  transport: McpTransport,
  params?: RecentDocumentsParams,
): Promise<RecentDocumentsResult> {
  return transport.callTool<RecentDocumentsResult>("recent_documents", {
    folder_id: params?.folderId,
    cursor: params?.cursor,
    limit: params?.limit,
  });
}
