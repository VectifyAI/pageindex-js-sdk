import type { FolderItem } from "../api/types.js";
import type { McpTransport } from "../transport.js";
import type { NextSteps } from "./types.js";

export interface ListFoldersParams {
  /**
   * Use "root" for root-level folders only, a folder ID for subfolders, or omit for all folders
   */
  parentFolderId?: string;
}

export interface ListFoldersResult {
  folders: FolderItem[];
  total: number;
  filter: {
    parent_folder_id?: string;
    scope: string;
  };
  next_steps: NextSteps;
}

export async function listFolders(
  transport: McpTransport,
  params?: ListFoldersParams,
): Promise<ListFoldersResult> {
  return transport.callTool<ListFoldersResult>("list_folders", {
    parent_folder_id: params?.parentFolderId,
  });
}
