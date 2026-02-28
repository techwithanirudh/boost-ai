# LEGO BOOST + Gemini Live — System Plan

## Current Implementation (as of now)

- Implemented services:
  - `services/agent` (Gemini Live + camera + tool dispatch)
  - `services/pyhub` (FastAPI + LEGO BOOST BLE control)
- Runtime stack:
  - `docker-compose.yml` starts `mediamtx`, `pyhub`, and `agent`
  - iPhone Larix publishes RTMP (`/live/stream`) to MediaMTX
  - Agent reads RTSP from MediaMTX (`rtsp://localhost:8554/live/stream`)
- Data storage:
  - `storage/pyhub.db` (sqlite), ignored by git
- BLE connect behavior:
  - `HUB_CONNECT_TIMEOUT_S=300` (5 min) with backoff

Quick run:

```bash
docker compose up -d --build
docker compose logs -f mediamtx pyhub agent
```

## Agent Control Loop (required behavior)

The agent must behave like an embodied robot controller, not a chat assistant.

### Robot-first system prompt contract

- Identity: "You are the robot. You can move and stop using tools."
- Allowed motion outputs: `forward_cm`, `backward_cm`, `turn_deg`, `stop`.
- Motion limits per step:
  - forward/backward: 10-30 cm per call
  - turn: up to 90 degrees per call
- Safety:
  - if scene is unclear or obstacle risk exists, call `stop` first
  - never chain long blind movement; always re-check after each step

### Sense -> Think -> Act loop

For every cycle:

1. Move 10cm, capture video, and send to Gemini Live.
3. Ask for next action from current mission state.
4. Execute exactly one tool command (or `stop`).
5. Wait for command result/ack from `pyhub`.
6. Capture next video until command end.
7. Repeat until mission complete or manual stop.

### Runtime state machine

- `idle` -> `running` -> `waiting_ack` -> `running`
- Any error/unsafe condition -> `stopped`
- User stop command -> `stopped`

### Reliability rules

- If model replies with plain text intent (for example, "move forward 20 cm"), agent should parse and execute the equivalent tool call.
- Keep mission memory in app state (for example, "move forward until obstacle"), not only in chat history.
- Log each loop step: frame tick, model decision, tool call, ack/error, resulting state.

## Reference Index

| Technology | Docs | Package |
|---|---|---|
| Gemini Live API | [ai.google.dev/gemini-api/docs/live](https://ai.google.dev/gemini-api/docs/live) | `google-genai` |
| Live API Tool Use | [ai.google.dev/gemini-api/docs/live-tools](https://ai.google.dev/gemini-api/docs/live-tools) | — |
| google-genai SDK | [github.com/googleapis/python-genai](https://github.com/googleapis/python-genai) | `google-genai` |
| pylgbst | [github.com/undera/pylgbst](https://github.com/undera/pylgbst) | `pylgbst[bleak]` 1.3.0 |
| pylgbst Motor docs | [github.com/undera/pylgbst/blob/master/docs/Motor.md](https://github.com/undera/pylgbst/blob/master/docs/Motor.md) | `bleak` >=0.21 |
| FastAPI | [fastapi.tiangolo.com](https://fastapi.tiangolo.com) | `fastapi[standard]` 0.134.0 |

---

## 1) What we're building

AI has a body. Gemini sees through a camera mounted on the robot, narrates what it sees, and steers the LEGO BOOST Move Hub via motor tool calls.

**No audio loop. No Pipecat. Raw `google-genai` + FastAPI.**

**Two services, both Python, both on RPi:**

```
[RTSP camera / RPi cam]
        │ JPEG frames (1fps)
        ▼
  [agent]                 ←→   Gemini Live API
   Raw google-genai              text mode + vision + tool calling
   asyncio loop
   tool handlers:
     forward_cm / turn_deg / stop
        │ HTTP (httpx)
        ▼
  [pyhub-service]
   FastAPI + pylgbst
        │ BLE
        ▼
  LEGO BOOST Move Hub
```

Frontend lives on another server — out of scope. No audio, no WebRTC, no extra dependencies.

---

## 2) Repo layout

```
boost/                    # git root
  services/
    agent/                # Python — raw Gemini Live + camera + tool dispatch
      agent.py
      camera.py
      requirements.txt
      .env
    pyhub-service/        # Python — FastAPI + pylgbst BLE motor control
      main.py             # ✅ done
      hub.py              # ✅ done
      requirements.txt    # ✅ done
      .env.example        # ✅ done
  docs/
    runbook.md
    calibration.md
```

No monorepo tooling. Each service has its own `venv` and `requirements.txt`.

---

## 3) Camera

Use any **RTSP-compatible IP camera** on the same LAN, or the **RPi Camera Module** directly.

### Option A — RTSP camera (any RTSP-compatible IP cam)

```python
# camera.py
import cv2

RTSP_URL = "rtsp://192.168.x.x:554/stream"  # set from env var

class Camera:
    def __init__(self):
        self.cap = cv2.VideoCapture(RTSP_URL)

    def capture_jpeg(self, quality=60) -> bytes:
        ret, frame = self.cap.read()
        if not ret:
            raise RuntimeError("Frame read failed")
        _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        return buf.tobytes()

    def release(self):
        self.cap.release()
```

### Option B — RPi Camera Module (onboard, no network needed)

```python
# camera.py
import cv2
from picamera2 import Picamera2

class Camera:
    def __init__(self, width=640, height=480):
        self.cam = Picamera2()
        self.cam.configure(self.cam.create_video_configuration(
            main={"size": (width, height), "format": "RGB888"}
        ))
        self.cam.start()

    def capture_jpeg(self, quality=60) -> bytes:
        frame = self.cam.capture_array()
        _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        return buf.tobytes()

    def release(self):
        self.cam.stop()
```

**Install:**
```bash
# Option A (RTSP)
pip install opencv-python-headless

# Option B (RPi cam)
pip install picamera2 opencv-python-headless
# or: sudo apt install python3-picamera2
```

**Gemini Live limit:** 1 FPS max for video input. Cap your capture loop at `asyncio.sleep(1)`.

---

## 4) agent (raw google-genai)

### Install
```bash
pip install google-genai httpx opencv-python-headless python-dotenv
# For RPi cam instead of RTSP:
# pip install picamera2
```

### `.env`
```
GOOGLE_API_KEY=...
PYHUB_URL=http://localhost:8000
CAMERA_RTSP=rtsp://192.168.x.x:554/stream
```

### System prompt
```
You are an AI with a physical body — a LEGO BOOST robot.
You see through an onboard camera (one frame per second).
Your job: explore the world, narrate what you see, and navigate safely.

Rules:
- Analyse every frame before deciding to move.
- If you see an obstacle or the path is unclear, stop and turn first.
- Max 30 cm per forward_cm call.
- Max 90° per turn_deg call.
- Always call stop() before changing direction.
- After every movement, wait for the next frame before acting again.
```

### `agent.py` — full implementation

```python
import asyncio, os, uuid
import httpx
import cv2
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

PYHUB_URL = os.getenv("PYHUB_URL", "http://localhost:8000")
MODEL     = "gemini-2.5-flash-native-audio-preview-12-2025"

SYSTEM_PROMPT = """
You are an AI with a physical body — a LEGO BOOST robot.
You see through an onboard camera (one frame per second).
Your job: explore the world, narrate what you see, and navigate safely.

Rules:
- Analyse every frame before deciding to move.
- If you see an obstacle or the path is unclear, stop and turn first.
- Max 30 cm per forward_cm call. Max 90° per turn_deg call.
- Always call stop() before changing direction.
- After every movement, wait for the next frame before acting again.
"""

TOOLS = [{"function_declarations": [
    {
        "name": "forward_cm",
        "description": "Drive straight forward N centimetres (max 30).",
        "parameters": {
            "type": "object",
            "properties": {
                "distance_cm": {"type": "number"},
                "speed":       {"type": "number", "description": "0.0–1.0, default 0.5"},
            },
            "required": ["distance_cm"],
        },
    },
    {
        "name": "turn_deg",
        "description": "Turn in place. Positive = right, negative = left (max ±90°).",
        "parameters": {
            "type": "object",
            "properties": {
                "angle_deg": {"type": "number"},
            },
            "required": ["angle_deg"],
        },
    },
    {
        "name": "stop",
        "description": "Stop all motors immediately.",
        "parameters": {"type": "object", "properties": {}},
    },
]}]

CONFIG = types.LiveConnectConfig(
    response_modalities=["TEXT"],   # text mode → reliable tool calling
    system_instruction=SYSTEM_PROMPT,
    tools=TOOLS,
)


async def dispatch(primitive: str, args: dict = {}) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{PYHUB_URL}/execute", json={
            "command_id": uuid.uuid4().hex,
            "primitive":  primitive,
            "args":       args,
        }, timeout=15)
        return r.json()


async def handle_tool_call(session, tool_call) -> None:
    responses = []
    for fc in tool_call.function_calls:
        print(f"  → tool: {fc.name}({fc.args})")
        try:
            if fc.name == "stop":
                async with httpx.AsyncClient() as c:
                    await c.post(f"{PYHUB_URL}/stop")
                result = {"stopped": True}
            else:
                result = await dispatch(fc.name, dict(fc.args))
        except Exception as e:
            result = {"error": str(e)}

        responses.append(types.FunctionResponse(
            id=fc.id, name=fc.name, response={"result": result}
        ))

    await session.send_tool_response(function_responses=responses)


async def camera_loop(session, stop_event: asyncio.Event) -> None:
    rtsp = os.getenv("CAMERA_RTSP")
    cap  = cv2.VideoCapture(rtsp if rtsp else 0)
    try:
        while not stop_event.is_set():
            ret, frame = cap.read()
            if ret:
                _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
                await session.send_realtime_input(
                    video=types.Blob(data=buf.tobytes(), mime_type="image/jpeg")
                )
            await asyncio.sleep(1)   # 1fps — Gemini Live limit
    finally:
        cap.release()


async def response_loop(session, stop_event: asyncio.Event) -> None:
    async for response in session.receive():
        if response.text:
            print(f"Gemini: {response.text}", end="", flush=True)

        if response.tool_call:
            await handle_tool_call(session, response.tool_call)

        if response.server_content and response.server_content.interrupted:
            print("[interrupted]")

        if stop_event.is_set():
            break


async def main():
    client = genai.Client()
    stop_event = asyncio.Event()

    print(f"Connecting to Gemini Live ({MODEL})...")
    async with client.aio.live.connect(model=MODEL, config=CONFIG) as session:
        print("Connected. Starting camera + response loop. Ctrl+C to stop.\n")

        # Kick off with an initial prompt so Gemini starts observing
        await session.send_client_content(
            turns={"role": "user", "parts": [{"text": "Start exploring. What do you see?"}]},
            turn_complete=True,
        )

        try:
            await asyncio.gather(
                camera_loop(session, stop_event),
                response_loop(session, stop_event),
            )
        except KeyboardInterrupt:
            stop_event.set()
            print("\nStopping...")


if __name__ == "__main__":
    asyncio.run(main())
```

---

## 5) pyhub-service

### Install
```bash
pip install "pylgbst[bleak]" "fastapi[standard]" uvicorn pydantic
```

### `.env`
```
HUB_MAC=AA:BB:CC:DD:EE:FF
MOCK_HUB=false
```

### RPi BLE setup
```bash
sudo apt-get install -y bluetooth bluez python3-dev libglib2.0-dev
sudo systemctl enable --now bluetooth
sudo usermod -aG bluetooth $USER   # re-login after

# Find hub MAC:
sudo bluetoothctl
  agent on; scan on
  # Look for "LEGO Move Hub"
```

### `hub.py` — motion primitives

```python
import math, time, os, logging
from pylgbst import get_connection_bleak
from pylgbst.hub import MoveHub

log = logging.getLogger(__name__)

# Calibration — tune for your build
WHEEL_DIAMETER_CM = 5.4           # Vernie wheel (part 2515, 54mm)
WHEEL_CIRC_CM     = math.pi * WHEEL_DIAMETER_CM   # ~16.96 cm/rev
TRACK_WIDTH_CM    = 12.0           # wheel center-to-center; measure yours

HUB_MAC = os.getenv("HUB_MAC", "AA:BB:CC:DD:EE:FF")


def connect(retries=10) -> MoveHub:
    for attempt in range(retries):
        try:
            conn = get_connection_bleak(hub_mac=HUB_MAC)
            hub  = MoveHub(conn)
            log.info("Connected to Move Hub")
            return hub
        except Exception as e:
            wait = min(2.0 * (2 ** attempt), 60)
            log.warning(f"BLE connect failed: {e}. Retry in {wait:.0f}s")
            time.sleep(wait)
    raise RuntimeError("Could not connect to Move Hub")


def forward_cm(hub: MoveHub, distance_cm: float, speed: float = 0.5):
    degrees = int((distance_cm / WHEEL_CIRC_CM) * 360)
    hub.motor_AB.angled(degrees, speed, speed, wait_complete=True)


def turn_deg(hub: MoveHub, angle_deg: float, speed: float = 0.4):
    arc_cm    = (abs(angle_deg) / 360) * math.pi * TRACK_WIDTH_CM
    motor_deg = int((arc_cm / WHEEL_CIRC_CM) * 360)
    if angle_deg > 0:
        hub.motor_AB.angled(motor_deg,  speed, -speed, wait_complete=True)
    else:
        hub.motor_AB.angled(motor_deg, -speed,  speed, wait_complete=True)


def stop(hub: MoveHub):
    hub.motor_AB.stop()
```

### `main.py` — FastAPI

```python
import asyncio, os
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI
from pydantic import BaseModel
from hub import connect, forward_cm, turn_deg, stop as hub_stop

executor = ThreadPoolExecutor(max_workers=1)  # serial hub access
hub = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global hub
    if os.getenv("MOCK_HUB", "false").lower() != "true":
        hub = connect()
    yield
    if hub:
        hub.disconnect()

app = FastAPI(lifespan=lifespan)

class ExecuteRequest(BaseModel):
    command_id: str
    primitive: str
    args: dict = {}

@app.post("/execute")
async def execute(req: ExecuteRequest):
    loop = asyncio.get_event_loop()

    def _run():
        if req.primitive == "forward_cm":
            forward_cm(hub, req.args["distance_cm"], req.args.get("speed", 0.5))
        elif req.primitive == "turn_deg":
            turn_deg(hub, req.args["angle_deg"], req.args.get("speed", 0.4))
        elif req.primitive == "stop":
            hub_stop(hub)

    await loop.run_in_executor(executor, _run)
    return {"command_id": req.command_id, "accepted": True}

@app.post("/stop")
async def emergency_stop():
    loop = asyncio.get_event_loop()
    if hub:
        await loop.run_in_executor(executor, hub.motor_AB.stop)
    return {"stopped": True}

@app.get("/health")
async def health():
    return {"ble_connected": hub is not None, "ok": True}
```

---

## 6) Motion accuracy

### Calibration (required before real use)
```bash
# 1. Drive 100cm, measure actual distance → adjust WHEEL_DIAMETER_CM
# 2. Turn 360°, verify full rotation → adjust TRACK_WIDTH_CM
# 3. Repeat on actual carpet/floor surface
```

### Safety limits enforced at agent layer
- Max 30 cm per `forward_cm` call (Gemini must check camera before next command)
- Max ±90° per `turn_deg` call
- `stop()` always available as emergency

### RPi BLE issues

| Problem | Fix |
|---|---|
| BT + Wi-Fi interference (BCM43438) | Disable Wi-Fi or use USB BT 5.0 dongle |
| `hci0` not found | `sudo hciconfig hci0 reset` |
| Permission denied | `sudo usermod -aG bluetooth $USER` + re-login |
| Hub not found after reconnect | Wait 5s (hub LED clears); call `hub.switch_off()` before disconnect |

---

## 7) Implementation phases

### Phase 1 — pyhub-service
- BLE connect + `forward_cm`, `turn_deg`, `stop`.
- `/execute`, `/stop`, `/health` endpoints.
- Manual test with curl on real robot.
- `MOCK_HUB=true` for dev without robot.

### Phase 2 — Camera
- Mount camera on robot.
- Test `camera.py` captures clean 640×480 JPEG at 1fps.
- Verify no RPi CPU overload.

### Phase 3 — Pipecat agent (text mode)
- Wire Pipecat + Gemini Live with `response_modalities: ["TEXT"]`.
- Test tool calling end-to-end: text prompt → `forward_cm` → robot moves.

### Phase 4 — Add vision
- Enable camera loop, inject JPEG frames into Gemini context.
- Switch to audio mode (`response_modalities: ["AUDIO"]`).
- Test: Gemini sees obstacle → stops or turns autonomously.

### Phase 5 — Calibration + hardening
- Calibrate wheel/track constants on real surface.
- BLE reconnect stress test.
- Watchdog: auto-stop if no command in 5s.

---

## 8) Definition of Done (MVP)

- Robot drives forward when Gemini sees clear path in camera frame.
- Robot stops or turns when Gemini sees obstacle.
- Gemini narrates what it sees (audible via Daily room).
- BLE disconnect recovers automatically.
- Emergency stop works.
- Wheel/turn calibrated and documented.
