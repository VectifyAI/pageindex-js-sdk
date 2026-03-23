export interface PageIndexConfig {
  apiUrl: string;
  apiKey: string;
}

export function getConfigFromRequest(req: Request): PageIndexConfig {
  return {
    apiUrl:
      req.headers.get("x-pageindex-api-url") ||
      process.env.PAGEINDEX_API_URL ||
      "",
    apiKey:
      req.headers.get("x-pageindex-api-key") ||
      process.env.PAGEINDEX_API_KEY ||
      "",
  };
}

export function validateConfig(config: PageIndexConfig): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!config.apiUrl) missing.push("PageIndex API URL");
  if (!config.apiKey) missing.push("PageIndex API Key");
  return { valid: missing.length === 0, missing };
}
