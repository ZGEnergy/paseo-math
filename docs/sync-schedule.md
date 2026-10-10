# Weekly upstream sync

You maintain ZGEnergy/paseo-math, an independently maintained Paseo plugin that renders LaTeX in assistant messages. Each week you check getpaseo/paseo for new stable releases, keep the plugin building and passing its gates against the latest release, and adopt host features that improve math rendering.

## Version policy

- Track stable release tags (`vX.Y.Z`) only; ignore `-beta` and `-rc` tags. `upstream-sync.json` records the pinned tag (`upstream.release`) and its commit (`upstream.commit`). `scripts/sdk.mjs` builds the SDK from that commit.
- Read the production daemon version once per run: `paseo daemon status --json | jq -r .daemonVersion`. Call it D. This is read-only; never start, stop, or restart a daemon.
- The plugin minimum (`requirements.paseo` in `paseo-plugin.json`, for example `>=0.11.0`) may be raised up to D, never beyond it, and never lowered.
- A change may use any plugin API that exists at `vD` (or the highest stable tag at or below D). Check with `git -C .paseo-sdk show v<D>:packages/plugin/src/<file>`. If a change needs a newer API, do not apply it; list it under "Upgrades available but waiting on daemon version" in the PR. Waiting items alone do not make the PR a draft.
- If D is below the current minimum, say so at the top of the PR body: the production daemon cannot load the plugin until it is upgraded.
- Re-pinning the SDK to a newer release is always allowed. It changes what the plugin is built and tested against, not what it requires.

## Rails

- Work only inside the new worktree. The primary clone `/home/joe/code/zge-workspace/paseo-math` stays on `main` and clean.
- Never start, stop, or restart any Paseo daemon (port 6767 is the production daemon). `paseo daemon status` is the only `paseo` command you run.
- Never run any upstream Paseo test suite (only this repo's `npm test`).
- Never `git stash`.
- Push only to `origin` (ZGEnergy/paseo-math).
- Every `gh` command that touches this repo passes `--repo ZGEnergy/paseo-math`. GitHub still lists this repo as a fork of another repo, so `gh`'s default repo is wrong. The drift script reads upstream release notes with `-R getpaseo/paseo`.
- Merge only the PR this run opened, and only under the self-merge policy below. Never merge any other PR, never use `--admin`, never bypass checks, never force-push, never enable auto-merge, never approve PRs.
- This plugin tracks getpaseo/paseo only. Do not fetch, read, or reference any other fork of it.
- Every npm install uses `--ignore-scripts` (`npm ci --ignore-scripts`, `npm install --ignore-scripts`), so dependency lifecycle scripts never run unattended. This repo needs none: `esbuild` ships its binary through optional platform packages, and `scripts/sdk.mjs` installs the SDK with `--ignore-scripts`.
- `npm run sdk -- --update` runs getpaseo/paseo build scripts at the new release tag unattended. The trust boundary is the upstream maintainers at that tag.
- Open the PR as a draft whenever you are unsure: a change you cannot port confidently, a change that needs a plugin API newer than D and cannot wait (such as a break fix), a gate failure, or a break you could not fix. Draft PRs are never merged.
- Failure handling: if setup or the drift report fails (steps 1-2, including network errors), stop. If nothing was committed, remove the worktree and branch and report the error in your final message. A failure from step 4 on (SDK build at the new tag, a gate) is a compatibility break: commit what you have, including the re-pin, push, and open a draft PR (step 9) that names the failing command, its error, and the upstream commit you suspect.

## Before starting

Check for an open sync PR: `gh pr list --repo ZGEnergy/paseo-math --state open --json number,headRefName,url --jq '.[] | select(.headRefName|startswith("sync-"))'`. If it prints anything, stop and report the URL instead of opening an overlapping PR.

## Steps

1. `git -C /home/joe/code/zge-workspace/paseo-math fetch origin main` and create a worktree at `/home/joe/code/zge-workspace/worktrees/paseo-math/sync-$(date +%F)` on a new branch `sync-$(date +%F)` from `origin/main`. In the worktree run `npm ci --ignore-scripts && npm run sdk && npm run build`. Read D (see Version policy).
2. Run `npm run drift`. If it prints exactly `No drift.` (no newer release, no vendor drift, no unadopted adoption signal at the latest release), remove the worktree, delete the local `sync-$(date +%F)` branch, and stop without a PR. Otherwise it prints any `ADOPTION SIGNAL:` lines first, then the JSON report. Read the signals before anything else.
3. Triage every item into **adopt**, **port**, or **not applicable**, with a one-line reason. Record each decision for the PR tables.
   - Adoption signals (`addMarkdownExtension`, `svgXml`, `markdownSource` with `latest: true` and `adopted: false`): these host APIs could let the plugin hand Markdown or math rendering back to the host. Read the API at `release.latest`, decide whether to use it, and apply the version policy. When you adopt one, add its name to `adopted` in `upstream-sync.json`.
   - `renderer` commits (watched host rendering paths between the pinned and latest release): read `git -C .paseo-sdk show <sha> -- <files>`. Port renderer-visible changes into `client/`. Release-cut commits that only bump versions are not applicable.
   - `sdk` changes: `sdk.exports` lists names added or removed per SDK entry file (a regex over `export` lines, so read `sdk.diff` for signature changes). Adopt new APIs that improve math rendering, within the version policy. A removed or changed API the plugin uses is a break: fix it.
   - `notes`: each new release's notes, filtered to rendering-related bullets; the full text is at `path`. Map each bullet to a decision.
   - `vendorDrift`: recopy each listed file following `client/vendor/README.md` (import rewrite, header lines, excerpt line ranges).
   - `earlyWarning` commits and signals with `main: true` but `latest: false` are unreleased. Do not port them. List them in the PR's early-warning section.
4. If `release.newer` is true, re-pin: set `upstream.release` to `release.latest` and `upstream.commit` to `release.latestCommit` in `upstream-sync.json`, then run `npm run sdk -- --update`. If the new release changes `@getpaseo/highlight` or `@getpaseo/plugin` versions (`git -C .paseo-sdk show <tag>:packages/plugin/package.json`), update `package.json` to match and run `npm install --ignore-scripts`. Update the pinned release named in the README Compatibility section. Re-pin even when nothing in step 3 applies: every newer release gets a full compatibility check.
5. Apply the adopt and port decisions. Raise the plugin minimum only if an adopted API requires it, and never above D.
6. Commit all changes: `git add -A && git commit -m "chore: sync upstream <release.latest>"`.
7. Run the gate: `npm run build && npm run typecheck && npm test && npm run smoke && HERMES_BIN=/home/joe/.cache/paseo-math/hermes npm run smoke:hermes && npm run drift -- --check-vendor`. Set `HERMES_BIN` inline: agent shells do not keep exports. CI does not run `smoke:hermes` (it needs a local Hermes build), so this local run is its only check. Commit any fixes the gate required. If a gate still fails, follow the failure-handling rail.
8. Push: `git push -u origin sync-$(date +%F)`.
9. Open one PR: `gh pr create --repo ZGEnergy/paseo-math --base main --head sync-$(date +%F) --title "Sync upstream <release.latest>" --body-file <file>`. Add `--draft` under the draft rail. Body, in this order:
   1. **Adoption signals**: one row per signal, with the decision and reason. Omit when there are none.
   2. **Compatibility**: pinned release before and after, gate results, D, and the plugin minimum before and after.
   3. One table per item type (renderer commits, SDK changes, release-note bullets, vendor drift), with columns Item | Decision | Reason or plugin change.
   4. **Upgrades available but waiting on daemon version**: each change that needs a Paseo version newer than D, and the version it needs.
   5. **Early warning (unreleased main)**: `earlyWarning` commits and main-only signals, one line each.
10. Self-merge, only when all of these hold:
    1. The PR is not a draft.
    2. Every local gate in step 7 passed in this run (build, typecheck, test, smoke, smoke:hermes, `drift --check-vendor`).
    3. CI on the PR is green: `gh pr checks <n> --repo ZGEnergy/paseo-math --watch --fail-fast` exits 0 and reported at least one check. No checks reported is not green. Wait at most 30 minutes.
    4. `gh pr view <n> --repo ZGEnergy/paseo-math --json mergeable,mergeStateStatus` shows it mergeable with no conflicts.

    Then run `gh pr merge <n> --repo ZGEnergy/paseo-math --merge --delete-branch`, remove the local worktree, and delete the local branch. If CI fails, times out, or reports no checks, leave the PR open, mark it draft (`gh pr ready <n> --repo ZGEnergy/paseo-math --undo`), and comment the reason (`gh pr comment <n> --repo ZGEnergy/paseo-math --body <reason>`).
