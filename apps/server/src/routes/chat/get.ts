import { readChat } from "@boost/db/queries/chats";
import { createLogger } from "@/lib/logger";

const log = createLogger("chat");

export async function getChat(id: string): Promise<Response> {
  try {
    const chat = await readChat(id);
    return Response.json({ ok: true, data: chat, error: null });
  } catch (err) {
    log.error({ err, id }, "Failed to read chat");
    return Response.json(
      { ok: false, data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
