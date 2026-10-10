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

function driftPretty(...args: string[]) {
  return execFileSync("node", ["scripts/upstream-drift.mjs", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

// Each case fetches getpaseo/paseo and clones q5m-ai/paseo-math over the network.
describe("upstream drift report", { timeout: 60_000 }, () => {
  it("lists a known renderer change and a known base commit from older pins", () => {
    // ab10a669 (upstream 0.11.1 release) predates 73390346 "fix(ios): address clipped chat and Markdown text";
    // fa0460b (q5m-ai's first commit) predates ccfcd9a. No watched path changed between e81d5d02b1 and the pin.
    const report = drift("--from-upstream", "ab10a669", "--from-base", "fa0460b");
    expect(report.upstream.commits.map((c: { sha: string }) => c.sha)).toContainEqual(
      expect.stringMatching(/^73390346/),
    );
    expect(report.base.commits.map((c: { sha: string }) => c.sha.slice(0, 7))).toContain("ccfcd9a");
  });

  it("says No drift. when only base commits are pending, and still lists them", () => {
    // The sync never merges q5m-ai commits, so base.commit does not advance; base commits alone must not
    // open a sync PR. Starting the upstream window at the current upstream head empties it, leaving only
    // base commits, and stays empty however far upstream moves after the pin.
    const head = drift().upstream.to;
    expect(driftPretty("--from-upstream", head, "--from-base", "fa0460b")).toContain("No drift.");
    const report = drift("--from-upstream", head, "--from-base", "fa0460b");
    expect(report.upstream.commits).toEqual([]);
    expect(report.base.commits.map((c: { sha: string }) => c.sha.slice(0, 7))).toContain("ccfcd9a");
  });

  it("reports no vendor drift at the recorded pin", () => {
    expect(drift().vendorDrift).toEqual([]);
  });
});
