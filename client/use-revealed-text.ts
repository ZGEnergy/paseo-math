// Local adaptation of Paseo 0.11.2's paced reveal hook; see NOTICE.
// Do not import the host hook: Paseo 0.13 removed that plugin runtime export.
import { useEffect, useRef, useState } from "react";
import {
  advanceTextReveal,
  beginTextReveal,
  completeTextReveal,
  isTextRevealPacingSupported,
  isTextRevealSettled,
  nextTextRevealFrame,
  retargetTextReveal,
  visibleRevealedText,
} from "./text-reveal.js";

// Both RN and browsers provide this clock. Keep DOM types out of client code;
// runtimes without a complete clock render the full text instead.
interface FrameClock {
  requestAnimationFrame?: (callback: (timestamp: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
}

export type TextRevealPhase = "streaming" | "complete";

export function useRevealedText(text: string, phase: TextRevealPhase): string {
  const clock = globalThis as FrameClock;
  const canPace = isTextRevealPacingSupported() &&
    typeof clock.requestAnimationFrame === "function" &&
    typeof clock.cancelAnimationFrame === "function";
  const state = useRef(beginTextReveal(text));
  const [, forceRender] = useState(0);
  state.current = retargetTextReveal(state.current, text);
  // Completion must show everything on this render, not only after an effect.
  if (!canPace || phase !== "streaming") {
    state.current = completeTextReveal(state.current);
  }

  useEffect(() => {
    if (!canPace || phase !== "streaming" || isTextRevealSettled(state.current)) return;
    let previousFrame: number | null = null;
    let handle: number;
    let cancelled = false;
    const tick = (timestamp: number) => {
      if (cancelled) return;
      const frame = nextTextRevealFrame(previousFrame, timestamp);
      if (frame) {
        previousFrame = frame.frameAtMs;
        const next = advanceTextReveal(state.current, frame.elapsedMs);
        if (next !== state.current) {
          state.current = next;
          forceRender((count) => count + 1);
        }
      }
      if (!isTextRevealSettled(state.current)) {
        handle = clock.requestAnimationFrame!(tick);
      }
    };
    handle = clock.requestAnimationFrame!(tick);
    return () => {
      cancelled = true;
      clock.cancelAnimationFrame!(handle);
    };
  }, [text, phase, canPace]);

  return visibleRevealedText(state.current, { streaming: canPace && phase === "streaming" });
}
