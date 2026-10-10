// Vendored verbatim from getpaseo/paseo packages/app/src/utils/path.ts.
export function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || value.startsWith("\\\\") || /^[A-Za-z]:[\\/]/.test(value);
}
