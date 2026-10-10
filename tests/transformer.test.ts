import { describe, expect, it } from "vitest";
import { createTransformer } from "../client/transformer.js";

const transform = createTransformer((text) => text.includes("$"));

describe("assistant math transformer", () => {
  it("claims math messages and carries the phase", () => {
    const item = { type: "assistant_message", text: "Area $x^2$" } as never;
    expect(transform({ item, phase: "streaming" })).toEqual({
      items: [{ type: "plugin", kind: "math-message", version: 2, data: { text: "Area $x^2$", phase: "streaming" } }],
    });
  });

  it("leaves messages without math to the host", () => {
    const item = { type: "assistant_message", text: "plain" } as never;
    expect(transform({ item, phase: "complete" })).toBeUndefined();
  });

  it("reports the new phase for the same item object", () => {
    const item = { type: "assistant_message", text: "$y$" } as never;
    transform({ item, phase: "streaming" });
    const result = transform({ item, phase: "complete" });
    expect(result?.items[0]).toMatchObject({ data: { phase: "complete" } });
  });
});
