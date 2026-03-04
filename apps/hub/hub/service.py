import logging
import os
import threading
import time
from typing import Any

import ev3_dc as ev3

from .models import ExecuteMotionCommand
from .motors import Motors
from .safety import Watchdog
from .sensors import Sensors

logger = logging.getLogger(__name__)

_CONNECT_RETRY_S: float = 5.0


class HubService:
    def __init__(self) -> None:
        self.connected = False
        self._brick: ev3.EV3 | None = None
        self._motors: Motors | None = None
        self._sensors: Sensors | None = None
        self._mac: str | None = os.getenv("EV3_MAC") or os.getenv("HUB_MAC")
        self._stop_flag = False
        self.watchdog = Watchdog(timeout_s=5.0)
        self._execute_lock = threading.Lock()

    def connect(self) -> None:
        attempt = 0
        while not self._stop_flag:
            attempt += 1
            label = self._mac or "(auto-discover)"
            logger.info("Connecting to EV3 %s (attempt %d)…", label, attempt)
            try:
                brick = ev3.EV3(protocol=ev3.BLUETOOTH, host=self._mac)
                self._brick = brick
                self._motors = Motors(brick)
                self._sensors = Sensors(brick)
                self.connected = True
                logger.info("Connected to EV3 %s", label)
                return
            except Exception as exc:
                logger.error("EV3 connect failed: %s — retrying in %.0fs", exc, _CONNECT_RETRY_S)
                self.connected = False
                self._brick = None
                time.sleep(_CONNECT_RETRY_S)

    def disconnect(self) -> None:
        self._stop_flag = True
        self.connected = False
        if self._brick is not None:
            try:
                self._brick.__exit__(None, None, None)
            except Exception:
                pass
        self._brick = None
        logger.info("Disconnected from EV3")

    def state(self) -> dict[str, Any]:
        distance: float | None = None
        battery: float | None = None
        if self._sensors is not None:
            distance = self._sensors.read_distance()
            battery = self._sensors.read_battery()
        return {"connected": self.connected, "distance": distance, "battery": battery}

    def execute(self, payload: ExecuteMotionCommand) -> dict[str, Any]:
        if not self.connected or self._motors is None:
            return self._err("ev3_not_connected")
        with self._execute_lock:
            return self._execute_inner(payload)

    def _execute_inner(self, payload: ExecuteMotionCommand) -> dict[str, Any]:
        action = payload.action
        speed_pct = max(5, min(100, int(round(payload.speed * 100))))

        try:
            if action == "stop":
                self._motors.do_stop()
            elif action == "forward_cm":
                self._motors.do_forward(payload.value, speed_pct)
            elif action == "backward_cm":
                self._motors.do_backward(payload.value, speed_pct)
            elif action == "turn_deg":
                self._motors.do_turn(payload.value)
            elif action == "strike":
                duration_s = max(0.1, min(5.0, payload.value))
                self._motors.do_strike(duration_s, speed_pct)
            else:
                return self._err(f"unknown_action: {action}")
        except Exception as exc:
            logger.error("EV3 command failed: %s", exc)
            return self._err(str(exc))

        self.watchdog.pet()
        return self._ok(action, payload)

    def stop(self) -> dict[str, Any]:
        return self.execute(
            ExecuteMotionCommand(action="stop", value=0.0, speed=0.5, text="manual stop")
        )

    def emergency_stop(self) -> dict[str, Any]:
        if self._motors is None:
            return self._err("ev3_not_connected")
        errors = self._motors.emergency_stop()
        if errors:
            logger.error("Emergency stop partial failure: %s", "; ".join(errors))
        else:
            logger.warning("Emergency stop executed")
        self.watchdog.pet()
        return {
            "ok": not errors,
            "data": {"action": "emergency-stop"},
            "error": "; ".join(errors) or None,
        }

    def _ok(self, action: str, payload: ExecuteMotionCommand | None = None) -> dict[str, Any]:
        return {
            "ok": True,
            "data": {"action": action, "payload": payload.model_dump() if payload else None},
            "error": None,
        }

    def _err(self, msg: str) -> dict[str, Any]:
        return {"ok": False, "data": None, "error": msg}
