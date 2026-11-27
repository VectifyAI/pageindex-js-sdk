export { PageIndexClient, type PageIndexClientConfig } from "./client.js";
export { PageIndexError, type PageIndexErrorCode } from "./errors.js";
export { PageIndexTools } from "./tools/index.js";
export type * from "./tools/index.js";
export { PageIndexApi, type PageIndexApiConfig } from "./api/client.js";
export type * from "./api/types.js";
export { PageSearchClient } from "./page-search.js";
export type {
  PageSearchDocument,
  PageSearchDocumentsOptions,
  PageSearchOptions,
  PageSearchResult,
  PageSearchUploadOptions,
  SearchAcrossDocumentsOptions,
  SearchOneDocumentOptions,
} from "./page-search.js";
export { PAGE_EXTRACT_COLLECTION, PageExtractClient } from "./page-extract.js";
export type {
  JsonSchema,
  PageExtractOptions,
  WaitExtractOptions,
} from "./page-extract.js";
export {
  PAGE_CLASSIFY_COLLECTION,
  PageClassifyClient,
} from "./page-classify.js";
export type {
  ClassifyClasses,
  PageClassifyOptions,
  WaitClassifyOptions,
} from "./page-classify.js";
export type { ProductClientConfig } from "./product-client.js";
export type { FileInput } from "./internal.js";
