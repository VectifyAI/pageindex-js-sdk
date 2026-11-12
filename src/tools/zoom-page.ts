import { PageIndexError } from "../errors.js";
import type { McpTransport, PagePicture } from "../transport.js";
import { type DocumentAddress, documentAddressArgs } from "./address.js";
import type { NextSteps } from "./types.js";

/** A region of a page, as fractions of its width and height (0–1, top-left origin). */
export interface PageBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type ZoomPageParams = DocumentAddress & {
  page: number;
  box: PageBox;
};

export interface ZoomPageResult {
  doc_name: string;
  path?: string;
  page: number;
  box: PageBox;
  /** The region, rendered sharper than the whole page. */
  picture: PagePicture;
  next_steps: NextSteps;
}

export async function zoomPage(
  transport: McpTransport,
  params: ZoomPageParams,
): Promise<ZoomPageResult> {
  const { data, pictures } = await transport.callToolWithPictures<
    Omit<ZoomPageResult, "picture">
  >("zoom_page", {
    ...documentAddressArgs(params),
    page: params.page,
    box: params.box,
  });
  const picture = pictures[0];
  if (!picture) {
    throw new PageIndexError("No image content in response", "INTERNAL_ERROR");
  }
  return { ...data, picture };
}
