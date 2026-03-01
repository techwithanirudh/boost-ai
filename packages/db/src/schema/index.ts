import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * One session = one mission run.
 *
 * Stores the full AI SDK ModelMessage[] as JSONB so the agent can resume
 * mid-mission without losing tool-call history or context.
 *
 * Migration (from old schema):
 *   ALTER TABLE ai_sessions ADD COLUMN messages jsonb NOT NULL DEFAULT '[]';
 *   ALTER TABLE ai_sessions DROP COLUMN IF EXISTS rolling_summary;
 *   DROP TABLE IF EXISTS ai_messages;
 */
export const aiSessions = pgTable("ai_sessions", {
  id: text("id").primaryKey(),
  missionId: text("mission_id"),
  goal: text("goal").notNull(),
  /** Full ModelMessage[] history. Trimmed to config.history.limit on every save. */
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
