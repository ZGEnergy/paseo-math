# Vendored host code

Files here are verbatim copies of getpaseo/paseo at the commit in `upstream-sync.json`, with only `@/` imports rewritten to local paths. Do not edit them by hand; the drift sync recopies them. `scripts/upstream-drift.mjs --check-vendor` fails when a file differs from upstream after the rewrite.

`local-file-source.ts` is an excerpt (upstream `attachments/utils.ts` lines 145-184 behind a 3-line header comment), not a whole-file copy, because the rest of that file imports host-only modules. The vendor check compares those lines, not the whole file.
