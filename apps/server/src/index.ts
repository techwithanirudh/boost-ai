import { env } from "@boost/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { hub } from "./lib/hub";
import logger_ from "./lib/logger";
import { config } from "./lib/providers";
import { execute } from "./routes/execute";
import { health } from "./routes/health";
import { sessions } from "./routes/sessions";

const log = logger_.child({ context: "startup" });

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({ origin: env.CORS_ORIGIN, allowMethods: ["GET", "POST", "OPTIONS"] })
);

app.get("/", (c) => c.text("OK"));
app.route("/v1/health", health);
app.route("/v1/execute", execute);
app.route("/v1/sessions", sessions);

export default app;

async function waitForHubReady(): Promise<void> {
  log.info(`Waiting for hub at ${env.HUB_BASE_URL} …`);
  const started = Date.now();
  let attempt = 0;
  for (;;) {
    attempt++;
    const h = await hub.getHealth();
    if (h.ok && h.data?.connected) {
      log.info({ attempt, ms: Date.now() - started }, "Hub ready — BLE connected");
      return;
    }
    const reason = !h.ok ? h.error : "hub BLE not connected yet";
    log.warn({ attempt, elapsed: Date.now() - started, reason }, "Hub not ready, retrying");
    await new Promise<void>((resolve) =>
      setTimeout(resolve, config.hub.pollIntervalMs)
    );
  }
}

await waitForHubReady();
log.info("Server ready");
