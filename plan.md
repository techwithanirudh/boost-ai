# BTS Refactor Plan - LEGO BOOST Vision Agent

## Objective
Refactor this repo into a Better-T-Stack monorepo with:
1. `apps/server` (Hono + Bun + AI SDK) as the AI orchestrator API.
2. `apps/pyhub` (FastAPI + pylgbst) as LEGO BOOST motor control service on the Pi.
3. `apps/web` (TanStack Router) frontend on a different host.
4. Neon Postgres via Drizzle for missions, runs, telemetry, and tool logs.

The runtime control loop is vision-first:
- Capture RGB frame + depth map.
- Send both to model context.
- Receive exactly one action tool call (`forward`, `backward`, `turn`, `stop`).
- Execute against `pyhub`, store result, then re-sense.

## Target Architecture

```text
[iPhone/Larix or camera source]
   -> frame bridge (RGB + depth estimates)
   -> Hono AI Orchestrator (apps/server)
      -> AI SDK provider call (Gemini/Codex/OpenAI-compatible)
      -> tool decision (single step)
      -> pyhub HTTP call
      -> Drizzle write (run step/event)

[FastAPI pyhub service]
   -> pylgbst BLE comms
   -> motor command execution
   -> state + health

[Web UI]
   -> mission controls
   -> live state + run logs
```

## Service Contracts

### Hono API (`apps/server`)
- `POST /v1/missions/start`
- `POST /v1/missions/:id/step` (ingests latest RGB + depth payload metadata)
- `POST /v1/missions/:id/stop`
- `GET /v1/missions/:id/state`
- `GET /v1/health`

Internal tool handlers:
- `move_forward_cm(distance_cm, speed)`
- `move_backward_cm(distance_cm, speed)`
- `turn_deg(angle_deg, speed)`
- `stop()`

### pyhub API (`apps/pyhub`)
- `GET /health`
- `POST /motion/forward`
- `POST /motion/backward`
- `POST /motion/turn`
- `POST /motion/stop`
- `GET /hub/state`

## Data Model (Drizzle + Neon)
- `missions`: mission config and status.
- `runs`: active/finished run metadata.
- `run_steps`: one row per sense-think-act cycle.
- `tool_calls`: requested tool args, ack, latency, and error fields.
- `telemetry_events`: BLE/API/AI warnings and debug events.

## Control Loop (authoritative)
1. Read latest RGB frame and depth map (or depth proxy when unavailable).
2. Build model context: mission goal + latest safety state + last action result.
3. Ask model for exactly one next action.
4. Validate action bounds:
   - forward/backward: 5-30 cm
   - turn: up to 90 deg
5. Execute via pyhub.
6. Persist step + tool result to DB.
7. Repeat until stop condition.

Safety rules:
- If uncertainty is high, call `stop`.
- Never chain multiple blind moves in one step.
- Hard timeout + watchdog must stop motors on missed acknowledgements.

## Implementation Phases

### Phase 1 - Monorepo service shape
- Keep `apps/server` as Hono orchestrator.
- Add `apps/pyhub` FastAPI project with Dockerfile and requirements.
- Add root `docker-compose.yml` for `server`, `pyhub`, optional `redis` (if queue needed).

### Phase 2 - DB and contracts
- Add Drizzle schema for mission/run/tool telemetry tables.
- Add server routes + typed DTO validation.
- Add pyhub motion endpoints and health/readiness status.

### Phase 3 - AI tool loop
- Integrate AI SDK model call in `apps/server`.
- Add tool-to-pyhub dispatcher.
- Add action parser fallback for plain-text outputs.

### Phase 4 - Vision/depth ingestion
- Add frame ingest endpoint and storage policy.
- Add depth map support path (Apple depth stream -> normalized payload).
- Feed RGB + depth references into loop state.

### Phase 5 - Operations
- Add production compose profile for Pi (API + pyhub only).
- Add observability logs and retry/backoff policies.
- Add startup/readiness orchestration and watchdog checks.

## Environment Variables

### `apps/server/.env`
- `GOOGLE_API_KEY=`
- `AI_PROVIDER=google|openai|codex`
- `AI_MODEL=`
- `PYHUB_BASE_URL=http://pyhub:8000`
- `DATABASE_URL=` (Neon)
- `CORS_ORIGIN=`

### `apps/pyhub/.env`
- `HUB_MAC=`
- `HUB_CONNECT_TIMEOUT_S=300`
- `WATCHDOG_TIMEOUT_S=5`
- `MOTOR_DEFAULT_SPEED=0.5`

## Done Criteria
- Pi can run `apps/server` + `apps/pyhub` with compose.
- `POST /v1/missions/:id/step` produces one validated motor action.
- pyhub executes and acknowledges command.
- Step/tool logs are persisted in Neon.
- Web UI can display mission state and recent tool calls.
