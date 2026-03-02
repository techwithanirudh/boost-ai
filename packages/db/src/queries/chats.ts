import type { UIMessage } from "ai";
import { eq } from "drizzle-orm";
import { db } from "../index";
import { chats } from "../schema";

export type ChatRow = typeof chats.$inferSelect;
export type ChatStatus = "running" | "stopped" | "completed";

async function createChat(id: string): Promise<ChatRow> {
  const created = await db
    .insert(chats)
    .values({ id, messages: [] })
    .returning();

  if (!created[0]) {
    throw new Error("failed_to_create_chat");
  }

  return created[0];
}

export async function readChat(id: string): Promise<ChatRow> {
  const existing = await db
    .select()
    .from(chats)
    .where(eq(chats.id, id))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  return createChat(id);
}

export async function saveChat(params: {
  id: string;
  activeStreamId?: string | null;
  canceledAt?: Date | null;
  goal?: string;
  messages?: UIMessage[];
  status?: ChatStatus;
}): Promise<void> {
  await readChat(params.id);

  await db
    .update(chats)
    .set({
      activeStreamId:
        params.activeStreamId !== undefined ? params.activeStreamId : undefined,
      canceledAt:
        params.canceledAt !== undefined ? params.canceledAt : undefined,
      goal: params.goal !== undefined ? params.goal : undefined,
      messages:
        params.messages !== undefined
          ? (params.messages as unknown[])
          : undefined,
      status: params.status !== undefined ? params.status : undefined,
      updatedAt: new Date(),
    })
    .where(eq(chats.id, params.id));
}
