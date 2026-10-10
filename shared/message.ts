import { z } from "zod";

export const mathMessageSchema = z.object({
  text: z.string(),
  phase: z.enum(["streaming", "complete"]),
  messageId: z.string().optional(),
});
export type MathMessage = z.infer<typeof mathMessageSchema>;
