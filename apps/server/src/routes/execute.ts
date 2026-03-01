import { Hono } from "hono";
import { z } from "zod";
import { requireHub } from "@/lib/hub/ready";
import { runSession } from "@/services/orchestrator";

export const execute = new Hono();

execute.post("/", async (c) => {
  const notReady = await requireHub(c);
  if (notReady) {
    return notReady;
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ goal: z.string().min(1) }).safeParse(body);

  if (!parsed.success) {
    return c.json({ ok: false, data: null, error: parsed.error.issues }, 400);
  }

  try {
    const sessionId = crypto.randomUUID();
    const result = await runSession(sessionId, parsed.data.goal);

    return c.json({
      ok: true,
      data: { sessionId, text: result.text, steps: result.steps.length },
      error: null,
    });
  } catch (error) {
    return c.json(
      { ok: false, data: null, error: `execution_failed: ${String(error)}` },
      500
    );
  }
});
