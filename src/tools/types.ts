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
