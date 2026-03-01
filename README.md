# Boost

Autonomous LEGO Boost robot controlled by a multimodal AI agent running on a Raspberry Pi 5.

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
| Hub | FastAPI + pylgbst 1.3.0 (BLE) |
| Database | Neon Postgres + Drizzle ORM |
| Camera | iPhone Larix → RTMP → MediaMTX |
| Monorepo | Turborepo + Bun workspaces |

---

## Hardware

- Raspberry Pi 5 (Pi 3/4 work too — tested on Pi 3)
- LEGO Boost Move Hub (`00:16:53:AD:38:83` or auto-discover by name `Move Hub`)
- iPhone with [Larix Broadcaster](https://softvelum.com/larix/) or any RTMP source

---

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.3
- [Poetry](https://python-poetry.org) ≥ 2.0 — `curl -sSL https://install.python-poetry.org | python3 -`
- Neon (or any Postgres) database
- Google Gemini API key — [aistudio.google.com](https://aistudio.google.com)
- Bluetooth enabled on the Pi (`bluetoothctl power on`)
- `ffmpeg` — `sudo apt install ffmpeg` (used by MediaMTX to capture JPEG snapshots)

---

## Setup

### 1. Install dependencies

```bash
bun install
cd apps/hub && poetry install && cd ../..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — the required fields are:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon/Postgres connection string |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key |
| `HUB_MAC` | BLE MAC of the LEGO hub (`00:16:53:AD:38:83`) |
| `MEDIAMTX_STREAM_PATH` | Stream path matching your Larix config (`live/stream`) |

### 3. Push database schema

```bash
bun run db:push
```

### 4. Download MediaMTX

```bash
# ARM64 (Pi 4/5)
wget -q https://github.com/bluenviron/mediamtx/releases/download/v1.16.2/mediamtx_v1.16.2_linux_arm64.tar.gz \
  -O mediamtx.tar.gz && tar xzf mediamtx.tar.gz mediamtx && rm mediamtx.tar.gz
```

---

## Running (development)

Services must start in this order:

### Terminal 1 — MediaMTX (camera ingest)

```bash
./mediamtx mediamtx.yml
```

Listens on:
- RTMP ingest: `:1935`
- JPEG snapshot API: `:8888`

### Terminal 2 — Hub (BLE control plane)

```bash
cd apps/hub && poetry run poe dev
```

Uvicorn starts immediately on `:8000`. BLE scans in the background — press the **green button** on the LEGO hub when prompted. `connected: true` in `/health` once paired.

### Terminal 3 — Server + Web

```bash
bun run dev:server   # Hono AI server → http://localhost:3000
bun run dev:web      # React UI       → http://localhost:3001
```

The server polls `hub:8000/health` every 1.5 s until `connected: true` before marking itself ready.

> **Or run everything at once** (server + web + hub in parallel via Turborepo):
> ```bash
> bun run dev
> ```
> Note: MediaMTX must be started separately — it's not a Node/Python process.

---

## Camera setup (Larix)

In **Larix Broadcaster** on your iPhone:

- **URL**: `rtmp://192.168.0.118:1935/live/stream`
- **Stream name**: *(leave blank — it's part of the URL)*

When Larix connects, MediaMTX spawns `ffmpeg` automatically and writes a JPEG to `/tmp/snapshot.jpg` every 2 seconds. The AI server reads that file directly — no HTTP snapshot endpoint needed.

> Sessions will fail with `frame_fetch_failed: ENOENT` if Larix is not streaming (the snapshot file won't exist yet). Start streaming before sending a goal.

---

## API

### Sessions (autonomous missions)

```
POST /v1/sessions           { goal, id? }   Start or continue a session
GET  /v1/sessions/:id                       Poll status
POST /v1/sessions/:id/stop                  Emergency stop
```

```bash
# Start a new session
curl -X POST http://localhost:3000/v1/sessions \
  -H 'Content-Type: application/json' \
  -d '{"goal": "go to the kitchen"}'

# Continue (follow-up goal on same session)
curl -X POST http://localhost:3000/v1/sessions \
  -H 'Content-Type: application/json' \
  -d '{"id": "abc-123", "goal": "now find the fridge"}'
```

### One-shot (stateless)

```
POST /v1/execute            { goal }        Run without persisting
GET  /v1/health                             Server + hub status
```

---

## Project Structure

```
boost/
├── apps/
│   ├── server/src/
│   │   ├── lib/
│   │   │   ├── agents/      successToolCall stop condition
│   │   │   ├── hub/         HubClient (ky HTTP)
│   │   │   ├── prompts/     Modular system prompt
│   │   │   └── tools/       forward · backward · turn · stop · complete
│   │   ├── routes/          health · sessions · execute
│   │   └── services/        orchestrator · frame (MediaMTX snapshot)
│   ├── hub/                 FastAPI BLE control plane (pylgbst)
│   └── web/                 React operator UI
├── packages/
│   ├── db/                  Drizzle schema + session queries
│   ├── env/                 Typed env (@t3-oss/env-core)
│   ├── validators/          Shared Zod schemas
│   └── config/              Shared runtime config
├── mediamtx.yml             MediaMTX — RTMP + snapshot config
├── mediamtx                 Binary (git-ignored, download above)
├── docker-compose.yml
└── docker-compose.prod.yml
```

---

## Known Issues / BLE Notes

pylgbst 1.3.0 (PyPI) has two bleak 2.x incompatibilities. This repo uses **pylgbst from GitHub** (`undera/pylgbst`) which fixes one (`BleakScanner`), plus two local patches applied at install time to the virtualenv:

| Patch | Reason |
|---|---|
| `set_notify_handler` — extract `.handle` from `BleakGATTCharacteristic` | bleak 2.x changed callback signature from `(int, bytes)` to `(BleakGATTCharacteristic, bytes)` |
| `enable_notifications` — use `asyncio.new_event_loop()` in BLE thread | uvicorn's `--loop asyncio` flag prevents uvloop from being set as the global policy, which was causing BlueZ D-Bus service discovery to drop |

**If you reinstall the hub virtualenv** (`poetry install`), re-apply patches:

```bash
cd apps/hub && poetry run python scripts/patch_bleak.py
```

*(TODO: automate via `poe post-install`)*

Uvicorn is started with `--loop asyncio` (see `pyproject.toml`) to avoid the uvloop/BlueZ conflict.

---

## Environment Variables

See `.env.example` for all variables.

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | Postgres connection string (required) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | — | Gemini API key (required) |
| `HUB_MAC` | — | BLE MAC address of LEGO hub |
| `HUB_BASE_URL` | `http://localhost:8000` | Hub FastAPI URL |
| `CORS_ORIGIN` | `http://localhost:3001` | Allowed browser origin |
| `STEP_TIMEOUT_MS` | `15000` | Per-request hub timeout |
| `VITE_API_URL` | `http://localhost:3000` | Server URL for the browser |

---

## Docker (production)

```bash
cp .env.example .env  # fill in secrets
docker compose up -d --build
docker compose logs -f server hub
```

Raspberry Pi:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

| Container | Port | Description |
|---|---|---|
| `server` | 3000 | Hono AI orchestrator |
| `hub` | 8000 | FastAPI BLE control |
| `mediamtx` | 1935 / 8888 | RTMP ingest + snapshot |
