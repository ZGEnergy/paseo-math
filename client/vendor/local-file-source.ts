// Excerpt of getpaseo/paseo packages/app/src/attachments/utils.ts lines 145-192 at the commit in
// upstream-sync.json (decodeFilePathSource ... localFileSourceToPath), copied verbatim. The rest of that file
// imports host-only modules, so only the self-contained functions are vendored.
function decodeFilePathSource(source: string): string {
  try {
    return decodeURIComponent(source);
  } catch {
    return source;
  }
}

function normalizeWindowsDrivePath(path: string): string {
  if (!/^[A-Za-z]:[\\/]/.test(path)) {
    return path;
  }
  return path.replace(/\\/g, "/");
}

function isMarkdownEncodedWindowsDrivePath(source: string): boolean {
  return /^[A-Za-z]:(?:%5[Cc]|%2[Ff])/.test(source);
}

export function fileUriToPath(uri: string): string {
  if (!uri.startsWith("file://")) {
    return uri;
  }
  const fileSource = uri.slice("file://".length);
  const decodedPath = decodeFilePathSource(fileSource);
  if (!fileSource.startsWith("/")) {
    return `\\\\${decodedPath.replace(/\//g, "\\")}`;
  }
  return normalizeWindowsDrivePath(decodedPath.replace(/^\/([A-Za-z]:[\\/])/, "$1"));
}

export function localFileSourceToPath(
  source: string,
  // Markdown destinations are URI-encoded; plain filesystem paths are not.
  { decodeHref = false }: { decodeHref?: boolean } = {},
): string {
  if (/^(https?:|data:|blob:)/i.test(source)) {
    return source;
  }
  let path = source;
  if (source.startsWith("file://")) {
    path = fileUriToPath(source);
  } else if (decodeHref || isMarkdownEncodedWindowsDrivePath(source)) {
    path = decodeFilePathSource(source);
  }
  return normalizeWindowsDrivePath(path);
}

