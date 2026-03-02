import { tool } from "ai";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { fetchFrame } from "@/services/frame";
import { hub } from "../hub";
import { snapshotToModelOutput } from "./snapshot-output";

const log = createLogger("tool:stop");

export const stopTool = tool({
  description:
    "Halt all robot motion immediately. Use when the scene is unclear, an obstacle is too close, the current request is achieved, or the hub reports an error.",
  inputSchema: z.object({
    text: z
      .string()
      .min(1)
      .max(500)
      .describe("Brief rationale for stopping (shown in logs)."),
  }),
  execute: async ({ text }) => {
    log.warn({ text }, "stop");

    const result = await hub.executeAction({
      action: "stop",
      value: 0,
      speed: 0.5,
      text,
    });

    if (!result.ok) {
      log.error({ error: result.error }, "stop failed");
    }

    let snapshot: string | null = null;
    try {
      const frame = await fetchFrame();
      snapshot = frame.dataUrl;
    } catch {
      snapshot = null;
    }

    return { data: result.data, error: result.error, ok: result.ok, snapshot };
  },
  toModelOutput: ({ output }) => {
    const status = output.ok
      ? `ok (data: ${JSON.stringify(output.data)})`
      : `error: ${output.error}`;
    return snapshotToModelOutput(output.snapshot, `stop complete — ${status}`);
  },
});
