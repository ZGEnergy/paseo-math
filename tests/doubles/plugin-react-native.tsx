import type { ReactNode } from "react";

export function Icon(_props: { name: string; size?: number; color?: string }): null {
  return null;
}
export async function copyText(_text: string): Promise<void> {}
export function useToast() {
  return { show: () => {}, error: () => {} };
}
// Tests that need pacing override this with vi.mock.
export function useRevealedText(text: string, _phase: "streaming" | "complete"): string {
  return text;
}
export function Modal({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
