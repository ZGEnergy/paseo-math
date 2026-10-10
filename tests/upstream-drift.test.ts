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

// Each case fetches getpaseo/paseo over the network.
describe("upstream drift report", { timeout: 60_000 }, () => {
  it("lists a known renderer change from an older pin", () => {
    // ab10a669 (upstream 0.11.1 release) predates 73390346 "fix(ios): address clipped chat and Markdown text".
    const report = drift("--from-upstream", "ab10a669");
    expect(report.upstream.commits.map((c: { sha: string }) => c.sha)).toContainEqual(
      expect.stringMatching(/^73390346/),
    );
    expect(report).not.toHaveProperty("base");
  });

  it("reports no vendor drift at the recorded pin", () => {
    expect(drift().vendorDrift).toEqual([]);
  });
});
