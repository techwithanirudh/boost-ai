import { tool } from "ai";
import { z } from "zod";
import { hub } from "../hub";

export const forwardTool = tool({
  description:
    "Move the robot forward by a specified distance. Only use when the path ahead is clear (no obstacles within 30 cm).",
  inputSchema: z.object({
    value: z
      .number()
      .min(5)
      .max(30)
      .describe("Distance to travel forward in centimetres (5–30)."),
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
      action: "forward_cm",
      value,
      speed,
      text,
    });
    return { ok: result.ok, data: result.data, error: result.error };
  },
});
