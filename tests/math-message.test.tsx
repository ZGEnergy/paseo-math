// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// tsconfig has no DOM lib; type just what tests read.
const html = (element: unknown) => (element as { innerHTML: string }).innerHTML;
declare const getComputedStyle: (element: unknown) => unknown;

const revealed = vi.fn((text: string, _phase: string) => text);
vi.mock("@getpaseo/plugin/client/react-native", async (load) => ({
  ...(await load<object>()),
  useRevealedText: (text: string, phase: string) => revealed(text, phase),
}));
const rpc = vi.fn(async (input: object) =>
  "path" in input
    ? { ok: true, mime: "image/png", base64: "TESTPNG" }
    : { ok: false, reason: "invalid" },
);
// A rule (not a child component) throws for one sentinel inline-code path, to exercise the boundary.
vi.mock("../client/links.js", async (load) => {
  const actual = await load<typeof import("../client/links.js")>();
  return {
    ...actual,
    isInlineCodePath: (text: string) => {
      if (text === "BOOM_RULE_SENTINEL") throw new Error("rule failed");
      return actual.isInlineCodePath(text);
    },
  };
});
vi.mock("@getpaseo/plugin/client", () => ({
  useRpc: () => rpc,
  useAgent: () => "/repo",
  openExternalUrl: vi.fn(async () => {}),
}));

const { MathMessageView } = await import("../client/math-message.js");
const { MathErrorBoundary } = await import("../client/error-boundary.js");
const { props } = await import("./fixtures.js");

describe("MathMessageView local images", () => {
  const find = (container: unknown, selector: string) =>
    (container as { querySelector(s: string): unknown }).querySelector(selector);

  it("reads file:// image sources through the RPC", async () => {
    render(<MathMessageView {...props("![x](file:///abs/fileuri.png) and $x$")} />);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith({ cwd: "/", path: "/abs/fileuri.png" }));
  });

  it("keeps file:// links inert", () => {
    const view = render(<MathMessageView {...props("See [doc](file:///abs/notes.md) and $x$")} />);
    expect(find(view.container, "a")).toBeNull();
    expect(view.getByText("doc")).toBeTruthy();
  });

  it("renders inline code in the host mono font", () => {
    const view = render(<MathMessageView {...props("Use `src/index.ts` and `x + 1` with $x$")} />);
    const code = (view.getByText("x + 1") as unknown as { style: { fontFamily: string } });
    expect(code.style.fontFamily).toContain("SFMono-Regular");
    const path = (view.getByText("src/index.ts") as unknown as { style: { fontFamily: string } });
    expect(path.style.fontFamily).toContain("SFMono-Regular");
  });

  const reads = (name: string) =>
    rpc.mock.calls.filter(([input]) => "path" in input && input.path === name);

  it("reads once while streamed chunks advance the timestamp", async () => {
    const view = render(<MathMessageView {...props("![x](ticks.png) and $a$", "streaming")} timestamp={new Date(1000)} />);
    await waitFor(() => expect(html(view.container)).toContain("TESTPNG"));
    const before = find(view.container, '[style*="data:image"]');
    expect(before).toBeTruthy();
    view.rerender(<MathMessageView {...props("![x](ticks.png) and $a$ more", "streaming")} timestamp={new Date(1500)} />);
    view.rerender(<MathMessageView {...props("![x](ticks.png) and $a$ more words", "streaming")} timestamp={new Date(2000)} />);
    await waitFor(() => expect(view.getByText(/more words/)).toBeTruthy());
    expect(reads("ticks.png")).toHaveLength(1);
    expect(find(view.container, '[style*="data:image"]')).toBe(before);
  });

  it("reuses the read for a remount of the same messageId with a new timestamp", async () => {
    const text = "![x](same-id.png) and $a$";
    const first = render(<MathMessageView {...props(text, "complete", "m1")} timestamp={new Date(1000)} />);
    await waitFor(() => expect(html(first.container)).toContain("TESTPNG"));
    first.unmount();
    const remount = render(<MathMessageView {...props(text, "complete", "m1")} timestamp={new Date(9000)} />);
    await waitFor(() => expect(html(remount.container)).toContain("TESTPNG"));
    expect(reads("same-id.png")).toHaveLength(1);
  });

  it("re-reads the same path for a different message", async () => {
    const text = "![x](iterate.png) and $a$";
    const first = render(<MathMessageView {...props(text, "complete", "m1")} />);
    await waitFor(() => expect(html(first.container)).toContain("TESTPNG"));
    const later = render(<MathMessageView {...props(text, "complete", "m2")} />);
    await waitFor(() => expect(html(later.container)).toContain("TESTPNG"));
    expect(reads("iterate.png")).toHaveLength(2);
  });

  it("neither re-reads nor remounts an image when streamed text is appended", async () => {
    const view = render(<MathMessageView {...props("![x](stream.png) and $a$", "streaming")} />);
    await waitFor(() => expect(html(view.container)).toContain("TESTPNG"));
    const before = find(view.container, '[style*="data:image"]');
    expect(before).toBeTruthy();
    view.rerender(<MathMessageView {...props("![x](stream.png) and $a$ more text", "streaming")} />);
    await waitFor(() => expect(view.getByText(/more text/)).toBeTruthy());
    expect(reads("stream.png")).toHaveLength(1);
    expect(find(view.container, '[style*="data:image"]')).toBe(before);
  });
});

describe("MathMessageView images", () => {
  it("renders markdown images through AssistantImage", () => {
    const view = render(<MathMessageView {...props("![chart](https://x.test/c.png) and $x$")} />);
    expect(html(view.container)).toContain("https://x.test/c.png");
  });
});

describe("MathMessageView pacing", () => {
  it("passes the phase to useRevealedText", () => {
    render(<MathMessageView {...props("Area $x$", "streaming")} />);
    expect(revealed).toHaveBeenLastCalledWith("Area $x$", "streaming");
  });

  it("re-renders when only phase changes", () => {
    const view = render(<MathMessageView {...props("Area $x$", "streaming")} />);
    view.rerender(<MathMessageView {...props("Area $x$", "complete")} />);
    expect(revealed).toHaveBeenLastCalledWith("Area $x$", "complete");
  });

  it("keeps an unclosed display formula as text while streaming, then renders it once closed", async () => {
    const view = render(<MathMessageView {...props("Before $$\\int_0^1", "streaming")} />);
    const query = view.container as unknown as { querySelector(s: string): unknown };
    expect(dom(view.container).textContent).toContain("$$\\int_0^1");
    expect(query.querySelector("[data-q5m-math]")).toBeNull();
    expect(rpc).not.toHaveBeenCalledWith(expect.objectContaining({ expression: "\\int_0^1 x\\,dx" }));

    view.rerender(<MathMessageView {...props("Before $$\\int_0^1 x\\,dx$$", "streaming")} />);
    // The Formula component now owns the span: the math wrapper carries the TeX and Formula asked the RPC to render it.
    expect(query.querySelector("[data-q5m-math]")).toBeTruthy();
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith(
        expect.objectContaining({ expression: "\\int_0^1 x\\,dx", display: true }),
      ),
    );
  });
});

describe("MathMessageView selection copy", () => {
  type Win = {
    getSelection(): { removeAllRanges(): void; addRange(range: unknown): void };
    document: {
      createRange(): { selectNodeContents(node: unknown): void };
      createEvent(type: string): { clipboardData?: unknown } & object;
    };
  };
  const win = globalThis as unknown as Win;
  type Query = {
    querySelector(s: string): { dispatchEvent(e: object): boolean } | null;
    querySelectorAll(s: string): ArrayLike<{ getAttribute(n: string): string | null }>;
  };

  it("marks top-level blocks with source lines and formulas with their TeX", () => {
    const view = render(<MathMessageView {...props("# Title\n\nArea is $x^2$ here.\n\n- one\n- two")} />);
    const container = view.container as unknown as Query;
    const lines = Array.from(container.querySelectorAll("[data-q5m-lines]")).map((e) =>
      e.getAttribute("data-q5m-lines"),
    );
    expect(lines).toEqual(["0:1", "2:3", "4:6"]);
    const math = Array.from(container.querySelectorAll("[data-q5m-math]")).map((e) =>
      e.getAttribute("data-q5m-math"),
    );
    expect(math).toEqual(["$x^2$"]);
  });

  it("separates top-level blocks with one gap that grows off compact layouts", () => {
    const gapOf = (compact: boolean) => {
      const view = render(
        <MathMessageView {...{ ...props("# Title\n\nArea is $x^2$.\n\n- one"), layout: { compact, platform: "web" as const } }} />,
      );
      const block = (view.container as unknown as Query).querySelector("[data-q5m-lines]") as unknown as {
        parentElement: unknown;
      };
      const style = getComputedStyle(block.parentElement as never) as unknown as {
        getPropertyValue(name: string): string;
      };
      view.unmount();
      return style.getPropertyValue("row-gap") || style.getPropertyValue("gap");
    };
    expect(gapOf(true)).toBe("12px");
    expect(gapOf(false)).toBe("16px");
  });

  it("scrolls wide tables sideways", () => {
    const view = render(<MathMessageView {...props("| a | b |\n|---|---|\n| 1 | 2 |\n\nwith $x$")} />);
    const all = Array.from(
      (view.container as unknown as { querySelectorAll(s: string): ArrayLike<unknown> }).querySelectorAll("*"),
    ) as Array<{ textContent: string | null }>;
    const scroller = all.find(
      (element) =>
        /^(auto|scroll)$/.test((getComputedStyle(element as never) as unknown as { overflowX: string }).overflowX) &&
        element.textContent?.includes("1"),
    );
    expect(scroller).toBeTruthy();
  });

  it("puts markdown on the clipboard for a selection inside the row and prevents default", () => {
    const view = render(<MathMessageView {...props("Area is $x^2$ here.")} />);
    const block = (view.container as unknown as Query).querySelector("[data-q5m-lines]")!;
    const range = win.document.createRange();
    range.selectNodeContents(block);
    const selection = win.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const set = vi.fn();
    const event = win.document.createEvent("Event") as { clipboardData?: unknown } & Event;
    event.initEvent("copy", true, true);
    event.clipboardData = { setData: set };
    block.dispatchEvent(event);
    expect(set).toHaveBeenCalledWith("text/plain", "Area is $x^2$ here.");
    expect(event.defaultPrevented).toBe(true);
  });
});

// tsconfig has no DOM lib (raw DOM stays web-only); type just what tests read.
type Dom = { textContent: string | null; style: { color: string } };
const dom = (element: unknown) => element as Dom;

describe("MathMessageView render failures", () => {
  afterEach(() => vi.restoreAllMocks());

  it("falls back to the themed raw source when a render rule throws", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const source = "Use `BOOM_RULE_SENTINEL` with $x$";
    const view = render(<MathMessageView {...props(source)} />);
    const text = view.getByText(source);
    expect(dom(text).style.color).toBe("rgb(230, 237, 243)");
    expect(dom(view.container).textContent).toContain(source);
    expect(error).toHaveBeenCalled();
  });
});

describe("MathErrorBoundary", () => {
  const style = { color: "#e6edf3", fontSize: 16, lineHeight: 24 };
  function Boom(): never {
    throw new Error("render failed");
  }
  afterEach(() => vi.restoreAllMocks());

  it("renders the themed message source when the body throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = render(
      <MathErrorBoundary source="Area $x^2$ and more" {...style}>
        <Boom />
      </MathErrorBoundary>,
    );
    const text = view.getByText("Area $x^2$ and more");
    expect(dom(text).style.color).toBe("rgb(230, 237, 243)");
  });

  it("recovers when the source changes", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const view = render(
      <MathErrorBoundary source="A $" {...style}>
        <Boom />
      </MathErrorBoundary>,
    );
    expect(dom(view.container).textContent).toBe("A $");
    view.rerender(
      <MathErrorBoundary source="A $x$" {...style}>
        <span>ok</span>
      </MathErrorBoundary>,
    );
    expect(dom(view.container).textContent).toBe("ok");
  });
});
