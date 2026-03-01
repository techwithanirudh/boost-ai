import { readFile } from "node:fs/promises";

const SNAPSHOT_PATH = "/tmp/snapshot.jpg";

export interface Frame {
  buffer: Buffer;
  dataUrl: string;
}

export async function fetchFrame(): Promise<Frame> {
  try {
    const buffer = await readFile(SNAPSHOT_PATH) as Buffer;
    const dataUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    return { buffer, dataUrl };
  } catch (error) {
    throw new Error(
      `frame_fetch_failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
