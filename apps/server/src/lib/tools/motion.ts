import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { captureMotionSnapshots } from "@/services/motion-snapshots";
import { hub } from "../hub";

const CM_PER_SEC_AT_FULL = 15.0;

function createMotionTool(
  direction: "forward" | "backward",
  hubAction: "forward_cm" | "backward_cm",
  description: string
) {
  const log = createLogger(`tool:${direction}`);
  return tool({
    description,
    inputSchema: z.object({
      value: z
        .number()
        .min(0.05)
        .max(10.0)
        .describe("Distance in metres (0.05–10.0)."),
      speed: z
        .number()
        .min(0)
        .max(1)
        .default(0.4)
        .describe("Speed 0–1. Default 0.4."),
      text: z
        .string()
        .min(1)
        .max(500)
        .describe("Brief rationale for this decision."),
    }),
    execute: async ({ value, speed, text }) => {
      const cm = Math.round(value * 100);
      const effectiveSpeed = Math.max(0.05, speed);
      const durationMs = Math.round(
        (cm / CM_PER_SEC_AT_FULL / effectiveSpeed) * 1000
      );
      log.info({ value, speed, text }, `${direction} ${value}m (~${durationMs}ms)`);
      const [result, movementSnapshots] = await Promise.all([
        hub.executeAction({ action: hubAction, value: cm, speed, text }),
        captureMotionSnapshots(durationMs, 6),
      ]);
      if (!result.ok) {
        log.error({ error: result.error }, `${direction} failed`);
      }
      return {
        action: `${direction} ${value}m`,
        data: result.data,
        error: result.error,
        movementSnapshots,
        ok: result.ok,
      };
    },
  });
}

export const forwardTool = createMotionTool(
  "forward",
  "forward_cm",
  "Move the robot forward. Use when the path ahead is clear."
);

export const backwardTool = createMotionTool(
  "backward",
  "backward_cm",
  "Move the robot backward. Use to retreat from obstacles or reposition."
);
