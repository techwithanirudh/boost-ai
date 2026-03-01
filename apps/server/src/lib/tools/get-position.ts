import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { hub } from "../hub";

const log = createLogger("tool:get-position");

const executeGetDetails = async () => {
  const result = await hub.getState();
  log.info({ ok: result.ok, details: result.data }, "get-position");
  return { ok: result.ok, details: result.data, error: result.error };
};

export const getPositionTool = tool({
  description:
    "Get hub diagnostic details, including connected status and distance to the nearest object in centimeters.",
  inputSchema: z.object({}),
  execute: executeGetDetails,
});
