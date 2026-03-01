import {
  appendAssistantIteration,
  appendUserIteration,
  loadConversationContext,
  openSession,
} from "@boost/db/queries/chat";
import { env } from "@boost/env/server";
import { stepRequestSchema } from "@boost/validators";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";
import { hub } from "./lib/hub";
import { config } from "./lib/providers";
import { decideNextAction } from "./services/ai-orchestrator";

const app = new Hono();
const missionState = new Map<string, { status: "running" | "stopped"; goal: string; updatedAt: string }>();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/", (c) => c.text("OK"));

app.get("/v1/health", async (c) => {
  const hubHealth = await hub.getHealth();
  return c.json({
    ok: true,
    data: { service: "server", aiModel: "chat-model", hub: hubHealth },
    error: null,
  });
});

app.post("/v1/execute", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = stepRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ ok: false, data: null, error: parsed.error.issues }, 400);
  }

  try {
    const traceId = crypto.randomUUID();
    const session = await openSession(parsed.data);
    await appendUserIteration(session.id, parsed.data);

    const context = await loadConversationContext(session.id, config.history.limit);
    const aiResult = await decideNextAction(parsed.data, context);

    const hubResult = parsed.data.dryRun
      ? { ok: true, data: { dryRun: true, decision: aiResult.decision }, error: null }
      : await hub.executeAction(aiResult.decision);

    await appendAssistantIteration({
      sessionId: session.id,
      decision: aiResult.decision,
      hubResult,
      toolCalls: aiResult.toolCalls,
      historyLimit: config.history.limit,
    });

    return c.json({
      ok: true,
      data: { traceId, sessionId: session.id, decision: aiResult.decision, provider: aiResult.provider, hubResult },
      error: null,
    });
  } catch (error) {
    return c.json({ ok: false, data: null, error: `ai_execution_failed: ${String(error)}` }, 500);
  }
});

app.post("/v1/missions/start", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({ missionId: z.string().min(1).optional(), goal: z.string().min(1) });
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return c.json({ ok: false, data: null, error: parsed.error.issues }, 400);
  }

  const missionId = parsed.data.missionId ?? crypto.randomUUID();
  const state = { status: "running" as const, goal: parsed.data.goal, updatedAt: new Date().toISOString() };
  missionState.set(missionId, state);

  return c.json({ ok: true, data: { missionId, ...state }, error: null });
});

app.get("/v1/missions/:missionId/state", (c) => {
  const missionId = c.req.param("missionId");
  const state = missionState.get(missionId);

  if (!state) {
    return c.json({ ok: false, data: null, error: "mission_not_found" }, 404);
  }

  return c.json({ ok: true, data: { missionId, ...state }, error: null });
});

app.post("/v1/missions/:missionId/stop", async (c) => {
  const missionId = c.req.param("missionId");
  const state = missionState.get(missionId);

  if (!state) {
    return c.json({ ok: false, data: null, error: "mission_not_found" }, 404);
  }

  const hubResult = await hub.executeAction({
    action: "stop",
    value: 0,
    speed: 0.5,
    text: "mission stop requested",
  });
  const next = { ...state, status: "stopped" as const, updatedAt: new Date().toISOString() };
  missionState.set(missionId, next);

  return c.json({ ok: true, data: { missionId, state: next, hubResult }, error: null });
});

app.post("/v1/missions/:missionId/step", async (c) => {
  const missionId = c.req.param("missionId");
  const mission = missionState.get(missionId);

  if (!mission) {
    return c.json({ ok: false, data: null, error: "mission_not_found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const merged = {
    ...body,
    missionId,
    sessionId: typeof body?.sessionId === "string" && body.sessionId.length > 0 ? body.sessionId : missionId,
    goal: typeof body?.goal === "string" && body.goal.length > 0 ? body.goal : mission.goal,
  };

  const parsed = stepRequestSchema.safeParse(merged);
  if (!parsed.success) {
    return c.json({ ok: false, data: null, error: parsed.error.issues }, 400);
  }

  try {
    const traceId = crypto.randomUUID();
    const session = await openSession(parsed.data);
    await appendUserIteration(session.id, parsed.data);

    const context = await loadConversationContext(session.id, config.history.limit);
    const aiResult = await decideNextAction(parsed.data, context);

    const hubResult = parsed.data.dryRun
      ? { ok: true, data: { dryRun: true, decision: aiResult.decision }, error: null }
      : await hub.executeAction(aiResult.decision);

    await appendAssistantIteration({
      sessionId: session.id,
      decision: aiResult.decision,
      hubResult,
      toolCalls: aiResult.toolCalls,
      historyLimit: config.history.limit,
    });

    missionState.set(missionId, { ...mission, updatedAt: new Date().toISOString() });

    return c.json({
      ok: true,
      data: {
        traceId,
        missionId,
        sessionId: session.id,
        decision: aiResult.decision,
        provider: aiResult.provider,
        hubResult,
      },
      error: null,
    });
  } catch (error) {
    return c.json({ ok: false, data: null, error: `ai_execution_failed: ${String(error)}` }, 500);
  }
});

export default app;

async function waitForHubReady(): Promise<void> {
  const started = Date.now();

  for (;;) {
    const health = await hub.getHealth();
    if (health.ok) return;

    if (Date.now() - started > config.hub.timeoutMs) {
      throw new Error(`hub_not_ready_within_timeout: ${config.hub.timeoutMs}ms`);
    }

    await new Promise<void>((resolve) => setTimeout(resolve, config.hub.pollIntervalMs));
  }
}

await waitForHubReady();
