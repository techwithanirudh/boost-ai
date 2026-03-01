import { Hono } from "hono";
import { z } from "zod";
import { runSession } from "@/services/orchestrator";

export const execute = new Hono();

/**
 * Stateless one-shot execution — creates a throwaway session and runs the
 * orchestrator immediately. Useful for quick CLI / testing without managing
 * session state.
 *
 * POST /v1/execute
 * Body: { goal: string }
 */
execute.post("/", async (c) => {
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
