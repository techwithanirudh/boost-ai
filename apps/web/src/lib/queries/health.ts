import { queryOptions } from "@tanstack/react-query";

interface HealthData {
  hub?: { ok: boolean; error?: string | null; battery?: number | null };
  service?: string;
}

interface HealthResponse {
  data?: HealthData | null;
}

async function fetchHealth(): Promise<HealthData | null> {
  const res = await fetch("/api/v1/health");
  if (!res.ok) {
    throw new Error("health_request_failed");
  }
  const payload = (await res.json()) as HealthResponse;
  return payload.data ?? null;
}

export const healthQuery = queryOptions({
  queryKey: ["health"],
  queryFn: fetchHealth,
  refetchInterval: 5000,
  retry: false,
});
