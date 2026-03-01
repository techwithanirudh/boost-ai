# Boost

Autonomous LEGO Boost robot controlled by a multimodal AI agent running on a Raspberry Pi.

```
iPhone (Larix RTMP) → MediaMTX → Server (AI loop) → Hub (FastAPI + BLE) → LEGO Boost Move Hub
```

The AI receives the live camera frame and a goal (e.g. *"go to the kitchen"*). It calls motion tools — `forward_cm`, `backward_cm`, `turn_deg`, `stop` — in a loop until it calls `complete`. Every session's messages are persisted in Postgres so the agent retains full context across follow-up runs.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TanStack Router + Tailwind + shadcn/ui |
| Server | Hono + Bun + AI SDK v6 (Gemini 2.5 Flash) |
| Hub | FastAPI + pylgbst (BLE) |
| Database | Neon Postgres + Drizzle ORM |
| Camera | iPhone Larix → RTMP → MediaMTX |
| Monorepo | Turborepo + Bun workspaces |

---

## Hardware

- Raspberry Pi 3B+ or newer
- LEGO Boost Move Hub
- iPhone with [Larix Broadcaster](https://softvelum.com/larix/) or any RTMP source

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
| `OPENAI_API_KEY` | Gemini API key — [aistudio.google.com](https://aistudio.google.com) |
| `HUB_MAC` | BLE MAC of your LEGO hub (leave empty for auto-discover) |
| `VITE_API_URL` | Server URL reachable from your browser (e.g. `http://192.168.0.123:3000`) |
| `VITE_MEDIAMTX_URL` | MediaMTX WebRTC URL reachable from your browser (e.g. `http://192.168.0.123:8889`) |
| `CORS_ORIGIN` | Browser origin (e.g. `http://192.168.0.123:3001`) |

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
- Starts MediaMTX, hub, server, and web UI in parallel
- Prefixes each service's logs with a colour label
- Shuts everything down cleanly on Ctrl+C

Services and ports:

| Service | Port | What it does |
|---|---|---|
| MediaMTX | `:1935` (RTMP), `:8889` (WebRTC) | Ingests camera stream, spawns ffmpeg for AI snapshots |
| Hub | `:8000` | FastAPI — BLE bridge to LEGO hub |
| Server | `:3000` | Hono — AI orchestrator + sessions API |
| Web | `:3001` | React operator UI |

---

## Camera setup (Larix)

In **Larix Broadcaster** on your iPhone:

- **Connection URL**: `rtmp://<pi-ip>:1935/live/stream`
- Get your Pi Wi-Fi IP: `ip addr show wlan0`

Once Larix connects, MediaMTX automatically spawns ffmpeg which writes `/tmp/snapshot.jpg` every 2 s for the AI. The live WebRTC feed is embedded directly in the web UI.

> Start streaming before sending a session goal — the AI needs the snapshot file to exist.

---

## API

```
POST /v1/sessions           { goal, id? }   Start or continue a session
GET  /v1/sessions/:id                       Poll status
POST /v1/sessions/:id/stop                  Emergency stop
POST /v1/execute            { goal }        Stateless one-shot run
GET  /v1/health                             Server + hub status
```

---

## Project structure

```
boost/
├── apps/
│   ├── server/src/
│   │   ├── lib/
│   │   │   ├── hub/         HubClient (ky HTTP) + requireHub guard
│   │   │   ├── prompts/     Modular system prompt
│   │   │   └── tools/       forward · backward · turn · stop · complete
│   │   ├── routes/          health · sessions · execute
│   │   └── services/        orchestrator · frame (snapshot reader)
│   ├── hub/                 FastAPI BLE control plane (pylgbst)
│   └── web/                 React operator UI
├── packages/
│   ├── db/                  Drizzle schema + session queries
│   ├── env/                 Typed env (@t3-oss/env-core)
│   ├── validators/          Shared Zod schemas
│   └── config/              Shared runtime config
├── mediamtx.yml             MediaMTX config
├── mediamtx                 Binary (git-ignored — downloaded by start.sh)
└── start.sh                 Start everything
```

---

## BLE notes

This project uses **pylgbst from GitHub** (not PyPI) plus two patches to the virtualenv for bleak 2.x compatibility:

| Patch | Reason |
|---|---|
| `set_notify_handler` — extract `.handle` from `BleakGATTCharacteristic` | bleak 2.x changed callback signature |
| uvicorn `--loop asyncio` | prevents uvloop from interfering with BlueZ D-Bus |

**After reinstalling the hub virtualenv** (`poetry install`), re-apply patches:

```bash
cd apps/hub && poetry run python scripts/patch_bleak.py
```

Press the **green button** on the hub when the hub service starts — it needs to be in pairing/advertising mode for BLE discovery.
