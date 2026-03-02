import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { fetchFrame } from "@/services/frame";

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

    let snapshot: string | null = null;
    try {
      const frame = await fetchFrame();
      snapshot = frame.dataUrl;
    } catch {
      snapshot = null;
    }

    return { ok: true, summary, snapshot };
  },
});
