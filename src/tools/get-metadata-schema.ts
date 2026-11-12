import type { McpTransport } from "../transport.js";
import type { NextSteps } from "./types.js";

export interface MetadataSchema {
  fields: Record<
    string,
    { type: "string" | "number" | "boolean"; description?: string }
  >;
}

/** Omit both for an overview of every schema; they are exclusive. */
export interface GetMetadataSchemaParams {
  /** A folder's library path; `""` is the library root. */
  path?: string;
  collection?: string;
}

export interface FolderMetadataSchemaResult {
  folder_id: string;
  path?: string;
  /** The top-level folder whose schema applies. */
  workspace_id: string;
  workspace_path?: string;
  /** True when the account-level schema applies because the workspace has none. */
  inherited?: boolean;
  schema: MetadataSchema | null;
  next_steps: NextSteps;
}

export interface CollectionMetadataSchemaResult {
  collection: string;
  schema: MetadataSchema | null;
  next_steps: NextSteps;
}

export interface MetadataSchemaOverviewResult {
  account_schema: MetadataSchema | null;
  /** Up to 20. */
  folders: Array<{
    folder_id: string;
    name: string;
    path?: string;
    schema: MetadataSchema;
  }>;
  truncated?: true;
  /** Up to 20. */
  collections: Array<{ name: string; schema: MetadataSchema }>;
  collections_truncated?: true;
  next_steps: NextSteps;
}

export type GetMetadataSchemaResult =
  | FolderMetadataSchemaResult
  | CollectionMetadataSchemaResult
  | MetadataSchemaOverviewResult;

export function getMetadataSchema(
  transport: McpTransport,
  params?: GetMetadataSchemaParams,
): Promise<GetMetadataSchemaResult> {
  return transport.callTool<GetMetadataSchemaResult>("get_metadata_schema", {
    path: params?.path,
    collection: params?.collection,
  });
}
