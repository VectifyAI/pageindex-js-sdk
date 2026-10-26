import type { McpTransport } from "../transport.js";
import { type DocumentAddress, documentAddressArgs } from "./address.js";
import type { NextSteps } from "./types.js";

export type GetDocumentStructureParams = DocumentAddress & {
  part?: number;
  waitForCompletion?: boolean;
};

export interface GetDocumentStructureResult {
  doc_name: string;
  /** The document's library path; absent for documents that have none. */
  path?: string;
  structure: unknown;
  total_parts?: number;
  next_steps: NextSteps;
}

export async function getDocumentStructure(
  transport: McpTransport,
  params: GetDocumentStructureParams,
): Promise<GetDocumentStructureResult> {
  return transport.callTool<GetDocumentStructureResult>(
    "get_document_structure",
    {
      ...documentAddressArgs(params),
      part: params.part,
      wait_for_completion: params.waitForCompletion,
    },
  );
}
