import { afterEach, describe, expect, it, vi } from "vitest";
import { PageIndexApi } from "../../src/api/client.js";
import { PageIndexClient } from "../../src/client.js";
import { resolveApiKey } from "../../src/env.js";
import { PageIndexError } from "../../src/errors.js";
import { serve } from "../helpers.js";

vi.mock("../../src/internal.js", async (original) => ({
  ...(await original<typeof import("../../src/internal.js")>()),
  sleep: vi.fn(async () => {}),
}));

function api(folderScope?: string) {
  return new PageIndexApi({
    apiUrl: "https://api.test",
    apiKey: "k",
    folderScope,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("submitDocument", () => {
  it("stores a document in a collection without an index", async () => {
    const sent = serve(() => ({ doc_id: "pi-1", name: "a.pdf" }));

    const result = await api("f-scope").submitDocument(
      new Uint8Array([1, 2, 3]),
      "a.pdf",
      { collectionId: "c-1", metadata: { year: 2025 }, index: false },
    );

    expect(result).toEqual({ doc_id: "pi-1", name: "a.pdf" });
    expect(sent[0]?.path).toBe("/doc/");
    expect(sent[0]?.file).toEqual({ name: "a.pdf", size: 3 });
    expect(sent[0]?.form).toEqual({
      algorithm: "none",
      collection_id: "c-1",
      metadata: '{"year":2025}',
    });
  });

  it("uses the folder scope when no collection is given", async () => {
    const sent = serve(() => ({ doc_id: "pi-1" }));
    await api("f-scope").submitDocument(new Uint8Array([1]), "a.pdf");
    expect(sent[0]?.form).toEqual({ folder_id: "f-scope" });
  });

  it("sends an extraction to start with the upload", async () => {
    const sent = serve(() => ({ doc_id: "pi-1", extract_job_id: "ext_1" }));
    const configuration = { data_schema: { type: "object" }, tier: "pro" };

    const result = await api().submitDocument(new Uint8Array([1]), "a.pdf", {
      index: false,
      extract: configuration,
    });

    expect(result.extract_job_id).toBe("ext_1");
    expect(sent[0]?.form?.algorithm).toBe("none");
    expect(JSON.parse(sent[0]?.form?.extract ?? "")).toEqual(configuration);
  });
});

describe("errors", () => {
  it("reads the message from the API's detail", async () => {
    serve(() => [409, { detail: "The document's pages are not ready." }]);
    const error = await api()
      .searchPages("d", { questions: ["q"] })
      .catch((e) => e);
    expect(error).toBeInstanceOf(PageIndexError);
    expect(error.message).toBe("The document's pages are not ready.");
    expect(error.statusCode).toBe(409);

    // A detail or an error that is an object: its message, and the body kept.
    const detail = { message: "Still being read.", doc_id: "pi-7" };
    serve(() => [409, { detail }]);
    const stored = await api()
      .searchPages("d", { questions: ["q"] })
      .catch((e) => e);
    expect(stored.message).toBe("Still being read.");
    expect(stored.details.detail).toEqual(detail);
    serve(() => [
      400,
      {
        detail: "Bad",
        error: { type: "invalid_request", message: "Bad page range." },
      },
    ]);
    const invalid = await api()
      .searchPages("d", { questions: ["q"] })
      .catch((e) => e);
    expect(invalid.message).toBe("Bad page range.");
  });

  it("names a 403 by the API's error code", async () => {
    const refused = async (code: string | null, detail: string) => {
      serve(() => [
        403,
        { detail, error: { type: "permission_error", code, message: detail } },
      ]);
      return api()
        .listCollections()
        .catch((e) => e);
    };
    const invalid = await refused(null, "Invalid API key");
    expect(invalid.code).toBe("FORBIDDEN");
    expect(invalid.statusCode).toBe(403);
    expect(invalid.message).toBe("Invalid API key");
    expect((await refused("page_limit_reached", "Limit")).code).toBe(
      "PLAN_REQUIRED",
    );
    expect((await refused("subscription_required", "Subscribe")).code).toBe(
      "SUBSCRIPTION_REQUIRED",
    );
    // A body without the error object.
    serve(() => [403, { detail: "Forbidden" }]);
    expect(
      (
        await api()
          .listCollections()
          .catch((e) => e)
      ).code,
    ).toBe("FORBIDDEN");
  });

  it("names a 402 USAGE_LIMIT_REACHED", async () => {
    serve(() => [402, { detail: "Insufficient credits." }]);
    const error = await api()
      .searchDocuments({ questions: ["q"] })
      .catch((e) => e);
    expect(error.code).toBe("USAGE_LIMIT_REACHED");
  });
});

describe("search", () => {
  it("sends a page search and leaves out what is not set", async () => {
    const sent = serve(() => ({ id: "s" }));
    await api().searchPages("pi/1", {
      questions: ["q"],
      startPage: 2,
      endPage: 21,
    });
    expect(sent[0]).toMatchObject({
      method: "POST",
      path: "/doc/pi%2F1/page-search/",
      json: {
        questions: ["q"],
        include_text: false,
        start_page: 2,
        end_page: 21,
      },
    });
  });

  it("sends a document search", async () => {
    const sent = serve(() => ({ id: "s" }));
    await api().searchDocuments({
      questions: ["a", "b"],
      documentIds: ["d1"],
      folderId: "f-1",
      recursive: true,
      metadataFilter: { year: 2025 },
      topK: 5,
    });
    expect(sent[0]).toMatchObject({
      method: "POST",
      path: "/docs/search/",
      json: {
        questions: ["a", "b"],
        document_ids: ["d1"],
        folder_id: "f-1",
        recursive: true,
        metadata_filter: { year: 2025 },
        top_k: 5,
      },
    });
  });
});

describe("extract jobs", () => {
  it("creates, reads, lists, cancels and deletes jobs", async () => {
    const sent = serve(({ method }) =>
      method === "POST" ? [202, { id: "ext/1" }] : { id: "ext/1" },
    );
    const client = api();
    const configuration = {
      data_schema: { type: "object" },
      tier: "pro" as const,
    };

    await client.createExtract({ docId: "pi-1", configuration });
    await client.getExtract("ext/1");
    await client.listExtracts({ limit: 5, after: "ext_0" });
    await client.cancelExtract("ext/1");
    await client.deleteExtract("ext/1");

    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ["POST", "/extract/"],
      ["GET", "/extract/ext%2F1/"],
      ["GET", "/extracts/?limit=5&after=ext_0"],
      ["POST", "/extract/ext%2F1/cancel/"],
      ["DELETE", "/extract/ext%2F1/"],
    ]);
    expect(sent[0]?.form).toEqual({
      configuration: JSON.stringify(configuration),
      doc_id: "pi-1",
    });
  });
});

describe("collections and outline index", () => {
  it("lists, creates and deletes collections, and builds an index", async () => {
    const sent = serve(() => ({}));
    const client = api();
    await client.listCollections();
    await client.createCollection({ name: "Invoices" });
    await client.deleteCollection("c/1");
    await client.buildOutlineIndex("pi-1");
    await client.outline("pi-1", "hierarchical");
    expect(sent.map((r) => [r.method, r.path, r.json])).toEqual([
      ["GET", "/collections/", undefined],
      ["POST", "/collection/", { name: "Invoices" }],
      ["DELETE", "/collection/c%2F1/", undefined],
      ["POST", "/doc/pi-1/index", undefined],
      ["POST", "/doc/pi-1/index", { structure: "hierarchical" }],
    ]);
  });
});

describe("waitDocument", () => {
  it("polls until the document is completed", async () => {
    const statuses = ["queued", "processing", "completed"];
    const sent = serve(() => ({ id: "pi-1", status: statuses.shift() }));
    const doc = await api().waitDocument("pi-1");
    expect(doc.status).toBe("completed");
    expect(sent).toHaveLength(3);
  });

  it("rejects when the processing failed", async () => {
    serve(() => ({ id: "pi-1", status: "failed" }));
    await expect(api().waitDocument("pi-1")).rejects.toThrow(
      "Document processing failed",
    );
  });

  it("rejects at once on a 404, and after three poll failures", async () => {
    let sent = serve(() => [404, { detail: "Document not found." }]);
    await expect(api().waitDocument("pi-1")).rejects.toThrow(
      "Document not found.",
    );
    expect(sent).toHaveLength(1);

    sent = serve(() => [503, { detail: "try again" }]);
    await expect(api().waitDocument("pi-1")).rejects.toThrow(
      "Could not poll document status",
    );
    // Three polls, each sent three times: the first try and two retries.
    expect(sent).toHaveLength(9);
  });

  it("rejects once the timeout has passed", async () => {
    serve(() => ({ id: "pi-1", status: "processing" }));
    await expect(api().waitDocument("pi-1", { timeout: 0 })).rejects.toThrow(
      "Timed out after 0s",
    );
  });
});

describe("API key", () => {
  it("reads PAGEINDEX_API_KEY first, then the product's own key", () => {
    vi.stubEnv("PAGEINDEX_API_KEY", "");
    vi.stubEnv("PAGEINDEX_SEARCH_API_KEY", "search");
    vi.stubEnv("PAGEINDEX_EXTRACT_API_KEY", "extract");
    expect(resolveApiKey(undefined)).toBe("search");
    expect(resolveApiKey(undefined, "PAGEINDEX_EXTRACT_API_KEY")).toBe(
      "extract",
    );
    vi.stubEnv("PAGEINDEX_API_KEY", "main");
    expect(resolveApiKey(undefined, "PAGEINDEX_EXTRACT_API_KEY")).toBe("main");
    expect(resolveApiKey("passed")).toBe("passed");
  });

  it("refuses a client without a key", () => {
    vi.stubEnv("PAGEINDEX_API_KEY", "");
    vi.stubEnv("PAGEINDEX_SEARCH_API_KEY", "");
    vi.stubEnv("PAGEINDEX_EXTRACT_API_KEY", "");
    expect(() => new PageIndexClient()).toThrow("No API key");
  });
});

describe("pageImage", () => {
  it("downloads the page from its presigned URL, without the API key", async () => {
    const sent: { url: string; headers?: HeadersInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        sent.push({ url: String(input), headers: init?.headers });
        if (String(input).startsWith("https://api.test")) {
          return Response.json({
            images: [{ page: 3, url: "https://bucket.test/page-3.jpg" }],
          });
        }
        return new Response(new Uint8Array([0xff, 0xd8, 0xff]));
      }),
    );

    const image = await api().pageImage("pi-1", 3);

    expect(image).toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
    expect(sent).toEqual([
      {
        url: "https://api.test/doc/s3/pi-1/images?start=3&end=3",
        headers: { api_key: "k" },
      },
      { url: "https://bucket.test/page-3.jpg", headers: undefined },
    ]);
  });

  it("refuses a page with no image URL as NOT_FOUND", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ images: [{ page: 99, url: null }] })),
    );

    await expect(api().pageImage("pi-1", 99)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
