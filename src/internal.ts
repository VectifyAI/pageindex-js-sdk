/** Resolves after `ms`, or rejects with the signal's reason once it aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** A PDF to upload: its bytes, a Blob or File, or (in Node) a path on disk. */
export type FileInput = Blob | Uint8Array | ArrayBuffer | { path: string };

const DEFAULT_FILE_NAME = "document.pdf";

type BlobPart = NonNullable<ConstructorParameters<typeof Blob>[0]>[number];

/** The file as a Blob, with the name to upload it under. */
export async function readFileInput(
  file: FileInput,
  fileName?: string,
): Promise<{ blob: Blob; fileName: string }> {
  if (file instanceof Blob) {
    const own = (file as { name?: unknown }).name;
    return {
      blob: file,
      fileName:
        fileName ?? (typeof own === "string" && own ? own : DEFAULT_FILE_NAME),
    };
  }
  if (file instanceof Uint8Array || file instanceof ArrayBuffer) {
    return {
      blob: new Blob([file as BlobPart], { type: "application/pdf" }),
      fileName: fileName ?? DEFAULT_FILE_NAME,
    };
  }
  const { readFile } = await import("node:fs/promises");
  const { basename } = await import("node:path");
  const bytes = await readFile(file.path);
  return {
    blob: new Blob([bytes as BlobPart], { type: "application/pdf" }),
    fileName: fileName ?? basename(file.path),
  };
}
