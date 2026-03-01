import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * One session = one autonomous mission run.
 *
 * Stores the full AI SDK ModelMessage[] as JSONB so the agent can resume
 * without losing tool-call history or context.
 */
export const aiSessions = pgTable("ai_sessions", {
  id: text("id").primaryKey(),
  goal: text("goal").notNull(),
  status: text("status")
    .$type<"running" | "stopped" | "completed">()
    .notNull()
    .default("running"),
  /** Full ModelMessage[] history. Trimmed to config.history.limit on every save. */
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
