import { readChat } from "@boost/db/queries/chats";

export async function getChat(id: string): Promise<Response> {
  const chat = await readChat(id);
  return Response.json({ ok: true, data: chat, error: null });
}
