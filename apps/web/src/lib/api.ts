const BASE = "/api";

export type SessionStatus = "running" | "stopped" | "completed";

export interface SessionResult {
  sessionId: string;
  status: SessionStatus;
  steps: number;
  text: string;
}

export type SessionStreamEvent =
  | { type: "session_started"; sessionId: string; goal: string }
  | {
      type: "session_result";
      sessionId: string;
      status: SessionStatus;
      steps: number;
      text: string;
    }
  | { type: "session_complete"; sessionId: string; status: SessionStatus }
  | { type: "session_error"; sessionId: string; error: string }
  | { type: "heartbeat"; ts: number };

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

function handleSSELine(
  rawLine: string,
  state: { currentEvent: string | null },
  onEvent: (event: SessionStreamEvent) => void
) {
  const line = rawLine.trim();
  if (!line) {
    state.currentEvent = null;
    return;
  }

  if (line.startsWith("event:")) {
    state.currentEvent = line.slice(6).trim();
    return;
  }

  if (!(line.startsWith("data:") && state.currentEvent)) {
    return;
  }

  const raw = line.slice(5).trim();
  const parsed = JSON.parse(raw) as Omit<SessionStreamEvent, "type">;
  onEvent({
    type: state.currentEvent as SessionStreamEvent["type"],
    ...parsed,
  } as SessionStreamEvent);
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

  streamSession: async (
    goal: string,
    handlers: {
      id?: string;
      onEvent: (event: SessionStreamEvent) => void;
      signal?: AbortSignal;
    }
  ) => {
    const res = await fetch(`${BASE}/v1/sessions/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal,
        ...(handlers.id ? { id: handlers.id } : {}),
      }),
      signal: handlers.signal,
    });

    if (!(res.ok && res.body)) {
      throw new Error(`stream_failed_${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const state = { currentEvent: null as string | null };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        handleSSELine(rawLine, state, handlers.onEvent);
      }
    }
  },
};
