import { Hono } from "hono";
import { hub } from "@/lib/hub";

export const healthRouter = new Hono();

healthRouter.get("/", async (c) => {
  const [health, state] = await Promise.all([hub.getHealth(), hub.getState()]);

  return c.json({
    ok: true,
    data: {
      service: "server",
      hub: {
        ...health,
        battery: state.data?.battery ?? null,
      },
    },
    error: null,
  });
});
