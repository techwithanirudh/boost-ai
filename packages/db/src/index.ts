import { env } from "@ev3/env/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { chats } from "./schema";

const sql = neon(env.DATABASE_URL);
export const db = drizzle(sql, { schema: { chats } });
