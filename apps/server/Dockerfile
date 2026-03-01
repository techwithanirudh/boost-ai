# syntax=docker/dockerfile:1

FROM oven/bun:1.3.10-slim AS deps
WORKDIR /app

COPY package.json bun.lock bts.jsonc turbo.json tsconfig.json ./
COPY apps/server/package.json                 apps/server/
COPY packages/config/package.json             packages/config/
COPY packages/db/package.json                 packages/db/
COPY packages/env/package.json                packages/env/
COPY packages/validators/package.json         packages/validators/

RUN bun install --frozen-lockfile

FROM deps AS builder
WORKDIR /app

COPY packages packages
COPY apps/server apps/server

RUN bun --cwd apps/server run compile

FROM debian:bookworm-slim AS runtime
WORKDIR /app

RUN adduser --system --uid 1001 app

COPY --from=builder /app/apps/server/server ./server
RUN chmod +x server && chown app:app server

USER app
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -qO- http://localhost:3000/v1/health > /dev/null || exit 1

CMD ["./server"]
