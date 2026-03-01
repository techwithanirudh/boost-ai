# boost

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Hono, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Hono** - Lightweight, performant server framework
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
bun run db:push
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).

## Project Structure

```
boost/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   └── server/      # Backend API (Hono)
├── packages/
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:server`: Start only the server
- `bun run check-types`: Check TypeScript types across all apps
- `bun run db:push`: Push schema changes to database
- `bun run db:generate`: Generate database client/types
- `bun run db:migrate`: Run database migrations
- `bun run db:studio`: Open database studio UI

## Hub Service Scaffold

`apps/hub` is the new FastAPI service scaffold for LEGO hub control.

Run API + hub via Docker:

```bash
DATABASE_URL='postgresql://<user>:<pass>@<host>/<db>?sslmode=require' docker compose up -d --build
docker compose logs -f server hub
```

Pi profile:

```bash
DATABASE_URL='postgresql://<user>:<pass>@<host>/<db>?sslmode=require' docker compose -f docker-compose.pi.yml up -d --build
```

## Planning Docs

- Current refactor execution plan: `plan.md`
- Archived plan from `origin/main` HEAD: `docs/plans/archive/plan-origin-main-latest.md`
- Archived plan from `origin/main` four commits back (`c3b95b7`): `docs/plans/archive/plan-origin-main-4-commits-back-c3b95b7.md`
