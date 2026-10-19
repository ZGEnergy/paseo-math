// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const openExternalUrl = vi.fn(async (_url: string) => {});
vi.mock("@getpaseo/plugin/client", () => ({
  useRpc: () => async () => ({ ok: false, reason: "invalid" }),
  useAgent: () => "/repo",
  openExternalUrl: (url: string) => openExternalUrl(url),
}));

const { classifyHref, isInlineCodePath } = await import("../client/links.js");
const { MathMessageView } = await import("../client/math-message.js");
const { props } = await import("./fixtures.js");

// tsconfig has no DOM lib (raw DOM stays web-only); type just what tests read.
type Dom = { closest(selector: string): unknown };
const dom = (element: unknown) => element as Dom;
declare const getComputedStyle: (element: unknown) => { color: string; textDecoration: string };

describe("link classification", () => {
  it("matches the host classifier", () => {
    expect(classifyHref("https://paseo.sh")).toBe("external");
    expect(classifyHref("mailto:a@b.c")).toBe("mailto");
    expect(classifyHref("src/app.ts:12", "/repo")).toBe("file");
    expect(classifyHref("javascript:alert(1)")).toBe("unsupported");
    expect(classifyHref("capture.png", "/repo")).toBe("file");
    expect(classifyHref("docs/my%20notes.md", "/repo")).toBe("file");
    expect(isInlineCodePath("packages/app/src/index.ts")).toBe(true);
    expect(isInlineCodePath("npm run build")).toBe(false);
  });
});

describe("links in math messages", () => {
  it("opens web links through openExternalUrl", () => {
    const view = render(<MathMessageView {...props("See [docs](https://paseo.sh) and $x$")} />);
    fireEvent.click(view.getByText("docs"));
    expect(openExternalUrl).toHaveBeenCalledWith("https://paseo.sh");
  });

  it("underlines web links only while hovered", () => {
    const view = render(<MathMessageView {...props("See [guide](https://paseo.sh) and $x$")} />);
    const text = view.getByText("guide");
    const link = dom(text).closest('[role="link"]');
    const decoration = (element: unknown) => getComputedStyle(element).textDecoration;
    expect(decoration(text)).not.toContain("underline");
    expect(decoration(link)).not.toContain("underline");
    fireEvent.mouseEnter(link as Element);
    expect(decoration(link)).toContain("underline");
    fireEvent.mouseLeave(link as Element);
    expect(decoration(link)).not.toContain("underline");
  });

  it("renders file links styled and inert", () => {
    const view = render(<MathMessageView {...props("Edit [app](src/app.ts) for $x$")} />);
    const link = view.getByText("app");
    fireEvent.click(link);
    expect(openExternalUrl).not.toHaveBeenCalledWith("src/app.ts");
    expect(dom(link).closest("a")).toBeNull();
    expect(getComputedStyle(link).color).toBe("rgb(47, 129, 247)"); // theme.colors.accent
  });

  it("colors file-looking inline code with the accent only", () => {
    const view = render(<MathMessageView {...props("Run `src/app.ts` or `npm run build` for $x$")} />);
    expect(getComputedStyle(view.getByText("src/app.ts")).color).toBe("rgb(47, 129, 247)");
    expect(getComputedStyle(view.getByText("npm run build")).color).not.toBe("rgb(47, 129, 247)");
  });
});
