import type { PluginClientContext } from "@getpaseo/plugin/client";

function setupPlugin(client: PluginClientContext) {
  // Keep client dependencies lazy so an Android evaluation failure includes the
  // dependency stack in the plugin status instead of only its final message.
  const { MathMessageView } = require("./client/math-message.js") as typeof import("./client/math-message.js");
  const { hasMath } = require("./client/generated/markdown.js") as typeof import("./client/generated/markdown.js");
  const { mathMessageSchema } = require("./shared/message.js") as typeof import("./shared/message.js");
  const { createTransformer } = require("./client/transformer.js") as typeof import("./client/transformer.js");
  const transform = createTransformer(hasMath);
  client.addTimelineRenderer({
    kind: "math-message",
    version: 2,
    schema: mathMessageSchema,
    Component: MathMessageView,
  });
  client.addTimelineTransformer({
    id: "assistant-math",
    query: { itemType: "assistant_message" },
    transform,
  });
  return () => transform.clear();
}

export default function setup(client: PluginClientContext) {
  try {
    return setupPlugin(client);
  } catch (error) {
    const detail =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    throw new Error(`q5m-math client initialization failed:\n${detail}`);
  }
}
