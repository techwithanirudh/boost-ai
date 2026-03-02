import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { captureSnapshot, snapshotToModelOutput } from "./snapshot-output";

const log = createLogger("tool:complete");

export const completeTool = tool({
  description:
    "Call this when the current request has been fully achieved. Provide a brief summary of what was accomplished.",
  inputSchema: z.object({
    summary: z
      .string()
      .min(1)
      .describe("Brief summary of what was accomplished."),
  }),
  execute: async ({ summary }) => {
    log.info({ summary }, "session complete");

    const snapshot = await captureSnapshot();

    return { ok: true, summary, snapshot };
  },
  toModelOutput: ({ output }) =>
    snapshotToModelOutput(output.snapshot, `complete — ${output.summary}`),
});
