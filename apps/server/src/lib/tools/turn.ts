import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { hub } from "../hub";
import { captureSnapshot, snapshotToModelOutput } from "./snapshot-output";

const log = createLogger("tool:turn");

export const turnTool = tool({
  description:
    "Set the snake's heading (steer motor) to an absolute position and hold it. 0 = straight, positive = right, negative = left. Range: -120 to +120. Does NOT drive — call forward/backward separately, then call turn(0) to re-center once the desired distance is traveled.",
  inputSchema: z.object({
    value: z
      .number()
      .min(-120)
      .max(120)
      .describe(
        "Absolute heading position in degrees (steer motor). 0 = center/straight. Max deflection is ±120. Positive = right, negative = left."
      ),
    text: z
      .string()
      .min(1)
      .max(500)
      .describe("Brief rationale for this decision (shown in logs)."),
  }),
  execute: async ({ value, text }) => {
    log.info({ value, text }, `steer → ${value}°`);

    const result = await hub.executeAction({
      action: "turn_deg",
      value,
      speed: 0.5,
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
