import type { McpTransport } from "../transport.js";
import { type DocumentAddress, documentAddressArgs } from "./address.js";
import type { DocumentMetadata, NextSteps } from "./types.js";

export type GetDocumentParams = DocumentAddress & {
  waitForCompletion?: boolean;
};

export interface GetDocumentResult {
  name: string;
  description: string;
  status: string;
  created_at: string;
  page_count?: number;
  /** The containing folder's id; `null` at the library root. */
  folder_id: string | null;
  /** The document's library path; absent for documents that have none. */
  path?: string;
  /** Set for documents shared with the caller, which tools cannot modify. */
  read_only?: true;
  metadata?: DocumentMetadata;
  /** Present when `waitForCompletion` made the call wait. */
  wait_info?: {
    waited: boolean;
    timed_out?: boolean;
    wait_time_ms?: number;
    poll_count?: number;
  };
  next_steps: NextSteps;
}

export async function getDocument(
  transport: McpTransport,
  params: GetDocumentParams,
): Promise<GetDocumentResult> {
  return transport.callTool<GetDocumentResult>("get_document", {
    ...documentAddressArgs(params),
    wait_for_completion: params.waitForCompletion,
  });
}
