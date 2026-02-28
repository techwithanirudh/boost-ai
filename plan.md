# LEGO BOOST + Gemini System Plan

## 1) Goals and constraints

### Goals
- Build a reliable robot system where AI perception/planning is separated from motor control.
- Expose two APIs:
  - JS API (`hono`) for frontend + Gemini + Mi Home orchestration.
  - Python API (`fastapi`) for LEGO BOOST hub control ("pyhub unit").
- Provide a frontend for the JS API using `Vite + React`.
- Optimize for movement accuracy and safety.

### Hard constraints
- LEGO BOOST Move Hub is BLE-only for control (no direct Wi-Fi control).
- Raspberry Pi 3 has limited CPU/RAM, so keep AI/high-latency workloads separated from motor timing loops.
- BLE is less stable than wired links; reconnect logic is mandatory.

## 2) Recommended architecture (final)

### Services
1. `web-ui` (Vite + React)
- Purpose: operator UI, live camera preview metadata, command interface, telemetry display.
- Talks only to `api-gateway`.

2. `api-gateway` (Hono)
- Purpose: single public API.
- Responsibilities:
  - auth/session handling
  - Gemini SDK integration
  - Mi Home integration
  - orchestrating command generation and dispatching to `pyhub-service`
  - streaming robot state to frontend via WebSocket/SSE

3. `pyhub-service` (FastAPI)
- Purpose: real-time robot motor/sensor control adapter for LEGO BOOST.
- Responsibilities:
  - maintain BLE connection to Move Hub
  - execute motion primitives (`forward_cm`, `turn_deg`, `stop`, etc.)
  - watchdog safety brakes
  - health/status and telemetry

### High-level flow
1. Camera feed + context enters `api-gateway` logic (Gemini Live).
2. Gemini output is normalized into strict command schema.
3. `api-gateway` sends command to `pyhub-service`.
4. `pyhub-service` executes with closed-loop control and returns ACK/result.
5. `api-gateway` broadcasts status/events to `web-ui`.

## 3) Repo layout (Turborepo)

```text
boost/
  plan.md
  turbo.json
  package.json
  pnpm-workspace.yaml
  services/
    api-gateway/         # Hono
    pyhub-service/       # FastAPI + BLE + control loops
    web-ui/              # Vite React frontend
  packages/
    shared-contracts/    # zod/json-schema shared with api-gateway + web-ui
  infra/
    docker/
    systemd/
    nginx/
  docs/
    api-contracts.md
    runbook.md
    calibration.md
```

## 4) API design

### 4.1 `api-gateway` API (public)

#### `POST /v1/robot/intent`
- Purpose: submit high-level intent from UI/operator.
- Request:
```json
{
  "intent": "approach_object",
  "params": {"label": "bottle", "max_distance_cm": 100},
  "priority": "normal",
  "request_id": "uuid"
}
```
- Response:
```json
{
  "accepted": true,
  "command_id": "cmd_...",
  "status": "queued"
}
```

#### `GET /v1/robot/state`
- Purpose: latest consolidated state.
- Includes: connection status, battery, last command, motion status, safety flags.

#### `GET /v1/events` (SSE) or `WS /v1/ws`
- Purpose: push live updates and command lifecycle events.

#### `POST /v1/ai/session/start`
- Starts Gemini live session context.

#### `POST /v1/ai/observe`
- Accepts summarized perception metadata/cues to drive planning.

### 4.2 `pyhub-service` API (private/internal)

#### `POST /execute`
- Executes strict low-level primitive.
- Request:
```json
{
  "command_id": "cmd_...",
  "primitive": "forward_cm",
  "args": {
    "distance_cm": 25,
    "speed": 40,
    "heading_hold": true
  },
  "timeout_ms": 5000
}
```
- Response:
```json
{
  "command_id": "cmd_...",
  "accepted": true,
  "state": "running"
}
```

#### `POST /stop`
- Immediate brake/stop.

#### `GET /telemetry`
- Motor encoder values, heading, BLE RSSI, battery estimate, watchdog state.

#### `GET /health`
- Liveness + BLE connection + last command time.

### 4.3 Command result callback (optional)
- Either polling by `api-gateway` or callback/webhook from `pyhub-service`.
- Prefer callback if network is stable; otherwise poll + SSE push.

## 5) Command protocol and safety

### Command states
`queued -> sent -> accepted -> running -> succeeded | failed | aborted | timeout`

### Idempotency
- `request_id`/`command_id` required.
- Duplicate `request_id` returns existing status.

### Safety controls
- Watchdog in `pyhub-service`: if no heartbeat/command within N ms, stop motors.
- Emergency endpoint: `POST /stop` from gateway and UI.
- Max speed and max turn clamps at service boundary.
- Command timeout enforcement per primitive.

## 6) Motion accuracy strategy (critical)

### Control principles
- Use motion primitives, not raw continuous power streaming from AI.
- Closed-loop control using encoder + heading correction (PID).
- Soft acceleration/deceleration ramps.
- Per-surface calibration constants.

### Required calibration
1. Wheel diameter/effective distance constant.
2. Track width for turn accuracy.
3. Drift compensation for straight-line moves.
4. Battery-voltage compensation curve.

### Primitive set (initial)
- `forward_cm(distance_cm, speed, heading_hold)`
- `turn_deg(angle_deg, turn_speed)`
- `arc(radius_cm, angle_deg, speed)`
- `stop(mode=brake|coast)`
- `set_pose(x, y, heading)` (optional)

## 7) Runtime/deployment plan

### Development
- Run all 3 services locally with `.env` files.
- Use mocked BLE adapter for CI and early frontend integration.

### Raspberry Pi deployment
- Run only API services on the Raspberry Pi 3:
  - `api-gateway`
  - `pyhub-service`
- Deploy `web-ui` on a separate machine/environment.
- Use systemd for auto-restart and boot-time startup.
- Keep `pyhub-service` on localhost/private port.
- Expose `api-gateway` as the single public API entrypoint for the remote frontend.

### Suggested systemd units
- `pyhub.service`
- `api-gateway.service`
- optional `reverse-proxy.service` (single public entrypoint)

## 8) Security and reliability

### Security
- API key or JWT at `api-gateway`.
- Signed service token between `api-gateway` and `pyhub-service`.
- Restrict pyhub API to private network only.
- Configure strict CORS allowlist for the frontend origin.

### Reliability
- BLE reconnect backoff with jitter.
- Command queue/event persistence in PostgreSQL via Drizzle ORM.
- Structured logs + request/command correlation IDs.
- Circuit breaker when pyhub unavailable.

## 9) Observability

### Metrics
- Command success rate by primitive.
- Median/95p command latency.
- BLE reconnect count.
- Emergency stop count.

### Logs
- JSON logs in both services.
- Include `session_id`, `request_id`, `command_id` in every log line.

### Dashboards
- Basic Grafana/Prometheus optional.
- Minimum: rotating log files + simple status page.

## 10) Implementation phases

### Phase 0: Scaffolding
- Create Turborepo workspace and shared command schema package.
- Use Hono for the JS API.
- Use Vite React + TanStack Query/Router.
- Configure Turbo pipelines for `dev`, `build`, `lint`, `test`, and `typecheck`.

### Phase 1: `pyhub-service` core
- Implement BLE connection manager and `/health`.
- Add `/execute` with `forward_cm`, `turn_deg`, `/stop`.
- Add watchdog and command timeout logic.
- Add simulated adapter fallback for local dev.

### Phase 2: `api-gateway` core
- Implement `/v1/robot/intent` -> mapping to primitives.
- Implement `/v1/robot/state` and SSE/WS stream.
- Add durable command queue and status tracking.

### Phase 3: Frontend
- Control panel: connect state, intent buttons, manual stop.
- Live event stream and command history timeline.
- Safety indicators (watchdog, BLE state, emergency stop).

### Phase 4: Gemini + Mi Home integration
- Add planner module that maps Gemini output to validated intents.
- Add guardrails: schema validation + deny unsafe commands.
- Integrate Mi Home events as context signals.

### Phase 5: Calibration and hardening
- Build calibration scripts and store profiles.
- Run repeatability tests (distance/angle error benchmarks).
- Tune PID/ramping and finalize operational limits.

## 11) Testing strategy

### Unit tests
- Command schema validation.
- Intent-to-primitive mapping logic.
- Safety limit clamping.

### Integration tests
- Gateway -> pyhub command lifecycle.
- Duplicate command/idempotency behavior.
- Stop/timeout/watchdog behavior.

### Hardware-in-loop tests
- 10x straight 100 cm runs: measure mean and max error.
- 10x 90-degree turns: heading error distribution.
- BLE reconnect during movement (must fail safe).

## 12) Tech stack choices (concrete)

### Final picks
- Frontend: `Vite + React + TanStack Query + TanStack Router`
- JS API: `Hono + zod + Gemini SDK`
- Python API: `FastAPI + pydantic + BLE library + control module`
- Data: PostgreSQL with Drizzle ORM for command/event/session persistence.

### Why not Next.js for this specific system
- You asked for a separate frontend plus separate APIs; Next.js adds unnecessary coupling.
- Vite frontend is lighter/faster for operator dashboard workflows.

## 13) Immediate next tasks (first week)

1. Scaffold folders and base apps for all 3 services.
2. Define shared JSON schema for intents, primitives, and statuses.
3. Implement pyhub `/health`, `/execute`, `/stop` with mock BLE.
4. Implement gateway `/v1/robot/intent` and state store.
5. Build minimal web UI with live status + emergency stop.
6. Run first end-to-end test with one primitive (`forward_cm`).

## 14) Definition of done (MVP)

- Operator can send intent from UI and robot executes safely.
- End-to-end command state visible in UI in near real-time.
- BLE disconnects recover automatically, and motion fails safe.
- Emergency stop works within defined latency target.
- Calibration profile applied and documented.
