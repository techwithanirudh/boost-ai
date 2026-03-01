import { tool } from "ai";
import { z } from "zod";
import { getHealth } from "../../../services/hub-service";

export const getHubHealthTool = tool({
  description: "Check robot hub health and connectivity.",
  inputSchema: z.object({}),
  execute: async () => {
    const health = await getHealth();
    return {
      ok: health.ok,
      health: health.data,
      error: health.error ?? null,
    };
  },
});
