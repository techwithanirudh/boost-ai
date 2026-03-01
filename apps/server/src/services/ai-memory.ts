import { db } from "@boost/db";
import { aiMessages, aiSessions } from "@boost/db/schema";
import type { ActionDecision, StepRequest } from "@boost/validators";
import { desc, eq } from "drizzle-orm";
import { AI_ITERATION_HISTORY_LIMIT } from "../lib/config";

type SessionRow = typeof aiSessions.$inferSelect;

type ConversationContext = {
  sessionId: string;
  rollingSummary: string;
  recentHistory: string;
};

function buildUserContent(input: StepRequest): string {
  return [
    `goal=${input.goal}`,
    `scene=${input.observation.scene ?? ""}`,
    `depth=${input.observation.depthSummary ?? ""}`,
    `frameRef=${input.observation.frameRef ?? ""}`,
  ].join(" | ");
}

function summarizeHistory(lines: string[]): string {
  if (lines.length === 0) {
    return "No prior history.";
  }

  return lines.slice(-6).join(" || ").slice(0, 1500);
}

export async function openSession(input: StepRequest): Promise<SessionRow> {
  if (input.sessionId) {
    const existing = await db.select().from(aiSessions).where(eq(aiSessions.id, input.sessionId)).limit(1);
    if (existing[0]) {
      await db
        .update(aiSessions)
        .set({ goal: input.goal, missionId: input.missionId ?? existing[0].missionId, updatedAt: new Date() })
        .where(eq(aiSessions.id, input.sessionId));
      return { ...existing[0], goal: input.goal, missionId: input.missionId ?? existing[0].missionId, updatedAt: new Date() };
    }
  }

  const id = input.sessionId ?? crypto.randomUUID();

  const created = await db
    .insert(aiSessions)
    .values({
      id,
      missionId: input.missionId ?? null,
      goal: input.goal,
      rollingSummary: null,
      updatedAt: new Date(),
    })
    .returning();

  if (!created[0]) {
    throw new Error("failed_to_create_session");
  }

  return created[0];
}

export async function appendUserIteration(sessionId: string, input: StepRequest): Promise<void> {
  await db.insert(aiMessages).values({
    sessionId,
    role: "user",
    content: buildUserContent(input),
    decision: null,
    hubResult: null,
    toolCalls: null,
  });
}

export async function appendAssistantIteration(params: {
  sessionId: string;
  decision: ActionDecision;
  hubResult: unknown;
  toolCalls?: unknown;
}): Promise<void> {
  await db.insert(aiMessages).values({
    sessionId: params.sessionId,
    role: "assistant",
    content: params.decision.text,
    decision: params.decision,
    hubResult: params.hubResult as any,
    toolCalls: (params.toolCalls ?? null) as any,
  });

  const rows = await db
    .select({ role: aiMessages.role, content: aiMessages.content })
    .from(aiMessages)
    .where(eq(aiMessages.sessionId, params.sessionId))
    .orderBy(desc(aiMessages.createdAt))
    .limit(AI_ITERATION_HISTORY_LIMIT);

  const lines = rows
    .slice()
    .reverse()
    .map((row) => `${row.role}: ${row.content}`);

  await db
    .update(aiSessions)
    .set({ rollingSummary: summarizeHistory(lines), updatedAt: new Date() })
    .where(eq(aiSessions.id, params.sessionId));
}

export async function loadConversationContext(sessionId: string): Promise<ConversationContext> {
  const session = await db.select().from(aiSessions).where(eq(aiSessions.id, sessionId)).limit(1);
  const row = session[0];

  const messages = await db
    .select({ role: aiMessages.role, content: aiMessages.content })
    .from(aiMessages)
    .where(eq(aiMessages.sessionId, sessionId))
    .orderBy(desc(aiMessages.createdAt))
    .limit(AI_ITERATION_HISTORY_LIMIT);

  const recentHistory = messages
    .slice()
    .reverse()
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  return {
    sessionId,
    rollingSummary: row?.rollingSummary ?? "No prior summary.",
    recentHistory,
  };
}
