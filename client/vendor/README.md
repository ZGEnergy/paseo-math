# Vendored host code

Files here are copies of getpaseo/paseo at the pinned release in `upstream-sync.json` (`upstream.release`, commit `upstream.commit`). Do not edit them by hand; the drift sync recopies them. `scripts/upstream-drift.mjs --check-vendor` fails when a file differs from upstream after the rules below.

Each entry in the `vendor` list of `upstream-sync.json` is one of:

- Whole file: the upstream file with only `from "@/utils/path"` rewritten to `from "./path.js"`. `path.ts` also carries one leading comment line (`"headerLines": 1`) that the check skips.
- Excerpt (`"lines": [start, end]`): `local-file-source.ts` is upstream `attachments/utils.ts` lines 145-184 behind a 3-line header comment (`"headerLines": 3`), copied byte-identical. The rest of that file imports host-only modules. The check compares only those upstream lines with the local file minus its header lines.

To recopy at a new pin: set `upstream.release` and `upstream.commit`, copy each file or line range from `git -C .paseo-sdk show <commit>:<upstream path>`, reapply the import rewrite and header, and update `lines` if the excerpt moved. Then run `npm run drift -- --check-vendor`.
