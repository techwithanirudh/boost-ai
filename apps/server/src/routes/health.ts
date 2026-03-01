import { Hono } from "hono";
import { hub } from "@/lib/hub";

export const health = new Hono();

health.get("/", async (c) => {
  const hubHealth = await Promise.race([
    hub.getHealth(),
    new Promise<Awaited<ReturnType<typeof hub.getHealth>>>((resolve) => {
      setTimeout(
        () => resolve({ ok: false, data: null, error: "hub_health_timeout" }),
        1200
      );
    }),
  ]);
  return c.json({
    ok: true,
    data: { service: "server", aiModel: "chat-model", hub: hubHealth },
    error: null,
  });
});
