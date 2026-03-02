import { queryOptions } from "@tanstack/react-query";

async function pollSnapshot(): Promise<number | null> {
  const res = await fetch("/api/v1/snapshot", { method: "HEAD" }).catch(
    () => null
  );
  return res?.ok ? Date.now() : null;
}

export const snapshotQuery = queryOptions({
  queryKey: ["snapshot"],
  queryFn: pollSnapshot,
  refetchInterval: 2000,
  retry: false,
  staleTime: 0,
});
