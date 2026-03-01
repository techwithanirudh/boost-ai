import { tool } from "ai";
import { z } from "zod";
import { getState } from "../../../services/hub-service";

export const getPositionTool = tool({
  description: "Get current robot position/state from hub sensors and controller status.",
  inputSchema: z.object({}),
  execute: async () => {
    const state = await getState();
    return {
      ok: state.ok,
      state: state.data,
      error: state.error ?? null,
    };
  },
});
