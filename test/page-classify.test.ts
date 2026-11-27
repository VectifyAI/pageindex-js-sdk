import { afterEach, describe, expect, it, vi } from "vitest";
import { PageIndexError } from "../src/errors.js";
import { PageClassifyClient } from "../src/page-classify.js";
import { serve } from "./helpers.js";

vi.mock("../src/internal.js", async (original) => ({
  ...(await original<typeof import("../src/internal.js")>()),
  sleep: vi.fn(async () => {}),
}));

function client() {
  return new PageClassifyClient({ apiKey: "k", apiUrl: "https://api.test" });
}

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
const collections = {
  collections: [{ id: "c-9", name: "Page Classify" }],
  total: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Answers in turn, one reply a request. */
function replies(...answers: unknown[]) {
  return serve(() => answers.shift());
}

describe("PageClassifyClient.classify", () => {
  it("sends a file with its job and waits for each page's class", async () => {
    const done = {
      id: "cls_1",
      status: "completed",
      doc_id: "pi-1",
      pages: [{ page: 3, class: null, confidence: 0.88 }],
      failed_pages: [],
    };
    const sent = replies(
      collections,
      { id: "cls_1", status: "pending", doc_id: "pi-1" },
      { id: "cls_1", status: "running", doc_id: "pi-1" },
      done,
    );

    const job = await client().classify(
      pdf,
      { invoice: "A bill asking for payment", receipt: null },
      { granularity: "page", pages: [3, 9], fileName: "mixed.pdf" },
    );

    expect(job).toEqual(done);
    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ["GET", "/collections/"],
      ["POST", "/classify/"],
      ["GET", "/classify/cls_1/"],
      ["GET", "/classify/cls_1/"],
    ]);
    expect(sent[1]?.file).toEqual({ name: "mixed.pdf", size: 4 });
    const { configuration, ...form } = sent[1]?.form ?? {};
    expect(form).toEqual({ collection_id: "c-9" });
    expect(JSON.parse(configuration ?? "")).toEqual({
      classes: [
        { name: "invoice", description: "A bill asking for payment" },
        { name: "receipt" },
      ],
      granularity: "page",
      target_pages: "3-9",
    });
  });

  it("classifies an uploaded document, waiting for its pages first", async () => {
    const done = {
      id: "cls_2",
      status: "completed",
      doc_id: "pi-1",
      class: "invoice",
      confidence: 0.96,
    };
    const notReady = [
      409,
      { detail: { message: "Not ready.", doc_id: "pi-1" } },
    ];
    const sent = replies(
      notReady,
      { id: "pi-1", status: "processing" },
      { id: "pi-1", status: "completed" },
      done,
    );

    expect(await client().classify("pi-1", ["invoice", "receipt"])).toEqual(
      done,
    );
    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ["POST", "/classify/"],
      ["GET", "/doc/pi-1/metadata"],
      ["GET", "/doc/pi-1/metadata"],
      ["POST", "/classify/"],
    ]);
    expect(sent[3]?.form?.doc_id).toBe("pi-1");
    expect(sent[3]?.file).toBeUndefined();
    expect(JSON.parse(sent[3]?.form?.configuration ?? "")).toEqual({
      classes: [{ name: "invoice" }, { name: "receipt" }],
      granularity: "document",
    });

    // Without waiting, a document not ready is the caller's to retry.
    replies(notReady);
    const error = await client()
      .classify("pi-1", ["invoice"], { wait: false })
      .catch((e) => e);
    expect(error).toBeInstanceOf(PageIndexError);
    expect(error.statusCode).toBe(409);
  });

  it("classifies the stored document of a file sent again while it processes", async () => {
    const done = { id: "cls_3", status: "completed", doc_id: "pi-7" };
    const sent = replies(
      collections,
      [409, { detail: { message: "Still processing.", doc_id: "pi-7" } }],
      { id: "pi-7", status: "completed" },
      done,
    );

    expect(await client().classify(pdf, ["invoice"])).toEqual(done);
    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ["GET", "/collections/"],
      ["POST", "/classify/"],
      ["GET", "/doc/pi-7/metadata"],
      ["POST", "/classify/"],
    ]);
    expect(sent[3]?.form?.doc_id).toBe("pi-7");
    expect(sent[3]?.file).toBeUndefined();
  });

  it("rejects with the job when it fails", async () => {
    const failed = {
      id: "cls_4",
      status: "failed",
      doc_id: "pi-1",
      error_message: "The document could not be classified just now.",
    };
    replies({ id: "cls_4", status: "pending", doc_id: "pi-1" }, failed);

    const error = await client()
      .classify("pi-1", ["invoice"])
      .catch((e) => e);
    expect(error).toBeInstanceOf(PageIndexError);
    expect(error.message).toBe(
      "Classify job cls_4 failed: The document could not be classified just now.",
    );
    expect(error.details).toEqual({ job: failed });
  });

  it("takes one name as one class", async () => {
    const sent = replies({ id: "cls_5", status: "pending", doc_id: "pi-1" });

    await client().classify("pi-1", "invoice", { wait: false });
    expect(JSON.parse(sent[0]?.form?.configuration ?? "").classes).toEqual([
      { name: "invoice" },
    ]);
  });

  it("rejects with the job when it could not read some pages", async () => {
    const partial = {
      id: "cls_6",
      status: "completed",
      doc_id: "pi-1",
      class: "invoice",
      confidence: 0.95,
      failed_pages: [1, 2],
    };
    replies({ id: "cls_6", status: "pending", doc_id: "pi-1" }, partial);

    const error = await client()
      .classify("pi-1", ["invoice", "receipt"])
      .catch((e) => e);
    expect(error).toBeInstanceOf(PageIndexError);
    expect(error.message).toBe(
      "Classify job cls_6 has pages it could not read: 1, 2. Its result leaves them out: read it with getClassify(jobId).",
    );
    expect(error.details).toEqual({ job: partial });

    // getClassify() returns it as it is.
    replies(partial);
    expect(await client().getClassify("cls_6")).toEqual(partial);
  });

  it("refuses a file name given as a doc_id", async () => {
    const sent = replies();
    const error = await client()
      .classify("scan.pdf", ["invoice"])
      .catch((e) => e);
    expect(error.code).toBe("INVALID_INPUT");
    expect(sent).toHaveLength(0);
  });
});
