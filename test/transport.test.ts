import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it, vi } from "vitest";
import { McpTransport, parseJsonResult } from "../src/transport.js";

function transportAnswering(result: CallToolResult): McpTransport {
  const transport = new McpTransport({ apiUrl: "https://x", apiKey: "k" });
  Object.assign(transport, { invoke: vi.fn().mockResolvedValue(result) });
  return transport;
}

describe("parseJsonResult", () => {
  it("reads a schema rejection as INVALID_INPUT", () => {
    expect(() =>
      parseJsonResult({
        isError: true,
        content: [
          {
            type: "text",
            text: "Input validation error: Invalid arguments for tool browse_documents: sort: …",
          },
        ],
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("keeps other plain-text failures as INTERNAL_ERROR", () => {
    expect(() =>
      parseJsonResult({
        isError: true,
        content: [
          { type: "text", text: "Tool find_relevant_documents not found" },
        ],
      }),
    ).toThrow(expect.objectContaining({ code: "INTERNAL_ERROR" }));
  });

  it("surfaces the server's error code and details", () => {
    expect(() =>
      parseJsonResult({
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Collection not found",
              errorCode: "NOT_FOUND",
              collection: "X",
            }),
          },
        ],
      }),
    ).toThrow(
      expect.objectContaining({
        code: "NOT_FOUND",
        details: { collection: "X" },
      }),
    );
  });
});

describe("callToolWithPictures", () => {
  it("pairs each picture with the page its label names", async () => {
    const transport = transportAnswering({
      content: [
        { type: "text", text: JSON.stringify({ doc_name: "Q3.pdf" }) },
        { type: "text", text: "Page 2 of Research/Q3.pdf:" },
        { type: "image", data: "two", mimeType: "image/jpeg" },
        {
          type: "text",
          text: "Page 10 of Research/Q3.pdf, x0 0, y0 0.3, x1 1, y1 0.6:",
        },
        { type: "image", data: "ten", mimeType: "image/jpeg" },
      ],
    });
    const result = await transport.callToolWithPictures("view_pages", {});
    expect(result).toEqual({
      data: { doc_name: "Q3.pdf" },
      pictures: [
        { page: 2, data: "two", mimeType: "image/jpeg" },
        { page: 10, data: "ten", mimeType: "image/jpeg" },
      ],
    });
  });

  it("returns no pictures for a text-only answer", async () => {
    const transport = transportAnswering({
      content: [{ type: "text", text: JSON.stringify({ doc_name: "Q3.pdf" }) }],
    });
    const result = await transport.callToolWithPictures("get_page_content", {});
    expect(result.pictures).toEqual([]);
  });
});
