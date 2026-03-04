import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { hub } from "../hub";

const log = createLogger("tool:get-health");

export const getHealthTool = tool({
  description:
    "Check connectivity and health of the LEGO EV3 hub. Call this when the hub may be offline or when a previous action returned an error.",
  inputSchema: z.object({}),
  execute: async () => {
    const result = await hub.getHealth();
    log.info({ ok: result.ok, health: result.data }, "get-health");
    return { ok: result.ok, health: result.data, error: result.error };
  },
});
