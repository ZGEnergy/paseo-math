import { darkHighlightColors, highlightCode, lightHighlightColors, type HighlightToken } from "./generated/highlight.js";
import type { PluginTheme } from "@getpaseo/plugin";
import { useMemo } from "react";
import { Platform, Text, type TextStyle } from "react-native";

// Same cap and alias table as packages/app/src/utils/highlight-cache.ts and
// packages/app/src/components/highlighted-code-block.tsx at the pinned upstream commit.
export const MAX_HIGHLIGHT_CHARS = 100_000;
const LANGUAGE_ALIASES: Record<string, string> = {
  typescript: "ts", javascript: "js", python: "py", rust: "rs", golang: "go", "c++": "cpp",
  csharp: "cs", "c#": "cs", objc: "m", "objective-c": "m", markdown: "md", elixir: "ex",
};

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

function tokenize(code: string, ext: string | null): HighlightToken[][] | null {
  if (!ext || code.length > MAX_HIGHLIGHT_CHARS) return null;
  try {
    return highlightCode(code, `x.${ext}`);
  } catch {
    return null;
  }
}

export function HighlightedCode({
  code,
  info,
  theme,
  style,
}: {
  code: string;
  info: string | null | undefined;
  theme: PluginTheme;
  style: TextStyle | TextStyle[];
}) {
  const lines = useMemo(() => tokenize(code, fenceExtension(info)), [code, info]);
  // ponytail: host lets users pick a syntax theme; plugins cannot read it, so use light/dark defaults.
  const palette = isLight(theme.colors.surface0) ? lightHighlightColors : darkHighlightColors;
  const mono = { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" };
  if (!lines) return <Text selectable style={[style, mono]}>{code}</Text>;
  return (
    <Text selectable style={[style, mono]}>
      {lines.map((line, index) => (
        <Text key={index}>
          {line.map((token, t) =>
            token.style ? (
              <Text key={t} style={{ color: palette[token.style] }}>{token.text}</Text>
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
