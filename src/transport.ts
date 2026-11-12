import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {
  CallToolResult,
  ImageContent,
} from "@modelcontextprotocol/sdk/types.js";
import pkg from "../package.json" assert { type: "json" };
import { PageIndexError, type PageIndexErrorCode } from "./errors.js";

export class McpTransport {
  private client = new Client(
    { name: pkg.name, version: pkg.version },
    { capabilities: {} },
  );
  private transport: StreamableHTTPClientTransport | null = null;
  private connected = false;
  private folderScope: string | undefined;
  private idleTimeout: number;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private config: {
      apiUrl: string;
      apiKey: string;
      folderScope?: string;
      idleTimeout?: number;
    },
  ) {
    this.folderScope = config.folderScope;
    this.idleTimeout = config.idleTimeout ?? 60_000;
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.idleTimeout > 0) {
      this.idleTimer = setTimeout(() => this.close(), this.idleTimeout);
    }
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  async setFolderScope(scope: string | undefined): Promise<void> {
    if (this.folderScope === scope) return;
    this.folderScope = scope;
    if (this.connected) {
      await this.close();
      await this.connect();
    }
  }

  isConnected = () => this.connected;

  async connect(): Promise<void> {
    if (this.connected) return;
    const url = new URL("/mcp", this.config.apiUrl);
    url.searchParams.set("folder", "1");
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "User-Agent": `pageindex-js-sdk/${pkg.version}`,
    };
    if (this.folderScope) {
      headers["X-Folder-Scope"] = this.folderScope;
    }
    this.transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers },
    });
    await this.client.connect(this.transport);
    this.connected = true;
  }

  async callTool<T = unknown>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    const r = await this.invoke(name, args);
    return parseJsonResult<T>(r);
  }

  /**
   * For tools that answer with a JSON text block followed by labelled
   * pictures (`"Page N of …:"` text, then an image block). Returns the JSON
   * and every picture with the page its label names.
   */
  async callToolWithPictures<T = unknown>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: T; pictures: PagePicture[] }> {
    const r = await this.invoke(name, args);
    return { data: parseJsonResult<T>(r), pictures: collectPictures(r) };
  }

  async callToolForImage(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ImageContent> {
    const r = await this.invoke(name, args);
    if (r.isError) {
      parseJsonResult(r);
      throw new PageIndexError("Image retrieval failed", "INTERNAL_ERROR");
    }

    const imageContent = r.content.find(
      (c): c is ImageContent => c.type === "image",
    );
    if (!imageContent) {
      throw new PageIndexError(
        "No image content in response",
        "INTERNAL_ERROR",
      );
    }

    return imageContent;
  }

  private async invoke(
    name: string,
    args: Record<string, unknown>,
  ): Promise<CallToolResult> {
    if (!this.connected) await this.connect();
    this.resetIdleTimer();
    return (await this.client.callTool({
      name,
      arguments: args,
    })) as CallToolResult;
  }

  async close(): Promise<void> {
    this.clearIdleTimer();
    if (this.connected) {
      await this.client.close().catch(() => {});
      this.transport = null;
      this.connected = false;
    }
  }
}

/** A rendered page (or region of one) returned beside a tool's JSON. */
export interface PagePicture {
  /** The page the picture shows, read from the label the server puts before it. */
  page: number;
  /** Base64-encoded image bytes. */
  data: string;
  mimeType: string;
}

// The MCP server checks arguments against the advertised schema before the
// tool runs and answers a mismatch in plain text with this prefix.
const SCHEMA_REJECTION_PREFIX = "Input validation error:";

/**
 * Reads the first text block as the tool's JSON payload and throws a
 * PageIndexError when the call failed.
 */
export function parseJsonResult<T>(r: CallToolResult): T {
  const textContent = r.content.find((c) => c.type === "text");
  const text = textContent?.type === "text" ? textContent.text : undefined;

  if (!text) {
    throw new PageIndexError("Empty response from server", "INTERNAL_ERROR");
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new PageIndexError(
      text,
      text.startsWith(SCHEMA_REJECTION_PREFIX)
        ? "INVALID_INPUT"
        : "INTERNAL_ERROR",
    );
  }

  if (r.isError) {
    const { error, errorCode, ...details } = data as {
      error: string;
      errorCode?: PageIndexErrorCode;
      [key: string]: unknown;
    };
    throw new PageIndexError(error, errorCode, details);
  }

  return data as T;
}

const PICTURE_LABEL = /^Page (\d+) of /;

function collectPictures(r: CallToolResult): PagePicture[] {
  const pictures: PagePicture[] = [];
  let page: number | undefined;
  for (const block of r.content) {
    if (block.type === "text") {
      const match = PICTURE_LABEL.exec(block.text);
      page = match ? Number(match[1]) : undefined;
    } else if (block.type === "image" && page !== undefined) {
      pictures.push({ page, data: block.data, mimeType: block.mimeType });
      page = undefined;
    }
  }
  return pictures;
}
