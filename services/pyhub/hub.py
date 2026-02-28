"""
hub.py — LEGO BOOST Move Hub: connection, primitives, watchdog.

Docs:  https://github.com/undera/pylgbst
Motor: https://github.com/undera/pylgbst/blob/master/docs/Motor.md
"""

import math
import os
import threading
import time
import logging

from pylgbst import get_connection_bleak
from pylgbst.hub import MoveHub

log = logging.getLogger(__name__)

# ── Calibration ────────────────────────────────────────────────────────────────
# Vernie robot uses part 2515 (54 mm hard-plastic wheel).
# Measure your actual build and tune these constants.
WHEEL_DIAMETER_CM = 5.4                        # cm
WHEEL_CIRC_CM     = math.pi * WHEEL_DIAMETER_CM  # ≈ 16.96 cm per motor revolution
TRACK_WIDTH_CM    = 12.0                       # center-to-center wheel distance

DRIVE_SPEED = 0.5   # 0.0 – 1.0
TURN_SPEED  = 0.4

# ── Config ─────────────────────────────────────────────────────────────────────
HUB_MAC            = os.getenv("HUB_MAC", "AA:BB:CC:DD:EE:FF")
WATCHDOG_TIMEOUT_S = float(os.getenv("WATCHDOG_TIMEOUT_S", "5"))
MOCK_HUB           = os.getenv("MOCK_HUB", "false").lower() == "true"


# ── Mock hub (for dev without hardware) ────────────────────────────────────────
class MockHub:
    """Drop-in MoveHub replacement that logs instead of moving."""

    class _MockMotor:
        def angled(self, degrees, speed_a, speed_b=None, wait_complete=True):
            log.info(f"[MOCK] motor_AB.angled(degrees={degrees}, speed_a={speed_a}, speed_b={speed_b})")

        def stop(self):
            log.info("[MOCK] motor_AB.stop()")

    def __init__(self):
        self.motor_AB = self._MockMotor()
        log.info("[MOCK] MockHub connected")

    def disconnect(self):
        log.info("[MOCK] MockHub disconnected")

    def switch_off(self):
        log.info("[MOCK] MockHub switch_off")


# ── Connection ─────────────────────────────────────────────────────────────────
def connect(retries: int = 10) -> MoveHub | MockHub:
    if MOCK_HUB:
        return MockHub()

    for attempt in range(retries):
        try:
            log.info(f"BLE connect attempt {attempt + 1}/{retries} → {HUB_MAC}")
            conn = get_connection_bleak(hub_mac=HUB_MAC)
            hub  = MoveHub(conn)
            log.info("Connected to Move Hub ✓")
            return hub
        except Exception as exc:
            wait = min(2.0 * (2 ** attempt), 60.0)
            log.warning(f"Connect failed: {exc}. Retry in {wait:.0f}s")
            time.sleep(wait)

    raise RuntimeError(f"Could not connect to Move Hub at {HUB_MAC} after {retries} attempts")


# ── Primitives ─────────────────────────────────────────────────────────────────
def forward_cm(hub: MoveHub | MockHub, distance_cm: float, speed: float = DRIVE_SPEED) -> None:
    """Drive straight forward for distance_cm centimetres."""
    distance_cm = max(0.0, min(distance_cm, 100.0))  # hard clamp
    degrees = int((distance_cm / WHEEL_CIRC_CM) * 360)
    log.info(f"forward_cm({distance_cm} cm) → {degrees} motor deg @ speed={speed}")
    hub.motor_AB.angled(degrees, speed, speed, wait_complete=True)


def backward_cm(hub: MoveHub | MockHub, distance_cm: float, speed: float = DRIVE_SPEED) -> None:
    """Drive straight backward for distance_cm centimetres."""
    forward_cm(hub, distance_cm, -abs(speed))


def turn_deg(hub: MoveHub | MockHub, angle_deg: float, speed: float = TURN_SPEED) -> None:
    """
    Turn in place by angle_deg degrees.
    Positive → right (clockwise), negative → left (counter-clockwise).

    Uses the wheel arc formula:
        arc_cm    = (|angle| / 360) × π × track_width
        motor_deg = (arc_cm / wheel_circ) × 360
    """
    angle_deg = max(-180.0, min(180.0, angle_deg))  # hard clamp
    arc_cm    = (abs(angle_deg) / 360.0) * math.pi * TRACK_WIDTH_CM
    motor_deg = int((arc_cm / WHEEL_CIRC_CM) * 360)
    log.info(f"turn_deg({angle_deg}°) → {motor_deg} motor deg per side @ speed={speed}")

    if angle_deg >= 0:
        hub.motor_AB.angled(motor_deg,  speed, -speed, wait_complete=True)
    else:
        hub.motor_AB.angled(motor_deg, -speed,  speed, wait_complete=True)


def stop(hub: MoveHub | MockHub) -> None:
    """Immediate motor stop."""
    log.info("stop()")
    hub.motor_AB.stop()


# ── Watchdog ───────────────────────────────────────────────────────────────────
class Watchdog:
    """
    Background thread that stops motors if no heartbeat is received
    within WATCHDOG_TIMEOUT_S seconds.

    Call .pet() from the API on every execute/health request.
    Call .start() once at service startup.
    Call .stop() on shutdown.
    """

    def __init__(self, hub_ref: list):
        # hub_ref is a mutable list so the watchdog always sees the latest hub object
        self._hub_ref  = hub_ref
        self._last_pet = time.monotonic()
        self._running  = False
        self._thread: threading.Thread | None = None

    def pet(self) -> None:
        self._last_pet = time.monotonic()

    def start(self) -> None:
        self._running = True
        self._thread  = threading.Thread(target=self._loop, daemon=True, name="watchdog")
        self._thread.start()
        log.info(f"Watchdog started (timeout={WATCHDOG_TIMEOUT_S}s)")

    def stop(self) -> None:
        self._running = False

    def _loop(self) -> None:
        while self._running:
            time.sleep(0.5)
            age = time.monotonic() - self._last_pet
            if age > WATCHDOG_TIMEOUT_S:
                hub = self._hub_ref[0]
                if hub is not None:
                    log.warning(f"Watchdog triggered (last pet {age:.1f}s ago) — stopping motors")
                    try:
                        hub.motor_AB.stop()
                    except Exception as exc:
                        log.error(f"Watchdog stop failed: {exc}")
                self._last_pet = time.monotonic()  # reset to avoid spam
