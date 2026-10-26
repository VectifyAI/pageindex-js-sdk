import type { McpTransport } from "../transport.js";
import { type DocumentAddress, documentAddressArgs } from "./address.js";
import type { NextSteps } from "./types.js";

export type GetPageContentParams = DocumentAddress & {
  pages: string;
  waitForCompletion?: boolean;
};

export interface PageContentItem {
  page: number;
  text: string;
  block_id?: string;
  image_count?: number;
  image_annotations?: string[];
}

export interface GetPageContentResult {
  doc_name: string;
  /** The document's library path; absent for documents that have none. */
  path?: string;
  total_pages: number;
  requested_pages: string;
  returned_pages: string;
  content: PageContentItem[];
  /**
   * Each returned page's full rendered image; pass an `image_path` to
   * `getDocumentImage()` when the extracted text looks incomplete.
   */
  page_images?: { page: number; image_path: string }[];
  next_steps: NextSteps;
}

export async function getPageContent(
  transport: McpTransport,
  params: GetPageContentParams,
): Promise<GetPageContentResult> {
  return transport.callTool<GetPageContentResult>("get_page_content", {
    ...documentAddressArgs(params),
    pages: params.pages,
    wait_for_completion: params.waitForCompletion,
  });
}
