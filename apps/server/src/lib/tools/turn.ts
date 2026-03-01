import { tool } from "ai";
import { z } from "zod";
import { hub } from "../hub";

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
      .default(0.5)
      .describe(
        "Motor speed from 0.0 (slowest) to 1.0 (fastest). Default 0.5."
      ),
    text: z
      .string()
      .min(1)
      .max(500)
      .describe("Brief rationale for this decision (shown in logs)."),
  }),
  execute: async ({ value, speed, text }) => {
    const result = await hub.executeAction({
      action: "turn_deg",
      value,
      speed,
      text,
    });
    return { ok: result.ok, data: result.data, error: result.error };
  },
});
