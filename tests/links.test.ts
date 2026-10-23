import { Linking } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";

// Paseo injects both modules at runtime, so tests supply them.
const openExternalUrl = vi.fn(async (_url: string) => {});
vi.mock("@getpaseo/plugin/client", () => ({
  openExternalUrl: (url: string) => openExternalUrl(url),
  useRpc: () => async () => ({ ok: false, reason: "invalid" }),
}));
vi.mock("@getpaseo/plugin/client/react-native", () => ({
  Icon: () => null,
  copyText: async () => {},
  useToast: () => ({ show: () => {}, error: () => {} }),
  useRevealedText: (text: string) => text,
}));

const { openLink } = await import("../client/math-message.js");

const toast = { show: vi.fn(), error: vi.fn() };
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("openLink", () => {
  it("opens web links through the host opener", () => {
    const linking = vi.spyOn(Linking, "openURL");
    openLink("https://paseo.sh/docs", toast);
    expect(openExternalUrl).toHaveBeenCalledWith("https://paseo.sh/docs");
    expect(linking).not.toHaveBeenCalled();
  });

  it("opens mailto links with Linking", () => {
    const linking = vi.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    openLink("mailto:a@b.c", toast);
    expect(linking).toHaveBeenCalledWith("mailto:a@b.c");
    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it("refuses other schemes with a toast", () => {
    const linking = vi.spyOn(Linking, "openURL");
    for (const url of ["javascript:alert(1)", "file:///etc/passwd", "app://x", "src/app.ts"]) {
      openLink(url, toast);
    }
    expect(toast.error).toHaveBeenCalledTimes(4);
    expect(toast.error).toHaveBeenCalledWith("This link type is not supported.");
    expect(openExternalUrl).not.toHaveBeenCalled();
    expect(linking).not.toHaveBeenCalled();
  });

  it("toasts when the host opener rejects", async () => {
    openExternalUrl.mockRejectedValueOnce(new Error("blocked"));
    openLink("https://paseo.sh", toast);
    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Unable to open this link."),
    );
  });
});
