// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { darkHighlightColors, lightHighlightColors } from "@getpaseo/highlight";
import { HighlightedCode, MAX_HIGHLIGHT_CHARS, MONO_FONT_FAMILY, fenceExtension } from "../client/highlight.js";
import { theme } from "./fixtures.js";

const light = { colors: { ...theme.colors, surface0: "#ffffff", foreground: "#1f2328" } };

describe("highlighted fences", () => {
  it("maps fence info like the host", () => {
    expect(fenceExtension("typescript {1,3}")).toBe("ts");
    expect(fenceExtension(".py")).toBe("py");
    expect(fenceExtension("")).toBeNull();
  });

  it("colors keywords with the dark palette on a dark surface", () => {
    const view = render(<HighlightedCode code="const x = 1" info="ts" surface0={theme.colors.surface0} style={{}} />);
    const keyword = spans(view.container).find((s) => s.textContent === "const");
    expect(keyword?.style.color).toBe(hexToRgb(darkHighlightColors.keyword));
  });

  it("sets the host mono font on every token span and on the plain fallback", () => {
    const tokens = render(<HighlightedCode code="const x = 1" info="ts" surface0={theme.colors.surface0} style={{}} />);
    const keyword = spans(tokens.container).find((s) => s.textContent === "const");
    expect(unquote(keyword?.style.fontFamily)).toBe(MONO_FONT_FAMILY);
    expect(MONO_FONT_FAMILY).toContain("SFMono-Regular");
    const plain = render(<HighlightedCode code="hello" info="nosuchlang" surface0={theme.colors.surface0} style={{}} />);
    expect(spans(plain.container).every((s) => unquote(s.style.fontFamily) === MONO_FONT_FAMILY)).toBe(true);
  });

  it("picks the light palette on a light surface", () => {
    const view = render(<HighlightedCode code="const x = 1" info="ts" surface0={light.colors.surface0} style={{}} />);
    const keyword = spans(view.container).find((s) => s.textContent === "const");
    expect(keyword?.style.color).toBe(hexToRgb(lightHighlightColors.keyword));
  });

  it("skips highlighting past the host cap", () => {
    const code = "x".repeat(MAX_HIGHLIGHT_CHARS + 1);
    const view = render(<HighlightedCode code={code} info="ts" surface0={theme.colors.surface0} style={{}} />);
    expect(spans(view.container, "span[style*='color']").length).toBe(0);
    expect((view.container as unknown as Dom).textContent).toBe(code);
  });

  it("renders unknown languages as plain text", () => {
    const view = render(<HighlightedCode code="hello" info="nosuchlang" surface0={theme.colors.surface0} style={{}} />);
    expect((view.container as unknown as Dom).textContent).toBe("hello");
  });
});

// tsconfig has no DOM lib (raw DOM stays web-only); type just what tests read.
type Dom = { textContent: string | null; style: { color: string; fontFamily: string } };
function spans(container: unknown, selector = "span"): Dom[] {
  return Array.from((container as { querySelectorAll(s: string): ArrayLike<Dom> }).querySelectorAll(selector));
}

// jsdom re-serializes quoted family names with double quotes.
function unquote(family: string | undefined): string | undefined {
  return family?.replaceAll('"', "'");
}

function hexToRgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
