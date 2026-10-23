import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { darkHighlightColors, lightHighlightColors } from "@getpaseo/highlight";
import { HighlightedCode, MAX_HIGHLIGHT_CHARS, MONO_FONT_FAMILY, fenceExtension } from "../client/highlight.js";

const dark = "#0d1117";
const light = "#ffffff";

function html(code: string, info: string, surface0 = dark) {
  return renderToStaticMarkup(<HighlightedCode code={code} info={info} surface0={surface0} style={{}} />);
}

// react-native-web writes plain style objects inline; colors come out as rgba().
function rgba(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},1.00)`;
}

function keywordColor(markup: string): string | undefined {
  return /color:([^";]*)">const</.exec(markup)?.[1];
}

describe("highlighted fences", () => {
  it("maps fence info like the host", () => {
    expect(fenceExtension("typescript {1,3}")).toBe("ts");
    expect(fenceExtension(".py")).toBe("py");
    expect(fenceExtension("")).toBeNull();
  });

  it("colors keywords with the dark palette on a dark surface", () => {
    expect(keywordColor(html("const x = 1", "ts"))).toBe(rgba(darkHighlightColors.keyword));
  });

  it("picks the light palette on a light surface", () => {
    expect(keywordColor(html("const x = 1", "ts", light))).toBe(rgba(lightHighlightColors.keyword));
  });

  it("sets the host mono font on highlighted and plain code", () => {
    expect(MONO_FONT_FAMILY).toContain("SFMono-Regular");
    for (const markup of [html("const x = 1", "ts"), html("hello", "nosuchlang")]) {
      expect(markup).toContain("font-family:");
      expect(markup).not.toMatch(/font-family:(?!SFMono)/);
    }
  });

  it("skips highlighting past the host cap", () => {
    const code = "x".repeat(MAX_HIGHLIGHT_CHARS + 1);
    expect(html(code, "ts")).not.toContain("color:");
  });

  it("renders unknown languages as plain text", () => {
    expect(html("hello", "nosuchlang")).toContain(">hello<");
  });
});
