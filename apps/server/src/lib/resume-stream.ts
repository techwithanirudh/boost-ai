import { env } from "@boost/env/server";
import Redis from "ioredis";
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from "resumable-stream/ioredis";
import { createLogger } from "@/lib/logger";

const log = createLogger("resume-stream");

let streamContext: ResumableStreamContext | null | undefined;

export function getResumableStreamContext(): ResumableStreamContext | null {
  if (!env.REDIS_URL) {
    return null;
  }

  if (streamContext !== undefined) {
    return streamContext;
  }

  try {
    const publisher = new Redis(env.REDIS_URL, { lazyConnect: true });
    const subscriber = new Redis(env.REDIS_URL, { lazyConnect: true });

    publisher.on("error", (err) => log.error({ err }, "Redis publisher error"));
    subscriber.on("error", (err) =>
      log.error({ err }, "Redis subscriber error")
    );

    streamContext = createResumableStreamContext({
      keyPrefix: "boost-session",
      publisher,
      subscriber,
      waitUntil: (promise) => {
        promise.catch((err) =>
          log.error({ err }, "Error in resumable stream waitUntil")
        );
      },
    });

    return streamContext;
  } catch (error) {
    log.error({ err: String(error) }, "failed to initialize resumable stream");
    streamContext = null;
    return null;
  }
}
