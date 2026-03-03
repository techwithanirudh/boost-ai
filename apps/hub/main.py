import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

from hub.models import ExecuteMotionCommand
from hub.service import HubService

# Load root .env (boost/.env) so EV3_MAC etc. are available
load_dotenv(Path(__file__).parent.parent.parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s - %(message)s",
)

service = HubService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.get_event_loop().run_in_executor(None, service.connect)
    yield
    await asyncio.get_event_loop().run_in_executor(None, service.disconnect)

app = FastAPI(title="boost-hub", version="0.1.0", lifespan=lifespan)

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
