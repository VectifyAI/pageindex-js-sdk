import type { McpTransport } from "../transport.js";
import type { NextSteps } from "./types.js";

export interface FindRelevantDocumentsParams {
  query?: string;
  /** @deprecated Use `query` instead. */
  nameOrDescriptionFilter?: string;
  cursor?: string;
  limit?: number;
  folderId?: string | null;
}

export interface SearchDocumentItem {
  id: string;
  name: string;
  description: string;
  status: string;
  pageNum: number;
  createdAt: string;
  folderId: string | null;
  /** The document's library path; absent for documents that have none. */
  path?: string;
}

export interface FindRelevantDocumentsResult {
  docs: SearchDocumentItem[];
  search_mode: "keyword" | "smart";
  next_cursor?: string;
  total_returned: number;
  has_more: boolean;
  next_steps: NextSteps;
}

/**
 * @deprecated Use {@link browseDocuments} with `sort: "relevance"` (primary)
 * or {@link searchDocuments} (keyword escalation). The server still accepts
 * `find_relevant_documents` calls for backward compatibility, but the tool is
 * hidden from MCP `tools/list` and may be removed in a future release.
 */
export async function findRelevantDocuments(
  transport: McpTransport,
  params?: FindRelevantDocumentsParams,
): Promise<FindRelevantDocumentsResult> {
  return transport.callTool<FindRelevantDocumentsResult>(
    "find_relevant_documents",
    {
      query: params?.query ?? params?.nameOrDescriptionFilter,
      cursor: params?.cursor,
      limit: params?.limit,
      folder_id: params?.folderId,
    },
  );
}
