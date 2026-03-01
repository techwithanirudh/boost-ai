import { z } from "zod";

export const stepRequestSchema = z.object({
  sessionId: z.string().min(1).optional(),
  missionId: z.string().min(1).optional(),
  goal: z.string().min(1),
  observation: z
    .object({
      scene: z.string().max(4000).optional(),
      depthSummary: z.string().max(4000).optional(),
      frameRef: z.string().max(1024).optional(),
    })
    .default({}),
  dryRun: z.boolean().default(false),
});

export type StepRequest = z.infer<typeof stepRequestSchema>;
