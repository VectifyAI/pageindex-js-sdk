import type { McpTransport } from "../transport.js";
import type { DocumentListItem, MetadataFilter, NextSteps } from "./types.js";

type FieldRef = `$${string}`;

export type MetadataAggregate =
  | { $count: Record<string, never> }
  | { $sum: 1 | FieldRef }
  | { $avg: FieldRef }
  | { $max: FieldRef }
  | { $min: FieldRef };

/** Lists documents by their metadata. Free; with no filter, every document. */
export interface ListDocumentsParams {
  metadataFilter?: MetadataFilter;
  /** Up to 5 fields, `1` ascending or `-1` descending. */
  sort?: Record<string, 1 | -1>;
  /** Up to 10 named aggregates, e.g. `{ total: { $count: {} } }`. */
  aggregates?: Record<string, MetadataAggregate>;
  /** Up to 5 fields to group the aggregates by; requires `aggregates`. */
  groupBy?: string[];
  /** Folder as a library path; `""` is the library root. Exclusive with `collection`. */
  path?: string;
  /** Include descendant folders. Server default: `true`. */
  recursive?: boolean;
  /** 0–50. Server default: 10, or 0 when `aggregates` is set. */
  limit?: number;
  offset?: number;
  /** List one collection, by name, instead of a folder. */
  collection?: string;
}

export interface ListDocumentsResult {
  /** Present unless `groupBy` was set. */
  documents?: DocumentListItem[];
  /** Present when `groupBy` was set: one row per group, aggregates included. */
  groups?: Array<Record<string, string | number | boolean | null>>;
  total: number;
  aggregates?: Record<string, number | string | null>;
  next_offset?: number;
  /** Set with `groupBy` when more groups exist than were returned. */
  truncated?: boolean;
  next_steps: NextSteps;
}

export function listDocuments(
  transport: McpTransport,
  params?: ListDocumentsParams,
): Promise<ListDocumentsResult> {
  return transport.callTool<ListDocumentsResult>("list_documents", {
    metadata_filter: params?.metadataFilter,
    sort: params?.sort,
    aggregates: params?.aggregates,
    group_by: params?.groupBy,
    path: params?.path,
    recursive: params?.recursive,
    limit: params?.limit,
    offset: params?.offset,
    collection: params?.collection,
  });
}
