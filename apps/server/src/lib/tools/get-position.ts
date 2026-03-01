import { tool } from "ai";
import { z } from "zod";
import { hub } from "../hub";

export const getPositionTool = tool({
  description:
    "Retrieve the hub's current sensor state: connection status and watchdog health. Call this to confirm operational readiness before issuing a motion command.",
  inputSchema: z.object({}),
  execute: async () => {
    const result = await hub.getState();
    return { ok: result.ok, state: result.data, error: result.error };
  },
});
