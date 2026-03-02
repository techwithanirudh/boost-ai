import logging
import math
import os
import time
from typing import Any

from pylgbst import get_connection_bleak
from pylgbst.hub import MoveHub, VisionSensor

from .models import ExecuteMotionCommand
from .safety import Watchdog

logger = logging.getLogger(__name__)

_MOTOR_DEG_PER_CM = 20.5  # encoder degrees per cm of linear travel (56 mm wheel)
_WHEEL_TRACK_CM = 11.0  # distance between wheel contact points (centre-to-centre)
_EXTERNAL_HOLD_TARGET_DEG = -1
_BATTERY_MAX_VOLTS = 9.6  # 6×AA alkaline full charge (~1.6 V/cell)


class HubService:
    def __init__(self) -> None:
        self.connected = False
        self._hub: MoveHub | None = None
        self._mac: str | None = os.getenv("HUB_MAC") or None
        self._stop = False
        self.watchdog = Watchdog(timeout_s=5.0)
        self._distance: float | None = None
        # Dead-reckoning pose (origin = position at connect time)
        self._x: float = 0.0  # metres, positive = forward from start
        self._y: float = 0.0  # metres, positive = left from start
        self._heading: float = 0.0  # degrees, 0 = forward, +90 = left, -90 = right

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
        battery: int | None = None
        if self._hub is not None and self._hub.voltage is not None:
            try:
                volts = self._hub.voltage.voltage
                battery = max(0, min(100, round(volts / _BATTERY_MAX_VOLTS * 100)))
            except Exception:
                pass
        return {
            "connected": self.connected,
            "distance": self._distance,
            "battery": battery,
            "pose": {
                "x": round(self._x, 3),
                "y": round(self._y, 3),
                "heading": round(self._heading, 1),
            },
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
                dist = max(5.0, min(1000.0, payload.value))
                motor_deg = int(round(dist * _MOTOR_DEG_PER_CM))
                logger.info("forward %.1f cm → %d motor° @ speed=%.2f", dist, motor_deg, speed)
                hub.motor_AB.angled(motor_deg, speed, speed, wait_complete=True)
                self._accumulate_linear(dist / 100.0)

            elif action == "backward_cm":
                dist = max(5.0, min(1000.0, payload.value))
                motor_deg = int(round(dist * _MOTOR_DEG_PER_CM))
                logger.info("backward %.1f cm → %d motor° @ speed=%.2f", dist, motor_deg, speed)
                hub.motor_AB.angled(motor_deg, -speed, -speed, wait_complete=True)
                self._accumulate_linear(-dist / 100.0)

            elif action == "turn_deg":
                deg = max(-180.0, min(180.0, payload.value))
                arc_cm = (abs(deg) / 360.0) * math.pi * _WHEEL_TRACK_CM
                motor_deg = int(round(arc_cm * _MOTOR_DEG_PER_CM))
                direction = 1.0 if deg >= 0 else -1.0
                logger.info(
                    "turn %.1f° → arc=%.2f cm, %d motor° @ speed=%.2f",
                    deg,
                    arc_cm,
                    motor_deg,
                    speed,
                )

                hub.motor_AB.angled(
                    motor_deg,
                    direction * speed,
                    -direction * speed,
                    wait_complete=True,
                )
                self._accumulate_turn(deg)

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

    def _accumulate_linear(self, dist_m: float) -> None:
        """Integrate a linear movement into x/y using current heading."""
        rad = math.radians(self._heading)
        self._x += dist_m * math.cos(rad)
        self._y += dist_m * math.sin(rad)

    def _accumulate_turn(self, deg: float) -> None:
        """Integrate a turn into heading. Positive = clockwise = heading decreases (right)."""
        self._heading = (self._heading - deg) % 360
        if self._heading > 180:
            self._heading -= 360

    def _ok(self, action: str, payload: ExecuteMotionCommand | None = None) -> dict[str, Any]:
        return {
            "ok": True,
            "data": {
                "action": action,
                "payload": payload.model_dump() if payload else None,
                "pose": {
                    "x": round(self._x, 3),
                    "y": round(self._y, 3),
                    "heading": round(self._heading, 1),
                },
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
            sensor.subscribe(self._on_color_distance_update, mode=VisionSensor.COLOR_DISTANCE_FLOAT)
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

        if distance_inches >= 255:
            return

        self._update_distance_cm(distance_inches)

    def _update_distance_cm(self, distance_inches: float) -> None:
        if distance_inches < 0:
            return
        self._distance = round(distance_inches * 2.54, 1)

    def _normalized_speed(self, speed: float) -> float:
        return max(0.05, min(1.0, abs(speed)))
