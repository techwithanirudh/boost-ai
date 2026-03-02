import type { UIMessage } from "ai";
import { desc, eq } from "drizzle-orm";
import { db } from "../index";
import { chats } from "../schema";

export type ChatRow = typeof chats.$inferSelect;
export type ChatStatus = "running" | "stopped" | "completed";

export async function listChats(limit = 50): Promise<ChatRow[]> {
  const rows = await db
    .select()
    .from(chats)
    .orderBy(desc(chats.updatedAt))
    .limit(limit);

  return rows;
}

/** Returns null when no chat with that id exists. Does NOT auto-create. */
export async function findChat(id: string): Promise<ChatRow | null> {
  const existing = await db
    .select()
    .from(chats)
    .where(eq(chats.id, id))
    .limit(1);

  return existing[0] ?? null;
}

export async function readChat(id: string): Promise<ChatRow> {
  const rows = await db
    .insert(chats)
    .values({ id, messages: [], title: "New chat" })
    .onConflictDoNothing()
    .returning();

  if (rows[0]) {
    return rows[0];
  }

  const existing = await findChat(id);
  if (existing) {
    return existing;
  }

  throw new Error("failed_to_read_or_create_chat");
}

export async function saveChat(params: {
  id: string;
  activeStreamId?: string | null;
  messages?: UIMessage[];
  status?: ChatStatus;
  title?: string;
}): Promise<void> {
  await db
    .update(chats)
    .set({
      activeStreamId:
        params.activeStreamId !== undefined ? params.activeStreamId : undefined,
      messages:
        params.messages !== undefined
          ? (params.messages as unknown[])
          : undefined,
      status: params.status !== undefined ? params.status : undefined,
      title: params.title !== undefined ? params.title : undefined,
      updatedAt: new Date(),
    })
    .where(eq(chats.id, params.id));
}
