import logging
import time

import ev3_dc as ev3

logger = logging.getLogger(__name__)

PORT_DRIVE = ev3.PORT_B
PORT_STEER = ev3.PORT_A
PORT_STRIKE = ev3.PORT_D

STEER_MAX_DEG: int = 120
DRIVE_DEG_PER_CM: float = 36.0

STEER_SPEED: int = 80
DRIVE_SPEED: int = 60
JAW_OPEN_SPEED: int = 60
JAW_CLOSE_SPEED: int = 80
JAW_CLOSE_S: float = 1.0


class Motors:
    def __init__(self, brick: ev3.EV3) -> None:
        self._drive = ev3.Motor(PORT_DRIVE, ev3_obj=brick)
        self._steer = ev3.Motor(PORT_STEER, ev3_obj=brick)
        self._strike = ev3.Motor(PORT_STRIKE, ev3_obj=brick)
        self._close_jaw()

    def _close_jaw(self) -> None:
        self._strike.move_for(JAW_CLOSE_S, speed=JAW_CLOSE_SPEED, direction=-1, brake=True).start(
            thread=False
        )

    def do_stop(self) -> None:
        self._drive.stop()
        self._steer.stop()
        self._strike.stop(brake=True)
        logger.info("stop")

    def do_forward(self, dist_cm: float, speed_pct: int) -> None:
        dist_cm = max(5.0, min(300.0, dist_cm))
        degrees = int(round(dist_cm * DRIVE_DEG_PER_CM))
        logger.info("forward %.1f cm → %d° @ %d%%", dist_cm, degrees, speed_pct)
        self._drive.move_by(degrees, speed=speed_pct, brake=True).start(thread=False)

    def do_backward(self, dist_cm: float, speed_pct: int) -> None:
        dist_cm = max(5.0, min(300.0, dist_cm))
        degrees = int(round(dist_cm * DRIVE_DEG_PER_CM))
        logger.info("backward %.1f cm → %d° @ %d%%", dist_cm, degrees, speed_pct)
        self._drive.move_by(-degrees, speed=speed_pct, brake=True).start(thread=False)

    def do_turn(self, value: float) -> None:
        target_deg = max(-STEER_MAX_DEG, min(STEER_MAX_DEG, int(round(value))))
        current_deg = int(round(self._steer.position))
        delta_deg = target_deg - current_deg
        logger.info(
            "steer → %d° (from %d°, Δ=%d°) @ %d%%",
            target_deg,
            current_deg,
            delta_deg,
            STEER_SPEED,
        )
        self._steer.move_by(delta_deg, speed=STEER_SPEED, brake=True).start(thread=False)

    def do_strike(self, duration_s: float, speed_pct: int) -> None:
        logger.info("strike — jaw open %.2f s @ %d%%", duration_s, speed_pct)
        self._strike.move_for(0.4, speed=speed_pct, direction=1, brake=False).start(thread=False)
        time.sleep(duration_s)
        self._close_jaw()

    def emergency_stop(self) -> list[str]:
        errors: list[str] = []
        for name, motor in [
            ("drive", self._drive),
            ("steer", self._steer),
            ("strike", self._strike),
        ]:
            try:
                motor.stop()
            except Exception as exc:
                errors.append(f"{name}: {exc}")
        return errors
