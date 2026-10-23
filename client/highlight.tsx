import type { HighlightToken } from "./generated/highlight.js";
import { useMemo } from "react";
import { Platform, Text, type TextStyle } from "react-native";

// Same cap and alias table as packages/app/src/utils/highlight-cache.ts and
// packages/app/src/components/highlighted-code-block.tsx at the pinned upstream commit.
export const MAX_HIGHLIGHT_CHARS = 100_000;
const LANGUAGE_ALIASES: Record<string, string> = {
  typescript: "ts", javascript: "js", python: "py", rust: "rs", golang: "go", "c++": "cpp",
  csharp: "cs", "c#": "cs", objc: "m", "objective-c": "m", markdown: "md", elixir: "ex",
};

// Same stack as DEFAULT_MONO_FONT_STACK in packages/app/src/styles/theme.ts. RN-web nested Text
// spans do not inherit fontFamily from the outer Text, so set it on every code Text.
export const MONO_FONT_FAMILY: string = Platform.select({
  ios: "ui-monospace",
  web: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  default: "monospace",
});

export function fenceExtension(info: string | null | undefined): string | null {
  const first = info?.trim().split(/\s+/)[0]?.toLowerCase();
  if (!first) return null;
  const normalized = first.replace(/^\./, "");
  return LANGUAGE_ALIASES[normalized] ?? normalized;
}

function isLight(hex: string): boolean {
  const n = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140;
}

// The generated module is ~1.4MB; require it on first use so plugin load does not evaluate it.
let highlighter: typeof import("./generated/highlight.js") | undefined;
function loadHighlighter() {
  return (highlighter ??= require("./generated/highlight.js") as typeof import("./generated/highlight.js"));
}

function tokenize(code: string, ext: string | null): HighlightToken[][] | null {
  if (!ext || code.length > MAX_HIGHLIGHT_CHARS) return null;
  try {
    return loadHighlighter().highlightCode(code, `x.${ext}`);
  } catch {
    return null;
  }
}

export function HighlightedCode({
  code,
  info,
  surface0,
  style,
}: {
  code: string;
  info: string | null | undefined;
  surface0: string;
  style: TextStyle | TextStyle[];
}) {
  const lines = useMemo(() => tokenize(code, fenceExtension(info)), [code, info]);
  const mono = { fontFamily: MONO_FONT_FAMILY };
  if (!lines) return <Text selectable style={[style, mono]}>{code}</Text>;
  // The host lets users pick a syntax theme; plugins cannot read it, so use light/dark defaults.
  const { darkHighlightColors, lightHighlightColors } = loadHighlighter();
  const palette = isLight(surface0) ? lightHighlightColors : darkHighlightColors;
  return (
    <Text selectable style={[style, mono]}>
      {lines.map((line, index) => (
        <Text key={index} style={mono}>
          {line.map((token, t) =>
            token.style ? (
              <Text key={t} style={[mono, { color: palette[token.style] }]}>{token.text}</Text>
            ) : (
              token.text
            ),
          )}
          {index < lines.length - 1 ? "\n" : null}
        </Text>
      ))}
    </Text>
  );
}
