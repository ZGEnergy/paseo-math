import { readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { ImageOutput } from "../shared/image.js";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
};

function mimeOf(file: string): string | undefined {
  return MIME[path.extname(file).toLowerCase()];
}

function within(root: string, file: string): boolean {
  return file === root || file.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

export async function readImageFile(input: { cwd: string; path: string }, home = homedir()): Promise<ImageOutput> {
  const homeRelative = input.path.startsWith("~/") || input.path.startsWith("~\\");
  const raw = homeRelative ? path.join(home, input.path.slice(2)) : input.path;
  const base = input.cwd === "~" ? home : input.cwd;
  const file = path.resolve(base, raw);
  if (!mimeOf(file)) return { ok: false, reason: "unsupported" };
  try {
    // Judge the real file, not the link: a.png -> ~/.ssh/id_rsa must not pass as an image.
    const real = await realpath(file);
    const mime = mimeOf(real);
    if (!mime) return { ok: false, reason: "unsupported" };
    // Absolute and ~ paths are allowed like the host's file preview; relative ones stay under cwd.
    if (!homeRelative && !path.isAbsolute(raw) && !within(await realpath(base), real)) {
      return { ok: false, reason: "outside" };
    }
    const info = await stat(real);
    if (!info.isFile()) return { ok: false, reason: "missing" };
    if (info.size > MAX_IMAGE_BYTES) return { ok: false, reason: "too-large" };
    return { ok: true, mime, base64: (await readFile(real)).toString("base64") };
  } catch {
    return { ok: false, reason: "missing" };
  }
}
