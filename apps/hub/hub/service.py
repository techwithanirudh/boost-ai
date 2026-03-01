import logging
import os
from typing import Any

from pylgbst import get_connection_bleak
from pylgbst.hub import MoveHub

from .models import ExecuteMotionCommand
from .safety import Watchdog

logger = logging.getLogger(__name__)

# Rough calibration constants — tune against your robot
_CM_PER_SEC_AT_FULL = 15.0   # cm/s at speed=1.0
_DEG_PER_SEC_AT_FULL = 90.0  # degrees/s at speed=1.0 for a differential turn


class HubService:
    def __init__(self) -> None:
        self.connected = False
        self._hub: MoveHub | None = None
        self._mac: str | None = os.getenv("HUB_MAC") or None
        self.watchdog = Watchdog(timeout_s=5.0)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def connect(self) -> None:
        """Blocking BLE connect — run in a thread from the lifespan handler."""
        label = f"[{self._mac}]" if self._mac else '(name="Move Hub")'
        logger.info("Connecting to LEGO Boost hub %s …", label)
        try:
            conn = get_connection_bleak(
                hub_mac=self._mac,
                hub_name=None if self._mac else "Move Hub",
            )
            self._hub = MoveHub(conn)
            self.connected = True
            logger.info("Connected to LEGO Boost hub %s", label)
        except Exception as exc:
            logger.error("BLE connect failed: %s", exc)
            self.connected = False

    def disconnect(self) -> None:
        if self._hub:
            try:
                self._hub.disconnect()
            except Exception:
                pass
        self.connected = False
        self._hub = None
        logger.info("Disconnected from LEGO Boost hub")

    # ------------------------------------------------------------------
    # State
    # ------------------------------------------------------------------

    def state(self) -> dict[str, Any]:
        return {
            "connected": self.connected,
            "watchdog_expired": self.watchdog.expired(),
        }

    # ------------------------------------------------------------------
    # Motion
    # ------------------------------------------------------------------

    def execute(self, payload: ExecuteMotionCommand) -> dict[str, Any]:
        if not self.connected or self._hub is None:
            return self._err("hub_not_connected")

        hub = self._hub
        action = payload.action
        speed = payload.speed

        try:
            if action == "stop":
                hub.motor_AB.stop()

            elif action == "forward_cm":
                dist = max(5.0, min(30.0, payload.value))
                secs = dist / (_CM_PER_SEC_AT_FULL * speed)
                logger.info("forward %.1f cm → %.2f s @ speed=%.2f", dist, secs, speed)
                hub.motor_AB.timed(secs, speed, speed)

            elif action == "backward_cm":
                dist = max(5.0, min(30.0, payload.value))
                secs = dist / (_CM_PER_SEC_AT_FULL * speed)
                logger.info("backward %.1f cm → %.2f s @ speed=%.2f", dist, secs, speed)
                hub.motor_AB.timed(secs, -speed, -speed)

            elif action == "turn_deg":
                deg = max(-90.0, min(90.0, payload.value))
                secs = abs(deg) / (_DEG_PER_SEC_AT_FULL * speed)
                direction = 1.0 if deg >= 0 else -1.0
                logger.info("turn %.1f° → %.2f s @ speed=%.2f", deg, secs, speed)
                hub.motor_AB.timed(secs, direction * speed, -direction * speed)

            else:
                return self._err(f"unknown_action: {action}")

        except Exception as exc:
            logger.error("Motor command failed: %s", exc)
            return self._err(str(exc))

        self.watchdog.pet()
        return self._ok(action, payload)

    def stop(self) -> dict[str, Any]:
        return self.execute(
            ExecuteMotionCommand(action="stop", value=0.0, speed=0.5, text="manual stop")
        )

    def emergency_stop(self) -> dict[str, Any]:
        if self._hub:
            try:
                self._hub.motor_AB.stop()
                logger.warning("Emergency stop executed")
            except Exception as exc:
                logger.error("Emergency stop failed: %s", exc)
        self.watchdog.pet()
        return self._ok("emergency-stop")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _ok(self, action: str, payload: ExecuteMotionCommand | None = None) -> dict[str, Any]:
        return {
            "ok": True,
            "data": {
                "action": action,
                "payload": payload.model_dump() if payload else None,
            },
            "error": None,
        }

    def _err(self, msg: str) -> dict[str, Any]:
        return {"ok": False, "data": None, "error": msg}
