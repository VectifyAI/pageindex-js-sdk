import { vi } from "vitest";

export interface SentRequest {
  method: string;
  /** The path and query, without the API URL. */
  path: string;
  json?: Record<string, unknown>;
  form?: Record<string, string>;
  file?: { name: string; size: number };
}

export type Answer = unknown | [status: number, body: unknown];

/**
 * Stubs the global fetch: each request is recorded and answered by `answer`,
 * with a JSON body and status 200 unless it returns `[status, body]`.
 */
export function serve(
  answer: (request: SentRequest) => Answer | Promise<Answer>,
): SentRequest[] {
  const sent: SentRequest[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const request: SentRequest = {
        method: init?.method ?? "GET",
        path: url.pathname + url.search,
      };
      const body = init?.body;
      if (typeof body === "string") {
        request.json = JSON.parse(body);
      } else if (body instanceof URLSearchParams) {
        request.form = Object.fromEntries(body);
      } else if (body instanceof FormData) {
        request.form = {};
        for (const [key, value] of body) {
          if (typeof value === "string") request.form[key] = value;
          else request.file = { name: value.name, size: value.size };
        }
      }
      sent.push(request);
      const answered = await answer(request);
      const [status, data] =
        Array.isArray(answered) &&
        answered.length === 2 &&
        typeof answered[0] === "number"
          ? answered
          : [200, answered];
      return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return sent;
}
