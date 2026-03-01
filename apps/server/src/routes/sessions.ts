import {
  createSession,
  getSession,
  updateSessionStatus,
} from "@boost/db/queries/sessions";
import { Hono } from "hono";
import { z } from "zod";
import { hub } from "@/lib/hub";
import { requireHub } from "@/lib/hub/ready";
import { createLogger } from "@/lib/logger";
import { runSession } from "@/services/orchestrator";

const log = createLogger("sessions");

export const sessions = new Hono();

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
  const parsed = z
    .object({ goal: z.string().min(1), id: z.string().optional() })
    .safeParse(body);

  if (!parsed.success) {
    return c.json({ ok: false, data: null, error: parsed.error.issues }, 400);
  }

  const { goal, id } = parsed.data;

  let sessionId: string;

  if (id) {
    const existing = await getSession(id);
    if (!existing) {
      log.warn({ sessionId: id, goal }, "session not found for follow-up");
      return c.json({ ok: false, data: null, error: "session_not_found" }, 404);
    }
    if (existing.status === "completed") {
      await updateSessionStatus(id, "running");
    }
    sessionId = id;
    log.info({ sessionId, goal }, "session resumed");
  } else {
    const session = await createSession({ id: crypto.randomUUID(), goal });
    sessionId = session.id;
    log.info({ sessionId, goal }, "session started");
  }

  const started = Date.now();

  try {
    const result = await runSession(sessionId, goal);
    const updated = await getSession(sessionId);
    const status = updated?.status ?? "running";
    const steps = result.steps.length;
    const ms = Date.now() - started;

    log.info(
      { sessionId, status, steps, ms, tokens: result.usage },
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
