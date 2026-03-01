#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ── colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'
GREEN='\033[0;32m'; BOLD='\033[1m'; RESET='\033[0m'

info()  { echo -e "${BOLD}${CYAN}[boost]${RESET} $*"; }
ok()    { echo -e "${BOLD}${GREEN}[boost]${RESET} $*"; }
warn()  { echo -e "${BOLD}${YELLOW}[boost]${RESET} $*"; }
die()   { echo -e "${BOLD}${RED}[boost]${RESET} $*" >&2; exit 1; }

# ── prefixed log stream ───────────────────────────────────────────────────────
# prefix <label> <colour> <cmd...>
prefix() {
  local label="$1" colour="$2"; shift 2
  "$@" > >(
    while IFS= read -r line; do
      echo -e "${colour}[${label}]${RESET} ${line}"
    done
  ) 2>&1 &
}

# ── preflight checks ─────────────────────────────────────────────────────────
[[ -f .env ]] || die ".env not found — copy .env.example and fill in secrets"
command -v bun     >/dev/null || die "bun not found — https://bun.sh"
command -v poetry  >/dev/null || die "poetry not found — https://python-poetry.org"
command -v ffmpeg  >/dev/null || die "ffmpeg not found — sudo apt install ffmpeg"

if [[ ! -x ./mediamtx ]]; then
  warn "mediamtx binary not found. Downloading v1.16.2 for linux/arm64…"
  curl -fsSL \
    "https://github.com/bluenviron/mediamtx/releases/download/v1.16.2/mediamtx_v1.16.2_linux_arm64.tar.gz" \
    | tar xz mediamtx
  chmod +x ./mediamtx
  ok "mediamtx downloaded."
fi

# ── cleanup on exit ───────────────────────────────────────────────────────────
PIDS=()
SHUTDOWN_DONE=0
cleanup() {
  [[ "$SHUTDOWN_DONE" -eq 1 ]] && return
  SHUTDOWN_DONE=1

  echo ""
  info "Shutting down…"
  for pid in "${PIDS[@]:-}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done

  local deadline=$((SECONDS + 5))
  for pid in "${PIDS[@]:-}"; do
    while kill -0 "$pid" 2>/dev/null; do
      if (( SECONDS >= deadline )); then
        kill -KILL "$pid" 2>/dev/null || true
        break
      fi
      sleep 0.1
    done
  done

  wait 2>/dev/null || true
  info "Done."
}
trap cleanup EXIT INT TERM

# ── start services ────────────────────────────────────────────────────────────
info "Starting MediaMTX…"
prefix "mediamtx" '\033[0;35m' ./mediamtx mediamtx.yml
PIDS+=($!)

info "Starting hub…"
prefix "hub     " '\033[0;34m' \
  bash -c "cd apps/hub && poetry run poe start"
PIDS+=($!)

info "Starting server…"
prefix "server  " '\033[0;32m' \
  bash -c "bun run --env-file .env --hot apps/server/src/index.ts"
PIDS+=($!)

info "Starting web…"
prefix "web     " '\033[0;33m' \
  bash -c "bun run --cwd apps/web dev"
PIDS+=($!)

ok "All services started. Press ${BOLD}Ctrl+C${RESET}${GREEN} to stop."
echo ""

# wait for any child to exit unexpectedly
wait -n 2>/dev/null || wait
