import os
from typing import Any

from .models import ExecuteMotionCommand
from .safety import Watchdog


class HubService:
    """Scaffold service. Real pylgbst wiring lands in next phase."""

    def __init__(self) -> None:
        self.connected = False
        self.default_speed = float(os.getenv("MOTOR_DEFAULT_SPEED", "0.5"))
        self.watchdog = Watchdog(timeout_s=float(os.getenv("WATCHDOG_TIMEOUT_S", "5")))

    def state(self) -> dict[str, Any]:
        return {
            "connected": self.connected,
            "watchdog_expired": self.watchdog.expired(),
        }

    def _ok(self, action: str, payload: ExecuteMotionCommand | None = None) -> dict[str, Any]:
        self.watchdog.pet()
        return {
            "ok": True,
            "data": {
                "action": action,
                "payload": payload.model_dump() if payload else None,
                "note": "hub scaffold mode - no BLE command sent yet",
            },
            "error": None,
        }

    def execute(self, payload: ExecuteMotionCommand) -> dict[str, Any]:
        if payload.action == "stop":
            return self._ok("stop", payload)

        if payload.action == "turn_deg":
            bounded = max(-90.0, min(90.0, payload.value))
            return self._ok(payload.action, payload.model_copy(update={"value": bounded}))

        bounded = max(5.0, min(30.0, payload.value))
        return self._ok(payload.action, payload.model_copy(update={"value": bounded}))

    def stop(self) -> dict[str, Any]:
        return self.execute(ExecuteMotionCommand(action="stop", value=0.0, speed=self.default_speed, text="manual stop"))

    def emergency_stop(self) -> dict[str, Any]:
        return self._ok("emergency-stop")
