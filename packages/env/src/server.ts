import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    CORS_ORIGIN: z.url().default("http://localhost:3001"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    GOOGLE_API_KEY: z.string().min(1),
    HUB_BASE_URL: z.url().default("http://localhost:8000"),
    STEP_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
    /** MediaMTX HTTP API base URL, e.g. http://mediamtx:8888 */
    MEDIAMTX_BASE_URL: z.url().default("http://localhost:8888"),
    /** RTSP stream path published by the camera (e.g. iPhone Larix → "cam") */
    MEDIAMTX_STREAM_PATH: z.string().default("cam"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
