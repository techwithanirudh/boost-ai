# boost-ai

AI has a body. Gemini sees through a camera mounted on a LEGO BOOST robot, narrates what it sees, and steers the motors via tool calls.

```
[Camera]  →  [agent]  ←→  Gemini Live API
                │ HTTP
                ▼
         [pyhub-service]
                │ BLE
                ▼
        LEGO BOOST Move Hub
```

## Repo layout

```
boost/
  services/
    agent/          # Gemini Live agent — vision + tool dispatch  ✅ done
    pyhub/          # FastAPI + pylgbst — BLE motor control       ✅ done
  docs/
    runbook.md
    calibration.md
```

---

## pyhub

FastAPI service that exposes the LEGO BOOST Move Hub over HTTP. The agent calls it to move the robot.

### Setup

```bash
cd services/pyhub

# 1. Install system Bluetooth stack (first time only)
sudo apt-get install -y bluetooth bluez
sudo systemctl enable --now bluetooth
sudo usermod -aG bluetooth $USER   # re-login after

# 2. Find hub MAC
python scan_hub.py                 # press green button on hub first

# 3. Create .env
cp .env.example .env
# Edit HUB_MAC to the address found above

# 4. Create venv + install
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 5. Verify connection
.venv/bin/python test_connect.py   # robot should nudge forward
```

### Run

```bash
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

### Environment variables

| Variable             | Default           | Description                          |
|----------------------|-------------------|--------------------------------------|
| `HUB_MAC`            | `AA:BB:CC:DD:EE:FF` | LEGO Move Hub Bluetooth MAC        |
| `MOCK_HUB`           | `false`           | `true` = log-only, no BLE needed     |
| `WATCHDOG_TIMEOUT_S` | `5`               | Auto-stop motors after N seconds idle|
| `PORT`               | `8000`            | uvicorn port                         |

### API

| Method | Path        | Description                  |
|--------|-------------|------------------------------|
| POST   | `/execute`  | Run a motion primitive       |
| POST   | `/stop`     | Emergency stop               |
| GET    | `/health`   | Liveness + BLE status        |
| GET    | `/telemetry`| Battery voltage              |

**POST /execute**
```json
{
  "command_id": "abc123",
  "primitive": "forward_cm",
  "args": { "distance_cm": 20, "speed": 0.5 }
}
```

Primitives: `forward_cm`, `backward_cm`, `turn_deg`, `stop`

**GET /health**
```json
{ "ok": true, "ble_connected": true, "mock": false }
```

### Motion calibration

Edit `hub.py` constants to match your build:

```python
WHEEL_DIAMETER_CM = 5.4    # Vernie wheel (part 2515, 54 mm)
TRACK_WIDTH_CM    = 12.0   # wheel center-to-center
```

See [`docs/calibration.md`](docs/calibration.md) for procedure.

### RPi BLE troubleshooting

| Problem | Fix |
|---------|-----|
| `hci0` not found | `sudo hciconfig hci0 reset` |
| Permission denied | `sudo usermod -aG bluetooth $USER` + re-login |
| Hub not found after reconnect | Wait 5 s (hub LED clears); press button to re-advertise |
| BT + Wi-Fi interference (RPi 3) | Disable Wi-Fi or use USB BT 5.0 dongle |

---

## agent

Raw `google-genai` loop: captures camera frames at 1 fps, streams them to Gemini Live (text mode + vision), and dispatches tool calls to pyhub over HTTP.

### Setup

```bash
cd services/agent

python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

cp .env.example .env
# Set GOOGLE_API_KEY and optionally CAMERA_RTSP
```

### Run

Start pyhub first, then:

```bash
.venv/bin/python agent.py
```

### Environment variables

| Variable       | Default                  | Description                              |
|----------------|--------------------------|------------------------------------------|
| `GOOGLE_API_KEY` | —                      | Gemini API key (required)                |
| `PYHUB_URL`    | `http://localhost:8000`  | pyhub service base URL                   |
| `CAMERA_RTSP`  | *(unset)*                | RTSP stream URL; unset = local cam (0)   |

### Tools exposed to Gemini

| Tool          | Description                              |
|---------------|------------------------------------------|
| `forward_cm`  | Drive forward N cm (max 30)             |
| `backward_cm` | Drive backward N cm (max 30)            |
| `turn_deg`    | Turn in place ±90°                       |
| `stop`        | Emergency stop                           |
