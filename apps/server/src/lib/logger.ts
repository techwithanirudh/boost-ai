type Level = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const activeLevel: Level =
  (process.env.LOG_LEVEL as Level | undefined) &&
  LEVEL_RANK[process.env.LOG_LEVEL as Level] !== undefined
    ? (process.env.LOG_LEVEL as Level)
    : "info";

function log(level: Level, obj: unknown, msg?: string): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[activeLevel]) {
    return;
  }

  const ts = new Date().toISOString();
  const prefix = `[${ts}] ${level.toUpperCase()}`;
  const message = msg ?? (typeof obj === "string" ? obj : "");
  const data = msg !== undefined ? obj : undefined;

  if (data !== undefined) {
    console[level === "debug" ? "log" : level](`${prefix} ${message}`, data);
  } else {
    console[level === "debug" ? "log" : level](`${prefix} ${message}`);
  }
}

const logger = {
  debug: (obj: unknown, msg?: string) => log("debug", obj, msg),
  info: (obj: unknown, msg?: string) => log("info", obj, msg),
  warn: (obj: unknown, msg?: string) => log("warn", obj, msg),
  error: (obj: unknown, msg?: string) => log("error", obj, msg),
  child: (bindings: Record<string, unknown>) => ({
    debug: (obj: unknown, msg?: string) =>
      log(
        "debug",
        { ...bindings, ...(typeof obj === "object" ? obj : { msg: obj }) },
        msg
      ),
    info: (obj: unknown, msg?: string) =>
      log(
        "info",
        { ...bindings, ...(typeof obj === "object" ? obj : { msg: obj }) },
        msg
      ),
    warn: (obj: unknown, msg?: string) =>
      log(
        "warn",
        { ...bindings, ...(typeof obj === "object" ? obj : { msg: obj }) },
        msg
      ),
    error: (obj: unknown, msg?: string) =>
      log(
        "error",
        { ...bindings, ...(typeof obj === "object" ? obj : { msg: obj }) },
        msg
      ),
  }),
};

export function createLogger(context: string) {
  return logger.child({ context });
}

export default logger;
