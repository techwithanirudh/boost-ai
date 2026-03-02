import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { SNAPSHOT_PATH } from "@/lib/constants";

export const snapshot = new Hono();

snapshot.get("/", async (c) => {
  try {
    const bytes = await readFile(SNAPSHOT_PATH);
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return c.json({ ok: false, error: "snapshot_unavailable" }, 404);
  }
});
