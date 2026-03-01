FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock tsconfig.json turbo.json bts.jsonc /app/
COPY apps /app/apps
COPY packages /app/packages

RUN bun install

EXPOSE 3000
CMD ["bun", "apps/server/src/index.ts"]
