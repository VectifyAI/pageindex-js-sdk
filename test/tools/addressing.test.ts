import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageIndexTools } from "../../src/tools/index.js";
import type { McpTransport } from "../../src/transport.js";

const callTool = vi.fn();
const callToolForImage = vi.fn();
const tools = new PageIndexTools({
  callTool,
  callToolForImage,
} as unknown as McpTransport);

beforeEach(() => {
  callTool.mockReset().mockResolvedValue({});
  callToolForImage
    .mockReset()
    .mockResolvedValue({ type: "image", data: "", mimeType: "image/png" });
});

function argsOf(mock: typeof callTool) {
  return mock.mock.calls[0]?.[1];
}

describe("document tools", () => {
  it("send only `path` when addressed by path", async () => {
    await tools.getDocument({
      path: "Research/Q3.pdf",
      waitForCompletion: true,
    });
    expect(callTool).toHaveBeenCalledWith("get_document", {
      path: "Research/Q3.pdf",
      wait_for_completion: true,
    });
  });

  it("send the legacy doc_name / folder_id pair when addressed by name", async () => {
    await tools.getDocument({ docName: "Q3.pdf", folderId: "root" });
    expect(argsOf(callTool)).toEqual({
      doc_name: "Q3.pdf",
      folder_id: "root",
      wait_for_completion: undefined,
    });
  });

  it("address get_document_structure by path", async () => {
    await tools.getDocumentStructure({ path: "Q3.pdf", part: 2 });
    expect(callTool).toHaveBeenCalledWith("get_document_structure", {
      path: "Q3.pdf",
      part: 2,
      wait_for_completion: undefined,
    });
  });

  it("address get_page_content by path", async () => {
    await tools.getPageContent({ path: "Research/Q3.pdf", pages: "1-3" });
    expect(callTool).toHaveBeenCalledWith("get_page_content", {
      path: "Research/Q3.pdf",
      pages: "1-3",
      wait_for_completion: undefined,
    });
  });

  it("forward the owning document's path to get_document_image", async () => {
    await tools.getDocumentImage({
      imagePath: "Q3.pdf/page/1",
      path: "Research/Q3.pdf",
    });
    expect(callToolForImage).toHaveBeenCalledWith("get_document_image", {
      image_path: "Q3.pdf/page/1",
      path: "Research/Q3.pdf",
    });
  });
});

describe("removeDocument", () => {
  it("sends only `paths` when addressed by path", async () => {
    await tools.removeDocument({ paths: ["Research/Q3.pdf", "draft.pdf"] });
    expect(callTool).toHaveBeenCalledWith("remove_document", {
      paths: ["Research/Q3.pdf", "draft.pdf"],
    });
  });

  it("sends the legacy doc_names / folder_id pair when addressed by name", async () => {
    await tools.removeDocument({ docNames: ["draft.pdf"], folderId: null });
    expect(callTool).toHaveBeenCalledWith("remove_document", {
      doc_names: ["draft.pdf"],
      folder_id: null,
    });
  });
});

describe("folder-scoped tools", () => {
  it("forward a folder path to browse_documents", async () => {
    await tools.browseDocuments({ path: "Research/2024" });
    expect(argsOf(callTool)).toMatchObject({
      path: "Research/2024",
      folder_id: undefined,
    });
  });

  it("forward the library root path to search_documents", async () => {
    await tools.searchDocuments({ query: "safety", path: "" });
    expect(argsOf(callTool)).toMatchObject({ query: "safety", path: "" });
  });

  it("forward a folder path to get_folder_structure", async () => {
    await tools.getFolderStructure({ path: "Shared with me" });
    expect(argsOf(callTool)).toMatchObject({ path: "Shared with me" });
  });
});
