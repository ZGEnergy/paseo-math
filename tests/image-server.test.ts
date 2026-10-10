import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, readImageFile } from "../server/image.js";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
let dir = "";

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "q5m-image-"));
  await writeFile(path.join(dir, "dot.png"), PNG);
  await writeFile(path.join(dir, "notes.txt"), "hi");
  await writeFile(path.join(dir, "huge.png"), Buffer.alloc(MAX_IMAGE_BYTES + 1));
});

describe("readImageFile", () => {
  it("reads a relative PNG under cwd", async () => {
    const result = await readImageFile({ cwd: dir, path: "dot.png" });
    expect(result).toEqual({ ok: true, mime: "image/png", base64: PNG.toString("base64") });
  });

  it("expands home-relative paths", async () => {
    const result = await readImageFile({ cwd: "~", path: "~/dot.png" }, dir);
    expect(result.ok).toBe(true);
  });

  it("rejects non-image extensions", async () => {
    expect(await readImageFile({ cwd: dir, path: "notes.txt" })).toEqual({ ok: false, reason: "unsupported" });
  });

  it("rejects files over the size cap", async () => {
    expect(await readImageFile({ cwd: dir, path: "huge.png" })).toEqual({ ok: false, reason: "too-large" });
  });

  it("reports missing files", async () => {
    expect(await readImageFile({ cwd: dir, path: "gone.png" })).toEqual({ ok: false, reason: "missing" });
  });
});
