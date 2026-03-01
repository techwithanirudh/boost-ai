import { env } from "@boost/env/server";
import type { ActionDecision } from "@boost/validators";
import ky, { HTTPError, type KyInstance } from "ky";

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

export interface HubResult<T = unknown> {
  data: T | null;
  error: string | null;
  ok: boolean;
}

export interface HubHealthData {
  connected: boolean;
  service: string;
}

export interface HubStateData {
  connected: boolean;
  watchdog_expired: boolean;
}

// ---------------------------------------------------------------------------
// HubClient
// ---------------------------------------------------------------------------

export class HubClient {
  private readonly http: KyInstance;

  constructor(baseUrl: string, timeoutMs: number) {
    this.http = ky.create({
      prefixUrl: baseUrl,
      timeout: timeoutMs,
      retry: 0,
    });
  }

  async getHealth(): Promise<HubResult<HubHealthData>> {
    try {
      const data = await this.http.get("health").json<HubHealthData>();
      return { ok: true, data, error: null };
    } catch (error) {
      return { ok: false, data: null, error: toErrorMessage(error) };
    }
  }

  async getState(): Promise<HubResult<HubStateData>> {
    try {
      const data = await this.http.get("hub/state").json<HubStateData>();
      return { ok: true, data, error: null };
    } catch (error) {
      return { ok: false, data: null, error: toErrorMessage(error) };
    }
  }

  async executeAction(decision: ActionDecision): Promise<HubResult> {
    try {
      const data = await this.http
        .post("motion/execute", { json: decision })
        .json();
      return { ok: true, data, error: null };
    } catch (error) {
      return { ok: false, data: null, error: toErrorMessage(error) };
    }
  }

  async emergencyStop(): Promise<HubResult> {
    try {
      const data = await this.http.post("motion/emergency-stop").json();
      return { ok: true, data, error: null };
    } catch (error) {
      return { ok: false, data: null, error: toErrorMessage(error) };
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toErrorMessage(error: unknown): string {
  if (error instanceof HTTPError) {
    return `http_${error.response.status}: ${error.message}`;
  }
  return String(error);
}

// ---------------------------------------------------------------------------
// Singleton — shared across the application
// ---------------------------------------------------------------------------

export const hub = new HubClient(env.HUB_BASE_URL, env.STEP_TIMEOUT_MS);
