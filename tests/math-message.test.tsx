// @vitest-environment jsdom
/// <reference lib="dom" />
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const revealed = vi.fn((text: string, _phase: string) => text);
vi.mock("@getpaseo/plugin/client/react-native", async (load) => ({
  ...(await load<object>()),
  useRevealedText: (text: string, phase: string) => revealed(text, phase),
}));
vi.mock("@getpaseo/plugin/client", () => ({
  useRpc: () => async () => ({ ok: false, reason: "invalid" }),
  useAgent: () => null,
  openExternalUrl: vi.fn(async () => {}),
}));

const { MathMessageView } = await import("../client/math-message.js");
const { MathErrorBoundary } = await import("../client/error-boundary.js");
const { props } = await import("./fixtures.js");

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
    expect(view.container.textContent).toContain("$$\\int_0^1");
  });
});

describe("MathErrorBoundary", () => {
  it("renders the message source when the body throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Boom(): never {
      throw new Error("render failed");
    }
    const view = render(
      <MathErrorBoundary source="Area $x^2$ and more">
        <Boom />
      </MathErrorBoundary>,
    );
    expect(view.container.textContent).toBe("Area $x^2$ and more");
  });
});
