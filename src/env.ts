import { PageIndexError } from "./errors.js";

/**
 * The environment variables an API key is read from, in order. Page Search's
 * and Page Extract's own SDKs read the last two; their keys work here once
 * their accounts have moved.
 */
const API_KEY_ENV = [
  "PAGEINDEX_API_KEY",
  "PAGEINDEX_SEARCH_API_KEY",
  "PAGEINDEX_EXTRACT_API_KEY",
] as const;

export type ApiKeyEnv = (typeof API_KEY_ENV)[number];

/**
 * The API key passed, else the first one the environment holds. `own` is read
 * right after `PAGEINDEX_API_KEY`, before the other product's key: one person's
 * two keys may belong to two accounts.
 */
export function resolveApiKey(
  apiKey: string | undefined,
  own?: ApiKeyEnv,
): string {
  if (apiKey) return apiKey;
  const env: Record<string, string | undefined> =
    typeof process !== "undefined" && process.env ? process.env : {};
  const names = [API_KEY_ENV[0], own, ...API_KEY_ENV.slice(1)];
  for (const name of names) {
    const value = name ? env[name] : undefined;
    if (value) return value;
  }
  throw new PageIndexError(
    "No API key: pass apiKey, or set the PAGEINDEX_API_KEY environment variable.",
    "UNAUTHORIZED",
  );
}
