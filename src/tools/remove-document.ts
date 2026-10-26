import type { McpTransport } from "../transport.js";
import type { NextSteps } from "./types.js";

/**
 * Prefer `paths`: library paths copied verbatim from a `browseDocuments()` or
 * `searchDocuments()` result. Max 10 per call.
 */
export type RemoveDocumentParams =
  | { paths: string[]; docNames?: never; folderId?: never }
  | {
      /** @deprecated Pass `paths` instead. */
      docNames: string[];
      /** @deprecated Pass `paths` instead. */
      folderId?: string | null;
      paths?: never;
    };

export interface RemoveDocumentResultItem {
  /** The requested path; present when the document was addressed by path. */
  path?: string;
  doc_name: string;
  status: "deleted" | "not_found" | "failed";
  error?: string;
}

export interface RemoveDocumentResult {
  results: RemoveDocumentResultItem[];
  next_steps: NextSteps;
}

export async function removeDocument(
  transport: McpTransport,
  params: RemoveDocumentParams,
): Promise<RemoveDocumentResult> {
  return transport.callTool<RemoveDocumentResult>(
    "remove_document",
    params.paths !== undefined
      ? { paths: params.paths }
      : { doc_names: params.docNames, folder_id: params.folderId },
  );
}
