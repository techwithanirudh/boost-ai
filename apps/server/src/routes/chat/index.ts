import { listChats } from "@ev3/db/queries/chats";
import { Hono } from "hono";
import { requireHub } from "@/lib/hub/ready";
import { createLogger } from "@/lib/logger";
import { getChat } from "./get";
import { postChat } from "./post";
import { resumeChatStream } from "./resume";

const log = createLogger("chat");

export const chat = new Hono();

chat.get("/", async (c) => {
  try {
    const chats = await listChats(100);
    return c.json({ ok: true, data: chats, error: null });
  } catch (err) {
    log.error({ err }, "Failed to list chats");
    return c.json(
      { ok: false, data: null, error: "Internal server error" },
      500
    );
  }
});

chat.post("/", async (c) => {
  const notReady = await requireHub(c);
  if (notReady) {
    return notReady;
  }

  return postChat(c.req.raw);
});

chat.get("/:id", (c) => {
  return getChat(c.req.param("id"));
});

chat.get("/:id/stream", (c) => {
  return resumeChatStream(c.req.param("id"));
});
