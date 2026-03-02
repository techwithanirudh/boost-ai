import { useQuery } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { snapshotQuery } from "@/lib/queries";

export function CameraFeed() {
  const { data: tick } = useQuery(snapshotQuery);

  if (!tick) {
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
      src={`/api/v1/snapshot?t=${tick}`}
    />
  );
}
