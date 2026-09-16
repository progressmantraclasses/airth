# Job Queue Dashboard

**Live Demo:** [https://airth-web-pi.vercel.app/](https://airth-web-pi.vercel.app/)

A monorepo containing a NestJS REST API and a React frontend for managing background jobs with state machine validation and concurrency safety.

## Stack

- **Backend**: NestJS, Prisma, PostgreSQL (Supabase), Upstash Redis
- **Frontend**: React 18, Vite, TanStack Query
- **Shared**: TypeScript package with `JobStatus` enum and `canTransition` helper
- **Monorepo**: Yarn Classic (v1) workspaces

## Setup

## Step-by-Step Setup Guide

This project requires two external services: **Supabase** (for the PostgreSQL database) and **Upstash** (for Serverless Redis caching and locking). Both have generous free tiers that don't require a credit card.

### 1. Database Setup (Supabase)
1. Go to [Supabase](https://supabase.com/) and create a new project.
2. Once created, go to **Project Settings -> Database**.
3. Under **Connection string -> URI**, copy your PostgreSQL connection string.
4. Note that for Prisma, you need two connection strings: one for connection pooling (`DATABASE_URL`) and one direct connection for migrations (`DIRECT_URL`).

### 2. Redis Setup (Upstash)
1. Go to [Upstash](https://upstash.com/) and create a new Redis database.
2. Scroll down to the **REST API** section of your database dashboard.
3. Copy the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

### 3. Local Environment Configuration
Clone the repository and install dependencies:
```bash
git clone https://github.com/progressmantraclasses/airth.git
cd airth
yarn install
```

Set up your environment variables by copying the example files:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Open `apps/api/.env` and fill in the credentials you grabbed from Supabase and Upstash:
```env
DATABASE_URL="postgresql://postgres.[YOUR-REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[YOUR-REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

UPSTASH_REDIS_REST_URL="https://[YOUR-UPSTASH-URL].upstash.io"
UPSTASH_REDIS_REST_TOKEN="[YOUR-UPSTASH-TOKEN]"
```

### 4. Database Migrations & Seeding
Push the database schema to Supabase and seed it with sample data:
```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma db seed
cd ../..
```

### 5. Running the Application
You can run the backend and frontend simultaneously using two terminal windows:

**Terminal 1 (Backend API):**
```bash
yarn dev:api
# API will start on http://localhost:3000
```

**Terminal 2 (Frontend Dashboard):**
```bash
yarn dev:web
# Dashboard will start on http://localhost:5174
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

## Production Deployment Scope (VPS)

To deploy this application to a production Virtual Private Server (VPS) like AWS EC2, DigitalOcean Droplet, or Hetzner:

### 1. Process Management (PM2)
Use PM2 to run both the NestJS backend and the Vite static server (or serve frontend via Nginx directly).
```bash
# Start backend
pm2 start dist/main.js --name api-server

# For frontend, build it first
yarn workspace web build
# Serve static files with PM2 or Nginx
```

### 2. Reverse Proxy (Nginx)
Configure Nginx to route traffic to your frontend and backend securely, handling SSL termination.

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Route /api to NestJS backend
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Forward Proxy / Real IP headers
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Serve React Frontend directly
    location / {
        root /path/to/job-queue-dashboard/apps/web/dist;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }
}
```

### 3. Production Security Features
- **Helmet**: Adds 14+ HTTP security headers (X-Frame-Options, X-XSS-Protection, Strict-Transport-Security, etc.) to the NestJS API.
- **CORS**: Configured in `main.ts` to only allow requests from the designated frontend production domain.
- **Rate Limiting**: `@nestjs/throttler` is installed and configured in `app.module.ts` to limit abuse (100 requests / minute / IP).
- **SSL/TLS**: Use Let's Encrypt / Certbot on the Nginx reverse proxy to secure all traffic.

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
