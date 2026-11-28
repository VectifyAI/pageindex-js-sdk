import type {
  DocumentFilter,
  DocumentTags,
  MatchedDocument,
  SearchDocumentsResponse,
  SearchPagesResponse,
  SearchedPage,
  SubmitDocumentResponse,
} from "./api/types.js";
import type { PageIndexClient } from "./client.js";
import { PageIndexError } from "./errors.js";
import { type FileInput, readFileInput } from "./internal.js";
import { type ProductClientConfig, productClient } from "./product-client.js";

/** Documents whose pages are searched at once, across documents. */
const CONCURRENCY = 8;
const DEFAULT_MAX_DOCUMENTS = 3;
const DEFAULT_UPLOAD_TIMEOUT = 1_800_000;

export interface PageSearchUploadOptions {
  /** The name to store the file under. Default: the file's own name. */
  fileName?: string;
  /** The ID of the collection to store it in. */
  collection?: string;
  /** Your own tags for the document. */
  metadata?: DocumentTags;
  /**
   * Resolve once its pages can be searched (default), up to `timeout`. Rejects
   * if its processing failed or is not done in time. `false` resolves at once.
   */
  wait?: boolean;
  /** Milliseconds to wait. Default: 1,800,000 (30 minutes). */
  timeout?: number;
  signal?: AbortSignal;
}

interface SearchOptionsBase {
  /**
   * List exactly this many pages of each document. Without it, each lists the
   * pages likely to help, possibly none, and the next most relevant as
   * `more_pages`.
   */
  topK?: number;
  /** Give each listed page's text. */
  includeText?: boolean;
  signal?: AbortSignal;
}

/** Search one document's pages. */
export interface SearchOneDocumentOptions extends SearchOptionsBase {
  /** The document's ID. A document still processing rejects with HTTP 409. */
  document: string;
  /** The first page to search, from 1. */
  startPage?: number;
  /** The last page to search, included. */
  endPage?: number;
  documents?: undefined;
  collection?: undefined;
  folder?: undefined;
  recursive?: undefined;
  filter?: undefined;
  maxDocuments?: undefined;
  documentTopK?: undefined;
}

/** Search across documents: the most relevant are found first. */
export interface SearchAcrossDocumentsOptions extends SearchOptionsBase {
  document?: undefined;
  startPage?: undefined;
  endPage?: undefined;
  /** Search among these documents, by ID. */
  documents?: string[];
  /** Search among a collection's documents, by its ID. */
  collection?: string;
  /** Search among a folder's documents, by its ID; `"root"` is the library root. */
  folder?: string;
  /** With `folder`, the documents of its descendant folders too. */
  recursive?: boolean;
  /** Search among the documents whose metadata meets it, e.g. `{ year: { $gte: 2023 } }`. */
  filter?: DocumentFilter;
  /** The most documents a question's pages are searched in, 1 to 10. Default: 3. */
  maxDocuments?: number;
  /** Search exactly this many documents for each question, 1 to 10, in place of `maxDocuments`. */
  documentTopK?: number;
}

export type PageSearchOptions =
  | SearchOneDocumentOptions
  | SearchAcrossDocumentsOptions;

/** A document whose pages a search judged, with those pages. */
export interface PageSearchDocument {
  id: string;
  name: string | null;
  pageNum: number | null;
  folderId: string | null;
  collectionId: string | null;
  metadata: DocumentTags | null;
  /** How likely the document holds the answer, 0 to 1; `null` for the one named with `document`. */
  relevance: number | null;
  /** The pages that help answer the question, most relevant first. */
  pages: SearchedPage[];
  /** Without `topK`: the next most relevant pages. */
  more_pages?: SearchedPage[];
  /** Pages that could not be judged; not charged. */
  failed_pages: number[];
}

export interface PageSearchResult {
  id: string;
  /** One entry for each question, in the order asked. */
  results: Array<{ question: string; documents: PageSearchDocument[] }>;
  /** Documents that could not be judged or searched; not charged. */
  failed_documents: string[];
  /** Documents not ready yet; not searched. */
  processing_documents: string[];
  /** What the search cost, and what is left. */
  usage: {
    documents: number;
    billable_documents: number;
    pages: number;
    billable_pages: number;
    questions: number;
    credits: number;
    balance: number | null;
  };
  seconds: number;
}

export interface PageSearchDocumentsOptions {
  /** Judge only these documents. Without it, every document in scope, up to 1,000. */
  documentIds?: string[];
  /** A collection's ID. */
  collection?: string;
  /** A folder's ID; `"root"` is the library root. */
  folder?: string;
  /** With `folder`, the documents of its descendant folders too. */
  recursive?: boolean;
  filter?: DocumentFilter;
  /**
   * List exactly this many documents for each question. Without it, each
   * lists the documents likely to help, possibly none, and the next most
   * relevant as `more_documents`.
   */
  topK?: number;
  signal?: AbortSignal;
}

/**
 * Page Search over your PageIndex cloud documents: the pages, and the
 * documents, that help answer a question.
 *
 * ```ts
 * const client = new PageSearchClient(); // reads PAGEINDEX_API_KEY
 * const doc = await client.upload({ path: "report.pdf" });
 * await client.search("What was revenue in 2024?", { document: doc.doc_id });
 * ```
 *
 * `upload()` stores a document's pages and builds no outline. The
 * documents are the ones `PageIndexClient` and `PageExtractClient` see with
 * the same key; `client.documents` is that `PageIndexClient`.
 */
export class PageSearchClient {
  readonly documents: PageIndexClient;

  constructor(config: ProductClientConfig = {}) {
    this.documents = productClient(
      config,
      "PageSearchClient",
      "PAGEINDEX_SEARCH_API_KEY",
    );
  }

  /** @deprecated Use `documents`. */
  get pageindex(): PageIndexClient {
    return this.documents;
  }

  /**
   * Uploads a PDF to search. Its pages are stored and no outline is
   * built, so the upload is charged less than one that builds it;
   * `client.documents.api.buildOutline()` builds one later. Uploading the
   * same file to the same place again returns the stored document.
   */
  async upload(
    file: FileInput,
    options: PageSearchUploadOptions = {},
  ): Promise<SubmitDocumentResponse> {
    const api = this.documents.api;
    const { blob, fileName } = await readFileInput(file, options.fileName);
    const result = await api.submitDocument(blob, fileName, {
      collectionId: options.collection,
      metadata: options.metadata,
      index: false,
    });
    if (options.wait !== false) {
      await api.waitDocument(result.doc_id, {
        timeout: options.timeout ?? DEFAULT_UPLOAD_TIMEOUT,
        signal: options.signal,
      });
    }
    return result;
  }

  /**
   * Asks up to 10 questions. For each, the pages that help answer it, under
   * the documents they are in.
   *
   * ```ts
   * client.search(questions, { document: docId });          // one document's pages
   * client.search(questions, { collection: collectionId }); // across documents
   * client.search(questions);                               // across all of yours
   * ```
   *
   * Across documents, the most relevant documents for each question are found
   * first, as `searchDocuments()` finds them, and only their pages are
   * searched: the documents likely to answer, at most `maxDocuments`, or
   * exactly `documentTopK`. Every page searched is charged, and across
   * documents every document judged too.
   */
  async search(
    questions: string | string[],
    options: PageSearchOptions = {},
  ): Promise<PageSearchResult> {
    const asked = typeof questions === "string" ? [questions] : [...questions];
    const across =
      Boolean(options.recursive) ||
      [
        options.documents,
        options.collection,
        options.folder,
        options.filter,
        options.maxDocuments,
        options.documentTopK,
      ].some((value) => value !== undefined);

    if (options.document !== undefined) {
      if (across) {
        throw invalid(
          "search takes document alone, or documents, collection, folder, recursive, filter, maxDocuments and documentTopK.",
        );
      }
      return this.searchOneDocument(asked, options as SearchOneDocumentOptions);
    }
    if (options.startPage !== undefined || options.endPage !== undefined) {
      throw invalid(
        "startPage and endPage are for one document: pass document.",
      );
    }
    if (
      options.maxDocuments !== undefined &&
      options.documentTopK !== undefined
    ) {
      throw invalid("Pass maxDocuments or documentTopK, not both.");
    }
    const most =
      options.documentTopK ?? options.maxDocuments ?? DEFAULT_MAX_DOCUMENTS;
    if (!(most >= 1 && most <= 10)) {
      throw invalid("maxDocuments and documentTopK are from 1 to 10.");
    }
    return this.searchAcrossDocuments(asked, options, most);
  }

  /**
   * Asks up to 10 questions of your documents. For each, the documents likely
   * to hold the answer, most relevant first; `search()` then finds the pages.
   * Every document judged is charged.
   */
  searchDocuments(
    questions: string | string[],
    options: PageSearchDocumentsOptions = {},
  ): Promise<SearchDocumentsResponse> {
    return this.documents.api.searchDocuments({
      questions: typeof questions === "string" ? [questions] : [...questions],
      documentIds: options.documentIds,
      collectionId: options.collection,
      folderId: options.folder,
      recursive: options.recursive,
      metadataFilter: options.filter,
      topK: options.topK,
      signal: options.signal,
    });
  }

  private async searchOneDocument(
    questions: string[],
    options: SearchOneDocumentOptions,
  ): Promise<PageSearchResult> {
    const api = this.documents.api;
    const info = await api.getDocument(options.document, options.signal);
    const entry = {
      id: info.id,
      name: info.name ?? null,
      pageNum: info.pageNum ?? null,
      folderId: info.folderId ?? null,
      collectionId: info.collectionId ?? null,
      metadata: info.metadata ?? null,
    };
    const found = await api.searchPages(options.document, {
      questions,
      topK: options.topK,
      includeText: options.includeText,
      startPage: options.startPage,
      endPage: options.endPage,
      signal: options.signal,
    });
    return {
      id: found.id,
      results: found.results.map((item) => ({
        question: item.question,
        documents: [
          {
            ...entry,
            relevance: null,
            ...listed(item),
            failed_pages: found.failed_pages,
          },
        ],
      })),
      failed_documents: [],
      processing_documents: [],
      usage: { documents: 0, billable_documents: 0, ...found.usage },
      seconds: found.seconds,
    };
  }

  private async searchAcrossDocuments(
    questions: string[],
    options: SearchAcrossDocumentsOptions,
    most: number,
  ): Promise<PageSearchResult> {
    const api = this.documents.api;
    const started = Date.now();
    const judged = await api.searchDocuments({
      questions,
      documentIds: options.documents,
      collectionId: options.collection,
      folderId: options.folder,
      recursive: options.recursive,
      metadataFilter: options.filter,
      topK: options.documentTopK,
      signal: options.signal,
    });
    const chosen = judged.results.map((item) => item.documents.slice(0, most));
    // Each document is searched once, for every question that chose it.
    const askedOf = new Map<string, number[]>();
    chosen.forEach((documents, k) => {
      for (const doc of documents) {
        askedOf.set(doc.id, [...(askedOf.get(doc.id) ?? []), k]);
      }
    });

    const docIds = [...askedOf.keys()];
    const searched = await mapWithConcurrency(docIds, CONCURRENCY, (docId) =>
      api
        .searchPages(docId, {
          questions: (askedOf.get(docId) ?? []).map((k) => questions[k] ?? ""),
          topK: options.topK,
          includeText: options.includeText,
          signal: options.signal,
        })
        .catch((error: unknown) => {
          // Out of credits part-way: never an answer with documents missing.
          if (!(error instanceof PageIndexError) || error.statusCode === 402) {
            throw error;
          }
          return error;
        }),
    );
    const opened = new Map(docIds.map((docId, i) => [docId, searched[i]]));
    const done = searched.filter(
      (s): s is SearchPagesResponse => !(s instanceof PageIndexError),
    );
    const errors = searched.filter(
      (s): s is PageIndexError => s instanceof PageIndexError,
    );
    if (errors.length > 0 && done.length === 0) {
      throw errors[0];
    }

    const results = questions.map((question, k) => {
      const documents: PageSearchDocument[] = [];
      for (const doc of chosen[k] ?? []) {
        const found = opened.get(doc.id);
        if (!found || found instanceof PageIndexError) continue;
        const item = found.results[(askedOf.get(doc.id) ?? []).indexOf(k)];
        if (!item) continue;
        documents.push({
          ...(doc as MatchedDocument),
          ...listed(item),
          failed_pages: found.failed_pages,
        });
      }
      return { question, documents };
    });

    const charged = [judged.usage, ...done.map((s) => s.usage)];
    const balances = charged
      .map((u) => u.balance)
      .filter((b): b is number => b !== null && b !== undefined);
    return {
      id: judged.id,
      results,
      failed_documents: [
        ...judged.failed_documents,
        ...docIds.filter(
          (docId) => opened.get(docId) instanceof PageIndexError,
        ),
      ],
      processing_documents: judged.processing_documents,
      usage: {
        documents: judged.usage.documents,
        billable_documents: judged.usage.billable_documents,
        pages: sum(done.map((s) => s.usage.pages)),
        billable_pages: sum(done.map((s) => s.usage.billable_pages)),
        questions: questions.length,
        credits: round(sum(charged.map((u) => u.credits)), 6),
        balance: balances.length > 0 ? Math.min(...balances) : null,
      },
      seconds: round((Date.now() - started) / 1000, 2),
    };
  }
}

function listed(item: SearchPagesResponse["results"][number]): {
  pages: SearchedPage[];
  more_pages?: SearchedPage[];
} {
  return item.more_pages === undefined
    ? { pages: item.pages }
    : { pages: item.pages, more_pages: item.more_pages };
}

function invalid(message: string): PageIndexError {
  return new PageIndexError(message, "INVALID_INPUT");
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + (value ?? 0), 0);
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

/**
 * `fn` over each item, at most `limit` at once, results in the items' order.
 * After one call rejects, no new call starts.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index] as T);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}
