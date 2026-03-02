import { Hono } from "hono";
import { requireHub } from "@/lib/hub/ready";
import { getChat } from "./get";
import { postChat } from "./post";
import { resumeChatStream } from "./resume";
import { stopChat } from "./stop";

export const chat = new Hono();

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

chat.post("/:id/stop", (c) => {
  return stopChat(c.req.param("id"));
});
