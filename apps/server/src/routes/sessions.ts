import { createSession, getSession, updateSessionStatus } from "@boost/db/queries/sessions";
import { stepRequestSchema } from "@boost/validators";
import { Hono } from "hono";
import { z } from "zod";
import { hub } from "@/lib/hub";
import { runOrchestrator } from "@/services/orchestrator";

export const sessions = new Hono();

sessions.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ goal: z.string().min(1) }).safeParse(body);

  if (!parsed.success) {
    return c.json({ ok: false, data: null, error: parsed.error.issues }, 400);
  }

  const session = await createSession({ id: crypto.randomUUID(), goal: parsed.data.goal });
  return c.json({ ok: true, data: session, error: null }, 201);
});

sessions.get("/:id", async (c) => {
  const session = await getSession(c.req.param("id"));
  if (!session) return c.json({ ok: false, data: null, error: "session_not_found" }, 404);
  return c.json({ ok: true, data: session, error: null });
});

sessions.post("/:id/run", async (c) => {
  const sessionId = c.req.param("id");
  const session = await getSession(sessionId);

  if (!session) return c.json({ ok: false, data: null, error: "session_not_found" }, 404);
  if (session.status !== "running") {
    return c.json({ ok: false, data: null, error: `session_${session.status}` }, 409);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = stepRequestSchema.safeParse({
    ...body,
    missionId: sessionId,
    sessionId,
    goal: body.goal ?? session.goal,
  });

  if (!parsed.success) {
    return c.json({ ok: false, data: null, error: parsed.error.issues }, 400);
  }

  if (parsed.data.dryRun) {
    return c.json({ ok: true, data: { sessionId, dryRun: true, status: session.status }, error: null });
  }

  try {
    const traceId = crypto.randomUUID();
    const result = await runOrchestrator(sessionId, parsed.data);

    const updated = await getSession(sessionId);
    return c.json({
      ok: true,
      data: { traceId, sessionId, text: result.text, steps: result.steps.length, status: updated?.status ?? "running" },
      error: null,
    });
  } catch (error) {
    return c.json({ ok: false, data: null, error: `run_failed: ${String(error)}` }, 500);
  }
});

sessions.post("/:id/stop", async (c) => {
  const sessionId = c.req.param("id");
  const session = await getSession(sessionId);

  if (!session) return c.json({ ok: false, data: null, error: "session_not_found" }, 404);

  await hub.emergencyStop();
  await updateSessionStatus(sessionId, "stopped");

  return c.json({ ok: true, data: { sessionId, status: "stopped" }, error: null });
});
