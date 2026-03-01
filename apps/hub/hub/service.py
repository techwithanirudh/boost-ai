import logging
import os
import time
from typing import Any

from pylgbst import get_connection_bleak
from pylgbst.hub import MoveHub, VisionSensor

from .models import ExecuteMotionCommand
from .safety import Watchdog

logger = logging.getLogger(__name__)

_CM_PER_SEC_AT_FULL = 15.0   # cm/s at speed=1.0
_DEG_PER_SEC_AT_FULL = 90.0  # degrees/s at speed=1.0 for a differential turn

class HubService:
    def __init__(self) -> None:
        self.connected = False
        self._hub: MoveHub | None = None
        self._mac: str | None = os.getenv("HUB_MAC") or None
        self._stop = False
        self.watchdog = Watchdog(timeout_s=5.0)
        self._distance: float | None = None

    def connect(self) -> None:
        """Blocking BLE connect with retry, runs in a thread."""
        label = f"[{self._mac}]" if self._mac else '(name="Move Hub")'
        attempt = 0
        while not self._stop:
            attempt += 1
            logger.info("Connecting to LEGO Boost hub %s (attempt %d) …", label, attempt)
            try:
                conn = get_connection_bleak(
                    hub_mac=self._mac,
                    hub_name=None if self._mac else "Move Hub",
                )
                hub = MoveHub(conn)
                if self._stop:
                    try:
                        hub.disconnect()
                    except Exception:
                        pass
                    return

                self._hub = hub
                self.connected = True
                self._attach_distance_sensor()
                try:
                    hub.motor_external.goto_position(
                        -1,
                        speed=1.0,
                        end_state=hub.motor_external.END_STATE_HOLD,
                        wait_complete=False,
                    )
                    logger.info("External motor holding at %d°", _EXTERNAL_HOLD_TARGET_DEG)
                except Exception as exc:
                    logger.warning("External motor initialization failed: %s", exc)
                logger.info("Connected to LEGO Boost hub %s", label)
                return
            except Exception as exc:
                logger.error("BLE connect failed: %s — retrying in 5s", exc)
                self.connected = False
                self._hub = None
                time.sleep(5)

    def disconnect(self) -> None:
        self._stop = True
        if self._hub:
            try:
                self._hub.disconnect()
            except Exception:
                pass
        self.connected = False
        self._hub = None
        logger.info("Disconnected from LEGO Boost hub")

    def state(self) -> dict[str, Any]:
        return {
            "connected": self.connected,
            "distance": self._distance,
        }

    def execute(self, payload: ExecuteMotionCommand) -> dict[str, Any]:
        if not self.connected or self._hub is None:
            return self._err("hub_not_connected")

        hub = self._hub
        action = payload.action
        speed = self._normalized_speed(payload.speed)

        try:
            if action == "stop":
                hub.motor_AB.stop()

            elif action == "forward_cm":
                dist = max(5.0, min(30.0, payload.value))
                secs = dist / (_CM_PER_SEC_AT_FULL * speed)
                logger.info("forward %.1f cm → %.2f s @ speed=%.2f", dist, secs, speed)
                hub.motor_AB.timed(secs, speed, speed, wait_complete=True)

            elif action == "backward_cm":
                dist = max(5.0, min(30.0, payload.value))
                secs = dist / (_CM_PER_SEC_AT_FULL * speed)
                logger.info("backward %.1f cm → %.2f s @ speed=%.2f", dist, secs, speed)
                hub.motor_AB.timed(secs, -speed, -speed, wait_complete=True)

            elif action == "turn_deg":
                deg = max(-90.0, min(90.0, payload.value))
                secs = abs(deg) / (_DEG_PER_SEC_AT_FULL * speed)
                direction = 1.0 if deg >= 0 else -1.0
                logger.info("turn %.1f° → %.2f s @ speed=%.2f", deg, secs, speed)
                hub.motor_AB.timed(
                    secs,
                    direction * speed,
                    -direction * speed,
                    wait_complete=True,
                )

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

    def _attach_distance_sensor(self) -> None:
        if self._hub is None:
            return

        sensor = getattr(self._hub, "vision_sensor", None) or getattr(
            self._hub, "color_distance_sensor", None
        )
        if sensor is None:
            logger.warning("Distance sensor not available on this hub")
            return

        try:
            sensor.subscribe(
                self._on_color_distance_update, mode=VisionSensor.COLOR_DISTANCE_FLOAT
            )
            cached_distance_inches = getattr(sensor, "distance", None)
            if isinstance(cached_distance_inches, (int, float)):
                self._update_distance_cm(float(cached_distance_inches))
            logger.info("Distance sensor subscribed (mode=COLOR_DISTANCE_FLOAT)")
        except Exception as exc:
            logger.warning("Distance sensor subscribe failed: %s", exc)

    def _on_color_distance_update(self, *values: Any) -> None:
        if not values:
            return

        distance_inches: float | None = None
        if len(values) >= 2 and isinstance(values[1], (int, float)):
            distance_inches = float(values[1])
        elif isinstance(values[0], (int, float)):
            distance_inches = float(values[0])

        if distance_inches is None:
            return

        # Ignore invalid/sentinel payloads (e.g. 0xFF)
        if distance_inches >= 255:
            return

        self._update_distance_cm(distance_inches)

    def _update_distance_cm(self, distance_inches: float) -> None:
        if distance_inches < 0:
            return
        self._distance = round(distance_inches * 2.54, 1)

    def _normalized_speed(self, speed: float) -> float:
        return max(0.05, min(1.0, abs(speed)))
