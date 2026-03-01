# Boost Robot Stack

Autonomous LEGO Boost robot controlled by a multimodal AI agent.

```
iPhone (Larix RTSP) → MediaMTX → Server (AI loop) → Hub (BLE) → LEGO Boost
```

The AI is given the camera frame and a goal (e.g. *"go to the kitchen"*). It calls motion tools in a loop — **forward / backward / turn / stop** — until it calls `complete` to signal the goal is reached. Every turn's messages are persisted in Postgres so the agent retains full context.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + TanStack Router + Tailwind + shadcn/ui |
| Server | Hono + Bun + AI SDK v6 (Gemini 2.5 Flash) |
| Hub | FastAPI + pylgbst (BLE) |
| Database | Neon Postgres + Drizzle ORM |
| Camera | iPhone Larix → RTSP → MediaMTX |
| Monorepo | Turborepo + Bun workspaces |

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.3
- [Poetry](https://python-poetry.org) ≥ 2.0  (`curl -sSL https://install.python-poetry.org | python3 -`)
- Neon (or any Postgres) database
- Google Gemini API key — [aistudio.google.com](https://aistudio.google.com)
- LEGO Boost Move Hub (Bluetooth LE)
- iPhone with [Larix Broadcaster](https://softvelum.com/larix/) streaming to `rtsp://<pi-ip>:8554/cam`

### Install & Configure

```bash
bun install
cp .env.example .env
# edit .env — fill in DATABASE_URL and GOOGLE_GENERATIVE_AI_API_KEY at minimum
```

### Database

```bash
bun run db:push       # apply schema
bun run db:studio     # Drizzle Studio at http://localhost:4983
```

### Run (development)

```bash
bun run dev           # server + web + hub in parallel
bun run dev:server    # server only  → http://localhost:3000
bun run dev:web       # web UI only  → http://localhost:3001
```

---

## Docker (production)

```bash
cp .env.example .env   # fill in secrets
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
| `mediamtx` | 8554 / 8888 | RTSP ingest + snapshot |

---

## API

### Sessions (autonomous missions)

```
POST /v1/sessions           { goal, id? }   Start new or continue
GET  /v1/sessions/:id                       Poll status
POST /v1/sessions/:id/stop                  Emergency stop
```

```bash
# Start
curl -X POST http://localhost:3000/v1/sessions \
  -H 'Content-Type: application/json' \
  -d '{"goal": "go to the kitchen"}'

# Follow-up on the same session
curl -X POST http://localhost:3000/v1/sessions \
  -H 'Content-Type: application/json' \
  -d '{"id": "abc-123", "goal": "now find the fridge"}'
```

### One-shot (no session)

```
POST /v1/execute            { goal }
GET  /v1/health
```

---

## Project Structure

```
boost/
├── apps/
│   ├── server/src/
│   │   ├── lib/
│   │   │   ├── agents/      successToolCall utility
│   │   │   ├── hub/         HubClient (ky)
│   │   │   ├── prompts/     Modular system prompt
│   │   │   └── tools/       forward · backward · turn · stop · complete
│   │   ├── routes/          health · sessions · execute
│   │   └── services/        orchestrator · frame
│   ├── hub/                 FastAPI BLE control plane
│   └── web/                 React operator UI
├── packages/
│   ├── db/                  Drizzle schema + session queries
│   ├── env/                 Typed env (@t3-oss/env-core)
│   ├── validators/          Shared Zod schemas
│   └── config/              Shared runtime config
├── mediamtx.yml             MediaMTX config
├── docker-compose.yml
├── docker-compose.prod.yml
└── TODO.md
```

---

## Environment Variables

See `.env.example` for all variables with descriptions.

**Required:** `DATABASE_URL`, `GOOGLE_GENERATIVE_AI_API_KEY`

**Key defaults:** `MEDIAMTX_BASE_URL=http://localhost:8888`, `MEDIAMTX_STREAM_PATH=cam`, `CORS_ORIGIN=http://localhost:3001`
