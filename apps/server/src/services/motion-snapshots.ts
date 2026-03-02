import { fetchFrame } from "./frame";

export async function captureMotionSnapshots(
  durationMs: number,
  count: number
): Promise<string[]> {
  const captures = Array.from({ length: count }, (_, i) => {
    const delayMs =
      count === 1 ? 0 : Math.round((durationMs / (count - 1)) * i);
    return new Promise<string>((resolve) => {
      setTimeout(() => {
        fetchFrame()
          .then((f) => resolve(f.dataUrl))
          .catch(() => resolve(""));
      }, delayMs);
    });
  });
  const results = await Promise.all(captures);
  return results.filter((s) => s.length > 0);
}
