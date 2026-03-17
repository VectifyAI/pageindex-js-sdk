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
    if (!this.connected) await this.connect();
    this.resetIdleTimer();

    const r = (await this.client.callTool({
      name,
      arguments: args,
    })) as CallToolResult;

    const textContent = r.content.find((c) => c.type === "text");
    const text = textContent?.type === "text" ? textContent.text : undefined;

    if (!text) {
      throw new PageIndexError("Empty response from server", "INTERNAL_ERROR");
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      // Response is not JSON - treat it as a plain text error
      throw new PageIndexError(text, "INTERNAL_ERROR");
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

  async callToolForImage(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ImageContent> {
    if (!this.connected) await this.connect();
    this.resetIdleTimer();

    const r = (await this.client.callTool({
      name,
      arguments: args,
    })) as CallToolResult;

    if (r.isError) {
      const textContent = r.content.find((c) => c.type === "text");
      const text = textContent?.type === "text" ? textContent.text : undefined;
      if (text) {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(text) as Record<string, unknown>;
        } catch {
          throw new PageIndexError(text, "INTERNAL_ERROR");
        }
        const { error, errorCode, ...details } = data as {
          error: string;
          errorCode?: PageIndexErrorCode;
          [key: string]: unknown;
        };
        throw new PageIndexError(error, errorCode, details);
      }
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

  async close(): Promise<void> {
    this.clearIdleTimer();
    if (this.connected) {
      await this.client.close().catch(() => {});
      this.transport = null;
      this.connected = false;
    }
  }
}
