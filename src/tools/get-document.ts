import type { McpTransport } from "../transport.js";
import { type DocumentAddress, documentAddressArgs } from "./address.js";
import type { NextSteps } from "./types.js";

export type GetDocumentParams = DocumentAddress & {
  waitForCompletion?: boolean;
};

export interface GetDocumentResult {
  id: string;
  name: string;
  description: string;
  status: string;
  /** The document's library path; absent for documents that have none. */
  path?: string;
  createdAt: string;
  pageNum?: number;
  wait_info?: {
    waited: boolean;
    elapsed_seconds?: number;
    final_status?: string;
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
