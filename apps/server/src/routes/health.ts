import { Hono } from "hono";
import { hub } from "@/lib/hub";

export const health = new Hono();

health.get("/", async (c) => {
  const hubHealth = await hub.getHealth();
  return c.json({
    ok: true,
    data: { service: "server", aiModel: "chat-model", hub: hubHealth },
    error: null,
  });
});
