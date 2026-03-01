import { tool } from "ai";
import { z } from "zod";
import type { StepRequest } from "@boost/validators";

export function createGetObservationTool(observation: StepRequest["observation"]) {
  return tool({
    description: "Return current external observation snapshot including scene/depth/frame references.",
    inputSchema: z.object({}),
    execute: async () => ({
      observation,
    }),
  });
}
