import { env } from "@boost/env/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("depth");
const MODEL_URL = "https://api-inference.huggingface.co/models/apple/DepthPro";

export async function fetchDepthMap(buffer: Buffer): Promise<string | null> {
  if (!env.HF_API_TOKEN) {
    return null;
  }

  try {
    const response = await fetch(MODEL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.HF_API_TOKEN}`,
        "Content-Type": "application/octet-stream",
      },
      body: buffer,
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      log.warn({ status: response.status, body }, "depth api error");
      return null;
    }

    const ab = await response.arrayBuffer();
    const b64 = Buffer.from(ab).toString("base64");
    const contentType = response.headers.get("content-type") ?? "image/png";
    return `data:${contentType};base64,${b64}`;
  } catch (error) {
    log.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "depth map unavailable"
    );
    return null;
  }
}
