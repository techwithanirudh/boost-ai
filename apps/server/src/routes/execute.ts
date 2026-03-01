import { stepRequestSchema } from "@boost/validators";
import { Hono } from "hono";
import { hub } from "@/lib/hub";
import { decideNextAction } from "@/services/ai-orchestrator";

export const executeRoutes = new Hono();

executeRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = stepRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ ok: false, data: null, error: parsed.error.issues }, 400);
  }

  try {
    const traceId = crypto.randomUUID();
    const aiResult = await decideNextAction(parsed.data);

    const hubResult = parsed.data.dryRun
      ? { ok: true, data: { dryRun: true, decision: aiResult.decision }, error: null }
      : await hub.executeAction(aiResult.decision);

    return c.json({
      ok: true,
      data: { traceId, decision: aiResult.decision, hubResult },
      error: null,
    });
  } catch (error) {
    return c.json({ ok: false, data: null, error: `execution_failed: ${String(error)}` }, 500);
  }
});
