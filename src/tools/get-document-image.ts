import type { McpTransport } from "../transport.js";

export interface GetDocumentImageParams {
  /**
   * Image path from get_page_content() response, format: <docName>/<imagePath>
   */
  imagePath: string;
}

export interface GetDocumentImageResult {
  data: string;
  mimeType: string;
}

export async function getDocumentImage(
  transport: McpTransport,
  params: GetDocumentImageParams,
): Promise<GetDocumentImageResult> {
  const imageContent = await transport.callToolForImage("get_document_image", {
    image_path: params.imagePath,
  });
  return {
    data: imageContent.data,
    mimeType: imageContent.mimeType,
  };
}
