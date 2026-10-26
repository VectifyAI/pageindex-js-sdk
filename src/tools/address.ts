/**
 * Identifies one document. Prefer `path`: the document's library path, copied
 * verbatim from a `browseDocuments()`, `searchDocuments()` or `getDocument()`
 * result (e.g. `"Research/2024/Q3 Report.pdf"`; a root document is just its
 * file name).
 */
export type DocumentAddress =
  | { path: string; docName?: never; folderId?: never }
  | {
      /** @deprecated Pass `path` instead. */
      docName: string;
      /** @deprecated Pass `path` instead. */
      folderId?: string | null;
      path?: never;
    };

export function documentAddressArgs(
  address: DocumentAddress,
): Record<string, unknown> {
  return address.path !== undefined
    ? { path: address.path }
    : { doc_name: address.docName, folder_id: address.folderId };
}
