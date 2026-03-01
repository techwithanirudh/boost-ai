# Refactor Plan - BTS Robot Stack (`apps/server`, `apps/hub`, `apps/web`)

## 1. Goal
Refactor the repo into a production-oriented monorepo where:
- `apps/server` (Hono + Bun) is the AI orchestrator and mission API.
- `apps/hub` (FastAPI + pylgbst) is the LEGO BOOST control plane on Pi.
- `apps/web` (TanStack Router) is the remote operator UI.
- Neon Postgres (via Drizzle) stores mission, run, step, tool, and telemetry data.

Control model is strict **Sense -> Think -> Act (single action per step)** using RGB + depth input.

## 2. Final Architecture

```text
Camera source (iPhone Larix / RTSP / bridge)
  -> Frame ingest (RGB + optional depth)
  -> apps/server (Hono orchestrator)
      -> AI SDK provider (Gemini/Codex/OpenAI-compatible)
      -> single tool decision
      -> HTTP call to apps/hub
      -> persist run state to Neon

apps/hub (FastAPI + pylgbst)
  -> BLE connect to LEGO Move Hub
  -> execute motion command
  -> watchdog + emergency stop
  -> return ack/result

apps/web (TanStack)
  -> start/stop mission
  -> stream state and logs
  -> manual emergency stop
```

## 3. Service Responsibilities

### `apps/server` (Hono)
- Mission lifecycle management.
- Frame/depth ingest and latest-frame indexing.
- AI loop orchestration and tool validation.
- Calls `apps/hub` motion endpoints.
- Writes all state transitions and telemetry to DB.

### `apps/hub` (FastAPI)
- BLE connection lifecycle.
- Motion execution primitives.
- Safety checks (bounds, watchdog, estop).
- Health/readiness status.

### `apps/web` (TanStack)
- Operator controls.
- Mission dashboard.
- Run timeline, tool calls, and failure states.

## 4. API Contracts (first version)

### `apps/server` public routes
- `POST /v1/missions/start`
- `POST /v1/missions/:missionId/step`
- `POST /v1/missions/:missionId/stop`
- `POST /v1/missions/:missionId/frames` (RGB + depth metadata)
- `GET /v1/missions/:missionId/state`
- `GET /v1/runs/:runId/steps`
- `GET /v1/health`

### `apps/hub` internal routes
- `GET /health`
- `GET /hub/state`
- `POST /motion/forward`
- `POST /motion/backward`
- `POST /motion/turn`
- `POST /motion/stop`
- `POST /motion/emergency-stop`

### Standard response envelope (both services)
```json
{
  "ok": true,
  "data": {},
  "error": null,
  "traceId": "..."
}
```

## 5. Motion & Safety Rules

- Allowed tools: `forward_cm`, `backward_cm`, `turn_deg`, `stop`.
- Per-step limits:
  - forward/backward: `5..30` cm
  - turn: `-90..90` deg
- If model confidence is low or scene unclear -> force `stop`.
- No multi-action response; exactly one action per step.
- Watchdog in `apps/hub` auto-stops if no heartbeat/command confirmation within timeout.
- Manual estop is always accepted and preempts all commands.

## 6. Data Model (Drizzle on Neon)

### Tables
- `missions`
  - `id`, `name`, `goal`, `status`, `created_at`, `updated_at`
- `runs`
  - `id`, `mission_id`, `status`, `started_at`, `ended_at`, `stop_reason`
- `run_steps`
  - `id`, `run_id`, `seq`, `frame_ref`, `depth_ref`, `model_input_summary`, `model_output_raw`, `decision`, `created_at`
- `tool_calls`
  - `id`, `run_step_id`, `tool_name`, `args_json`, `validated_args_json`, `hub_status`, `latency_ms`, `error_text`, `created_at`
- `telemetry_events`
  - `id`, `run_id`, `level`, `component`, `event_type`, `payload_json`, `created_at`

### Indexes
- `runs(mission_id, started_at desc)`
- `run_steps(run_id, seq)` unique
- `tool_calls(run_step_id)`
- `telemetry_events(run_id, created_at desc)`

## 7. AI Loop Definition (authoritative)

For each `step`:
1. Load mission + run state.
2. Resolve latest RGB and depth artifacts.
3. Build model context:
   - mission goal
   - last action + result
   - current safety hints
4. Request **one** action from model.
5. Parse/validate action against limits.
6. Execute on `apps/hub`.
7. Persist `run_steps` + `tool_calls` + telemetry.
8. Return step result and next expected state.

Fallback handling:
- If model outputs plain text intent, parse with deterministic parser.
- If parse fails, record failure and issue `stop`.

## 8. Repo/File Refactor Plan

### `apps/server`
- `src/index.ts` -> router setup + middleware.
- `src/routes/mission.ts` -> mission APIs.
- `src/routes/health.ts`
- `src/services/ai-orchestrator.ts`
- `src/services/tool-dispatcher.ts`
- `src/services/frame-store.ts`
- `src/db/*` use `packages/db`.

### `apps/hub` (new)
- `main.py` FastAPI app + routes.
- `hub/service.py` BLE connect + command exec.
- `hub/safety.py` watchdog + estop.
- `hub/models.py` pydantic request/response models.
- `requirements.txt`, `Dockerfile`, `.env.example`.

### `packages/db`
- Add schema files for mission/run/step/tool/telemetry.
- Add migration and seed scaffolding.

### `apps/web`
- Mission controls page.
- Live run page.
- Tool call/telemetry panel.
- Estop action button.

## 9. Docker/Runtime Plan

### Compose services (phase 1)
- `server` (Bun Hono)
- `hub` (Python FastAPI)

### Optional services
- `redis` (if async queue introduced)

### Profiles
- `dev`: web + server + hub
- `pi`: server + hub only

### Networking
- `server` calls `http://hub:8000`
- `web` calls `server` via LAN/public URL

## 10. Env Vars

### `apps/server/.env`
- `NODE_ENV=development`
- `PORT=3000`
- `CORS_ORIGIN=`
- `DATABASE_URL=`
- `AI_PROVIDER=google`
- `AI_MODEL=`
- `GOOGLE_API_KEY=`
- `HUB_BASE_URL=http://hub:8000`
- `STEP_TIMEOUT_MS=15000`

### `apps/hub/.env`
- `PORT=8000`
- `HUB_MAC=`
- `HUB_CONNECT_TIMEOUT_S=300`
- `WATCHDOG_TIMEOUT_S=5`
- `MOTOR_DEFAULT_SPEED=0.5`
- `COMMAND_TIMEOUT_S=10`

## 11. Execution Phases (detailed)

### Phase A - Skeleton + Contracts
- Create `apps/hub` FastAPI app scaffold.
- Add base routes in server and hub with typed schemas.
- Add shared error envelope and request tracing.
- Output: both services healthy and reachable.

### Phase B - DB + Mission State
- Implement Drizzle schema + migrations.
- Add mission/run CRUD in server.
- Output: mission lifecycle persisted in Neon.

### Phase C - Motion Control Integration
- Implement hub motion endpoints + BLE connect loop + watchdog.
- Implement server tool dispatcher to hub.
- Output: manual motion command from server reaches LEGO hub.

### Phase D - AI Single-Step Loop
- Integrate AI SDK call in server.
- Implement deterministic action parser/validator.
- Persist model output and tool result.
- Output: `/step` returns real action execution result.

### Phase E - Vision + Depth Ingest
- Add frame ingest endpoint and storage/indexing.
- Add depth payload support (Apple depth or proxy map).
- Include depth summary in model context.
- Output: step loop consumes latest RGB+depth.

### Phase F - Web Ops UI + Hardening
- Build UI for mission/run state, timeline, estop.
- Add retry/backoff and degraded-state handling.
- Add production compose profile and docs.
- Output: operator can run full loop from web.

## 12. Acceptance Criteria

- `apps/server` and `apps/hub` run on Pi via compose profile `pi`.
- Start mission -> run created in Neon.
- Step execution picks exactly one bounded action.
- Action reaches LEGO hub and returns ack.
- Failures force safe `stop` and are logged.
- Web shows latest state + last N tool calls.

## 13. Risks and Mitigations

- BLE instability: reconnect policy + watchdog estop.
- Model invalid output: strict parser + bounds clamp + fallback stop.
- Latency spikes: step timeout + telemetry + retry strategy.
- Depth availability drift: operate with RGB-only fallback and explicit flag.

## 14. Immediate Next Implementation Slice

1. Create `apps/hub` scaffold with `health` and `motion/stop` first.
2. Add `server -> hub` HTTP client and `POST /v1/missions/:id/stop` passthrough.
3. Add initial DB schema (`missions`, `runs`, `tool_calls`).
4. Add compose (`server`, `hub`) and verify end-to-end stop command path.
