import type { ModelMessage } from "ai";
import { eq } from "drizzle-orm";
import { db } from "../index";
import { aiSessions } from "../schema";

export type SessionRow = typeof aiSessions.$inferSelect;

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export async function getOrCreateSession(params: {
  id: string;
  goal: string;
  missionId?: string;
}): Promise<SessionRow> {
  const existing = await db
    .select()
    .from(aiSessions)
    .where(eq(aiSessions.id, params.id))
    .limit(1);

  if (existing[0]) {
    const updated = await db
      .update(aiSessions)
      .set({
        goal: params.goal,
        missionId: params.missionId ?? existing[0].missionId,
        updatedAt: new Date(),
      })
      .where(eq(aiSessions.id, params.id))
      .returning();
    return updated[0]!;
  }

  const created = await db
    .insert(aiSessions)
    .values({
      id: params.id,
      missionId: params.missionId ?? null,
      goal: params.goal,
      messages: [],
      updatedAt: new Date(),
    })
    .returning();

  if (!created[0]) throw new Error("failed_to_create_session");
  return created[0];
}

// ---------------------------------------------------------------------------
// Message persistence (AI SDK ModelMessage[] pattern)
// ---------------------------------------------------------------------------

/**
 * Load the stored ModelMessage[] for a session, trimmed to the most recent
 * `limit` entries so the context window stays bounded.
 */
export async function loadMessages(sessionId: string, limit: number): Promise<ModelMessage[]> {
  const rows = await db
    .select({ messages: aiSessions.messages })
    .from(aiSessions)
    .where(eq(aiSessions.id, sessionId))
    .limit(1);

  const stored = (rows[0]?.messages ?? []) as ModelMessage[];
  return stored.slice(-limit);
}

/**
 * Persist the updated message array, trimmed to `limit` before writing
 * so the JSONB column stays bounded.
 */
export async function saveMessages(
  sessionId: string,
  messages: ModelMessage[],
  limit: number,
): Promise<void> {
  await db
    .update(aiSessions)
    .set({ messages: messages.slice(-limit) as unknown[], updatedAt: new Date() })
    .where(eq(aiSessions.id, sessionId));
}
