# Boost

Autonomous LEGO Boost robot controlled by a multimodal AI agent running on a Raspberry Pi.

```
iPhone (Larix RTMP) → MediaMTX → /tmp/snapshot.jpg → Server (AI loop) → Hub (FastAPI + BLE) → LEGO Boost Move Hub
```

The AI receives a live camera snapshot and a goal (e.g. *"go to the kitchen"*). It calls motion tools — `forward`, `backward`, `turn`, `stop` — in a loop until it calls `complete`. Every session's messages are persisted in Postgres so the agent retains full context across follow-up runs.

---

## Hardware

| Component | Recommendation |
|---|---|
| Raspberry Pi | **Pi 5 8 GB** (recommended) — handles BLE, ffmpeg, and the server comfortably. Pi 4 works. Pi 3 is too slow. |
| LEGO set | LEGO Boost (17101) — includes the Move Hub |
| Camera | iPhone with [Larix Broadcaster](https://softvelum.com/larix/) or any RTMP source |

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TanStack Router + Tailwind + shadcn/ui |
| Server | Hono + Bun + AI SDK v6 (GPT-4o / Gemini) |
| Hub | FastAPI + pylgbst (BLE) |
| Database | Neon Postgres + Drizzle ORM |
| Camera | iPhone Larix → RTMP → MediaMTX → `/tmp/snapshot.jpg` |
| Monorepo | Turborepo + Bun workspaces |

---

## First-time setup

### 1. Install system dependencies

```bash
sudo apt install ffmpeg bluetooth bluez
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
| `OPENAI_API_KEY` | AI API key |
| `HUB_MAC` | BLE MAC of your LEGO hub (leave empty for auto-discover) |
| `VITE_API_URL` | Server URL reachable from your browser (e.g. `http://192.168.0.123:3000`) |
| `CORS_ORIGIN` | Browser origin (e.g. `http://192.168.0.123:3001`) |
| `HF_API_TOKEN` | HuggingFace token for depth estimation (optional) |

### 5. Push database schema

```bash
bun run db:push
```

---

## Running

```bash
./start.sh
```

That's it. The script:
- Downloads the MediaMTX binary automatically if missing
- Resets BLE state for the hub MAC before connecting
- Starts MediaMTX, hub, server, and web UI in parallel
- Prefixes each service's logs with a colour label
- Shuts everything down cleanly on Ctrl+C

Services and ports:

| Service | Port | What it does |
|---|---|---|
| MediaMTX | `:1935` (RTMP), `:8554` (RTSP) | Ingests iPhone camera stream, writes snapshot to `/tmp/snapshot.jpg` |
| Hub | `:8000` | FastAPI — BLE bridge to LEGO hub |
| Server | `:3000` | Hono — AI orchestrator + sessions API |
| Web | `:3001` | React operator UI |

---

## Camera setup (Larix)

In **Larix Broadcaster** on your iPhone:

- **Connection URL**: `rtmp://<pi-ip>:1935/live/stream`
- Get your Pi Wi-Fi IP: `ip addr show wlan0`

MediaMTX runs an ffmpeg process that writes `/tmp/snapshot.jpg` at 1 fps. The server reads that file each AI step (no per-step ffmpeg overhead). The web UI polls `/v1/snapshot` every 2 s to display it.

> Start streaming before sending a session goal — the AI needs a snapshot to exist.

### Hotspot setup (recommended)

1. Turn on iPhone Personal Hotspot.
2. Connect the Pi and your browser device to the same hotspot.
3. Get the Pi's hotspot IP: `ip addr show wlan0` → copy the `inet` address.
4. Set Larix URL to `rtmp://<pi-ip>:1935/live/stream`.
5. In `.env` set `VITE_API_URL=http://<pi-ip>:3000` and `CORS_ORIGIN=http://<pi-ip>:3001`.
6. Restart `./start.sh`.

---

## API

```
POST /v1/sessions           { goal, id? }   Start or continue a session
GET  /v1/sessions/:id                       Poll status
POST /v1/sessions/:id/stop                  Emergency stop
POST /v1/execute            { goal }        Stateless one-shot run
GET  /v1/health                             Server + hub status
GET  /v1/snapshot                           Latest camera JPEG
```

---

## Project structure

```
boost/
├── apps/
│   ├── server/src/
│   │   ├── lib/
│   │   │   ├── hub/         HubClient (ky HTTP) + requireHub guard
│   │   │   ├── prompts/     Modular system prompt (core · tools · reasoning · examples)
│   │   │   └── tools/       forward · backward · turn · stop · complete
│   │   ├── routes/          health · sessions · execute · snapshot
│   │   └── services/        orchestrator · frame · depth
│   ├── hub/                 FastAPI BLE control plane (pylgbst)
│   └── web/                 React operator UI
├── packages/
│   ├── db/                  Drizzle schema + session queries
│   ├── env/                 Typed env (@t3-oss/env-core)
│   ├── validators/          Shared Zod schemas
│   └── config/              Shared runtime config
├── mediamtx.yml             MediaMTX config
├── bin/mediamtx             Binary (git-ignored — downloaded by start.sh)
└── start.sh                 Start everything
```

---

## BLE notes

This project uses **pylgbst from GitHub** (not PyPI) for bleak 2.x compatibility.

Press the **green button** on the hub when the hub service starts — it needs to be in pairing/advertising mode for BLE discovery.

`start.sh` automatically resets the BLE state for your `HUB_MAC` before starting the hub, which prevents stale connection issues across restarts.
