import logging
import os
import threading
import time
from typing import Any

import ev3_dc as ev3

from .models import ExecuteMotionCommand
from .safety import Watchdog

logger = logging.getLogger(__name__)

_PORT_DRIVE  = ev3.PORT_B
_PORT_STEER  = ev3.PORT_A
_PORT_STRIKE = ev3.PORT_D
_PORT_IR     = ev3.PORT_4

_DRIVE_DEG_PER_CM: float = 36.0
_STEER_DEG_PER_HEADING_DEG: float = 3.0

_CONNECT_RETRY_S: float = 5.0


class HubService:
    def __init__(self) -> None:
        self.connected = False
        self._brick: ev3.EV3 | None = None
        self._drive: ev3.Motor | None = None
        self._steer: ev3.Motor | None = None
        self._strike: ev3.Motor | None = None
        self._ir: ev3.Infrared | None = None
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
                self._brick  = brick
                self._drive  = ev3.Motor(_PORT_DRIVE,  ev3_obj=brick)
                self._steer  = ev3.Motor(_PORT_STEER,  ev3_obj=brick)
                self._strike = ev3.Motor(_PORT_STRIKE, ev3_obj=brick)
                try:
                    self._ir = ev3.Infrared(_PORT_IR, ev3_obj=brick)
                except Exception as ir_exc:
                    logger.warning("IR sensor not available at PORT_4: %s", ir_exc)
                    self._ir = None
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
        if self._ir is not None:
            try:
                distance = float(self._ir.distance)
            except Exception:
                pass
        if self._brick is not None:
            try:
                battery = float(self._brick.battery.voltage)
            except Exception:
                pass
        return {"connected": self.connected, "distance": distance, "battery": battery}

    def execute(self, payload: ExecuteMotionCommand) -> dict[str, Any]:
        if not self.connected or self._brick is None:
            return self._err("ev3_not_connected")
        with self._execute_lock:
            return self._execute_inner(payload)

    def _execute_inner(self, payload: ExecuteMotionCommand) -> dict[str, Any]:
        action    = payload.action
        speed_pct = max(5, min(100, int(round(payload.speed * 100))))

        try:
            if action == "stop":
                self._drive.stop()
                self._steer.stop()
                logger.info("stop")

            elif action == "forward_cm":
                dist_cm = max(5.0, min(300.0, payload.value))
                degrees = int(round(dist_cm * _DRIVE_DEG_PER_CM))
                logger.info("forward %.1f cm → %d° @ %d%%", dist_cm, degrees, speed_pct)
                self._drive.move_by(degrees, speed=speed_pct, brake=True).start(thread=False)

            elif action == "backward_cm":
                dist_cm = max(5.0, min(300.0, payload.value))
                degrees = int(round(dist_cm * _DRIVE_DEG_PER_CM))
                logger.info("backward %.1f cm → %d° @ %d%%", dist_cm, degrees, speed_pct)
                self._drive.move_by(-degrees, speed=speed_pct, brake=True).start(thread=False)

            elif action == "turn_deg":
                deg = max(-90.0, min(90.0, payload.value))
                motor_deg = int(round(deg * _STEER_DEG_PER_HEADING_DEG))
                logger.info("turn %.1f° → %d motor° @ %d%%", deg, motor_deg, speed_pct)
                self._steer.move_by(motor_deg, speed=speed_pct, brake=True).start(thread=False)

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
        errors: list[str] = []
        for name, motor in [("drive", self._drive), ("steer", self._steer), ("strike", self._strike)]:
            if motor is not None:
                try:
                    motor.stop()
                except Exception as exc:
                    errors.append(f"{name}: {exc}")
        if errors:
            logger.error("Emergency stop partial failure: %s", "; ".join(errors))
        else:
            logger.warning("Emergency stop executed")
        self.watchdog.pet()
        return {"ok": not errors, "data": {"action": "emergency-stop"}, "error": "; ".join(errors) or None}

    def _ok(self, action: str, payload: ExecuteMotionCommand | None = None) -> dict[str, Any]:
        return {
            "ok": True,
            "data": {"action": action, "payload": payload.model_dump() if payload else None},
            "error": None,
        }

    def _err(self, msg: str) -> dict[str, Any]:
        return {"ok": False, "data": None, "error": msg}
