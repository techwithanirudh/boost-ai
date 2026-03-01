import type { Context } from "hono";
import { hub } from ".";

export async function requireHub(c: Context): Promise<Response | null> {
  const h = await hub.getHealth().catch(() => null);
  if (h?.ok && h.data?.connected) {
    return null;
  }
  return c.json({ ok: false, data: null, error: "hub_not_ready" }, 503);
}
