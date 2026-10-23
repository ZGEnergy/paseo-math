import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRevealedText, type TextRevealPhase } from "../client/use-revealed-text.js";

// Exercise the real hook with React state/effects and a deterministic frame clock.
const frames = new Map<number, (timestamp: number) => void>();
let nextId: number;
let now: number;
let root: ReactTestRenderer | undefined;
let visible: string;
function Probe({ text, phase = "streaming" }: { text: string; phase?: TextRevealPhase }) {
  visible = useRevealedText(text, phase);
  return null;
}
async function render(text: string, phase: TextRevealPhase = "streaming") {
  await act(async () => {
    const element = <Probe text={text} phase={phase} />;
    if (root) root.update(element);
    else root = create(element);
  });
}
async function frame() {
  now += 17;
  const callbacks = [...frames.values()];
  frames.clear();
  await act(async () => callbacks.forEach((callback) => callback(now)));
}

beforeEach(() => {
  frames.clear();
  nextId = 0;
  now = 0;
  visible = "";
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (callback: (timestamp: number) => void) => {
    frames.set(++nextId, callback);
    return nextId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  vi.unstubAllGlobals();
});

describe("local useRevealedText", () => {
  it("shows initial history immediately and leaves no frame running", async () => {
    await render("History $x$", "complete");
    expect(visible).toBe("History $x$");
    expect(frames.size).toBe(0);
  });

  it("paces appended text across real React updates and eventually settles", async () => {
    await render("Start ");
    const target = "Start " + "more text ".repeat(30);
    await render(target);
    expect(visible).toBe("Start ");
    await frame();
    expect(visible.length).toBeGreaterThan(6);
    expect(visible.length).toBeLessThan(target.length);
    for (let i = 0; i < 100 && frames.size; i++) await frame();
    expect(visible).toBe(target);
    expect(frames.size).toBe(0);
  });

  it("retargets growing text without losing or duplicating content", async () => {
    await render("Start ");
    await render("Start " + "a".repeat(100));
    await frame();
    const previous = visible;
    const target = "Start " + "a".repeat(100) + "b".repeat(100);
    await render(target);
    expect(visible).toBe(previous);
    expect(frames.size).toBe(1);
    await render(target, "complete");
    expect(visible).toBe(target);
    expect(frames.size).toBe(0);
  });

  it("flushes a backlog when only phase changes", async () => {
    await render("A");
    const target = "A" + "x".repeat(100);
    await render(target);
    expect(visible).toBe("A");
    await render(target, "complete");
    expect(visible).toBe(target);
    expect(frames.size).toBe(0);
  });

  it("resets the position for a replacement or shortened message", async () => {
    await render("A");
    await render("A" + "x".repeat(100));
    await render("A different message");
    expect(visible).toBe("A different message");
    expect(frames.size).toBe(0);
    await render("Short");
    expect(visible).toBe("Short");
  });

  it("cancels pending work on unmount, including a stale queued callback", async () => {
    await render("A");
    await render("A" + "x".repeat(100));
    const callback = [...frames.values()][0];
    await act(async () => root!.unmount());
    root = undefined;
    expect(frames.size).toBe(0);
    callback(100);
    expect(frames.size).toBe(0);
  });

  it.each(["requestAnimationFrame", "cancelAnimationFrame"])(
    "shows full text when %s is unavailable",
    async (missing) => {
      vi.stubGlobal(missing, undefined);
      await render("A");
      await render("A whole answer");
      expect(visible).toBe("A whole answer");
      expect(frames.size).toBe(0);
    },
  );
});
