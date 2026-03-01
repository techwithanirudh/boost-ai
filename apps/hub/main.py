from fastapi import FastAPI

from hub.models import MotionCommand
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


@app.post("/motion/forward")
def motion_forward(payload: MotionCommand) -> dict:
    return service.forward(payload)


@app.post("/motion/backward")
def motion_backward(payload: MotionCommand) -> dict:
    return service.backward(payload)


@app.post("/motion/turn")
def motion_turn(payload: MotionCommand) -> dict:
    return service.turn(payload)


@app.post("/motion/stop")
def motion_stop() -> dict:
    return service.stop()


@app.post("/motion/emergency-stop")
def motion_emergency_stop() -> dict:
    return service.emergency_stop()
