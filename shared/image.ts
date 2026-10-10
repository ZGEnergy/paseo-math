import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const imageInput = z.object({ cwd: z.string().min(1).max(4096), path: z.string().min(1).max(4096) });
export const imageOutput = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), mime: z.string(), base64: z.string() }),
  z.object({ ok: z.literal(false), reason: z.enum(["unsupported", "too-large", "missing", "outside"]) }),
]);
export const readImage = defineRpc({ name: "math.image", input: imageInput, output: imageOutput });
export type ImageOutput = z.infer<typeof imageOutput>;
