import type { McpTransport } from "../transport.js";
import type { NextSteps } from "./types.js";

export interface CollectionItem {
  name: string;
  description: string | null;
  file_count: number;
}

export interface ListCollectionsResult {
  /** Sorted by name; empty on a folder-scoped client. */
  collections: CollectionItem[];
  next_steps: NextSteps;
}

export function listCollections(
  transport: McpTransport,
): Promise<ListCollectionsResult> {
  return transport.callTool<ListCollectionsResult>("list_collections", {});
}
