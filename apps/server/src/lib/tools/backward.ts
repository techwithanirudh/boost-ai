import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { hub } from "../hub";

const log = createLogger("tool:backward");

export const backwardTool = tool({
  description:
    "Move the robot backward by a specified distance. Use to retreat from obstacles or reposition.",
  inputSchema: z.object({
    value: z
      .number()
      .min(5)
      .max(30)
      .describe("Distance to travel backward in centimetres (5–30)."),
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
    log.info({ value, speed, text }, `backward ${value}cm`);
    const result = await hub.executeAction({
      action: "backward_cm",
      value,
      speed,
      text,
    });
    if (!result.ok) {
      log.error({ error: result.error }, "backward failed");
    }
    return { ok: result.ok, data: result.data, error: result.error };
  },
});
