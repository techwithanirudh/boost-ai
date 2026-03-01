import { readFile } from "node:fs/promises";

const SNAPSHOT_PATH = "/tmp/snapshot.jpg";

export async function fetchLatestFrame(): Promise<string> {
  try {
    const bytes = await readFile(SNAPSHOT_PATH);
    const b64 = bytes.toString("base64");
    return `data:image/jpeg;base64,${b64}`;
  } catch (error) {
    throw new Error(
      `frame_fetch_failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
