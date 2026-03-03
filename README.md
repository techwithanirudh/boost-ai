# Boost

Autonomous LEGO Mindstorms EV3 robot controlled by a multimodal AI agent running on a Raspberry Pi.

```
iPhone (Larix RTMP) → MediaMTX → /tmp/snapshot.jpg → Server (AI loop) → Hub (FastAPI + ev3-dc) → EV3 brick
```

The AI receives a live camera snapshot and a goal (e.g. *"go to the kitchen"*). It calls motion tools — `forward`, `backward`, `turn`, `stop` — in a loop until it calls `complete`. Every session's messages are persisted in Postgres so the agent retains full context across follow-up runs.

---

## Hardware

| Component | Details |
|---|---|
| Raspberry Pi | **Pi 5** (recommended) or Pi 4 — handles Bluetooth, ffmpeg, and the server. |
| LEGO set | LEGO Mindstorms EV3 (31313) — any model with 2× Large Motor + 1× Medium Motor |
| Camera | iPhone with [Larix Broadcaster](https://softvelum.com/larix/) or any RTMP source |

Recommended robot build: **TRACK3R** — tank treads, flat deck for Pi mounting, medium motor for camera pan.

Port layout (R3PTAR / default):

| Port | Motor / Sensor |
|---|---|
| A | Medium Motor (steer / head) |
| B | Large Motor (drive) |
| D | Large Motor (strike arm) |
| 4 | Infrared sensor (optional) |

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TanStack Router + Tailwind + shadcn/ui |
| Server | Hono + Bun + AI SDK v6 (GPT-4o) |
| Hub | FastAPI + ev3-dc (Bluetooth Classic serial) |
| Database | Neon Postgres + Drizzle ORM |
| Camera | iPhone Larix → RTMP → MediaMTX → `/tmp/snapshot.jpg` |
| Monorepo | Turborepo + Bun workspaces |

---

## First-time setup

### 1. Install system dependencies

```bash
sudo apt install ffmpeg bluetooth bluez python3-dev
bluetoothctl power on
```

### 2. Install Bun and Poetry

```bash
curl -fsSL https://bun.sh/install | bash
curl -sSL https://install.python-poetry.org | python3 -
```

### 3. Clone and install

```bash
git clone <repo-url> boost && cd boost
bun install
cd apps/hub && poetry install && cd ../..
```

### 4. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon/Postgres connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `EV3_MAC` | Bluetooth MAC of your EV3 brick (format `00:16:53:XX:XX:XX`) |
| `VITE_API_URL` | Server URL reachable from your browser (e.g. `http://192.168.0.123:3000`) |
| `CORS_ORIGIN` | Browser origin (e.g. `http://192.168.0.123:3001`) |
| `HF_API_TOKEN` | HuggingFace token for depth estimation (optional) |
| `REDIS_URL` | Redis URL for resumable streams (optional) |

Find your EV3 MAC:

```bash
bluetoothctl devices
# looks like: 00:16:53:XX:XX:XX
```

### 5. Pair the EV3 (one-time)

The EV3 uses Bluetooth Classic with PIN `1234`. You need to pair once — keys are then stored permanently.

**On the EV3 brick:** Settings → Wireless and Networks → Bluetooth → turn Bluetooth **ON**, leave this screen open.

**On the Pi:**

```bash
bluetoothctl
agent on
default-agent
scan on
# wait for your EV3 to appear (e.g. ANIRUDHS_EV3)
pair 00:16:53:XX:XX:XX
# enter PIN: 1234
trust 00:16:53:XX:XX:XX
quit
```

Verify it saved:

```bash
sudo ls /var/lib/bluetooth/<adapter-mac>/00:16:53:XX:XX:XX/
# should show: attributes  info
```

### 6. Push database schema

```bash
bun run db:push
```

---

## Running

```bash
./start.sh
```

The script checks for dependencies, downloads the MediaMTX binary if missing, then starts all services via `bun run dev`.

Services and ports:

| Service | Port | What it does |
|---|---|---|
| MediaMTX | `:1935` (RTMP), `:8554` (RTSP) | Ingests iPhone camera stream, writes snapshot to `/tmp/snapshot.jpg` |
| Hub | `:8000` | FastAPI — Bluetooth bridge to EV3 |
| Server | `:3000` | Hono — AI orchestrator + chat API |
| Web | `:3001` | React operator UI |

---

## Camera setup (Larix)

In **Larix Broadcaster** on your iPhone:

- **Connection URL**: `rtmp://<pi-ip>:1935/live/stream`
- **Zoom**: set to **0.5x** (ultra-wide) for the widest field of view
- Get your Pi Wi-Fi IP: `ip addr show wlan0`

MediaMTX runs an ffmpeg process that writes `/tmp/snapshot.jpg` at 1 fps. The server reads that file each AI step. The web UI polls `/v1/snapshot` every 2 s to display it.

> Start streaming before sending a session goal — the AI needs a snapshot to exist.

### Hotspot setup (recommended)

1. Turn on iPhone Personal Hotspot.
2. Connect the Pi and your browser device to the same hotspot.
3. Get the Pi's hotspot IP: `ip addr show wlan0` → copy the `inet` address.
4. Set Larix URL to `rtmp://<pi-ip>:1935/live/stream`.
5. In `.env` set `VITE_API_URL=http://<pi-ip>:3000` and `CORS_ORIGIN=http://<pi-ip>:3001`.
6. Restart `./start.sh`.

---

## Project structure

```
boost/
├── apps/
│   ├── server/src/
│   │   ├── lib/
│   │   │   ├── hub/         HubClient (HTTP) + motion helpers
│   │   │   ├── prompts/     Modular system prompt (core · tools · reasoning · examples)
│   │   │   └── tools/       forward · backward · turn · stop · complete
│   │   ├── routes/          health · chat · snapshot
│   │   └── services/        orchestrator · frame · depth
│   ├── hub/                 FastAPI + ev3-dc Bluetooth control plane
│   └── web/                 React operator UI
├── packages/
│   ├── db/                  Drizzle schema + chat queries
│   ├── env/                 Typed env (@t3-oss/env-core)
│   └── config/              Shared runtime config
├── mediamtx.yml             MediaMTX config
├── bin/mediamtx             Binary (git-ignored — downloaded by start.sh)
└── start.sh                 Start everything
```

---

## EV3 notes

- **Protocol**: Bluetooth Classic serial (RFCOMM channel 1) — no BLE, no ev3dev, no code on the brick. Stock firmware only.
- **Library**: [ev3-dc](https://pypi.org/project/ev3-dc/) sends LEGO Direct Commands from the Pi over a raw Bluetooth socket.
- **Reconnection**: the hub service retries the EV3 connection every 5 s automatically. If the brick goes to sleep or disconnects, it reconnects on the next attempt.
- **Calibration**: `_DRIVE_DEG_PER_CM` and `_STEER_DEG_PER_HEADING_DEG` in `apps/hub/hub/service.py` need to be tuned for your specific robot build and surface.
