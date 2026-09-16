# Job Queue Dashboard

A monorepo containing a NestJS REST API and a React frontend for managing background jobs with state machine validation and concurrency safety.

## Stack

- **Backend**: NestJS, Prisma, PostgreSQL (Supabase), Upstash Redis
- **Frontend**: React 18, Vite, TanStack Query
- **Shared**: TypeScript package with `JobStatus` enum and `canTransition` helper
- **Monorepo**: Yarn Classic (v1) workspaces

## Setup

```bash
# Install all workspace dependencies
yarn install

# Copy env files and fill in your credentials
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Run Prisma migration against your Supabase DB
cd apps/api && npx prisma migrate dev --name init

# Seed sample data
npx prisma db seed

# Start backend (port 3000)
yarn dev:api

# Start frontend (port 5173)
yarn dev:web
```

## Monorepo Layout

```
job-queue-dashboard/
├── apps/
│   ├── api/        NestJS — endpoints, service, repository, filters
│   └── web/        React + Vite — UI, TanStack Query hooks, components
└── packages/
    └── shared/     JobStatus enum, Job interface, canTransition() — imported
                    by both apps so the transition rules are never duplicated
```

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/jobs` | Create job (accepts `Idempotency-Key` header) |
| GET | `/jobs` | List jobs, optional `?status=` filter (10s cache) |
| PATCH | `/jobs/:id/status` | Transition status, requires `version` in body |
| DELETE | `/jobs/:id` | Delete job |

## Concurrency Design

This is the main thing worth explaining.

### The problem

Two browser tabs open the same job and both click "→ Running" within milliseconds. Without any guard, both reads see `status=pending`, both validate the transition, and both writes succeed. The result is a phantom duplicate transition — or worse, a running → running → completed path that skips `failed` handling.

### What we do

Three layers, each catching different failure modes:

**1. Redis distributed lock (`SET key NX PX 3000`)**

The first request to arrive acquires `lock:job:{id}` and holds it for 3s. The second request sees the lock is held and immediately returns `409` — it doesn't even reach the DB. This handles the "two tabs clicking at the exact same millisecond" case.

Why not `SELECT FOR UPDATE`? It works, but it holds a DB connection open for the lock duration. Under load, connection pool exhaustion becomes the bottleneck. The Redis lock is cheaper and releases the DB connection immediately.

**2. Optimistic locking (`version` column)**

The client always sends the `version` it last saw. The update does:

```sql
UPDATE jobs SET status = $1, version = version + 1 WHERE id = $2 AND version = $3
```

If `version` doesn't match (meaning someone else already updated between our read and write), zero rows are affected → `409 Conflict`. This catches the case where the Redis lock degraded gracefully (Upstash unreachable) or where a direct `curl` call bypasses the lock.

**3. Prisma `$transaction`**

The version check and the write are inside a single transaction, so there's no window between "check if version matches" and "write the new status."

### What happens with a direct curl/Postman call?

All three layers run server-side. The state machine check (`canTransition`) is enforced in the service, not the controller and definitely not the frontend. If you send `PATCH /jobs/:id/status` with `{"status":"running","version":1}` directly, you get the exact same validation as the UI. The frontend's "only show valid buttons" behavior is a UX nicety, not a security boundary.

### What we'd do at scale

At larger scale, the `status` column approach has a ceiling. A dedicated job queue (BullMQ, Temporal) provides retry logic, dead-letter queues, priority, rate limiting, and proper concurrency primitives out of the box. The current design is a reasonable starting point that could be migrated later: the state machine logic in `packages/shared` would move into a BullMQ processor, and the `status` column becomes a denormalized read-replica updated by the queue.

## Caching

`GET /jobs` (and `?status=` variants) are cached in Upstash Redis for 10 seconds per key. On any create, update, or delete, we bust all `jobs:list:*` keys. Simple, predictable. The alternative — a single version tag that gets incremented — trades a DEL for a GET + SET and isn't obviously better for a list this size.

If Upstash is unreachable, the cache is skipped and the request hits Postgres directly. No `500`s.

## Bonus: Idempotency Keys

`POST /jobs` accepts an `Idempotency-Key` header. If the same key is sent twice (network retry, double-submit), the second call returns the cached result from the first call without creating a duplicate job. Keys are cached in Redis for 24 hours.

The frontend sends a per-form-open UUID as the idempotency key, so hitting "Create" twice in quick succession produces exactly one job.

```bash
# Demo
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-123" \
  -d '{"title":"Test job","type":"demo"}'

# Identical response, no new row created:
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-unique-key-123" \
  -d '{"title":"Test job","type":"demo"}'
```

## Deployment

- **Backend**: Railway or Render — set `DATABASE_URL`, `DIRECT_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` as env vars.
- **Frontend**: Vercel or Netlify — set `VITE_API_URL` to the deployed backend URL.

## Assumptions and Trade-offs

- The `version` field is exposed to the client and required in `PATCH` bodies. A wrapping layer could hide it, but for this scope it's a clean contract.
- Redis keys expire naturally; we also eagerly DEL on writes to avoid serving stale data within the 10s window.
- No auth. Adding JWT/API key auth would be the first thing in a real production system.
- Migrations are committed. `db push` is faster to iterate but doesn't give you a migration history — that matters when you have multiple environments.

## What I'd Improve with More Time

- Unit tests for the state machine and the concurrency path (version conflict + lock conflict)
- WebSocket or SSE for real-time status updates instead of polling
- Pagination for the job list
- Proper structured logging (pino) with request IDs
- Auth (JWT) on all write endpoints
