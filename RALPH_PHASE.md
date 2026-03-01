# RALPH PHASE - Research-First Refactor Plan

## Purpose
`RALPH PHASE` is the execution plan for refactoring this repo into:
- `apps/server` (Hono + Bun) AI orchestration API
- `apps/hub` (FastAPI + pylgbst) LEGO BOOST control service
- `apps/web` (TanStack Router) remote UI
- `packages/db` (Drizzle + Neon)

This plan starts with research validation, then scaffolding, then incremental integration.

---

## R0 - Research Baseline (Do this first)

### What we validated
1. Hono on Bun is officially supported and suitable for long-lived servers.
2. TanStack Router Vite plugin generates `routeTree.gen.ts`; plugin order matters.
3. FastAPI Docker guidance favors building from `python` base + `uvicorn`, not legacy FastAPI base image.
4. Drizzle + Neon use standard `DATABASE_URL`; pooled Neon URL is recommended for concurrency.
5. `pylgbst` supports Move Hub via BLE (typically with `bleak` backend).

### Primary references
- Hono Bun: https://hono.dev/getting-started/bun
- Hono basic getting started: https://hono.dev/docs/getting-started/basic
- TanStack Router + Vite: https://tanstack.com/router/v1/docs/framework/react/routing/installation-with-vite
- FastAPI Docker deployment: https://fastapi.tiangolo.com/deployment/docker/
- Drizzle + Neon tutorial: https://orm.drizzle.team/docs/tutorials/drizzle-with-neon
- Neon connection docs: https://neon.com/docs/get-started-with-neon/connect-neon
- pylgbst repository: https://github.com/undera/pylgbst

### Decisions locked from research
- Service name is `apps/hub` (not `apps/pyhub`).
- `apps/server` talks to `apps/hub` over internal HTTP.
- Single-action control loop per step (`forward/backward/turn/stop`).
- Neon remains managed externally (no local Postgres on Pi).

---

## R1 - Scaffold Topology

### Target tree
```text
apps/
  server/          # Hono orchestrator
  hub/             # FastAPI + pylgbst
  web/             # TanStack UI
packages/
  db/              # Drizzle schema + migrations
  env/             # env validation
```

### Scaffold tasks
1. Create `apps/hub` Python service structure.
2. Add `apps/hub/requirements.txt`, `Dockerfile`, `.env.example`.
3. Add hub health endpoint and stop endpoint first.
4. Add root `docker-compose.yml` with `server` + `hub`.
5. Add optional `docker-compose.pi.yml` profile for Pi runtime.

### Commands (planned)
```bash
mkdir -p apps/hub/{hub,tests}
touch apps/hub/main.py apps/hub/hub/{service.py,safety.py,models.py}
touch apps/hub/requirements.txt apps/hub/.env.example apps/hub/Dockerfile
```

---

## R2 - Contract-First API Design

### `apps/hub` endpoints
- `GET /health`
- `GET /hub/state`
- `POST /motion/forward`
- `POST /motion/backward`
- `POST /motion/turn`
- `POST /motion/stop`
- `POST /motion/emergency-stop`

### `apps/server` endpoints
- `POST /v1/missions/start`
- `POST /v1/missions/:missionId/frames`
- `POST /v1/missions/:missionId/step`
- `POST /v1/missions/:missionId/stop`
- `GET /v1/missions/:missionId/state`
- `GET /v1/runs/:runId/steps`
- `GET /v1/health`

### Shared envelope
```json
{ "ok": true, "data": {}, "error": null, "traceId": "..." }
```

### Validation rules
- forward/backward: `5..30 cm`
- turn: `-90..90 deg`
- default speed: `0.5`
- unknown / invalid action => force `stop`

---

## R3 - Database Phase (Drizzle + Neon)

### Tables
- `missions`
- `runs`
- `run_steps`
- `tool_calls`
- `telemetry_events`

### Minimal first migration
1. `missions`
2. `runs`
3. `tool_calls`

### Drizzle flow
```bash
bun run db:generate
bun run db:migrate
```

### DB acceptance checks
- Can create mission and run.
- Can write tool call with ack/error fields.
- Query latest run state in one indexed query.

---

## R4 - Hub Implementation Phase

### Scope
- BLE connect lifecycle with timeout + reconnect.
- Motion primitives wrapped behind service methods.
- Watchdog timeout -> automatic stop.
- `emergency-stop` always preempts.

### Guardrails
- Reject command when hub not connected.
- Clamp out-of-range motion args.
- Return deterministic error codes (`HUB_DISCONNECTED`, `INVALID_ARGS`, `TIMEOUT`).

### Hub done criteria
- `/health` returns readiness and BLE state.
- `/motion/stop` works even during command failures.
- Logs include command id + latency.

---

## R5 - Server Orchestration Phase

### Scope
- Add hub client service in Hono.
- Implement mission lifecycle and run state transitions.
- Build single-step loop endpoint (`/step`):
  1. load latest frame/depth
  2. call model
  3. parse one action
  4. validate + execute on hub
  5. persist step + tool call

### AI abstraction
- `AI_PROVIDER` env switch (`google|openai|codex`).
- normalize model output to one `ActionDecision` object.
- fallback parser for plain text action responses.

### Server done criteria
- `/step` always results in either one tool execution or safe stop.
- every step persisted with trace id.
- failure path never leaves motors running.

---

## R6 - Vision & Depth Ingestion

### Scope
- add frame ingest endpoint with metadata.
- store only latest N frames metadata (bounded retention).
- support depth payload as:
  - native depth map reference, or
  - derived depth summary when full map unavailable.

### Payload contract (draft)
```json
{
  "frameRef": "...",
  "capturedAt": "...",
  "rgb": { "width": 1280, "height": 720, "mime": "image/jpeg" },
  "depth": { "available": true, "format": "apple-depth", "ref": "..." }
}
```

### done criteria
- `/step` can run with RGB+depth, and with RGB-only fallback.
- depth availability is logged in run step.

---

## R7 - Web Ops Surface

### Views
- Mission list/detail
- Active run state
- Timeline of steps/tool calls
- Emergency stop button

### UX constraints
- show action latency and hub state badge.
- show model decision + executed action side-by-side.
- preserve full event history for debugging.

---

## R8 - Docker & Pi Runtime

### Compose strategy
- `docker-compose.yml` for local dev
- `docker-compose.pi.yml` for Pi (no web, no local Postgres)

### Pi profile
- run only `server` + `hub`
- connect to Neon through `DATABASE_URL`
- memory bounds and restart policies enabled

### Ops commands
```bash
sudo docker compose -f docker-compose.yml up -d --build
sudo docker compose -f docker-compose.pi.yml up -d --build
sudo docker compose logs -f server hub
```

---

## R9 - Execution Order (actual work queue)

1. Scaffold `apps/hub` + compose wiring.
2. Implement hub health + stop + emergency-stop.
3. Add server->hub client and stop passthrough route.
4. Add initial Drizzle migration (`missions`, `runs`, `tool_calls`).
5. Add mission start/stop APIs.
6. Add `/step` with mocked model decision.
7. Replace mock with AI SDK provider adapter.
8. Add frame/depth ingest and loop context wiring.
9. Add web mission/run screens and estop action.
10. Harden retries/watchdog and finalize Pi profile.

---

## R10 - Acceptance Gate

Refactor is accepted when all are true:
- `apps/server` + `apps/hub` run on Pi with compose.
- step loop executes one validated action per call.
- hub ack/error is persisted in Neon.
- emergency-stop works during degraded conditions.
- UI shows run state + latest actions without stale state.

---

## Notes
- Keep frontend deployment independent from Pi.
- Do not add local Postgres for Pi runtime; Neon only.
- Prefer deterministic safety behavior over aggressive autonomy.
