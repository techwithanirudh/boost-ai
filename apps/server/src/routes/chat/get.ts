import { findChat } from "@boost/db/queries/chats";
import { createLogger } from "@/lib/logger";

const log = createLogger("chat");

export async function getChat(id: string): Promise<Response> {
  try {
    const chat = await findChat(id);
    if (!chat) {
      return Response.json(
        { ok: false, data: null, error: "Chat not found" },
        { status: 404 }
      );
    }
    return Response.json({ ok: true, data: chat, error: null });
  } catch (err) {
    log.error({ err, id }, "Failed to read chat");
    return Response.json(
      { ok: false, data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
