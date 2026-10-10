import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function drift(...args: string[]) {
  return JSON.parse(
    execFileSync("node", ["scripts/upstream-drift.mjs", "--json", ...args], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }),
  );
}

// Each case fetches getpaseo/paseo and clones q5m-ai/paseo-math over the network.
describe("upstream drift report", { timeout: 60_000 }, () => {
  it("lists a known renderer change and a known base commit from older pins", () => {
    // ab10a669 (upstream 0.11.1 release) predates 73390346 "fix(ios): address clipped chat and Markdown text";
    // fa0460b (q5m-ai's first commit) predates ccfcd9a. No watched path changed between e81d5d02b1 and the pin.
    const report = drift("--from-upstream", "ab10a669", "--from-base", "fa0460b");
    const files = report.upstream.commits.flatMap((c: { files: string[] }) => c.files);
    expect(report.upstream.commits.length).toBeGreaterThan(0);
    expect(files.some((f: string) => f.startsWith("packages/"))).toBe(true);
    expect(report.base.commits.map((c: { sha: string }) => c.sha.slice(0, 7))).toContain("ccfcd9a");
  });

  it("reports no vendor drift at the recorded pin", () => {
    expect(drift().vendorDrift).toEqual([]);
  });
});
