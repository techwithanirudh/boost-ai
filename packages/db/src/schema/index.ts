import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Minimal AI SDK chat persistence shape.
 */
export const chats = pgTable("chats", {
  id: text("id").primaryKey(),
  goal: text("goal").notNull().default(""),
  status: text("status")
    .$type<"running" | "stopped" | "completed">()
    .notNull()
    .default("running"),
  messages: jsonb("messages").notNull().default([]),
  activeStreamId: text("active_stream_id"),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
