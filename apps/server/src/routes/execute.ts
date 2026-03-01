import { stepRequestSchema } from "@boost/validators";
import { Hono } from "hono";
import { runOrchestrator } from "@/services/orchestrator";

export const execute = new Hono();

execute.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sessionId = crypto.randomUUID();
  const parsed = stepRequestSchema.safeParse({ ...body, sessionId, missionId: sessionId });

  if (!parsed.success) {
    return c.json({ ok: false, data: null, error: parsed.error.issues }, 400);
  }

  if (parsed.data.dryRun) {
    return c.json({ ok: true, data: { dryRun: true }, error: null });
  }

  try {
    const traceId = crypto.randomUUID();
    const result = await runOrchestrator(sessionId, parsed.data);

    return c.json({
      ok: true,
      data: { traceId, text: result.text, steps: result.steps.length },
      error: null,
    });
  } catch (error) {
    return c.json({ ok: false, data: null, error: `execution_failed: ${String(error)}` }, 500);
  }
});
