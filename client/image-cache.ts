import type { ImageOutput } from "../shared/image.js";

export type ImageCall = (input: { cwd: string; path: string }) => Promise<ImageOutput>;

type Entry = { promise: Promise<ImageOutput | null>; result?: ImageOutput; bytes: number };

const MAX_ENTRIES = 64;
// Base64 payloads reach ~14 MB each; bound the total, not just the count.
const MAX_BYTES = 64 * 1024 * 1024;
const entries = new Map<string, Entry>();
let bytes = 0;

export function imageKey(scope: string, cwd: string, path: string): string {
  return `${scope}\0${cwd}\0${path}`;
}

function get(key: string): Entry | undefined {
  const entry = entries.get(key);
  if (!entry) return undefined;
  entries.delete(key);
  entries.set(key, entry);
  return entry;
}

function trim(): void {
  for (const [key, entry] of entries) {
    if (entries.size <= MAX_ENTRIES && bytes <= MAX_BYTES) break;
    // Never evict in-flight reads: remounts must share the same request.
    if (entry.result) {
      entries.delete(key);
      bytes -= entry.bytes;
    }
  }
}

/** A successful read for this key, if one is cached. */
export function peekImage(key: string): ImageOutput | undefined {
  return get(key)?.result;
}

/** Shares one RPC per key; only successful reads stay cached (a missing file may appear later). */
export function requestImage(
  key: string,
  input: { cwd: string; path: string },
  call: ImageCall,
): Promise<ImageOutput | null> {
  const existing = get(key);
  if (existing) return existing.promise;
  const entry: Entry = { promise: Promise.resolve(null), bytes: 0 };
  entry.promise = Promise.resolve()
    .then(() => call(input))
    .then(
      (result) => result,
      () => null,
    )
    .then((result) => {
      if (result?.ok) {
        entry.result = result;
        entry.bytes = result.base64.length;
        bytes += entry.bytes;
        trim();
      } else if (entries.get(key) === entry) {
        entries.delete(key);
      }
      return result;
    });
  entries.set(key, entry);
  return entry.promise;
}
