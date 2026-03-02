import { Hono } from "hono";
import { hub } from "@/lib/hub";

export const health = new Hono();

health.get("/", async (c) => {
  const timeout = <T>(ms: number, fallback: T): Promise<T> =>
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms));

  const [hubHealth, hubState] = await Promise.all([
    Promise.race([
      hub.getHealth(),
      timeout(1200, { ok: false, data: null, error: "hub_health_timeout" }),
    ]),
    Promise.race([
      hub.getState(),
      timeout(1200, { ok: false, data: null, error: "hub_state_timeout" }),
    ]),
  ]);

  return c.json({
    ok: true,
    data: {
      service: "server",
      aiModel: "chat-model",
      hub: {
        ...hubHealth,
        battery: hubState.data?.battery ?? null,
      },
    },
    error: null,
  });
});
