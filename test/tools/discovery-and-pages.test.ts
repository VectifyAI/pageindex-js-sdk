import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageIndexTools } from "../../src/tools/index.js";
import type { McpTransport } from "../../src/transport.js";

const callTool = vi.fn();
const callToolWithPictures = vi.fn();
const tools = new PageIndexTools({
  callTool,
  callToolWithPictures,
} as unknown as McpTransport);

const picture = { page: 3, data: "AAAA", mimeType: "image/jpeg" };

beforeEach(() => {
  callTool.mockReset().mockResolvedValue({});
  callToolWithPictures
    .mockReset()
    .mockResolvedValue({ data: { doc_name: "Q3.pdf" }, pictures: [picture] });
});

describe("searchDocuments", () => {
  it("asks search_documents by questions", async () => {
    await tools.searchDocuments({
      questions: ["What was Q3 revenue?"],
      topK: 5,
      collection: "Filings",
      metadataFilter: { year: { $gte: 2024 } },
    });
    expect(callTool).toHaveBeenCalledWith("search_documents", {
      questions: ["What was Q3 revenue?"],
      top_k: 5,
      path: undefined,
      recursive: undefined,
      collection: "Filings",
      metadata_filter: { year: { $gte: 2024 } },
    });
  });

  it("still sends the deprecated keyword form", async () => {
    await tools.searchDocuments({ query: "revenue", folderId: "f1", limit: 3 });
    expect(callTool.mock.calls[0]?.[1]).toMatchObject({
      query: "revenue",
      folder_id: "f1",
      limit: 3,
    });
    expect(callTool.mock.calls[0]?.[1]).not.toHaveProperty("questions");
  });

  it("works detached from the tools object", async () => {
    const { searchDocuments } = tools;
    await searchDocuments({ questions: ["q"] });
    expect(callTool).toHaveBeenCalledWith(
      "search_documents",
      expect.objectContaining({ questions: ["q"] }),
    );
  });
});

describe("listing tools", () => {
  it("list_documents takes the metadata query in snake_case", async () => {
    await tools.listDocuments({
      metadataFilter: { region: "EU" },
      sort: { year: -1 },
      aggregates: { n: { $count: {} } },
      groupBy: ["year"],
      path: "Research",
    });
    expect(callTool).toHaveBeenCalledWith("list_documents", {
      metadata_filter: { region: "EU" },
      sort: { year: -1 },
      aggregates: { n: { $count: {} } },
      group_by: ["year"],
      path: "Research",
      recursive: undefined,
      limit: undefined,
      offset: undefined,
      collection: undefined,
    });
  });

  it("list_collections takes no arguments", async () => {
    await tools.listCollections();
    expect(callTool).toHaveBeenCalledWith("list_collections", {});
  });

  it("get_metadata_schema takes a folder path or a collection", async () => {
    await tools.getMetadataSchema({ collection: "Filings" });
    expect(callTool).toHaveBeenCalledWith("get_metadata_schema", {
      path: undefined,
      collection: "Filings",
    });
  });

  it("browse_documents no longer sends a sort or query", async () => {
    await tools.browseDocuments({ path: "Research" });
    const args = callTool.mock.calls[0]?.[1];
    expect(args).not.toHaveProperty("sort");
    expect(args).not.toHaveProperty("query");
  });
});

describe("page tools", () => {
  it("search_pages asks one document by questions", async () => {
    await tools.searchPages({
      path: "Research/Q3.pdf",
      questions: ["Where is the revenue table?"],
      topK: 3,
      startPage: 2,
      endPage: 9,
    });
    expect(callTool).toHaveBeenCalledWith("search_pages", {
      path: "Research/Q3.pdf",
      questions: ["Where is the revenue table?"],
      top_k: 3,
      start_page: 2,
      end_page: 9,
    });
  });

  it("view_pages returns the text with a picture per page", async () => {
    const result = await tools.viewPages({ path: "Q3.pdf", pages: "3" });
    expect(callToolWithPictures).toHaveBeenCalledWith("view_pages", {
      path: "Q3.pdf",
      pages: "3",
    });
    expect(result).toEqual({ doc_name: "Q3.pdf", pictures: [picture] });
  });

  it("zoom_page returns the region as one picture", async () => {
    const box = { x0: 0, y0: 0.3, x1: 1, y1: 0.6 };
    const result = await tools.zoomPage({ docName: "Q3.pdf", page: 3, box });
    expect(callToolWithPictures).toHaveBeenCalledWith("zoom_page", {
      doc_name: "Q3.pdf",
      folder_id: undefined,
      page: 3,
      box,
    });
    expect(result.picture).toEqual(picture);
  });

  it("zoom_page fails when the server sends no picture", async () => {
    callToolWithPictures.mockResolvedValue({ data: {}, pictures: [] });
    await expect(
      tools.zoomPage({
        path: "Q3.pdf",
        page: 1,
        box: { x0: 0, y0: 0, x1: 1, y1: 1 },
      }),
    ).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });

  it("get_page_content keeps the pictures of picture pages", async () => {
    const result = await tools.getPageContent({ path: "Q3.pdf", pages: "3" });
    expect(callToolWithPictures).toHaveBeenCalledWith(
      "get_page_content",
      expect.objectContaining({ path: "Q3.pdf", pages: "3" }),
    );
    expect(result.pictures).toEqual([picture]);
  });
});
