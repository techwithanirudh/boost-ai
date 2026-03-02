import { z } from "zod";

export const stepRequestSchema = z.object({
  sessionId: z.string().min(1).optional(),
  missionId: z.string().min(1).optional(),
  /** Optional URL to a depth-pro map image served by depth-pro sidecar. */
  depthMapUrl: z.string().url().optional(),
  dryRun: z.boolean().default(false),
});

export type StepRequest = z.infer<typeof stepRequestSchema>;
