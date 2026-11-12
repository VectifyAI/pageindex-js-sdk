/**
 * Flat per-document metadata, keyed by the fields the user's metadata schema
 * declares.
 */
export type DocumentMetadata = Record<string, string | number | boolean>;

export interface NextSteps {
  summary: string;
  options: string[];
  auto_retry?: string;
}

type MetadataValue = string | number | boolean;

/** One condition on a metadata field: a value to equal, or one operator. */
export type MetadataCondition =
  | MetadataValue
  | { $eq: MetadataValue }
  | { $ne: MetadataValue }
  | { $in: MetadataValue[] }
  | { $gt: number | string }
  | { $gte: number | string }
  | { $lt: number | string }
  | { $lte: number | string };

/**
 * A filter over the fields `getMetadataSchema()` declares, e.g.
 * `{ year: { $gte: 2024 }, $or: [{ region: "EU" }, { region: "US" }] }`.
 * Nests up to 5 levels.
 */
export type MetadataFilter = {
  $and?: MetadataFilter[];
  $or?: MetadataFilter[];
} & { [field: string]: MetadataCondition | MetadataFilter[] | undefined };

/** A document as the listing and keyword-search tools return it. */
export interface DocumentListItem {
  name: string;
  description: string;
  status: string;
  created_at: string;
  folder_id?: string;
  /**
   * The document's own library path (folders included, e.g.
   * `"Research/2024/Q3 Report.pdf"`); pass it back as `path` to address it.
   * Collection documents have none.
   */
  path?: string;
  /** The collection holding the document; such documents are read by `docName`. */
  collection?: string;
  metadata?: DocumentMetadata;
}
