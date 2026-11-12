import type { McpTransport, PagePicture } from "../transport.js";
import { type DocumentAddress, documentAddressArgs } from "./address.js";
import type { GetPageContentResult } from "./get-page-content.js";

export type ViewPagesParams = DocumentAddress & {
  /** At most 5 distinct pages: `"5"`, `"3,7"`, `"2-4"`. */
  pages: string;
};

/** The pages' text, as `getPageContent()` returns it, plus a picture of each. */
export type ViewPagesResult = Omit<GetPageContentResult, "picture_pages">;

export async function viewPages(
  transport: McpTransport,
  params: ViewPagesParams,
): Promise<ViewPagesResult> {
  const { data, pictures } = await transport.callToolWithPictures<
    Omit<ViewPagesResult, "pictures">
  >("view_pages", {
    ...documentAddressArgs(params),
    pages: params.pages,
  });
  return { ...data, pictures };
}
