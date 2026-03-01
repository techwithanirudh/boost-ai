import { env } from "@boost/env/server";
import ky, { HTTPError } from "ky";

/**
 * Fetch the latest JPEG snapshot from MediaMTX and return it as a base64
 * data URL suitable for passing directly as an AI SDK image part.
 *
 * MediaMTX exposes: GET <MEDIAMTX_SNAPSHOT_URL>
 * e.g. http://mediamtx:8888/cam/get-jpeg-snapshot
 */
export async function fetchLatestFrame(): Promise<string> {
  try {
    const bytes = await ky
      .get(env.MEDIAMTX_SNAPSHOT_URL, { timeout: 5_000, retry: 0 })
      .arrayBuffer();

    const b64 = Buffer.from(bytes).toString("base64");
    return `data:image/jpeg;base64,${b64}`;
  } catch (error) {
    const msg = error instanceof HTTPError
      ? `http_${error.response.status}`
      : String(error);
    throw new Error(`frame_fetch_failed: ${msg}`);
  }
}
