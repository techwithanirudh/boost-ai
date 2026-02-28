# LEGO BOOST + Gemini Live — System Plan

## Reference Index

| Technology | Docs | Package |
|---|---|---|
| Gemini Live API | [ai.google.dev/gemini-api/docs/live](https://ai.google.dev/gemini-api/docs/live) | `google-genai` |
| Live API Tool Use | [ai.google.dev/gemini-api/docs/live-tools](https://ai.google.dev/gemini-api/docs/live-tools) | — |
| Pipecat | [docs.pipecat.ai](https://docs.pipecat.ai) | `pipecat-ai[daily,google,silero,images]` |
| Pipecat Gemini Live | [docs.pipecat.ai/server/services/llm/gemini-live](https://docs.pipecat.ai/server/services/llm/gemini-live) | — |
| Daily WebRTC | [docs.daily.co](https://docs.daily.co) | `pipecat-ai[daily]` |
| pylgbst | [github.com/undera/pylgbst](https://github.com/undera/pylgbst) | `pylgbst[bleak]` 1.3.0 |
| pylgbst Motor docs | [github.com/undera/pylgbst/blob/master/docs/Motor.md](https://github.com/undera/pylgbst/blob/master/docs/Motor.md) | `bleak` >=0.21 |
| FastAPI | [fastapi.tiangolo.com](https://fastapi.tiangolo.com) | `fastapi[standard]` 0.134.0 |

---

## 1) What we're building

AI has a body. Gemini sees through a camera mounted on the robot, hears through a mic, narrates what it sees, and steers the LEGO BOOST Move Hub via motor tool calls.

**Two services, both Python, both on RPi:**

```
[RTSP camera / RPi cam]
        │ frames (1fps JPEG)
        ▼
  [pipecat-agent]         ←→   Gemini Live API
   Pipecat pipeline              (vision + audio + tool calling)
   Silero VAD
   @ai_callable tools:
     forward_cm / turn_deg / stop
        │ HTTP
        ▼
  [pyhub-service]
   FastAPI + pylgbst
        │ BLE
        ▼
  LEGO BOOST Move Hub
```

Frontend lives on another server — out of scope here. The pipecat-agent joins a Daily room; operators connect from wherever.

---

## 2) Repo layout

```
boost/                    # git root
  services/
    pipecat-agent/        # Python — Gemini brain + camera + tool dispatch
      agent.py
      camera.py
      requirements.txt
      .env
    pyhub-service/        # Python — FastAPI + pylgbst BLE motor control
      main.py
      hub.py
      requirements.txt
      .env
  docs/
    runbook.md
    calibration.md
```

No monorepo tooling needed. Each service has its own `venv` and `requirements.txt`.

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

## 4) pipecat-agent

### Install
```bash
pip install "pipecat-ai[daily,google,silero,images]" python-dotenv httpx opencv-python-headless
```

### `.env`
```
GOOGLE_API_KEY=...
DAILY_API_KEY=...
PYHUB_URL=http://localhost:8000
CAMERA_RTSP=rtsp://192.168.x.x:554/stream   # or leave blank to use RPi cam
```

### `agent.py`

```python
import os, asyncio, uuid
import httpx
from dotenv import load_dotenv
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair, LLMUserAggregatorParams,
)
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.google.gemini_live.llm import GeminiLiveLLMService
from pipecat.transports.daily.transport import DailyParams
from pipecat.frames.frames import LLMRunFrame

from camera import Camera

load_dotenv()

PYHUB_URL = os.getenv("PYHUB_URL", "http://localhost:8000")

SYSTEM_INSTRUCTION = """
You are an AI with a physical body — a LEGO BOOST robot.
You see through a camera and can move through the world.

Your job: explore, narrate what you see, navigate safely.

Rules:
- If you see an obstacle closer than ~30 cm, stop and turn before moving forward.
- Call stop() if uncertain.
- After each move, wait for the next camera frame before deciding again.
- Describe what you see before acting.
- Max 30 cm per forward command. Max 90° per turn command.
"""


async def dispatch(primitive: str, args: dict = {}):
    async with httpx.AsyncClient() as client:
        await client.post(f"{PYHUB_URL}/execute", json={
            "command_id": uuid.uuid4().hex,
            "primitive": primitive,
            "args": args,
        }, timeout=10)


async def run_bot(transport, runner_args: RunnerArguments):
    cam = Camera()

    llm = GeminiLiveLLMService(
        api_key=os.getenv("GOOGLE_API_KEY"),
        voice_id="Kore",
        system_instruction=SYSTEM_INSTRUCTION,
    )

    @llm.ai_callable(description="Drive forward N centimetres (max 30)")
    async def forward_cm(distance_cm: float, speed: float = 0.5):
        await dispatch("forward_cm", {"distance_cm": min(distance_cm, 30), "speed": speed})

    @llm.ai_callable(description="Turn in place. Positive = right, negative = left (max ±90°)")
    async def turn_deg(angle_deg: float):
        clamped = max(-90, min(90, angle_deg))
        await dispatch("turn_deg", {"angle_deg": clamped})

    @llm.ai_callable(description="Stop all motors immediately")
    async def stop():
        async with httpx.AsyncClient() as client:
            await client.post(f"{PYHUB_URL}/stop")

    messages = [{"role": "user", "content": "Start exploring. Describe what you see."}]
    context = LLMContext(messages)
    user_agg, assistant_agg = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
    )

    pipeline = Pipeline([
        transport.input(),
        user_agg,
        llm,
        transport.output(),
        assistant_agg,
    ])

    task = PipelineTask(pipeline, params=PipelineParams(
        enable_metrics=True, enable_usage_metrics=True,
    ))

    # Inject camera frames at 1fps into Gemini Live context
    async def camera_loop():
        while True:
            try:
                jpeg_bytes = cam.capture_jpeg(quality=60)
                await llm.push_frame(jpeg_bytes)
            except Exception as e:
                logger.warning(f"Camera error: {e}")
            await asyncio.sleep(1)

    @task.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        asyncio.create_task(camera_loop())
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        await task.cancel()

    runner = PipelineRunner()
    await runner.run(task)


async def bot(runner_args: RunnerArguments):
    transport_params = {
        "daily": lambda: DailyParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            video_in_enabled=True,
        )
    }
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport, runner_args)


if __name__ == "__main__":
    from pipecat.runner.run import main
    main()
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
