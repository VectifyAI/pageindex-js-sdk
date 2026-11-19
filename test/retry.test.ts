import { afterEach, describe, expect, it, vi } from "vitest";
import { sleep } from "../src/internal.js";
import { MCP_RETRY, fetchWithRetry } from "../src/retry.js";

vi.mock("../src/internal.js", async (original) => ({
  ...(await original<typeof import("../src/internal.js")>()),
  sleep: vi.fn(async () => {}),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(sleep).mockClear();
});

type Reply = number | [number, Record<string, string>] | Error;

/** Answers each fetch with the next reply: a status, a status and headers, or a thrown error. */
function replies(...answers: Reply[]) {
  const sent: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      sent.push(init?.method ?? "GET");
      const answer = answers.shift() ?? 200;
      if (answer instanceof Error) throw answer;
      const [status, headers] = Array.isArray(answer) ? answer : [answer, {}];
      return new Response("{}", { status, headers });
    }),
  );
  return sent;
}

function connectFailure(code: string) {
  return new TypeError("fetch failed", {
    cause: Object.assign(new Error(code), { code }),
  });
}

describe("fetchWithRetry, REST", () => {
  it("resends a GET after 408, 409, 429 and 5xx, twice at most", async () => {
    let sent = replies(503, 409, 200);
    expect((await fetchWithRetry("https://api.test/x")).status).toBe(200);
    expect(sent).toHaveLength(3);

    sent = replies(500, 502, 504);
    expect((await fetchWithRetry("https://api.test/x")).status).toBe(504);
    expect(sent).toHaveLength(3);

    // Not a status worth another try.
    sent = replies(402);
    expect((await fetchWithRetry("https://api.test/x")).status).toBe(402);
    expect(sent).toHaveLength(1);
  });

  it("resends a POST only on a 429, or when it never connected", async () => {
    let sent = replies(503);
    const post = { method: "POST", body: "{}" };
    expect((await fetchWithRetry("https://api.test/x", post)).status).toBe(503);
    expect(sent).toHaveLength(1);

    sent = replies(429, 200);
    expect((await fetchWithRetry("https://api.test/x", post)).status).toBe(200);
    expect(sent).toHaveLength(2);

    sent = replies(connectFailure("ECONNREFUSED"), 200);
    expect((await fetchWithRetry("https://api.test/x", post)).status).toBe(200);
    expect(sent).toHaveLength(2);

    // Cut off after it was sent: the server may have acted on it.
    sent = replies(connectFailure("ECONNRESET"), 200);
    await expect(fetchWithRetry("https://api.test/x", post)).rejects.toThrow(
      "fetch failed",
    );
    expect(sent).toHaveLength(1);

    // A GET may be resent either way.
    sent = replies(connectFailure("ECONNRESET"), 200);
    expect((await fetchWithRetry("https://api.test/x")).status).toBe(200);
  });

  it("waits the server's Retry-After, up to 60 s, else a doubling wait", async () => {
    replies(
      [429, { "retry-after": "3" }],
      [503, { "retry-after-ms": "250" }],
      200,
    );
    await fetchWithRetry("https://api.test/x");
    expect(vi.mocked(sleep).mock.calls.map((c) => c[0])).toEqual([3000, 250]);

    vi.mocked(sleep).mockClear();
    replies([429, { "retry-after": "120" }], 503, 200);
    await fetchWithRetry("https://api.test/x");
    const [first, second] = vi.mocked(sleep).mock.calls.map((c) => c[0]);
    expect(first).toBeGreaterThanOrEqual(500);
    expect(first).toBeLessThanOrEqual(1000);
    expect(second).toBeGreaterThanOrEqual(1000);
    expect(second).toBeLessThanOrEqual(2000);
  });

  it("does not resend an aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    const sent = replies(new DOMException("aborted", "AbortError"));
    await expect(
      fetchWithRetry("https://api.test/x", { signal: controller.signal }),
    ).rejects.toThrow("aborted");
    expect(sent).toHaveLength(1);
  });
});

describe("fetchWithRetry, MCP", () => {
  it("resends any request after 429 and 5xx, three times, after 0, 2 and 4 s", async () => {
    const sent = replies([429, { "retry-after": "30" }], 500, 502, 200);
    const post = { method: "POST", body: "{}" };
    expect(
      (await fetchWithRetry("https://api.test/mcp", post, MCP_RETRY)).status,
    ).toBe(200);
    expect(sent).toHaveLength(4);
    expect(vi.mocked(sleep).mock.calls.map((c) => c[0])).toEqual([
      0, 2000, 4000,
    ]);
  });

  it("does not resend a request cut off after it was sent", async () => {
    const sent = replies(connectFailure("ECONNRESET"), 200);
    await expect(
      fetchWithRetry("https://api.test/mcp", { method: "POST" }, MCP_RETRY),
    ).rejects.toThrow("fetch failed");
    expect(sent).toHaveLength(1);
  });
});
