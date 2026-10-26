import type { McpTransport } from "../transport.js";
import {
  type BrowseDocumentsParams,
  type BrowseDocumentsResult,
  browseDocuments,
} from "./browse-documents.js";
import {
  type FindRelevantDocumentsParams,
  type FindRelevantDocumentsResult,
  findRelevantDocuments,
} from "./find-relevant-documents.js";
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
  type GetPageContentParams,
  type GetPageContentResult,
  getPageContent,
} from "./get-page-content.js";
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
  type SearchDocumentsParams,
  type SearchDocumentsResult,
  searchDocuments,
} from "./search-documents.js";

export type { DocumentAddress } from "./address.js";
export type { NextSteps } from "./types.js";
export type {
  BrowseDocumentItem,
  BrowseDocumentsParams,
  BrowseDocumentsResult,
  BrowseFolderItem,
  BrowseSortMode,
} from "./browse-documents.js";
export type {
  FindRelevantDocumentsParams,
  FindRelevantDocumentsResult,
  SearchDocumentItem,
} from "./find-relevant-documents.js";
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
  GetPageContentParams,
  GetPageContentResult,
  PageContentItem,
} from "./get-page-content.js";
export type { ListFoldersParams, ListFoldersResult } from "./list-folders.js";
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
  SearchDocumentResultItem,
  SearchDocumentsParams,
  SearchDocumentsResult,
} from "./search-documents.js";

export class PageIndexTools {
  constructor(private transport: McpTransport) {}

  browseDocuments = (
    params?: BrowseDocumentsParams,
  ): Promise<BrowseDocumentsResult> => browseDocuments(this.transport, params);

  getFolderStructure = (
    params?: GetFolderStructureParams,
  ): Promise<GetFolderStructureResult> =>
    getFolderStructure(this.transport, params);

  searchDocuments = (
    params: SearchDocumentsParams,
  ): Promise<SearchDocumentsResult> => searchDocuments(this.transport, params);

  getDocument = (params: GetDocumentParams): Promise<GetDocumentResult> =>
    getDocument(this.transport, params);

  getDocumentImage = (
    params: GetDocumentImageParams,
  ): Promise<GetDocumentImageResult> =>
    getDocumentImage(this.transport, params);

  getDocumentStructure = (
    params: GetDocumentStructureParams,
  ): Promise<GetDocumentStructureResult> =>
    getDocumentStructure(this.transport, params);

  getPageContent = (
    params: GetPageContentParams,
  ): Promise<GetPageContentResult> => getPageContent(this.transport, params);

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
   * @deprecated Use {@link browseDocuments} with `sort: "relevance"` or
   * {@link searchDocuments}. The server still accepts this call for backward
   * compatibility but no longer advertises the tool.
   */
  findRelevantDocuments = (
    params?: FindRelevantDocumentsParams,
  ): Promise<FindRelevantDocumentsResult> =>
    findRelevantDocuments(this.transport, params);

  /**
   * @deprecated Use {@link getFolderStructure} instead. The server still
   * accepts this call for backward compatibility but no longer advertises the
   * tool.
   */
  listFolders = (params?: ListFoldersParams): Promise<ListFoldersResult> =>
    listFolders(this.transport, params);
}
