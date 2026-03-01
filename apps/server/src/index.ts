import { env } from "@boost/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { execute } from "./routes/execute";
import { health } from "./routes/health";
import { sessions } from "./routes/sessions";

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
