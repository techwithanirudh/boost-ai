import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function CameraFeed() {
  const [url, setUrl] = useState<string | null>(null);
  const prevUrl = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const res = await fetch("/api/v1/snapshot").catch(() => null);
      if (cancelled || !res?.ok) {
        return;
      }
      const blob = await res.blob();
      const next = URL.createObjectURL(blob);
      if (!cancelled) {
        if (prevUrl.current) {
          URL.revokeObjectURL(prevUrl.current);
        }
        prevUrl.current = next;
        setUrl(next);
      }
    };

    load();
    const intervalId = setInterval(load, 2000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      if (prevUrl.current) {
        URL.revokeObjectURL(prevUrl.current);
      }
    };
  }, []);

  if (!url) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-md border bg-muted">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Camera className="size-5" />
          <span className="text-xs">Camera offline</span>
        </div>
      </div>
    );
  }

  return (
    // biome-ignore lint/correctness/useImageSize: dynamic camera stream
    <img
      alt="Robot camera view"
      className="aspect-video w-full rounded-md border object-cover"
      src={url}
    />
  );
}
