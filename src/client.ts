import { PageIndexApi } from "./api/client.js";
import { PageIndexTools } from "./tools/index.js";
import { McpTransport } from "./transport.js";

export interface PageIndexClientConfig {
  apiKey: string;
  apiUrl?: string;
  folderScope?: string;
  /** MCP connection idle timeout in ms. Set 0 to disable. Default: 60000 (60s) */
  idleTimeout?: number;
}

const DEFAULT_API_URL = "https://api.pageindex.ai";

export class PageIndexClient {
  private transport: McpTransport;
  private _api: PageIndexApi;
  private _tools: PageIndexTools | null = null;

  constructor(config: PageIndexClientConfig) {
    const apiUrl = (config.apiUrl || DEFAULT_API_URL).replace(/\/$/, "");

    this.transport = new McpTransport({
      apiUrl,
      apiKey: config.apiKey,
      folderScope: config.folderScope,
      idleTimeout: config.idleTimeout,
    });

    this._api = new PageIndexApi({
      apiUrl,
      apiKey: config.apiKey,
      folderScope: config.folderScope,
    });
  }

  get api(): PageIndexApi {
    return this._api;
  }

  get tools(): PageIndexTools {
    if (!this._tools) {
      this._tools = new PageIndexTools(this.transport);
    }
    return this._tools;
  }

  setFolderScope(scope: string | undefined): Promise<void> {
    return this.transport.setFolderScope(scope);
  }

  connect = () => this.transport.connect();
  isConnected = () => this.transport.isConnected();
  close = () => this.transport.close();

  async [Symbol.asyncDispose](): Promise<void> {
    await this.close();
  }
}
