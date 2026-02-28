"""
agent.py — Gemini Live agent for LEGO BOOST robot.

Connects to Gemini Live (text mode + vision), streams 1fps camera frames,
handles forward_cm / turn_deg / stop tool calls via pyhub HTTP API.

Run:
    python agent.py

Env vars (see .env):
    GOOGLE_API_KEY, PYHUB_URL, CAMERA_RTSP
"""

import asyncio
import logging
import os
import uuid

import httpx
from dotenv import load_dotenv
from google import genai
from google.genai import types

from camera import Camera

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("agent")

# ── Config ─────────────────────────────────────────────────────────────────

PYHUB_URL = os.getenv("PYHUB_URL", "http://localhost:8000")
MODEL     = "gemini-2.5-flash-native-audio-preview-12-2025"

SYSTEM_PROMPT = """
You are an AI with a physical body — a LEGO BOOST robot.
You see through an onboard camera that sends you one frame per second.

Your job: explore the world, narrate what you see, and navigate safely.

Rules:
- Analyse every frame carefully before deciding to move.
- If you see an obstacle or the path is unclear, stop and turn first.
- Max 30 cm per forward_cm call.
- Max 90 degrees per turn_deg call.
- Always call stop() before changing direction.
- After every movement, wait for the next camera frame before acting again.
- Narrate what you observe in each frame, even if you choose not to move.
"""

TOOLS = [{"function_declarations": [
    {
        "name": "forward_cm",
        "description": "Drive straight forward N centimetres (max 30).",
        "parameters": {
            "type": "object",
            "properties": {
                "distance_cm": {"type": "number", "description": "Distance in cm (1–30)"},
                "speed":       {"type": "number", "description": "Motor speed 0.0–1.0, default 0.5"},
            },
            "required": ["distance_cm"],
        },
    },
    {
        "name": "backward_cm",
        "description": "Drive straight backward N centimetres (max 30).",
        "parameters": {
            "type": "object",
            "properties": {
                "distance_cm": {"type": "number", "description": "Distance in cm (1–30)"},
                "speed":       {"type": "number", "description": "Motor speed 0.0–1.0, default 0.5"},
            },
            "required": ["distance_cm"],
        },
    },
    {
        "name": "turn_deg",
        "description": "Turn in place. Positive = right (clockwise), negative = left (max ±90°).",
        "parameters": {
            "type": "object",
            "properties": {
                "angle_deg": {"type": "number", "description": "Degrees to turn, -90 to 90"},
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
    response_modalities=["TEXT"],   # text mode — reliable tool calling, no audio overhead
    system_instruction=SYSTEM_PROMPT,
    tools=TOOLS,
)


# ── pyhub HTTP dispatch ─────────────────────────────────────────────────────

async def _dispatch(primitive: str, args: dict) -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{PYHUB_URL}/execute",
            json={"command_id": uuid.uuid4().hex, "primitive": primitive, "args": args},
            timeout=20,
        )
        r.raise_for_status()
        return r.json()


async def _stop() -> dict:
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{PYHUB_URL}/stop", timeout=10)
        r.raise_for_status()
        return r.json()


# ── Tool call handler ───────────────────────────────────────────────────────

async def handle_tool_call(session, tool_call) -> None:
    responses = []

    for fc in tool_call.function_calls:
        log.info("Tool call: %s(%s)", fc.name, dict(fc.args))
        try:
            if fc.name == "stop":
                result = await _stop()
            else:
                result = await _dispatch(fc.name, dict(fc.args))
        except Exception as exc:
            log.error("Tool %s failed: %s", fc.name, exc)
            result = {"error": str(exc)}

        responses.append(
            types.FunctionResponse(id=fc.id, name=fc.name, response={"result": result})
        )

    await session.send_tool_response(function_responses=responses)


# ── Camera loop ─────────────────────────────────────────────────────────────

async def camera_loop(session, stop_event: asyncio.Event) -> None:
    cam = Camera()
    loop = asyncio.get_running_loop()
    log.info("Camera started")
    try:
        while not stop_event.is_set():
            try:
                # Run blocking OpenCV read in a thread so we don't stall the event loop
                jpeg = await loop.run_in_executor(None, cam.capture_jpeg)
                await session.send_realtime_input(
                    media=types.Blob(data=jpeg, mime_type="image/jpeg")
                )
            except RuntimeError as exc:
                log.warning("Camera read error: %s", exc)

            await asyncio.sleep(1.0)   # 1 fps — Gemini Live limit
    finally:
        cam.release()
        log.info("Camera released")


# ── Response loop ───────────────────────────────────────────────────────────

async def response_loop(session, stop_event: asyncio.Event) -> None:
    try:
        async for message in session.receive():
            if stop_event.is_set():
                break

            # Tool calls arrive as a top-level field (not inside server_content)
            if message.tool_call:
                await handle_tool_call(session, message.tool_call)

            sc = message.server_content
            if sc:
                if sc.model_turn:
                    for part in sc.model_turn.parts:
                        if part.text:
                            print(f"Gemini: {part.text}", end="", flush=True)

                if sc.turn_complete:
                    print()  # newline after each complete turn

                if sc.interrupted:
                    log.info("[turn interrupted]")
    except Exception as exc:
        log.error("Session closed: %s", exc)
        stop_event.set()  # signal camera_loop to stop too


# ── Main ────────────────────────────────────────────────────────────────────

async def main() -> None:
    # Verify pyhub is reachable before connecting to Gemini
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{PYHUB_URL}/health", timeout=5)
            health = r.json()
            if not health.get("ble_connected") and not health.get("mock"):
                log.warning("pyhub: BLE not connected (hub may be off)")
            else:
                log.info("pyhub: ready — ble_connected=%s", health.get("ble_connected"))
    except Exception as exc:
        log.error("Cannot reach pyhub at %s: %s", PYHUB_URL, exc)
        return

    client = genai.Client()
    stop_event = asyncio.Event()

    log.info("Connecting to Gemini Live (%s)...", MODEL)
    async with client.aio.live.connect(model=MODEL, config=CONFIG) as session:
        log.info("Connected. Starting agent. Ctrl+C to stop.\n")

        # Prime the session — Gemini will start observing the incoming frames
        await session.send_client_content(
            turns=types.Content(
                role="user",
                parts=[types.Part(text="Start exploring. Describe what you see and begin navigating.")]
            ),
            turn_complete=True,
        )

        try:
            await asyncio.gather(
                camera_loop(session, stop_event),
                response_loop(session, stop_event),
            )
        except (KeyboardInterrupt, asyncio.CancelledError):
            log.info("Shutting down...")
            stop_event.set()
            # Emergency stop on exit
            try:
                await _stop()
                log.info("Motors stopped.")
            except Exception:
                pass


if __name__ == "__main__":
    asyncio.run(main())
