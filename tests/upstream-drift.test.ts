import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportNames, signalsAt, stableReleases } from "../scripts/upstream-drift.mjs";

const state = JSON.parse(readFileSync("upstream-sync.json", "utf8"));

function run(...args: string[]) {
  return execFileSync("node", ["scripts/upstream-drift.mjs", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}
const drift = (...args: string[]) => JSON.parse(run("--json", ...args));

describe("release helpers", () => {
  it("picks the highest stable release and ignores prereleases", () => {
    const tags = ["v0.11.10", "v0.12.0-beta.1", "v0.11.9", "v0.12.0-rc.1", "v0.11.2", "latest", ""];
    expect(stableReleases(tags)).toEqual(["v0.11.2", "v0.11.9", "v0.11.10"]);
  });

  it("lists exported names from export statements", () => {
    const source = [
      "// export const commented = 1;",
      "export type {\n  A,\n  B as C,\n} from './a.js';",
      "export { d, type E } from './d.js';",
      "export * from './star.js';",
      "export declare function f(): void;",
      "export interface G {}",
      "export const h = 1;",
    ].join("\n");
    expect(exportNames(source)).toEqual(["* from ./star.js", "A", "C", "E", "G", "d", "f", "h"]);
  });

  it("detects adoption signals in a plugin source tree", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "drift-signal-"));
    try {
      const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: repo });
      git("init", "--quiet");
      mkdirSync(path.join(repo, "packages/plugin/src"), { recursive: true });
      writeFileSync(path.join(repo, "packages/plugin/src/index.ts"), "export declare function addMarkdownExtension(): void;\n");
      git("add", ".");
      git("commit", "--quiet", "-m", "fixture");
      expect(signalsAt(repo, "HEAD")).toEqual({ addMarkdownExtension: true, svgXml: false, markdownSource: false });
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

// Each case fetches getpaseo/paseo over the network.
describe("upstream drift report", { timeout: 120_000 }, () => {
  it("reports the latest stable release, never a prerelease", () => {
    const { release } = drift();
    expect(release.pinned).toBe(state.upstream.release);
    expect(release.latest).toMatch(/^v\d+\.\d+\.\d+$/);
    const tags = execFileSync("git", ["tag", "-l", "v*"], { cwd: ".paseo-sdk", encoding: "utf8" }).split("\n");
    expect(release.latest).toBe(stableReleases(tags).at(-1));
  });

  it("lists renderer commits and release notes between v0.11.0 and v0.11.2", () => {
    const report = drift("--from-release", "v0.11.0", "--to-release", "v0.11.2");
    expect(report.release).toMatchObject({ pinned: "v0.11.0", latest: "v0.11.2", newer: true });
    // ab10a669 "chore(release): cut 0.11.1" bumps packages/highlight, a watched path.
    expect(report.renderer.map((c: { sha: string }) => c.sha)).toContainEqual(expect.stringMatching(/^ab10a669/));
    // The plugin SDK did not change between these releases.
    expect(report.sdk).toEqual({ stat: "", diff: null, exports: [] });
    expect(report.notes.map((n: { tag: string }) => n.tag)).toEqual(["v0.11.1", "v0.11.2"]);
    const notes = report.notes.find((n: { tag: string }) => n.tag === "v0.11.2");
    expect(notes.bullets).toContainEqual(expect.stringContaining("Markdown previews"));
    expect(readFileSync(notes.path, "utf8")).toContain("0.11.2");
  });

  it("diffs plugin SDK exports between v0.10.3 and v0.11.0, where no adoption signal exists", () => {
    const report = drift("--from-release", "v0.10.3", "--to-release", "v0.11.0");
    const contracts = report.sdk.exports.find((e: { file: string }) => e.file === "client/contracts.ts");
    expect(contracts.added).toContain("PluginScreenParams");
    expect(report.sdk.stat).toContain("packages/plugin/src/client/contracts.ts");
    expect(readFileSync(report.sdk.diff, "utf8")).toContain("PluginScreenParams");
    expect(report.addMarkdownExtension.latest).toBe(false);
  });

  it("prints No drift. at the pinned release with no signals", () => {
    expect(run("--to-release", state.upstream.release).trim()).toBe("No drift.");
  });

  it("reports no vendor drift at the recorded pin", () => {
    expect(drift("--to-release", state.upstream.release).vendorDrift).toEqual([]);
  });
});
