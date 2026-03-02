import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { captureMotionSnapshots } from "@/services/motion-snapshots";
import { hub } from "../hub";

const log = createLogger("tool:turn");

const DEG_PER_SEC_AT_FULL = 90.0;

export const turnTool = tool({
  description:
    "Rotate the robot in place. Positive values turn right (clockwise), negative values turn left (counter-clockwise).",
  inputSchema: z.object({
    value: z
      .number()
      .min(-90)
      .max(90)
      .describe(
        "Rotation in degrees. Negative = left, positive = right (-90 to +90)."
      ),
    speed: z
      .number()
      .min(0)
      .max(1)
      .default(0.4)
      .describe(
        "Motor speed from 0.0 (slowest) to 1.0 (fastest). Default 0.4."
      ),
    text: z
      .string()
      .min(1)
      .max(500)
      .describe("Brief rationale for this decision (shown in logs)."),
  }),
  execute: async ({ value, speed, text }) => {
    const dir = value >= 0 ? "right" : "left";
    const effectiveSpeed = Math.max(0.05, speed);
    const durationMs = Math.round(
      (Math.abs(value) / DEG_PER_SEC_AT_FULL / effectiveSpeed) * 1000
    );
    log.info(
      { value, speed, text },
      `turn ${Math.abs(value)}° ${dir} (~${durationMs}ms)`
    );
    const [result, movementSnapshots] = await Promise.all([
      hub.executeAction({ action: "turn_deg", value, speed, text }),
      captureMotionSnapshots(durationMs, 6),
    ]);
    if (!result.ok) {
      log.error({ error: result.error }, "turn failed");
    }
    return {
      action: `turn ${value}°`,
      data: result.data,
      error: result.error,
      movementSnapshots,
      ok: result.ok,
    };
  },
});
