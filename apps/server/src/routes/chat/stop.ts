import { readChat, saveChat } from "@boost/db/queries/chats";
import { hub } from "@/lib/hub";

export async function stopChat(id: string): Promise<Response> {
  await readChat(id);

  await saveChat({
    id,
    activeStreamId: null,
    canceledAt: new Date(),
    status: "stopped",
  });

  await hub.emergencyStop();

  return Response.json({
    ok: true,
    data: { id, status: "stopped" },
    error: null,
  });
}
