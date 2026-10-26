import type { FolderItem } from "../api/types.js";
import type { McpTransport } from "../transport.js";
import type { NextSteps } from "./types.js";

export interface ListFoldersParams {
  /**
   * Use "root" for root-level folders only, a folder ID for subfolders, or omit for all folders
   */
  parentFolderId?: string;
}

export interface ListFoldersFolder extends FolderItem {
  /** The folder's library path; pass it back as `path` to scope into it. */
  path: string;
}

export interface ListFoldersResult {
  folders: ListFoldersFolder[];
  total: number;
  filter: {
    parent_folder_id?: string;
    scope: string;
  };
  next_steps: NextSteps;
}

/**
 * @deprecated Use {@link getFolderStructure} instead. The server still accepts
 * `list_folders` calls for backward compatibility, but the tool is hidden from
 * MCP `tools/list` and may be removed in a future release.
 */
export async function listFolders(
  transport: McpTransport,
  params?: ListFoldersParams,
): Promise<ListFoldersResult> {
  return transport.callTool<ListFoldersResult>("list_folders", {
    parent_folder_id: params?.parentFolderId,
  });
}
