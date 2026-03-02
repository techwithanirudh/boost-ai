import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { hub } from "../hub";
import { captureSnapshot, snapshotToModelOutput } from "./snapshot-output";

const log = createLogger("tool:turn");

export const turnTool = tool({
  description:
    "Rotate the robot in place using encoder-based angle control. Positive values turn right (clockwise), negative values turn left (counter-clockwise). Accurate to within a few degrees.",
  inputSchema: z.object({
    value: z
      .number()
      .min(-180)
      .max(180)
      .describe(
        "Rotation in degrees. Negative = left, positive = right. Range: -180 to +180."
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
    log.info({ value, speed, text }, `turn ${Math.abs(value)} deg ${dir}`);

    const result = await hub.executeAction({
      action: "turn_deg",
      value,
      speed,
      text,
    });

    if (!result.ok) {
      log.error({ error: result.error }, "turn failed");
    }

    const snapshot = await captureSnapshot();
    return { data: result.data, error: result.error, ok: result.ok, snapshot };
  },
  toModelOutput: ({ output }) => {
    const status = output.ok
      ? `ok (data: ${JSON.stringify(output.data)})`
      : `error: ${output.error}`;
    return snapshotToModelOutput(output.snapshot, `turn complete — ${status}`);
  },
});
