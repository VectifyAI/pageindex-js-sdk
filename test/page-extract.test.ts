import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PageIndexError } from "../src/errors.js";
import { PageExtractClient } from "../src/page-extract.js";
import { type SentRequest, serve } from "./helpers.js";

vi.mock("../src/internal.js", async (original) => ({
  ...(await original<typeof import("../src/internal.js")>()),
  sleep: vi.fn(async () => {}),
}));

function client() {
  return new PageExtractClient({ apiKey: "k", apiUrl: "https://api.test" });
}

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const object = { type: "object" };
let dir: string;
let samplePath: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "pageindex-extract-"));
  samplePath = join(dir, "sample.pdf");
  await writeFile(samplePath, pdf);
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Answers in turn, one reply a request. */
function replies(...answers: unknown[]) {
  return serve(() => answers.shift());
}

describe("PageExtractClient.extract", () => {
  it("uploads a file with its job and waits for the result", async () => {
    const done = {
      id: "ext_1",
      status: "completed",
      extract_result: { total: 5 },
    };
    const later = [
      { id: "ext_1", status: "pending" },
      { id: "ext_1", status: "running" },
      done,
    ];
    const sent = serve(({ path }) => {
      if (path === "/collections/") {
        return { collections: [{ id: "c-9", name: "Page Extract" }], total: 1 };
      }
      if (path === "/doc/") {
        return { doc_id: "pi-1", name: "sample.pdf", extract_job_id: "ext_1" };
      }
      return later.shift();
    });
    const schema = {
      type: "object",
      properties: { total: { type: "number" } },
    };

    const job = await client().extract<{ total: number }>(
      { path: samplePath },
      schema,
      { pages: [3, 9], citeSources: true, systemPrompt: "Totals in USD." },
    );

    expect(job).toEqual(done);
    expect(job.extract_result?.total).toBe(5);
    // One upload starts the job: no wait for the document, no POST /extract/.
    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ["GET", "/collections/"],
      ["POST", "/doc/"],
      ["GET", "/extract/ext_1/"],
      ["GET", "/extract/ext_1/"],
      ["GET", "/extract/ext_1/"],
    ]);
    expect(sent[1]?.file).toEqual({ name: "sample.pdf", size: 4 });
    const { extract, ...form } = sent[1]?.form ?? {};
    expect(form).toEqual({ algorithm: "none", collection_id: "c-9" });
    expect(JSON.parse(extract ?? "")).toEqual({
      data_schema: schema,
      tier: "standard",
      target_pages: "3-9",
      cite_sources: true,
      system_prompt: "Totals in USD.",
    });
  });

  it("resolves with the job an upload started, without waiting", async () => {
    const sent = replies(
      { collections: [{ id: "c-9", name: "Page Extract" }], total: 1 },
      { doc_id: "pi-1", extract_job_id: "ext_1" },
      { id: "ext_1", status: "pending", doc_id: "pi-1" },
    );
    expect(await client().extract(pdf, object, { wait: false })).toEqual({
      id: "ext_1",
      status: "pending",
      doc_id: "pi-1",
    });
    expect(sent).toHaveLength(3);

    // The job started, but reading it failed: the error names it.
    replies(
      { collections: [{ id: "c-9", name: "Page Extract" }], total: 1 },
      { doc_id: "pi-1", extract_job_id: "ext_1" },
      [502, { detail: "Bad gateway" }],
    );
    const error = await client()
      .extract(pdf, object)
      .catch((e) => e);
    expect(error.message).toMatch("started extract job ext_1");
    expect(error.statusCode).toBe(502);
    expect(error.details).toEqual({ jobId: "ext_1" });
  });

  it("starts the job itself when the upload started none", async () => {
    const done = { id: "ext_1", status: "completed", extract_result: {} };
    const collections = {
      collections: [{ id: "c-9", name: "Page Extract" }],
      total: 1,
    };

    // A server older than extraction on upload.
    let sent = replies(
      collections,
      { doc_id: "pi-1", name: "sample.pdf" },
      { id: "pi-1", status: "completed" },
      [202, done],
    );
    expect(await client().extract(pdf, object)).toEqual(done);
    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ["GET", "/collections/"],
      ["POST", "/doc/"],
      ["GET", "/doc/pi-1/metadata"],
      ["POST", "/extract/"],
    ]);
    expect(sent[3]?.form?.doc_id).toBe("pi-1");

    // The same file, stored already, its pages still being read.
    const stillRead = {
      message:
        "This file was uploaded already, and its pages are still being read.",
      doc_id: "pi-7",
    };
    sent = replies(
      collections,
      [409, { detail: stillRead }],
      { id: "pi-7", status: "processing" },
      { id: "pi-7", status: "completed" },
      [202, done],
    );
    expect(await client().extract(pdf, object)).toEqual(done);
    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ["GET", "/collections/"],
      ["POST", "/doc/"],
      ["GET", "/doc/pi-7/metadata"],
      ["GET", "/doc/pi-7/metadata"],
      ["POST", "/extract/"],
    ]);
    expect(sent[4]?.form?.doc_id).toBe("pi-7");

    // A 409 that names no document stands.
    replies(collections, [409, { detail: "Conflict." }]);
    const error = await client()
      .extract(pdf, object)
      .catch((e) => e);
    expect(error.statusCode).toBe(409);
    expect(error.message).toBe("Conflict.");
  });

  it.each([
    // Its job did not complete, and failed it.
    [
      "fails",
      [
        { id: "pi-7", status: "failed" },
        { id: "pi-7", status: "failed" },
      ],
    ],
    ["is deleted", [[404, { detail: "Document not found." }]]],
  ])("uploads again when the document it waited for %s", async (_, reads) => {
    // Stored by another job, still processing.
    const sent = replies(
      { collections: [{ id: "c-9", name: "Page Extract" }], total: 1 },
      [409, { detail: { message: "Still processing.", doc_id: "pi-7" } }],
      ...reads,
      { doc_id: "pi-8", extract_job_id: "ext_1" },
      { id: "ext_1", status: "pending", doc_id: "pi-8" },
    );
    expect(await client().extract(pdf, object, { wait: false })).toEqual({
      id: "ext_1",
      status: "pending",
      doc_id: "pi-8",
    });
    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ["GET", "/collections/"],
      ["POST", "/doc/"],
      ...reads.map(() => ["GET", "/doc/pi-7/metadata"]),
      ["POST", "/doc/"],
      ["GET", "/extract/ext_1/"],
    ]);
  });

  it("rejects when the document it waited for fails again", async () => {
    const stored = [
      409,
      { detail: { message: "Still processing.", doc_id: "pi-7" } },
    ];
    const failed = { id: "pi-7", status: "failed" };
    const sent = replies(
      { collections: [{ id: "c-9", name: "Page Extract" }], total: 1 },
      stored,
      failed,
      failed,
      stored,
      failed,
    );
    const error = await client()
      .extract(pdf, object)
      .catch((e) => e);
    expect(error.message).toMatch("failed");
    expect(sent.filter((r) => r.path === "/doc/")).toHaveLength(2);
  });

  it("stores a file in the collection named", async () => {
    const stored = [{ id: "c-1", name: "Invoices" }];
    const sent = serve(({ path, json }) => {
      if (path === "/collections/") {
        return { collections: stored, total: stored.length };
      }
      if (path === "/collection/") {
        // The same name to the cloud's collation.
        if (json?.name === "Invöices") {
          return [
            409,
            { detail: "A collection with this name already exists." },
          ];
        }
        stored.push({ id: "c-new", name: String(json?.name) });
        return { collection: stored.at(-1) };
      }
      if (path === "/doc/") return { doc_id: "pi-1", name: "sample.pdf" };
      if (path === "/doc/pi-1/metadata")
        return { id: "pi-1", status: "completed" };
      return [202, { id: "ext_1", status: "pending" }];
    });
    const extractor = client();
    const storedIn = async (collection?: string | null) => {
      sent.length = 0;
      await extractor.extract(pdf, object, { wait: false, collection });
      return sent
        .filter((r) => r.path === "/doc/")
        .map((r) => r.form?.collection_id ?? null);
    };

    // The default collection is made on first use, and found after.
    expect(await storedIn()).toEqual(["c-new"]);
    expect(sent.filter((r) => r.path === "/collection/")).toHaveLength(1);
    expect(await storedIn()).toEqual(["c-new"]);
    expect(sent.some((r) => r.path.startsWith("/collection"))).toBe(false);
    // A name or an ID of one of yours; null is no collection.
    expect(await storedIn("Invoices")).toEqual(["c-1"]);
    expect(await storedIn("c-1")).toEqual(["c-1"]);
    expect(await storedIn(null)).toEqual([null]);
    // Names match in any case, as the cloud keeps them unique.
    expect(await storedIn(" invoices ")).toEqual(["c-1"]);
    // One the cloud says exists but none matches: reject, never upload outside.
    const error = await storedIn("Invöices").catch((e) => e);
    expect(error.message).toMatch("exact name");
    expect(error.statusCode).toBe(409);
    expect(sent.some((r) => r.path === "/doc/")).toBe(false);
  });

  it("finds its collection again when the one it knew is gone", async () => {
    const stored = [{ id: "c-old", name: "Page Extract" }];
    const sent = serve(({ path, form }) => {
      if (path === "/collections/") return { collections: stored, total: 1 };
      if (path === "/doc/") {
        if (form?.collection_id !== stored[0]?.id) {
          return [404, { detail: "Collection not found." }];
        }
        return { doc_id: "pi-1", name: "sample.pdf" };
      }
      if (path === "/doc/pi-1/metadata")
        return { id: "pi-1", status: "completed" };
      return [202, { id: "ext_1", status: "pending" }];
    });
    const extractor = client();

    await extractor.extract(pdf, object, { wait: false });
    stored[0] = { id: "c-new", name: "Page Extract" };
    await extractor.extract(pdf, object, { wait: false });

    expect(
      sent.filter((r) => r.path === "/doc/").map((r) => r.form?.collection_id),
    ).toEqual(["c-old", "c-old", "c-new"]);
  });

  it("extracts from an uploaded document", async () => {
    const sent = replies([202, { id: "ext_1", status: "pending" }]);

    const job = await client().extract("pi-1", object, {
      tier: "pro",
      pages: 3,
      wait: false,
    });

    expect(job).toEqual({ id: "ext_1", status: "pending" });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.file).toBeUndefined();
    expect(sent[0]?.form?.doc_id).toBe("pi-1");
    expect(JSON.parse(sent[0]?.form?.configuration ?? "")).toEqual({
      data_schema: object,
      tier: "pro",
      target_pages: "3",
    });
  });

  it("refuses a file name or a schema that is not an object", async () => {
    const sent = serve(() => ({}));
    const fileName = await client()
      .extract("invoice.pdf", object)
      .catch((e) => e);
    expect(fileName.message).toMatch('pass { path: "invoice.pdf" }');
    const notSchema = await client()
      // biome-ignore lint/suspicious/noExplicitAny: invalid on purpose
      .extract("pi-1", "an invoice's total" as any)
      .catch((e) => e);
    expect(notSchema.message).toMatch("JSON Schema");
    expect(sent).toEqual([]);
  });

  it("waits for a document still processing", async () => {
    const notReady = [409, { detail: "The document's pages are not ready." }];
    const done = { id: "ext_1", status: "completed", extract_result: {} };
    let sent = replies(
      notReady,
      { status: "processing" },
      { status: "completed" },
      [202, done],
    );
    expect(await client().extract("pi-1", object)).toEqual(done);
    expect(sent.map((r: SentRequest) => [r.method, r.path])).toEqual([
      ["POST", "/extract/"],
      ["GET", "/doc/pi-1/metadata"],
      ["GET", "/doc/pi-1/metadata"],
      ["POST", "/extract/"],
    ]);

    // Without wait, and for a ready document with no pages, the refusal stands.
    replies(notReady);
    await expect(
      client().extract("pi-1", object, { wait: false }),
    ).rejects.toThrow("not ready");
    sent = replies(notReady, { status: "completed" }, notReady);
    const error = await client()
      .extract("pi-1", object)
      .catch((e) => e);
    expect(error.statusCode).toBe(409);
    expect(sent).toHaveLength(3);
  });

  it("rejects when the job does not complete", async () => {
    const ends = (job: Record<string, unknown>) =>
      serve(({ method }) =>
        method === "POST"
          ? [202, { id: "ext_1", status: "pending" }]
          : { id: "ext_1", ...job },
      );

    ends({ status: "failed", error_message: "The PDF has no text." });
    const failed = await client()
      .extract("pi-1", object)
      .catch((e) => e);
    expect(failed).toBeInstanceOf(PageIndexError);
    expect(failed.message).toBe(
      "Extract job ext_1 failed: The PDF has no text.",
    );
    expect(failed.details.job.status).toBe("failed");

    ends({ status: "cancelled" });
    await expect(client().extract("pi-1", object)).rejects.toThrow(
      "ext_1 cancelled",
    );

    ends({ status: "running" });
    await expect(
      client().extract("pi-1", object, { timeout: -1 }),
    ).rejects.toThrow("still pending after");

    serve(() => [402, { detail: "Insufficient credits." }]);
    const outOfCredits = await client()
      .extract("pi-1", object)
      .catch((e) => e);
    expect(outOfCredits.statusCode).toBe(402);
  });

  it("names the job when reading it fails", async () => {
    serve(({ method }) =>
      method === "POST"
        ? [202, { id: "ext_1", status: "pending" }]
        : [502, { detail: "Bad gateway" }],
    );
    const badGateway = await client()
      .extract("pi-1", object)
      .catch((e) => e);
    expect(badGateway.message).toMatch("read extract job ext_1");
    expect(badGateway.statusCode).toBe(502);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return new Response(
            JSON.stringify({ id: "ext_1", status: "pending" }),
            {
              status: 202,
            },
          );
        }
        throw new TypeError("fetch failed");
      }),
    );
    await expect(client().extract("pi-1", object)).rejects.toThrow(
      "read extract job ext_1",
    );
  });
});

describe("PageExtractClient jobs", () => {
  it("waits for a job", async () => {
    const done = {
      id: "ext_1",
      status: "completed",
      extract_result: { total: 5 },
    };
    const sent = replies({ id: "ext_1", status: "running" }, done);
    expect(await client().waitExtract("ext_1")).toEqual(done);
    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ["GET", "/extract/ext_1/"],
      ["GET", "/extract/ext_1/"],
    ]);

    serve(() => ({ id: "ext_1", status: "cancelled" }));
    await expect(client().waitExtract("ext_1")).rejects.toThrow(
      "ext_1 cancelled",
    );
    serve(() => ({ id: "ext_1", status: "running" }));
    await expect(
      client().waitExtract("ext_1", { timeout: -1 }),
    ).rejects.toThrow("still running after");
  });

  it("lists, reads, cancels and deletes jobs", async () => {
    let sent = serve(() => ({ jobs: [], next: null }));
    const extractor = client();
    expect(await extractor.listExtracts()).toEqual({ jobs: [], next: null });
    expect(sent[0]?.path).toBe("/extracts/?limit=20");

    sent = serve(() => ({ id: "ext/1", status: "cancelled" }));
    await extractor.getExtract("ext/1");
    await extractor.cancelExtract("ext/1");
    await extractor.deleteExtract("ext/1");
    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ["GET", "/extract/ext%2F1/"],
      ["POST", "/extract/ext%2F1/cancel/"],
      ["DELETE", "/extract/ext%2F1/"],
    ]);

    serve(() => [409, { detail: "already completed" }]);
    const error = await extractor.cancelExtract("ext/1").catch((e) => e);
    expect(error.message).toBe("already completed");
    expect(error.statusCode).toBe(409);
  });
});
