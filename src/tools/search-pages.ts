import type { McpTransport } from "../transport.js";
import { type DocumentAddress, documentAddressArgs } from "./address.js";
import type { NextSteps } from "./types.js";

/**
 * Finds the pages of one document that answer the questions, with their
 * text. Priced by the pages it reads. Documents without page records are
 * refused with `INVALID_INPUT`; read those with `getPageContent()`.
 */
export type SearchPagesParams = DocumentAddress & {
  /** 1–10 questions, each up to 2,000 characters. */
  questions: string[];
  /** Pages per question (1–50). Without it, close calls come back as `more_pages`. */
  topK?: number;
  startPage?: number;
  endPage?: number;
};

export interface FoundPage {
  page: number;
  /** How likely the page is to answer the question, 0–1. */
  relevance: number;
  /**
   * `"image"` pages are pictures (scans, charts): their `text` may be
   * incomplete, so look at them with `viewPages()`.
   */
  read: "text" | "image";
  text?: string;
  /** Set on `"image"` pages: says their text may be incomplete. */
  note?: string;
}

export interface SearchPagesResult {
  doc_name: string;
  path?: string;
  /** One entry per question, in the order asked. */
  results: Array<{
    question: string;
    pages: FoundPage[];
    more_pages?: FoundPage[];
  }>;
  /** Pages found whose text did not fit in the response. */
  text_left_out?: number[];
  failed_pages?: number[];
  next_steps: NextSteps;
}

export function searchPages(
  transport: McpTransport,
  params: SearchPagesParams,
): Promise<SearchPagesResult> {
  return transport.callTool<SearchPagesResult>("search_pages", {
    ...documentAddressArgs(params),
    questions: params.questions,
    top_k: params.topK,
    start_page: params.startPage,
    end_page: params.endPage,
  });
}
