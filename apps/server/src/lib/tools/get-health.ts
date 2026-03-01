import { tool } from "ai";
import { z } from "zod";
import { hub } from "../hub";

export const getHealthTool = tool({
  description:
    "Check connectivity and health of the LEGO Boost hub. Call this when the hub may be offline or when a previous action returned an error.",
  inputSchema: z.object({}),
  execute: async () => {
    const result = await hub.getHealth();
    return { ok: result.ok, health: result.data, error: result.error };
  },
});
