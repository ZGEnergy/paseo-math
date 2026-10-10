// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// tsconfig has no DOM lib; type just what tests read.
const html = (element: unknown) => (element as { innerHTML: string }).innerHTML;

const call = vi.fn();
vi.mock("@getpaseo/plugin/client", () => ({ useRpc: () => call }));
const { AssistantImage } = await import("../client/assistant-image.js");

describe("AssistantImage", () => {
  it("loads workspace images through the plugin RPC", async () => {
    call.mockResolvedValueOnce({ ok: true, mime: "image/png", base64: "AAAA" });
    const view = render(<AssistantImage source="shots/a.png" alt="shot" workspaceRoot="/repo" />);
    await waitFor(() => expect(call).toHaveBeenCalledWith({ cwd: "/repo", path: "shots/a.png" }));
    await waitFor(() => expect(html(view.container)).toContain("data:image/png;base64,AAAA"));
  });

  it("uses web images directly", () => {
    const view = render(<AssistantImage source="https://x.test/a.png" alt="web" workspaceRoot={undefined} />);
    expect(html(view.container)).toContain("https://x.test/a.png");
  });

  it("shows alt text when a relative path has no workspace", () => {
    const view = render(<AssistantImage source="a.png" alt="no root" workspaceRoot={undefined} />);
    expect(view.getByText("no root")).toBeTruthy();
  });

  it("shows alt text when the read fails", async () => {
    call.mockResolvedValueOnce({ ok: false, reason: "missing" });
    const view = render(<AssistantImage source="b.png" alt="gone" workspaceRoot="/repo" />);
    await waitFor(() => expect(view.getByText("gone")).toBeTruthy());
  });
});
