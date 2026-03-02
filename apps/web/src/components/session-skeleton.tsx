import { Skeleton } from "@/components/ui/skeleton";

const HISTORY_SKELETON_IDS = [
  "history-skeleton-1",
  "history-skeleton-2",
  "history-skeleton-3",
  "history-skeleton-4",
  "history-skeleton-5",
  "history-skeleton-6",
] as const;

export function SessionSkeleton() {
  return (
    <>
      {HISTORY_SKELETON_IDS.map((id) => (
        <Skeleton className="h-11 w-full" key={id} />
      ))}
    </>
  );
}
