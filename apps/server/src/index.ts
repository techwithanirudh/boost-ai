import { env } from "@ev3/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { chat } from "./routes/chat";
import { healthRouter as health } from "./routes/health";
import { snapshot } from "./routes/snapshot";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({ origin: env.CORS_ORIGIN, allowMethods: ["GET", "POST", "OPTIONS"] })
);

app.get("/", (c) => c.text("OK"));
app.route("/v1/health", health);
app.route("/v1/chat", chat);
app.route("/v1/snapshot", snapshot);

export default {
  fetch: app.fetch,
  idleTimeout: 120, // seconds — long enough for multi-step robot sessions
};
