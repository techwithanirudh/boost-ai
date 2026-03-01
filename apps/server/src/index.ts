import { env } from "@boost/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { hub } from "./lib/hub";
import { config } from "./lib/providers";
import { execute } from "./routes/execute";
import { health } from "./routes/health";
import { sessions } from "./routes/sessions";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/", (c) => c.text("OK"));
app.route("/v1/health", health);
app.route("/v1/execute", execute);
app.route("/v1/sessions", sessions);

export default app;

async function waitForHubReady(): Promise<void> {
  const started = Date.now();
  for (;;) {
    const h = await hub.getHealth();
    if (h.ok) return;
    if (Date.now() - started > config.hub.timeoutMs) {
      throw new Error(`hub_not_ready_within_timeout: ${config.hub.timeoutMs}ms`);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, config.hub.pollIntervalMs));
  }
}

await waitForHubReady();
