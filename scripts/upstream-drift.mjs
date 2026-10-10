import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const state = JSON.parse(readFileSync(path.join(root, "upstream-sync.json"), "utf8"));
const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const gitRaw = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const git = (cwd, ...a) => gitRaw(cwd, ...a).trim();

const sdk = path.join(root, ".paseo-sdk");
git(sdk, "fetch", "--quiet", "--filter=blob:none", state.upstream.repo, "main");
const upstreamHead = git(sdk, "rev-parse", "FETCH_HEAD");
const upstreamFrom = flag("--from-upstream") ?? state.upstream.commit;

function commits(cwd, from, to, paths) {
  const out = git(cwd, "log", "--format=%x00%H%x09%s", "--name-only", `${from}..${to}`, "--", ...paths);
  return out
    .split("\0")
    .filter(Boolean)
    .map((chunk) => {
      const [header, ...files] = chunk.trim().split("\n");
      const [sha, subject] = header.split("\t");
      return { sha, subject, files: files.filter(Boolean) };
    });
}

// Vendor entries may be whole files or an excerpt: `lines` is the 1-based inclusive slice of the upstream file,
// `headerLines` is how many leading local lines (our own comment) to skip before comparing.
const rewrite = (text) => text.replaceAll('from "@/utils/path"', 'from "./path.js"');
const vendorDrift = state.vendor.filter(({ local, upstream, lines, headerLines = 0 }) => {
  // Raw (untrimmed) so leading blank lines cannot shift the `lines` offsets.
  let want = gitRaw(sdk, "show", `${state.upstream.commit}:${upstream}`);
  if (lines) want = want.split("\n").slice(lines[0] - 1, lines[1]).join("\n");
  const have = readFileSync(path.join(root, local), "utf8").split("\n").slice(headerLines).join("\n");
  return rewrite(want).trim() !== have.trim();
});

// git grep exits 1 when nothing matches; any other failure is a real error.
function hasExtension() {
  try {
    return git(sdk, "grep", "-l", "addMarkdownExtension", upstreamHead, "--", "packages/plugin/src") !== "";
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
}

const report = {
  upstream: { from: upstreamFrom, to: upstreamHead, commits: commits(sdk, upstreamFrom, upstreamHead, state.watch) },
  vendorDrift,
  addMarkdownExtension: hasExtension(),
};

if (args.includes("--check-vendor")) process.exitCode = vendorDrift.length ? 1 : 0;
else if (args.includes("--json")) console.log(JSON.stringify(report));
else {
  const empty = !report.upstream.commits.length && !vendorDrift.length;
  console.log(empty ? "No drift." : JSON.stringify(report, null, 2));
  if (report.addMarkdownExtension) console.log("Upstream now has addMarkdownExtension: switch back to the extension-based plugin.");
}
