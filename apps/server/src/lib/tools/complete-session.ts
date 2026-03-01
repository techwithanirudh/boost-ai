import { updateSessionStatus } from "@boost/db/queries/sessions";
import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";

const log = createLogger("tool:complete");

export function completeSessionTool(sessionId: string) {
  return tool({
    description:
      "Call this when the current goal has been fully achieved and the session is complete. Provide a brief summary of what was accomplished.",
    inputSchema: z.object({
      summary: z.string().min(1).describe("Brief summary of what was accomplished."),
    }),
    execute: async ({ summary }) => {
      log.info({ sessionId, summary }, "session complete");
      await updateSessionStatus(sessionId, "completed");
      return { ok: true, summary };
    },
  });
}
