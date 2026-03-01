const BASE = "/api";

export type SessionStatus = "running" | "stopped" | "completed";

export interface SessionResult {
  sessionId: string;
  status: SessionStatus;
  steps: number;
  text: string;
}

export interface HealthResult {
  data: {
    service: string;
    hub: { ok: boolean; data?: { connected: boolean } };
  } | null;
  ok: boolean;
}

export interface SessionRow {
  createdAt: string;
  goal: string;
  id: string;
  status: SessionStatus;
  updatedAt: string;
}

async function post<T>(
  path: string,
  body: unknown
): Promise<{ ok: boolean; data: T | null; error: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function get<T>(
  path: string
): Promise<{ ok: boolean; data: T | null; error: unknown }> {
  const res = await fetch(`${BASE}${path}`);
  return res.json();
}

export const api = {
  health: () => get<HealthResult["data"]>("/v1/health"),

  startSession: (goal: string, id?: string) =>
    post<SessionResult>("/v1/sessions", { goal, ...(id ? { id } : {}) }),

  getSession: (id: string) => get<SessionRow>(`/v1/sessions/${id}`),

  stopSession: (id: string) =>
    post<{ sessionId: string; status: SessionStatus }>(
      `/v1/sessions/${id}/stop`,
      {}
    ),
};
