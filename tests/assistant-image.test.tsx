// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { Image } from "react-native";
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

  it("shares one RPC between components and remounts for the same source", async () => {
    call.mockResolvedValue({ ok: true, mime: "image/png", base64: "SHARED" });
    const first = render(
      <>
        <AssistantImage source="shared/s.png" alt="one" workspaceRoot="/repo" hostId="h1" />
        <AssistantImage source="shared/s.png" alt="two" workspaceRoot="/repo" hostId="h1" />
      </>,
    );
    await waitFor(() => expect(html(first.container).match(/<img[^>]*SHARED/g)).toHaveLength(2));
    first.unmount();
    const again = render(<AssistantImage source="shared/s.png" alt="one" workspaceRoot="/repo" hostId="h1" />);
    // Cached: the image is there on the first render, without another read.
    expect(html(again.container)).toContain("SHARED");
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("reads again for a different message with the same source", async () => {
    call.mockResolvedValue({ ok: true, mime: "image/png", base64: "REWRITTEN" });
    const one = render(<AssistantImage source="iter/c.png" alt="c" workspaceRoot="/repo" hostId="h" messageKey="m1" />);
    await waitFor(() => expect(html(one.container)).toContain("REWRITTEN"));
    const two = render(<AssistantImage source="iter/c.png" alt="c" workspaceRoot="/repo" hostId="h" messageKey="m2" />);
    await waitFor(() => expect(html(two.container)).toContain("REWRITTEN"));
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("does not show the previous source's image while the next one loads", async () => {
    call.mockResolvedValueOnce({ ok: true, mime: "image/png", base64: "FIRST" });
    call.mockReturnValueOnce(new Promise(() => {}));
    const view = render(<AssistantImage source="swap/a.png" alt="a" workspaceRoot="/repo" />);
    await waitFor(() => expect(html(view.container)).toContain("FIRST"));
    view.rerender(<AssistantImage source="swap/b.png" alt="b" workspaceRoot="/repo" />);
    expect(html(view.container)).not.toContain("FIRST");
  });

  it("sizes the image to its natural aspect ratio and caps its width", async () => {
    vi.spyOn(Image, "getSize").mockImplementation(((_uri: string, ok: (w: number, h: number) => void) =>
      ok(40, 20)) as typeof Image.getSize);
    call.mockResolvedValueOnce({ ok: true, mime: "image/png", base64: "SIZED" });
    const view = render(<AssistantImage source="size/s.png" alt="s" workspaceRoot="/repo" />);
    await waitFor(() => expect(html(view.container)).toContain("aspect-ratio: 2"));
    expect(html(view.container)).toContain("max-width: 40px");
  });

  it("reads file:// sources as local paths", async () => {
    call.mockResolvedValueOnce({ ok: false, reason: "missing" });
    render(<AssistantImage source="file:///abs/dir/a%20b.png" alt="f" workspaceRoot="/repo" />);
    await waitFor(() => expect(call).toHaveBeenCalledWith({ cwd: "/", path: "/abs/dir/a b.png" }));
  });
});
