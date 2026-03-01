import { env } from "@boost/env/server";
import type { ActionDecision } from "@boost/validators";

type HubResult = {
  ok: boolean;
  data?: unknown;
  error?: unknown;
};

export async function getHealth(): Promise<HubResult> {
  try {
    const response = await fetch(`${env.HUB_BASE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2_000),
    });

    const body = await response.json().catch(() => null);

    return {
      ok: response.ok,
      data: body,
      error: response.ok ? null : body,
    };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

export async function getState(): Promise<HubResult> {
  try {
    const response = await fetch(`${env.HUB_BASE_URL}/hub/state`, {
      method: "GET",
      signal: AbortSignal.timeout(2_000),
    });

    const body = await response.json().catch(() => null);

    return {
      ok: response.ok,
      data: body,
      error: response.ok ? null : body,
    };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

export async function executeAction(decision: ActionDecision): Promise<HubResult> {
  try {
    const response = await fetch(`${env.HUB_BASE_URL}/motion/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(decision),
      signal: AbortSignal.timeout(env.STEP_TIMEOUT_MS),
    });

    const body = await response.json().catch(() => null);

    return {
      ok: response.ok,
      data: body,
      error: response.ok ? null : body,
    };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
