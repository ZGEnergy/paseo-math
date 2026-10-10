// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// tsconfig has no DOM lib; type just what tests read.
const html = (element: unknown) => (element as { innerHTML: string }).innerHTML;

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

  it("re-reads the same path for a later message", async () => {
    const reads = () => rpc.mock.calls.filter(([input]) => "path" in input && input.path === "iterate.png");
    const text = "![x](iterate.png) and $a$";
    const first = render(<MathMessageView {...props(text)} timestamp={new Date(1000)} />);
    await waitFor(() => expect(html(first.container)).toContain("TESTPNG"));
    first.unmount();
    // The same message mounting again reuses the read; a newer message reads the file again.
    const remount = render(<MathMessageView {...props(text)} timestamp={new Date(1000)} />);
    await waitFor(() => expect(html(remount.container)).toContain("TESTPNG"));
    expect(reads()).toHaveLength(1);
    const later = render(<MathMessageView {...props(text)} timestamp={new Date(2000)} />);
    await waitFor(() => expect(html(later.container)).toContain("TESTPNG"));
    expect(reads()).toHaveLength(2);
  });

  it("neither re-reads nor remounts an image when streamed text is appended", async () => {
    const reads = () => rpc.mock.calls.filter(([input]) => "path" in input && input.path === "stream.png");
    const view = render(<MathMessageView {...props("![x](stream.png) and $a$", "streaming")} />);
    await waitFor(() => expect(html(view.container)).toContain("TESTPNG"));
    const before = find(view.container, 'img[src^="data:"], [style*="data:image"]');
    expect(before).toBeTruthy();
    view.rerender(<MathMessageView {...props("![x](stream.png) and $a$ more text", "streaming")} />);
    await waitFor(() => expect(view.getByText(/more text/)).toBeTruthy());
    expect(reads()).toHaveLength(1);
    expect(find(view.container, 'img[src^="data:"], [style*="data:image"]')).toBe(before);
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

  it("keeps an unclosed display formula as text while streaming", () => {
    const view = render(<MathMessageView {...props("Before $$\\int_0^1", "streaming")} />);
    expect(dom(view.container).textContent).toContain("$$\\int_0^1");
  });
});

// tsconfig has no DOM lib (raw DOM stays web-only); type just what tests read.
type Dom = { textContent: string | null; style: { color: string } };
const dom = (element: unknown) => element as Dom;

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
