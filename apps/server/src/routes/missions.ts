import { stepRequestSchema } from "@boost/validators";
import { Hono } from "hono";
import { z } from "zod";
import { hub } from "@/lib/hub";
import { getMission, setMission } from "@/lib/missions";
import { decideNextAction } from "@/services/ai-orchestrator";

export const missionRoutes = new Hono();

missionRoutes.post("/start", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = z
    .object({ missionId: z.string().min(1).optional(), goal: z.string().min(1) })
    .safeParse(body);

  if (!parsed.success) {
    return c.json({ ok: false, data: null, error: parsed.error.issues }, 400);
  }

  const missionId = parsed.data.missionId ?? crypto.randomUUID();
  const state = {
    status: "running" as const,
    goal: parsed.data.goal,
    updatedAt: new Date().toISOString(),
  };
  setMission(missionId, state);

  return c.json({ ok: true, data: { missionId, ...state }, error: null });
});

missionRoutes.get("/:missionId/state", (c) => {
  const missionId = c.req.param("missionId");
  const state = getMission(missionId);

  if (!state) {
    return c.json({ ok: false, data: null, error: "mission_not_found" }, 404);
  }

  return c.json({ ok: true, data: { missionId, ...state }, error: null });
});

missionRoutes.post("/:missionId/stop", async (c) => {
  const missionId = c.req.param("missionId");
  const state = getMission(missionId);

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
  setMission(missionId, next);

  return c.json({ ok: true, data: { missionId, state: next, hubResult }, error: null });
});

missionRoutes.post("/:missionId/step", async (c) => {
  const missionId = c.req.param("missionId");
  const mission = getMission(missionId);

  if (!mission) {
    return c.json({ ok: false, data: null, error: "mission_not_found" }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = stepRequestSchema.safeParse({
    ...body,
    missionId,
    sessionId: body.sessionId ?? missionId,
    goal: body.goal ?? mission.goal,
  });

  if (!parsed.success) {
    return c.json({ ok: false, data: null, error: parsed.error.issues }, 400);
  }

  try {
    const traceId = crypto.randomUUID();
    const aiResult = await decideNextAction(parsed.data);

    const hubResult = parsed.data.dryRun
      ? { ok: true, data: { dryRun: true, decision: aiResult.decision }, error: null }
      : await hub.executeAction(aiResult.decision);

    setMission(missionId, { ...mission, updatedAt: new Date().toISOString() });

    return c.json({
      ok: true,
      data: { traceId, missionId, decision: aiResult.decision, hubResult },
      error: null,
    });
  } catch (error) {
    return c.json({ ok: false, data: null, error: `step_failed: ${String(error)}` }, 500);
  }
});
