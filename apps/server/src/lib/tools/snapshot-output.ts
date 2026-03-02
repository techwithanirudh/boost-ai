import { fetchFrame } from "@/services/frame";

const SNAPSHOT_TIMEOUT_MS = 3000;

export async function captureSnapshot(): Promise<string | null> {
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), SNAPSHOT_TIMEOUT_MS)
  );
  const frame = await Promise.race([
    fetchFrame()
      .then((f) => f.dataUrl)
      .catch(() => null),
    timeout,
  ]);
  return frame;
}

export function snapshotToModelOutput(
  snapshot: string | null,
  textSummary: string
): {
  type: "content";
  value: (
    | { type: "text"; text: string }
    | { type: "media"; data: string; mediaType: string }
  )[];
} {
  const textPart = { type: "text" as const, text: textSummary };

  if (!snapshot?.startsWith("data:")) {
    return { type: "content", value: [textPart] };
  }

  const commaIdx = snapshot.indexOf(",");
  const rawBase64 = commaIdx !== -1 ? snapshot.slice(commaIdx + 1) : snapshot;

  const mediaType =
    snapshot.slice(5, commaIdx !== -1 ? snapshot.indexOf(";") : 5) ||
    "image/jpeg";

  return {
    type: "content",
    value: [textPart, { type: "media" as const, data: rawBase64, mediaType }],
  };
}
