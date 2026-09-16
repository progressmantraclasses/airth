# Job Queue Dashboard

**Live Demo:** [https://airth-web-pi.vercel.app/](https://airth-web-pi.vercel.app/)

A robust monorepo containing a NestJS REST API and a React frontend for managing background jobs with state machine validation and strict concurrency safety.

---

## 🛠️ Tech Stack

- **Backend**: NestJS, Prisma, PostgreSQL (Supabase), Upstash Redis
- **Frontend**: React 18, Vite, TanStack Query
- **Shared**: TypeScript workspace package for unified type definitions and state transitions.
- **Monorepo Management**: Yarn Classic (v1) workspaces

---

## 🚀 Setup Instructions (Step-by-Step)

Follow these steps to run the project locally on your machine.

### Prerequisites
- Node.js (v18 or higher)
- Yarn classic (`npm install -g yarn`)
- A Supabase account (for PostgreSQL)
- An Upstash account (for Redis)

### 1. Install Dependencies
Navigate to the root directory and install dependencies across all workspaces:
```bash
yarn install
```

### 2. Configure Environment Variables
You need to set up the environment variables for both the backend API and the frontend web app.
```bash
# Setup Backend ENV
cp apps/api/.env.example apps/api/.env

# Setup Frontend ENV
cp apps/web/.env.example apps/web/.env
```
Open `apps/api/.env` and fill in your actual credentials:
- `DATABASE_URL` (Supabase connection string with `?pgbouncer=true`)
- `DIRECT_URL` (Supabase direct connection string)
- `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` (From Upstash console)

### 3. Database Migration & Seeding
Initialize the database schema and seed it with sample jobs:
```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma db seed
```

### 4. Start the Application
Return to the root directory. You can run the backend and frontend simultaneously in separate terminal windows:

**Terminal 1 (Backend API):**
```bash
yarn dev:api
# API runs on http://localhost:3000
```

**Terminal 2 (Frontend Web):**
```bash
yarn dev:web
# Frontend runs on http://localhost:5174
```

---

## ⚡ Concurrency Design

### The Problem
If two browser tabs open the same job and both click "→ Running" within milliseconds, both reads see `status=pending`, both validate the transition, and both writes succeed. The result is a phantom duplicate transition, skipping necessary logic.

### The Solution (Three-Layer Defense)

**1. Upstash Redis Distributed Lock (`SET key NX PX 3000`)**
The first request acquires `lock:job:{id}` and holds it for 3s. The second request sees the lock and immediately returns `409 Conflict`. 
> **Why Upstash Redis?** Upstash provides Serverless Redis over HTTP. It is exceptionally fast, highly secure (REST-based meaning no exposed TCP ports, secured via Bearer tokens), and scales to zero automatically. It's the perfect serverless companion to avoid maintaining long-lived TCP connections, avoiding connection pool exhaustion during high concurrency bursts.

**2. Optimistic Locking (`version` column)**
The update safely checks the version:
```sql
UPDATE jobs SET status = $1, version = version + 1 WHERE id = $2 AND version = $3
```
If `version` doesn't match, zero rows are affected → `409 Conflict`. This catches race conditions if the Redis lock is bypassed or expires.

**3. Prisma `$transaction`**
The version check and the write happen inside a single atomic database transaction.

---

## 🔒 Production-Ready Improvement

> **Assignment Prompt:** *Add one small improvement that you think would make this system more production-ready. Explain why you chose it.*

### Improvement Added: Enterprise Security Hardening (Helmet, Strict CORS, & Rate Limiting)

While the core functionality of the job queue works perfectly, exposing a raw NestJS API directly to the internet is dangerous. I added a trio of security improvements to make the backend genuinely production-ready:

1. **Helmet**: Automatically injects 14+ crucial HTTP security headers (like `X-Frame-Options` to prevent clickjacking, `Strict-Transport-Security` to enforce HTTPS, and `X-XSS-Protection`).
2. **Strict CORS**: Instead of `app.enableCors()` allowing all origins, CORS is now strictly bound to the `FRONTEND_URL` environment variable in production, ensuring malicious websites cannot make unauthorized cross-origin requests to the API.
3. **Throttler (Rate Limiting)**: Configured `@nestjs/throttler` to cap traffic at 100 requests per minute per IP. 

**Why I chose this:** State machines and concurrency locks prevent *accidental* system failure, but security headers and rate limits prevent *malicious* system failure (like DDoS attacks or Cross-Site Scripting). This small improvement takes the app from a "local prototype" to a resilient, production-grade service that can safely be deployed to a public URL.

---

## 🐳 Deployment (Docker & Vercel)

### Backend (Docker / Render / Railway)
A `Dockerfile` is included in the root directory designed for this monorepo. It correctly builds the shared package, generates the Prisma client, and compiles the NestJS API.

### Frontend (Vercel)
The Vite frontend can be deployed directly to Vercel. Make sure to set the `VITE_API_URL` environment variable to point to your deployed backend URL.

*(Note: Vercel caches `node_modules`. To deploy the API to Vercel, the `build` script in `apps/api/package.json` was updated to explicitly run `prisma generate` to prevent 500 errors).*

---

## 🔁 Bonus: Idempotency Keys

`POST /jobs` accepts an `Idempotency-Key` header. If the same key is sent twice (e.g., a network retry), the second call returns the cached result without creating a duplicate job. Keys are cached securely in Redis for 24 hours.
