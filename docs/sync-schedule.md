# Weekly upstream sync

You maintain ZGEnergy/paseo-math, a fork of q5m-ai/paseo-math that renders LaTeX in Paseo assistant messages on upstream Paseo.

1. `git -C /home/joe/code/zge-workspace/paseo-math fetch origin main` and create a worktree at `/home/joe/code/zge-workspace/worktrees/paseo-math/sync-$(date +%F)` on a new branch `sync-$(date +%F)` from `origin/main`. Run `npm ci && npm run sdk && npm run build`.
2. Run `npm run drift`. If it prints `No drift.`, remove the worktree and stop.
3. If `base.commits` is non-empty: `git fetch https://github.com/q5m-ai/paseo-math.git main` and merge `FETCH_HEAD`. Resolve conflicts keeping both sides' intent.
4. For each `vendorDrift` entry and each `upstream.commits` entry: read the upstream diff (`git -C .paseo-sdk show <sha> -- <files>`). Recopy vendored files following `client/vendor/README.md` (import rewrite, header lines, and excerpt line ranges). Port renderer-visible changes into `client/`. Record "not applicable: <reason>" for changes that do not affect assistant markdown rendering in plugins.
5. Set `upstream.commit` to `upstream.to` and `base.commit` to `base.to` in `upstream-sync.json`. Update `scripts/sdk.mjs` `revision` to the same upstream commit and run `npm run sdk -- --update`.
6. Run `export HERMES_BIN=/home/joe/.cache/paseo-math/hermes`, then `npm run build && npm run typecheck && npm test && npm run smoke && npm run smoke:hermes && npm run drift -- --check-vendor`.
7. Open one PR to `ZGEnergy/paseo-math` `main`. Body: a table of upstream commit → plugin change or "not applicable: reason"; a list of changes worth offering to q5m-ai/paseo-math. If `addMarkdownExtension` is true, put that first.
8. If you cannot port a change confidently or a gate fails, open the PR as a draft and describe the gap. Never merge.
