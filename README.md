# boost-ai

AI has a body. Gemini sees through a camera mounted on a LEGO BOOST robot, narrates what it sees, and steers motors via tool calls.

```
[Larix on iPhone] --RTMP--> [MediaMTX] --RTSP--> [agent] --HTTP--> [pyhub] --BLE--> LEGO BOOST
```

## One-shot run (Docker Compose)

### 1) Set env files

```bash
cd /home/node/boost

cp services/agent/.env.example services/agent/.env
cp services/pyhub/.env.example services/pyhub/.env
```

Edit:

- `services/agent/.env`
  - `GOOGLE_API_KEY=...`
  - `PYHUB_URL=http://localhost:8000`
  - `CAMERA_RTSP=rtsp://localhost:8554/live/stream`

- `services/pyhub/.env`
  - `HUB_MAC=<your boost hub mac>`
  - `MOCK_HUB=false` (or `true` for dry run)
  - `WATCHDOG_TIMEOUT_S=5`
  - `HUB_CONNECT_TIMEOUT_S=300`
  - `DATABASE_URL=sqlite:///../../storage/pyhub.db`

### 2) Start stack

```bash
docker compose up -d --build
```

### 3) Check logs

```bash
docker compose logs -f mediamtx pyhub agent
```

### 4) Stop stack

```bash
docker compose down
```

---

## Larix Broadcaster setup (iPhone)

Find Pi IP:

```bash
ip -4 addr show wlan0
```

Assume Pi IP is `192.168.0.118`.

### Important: app/stream format

Larix expects **app + stream key** for RTMP.

Use either:

1. URL + stream key fields:
   - URL: `rtmp://192.168.0.118:1935/live`
   - Stream name/key: `stream`

2. Single URL field:
   - `rtmp://192.168.0.118:1935/live/stream`

If you only use `rtmp://...:1935/live`, many clients show "invalid URL" or "can't find app/stream".

Read stream from Pi:

- `rtsp://192.168.0.118:8554/live/stream`

Set this same URL in `services/agent/.env` as `CAMERA_RTSP`.

---

## Service details

### MediaMTX

- RTMP publish: port `1935`
- RTSP read: port `8554`
- Config: `infra/mediamtx/mediamtx.yml`

### pyhub

FastAPI endpoints:

- `POST /execute`
- `POST /stop`
- `GET /health`
- `GET /telemetry`
- `GET /commands`

DB path is under `storage/pyhub.db`.

### agent

- Streams 1 FPS camera frames to Gemini Live.
- Executes tool calls to pyhub (`forward_cm`, `backward_cm`, `turn_deg`, `stop`).

---

## Troubleshooting

### pyhub keeps waiting for hub

- Press green button on LEGO hub.
- Confirm `HUB_MAC` is correct.
- Keep hub close to Pi.

### agent says "Cannot reach pyhub"

- Check pyhub logs.
- Verify pyhub container is healthy.
- Ensure `PYHUB_URL=http://localhost:8000`.

### Larix can't connect

- Ensure iPhone and Pi are on same LAN.
- Use `live/stream` style path (app + stream).
- Confirm port `1935` reachable.

---

## Repo layout

```
boost/
  docker-compose.yml
  infra/mediamtx/mediamtx.yml
  services/
    agent/
    pyhub/
  storage/
```
