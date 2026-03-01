from fastapi import FastAPI

from hub.models import ExecuteMotionCommand
from hub.service import HubService

app = FastAPI(title="boost-hub", version="0.1.0")
service = HubService()


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "service": "hub",
        "connected": service.connected,
    }


@app.get("/hub/state")
def hub_state() -> dict:
    return {
        "ok": True,
        "data": service.state(),
    }


@app.post("/motion/execute")
def motion_execute(payload: ExecuteMotionCommand) -> dict:
    return service.execute(payload)


@app.post("/motion/emergency-stop")
def motion_emergency_stop() -> dict:
    return service.emergency_stop()
