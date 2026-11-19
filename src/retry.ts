import { sleep } from "./internal.js";

/**
 * When to send a request again, as the Python SDK does: its REST session
 * (`retry.py`) and its MCP bridge (`mcp_bridge.py`).
 */
export interface RetryPolicy {
  /** Retries after the first try. */
  retries: number;
  /** Statuses worth another try, for a request the policy may resend. */
  statuses: (status: number) => boolean;
  /** Whether a request with this method may be resent after `status`. */
  resend: (method: string, status: number) => boolean;
  /**
   * Whether a request with this method may be resent after the connection
   * failed once it may have reached the server. One that never connected
   * always may be.
   */
  resendAfterSent: (method: string) => boolean;
  /** Milliseconds before retry `attempt` (0-based). */
  delay: (attempt: number, response?: Response) => number;
}

const MAX_RETRY_AFTER = 60_000;
const IDEMPOTENT = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]);

/**
 * The REST API: 408, 409, 429 and 5xx, twice, after the server's Retry-After
 * (up to 60 s) or a doubling wait up to 8 s. A POST carries no idempotency
 * key, so it is resent only on a 429, or when it never reached the server.
 */
export const REST_RETRY: RetryPolicy = {
  retries: 2,
  statuses: (status) =>
    status === 408 || status === 409 || status === 429 || status >= 500,
  resend: (method, status) => IDEMPOTENT.has(method) || status === 429,
  resendAfterSent: (method) => IDEMPOTENT.has(method),
  delay: (attempt, response) =>
    retryAfter(response) ?? Math.min(8000, 1000 * 2 ** attempt) * jitter(),
};

/**
 * The MCP server: 429 and 5xx, three times, after 0, 2 and 4 s. Retry-After
 * is ignored: a long one is a quota, not a blip. A request cut off after it
 * was sent is never resent: the server may have acted on it.
 */
export const MCP_RETRY: RetryPolicy = {
  retries: 3,
  statuses: (status) => status === 429 || status >= 500,
  resend: () => true,
  resendAfterSent: () => false,
  delay: (attempt) => (attempt === 0 ? 0 : 1000 * 2 ** attempt),
};

/** `fetch`, sent again by `policy` after a retryable status or a failed connection. */
export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit = {},
  policy: RetryPolicy = REST_RETRY,
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(input, init);
    } catch (error) {
      // A request that may have reached the server is resent only if the
      // method allows it; one that never connected always may be.
      const again =
        !init.signal?.aborted &&
        attempt < policy.retries &&
        (policy.resendAfterSent(method) || neverConnected(error));
      if (!again) throw error;
      await sleep(policy.delay(attempt), init.signal ?? undefined);
      continue;
    }
    const again =
      attempt < policy.retries &&
      policy.statuses(response.status) &&
      policy.resend(method, response.status);
    if (!again) return response;
    await response.body?.cancel().catch(() => {});
    await sleep(policy.delay(attempt, response), init.signal ?? undefined);
  }
}

/** The server's Retry-After (retry-after-ms first) in ms, when it names 0 to 60 s. */
function retryAfter(response?: Response): number | undefined {
  if (!response) return undefined;
  for (const [header, ms] of [
    ["retry-after-ms", 1],
    ["retry-after", 1000],
  ] as const) {
    const value = Number.parseFloat(response.headers.get(header) ?? "");
    if (Number.isNaN(value)) continue;
    const wait = value * ms;
    return wait > 0 && wait <= MAX_RETRY_AFTER ? wait : undefined;
  }
  return undefined;
}

function jitter(): number {
  return 0.5 + Math.random() * 0.5;
}

const CONNECT_ERRORS = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
]);

/** A fetch failure before the request reached the server: nothing ran. */
function neverConnected(error: unknown): boolean {
  let cause: unknown = error;
  for (let depth = 0; cause && depth < 4; depth++) {
    const code = (cause as { code?: unknown }).code;
    if (typeof code === "string" && CONNECT_ERRORS.has(code)) return true;
    cause = (cause as { cause?: unknown }).cause;
  }
  return false;
}
