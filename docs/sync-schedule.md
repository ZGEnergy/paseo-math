# Weekly upstream sync

You maintain ZGEnergy/paseo-math, an independently maintained fork that renders LaTeX in Paseo assistant messages on upstream Paseo.

## Rails

- Work only inside the new worktree. The primary clone `/home/joe/code/zge-workspace/paseo-math` stays on `main` and clean.
- Never restart or stop the Paseo daemon on port 6767.
- Never run any upstream Paseo test suite (only this repo's `npm test`).
- Never `git stash`.
- Push only to `origin` (ZGEnergy/paseo-math).
- Never merge the PR, never enable auto-merge, never approve PRs.
- This fork tracks getpaseo/paseo only; do not fetch, read, or reference q5m-ai/paseo-math.
- Every npm install uses `--ignore-scripts` (`npm ci --ignore-scripts`, `npm install --ignore-scripts`), so dependency lifecycle scripts never run unattended. This repo needs none: `esbuild` ships its binary through optional platform packages, and `scripts/sdk.mjs` already installs the SDK with `--ignore-scripts`.
- Ported changes may only use plugin APIs available at the minimum Paseo version in `paseo-plugin.json` (`requirements.paseo`). Never raise that range in a sync. If a change needs a newer API, do not port it: describe it in the PR body and open the PR as a draft.
- `npm run sdk -- --update` runs getpaseo/paseo build scripts at the new pin unattended. The trust boundary is the upstream maintainers at that commit.
- If any command fails before the PR step (`npm ci`, `npm run sdk`, `npm run build`, `npm run drift` including network errors), stop. If nothing was committed, remove the worktree and branch and report the error in your final message. If work was committed, push and open a draft PR (step 8) describing the failure.

## Before starting

Check for an open sync PR: `gh pr list --repo ZGEnergy/paseo-math --state open --json number,headRefName,url --jq '.[] | select(.headRefName|startswith("sync-"))'`. If it prints anything, stop and report the URL instead of opening an overlapping PR.

## Steps

1. `git -C /home/joe/code/zge-workspace/paseo-math fetch origin main` and create a worktree at `/home/joe/code/zge-workspace/worktrees/paseo-math/sync-$(date +%F)` on a new branch `sync-$(date +%F)` from `origin/main`. In the worktree run `npm ci --ignore-scripts && npm run sdk && npm run build`.
2. Run `npm run drift`. If it prints `No drift.` (no upstream commits and no vendor drift), remove the worktree, delete the local `sync-$(date +%F)` branch, and stop without a PR.
3. For each `vendorDrift` entry and each `upstream.commits` entry: read the upstream diff (`git -C .paseo-sdk show <sha> -- <files>`). Recopy vendored files following `client/vendor/README.md` (import rewrite, header lines, and excerpt line ranges). Port renderer-visible changes into `client/`. Record "not applicable: <reason>" for changes that do not affect assistant markdown rendering in plugins. Before porting, check that each plugin API the change uses exists at the manifest minimum: `git -C .paseo-sdk show v<minimum>:packages/plugin/src/<file>` (for `>=0.11.0`, tag `v0.11.0`). If it does not, apply the API rule in Rails.
4. Set `upstream.commit` to `upstream.to` in `upstream-sync.json`. Update `scripts/sdk.mjs` `revision` to the same upstream commit and run `npm run sdk -- --update`. If the new upstream commit changes dependency versions (for example `@getpaseo/highlight` or the `@getpaseo/plugin` devDependency), update `package.json` and the lockfile (`npm install --ignore-scripts`) to match. Leave the manifest `paseo` range as is.
5. Commit all changes: `git add -A && git commit -m "chore: sync upstream <short upstream.to>"`.
6. Run `npm run build && npm run typecheck && npm test && npm run smoke && HERMES_BIN=/home/joe/.cache/paseo-math/hermes npm run smoke:hermes && npm run drift -- --check-vendor`. Set `HERMES_BIN` inline: agent shells do not keep exports. Commit any fixes the gate required.
7. Push: `git push -u origin sync-$(date +%F)`.
8. Open one PR: `gh pr create --repo ZGEnergy/paseo-math --base main --head sync-$(date +%F) --title "Sync upstream <short upstream.to>" --body-file <file>`. Body: a table of upstream commit → plugin change or "not applicable: reason". If `addMarkdownExtension` is true, put that first. Add `--draft` if you cannot port a change confidently, a change needs a plugin API newer than the manifest minimum, or a gate fails, and describe the gap in the body.
