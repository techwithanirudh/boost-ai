import { env } from "@boost/env/server";
import ky, { HTTPError } from "ky";

export async function fetchLatestFrame(): Promise<string> {
  const url = `${env.MEDIAMTX_BASE_URL}/${env.MEDIAMTX_STREAM_PATH}/get-jpeg-snapshot`;

  try {
    const bytes = await ky.get(url, { timeout: 5_000, retry: 0 }).arrayBuffer();
    const b64 = Buffer.from(bytes).toString("base64");
    return `data:image/jpeg;base64,${b64}`;
  } catch (error) {
    const msg = error instanceof HTTPError ? `http_${error.response.status}` : String(error);
    throw new Error(`frame_fetch_failed: ${msg}`);
  }
}
