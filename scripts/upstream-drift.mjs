// Upstream drift report: what changed in getpaseo/paseo releases since the release this plugin is pinned to.
// `npm run drift` prints a report (or `No drift.`), `--json` prints JSON, `--check-vendor` exits 1 when vendored
// files differ from the pinned commit. `--from-release <tag>` / `--to-release <tag>` override the pinned and
// latest release (tests use them to replay real history). `--daemon-version <D>` is the production daemon version;
// a signal recorded as `waiting` is raised again only when D differs from the one it waited on.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sdk = path.join(root, ".paseo-sdk");
const outDir = path.join(root, ".drift");
const MAIN_REF = "refs/remotes/upstream/main";

// Plugin SDK entry files whose exported names the report diffs between releases.
export const SDK_ENTRIES = ["index.ts", "client/index.ts", "client/react-native.ts", "client/contracts.ts", "server/index.ts"];
// Host APIs that would let the plugin hand math rendering back to the host. Their presence is an adoption signal.
export const SIGNALS = ["addMarkdownExtension", "svgXml", "markdownSource"];
const NOTE_TOPICS = /markdown|math|latex|katex|plugin|timeline|renderer|selection|copy|image|font|highlight|svg|hermes/i;

const gitRaw = (cwd, ...a) =>
  execFileSync("git", a, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
const git = (cwd, ...a) => gitRaw(cwd, ...a).trim();

// Stable releases are exactly vX.Y.Z; prereleases such as v0.12.0-beta.1 or -rc.1 never count.
const STABLE = /^v(\d+)\.(\d+)\.(\d+)$/;
export function compareReleases(a, b) {
  const [pa, pb] = [a, b].map((tag) => tag.match(STABLE).slice(1).map(Number));
  return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
}
export const stableReleases = (tags) => tags.filter((tag) => STABLE.test(tag)).sort(compareReleases);

// Regex over `export` statements, not a TypeScript parse: good enough to see names appear or disappear in an entry
// file. `export * from "./x"` is listed as `* from ./x` without expanding it; signature changes only show in the diff.
export function exportNames(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const names = new Set();
  for (const [, list] of code.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm)) {
    for (const part of list.split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  for (const [, ns, from] of code.matchAll(/^export\s+(?:type\s+)?\*(?:\s+as\s+([\w$]+))?\s+from\s+["']([^"']+)["']/gm)) {
    names.add(ns ?? `* from ${from}`);
  }
  const declaration =
    /^export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(?:const|let|var|function\*?|class|interface|type|enum|namespace)\s+([\w$]+)/gm;
  for (const [, name] of code.matchAll(declaration)) names.add(name);
  return [...names].sort();
}

// Triage state for a signal lives in upstream-sync.json `signals`: `{ state: "adopted" | "declined" }` is settled;
// `{ state: "waiting", daemon: "<D>" }` stays settled until the production daemon version changes.
export function isHandled(entry, daemonVersion) {
  if (!entry) return false;
  if (entry.state === "adopted" || entry.state === "declined") return true;
  if (entry.state === "waiting") return daemonVersion === undefined || daemonVersion === entry.daemon;
  return false;
}

// Which of `words` appear anywhere in packages/plugin/src at `ref`.
export function signalsAt(cwd, ref, words = SIGNALS) {
  let found = "";
  try {
    found = git(cwd, "grep", "-o", "-h", "-w", "-E", words.join("|"), ref, "--", "packages/plugin/src");
  } catch (error) {
    if (error.status !== 1) throw error; // git grep exits 1 when nothing matches
  }
  const hits = new Set(found.split("\n"));
  return Object.fromEntries(words.map((word) => [word, hits.has(word)]));
}

function commits(from, to, paths) {
  const out = git(sdk, "log", "--format=%x00%H%x09%s", "--name-only", `${from}..${to}`, "--", ...paths);
  return out
    .split("\0")
    .filter(Boolean)
    .map((chunk) => {
      const [header, ...files] = chunk.trim().split("\n");
      const [sha, subject] = header.split("\t");
      return { sha, subject, files: files.filter(Boolean) };
    });
}

const showOrEmpty = (ref, file) => {
  try {
    return gitRaw(sdk, "show", `${ref}:${file}`);
  } catch {
    return "";
  }
};

// Vendor entries may be whole files or an excerpt: `lines` is the 1-based inclusive slice of the upstream file,
// `headerLines` is how many leading local lines (our own comment) to skip before comparing.
const rewrite = (text) =>
  text
    .replaceAll('from "@/utils/path"', 'from "./path.js"')
    .replaceAll('from "./extensions"', 'from "./assistant-file-links-extensions.js"');
function vendorDrift(state, commit) {
  return state.vendor.filter(({ local, upstream, lines, headerLines = 0 }) => {
    // Raw (untrimmed) so leading blank lines cannot shift the `lines` offsets.
    let want = gitRaw(sdk, "show", `${commit}:${upstream}`);
    if (lines) want = want.split("\n").slice(lines[0] - 1, lines[1]).join("\n");
    const have = readFileSync(path.join(root, local), "utf8").split("\n").slice(headerLines).join("\n");
    return rewrite(want).trim() !== have.trim();
  });
}

function sdkChanges(from, to) {
  const stat = git(sdk, "diff", "--stat", from, to, "--", "packages/plugin/src");
  let diff = null;
  if (stat) {
    diff = path.join(outDir, "sdk.diff");
    writeFileSync(diff, gitRaw(sdk, "diff", from, to, "--", "packages/plugin/src"));
  }
  const exports = SDK_ENTRIES.map((file) => {
    const before = exportNames(showOrEmpty(from, `packages/plugin/src/${file}`));
    const after = exportNames(showOrEmpty(to, `packages/plugin/src/${file}`));
    return {
      file,
      added: after.filter((name) => !before.includes(name)),
      removed: before.filter((name) => !after.includes(name)),
    };
  }).filter(({ added, removed }) => added.length || removed.length);
  return { stat, diff, exports };
}

// Notes come from the GitHub release body, else the tag's CHANGELOG.md section.
function releaseNotes(repoSlug, tag) {
  let body = "";
  let source = "none";
  try {
    body = execFileSync("gh", ["release", "view", tag, "-R", repoSlug, "--json", "body", "--jq", ".body"], {
      encoding: "utf8",
      timeout: 30_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (body.trim()) source = "github";
  } catch {}
  if (source === "none") {
    const lines = showOrEmpty(tag, "CHANGELOG.md").split("\n");
    const start = lines.findIndex((line) => new RegExp(`^## \\[?${tag.slice(1).replaceAll(".", "\\.")}\\b`).test(line));
    if (start >= 0) {
      const end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
      body = lines.slice(start, end < 0 ? undefined : end).join("\n");
      source = "changelog";
    }
  }
  const file = path.join(outDir, `notes-${tag}.md`);
  writeFileSync(file, body);
  const bullets = body
    .split("\n")
    .filter((line) => /^\s*[-*]\s/.test(line) && NOTE_TOPICS.test(line))
    .map((line) => line.trim());
  return { tag, source, path: file, bullets };
}

function main() {
  const state = JSON.parse(readFileSync(path.join(root, "upstream-sync.json"), "utf8"));
  const args = process.argv.slice(2);
  const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

  // The vendor gate compares against the pinned commit and needs no network.
  if (args.includes("--check-vendor")) {
    const drift = vendorDrift(state, state.upstream.commit);
    for (const { local } of drift) console.error(`Vendored file differs from upstream ${state.upstream.release}: ${local}`);
    process.exitCode = drift.length ? 1 : 0;
    return;
  }

  git(sdk, "fetch", "--quiet", "--force", "--filter=blob:none", state.upstream.repo, `+refs/heads/main:${MAIN_REF}`, "+refs/tags/v*:refs/tags/v*");
  const commitOf = (ref) => git(sdk, "rev-parse", `${ref}^{commit}`);
  const mainCommit = commitOf(MAIN_REF);

  const pinned = flag("--from-release") ?? state.upstream.release;
  const pinnedCommit = commitOf(pinned);
  if (!flag("--from-release") && pinnedCommit !== state.upstream.commit) {
    throw new Error(`upstream-sync.json: ${pinned} is ${pinnedCommit}, but upstream.commit is ${state.upstream.commit}`);
  }
  const releases = stableReleases(git(sdk, "tag", "-l", "v*").split("\n"));
  const latest = flag("--to-release") ?? releases.at(-1);
  for (const tag of [pinned, latest]) if (!STABLE.test(tag)) throw new Error(`${tag} is not a stable release tag (vX.Y.Z)`);
  const latestCommit = commitOf(latest);
  const newer = compareReleases(latest, pinned) > 0;

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const repoSlug = new URL(state.upstream.repo).pathname.replace(/^\//, "").replace(/\.git$/, "");
  const newTags = releases.filter((tag) => compareReleases(tag, pinned) > 0 && compareReleases(tag, latest) <= 0);

  const daemonVersion = flag("--daemon-version");
  const atLatest = signalsAt(sdk, latestCommit);
  const atMain = signalsAt(sdk, mainCommit);
  const signals = Object.fromEntries(
    SIGNALS.map((word) => {
      const entry = state.signals?.[word];
      return [word, { latest: atLatest[word], main: atMain[word], triage: entry ?? null, handled: isHandled(entry, daemonVersion) }];
    }),
  );

  const report = {
    release: { pinned, pinnedCommit, latest, latestCommit, newer, daemonVersion: daemonVersion ?? null },
    ...signals,
    renderer: commits(pinnedCommit, latestCommit, state.watch),
    sdk: sdkChanges(pinnedCommit, latestCommit),
    notes: newTags.map((tag) => releaseNotes(repoSlug, tag)),
    vendorDrift: vendorDrift(state, latestCommit),
    earlyWarning: { main: mainCommit, commits: commits(latestCommit, mainCommit, state.watch) },
  };

  const pending = SIGNALS.filter((word) => signals[word].latest && !signals[word].handled);
  if (args.includes("--json")) {
    console.log(JSON.stringify(report));
    return;
  }
  // Adoption notices come first so a reader cannot stop before seeing them.
  for (const word of pending) {
    console.log(`ADOPTION SIGNAL: ${latest} has ${word} in packages/plugin/src. Triage it before anything else.`);
  }
  const noDrift = !newer && !report.vendorDrift.length && !pending.length;
  console.log(noDrift ? "No drift." : JSON.stringify(report, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
