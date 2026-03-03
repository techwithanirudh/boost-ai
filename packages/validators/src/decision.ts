import { z } from "zod";

const speedSchema = z.preprocess(
  (value) =>
    typeof value === "number" ? Math.max(0, Math.min(1, value)) : value,
  z.number().min(0).max(1).default(0.5)
);

const forwardSchema = z.object({
  action: z.literal("forward_cm"),
  value: z.preprocess(
    (value) =>
      typeof value === "number" ? Math.max(5, Math.min(30, value)) : value,
    z.number()
  ),
  speed: speedSchema,
  text: z.string().min(1).max(500),
});

const backwardSchema = z.object({
  action: z.literal("backward_cm"),
  value: z.preprocess(
    (value) =>
      typeof value === "number" ? Math.max(5, Math.min(30, value)) : value,
    z.number()
  ),
  speed: speedSchema,
  text: z.string().min(1).max(500),
});

const turnSchema = z.object({
  action: z.literal("turn_deg"),
  value: z.preprocess(
    (value) =>
      typeof value === "number" ? Math.max(-3.0, Math.min(3.0, value)) : value,
    z.number()
  ),
  speed: speedSchema,
  text: z.string().min(1).max(500),
});

const stopSchema = z.object({
  action: z.literal("stop"),
  value: z.preprocess(() => 0, z.number().default(0)),
  speed: speedSchema,
  text: z.string().min(1).max(500),
});

const strikeSchema = z.object({
  action: z.literal("strike"),
  value: z.preprocess(
    (value) =>
      typeof value === "number" ? Math.max(0.1, Math.min(5.0, value)) : value,
    z.number()
  ),
  speed: speedSchema,
  text: z.string().min(1).max(500),
});

export const decisionSchema = z.discriminatedUnion("action", [
  forwardSchema,
  backwardSchema,
  turnSchema,
  stopSchema,
  strikeSchema,
]);

export type ActionDecision = z.infer<typeof decisionSchema>;
