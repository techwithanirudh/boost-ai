import os
from typing import Any

from .models import MotionCommand
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

    def _ok(self, action: str, payload: MotionCommand | None = None) -> dict[str, Any]:
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

    def forward(self, payload: MotionCommand) -> dict[str, Any]:
        return self._ok("forward", payload)

    def backward(self, payload: MotionCommand) -> dict[str, Any]:
        return self._ok("backward", payload)

    def turn(self, payload: MotionCommand) -> dict[str, Any]:
        return self._ok("turn", payload)

    def stop(self) -> dict[str, Any]:
        return self._ok("stop")

    def emergency_stop(self) -> dict[str, Any]:
        return self._ok("emergency-stop")
