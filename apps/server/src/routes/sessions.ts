import {
  createSession,
  getSession,
  updateSessionStatus,
} from "@boost/db/queries/sessions";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { hub } from "@/lib/hub";
import { requireHub } from "@/lib/hub/ready";
import { createLogger } from "@/lib/logger";
import { runSession } from "@/services/orchestrator";

const log = createLogger("sessions");

export const sessions = new Hono();
const sessionBodySchema = z
  .object({ goal: z.string().min(1), id: z.string().optional() })
  .strict();

async function resolveSessionId(goal: string, id?: string): Promise<string> {
  if (id) {
    const existing = await getSession(id);
    if (!existing) {
      const created = await createSession({ id, goal });
      return created.id;
    }
    if (existing.status === "completed") {
      await updateSessionStatus(id, "running");
    }
    return id;
  }

  const session = await createSession({ id: crypto.randomUUID(), goal });
  return session.id;
}

/**
 * Create a new session OR continue an existing one (follow-up goal).
 *
 * POST /v1/sessions
 * Body: { goal: string, id?: string }
 *
 * - No id → new session is created, orchestrator runs immediately.
 * - id provided → loads existing session, re-runs orchestrator with the goal
 *   (allows follow-up missions after the previous one completes).
 */
sessions.post("/", async (c) => {
  const notReady = await requireHub(c);
  if (notReady) {
    return notReady;
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = sessionBodySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ ok: false, data: null, error: parsed.error.issues }, 400);
  }

  const { goal, id } = parsed.data;
  const sessionId = await resolveSessionId(goal, id);

  const started = Date.now();

  try {
    const result = await runSession(sessionId, goal);
    const updated = await getSession(sessionId);
    const status = updated?.status ?? "running";
    const steps = result.steps.length;
    const ms = Date.now() - started;

    log.info(
      { sessionId, status, steps, ms },
      `session ${status} — ${steps} step${steps !== 1 ? "s" : ""} in ${ms}ms`
    );

    return c.json({
      ok: true,
      data: { sessionId, status, text: result.text, steps },
      error: null,
    });
  } catch (error) {
    const ms = Date.now() - started;
    log.error({ sessionId, ms, err: String(error) }, "session failed");
    return c.json(
      { ok: false, data: null, error: `session_failed: ${String(error)}` },
      500
    );
  }
});

sessions.post("/stream", async (c) => {
  const notReady = await requireHub(c);
  if (notReady) {
    return notReady;
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = sessionBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, data: null, error: parsed.error.issues }, 400);
  }

  const { goal, id } = parsed.data;
  const sessionId = await resolveSessionId(goal, id);

  return streamSSE(c, async (stream) => {
    const write = async (event: string, data: unknown) => {
      await stream.writeSSE({ event, data: JSON.stringify(data) });
    };

    await write("session_started", { sessionId, goal });
    const heartbeat = setInterval(() => {
      write("heartbeat", { ts: Date.now() }).catch(() => undefined);
    }, 1000);

    const started = Date.now();
    try {
      const result = await runSession(sessionId, goal);
      const updated = await getSession(sessionId);
      const status = updated?.status ?? "running";
      const steps = result.steps.length;
      const ms = Date.now() - started;
      log.info(
        { sessionId, status, steps, ms },
        `session ${status} — ${steps} step${steps !== 1 ? "s" : ""} in ${ms}ms`
      );
      await write("session_result", {
        sessionId,
        status,
        text: result.text,
        steps,
      });
      await write("session_complete", { sessionId, status });
    } catch (error) {
      const ms = Date.now() - started;
      const detail = `session_failed: ${String(error)}`;
      log.error({ sessionId, ms, err: String(error) }, "session failed");
      await write("session_error", { sessionId, error: detail });
    } finally {
      clearInterval(heartbeat);
      await stream.close();
    }
  });
});

sessions.get("/:id", async (c) => {
  const session = await getSession(c.req.param("id"));
  if (!session) {
    return c.json({ ok: false, data: null, error: "session_not_found" }, 404);
  }
  return c.json({ ok: true, data: session, error: null });
});

sessions.post("/:id/stop", async (c) => {
  const sessionId = c.req.param("id");
  const session = await getSession(sessionId);
  if (!session) {
    return c.json({ ok: false, data: null, error: "session_not_found" }, 404);
  }

  log.warn({ sessionId }, "emergency stop");
  await hub.emergencyStop();
  await updateSessionStatus(sessionId, "stopped");

  return c.json({
    ok: true,
    data: { sessionId, status: "stopped" },
    error: null,
  });
});
