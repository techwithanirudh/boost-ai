# LEGO BOOST + Gemini Live System Plan

## 0) Reference Index

| Technology | Docs | Package | Version |
|---|---|---|---|
| Gemini Live API (Google AI) | [ai.google.dev/gemini-api/docs/live](https://ai.google.dev/gemini-api/docs/live) | `google-genai` (Python) | latest |
| Gemini Live API (Vertex AI) | [cloud.google.com/vertex-ai/generative-ai/docs/live-api](https://cloud.google.com/vertex-ai/generative-ai/docs/live-api) | `@google/genai` (JS/TS) | latest |
| Live API WebSocket Ref | [ai.google.dev/api/live](https://ai.google.dev/api/live) | — | — |
| Live API Tool Use | [ai.google.dev/gemini-api/docs/live-tools](https://ai.google.dev/gemini-api/docs/live-tools) | — | — |
| Live API Session Mgmt | [cloud.google.com/.../start-manage-session](https://cloud.google.com/vertex-ai/generative-ai/docs/live-api/start-manage-session) | — | — |
| pylgbst (LEGO BOOST) | [github.com/undera/pylgbst](https://github.com/undera/pylgbst) | `pylgbst[bleak]` | 1.3.0 |
| pylgbst Motor docs | [github.com/undera/pylgbst/docs/Motor.md](https://github.com/undera/pylgbst/blob/master/docs/Motor.md) | `bleak` | >=0.21 |
| Turborepo | [turborepo.dev/docs](https://turborepo.dev/docs) | `turbo` | 2.8.12 |
| Hono | [hono.dev/docs](https://hono.dev/docs) | `hono` | 4.12.3 |
| Hono Node WS | [hono.dev/docs/helpers/websocket](https://hono.dev/docs/helpers/websocket) | `@hono/node-ws` | 1.3.0 |
| Hono Zod validator | [hono.dev](https://hono.dev) | `@hono/zod-validator` | 0.7.6 |
| FastAPI | [fastapi.tiangolo.com](https://fastapi.tiangolo.com) | `fastapi[standard]` | 0.134.0 |
| Drizzle ORM | [orm.drizzle.team/docs](https://orm.drizzle.team/docs) | `drizzle-orm` | 0.45.1 |
| Drizzle Kit | [orm.drizzle.team/docs](https://orm.drizzle.team/docs) | `drizzle-kit` | 0.31.9 |
| TanStack Router | [tanstack.com/router/latest](https://tanstack.com/router/latest) | `@tanstack/react-router` | 1.163.3 |
| TanStack Query | [tanstack.com/query/latest](https://tanstack.com/query/latest) | `@tanstack/react-query` | 5.90.21 |
| Vite | [vite.dev](https://vite.dev) | `vite` | 7.3.1 |

---

## 1) Goals and constraints

### Goals
- Build a reliable robot system where AI perception/planning is separated from motor control.
- Expose two APIs:
  - JS API (`hono`) for frontend + Gemini Live + Mi Home orchestration.
  - Python API (`fastapi`) for LEGO BOOST hub control ("pyhub-service").
- Provide a frontend for the JS API using `Vite + React`.
- Optimize for movement accuracy and safety.

### Hard constraints
- LEGO BOOST Move Hub is BLE-only (no Wi-Fi). **pylgbst + bleak** is the only viable Python BLE library as of 2026.
- Raspberry Pi 3 BCM43438 chip shares Wi-Fi and BLE on same radio — interference risk. Keep AI/high-latency workloads off the motor timing loop. Consider USB BT 5.0 dongle for better BLE stability.
- BLE is less stable than wired; automatic reconnect with exponential backoff is mandatory.
- Gemini Live API is server-to-server only — never expose API key to browser clients; use a proxy (the `api-gateway` fills this role).

---

## 2) Architecture

### Services

```
[web-ui]  <──WS/SSE──>  [api-gateway]  <──HTTP──>  [pyhub-service]
 Vite+React               Hono + Node                FastAPI + Python
                          Gemini Live                 pylgbst + bleak
                          Drizzle/PostgreSQL           BLE → Move Hub
```

1. **`web-ui`** (Vite + React + TanStack Router/Query)
   - Operator UI: camera preview metadata, command interface, telemetry display.
   - Talks only to `api-gateway` via REST + SSE/WS.

2. **`api-gateway`** (Hono 4.12.3 on Node.js)
   - Single public API entrypoint.
   - Owns Gemini Live session (`google-genai`).
   - Mi Home integration.
   - Orchestrates intent → primitive dispatch to `pyhub-service`.
   - Streams robot state to frontend via SSE (`streamSSE`) or WebSocket (`@hono/node-ws`).
   - Persists command/event/session data via Drizzle ORM → PostgreSQL.

3. **`pyhub-service`** (FastAPI 0.134.0)
   - Real-time motor/sensor adapter; runs on RPi.
   - Maintains BLE connection to Move Hub via pylgbst + bleak.
   - Executes motion primitives with encoder feedback.
   - Watchdog safety brakes.
   - Private; only `api-gateway` talks to it.

### High-level data flow
1. Camera feed + context enters `api-gateway` → forwarded to Gemini Live session.
2. Gemini output normalized into strict command schema (zod-validated).
3. `api-gateway` POSTs command to `pyhub-service /execute`.
4. `pyhub-service` runs closed-loop motor control → returns ACK/result.
5. `api-gateway` pushes status/events to `web-ui` over SSE/WS.

---

## 3) Repo layout (Turborepo)

```text
boost/                        # git root
  plan.md
  turbo.json
  package.json                # packageManager: pnpm@9
  pnpm-workspace.yaml
  services/
    api-gateway/              # Hono, Node.js
    pyhub-service/            # FastAPI, Python
    web-ui/                   # Vite + React
  packages/
    shared-contracts/         # zod schemas shared by api-gateway + web-ui
  infra/
    docker/
    systemd/
    nginx/
  docs/
    api-contracts.md
    runbook.md
    calibration.md
```

### Turborepo scaffold
```bash
# In the boost/ directory (already git-initialized):
pnpm dlx create-turbo@latest .
# Choose pnpm, then reorganize into services/ + packages/
```

### `pnpm-workspace.yaml`
```yaml
packages:
  - "services/*"
  - "packages/*"
```

### `turbo.json`
```jsonc
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "lint": { "outputs": [] },
    "test": { "dependsOn": ["build"], "outputs": ["coverage/**"] },
    "typecheck": { "outputs": [] }
  }
}
```

---

## 4) API design

### 4.1 `api-gateway` (public)

#### `POST /v1/robot/intent`
```json
// request
{ "intent": "approach_object", "params": {"label": "bottle", "max_distance_cm": 100}, "priority": "normal", "request_id": "uuid" }
// response
{ "accepted": true, "command_id": "cmd_...", "status": "queued" }
```

#### `GET /v1/robot/state`
Includes: ble_connected, battery, last_command, motion_status, safety_flags.

#### `GET /v1/events` (SSE) — Hono `streamSSE`
```typescript
import { streamSSE } from 'hono/streaming'
app.get('/v1/events', (c) =>
  streamSSE(c, async (stream) => {
    // push command lifecycle events, robot state updates
    while (true) {
      await stream.writeSSE({ data: JSON.stringify(event), event: 'robot-state' })
      await stream.sleep(500)
    }
  })
)
```

#### `WS /v1/ws` — Hono `@hono/node-ws` 1.3.0
```typescript
import { createNodeWebSocket } from '@hono/node-ws'
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })
app.get('/v1/ws', upgradeWebSocket((c) => ({
  onMessage(ev, ws) { /* handle UI commands */ },
  onOpen(ev, ws) { ws.send(JSON.stringify({ type: 'connected' })) },
})))
// Must call after serve():
injectWebSocket(server)
```

#### `POST /v1/ai/session/start` — starts Gemini Live session
#### `POST /v1/ai/observe` — accepts perception metadata → drives planning

### 4.2 `pyhub-service` (private/internal)

#### `POST /execute`
```json
// request
{ "command_id": "cmd_...", "primitive": "forward_cm", "args": {"distance_cm": 25, "speed": 0.5}, "timeout_ms": 5000 }
// response
{ "command_id": "cmd_...", "accepted": true, "state": "running" }
```

#### `POST /stop` — immediate brake
#### `GET /telemetry` — encoder values, heading, BLE RSSI, battery, watchdog state
#### `GET /health` — liveness + BLE status + last command time

---

## 5) Command protocol and safety

### Command states
```
queued → sent → accepted → running → succeeded | failed | aborted | timeout
```

### Idempotency
- `request_id`/`command_id` required on every command.
- Duplicate `request_id` returns existing status (no re-execution).

### Safety controls
- **Watchdog** in `pyhub-service`: if no heartbeat within N ms → stop motors.
- **Emergency stop**: `POST /stop` accessible from both gateway and UI.
- Max speed clamp: enforce `speed ∈ [0.0, 1.0]` at service boundary.
- Command timeout enforcement per primitive.

---

## 6) Motion accuracy (critical)

### pylgbst motor primitives

```python
from pylgbst.hub import MoveHub
from pylgbst.peripherals import EncodedMotor

# Motor attributes on MoveHub
hub.motor_A        # port A
hub.motor_B        # port B
hub.motor_AB       # combined A+B
hub.motor_external # port C or D

# Key methods (speed range: -1.0 to 1.0)
hub.motor_AB.timed(seconds, speed_a, speed_b=None, wait_complete=True)
hub.motor_AB.angled(degrees, speed_a, speed_b=None, wait_complete=True)
hub.motor_AB.start_speed(speed)
hub.motor_AB.stop()

# Encoder subscription (angle in degrees, cumulative)
hub.motor_A.subscribe(callback, mode=EncodedMotor.SENSOR_ANGLE)
hub.motor_A.subscribe(callback, mode=EncodedMotor.SENSOR_SPEED)
hub.motor_A.unsubscribe(callback)
```

### Calibration constants (BOOST Vernie starting point)

```python
import math

WHEEL_DIAMETER_CM = 5.4          # part 2515, 54mm hard plastic wheel
WHEEL_CIRC_CM     = math.pi * WHEEL_DIAMETER_CM   # ≈ 16.96 cm/rev
TRACK_WIDTH_CM    = 12.0          # center-to-center wheel distance; measure your build
DRIVE_SPEED       = 0.5           # tune per surface
TURN_SPEED        = 0.4
```

### Motion primitives (pyhub-service implementation)

```python
def forward_cm(hub, distance_cm, speed=DRIVE_SPEED):
    degrees = int((distance_cm / WHEEL_CIRC_CM) * 360)
    hub.motor_AB.angled(degrees, speed, speed, wait_complete=True)

def turn_deg(hub, angle_deg, speed=TURN_SPEED):
    arc_cm    = (abs(angle_deg) / 360) * math.pi * TRACK_WIDTH_CM
    motor_deg = int((arc_cm / WHEEL_CIRC_CM) * 360)
    if angle_deg > 0:
        hub.motor_AB.angled(motor_deg,  speed, -speed, wait_complete=True)  # right
    else:
        hub.motor_AB.angled(motor_deg, -speed,  speed, wait_complete=True)  # left

def stop(hub):
    hub.motor_AB.stop()
```

**Note on `motor_AB.angled`:** The `degrees` parameter is total motor rotation shared between both motors by speed ratio — it is NOT robot heading in degrees. The `turn_deg` function above converts correctly using track geometry.

### Required calibration
1. `WHEEL_DIAMETER_CM` — measure actual wheel, then run 100 cm and compare.
2. `TRACK_WIDTH_CM` — do 360° turn, measure actual rotation, adjust.
3. Drift compensation — add small differential bias to `forward_cm`.
4. Battery voltage compensation — at low voltage, reduce speed proportionally.

### Primitive set
- `forward_cm(distance_cm, speed, heading_hold=False)`
- `turn_deg(angle_deg, turn_speed)`
- `arc(radius_cm, angle_deg, speed)`
- `stop(mode='brake'|'coast')`
- `set_pose(x, y, heading)` — optional odometry

---

## 7) Gemini Live API integration

### SDK install
```bash
# Python (api-gateway or separate service)
pip install google-genai

# Node.js (api-gateway)
npm install @google/genai
```

**Important:** Use `google-genai` (Python) and `@google/genai` (JS). The old `google-generativeai` / `@google/generative-ai` packages do NOT support Live API and were deprecated Nov 30, 2025.

### Models

| Model ID | Platform | Status |
|---|---|---|
| `gemini-2.5-flash-native-audio-preview-12-2025` | Google AI | Recommended (128k ctx, thinking) |
| `gemini-live-2.5-flash-native-audio` | Vertex AI | GA, Dec 12 2025 |
| `gemini-2.0-flash-live-001` | Google AI | Retiring June 1 2026 |

### Auth
```bash
export GEMINI_API_KEY=your_key   # for Google AI
# or for Vertex AI:
gcloud auth application-default login
```

### Audio specs
| | Input | Output |
|---|---|---|
| Format | Raw 16-bit PCM, little-endian | Raw 16-bit PCM, little-endian |
| Sample rate | 16,000 Hz | 24,000 Hz |
| Channels | Mono | Mono |

### Rate limits / constraints
- Max concurrent sessions: 1,000 (Vertex AI PayGo) / up to 5,000
- Default session duration: 10 min (audio-only: 15 min; audio+video: 2 min)
- Extendable via `ContextWindowCompressionConfig` → indefinite
- Context window: 128k tokens (native audio), 32k (other)
- Only TEXT **or** AUDIO modality per session, not both simultaneously
- Video: 1 FPS max
- Server-to-server only — never call from browser; `api-gateway` acts as proxy

### One-shot implementation: Node.js (api-gateway)

```typescript
import { GoogleGenAI, Modality } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025'

// Define robot control tools
const robotTools = [{
  functionDeclarations: [{
    name: 'execute_primitive',
    description: 'Execute a LEGO BOOST motion primitive',
    parameters: {
      type: 'object',
      properties: {
        primitive: { type: 'string', enum: ['forward_cm', 'turn_deg', 'stop'] },
        args: { type: 'object' },
      },
      required: ['primitive'],
    },
  }],
}]

export async function startGeminiSession() {
  const responseQueue: any[] = []

  const session = await ai.live.connect({
    model: MODEL,
    config: {
      responseModalities: [Modality.TEXT],   // TEXT for reliable tool calling
      systemInstruction: 'You control a LEGO BOOST robot. Translate user intents into motion primitives. Always confirm before large movements.',
      tools: robotTools,
    },
    callbacks: {
      onopen:    () => console.log('Gemini session open'),
      onmessage: (msg: any) => responseQueue.push(msg),
      onerror:   (e: Error) => console.error('Gemini error:', e.message),
      onclose:   (e: any) => console.log('Gemini closed:', e.reason),
    },
  })

  async function waitTurn(): Promise<any[]> {
    const messages: any[] = []
    while (true) {
      const msg = responseQueue.shift()
      if (!msg) { await new Promise(r => setTimeout(r, 10)); continue }
      messages.push(msg)
      if (msg.serverContent?.turnComplete || msg.toolCall) break
    }
    return messages
  }

  async function observe(text: string) {
    session.sendClientContent({ turns: text, turnComplete: true })
    const turns = await waitTurn()

    for (const turn of turns) {
      if (turn.toolCall) {
        const responses = []
        for (const fc of turn.toolCall.functionCalls) {
          // Dispatch to pyhub-service
          const result = await fetch('http://localhost:8000/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command_id: crypto.randomUUID(), primitive: fc.args.primitive, args: fc.args.args ?? {} }),
          }).then(r => r.json())
          responses.push({ id: fc.id, name: fc.name, response: { result } })
        }
        session.sendToolResponse({ functionResponses: responses })
      }
    }
  }

  return { session, observe }
}
```

### One-shot implementation: Python (standalone reference)

```python
import asyncio
from google import genai
from google.genai import types

client = genai.Client()
MODEL  = "gemini-2.5-flash-native-audio-preview-12-2025"

CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    input_audio_transcription={},
    output_audio_transcription={},
    system_instruction="You are a helpful voice assistant for a LEGO robot.",
    speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")
        )
    ),
)

async def main():
    async with client.aio.live.connect(model=MODEL, config=CONFIG) as session:
        await session.send_client_content(
            turns={"role": "user", "parts": [{"text": "Hello!"}]},
            turn_complete=True
        )
        async for response in session.receive():
            if response.data:                               # audio bytes (PCM 24kHz)
                pass  # pipe to speaker
            if response.server_content:
                sc = response.server_content
                if sc.output_transcription:
                    print("Gemini:", sc.output_transcription.text)
                if sc.turn_complete:
                    break

asyncio.run(main())
```

### Session management (extending beyond default duration)

```python
config = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    context_window_compression=types.ContextWindowCompressionConfig(
        trigger_tokens=16_000,   # compress when context exceeds this
        target_tokens=8_000,     # compress down to this
    ),
    session_resumption=types.SessionResumptionConfig(),  # enable resumption tokens
)
```

---

## 8) pyhub-service BLE setup

### RPi system setup
```bash
sudo apt-get install -y bluetooth bluez python3-dev libglib2.0-dev
sudo systemctl enable --now bluetooth
sudo usermod -aG bluetooth $USER   # re-login after this
# Verify:
hciconfig                          # should show hci0 UP RUNNING
```

### Find Move Hub MAC
```bash
sudo bluetoothctl
  agent on
  scan on
  # Look for "LEGO Move Hub" → note MAC e.g. AA:BB:CC:DD:EE:FF
  scan off
  exit
```

### Connection with retry

```python
import time, logging
from pylgbst import get_connection_bleak
from pylgbst.hub import MoveHub

HUB_MAC = "AA:BB:CC:DD:EE:FF"   # set from env var in production
log = logging.getLogger(__name__)

def connect(retries=10, backoff_base=2.0, backoff_max=60.0) -> MoveHub:
    for attempt in range(retries):
        try:
            conn = get_connection_bleak(hub_mac=HUB_MAC)
            hub  = MoveHub(conn)
            log.info("Connected to Move Hub")
            return hub
        except Exception as e:
            wait = min(backoff_base * (2 ** attempt), backoff_max)
            log.warning(f"BLE connect failed ({e}), retry in {wait:.0f}s")
            time.sleep(wait)
    raise RuntimeError("Could not connect to Move Hub")
```

### FastAPI service skeleton

```python
from fastapi import FastAPI
from pydantic import BaseModel
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
import asyncio

executor = ThreadPoolExecutor(max_workers=1)   # serial hub access
hub = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global hub
    hub = connect()
    yield
    if hub: hub.disconnect()

app = FastAPI(lifespan=lifespan)

class ExecuteRequest(BaseModel):
    command_id: str
    primitive: str
    args: dict = {}
    timeout_ms: int = 5000

@app.post("/execute")
async def execute(req: ExecuteRequest):
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(executor, _run_primitive, req)
    return {"command_id": req.command_id, "accepted": True, "state": "running"}

def _run_primitive(req: ExecuteRequest):
    if req.primitive == "forward_cm":
        forward_cm(hub, req.args["distance_cm"], req.args.get("speed", 0.5))
    elif req.primitive == "turn_deg":
        turn_deg(hub, req.args["angle_deg"], req.args.get("speed", 0.4))
    elif req.primitive == "stop":
        stop(hub)

@app.post("/stop")
async def emergency_stop():
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(executor, hub.motor_AB.stop)
    return {"stopped": True}

@app.get("/health")
async def health():
    return {"ble_connected": hub is not None, "ok": True}
```

### Known RPi issues

| Issue | Fix |
|---|---|
| Random BLE disconnects | RPi 3 shares BT/Wi-Fi on BCM43438. Disable Wi-Fi or use USB BT dongle. |
| `hci0` init failure | `sudo hciconfig hci0 reset` or `sudo systemctl restart bluetooth` |
| Permission errors | `sudo usermod -aG bluetooth $USER` + re-login |
| Hub not found after reconnect | Wait 3–5 s after disconnect (hub LED stays blue); call `hub.switch_off()` before disconnect for cleaner shutdown |
| bluepy C helper crashes | Switch to bleak backend exclusively |

---

## 9) Runtime / deployment

### Development
```bash
pnpm turbo dev          # runs all 3 services in parallel
```
- Use `.env` files per service.
- Mock BLE adapter in `pyhub-service` for CI and early frontend integration.
- `api-gateway` connects to real Gemini API with `GEMINI_API_KEY`.

### Raspberry Pi deployment (production)
- RPi runs: `api-gateway` + `pyhub-service`
- `web-ui` deployed separately (Vercel, local PC, etc.)
- `pyhub-service` bound to `127.0.0.1` only (private)
- `api-gateway` is the single external entrypoint

### systemd units
- `pyhub.service` — FastAPI via uvicorn, `Restart=always`
- `api-gateway.service` — Node.js Hono server, `Restart=always`
- Optional: `nginx.service` as reverse proxy / TLS terminator

---

## 10) Security

- API key or JWT at `api-gateway` boundary.
- Signed service token between `api-gateway` → `pyhub-service`.
- `pyhub-service` bound to localhost; never exposed externally.
- Strict CORS allowlist for frontend origin.
- **Never expose `GEMINI_API_KEY` to browser.** `api-gateway` proxies all Gemini calls.
- Validate all intent/primitive schemas with zod (`api-gateway`) and pydantic (`pyhub-service`).

---

## 11) Reliability

- BLE reconnect loop with exponential backoff + jitter.
- Command queue + event persistence in PostgreSQL via Drizzle ORM 0.45.1.
- Structured JSON logs with `session_id`, `request_id`, `command_id` in every line.
- Circuit breaker in `api-gateway` when `pyhub-service` unreachable.
- Watchdog thread in `pyhub-service`: `POST /stop` if no heartbeat in N ms.
- Gemini session resumption handles reconnects within 24h window.

---

## 12) Observability

- JSON logs in both services (structlog / pino).
- Correlation IDs on every log line and HTTP response.
- Metrics: command success rate, P50/P95 latency, BLE reconnect count, e-stop count.
- Minimum viable: rotating log files + `/health` status page.
- Optional: Grafana + Prometheus (add later).

---

## 13) Implementation phases

### Phase 0: Scaffolding
- Init Turborepo (`pnpm dlx create-turbo@latest`) in `/home/node/boost`.
- Create `services/api-gateway` (Hono), `services/pyhub-service` (FastAPI), `services/web-ui` (Vite React), `packages/shared-contracts` (zod schemas).
- Configure `turbo.json` pipelines: `dev`, `build`, `lint`, `test`, `typecheck`.
- Set up `pnpm-workspace.yaml`.

### Phase 1: `pyhub-service` core
- Install: `pip install "pylgbst[bleak]" fastapi[standard] uvicorn pydantic`
- Implement BLE connection manager with retry loop.
- Add `/health`, `/execute` (`forward_cm`, `turn_deg`), `/stop`.
- Add watchdog thread.
- Mock BLE adapter fallback for local dev (return fake telemetry).

### Phase 2: `api-gateway` core
- Install: `pnpm add hono @hono/node-server @hono/node-ws @hono/zod-validator @google/genai drizzle-orm postgres`
- Implement `/v1/robot/intent` → primitive dispatch.
- Implement `/v1/events` SSE stream + `/v1/ws` WebSocket.
- Add durable command queue with Drizzle → PostgreSQL.
- Wire Gemini Live session with robot tool declarations.

### Phase 3: Frontend
- `npm create vite@latest web-ui -- --template react-ts`
- Install TanStack Router (file-based), TanStack Query.
- Control panel: BLE status, intent buttons, manual stop.
- Live event stream display + command history timeline.
- Safety indicators: watchdog state, BLE state, e-stop.

### Phase 4: Gemini + Mi Home integration
- Add planner module: Gemini output → validated intent schema.
- Guardrails: schema validation, deny unsafe commands.
- Mi Home events as context signals to Gemini session.
- Use `responseModalities: ["TEXT"]` for reliable function calling.

### Phase 5: Calibration and hardening
- Build calibration CLI scripts: measure wheel circumference, track width.
- Run repeatability tests: 10× 100 cm straight, 10× 90° turns.
- Tune PID/ramp constants. Battery voltage compensation.
- Stress test BLE reconnect during movement.

---

## 14) Testing strategy

### Unit tests
- zod schema validation (shared-contracts).
- Intent-to-primitive mapping logic.
- Safety limit clamping.
- pylgbst motor degree calculation.

### Integration tests
- Gateway → pyhub command lifecycle (mock hub).
- Duplicate `request_id` idempotency.
- Stop/timeout/watchdog behavior.

### Hardware-in-loop tests
- 10× straight 100 cm: measure mean + max error.
- 10× 90° turn: heading error distribution.
- BLE reconnect mid-movement: must fail safe (stop motors).

---

## 15) Definition of Done (MVP)

- Operator sends intent from UI → robot executes safely.
- End-to-end command state visible in UI in near real-time via SSE.
- BLE disconnects recover automatically; motion fails safe.
- Emergency stop works within target latency.
- Calibration profile applied and stored.
- Gemini Live function calling dispatches motor primitives correctly.
