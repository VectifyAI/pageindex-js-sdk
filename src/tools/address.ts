/**
 * Identifies one document. Prefer `path`: the document's library path, copied
 * verbatim from a `browseDocuments()`, `searchDocuments()` or `getDocument()`
 * result (e.g. `"Research/2024/Q3 Report.pdf"`; a root document is just its
 * file name). A document in a collection has no path: name it by its
 * `collection` and file name (`docName`).
 */
export type DocumentAddress =
  | { path: string; docName?: never; folderId?: never; collection?: never }
  | {
      /** The collection's `name`, from `listCollections()`. */
      collection: string;
      /** The document's file name in that collection. */
      docName: string;
      path?: never;
      folderId?: never;
    }
  | {
      /** @deprecated Pass `path`, or `collection` with `docName`. */
      docName: string;
      /** @deprecated Pass `path` instead. */
      folderId?: string | null;
      path?: never;
      collection?: never;
    };

export function documentAddressArgs(
  address: DocumentAddress,
): Record<string, unknown> {
  if (address.path !== undefined) return { path: address.path };
  if (address.collection !== undefined) {
    return { collection: address.collection, doc_name: address.docName };
  }
  return { doc_name: address.docName, folder_id: address.folderId };
}
