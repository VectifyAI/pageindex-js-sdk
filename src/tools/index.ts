import type { McpTransport } from "../transport.js";
import {
  type BrowseDocumentsParams,
  type BrowseDocumentsResult,
  browseDocuments,
} from "./browse-documents.js";
import {
  type GetDocumentImageParams,
  type GetDocumentImageResult,
  getDocumentImage,
} from "./get-document-image.js";
import {
  type GetDocumentStructureParams,
  type GetDocumentStructureResult,
  getDocumentStructure,
} from "./get-document-structure.js";
import {
  type GetDocumentParams,
  type GetDocumentResult,
  getDocument,
} from "./get-document.js";
import {
  type GetFolderStructureParams,
  type GetFolderStructureResult,
  getFolderStructure,
} from "./get-folder-structure.js";
import {
  type GetMetadataSchemaParams,
  type GetMetadataSchemaResult,
  getMetadataSchema,
} from "./get-metadata-schema.js";
import {
  type GetPageContentParams,
  type GetPageContentResult,
  getPageContent,
} from "./get-page-content.js";
import {
  type ListCollectionsResult,
  listCollections,
} from "./list-collections.js";
import {
  type ListDocumentsParams,
  type ListDocumentsResult,
  listDocuments,
} from "./list-documents.js";
import {
  type ListFoldersParams,
  type ListFoldersResult,
  listFolders,
} from "./list-folders.js";
import {
  type RecentDocumentsParams,
  type RecentDocumentsResult,
  recentDocuments,
} from "./recent-documents.js";
import {
  type RemoveDocumentParams,
  type RemoveDocumentResult,
  removeDocument,
} from "./remove-document.js";
import {
  type KeywordSearchDocumentsParams,
  type KeywordSearchDocumentsResult,
  type SearchDocumentsParams,
  type SearchDocumentsResult,
  searchDocuments,
} from "./search-documents.js";
import {
  type SearchPagesParams,
  type SearchPagesResult,
  searchPages,
} from "./search-pages.js";
import {
  type ViewPagesParams,
  type ViewPagesResult,
  viewPages,
} from "./view-pages.js";
import {
  type ZoomPageParams,
  type ZoomPageResult,
  zoomPage,
} from "./zoom-page.js";

export type { PagePicture } from "../transport.js";
export type { DocumentAddress } from "./address.js";
export type {
  DocumentListItem,
  DocumentMetadata,
  MetadataCondition,
  MetadataFilter,
  NextSteps,
} from "./types.js";
export type {
  BrowseDocumentItem,
  BrowseDocumentsParams,
  BrowseDocumentsResult,
  BrowseFolderItem,
} from "./browse-documents.js";
export type { GetDocumentParams, GetDocumentResult } from "./get-document.js";
export type {
  GetDocumentImageParams,
  GetDocumentImageResult,
} from "./get-document-image.js";
export type {
  GetDocumentStructureParams,
  GetDocumentStructureResult,
} from "./get-document-structure.js";
export type {
  FolderStructureItem,
  FolderStructureRoot,
  GetFolderStructureParams,
  GetFolderStructureResult,
} from "./get-folder-structure.js";
export type {
  CollectionMetadataSchemaResult,
  FolderMetadataSchemaResult,
  GetMetadataSchemaParams,
  GetMetadataSchemaResult,
  MetadataSchema,
  MetadataSchemaOverviewResult,
} from "./get-metadata-schema.js";
export type {
  GetPageContentParams,
  GetPageContentResult,
  PageContentItem,
} from "./get-page-content.js";
export type {
  CollectionItem,
  ListCollectionsResult,
} from "./list-collections.js";
export type {
  ListDocumentsParams,
  ListDocumentsResult,
  MetadataAggregate,
} from "./list-documents.js";
export type {
  ListFoldersFolder,
  ListFoldersParams,
  ListFoldersResult,
} from "./list-folders.js";
export type {
  RecentDocumentItem,
  RecentDocumentsParams,
  RecentDocumentsResult,
} from "./recent-documents.js";
export type {
  RemoveDocumentParams,
  RemoveDocumentResult,
  RemoveDocumentResultItem,
} from "./remove-document.js";
export type {
  FoundDocument,
  KeywordSearchDocumentsParams,
  KeywordSearchDocumentsResult,
  SearchDocumentResultItem,
  SearchDocumentsParams,
  SearchDocumentsResult,
} from "./search-documents.js";
export type {
  FoundPage,
  SearchPagesParams,
  SearchPagesResult,
} from "./search-pages.js";
export type { ViewPagesParams, ViewPagesResult } from "./view-pages.js";
export type { PageBox, ZoomPageParams, ZoomPageResult } from "./zoom-page.js";

interface SearchDocumentsMethod {
  (params: SearchDocumentsParams): Promise<SearchDocumentsResult>;
  /** @deprecated Keyword search; pass `questions` instead. */
  (params: KeywordSearchDocumentsParams): Promise<KeywordSearchDocumentsResult>;
}

/**
 * Typed wrappers for the PageIndex MCP tools.
 *
 * Finding documents: list them for free by folder (`browseDocuments`), by
 * metadata (`listDocuments`) or by collection (`listCollections`); ask
 * `searchDocuments({ questions })`, which is priced, when a listing cannot
 * pick them out. Inside a document: `searchPages` (priced) finds the pages
 * that answer, `getPageContent` reads them, `viewPages` and `zoomPage` show
 * them as pictures.
 */
export class PageIndexTools {
  constructor(private transport: McpTransport) {}

  browseDocuments = (
    params?: BrowseDocumentsParams,
  ): Promise<BrowseDocumentsResult> => browseDocuments(this.transport, params);

  listDocuments = (
    params?: ListDocumentsParams,
  ): Promise<ListDocumentsResult> => listDocuments(this.transport, params);

  listCollections = (): Promise<ListCollectionsResult> =>
    listCollections(this.transport);

  getMetadataSchema = (
    params?: GetMetadataSchemaParams,
  ): Promise<GetMetadataSchemaResult> =>
    getMetadataSchema(this.transport, params);

  getFolderStructure = (
    params?: GetFolderStructureParams,
  ): Promise<GetFolderStructureResult> =>
    getFolderStructure(this.transport, params);

  /**
   * Finds the documents likely to answer each question. Priced. The keyword
   * form (`query`) is deprecated.
   */
  searchDocuments: SearchDocumentsMethod = ((
    params: SearchDocumentsParams | KeywordSearchDocumentsParams,
  ) => searchDocuments(this.transport, params)) as SearchDocumentsMethod;

  getDocument = (params: GetDocumentParams): Promise<GetDocumentResult> =>
    getDocument(this.transport, params);

  getDocumentStructure = (
    params: GetDocumentStructureParams,
  ): Promise<GetDocumentStructureResult> =>
    getDocumentStructure(this.transport, params);

  searchPages = (params: SearchPagesParams): Promise<SearchPagesResult> =>
    searchPages(this.transport, params);

  getPageContent = (
    params: GetPageContentParams,
  ): Promise<GetPageContentResult> => getPageContent(this.transport, params);

  viewPages = (params: ViewPagesParams): Promise<ViewPagesResult> =>
    viewPages(this.transport, params);

  zoomPage = (params: ZoomPageParams): Promise<ZoomPageResult> =>
    zoomPage(this.transport, params);

  getDocumentImage = (
    params: GetDocumentImageParams,
  ): Promise<GetDocumentImageResult> =>
    getDocumentImage(this.transport, params);

  removeDocument = (
    params: RemoveDocumentParams,
  ): Promise<RemoveDocumentResult> => removeDocument(this.transport, params);

  /**
   * @deprecated Use {@link browseDocuments} instead. The server still accepts
   * this call for backward compatibility but no longer advertises the tool.
   */
  recentDocuments = (
    params?: RecentDocumentsParams,
  ): Promise<RecentDocumentsResult> => recentDocuments(this.transport, params);

  /**
   * @deprecated Use {@link getFolderStructure} instead. The server still
   * accepts this call for backward compatibility but no longer advertises the
   * tool.
   */
  listFolders = (params?: ListFoldersParams): Promise<ListFoldersResult> =>
    listFolders(this.transport, params);
}
