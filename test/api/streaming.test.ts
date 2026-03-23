import { describe, expect, it, vi } from "vitest";
import { PageIndexApi } from "../../src/api/client.js";
import { PageIndexError } from "../../src/errors.js";
import type { ChatCompletionChunk } from "../../src/api/types.js";

function makeSSEStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload = lines.join("\n") + "\n";
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

function makeChunkedSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function mockFetch(status: number, body: ReadableStream | string) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    body: typeof body === "string" ? null : body,
    text: () => Promise.resolve(typeof body === "string" ? body : ""),
    json: () =>
      Promise.resolve(typeof body === "string" ? JSON.parse(body) : {}),
  } as unknown as Response);
}

function createApi(fetchFn: typeof globalThis.fetch) {
  vi.stubGlobal("fetch", fetchFn);
  return new PageIndexApi({
    apiUrl: "https://api.test.com",
    apiKey: "test-key",
  });
}

describe("chatCompletions streaming", () => {
  it("streams basic text chunks", async () => {
    const chunk1 = JSON.stringify({
      choices: [{ index: 0, delta: { content: "Hello" }, finish_reason: null }],
    });
    const chunk2 = JSON.stringify({
      choices: [
        { index: 0, delta: { content: " world" }, finish_reason: null },
      ],
    });

    const stream = makeSSEStream([
      `data: ${chunk1}`,
      "",
      `data: ${chunk2}`,
      "",
      "data: [DONE]",
    ]);
    const api = createApi(mockFetch(200, stream));

    const result = await api.chatCompletions({
      messages: [{ role: "user", content: "hi" }],
      stream: true,
    });

    const chunks: ChatCompletionChunk[] = [];
    for await (const chunk of result) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.choices[0]?.delta.content).toBe("Hello");
    expect(chunks[1]?.choices[0]?.delta.content).toBe(" world");
  });

  it("terminates on [DONE]", async () => {
    const chunk1 = JSON.stringify({
      choices: [{ index: 0, delta: { content: "A" }, finish_reason: null }],
    });
    const chunk2 = JSON.stringify({
      choices: [{ index: 0, delta: { content: "B" }, finish_reason: null }],
    });

    const stream = makeSSEStream([
      `data: ${chunk1}`,
      "data: [DONE]",
      `data: ${chunk2}`,
    ]);
    const api = createApi(mockFetch(200, stream));

    const result = await api.chatCompletions({
      messages: [{ role: "user", content: "hi" }],
      stream: true,
    });

    const chunks: ChatCompletionChunk[] = [];
    for await (const chunk of result) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.choices[0]?.delta.content).toBe("A");
  });

  it("parses chunks with block_metadata", async () => {
    const toolChunk = JSON.stringify({
      choices: [{ index: 0, delta: {}, finish_reason: null }],
      block_metadata: { type: "mcp_tool_use_start", tool_name: "search" },
    });
    const textChunk = JSON.stringify({
      choices: [
        { index: 0, delta: { content: "Found it" }, finish_reason: null },
      ],
    });

    const stream = makeSSEStream([
      `data: ${toolChunk}`,
      "",
      `data: ${textChunk}`,
      "",
      "data: [DONE]",
    ]);
    const api = createApi(mockFetch(200, stream));

    const result = await api.chatCompletions({
      messages: [{ role: "user", content: "search" }],
      stream: true,
      stream_metadata: true,
    });

    const chunks: ChatCompletionChunk[] = [];
    for await (const chunk of result) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.block_metadata?.type).toBe("mcp_tool_use_start");
    expect(chunks[0]?.block_metadata?.tool_name).toBe("search");
    expect(chunks[1]?.choices[0]?.delta.content).toBe("Found it");
  });

  it("handles data split across chunk boundaries", async () => {
    const json = JSON.stringify({
      choices: [
        { index: 0, delta: { content: "split" }, finish_reason: null },
      ],
    });
    const fullLine = `data: ${json}\n\ndata: [DONE]\n`;
    const mid = Math.floor(fullLine.length / 2);

    const stream = makeChunkedSSEStream([
      fullLine.slice(0, mid),
      fullLine.slice(mid),
    ]);
    const api = createApi(mockFetch(200, stream));

    const result = await api.chatCompletions({
      messages: [{ role: "user", content: "hi" }],
      stream: true,
    });

    const chunks: ChatCompletionChunk[] = [];
    for await (const chunk of result) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.choices[0]?.delta.content).toBe("split");
  });

  it("throws PageIndexError on non-200 response", async () => {
    const errorBody = JSON.stringify({ error: "Unauthorized" });
    const api = createApi(mockFetch(401, errorBody));

    await expect(
      api.chatCompletions({
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      }),
    ).rejects.toThrow(PageIndexError);

    try {
      await api.chatCompletions({
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      });
    } catch (e) {
      expect(e).toBeInstanceOf(PageIndexError);
      expect((e as PageIndexError).code).toBe("UNAUTHORIZED");
    }
  });

  it("skips empty lines and non-data lines", async () => {
    const chunk = JSON.stringify({
      choices: [{ index: 0, delta: { content: "ok" }, finish_reason: null }],
    });

    const stream = makeSSEStream([
      "",
      ": comment line",
      "event: message",
      `data: ${chunk}`,
      "",
      "data: [DONE]",
    ]);
    const api = createApi(mockFetch(200, stream));

    const result = await api.chatCompletions({
      messages: [{ role: "user", content: "hi" }],
      stream: true,
    });

    const chunks: ChatCompletionChunk[] = [];
    for await (const chunk of result) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.choices[0]?.delta.content).toBe("ok");
  });

  it("non-streaming still returns ChatCompletionsResponse", async () => {
    const responseBody = JSON.stringify({
      id: "chatcmpl-123",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Hi" },
          finish_reason: "end_turn",
        },
      ],
    });

    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(JSON.parse(responseBody)),
    } as unknown as Response);

    const api = createApi(fetchFn);
    const result = await api.chatCompletions({
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.id).toBe("chatcmpl-123");
    expect(result.choices[0]?.message.content).toBe("Hi");
  });
});
