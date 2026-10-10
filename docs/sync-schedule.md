# Weekly upstream sync

You maintain ZGEnergy/paseo-math, a fork of q5m-ai/paseo-math that renders LaTeX in Paseo assistant messages on upstream Paseo.

## Rails

- Work only inside the new worktree. The primary clone `/home/joe/code/zge-workspace/paseo-math` stays on `main` and clean.
- Never restart or stop the Paseo daemon on port 6767.
- Never run any upstream Paseo test suite (only this repo's `npm test`).
- Never `git stash`.
- Push only to `origin` (ZGEnergy/paseo-math). Never push to, or open PRs or issues against, the `q5m` remote or q5m-ai/paseo-math. Offerings for q5m-ai go only in the PR body.
- Never merge the PR, never enable auto-merge, never approve PRs.
- If any command fails before the PR step (`npm ci`, `npm run sdk`, `npm run build`, `npm run drift` including network errors), stop. If nothing was committed, remove the worktree and branch and report the error in your final message. If work was committed, push and open a draft PR (step 9) describing the failure.

## Steps

1. `git -C /home/joe/code/zge-workspace/paseo-math fetch origin main` and create a worktree at `/home/joe/code/zge-workspace/worktrees/paseo-math/sync-$(date +%F)` on a new branch `sync-$(date +%F)` from `origin/main`. In the worktree run `npm ci && npm run sdk && npm run build`.
2. Run `npm run drift`. If it prints `No drift.`, remove the worktree, delete the local `sync-$(date +%F)` branch, and stop.
3. If `base.commits` is non-empty: `git fetch https://github.com/q5m-ai/paseo-math.git main` and merge `FETCH_HEAD`. Resolve conflicts keeping both sides' intent.
4. For each `vendorDrift` entry and each `upstream.commits` entry: read the upstream diff (`git -C .paseo-sdk show <sha> -- <files>`). Recopy vendored files following `client/vendor/README.md` (import rewrite, header lines, and excerpt line ranges). Port renderer-visible changes into `client/`. Record "not applicable: <reason>" for changes that do not affect assistant markdown rendering in plugins.
5. Set `upstream.commit` to `upstream.to` and `base.commit` to `base.to` in `upstream-sync.json`. Update `scripts/sdk.mjs` `revision` to the same upstream commit and run `npm run sdk -- --update`. If the new upstream commit changes dependency versions (for example `@getpaseo/highlight`, the `@getpaseo/plugin` devDependency, or the manifest `paseo` range in `paseo-plugin.json`), update `package.json`, the lockfile (`npm install`), and the manifest to match.
6. Commit all changes: `git add -A && git commit -m "chore: sync upstream <short upstream.to> and base <short base.to>"`.
7. Run `export HERMES_BIN=/home/joe/.cache/paseo-math/hermes`, then `npm run build && npm run typecheck && npm test && npm run smoke && npm run smoke:hermes && npm run drift -- --check-vendor`. Commit any fixes the gate required.
8. Push: `git push -u origin sync-$(date +%F)`.
9. Open one PR: `gh pr create --repo ZGEnergy/paseo-math --base main --head sync-$(date +%F) --title "Sync upstream <short upstream.to>" --body-file <file>`. Body: a table of upstream commit → plugin change or "not applicable: reason"; a list of changes worth offering to q5m-ai/paseo-math. If `addMarkdownExtension` is true, put that first. Add `--draft` if you cannot port a change confidently or a gate fails, and describe the gap in the body.
