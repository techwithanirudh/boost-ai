# Boost Robot — Master Plan

---

## Part 0 — Robot Build Decision

### Requirements
- Moves fast (wheels or treads)
- Rotating head / camera pan (medium motor)
- Pick up or hold objects (forklift-style) — nice to have
- Pi 3 + SSD + Pi Camera 3 must mount cleanly

### Motor budget (31313 set)
```
2× Large Motor  → drive
1× Medium Motor → head pan OR gripper (pick one)
```
All 3 features simultaneously requires buying 1 extra Medium Motor (~£15).

### Shortlist

| Robot | Drive | Head pan | Grip/lift | Pi mount | Speed | Notes |
|---|---|---|---|---|---|---|
| **TRACK3R** | tank treads ✅ | add medium ✅ | ❌ | ✅ flat deck | good | best all-rounder for AI nav |
| **GRIPP3R** | wheels ✅ | ❌ | claw ✅ | ⚠️ ok | good | only one with real grabber |
| **EV3MEG** | wheels (droid) | unclear ⚠️ | ❌ | ❌ tiny | fast? | "Creatures & Droids" line follower — arms likely decorative, not functional; Pi won't fit cleanly |
| **BOBB3E** | wheels ✅ | ❌ | fork lift ✅ | ⚠️ ok | ok | scoops/lifts, not precise grab |

### EV3MEG — verdict
Officially categorised as "Creatures & Droids / Line Follower". Same family as the R2D2-style EV3D4 and Wall-E KRAZ3. Compact droid body — arms are decorative, color sensor points down for line tracking. **Not suitable**: no room for Pi + SSD, no gripper, arms don't manipulate objects.

### Recommendation: TRACK3R ✅

- Tank treads, spins in place — ideal for AI scan behaviour
- Flat top deck — Pi 3 + SSD mount cleanly with Technic beams
- Medium motor on a front arm = camera pan L/R
- Low centre of gravity, stable

GRIPP3R ruled out: EV3 brick is the body, no flat deck, Pi + SSD hang off the back awkwardly, top-heavy if stacked above.

### Port layout

```
Port A  Medium Motor  camera pan (L/R)
Port B  Large Motor   left tread
Port C  Large Motor   right tread
Port 4  Infrared      proximity
```

### Pi mounting

```
[Pi Camera on medium motor arm] ← rotates L/R
[Pi 3 + SSD flat on Technic beam deck]
[EV3 brick in chassis]
[tank treads]
```

USB-A cable: Pi → EV3 for power + USB networking (192.168.2.1 fixed IP).

---

## Part 1 — Hardware: EV3 Migration (ev3-dc)

### 1.1 Decision

Switch from LEGO Boost (`pylgbst` + BLE) to **LEGO Mindstorms EV3** using
**[ev3-dc](https://pypi.org/project/ev3-dc/)** (`ev3_dc`).

| | LEGO Boost (old) | LEGO EV3 (new) |
|---|---|---|
| Library | `pylgbst` + `bleak` | `ev3-dc` |
| Protocol | BLE (Bluetooth Low Energy) | Bluetooth Classic serial / USB |
| Firmware | Proprietary LEGO Boost | Stock EV3 firmware (no flash needed) |
| Where server runs | Pi | Pi (unchanged) |
| Connection | BLE auto-discovery | Bluetooth serial (paired MAC) |
| Motor API | `hub.motor_AB.angled(deg, spd_L, spd_R)` | `vehicle.drive_straight(m)` / `drive_turn(deg, radius)` |
| Sensor API | `VisionSensor.COLOR_DISTANCE_FLOAT` | `Ultrasonic().distance_cm` |

### 1.2 Why ev3-dc

- Server stays entirely on Pi — no SD card flash, no ev3dev, no code on the brick.
- Stock EV3 firmware accepts LEGO Direct Commands natively over Bluetooth serial.
- `TwoWheelVehicle` provides a high-level drive API with built-in position/heading tracking.
- Supports `BLUETOOTH`, `USB`, and `WIFI` transports; swap with one constant.

### 1.3 Bluetooth Pairing Setup (Pi → EV3, one-time)

```bash
# On Pi
bluetoothctl
  power on
  agent on
  scan on
  # note EV3 MAC (format 00:16:53:XX:XX:XX)
  pair 00:16:53:XX:XX:XX
  trust 00:16:53:XX:XX:XX
  quit

# Bind serial port (add to /etc/rc.local or systemd unit)
sudo rfcomm bind /dev/rfcomm0 00:16:53:XX:XX:XX
```

Set `HUB_MAC=00:16:53:XX:XX:XX` in the root `.env`.

### 1.4 ev3-dc Key API

```python
import ev3_dc as ev3

# Connection (blocking, ~2s)
vehicle = ev3.TwoWheelVehicle(
    radius_wheel=0.028,   # metres — EV3 large wheel rubber tyre (56mm Ø / 2)
    tread=0.117,          # metres — track width centre-to-centre (measure your build)
    protocol=ev3.BLUETOOTH,
    host="00:16:53:XX:XX:XX",
    speed=30,             # default % (0-100)
    ramp_up=500,          # ms acceleration ramp
    ramp_down=500,        # ms deceleration ramp
)

# Move forward N cm
vehicle.drive_straight(0.20)   # 20 cm in metres
vehicle.stop()

# Move backward N cm
vehicle.drive_straight(-0.20)
vehicle.stop()

# Turn in place N degrees (positive = left, negative = right)
vehicle.drive_turn(90, 0.0)   # radius=0 → spin in place
vehicle.stop()

# Emergency stop / halt
vehicle.stop()

# Distance sensor (port 1)
us = ev3.Ultrasonic(port=ev3.PORT_1, ev3_obj=vehicle)
cm = us.distance_cm   # float

# State / battery
battery_pct = vehicle.battery  # 0-100 approx
```

### 1.5 Calibration Constants (measure your build)

| Constant | Value | How to measure |
|---|---|---|
| `radius_wheel` | `0.028` m | EV3 large tyre Ø = 56.5 mm → r = 0.0283 m |
| `tread` | measured | Distance between left and right wheel contact points (centre to centre) |
| Speed default | `30` % | Tune for surface; higher on smooth floor |
| `ramp_up/down` | `500` ms | Reduce for snappier moves, increase for smoother |

### 1.6 Call mapping (old → new)

| Old (`service.py`) | New (`service.py`) |
|---|---|
| `get_connection_bleak(hub_mac=...)` | `ev3.TwoWheelVehicle(radius_wheel, tread, protocol=ev3.BLUETOOTH, host=mac)` |
| `hub.motor_AB.angled(deg, spd, spd, wait_complete=True)` forward | `vehicle.drive_straight(dist_m); vehicle.stop()` |
| `hub.motor_AB.angled(deg, -spd, -spd, wait_complete=True)` backward | `vehicle.drive_straight(-dist_m); vehicle.stop()` |
| `hub.motor_AB.angled(motor_deg, dir*spd, -dir*spd, wait_complete=True)` turn | `vehicle.drive_turn(deg_signed, 0.0); vehicle.stop()` |
| `hub.motor_AB.stop()` | `vehicle.stop()` |
| `sensor.subscribe(cb, mode=VisionSensor.COLOR_DISTANCE_FLOAT)` | `ev3.Ultrasonic(port=ev3.PORT_1, ev3_obj=vehicle)` |
| `_patch_hub_send` timeout hack | Not needed — ev3-dc uses blocking serial with built-in timeout |
| `_clear_sync_state` retry hack | Not needed |
| `self._motor_deg_per_cm` manual calc | Not needed — `TwoWheelVehicle` handles internally |

### 1.7 Files to change

| File | Change |
|---|---|
| `apps/hub/pyproject.toml` | Remove `pylgbst`, `bleak`; add `ev3-dc` |
| `apps/hub/hub/service.py` | Full rewrite — replace `HubService` internals |
| `apps/hub/hub/safety.py` | Watchdog stays unchanged |
| `apps/hub/hub/models.py` | Unchanged (`ExecuteMotionCommand`) |
| `apps/hub/main.py` | Unchanged (FastAPI routes stay identical) |
| `apps/hub/scripts/patch_pylgbst.py` | Delete — no longer needed |
| `apps/hub/requirements.txt` | Regenerate after poetry update |
| Root `.env` | Rename `HUB_MAC` → `HUB_MAC` (or keep `HUB_MAC`) |

### 1.8 New `service.py` skeleton

```python
import ev3_dc as ev3
from .models import ExecuteMotionCommand
from .safety import Watchdog

_WHEEL_RADIUS_M = 0.028
_TREAD_M = 0.117        # TODO: measure your build

class HubService:
    def __init__(self):
        self.connected = False
        self._vehicle: ev3.TwoWheelVehicle | None = None
        self._us: ev3.Ultrasonic | None = None
        self._mac = os.getenv("HUB_MAC") or os.getenv("HUB_MAC")
        self.watchdog = Watchdog(timeout_s=5.0)
        self._execute_lock = threading.Lock()

    def connect(self):
        while not self._stop:
            try:
                v = ev3.TwoWheelVehicle(
                    _WHEEL_RADIUS_M, _TREAD_M,
                    protocol=ev3.BLUETOOTH, host=self._mac,
                    speed=30, ramp_up=500, ramp_down=500,
                )
                self._us = ev3.Ultrasonic(port=ev3.PORT_1, ev3_obj=v)
                self._vehicle = v
                self.connected = True
                return
            except Exception as e:
                logger.error("EV3 connect failed: %s — retry in 5s", e)
                time.sleep(5)

    def execute(self, payload: ExecuteMotionCommand) -> dict:
        if not self.connected or self._vehicle is None:
            return self._err("ev3_not_connected")
        with self._execute_lock:
            return self._execute_inner(payload)

    def _execute_inner(self, payload: ExecuteMotionCommand) -> dict:
        v = self._vehicle
        a = payload.action
        speed_pct = int(round(payload.speed * 100))  # 0-1 → 0-100

        try:
            if a == "stop":
                v.stop()
            elif a == "forward_cm":
                dist_m = max(0.05, min(10.0, payload.value)) / 100.0
                v.drive_straight(dist_m)
                v.stop()
            elif a == "backward_cm":
                dist_m = max(0.05, min(10.0, payload.value)) / 100.0
                v.drive_straight(-dist_m)
                v.stop()
            elif a == "turn_deg":
                deg = max(-180.0, min(180.0, payload.value))
                v.drive_turn(-deg, 0.0)   # ev3-dc: + = left, robot: + = right → invert
                v.stop()
            else:
                return self._err(f"unknown_action: {a}")
        except Exception as e:
            logger.error("EV3 command failed: %s", e)
            return self._err(str(e))

        self.watchdog.pet()
        return self._ok(a, payload)

    def state(self) -> dict:
        distance = None
        battery = None
        if self._vehicle:
            try:
                battery = self._vehicle.battery
            except Exception:
                pass
        if self._us:
            try:
                distance = self._us.distance_cm
            except Exception:
                pass
        return {"connected": self.connected, "distance": distance, "battery": battery}
```

### 1.9 Sign convention note

ev3-dc `drive_turn(angle, radius)`:
- Positive angle → left turn
- Our robot convention: positive degrees → clockwise (right)
- Fix: negate the angle in the `turn_deg` branch (`-deg`)

### 1.10 Dependencies

```toml
# pyproject.toml
ev3-dc = "^0.9"    # replaces pylgbst + bleak
```

No `bleak`, no `asyncio` Bluetooth loops — ev3-dc uses synchronous `bluetooth` / `pyserial` under the hood for classic BT serial.

---

## Part 2 — Server: AI SDK Streaming (implemented)

Current state: **complete**. Architecture uses:
- `POST /v1/chat` → `streamText` + `createUIMessageStreamResponse` + Redis resumable streams
- `GET /v1/chat/:id/stream` → resume interrupted stream (204 if none)
- `GET /v1/chat/:id` → read chat (returns messages + title)
- `GET /v1/chat` → list all chats
- `prepareStep` → injects fresh camera frame as `image` part before each AI step
- `sanitizeToolImageMessages` → extracts snapshot data URLs from tool results, re-injects as user image parts
- Error handling, structured logging (`pino`), Redis resumable stream context

### Remaining server work
- [ ] Restore modular prompt structure (`src/lib/prompts/robot/`) from origin/main
- [ ] Update `system.ts` to compose from modular prompts
- [ ] Validate `toModelOutput` tool approach vs current `sanitizeToolImageMessages` workaround (GitHub issue #8209 confirms manual sanitize IS the correct approach for now)

---

## Part 3 — Web: UI Cleanup (partially implemented)

### Implemented
- `task` search param (renamed from `message`)
- `toolCallCount` removed
- Header title → home link (no back button)
- Session layout centred (`max-w-5xl`)
- Camera feed → React Query HEAD poll + timestamp cache-busting
- `sessions.tsx` → relative time, status badges
- Backend cleanup: try/catch, structured logging, `onError` fix

### Remaining web work
- [ ] Re-add shadcn components (`bunx shadcn@latest add ...`)
- [ ] Status panel full height
- [ ] TanStack Query usage audit vs better-t-stack patterns
- [ ] Remove remaining `useEffect` where replaceable with React Query

---

## Part 4 — TanStack Query Patterns (from better-t-stack)

better-t-stack reference at `/tmp/my-better-t-app` uses:
- `queryClient.invalidateQueries` after mutations (not manual state updates)
- `useQuery` with `staleTime: 1000 * 60 * 5` for stable data
- `useMutation` wrapping POST calls
- No `useEffect` for data fetching — all replaced by `useQuery`/`useMutation`

Current violations in our web app:
- `status-panel.tsx`: `useQuery` for hub state — check `refetchInterval` and `staleTime` config
- Any remaining `useEffect` + `fetch` patterns should become `useQuery`

---

## Part 5 — Camera / Snapshot (implemented)

- iPhone Larix → RTMP → MediaMTX → ffmpeg writes `/tmp/boost-snapshot.jpg` every 2s
- `GET /v1/snapshot` → reads file, returns `image/jpeg`
- `CameraFeed` polls via HEAD every 2s using `useQuery`, cache-busts `src` with timestamp

---

## Part 6 — Open Issues / Backlog

| Priority | Issue | Notes |
|---|---|---|
| P0 | ~~EV3 hub rewrite~~ | ✅ Done — ev3-dc, R3PTAR port layout |
| P0 | Calibrate `_DRIVE_DEG_PER_CM` | Run `forward(10)`, measure actual travel, adjust constant |
| P0 | Calibrate `_STEER_DEG_PER_HEADING_DEG` | Run `turn(90)`, measure actual heading change, adjust |
| P0 | Pair EV3 via `bluetoothctl` on Pi | One-time setup, set `HUB_MAC` in `.env` |
| P1 | Restore robot prompts | Copy from `origin/main` `src/lib/prompts/robot/` |
| P1 | shadcn reinstall | `bunx shadcn@latest add button card ...` |
| P2 | Status panel full height | CSS tweak |
| P2 | TanStack Query audit | Remove stale `useEffect` patterns |
| P3 | `toModelOutput` evaluation | Track AI SDK issue #8209 — current workaround is correct |
| P3 | Pybricks evaluation | Alternative EV3 firmware with cleaner Python API if ev3-dc has issues |
