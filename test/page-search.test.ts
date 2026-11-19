import { afterEach, describe, expect, it, vi } from "vitest";
import { PageIndexClient } from "../src/client.js";
import { PageIndexError } from "../src/errors.js";
import { PageSearchClient } from "../src/page-search.js";
import { type SentRequest, serve } from "./helpers.js";

vi.mock("../src/internal.js", async (original) => ({
  ...(await original<typeof import("../src/internal.js")>()),
  sleep: vi.fn(async () => {}),
}));

function client() {
  return new PageSearchClient({ apiKey: "k", apiUrl: "https://api.test" });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const usageOfDocuments = {
  documents: 4,
  questions: 2,
  billable_documents: 3,
  credits: 0.12,
  balance: 50,
};

function foundDocument(id: string, relevance: number) {
  return {
    id,
    name: `${id}.pdf`,
    pageNum: 10,
    folderId: null,
    collectionId: "c-1",
    metadata: null,
    relevance,
  };
}

function documentsFound(first: unknown[], second: unknown[]) {
  return {
    id: "srch_d",
    results: [
      { question: "q1", documents: first, more_documents: [] },
      { question: "q2", documents: second, more_documents: [] },
    ],
    failed_documents: ["x"],
    processing_documents: ["y"],
    usage: usageOfDocuments,
    seconds: 0.5,
  };
}

function pagesFound(request: SentRequest) {
  const docId = request.path.split("/")[2];
  const questions = request.json?.questions as string[];
  return {
    id: `srch_${docId}`,
    doc_id: docId,
    results: questions.map((q) => ({
      question: q,
      pages: [{ page: Number(q[1]), relevance: 0.9, read: "text" }],
    })),
    failed_pages: [],
    seconds: 1,
    usage: {
      pages: 10,
      questions: questions.length,
      billable_pages: 10,
      credits: 0.11,
      balance: 49.89,
    },
  };
}

describe("PageSearchClient.search", () => {
  it("searches one document's pages", async () => {
    const info = {
      id: "pi/1",
      name: "q1.pdf",
      pageNum: 20,
      folderId: "f-1",
      collectionId: null,
      metadata: { year: 2025 },
      status: "completed",
    };
    const pages = [{ page: 4, relevance: 0.9, read: "text" }];
    const more = [{ page: 7, relevance: 0.2, read: "image" }];
    const usage = {
      pages: 20,
      questions: 1,
      billable_pages: 19,
      credits: 0.19,
      balance: 99.81,
    };
    const sent = serve(({ method }) =>
      method === "GET"
        ? info
        : {
            id: "srch_1",
            doc_id: "pi/1",
            results: [{ question: "revenue?", pages, more_pages: more }],
            failed_pages: [9],
            usage,
            seconds: 1.2,
          },
    );

    const found = await client().search("revenue?", {
      document: "pi/1",
      startPage: 2,
      endPage: 21,
    });

    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ["GET", "/doc/pi%2F1/metadata"],
      ["POST", "/doc/pi%2F1/page-search/"],
    ]);
    expect(sent[1]?.json).toEqual({
      questions: ["revenue?"],
      include_text: false,
      start_page: 2,
      end_page: 21,
    });
    expect(found).toEqual({
      id: "srch_1",
      results: [
        {
          question: "revenue?",
          documents: [
            {
              id: "pi/1",
              name: "q1.pdf",
              pageNum: 20,
              folderId: "f-1",
              collectionId: null,
              metadata: { year: 2025 },
              relevance: null,
              pages,
              more_pages: more,
              failed_pages: [9],
            },
          ],
        },
      ],
      failed_documents: [],
      processing_documents: [],
      usage: { documents: 0, billable_documents: 0, ...usage },
      seconds: 1.2,
    });
  });

  it("searches across documents, each document once", async () => {
    const [a, b, c] = [
      foundDocument("a", 0.9),
      foundDocument("b", 0.8),
      foundDocument("c", 0.7),
    ];
    const sent = serve((request) => {
      if (request.path === "/docs/search/") return documentsFound([a, b, c], [b]);
      if (request.path.startsWith("/doc/a/")) {
        return [409, { detail: "The document's pages are not ready." }];
      }
      return pagesFound(request);
    });

    const found = await client().search(["q1", "q2"], {
      collection: "c-1",
      filter: { year: 2025 },
      maxDocuments: 2,
      topK: 5,
      includeText: true,
    });

    expect(sent[0]?.json).toEqual({
      questions: ["q1", "q2"],
      collection_id: "c-1",
      recursive: false,
      metadata_filter: { year: 2025 },
    });
    // Each question opens its two most relevant; one both chose is searched once.
    const opened = Object.fromEntries(
      sent.slice(1).map((r) => [r.path, r.json]),
    );
    expect(opened).toEqual({
      "/doc/a/page-search/": {
        questions: ["q1"],
        top_k: 5,
        include_text: true,
      },
      "/doc/b/page-search/": {
        questions: ["q1", "q2"],
        top_k: 5,
        include_text: true,
      },
    });
    const page = (n: number) => [{ page: n, relevance: 0.9, read: "text" }];
    expect(found.results).toEqual([
      {
        question: "q1",
        documents: [{ ...b, pages: page(1), failed_pages: [] }],
      },
      {
        question: "q2",
        documents: [{ ...b, pages: page(2), failed_pages: [] }],
      },
    ]);
    expect(found.id).toBe("srch_d");
    expect(found.failed_documents).toEqual(["x", "a"]);
    expect(found.processing_documents).toEqual(["y"]);
    expect(found.usage).toEqual({
      documents: 4,
      billable_documents: 3,
      pages: 10,
      billable_pages: 10,
      questions: 2,
      credits: 0.23,
      balance: 49.89,
    });
  });

  it("searches exactly documentTopK documents a question", async () => {
    const [a, b] = [foundDocument("a", 0.9), foundDocument("b", 0.8)];
    const sent = serve((request) => {
      if (request.path === "/docs/search/") return documentsFound([a], [b]);
      if (request.path.startsWith("/doc/a/")) return [503, { detail: "down" }];
      return pagesFound(request);
    });

    const found = await client().search(["q1", "q2"], {
      documents: ["a", "b"],
      documentTopK: 1,
    });

    expect(sent[0]?.json).toEqual({
      questions: ["q1", "q2"],
      document_ids: ["a", "b"],
      recursive: false,
      top_k: 1,
    });
    // q1's one document is the one that cannot be searched.
    expect(found.results.map((r) => r.documents.length)).toEqual([0, 1]);
  });

  it("rejects what it cannot answer", async () => {
    const judged = documentsFound(
      [foundDocument("a", 0.9), foundDocument("b", 0.8)],
      [],
    );

    // Out of credits part-way: never an answer with documents missing.
    serve((request) =>
      request.path === "/docs/search/"
        ? judged
        : request.path.startsWith("/doc/b/")
          ? [402, { detail: "Insufficient credits." }]
          : pagesFound(request),
    );
    const outOfCredits = await client()
      .search(["q1", "q2"])
      .catch((e) => e);
    expect(outOfCredits).toBeInstanceOf(PageIndexError);
    expect(outOfCredits.statusCode).toBe(402);

    // No document's pages could be searched.
    serve((request) =>
      request.path === "/docs/search/" ? judged : [503, { detail: "try again" }],
    );
    const unavailable = await client()
      .search(["q1", "q2"])
      .catch((e) => e);
    expect(unavailable.message).toBe("try again");
    expect(unavailable.statusCode).toBe(503);

    // No document likely to answer: nothing to search, and nothing failed.
    serve(() => documentsFound([], []));
    const nothing = await client().search(["q1", "q2"]);
    expect(nothing.results).toEqual([
      { question: "q1", documents: [] },
      { question: "q2", documents: [] },
    ]);
  });

  it("refuses options that do not go together, and sends nothing", async () => {
    const sent = serve(() => ({}));
    const refused = [
      { document: "d", collection: "c" },
      { document: "d", maxDocuments: 2 },
      { document: "d", recursive: true },
      { startPage: 2 },
      { collection: "c", endPage: 2 },
      { maxDocuments: 2, documentTopK: 2 },
      { maxDocuments: 11 },
      { documentTopK: 0 },
    ];
    for (const options of refused) {
      // biome-ignore lint/suspicious/noExplicitAny: invalid on purpose
      const error = await client().search("q", options as any).catch((e) => e);
      expect(error).toBeInstanceOf(PageIndexError);
      expect(error.code).toBe("INVALID_INPUT");
    }
    expect(sent).toEqual([]);
  });
});

describe("PageSearchClient", () => {
  it("searches documents", async () => {
    const sent = serve(() => ({ id: "srch_1", results: [] }));
    expect(
      await client().searchDocuments("q", {
        collection: "c-1",
        filter: { year: 2025 },
        topK: 5,
      }),
    ).toEqual({ id: "srch_1", results: [] });
    expect(sent[0]?.json).toEqual({
      questions: ["q"],
      collection_id: "c-1",
      recursive: false,
      metadata_filter: { year: 2025 },
      top_k: 5,
    });
  });

  it("uploads without an index and waits for the pages", async () => {
    const sent = serve(({ path }) =>
      path === "/doc/"
        ? { doc_id: "pi-1", name: "report.pdf" }
        : { id: "pi-1", status: "completed" },
    );

    const doc = await client().upload(new Uint8Array([1, 2]), {
      fileName: "report.pdf",
      collection: "c-1",
      metadata: { year: 2024 },
    });

    expect(doc).toEqual({ doc_id: "pi-1", name: "report.pdf" });
    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ["POST", "/doc/"],
      ["GET", "/doc/pi-1/metadata"],
    ]);
    expect(sent[0]?.form).toEqual({
      algorithm: "none",
      collection_id: "c-1",
      metadata: '{"year":2024}',
    });
  });

  it("works through a PageIndexClient, and refuses a key beside it", () => {
    const pageindex = new PageIndexClient({ apiKey: "k" });
    expect(new PageSearchClient({ client: pageindex }).pageindex).toBe(
      pageindex,
    );
    expect(
      () =>
        // biome-ignore lint/suspicious/noExplicitAny: invalid on purpose
        new PageSearchClient({ client: pageindex, apiKey: "k" } as any),
    ).toThrow("not both");
  });
});
