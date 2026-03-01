import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "yyyy-mm-dd HH:MM:ss.l",
        ignore: "pid,hostname",
        messageFormat: "{if context}[{context}] {end}{msg}",
      },
    },
  }),
});

export function createLogger(context: string) {
  return logger.child({ context });
}

export default logger;
