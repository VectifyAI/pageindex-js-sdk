import { PageIndexClient } from "./client.js";
import { type ApiKeyEnv, resolveApiKey } from "./env.js";
import { PageIndexError } from "./errors.js";

/**
 * How a Page Search, Page Extract or Page Classify client reaches PageIndex:
 * with an API key, or through a `PageIndexClient` you already have.
 */
export type ProductClientConfig =
  | {
      /**
       * Defaults to the `PAGEINDEX_API_KEY` environment variable, then to the
       * product's own key variable, then to the other product's.
       */
      apiKey?: string;
      apiUrl?: string;
      client?: undefined;
    }
  | { client: PageIndexClient; apiKey?: undefined; apiUrl?: undefined };

export function productClient(
  config: ProductClientConfig,
  name: string,
  own?: ApiKeyEnv,
): PageIndexClient {
  if (config.client === undefined) {
    return new PageIndexClient({
      apiKey: resolveApiKey(config.apiKey, own),
      apiUrl: config.apiUrl,
    });
  }
  if (config.apiKey !== undefined || config.apiUrl !== undefined) {
    throw new PageIndexError(
      `${name} takes apiKey and apiUrl, or client, not both.`,
      "INVALID_INPUT",
    );
  }
  return config.client;
}
