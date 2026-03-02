import { readChat, saveChat } from "@boost/db/queries/chats";
import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { getResumableStreamContext } from "@/lib/resume-stream";

export async function resumeChatStream(id: string): Promise<Response> {
  const chat = await readChat(id);
  if (!chat.activeStreamId) {
    return new Response(null, { status: 204 });
  }

  const streamContext = getResumableStreamContext();
  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  const resumed = await streamContext.resumeExistingStream(chat.activeStreamId);
  if (!resumed) {
    await saveChat({ id, activeStreamId: null });
    return new Response(null, { status: 204 });
  }

  return new Response(resumed, { headers: UI_MESSAGE_STREAM_HEADERS });
}
