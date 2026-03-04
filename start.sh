#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ── colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'
GREEN='\033[0;32m'; BOLD='\033[1m'; RESET='\033[0m'

info()  { echo -e "${BOLD}${CYAN}[ev3]${RESET} $*"; }
ok()    { echo -e "${BOLD}${GREEN}[ev3]${RESET} $*"; }
warn()  { echo -e "${BOLD}${YELLOW}[ev3]${RESET} $*"; }
die()   { echo -e "${BOLD}${RED}[ev3]${RESET} $*" >&2; exit 1; }

# ── preflight checks ─────────────────────────────────────────────────────────
[[ -f .env ]] || die ".env not found — copy .env.example and fill in secrets"
command -v bun     >/dev/null || die "bun not found — https://bun.sh"
command -v poetry  >/dev/null || die "poetry not found — https://python-poetry.org"
command -v ffmpeg  >/dev/null || die "ffmpeg not found — sudo apt install ffmpeg"


MEDIAMTX_BIN="./bin/mediamtx"
if [[ ! -x "$MEDIAMTX_BIN" ]]; then
  mkdir -p ./bin
  warn "mediamtx binary not found. Downloading v1.16.2 for linux/arm64…"
  curl -fsSL \
    "https://github.com/bluenviron/mediamtx/releases/download/v1.16.2/mediamtx_v1.16.2_linux_arm64.tar.gz" \
    | tar xz -C ./bin mediamtx
  chmod +x "$MEDIAMTX_BIN"
  ok "mediamtx downloaded."
fi

info "Starting…"
exec bun run dev
