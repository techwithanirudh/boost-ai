import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { hub } from "../hub";

const log = createLogger("tool:get-pose");

export const getPoseTool = tool({
  description:
    "Get the robot's current dead-reckoning pose relative to its starting position. Returns x/y in metres and heading in degrees (0 = forward from start, positive = left, negative = right). Use to track cumulative displacement and avoid retracing steps.",
  inputSchema: z.object({}),
  execute: async () => {
    const result = await hub.getState();
    const pose = result.data?.pose ?? null;
    log.info({ pose }, "get-pose");
    return { ok: result.ok, pose, error: result.error };
  },
});
