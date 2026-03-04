import logging

import ev3_dc as ev3

logger = logging.getLogger(__name__)

PORT_IR = ev3.PORT_4


class Sensors:
    def __init__(self, brick: ev3.EV3) -> None:
        self._brick = brick
        self._ir: ev3.Infrared | None = None
        try:
            self._ir = ev3.Infrared(PORT_IR, ev3_obj=brick)
        except Exception as exc:
            logger.warning("IR sensor not available: %s", exc)

    def read_distance(self) -> float | None:
        if self._ir is None:
            return None
        try:
            return float(self._ir.distance)
        except Exception:
            return None

    def read_battery(self) -> float | None:
        try:
            return float(self._brick.battery.percentage)
        except Exception:
            return None
