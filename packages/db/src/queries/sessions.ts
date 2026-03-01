import type { ModelMessage } from "ai";
import { eq } from "drizzle-orm";
import { db } from "../index";
import { aiSessions } from "../schema";

export type SessionRow = typeof aiSessions.$inferSelect;
export type SessionStatus = "running" | "stopped" | "completed";

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

export async function createSession(params: {
  id: string;
  goal: string;
}): Promise<SessionRow> {
  const created = await db
    .insert(aiSessions)
    .values({ id: params.id, goal: params.goal, messages: [] })
    .returning();

  if (!created[0]) {
    throw new Error("failed_to_create_session");
  }
  return created[0];
}

export async function getSession(id: string): Promise<SessionRow | undefined> {
  const rows = await db
    .select()
    .from(aiSessions)
    .where(eq(aiSessions.id, id))
    .limit(1);
  return rows[0];
}

export async function updateSessionStatus(
  id: string,
  status: SessionStatus
): Promise<void> {
  await db
    .update(aiSessions)
    .set({ status, updatedAt: new Date() })
    .where(eq(aiSessions.id, id));
}

// ---------------------------------------------------------------------------
// Message persistence (AI SDK ModelMessage[] pattern)
// ---------------------------------------------------------------------------

export async function loadMessages(
  sessionId: string,
  limit: number
): Promise<ModelMessage[]> {
  const rows = await db
    .select({ messages: aiSessions.messages })
    .from(aiSessions)
    .where(eq(aiSessions.id, sessionId))
    .limit(1);

  const stored = (rows[0]?.messages ?? []) as ModelMessage[];
  return stored.slice(-limit);
}

export async function saveMessages(
  sessionId: string,
  messages: ModelMessage[],
  limit: number
): Promise<void> {
  await db
    .update(aiSessions)
    .set({
      messages: messages.slice(-limit) as unknown[],
      updatedAt: new Date(),
    })
    .where(eq(aiSessions.id, sessionId));
}
