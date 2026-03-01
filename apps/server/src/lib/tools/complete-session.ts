import { updateSessionStatus } from "@boost/db/queries/sessions";
import { tool } from "ai";
import { z } from "zod";

/**
 * Terminal tool: AI calls this when the goal is fully achieved.
 * Updates session status to "completed" and stops the agent loop.
 */
export function createCompleteSessionTool(sessionId: string) {
  return tool({
    description:
      "Call this when the current goal has been fully achieved and the session is complete. Provide a brief summary of what was accomplished.",
    inputSchema: z.object({
      summary: z.string().min(1).max(500).describe("Brief summary of what was accomplished."),
    }),
    execute: async ({ summary }) => {
      await updateSessionStatus(sessionId, "completed");
      return { ok: true, summary };
    },
  });
}
