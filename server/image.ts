import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { ImageOutput } from "../shared/image.js";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
};

export async function readImageFile(input: { cwd: string; path: string }, home = homedir()): Promise<ImageOutput> {
  const raw = input.path.startsWith("~/") ? path.join(home, input.path.slice(2)) : input.path;
  const base = input.cwd === "~" ? home : input.cwd;
  const file = path.resolve(base, raw);
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime) return { ok: false, reason: "unsupported" };
  try {
    const info = await stat(file);
    if (!info.isFile()) return { ok: false, reason: "missing" };
    if (info.size > MAX_IMAGE_BYTES) return { ok: false, reason: "too-large" };
    return { ok: true, mime, base64: (await readFile(file)).toString("base64") };
  } catch {
    return { ok: false, reason: "missing" };
  }
}
