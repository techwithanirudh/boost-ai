"""
pyhub — FastAPI + pylgbst BLE motor control service.

  POST /execute   — run a motion primitive (logged to DB)
  POST /stop      — emergency stop
  GET  /health    — liveness + BLE status
  GET  /telemetry — battery voltage
  GET  /commands  — recent command log

Run:
  uv run --env-file .env uvicorn main:app --host 0.0.0.0 --port 8000
"""

import asyncio
import json
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import select

from db import CommandLog, SessionDep, create_tables
from hub import Watchdog, connect, forward_cm, backward_cm, turn_deg, stop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("pyhub")

_hub_ref: list = [None]
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="hub")
_watchdog = Watchdog(_hub_ref)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    hub = connect()
    _hub_ref[0] = hub
    _watchdog.start()
    _watchdog.pet()
    log.info("pyhub ready")
    yield
    _watchdog.stop()
    hub = _hub_ref[0]
    if hub:
        try:
            hub.switch_off()
        except Exception:
            hub.disconnect()
    log.info("pyhub shutdown")


app = FastAPI(title="pyhub", lifespan=lifespan)


def _require_hub():
    hub = _hub_ref[0]
    if hub is None:
        raise HTTPException(status_code=503, detail="Hub not connected")
    return hub


async def _run_sync(fn, *args):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, fn, *args)


class ExecuteRequest(BaseModel):
    command_id: str
    primitive: str = Field(..., pattern="^(forward_cm|backward_cm|turn_deg|stop)$")
    args: dict = {}


class ExecuteResponse(BaseModel):
    command_id: str
    accepted: bool
    primitive: str


class StopResponse(BaseModel):
    stopped: bool


class HealthResponse(BaseModel):
    ok: bool
    ble_connected: bool
    mock: bool


class TelemetryResponse(BaseModel):
    ble_connected: bool
    battery_voltage: float | None


@app.post("/execute", response_model=ExecuteResponse)
async def execute(req: ExecuteRequest, db: SessionDep):
    hub = _require_hub()
    _watchdog.pet()

    start = time.monotonic()
    error: str | None = None

    def _run():
        match req.primitive:
            case "forward_cm":
                forward_cm(hub, float(req.args.get("distance_cm", 10)), float(req.args.get("speed", 0.5)))
            case "backward_cm":
                backward_cm(hub, float(req.args.get("distance_cm", 10)), float(req.args.get("speed", 0.5)))
            case "turn_deg":
                turn_deg(hub, float(req.args.get("angle_deg", 90)), float(req.args.get("speed", 0.4)))
            case "stop":
                stop(hub)

    try:
        await _run_sync(_run)
    except Exception as exc:
        error = str(exc)
        log.error("Execute failed: %s", exc)
    finally:
        db.add(CommandLog(
            command_id=req.command_id,
            primitive=req.primitive,
            args=json.dumps(req.args),
            ok=error is None,
            error=error,
            duration_ms=(time.monotonic() - start) * 1000,
        ))
        db.commit()

    if error:
        raise HTTPException(status_code=500, detail=error)

    return ExecuteResponse(command_id=req.command_id, accepted=True, primitive=req.primitive)


@app.post("/stop", response_model=StopResponse)
async def emergency_stop():
    hub = _hub_ref[0]
    if hub:
        await _run_sync(hub.motor_AB.stop)
        log.warning("Emergency stop triggered")
    return StopResponse(stopped=True)


@app.get("/health", response_model=HealthResponse)
async def health():
    _watchdog.pet()
    return HealthResponse(
        ok=_hub_ref[0] is not None,
        ble_connected=_hub_ref[0] is not None,
        mock=os.getenv("MOCK_HUB", "false").lower() == "true",
    )


@app.get("/telemetry", response_model=TelemetryResponse)
async def telemetry():
    hub = _hub_ref[0]
    voltage = None
    if hub and hasattr(hub, "voltage") and hub.voltage is not None:
        try:
            voltage = hub.voltage.voltage
        except Exception:
            pass
    return TelemetryResponse(ble_connected=hub is not None, battery_voltage=voltage)


@app.get("/commands", response_model=list[CommandLog])
async def list_commands(db: SessionDep, limit: int = 50):
    return db.exec(
        select(CommandLog).order_by(CommandLog.created_at.desc()).limit(limit)
    ).all()
