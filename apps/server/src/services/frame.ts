import { env } from "@boost/env/server";
import { $ } from "bun";

async function captureFrame(rtspUrl: string): Promise<Buffer> {
  const { exitCode, stderr, stdout } =
    await $`ffmpeg -hide_banner -loglevel error -rtsp_transport tcp -i ${rtspUrl} -frames:v 1 -f image2pipe -vcodec mjpeg pipe:1`
      .nothrow()
      .quiet();

  if (exitCode !== 0) {
    const stderrText = stderr.toString("utf8").trim();
    throw new Error(`ffmpeg_failed_exit_${exitCode}: ${stderrText}`);
  }

  if (stdout.length === 0) {
    throw new Error("ffmpeg_returned_empty_frame");
  }

  return stdout;
}

export interface Frame {
  buffer: Buffer;
  dataUrl: string;
}

export async function fetchFrame(): Promise<Frame> {
  try {
    const buffer = await captureFrame(env.RTSP_SNAPSHOT_URL);
    const dataUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    return { dataUrl, buffer };
  } catch (error) {
    throw new Error(
      `frame_fetch_failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
