"""
agent — Gemini Live agent for LEGO BOOST robot.

  Streams 1fps camera frames to Gemini Live (text mode + vision).
  Dispatches forward_cm / backward_cm / turn_deg / stop tool calls to pyhub.
  Persists session handle so the 2-min video session can be resumed.

Run:
  uv run --env-file .env python agent.py
"""

import asyncio
import contextlib
import logging
import os
import uuid
from pathlib import Path

import httpx
from google import genai
from google.genai import types

from camera import Camera

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("agent")

PYHUB_URL   = os.getenv("PYHUB_URL", "http://localhost:8000")
MODEL       = "gemini-2.5-flash-native-audio-preview-12-2025"
HANDLE_FILE = Path(".session_handle")

SYSTEM_PROMPT = """
You are an AI with a physical body — a LEGO BOOST robot.
You see through an onboard camera that sends you one frame per second.

Your job: explore the world, narrate what you see, and navigate safely.

Rules:
- Analyse every frame carefully before deciding to move.
- If you see an obstacle or the path is unclear, stop and turn first.
- Max 30 cm per forward_cm call. Max 90 degrees per turn_deg call.
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
                "distance_cm": {"type": "number"},
                "speed":       {"type": "number", "description": "0.0–1.0, default 0.5"},
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


# ── Session handle (persists across 2-min video sessions) ───────────────────

def _load_handle() -> str | None:
    return HANDLE_FILE.read_text().strip() if HANDLE_FILE.exists() else None


def _save_handle(handle: str) -> None:
    HANDLE_FILE.write_text(handle)


# ── pyhub dispatch ──────────────────────────────────────────────────────────

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


# ── Tool handler ────────────────────────────────────────────────────────────

async def handle_tool_call(session, tool_call) -> None:
    responses = []
    for fc in tool_call.function_calls:
        log.info("Tool: %s(%s)", fc.name, dict(fc.args))
        try:
            result = await _stop() if fc.name == "stop" else await _dispatch(fc.name, dict(fc.args))
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
                jpeg = await loop.run_in_executor(None, cam.capture_jpeg)
                await session.send_realtime_input(
                    media=types.Blob(data=jpeg, mime_type="image/jpeg")
                )
            except RuntimeError as exc:
                log.warning("Camera: %s", exc)
            await asyncio.sleep(1.0)
    finally:
        cam.release()
        log.info("Camera released")


# ── Response loop ────────────────────────────────────────────────────────────

async def response_loop(session, stop_event: asyncio.Event) -> None:
    async for message in session.receive():
        if stop_event.is_set():
            break

        if message.go_away:
            log.warning("Server closing session in %s — will reconnect", message.go_away.time_left)
            stop_event.set()
            break

        if message.session_resumption_update:
            update = message.session_resumption_update
            if update.resumable and update.new_handle:
                _save_handle(update.new_handle)

        if message.tool_call:
            await handle_tool_call(session, message.tool_call)

        sc = message.server_content
        if sc:
            if sc.model_turn:
                for part in sc.model_turn.parts:
                    if part.text:
                        print(f"Gemini: {part.text}", end="", flush=True)
            if sc.turn_complete:
                print()
            if sc.interrupted:
                log.info("[interrupted]")


# ── Main ────────────────────────────────────────────────────────────────────

async def main() -> None:
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{PYHUB_URL}/health", timeout=5)
            h = r.json()
            if not h.get("ble_connected") and not h.get("mock"):
                log.warning("pyhub: BLE not connected (hub may be off)")
            else:
                log.info("pyhub: ready — ble_connected=%s", h.get("ble_connected"))
    except Exception as exc:
        log.error("Cannot reach pyhub at %s: %s", PYHUB_URL, exc)
        return

    genai_client = genai.Client()
    stop_event   = asyncio.Event()

    config = types.LiveConnectConfig(
        response_modalities=["TEXT"],
        system_instruction=SYSTEM_PROMPT,
        tools=TOOLS,
        context_window_compression=types.ContextWindowCompressionConfig(
            sliding_window=types.SlidingWindow(),
        ),
        session_resumption=types.SessionResumptionConfig(handle=_load_handle()),
    )

    log.info("Connecting to Gemini Live (%s)...", MODEL)
    async with genai_client.aio.live.connect(model=MODEL, config=config) as session:
        log.info("Connected. Ctrl+C to stop.\n")

        await session.send_client_content(
            turns=types.Content(
                role="user",
                parts=[types.Part(text="Start exploring. Describe what you see and begin navigating.")],
            ),
            turn_complete=True,
        )

        try:
            async with asyncio.TaskGroup() as tg:
                tg.create_task(camera_loop(session, stop_event), name="camera")
                tg.create_task(response_loop(session, stop_event), name="response")
        except* Exception as eg:
            for exc in eg.exceptions:
                if not isinstance(exc, asyncio.CancelledError):
                    log.error("Task error: %s", exc)
        finally:
            stop_event.set()
            with contextlib.suppress(Exception):
                await _stop()
                log.info("Motors stopped.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
