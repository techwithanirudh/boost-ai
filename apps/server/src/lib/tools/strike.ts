import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { hub } from "../hub";
import { captureSnapshot, snapshotToModelOutput } from "./snapshot-output";

const log = createLogger("tool:strike");

export const strikeTool = tool({
  description:
    "Open the R3PTAR jaw (strike action) for a specified duration, then snap it shut. Use this to strike at a target or perform a bite animation.",
  inputSchema: z.object({
    value: z
      .number()
      .min(0.1)
      .max(5.0)
      .default(0.5)
      .describe(
        "How long to hold the jaw open, in seconds (0.1-5.0). Default 0.5."
      ),
    speed: z
      .number()
      .min(0)
      .max(1)
      .default(0.6)
      .describe("Motor speed for the jaw open/close (0.0-1.0). Default 0.6."),
    text: z
      .string()
      .min(1)
      .max(500)
      .describe("Brief rationale for this decision (shown in logs)."),
  }),
  execute: async ({ value, speed, text }) => {
    log.info({ value, speed, text }, `strike — jaw open for ${value}s`);

    const result = await hub.executeAction({
      action: "strike",
      value,
      speed,
      text,
    });

    if (!result.ok) {
      log.error({ error: result.error }, "strike failed");
    }

    const snapshot = await captureSnapshot();
    return { data: result.data, error: result.error, ok: result.ok, snapshot };
  },
  toModelOutput: ({ output }) => {
    const status = output.ok
      ? `ok (data: ${JSON.stringify(output.data)})`
      : `error: ${output.error}`;
    return snapshotToModelOutput(
      output.snapshot,
      `strike complete — ${status}`
    );
  },
});
