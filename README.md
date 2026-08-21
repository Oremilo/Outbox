# OutboxLab — Email Scheduler

A production-grade email job scheduler service with a React/Next.js dashboard, powered by **BullMQ delayed jobs** backed by Redis. Supports multiple senders, configurable rate limiting, restart-safe job persistence, and sends via **Ethereal Email** (fake SMTP for testing).

---

## Architecture Overview

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Next.js Frontend │────▶│  Express Backend  │────▶│   PostgreSQL     │
│  (NextAuth/OAuth) │     │  (API + Worker)   │     │   (Data Store)   │
└──────────────────┘     └────────┬─────────┘     └──────────────────┘
                                  │
                          ┌───────▼───────┐
                          │     Redis     │
                          │  (BullMQ +    │
                          │  Rate Limits) │
                          └───────────────┘
```

### How Scheduling Works

1. **API receives a schedule request** with subject, body, recipients, start time, and delay between emails
2. **Batch insert** email rows into PostgreSQL with computed `scheduledTime = startTime + (index × delayMs)`
3. **Batch enqueue** BullMQ delayed jobs via `queue.addBulk()` — each job has a deterministic `jobId: "email-{uuid}"` and `delay: scheduledTime - now`
4. **BullMQ Worker** picks up jobs when their delay expires, checks rate limits, sends via Nodemailer/Ethereal, and updates DB status

### How Restart Persistence Works

- **Primary mechanism**: Redis AOF persistence (`appendonly yes`) ensures BullMQ delayed jobs survive Redis container restarts. BullMQ stores job data in Redis — a server restart doesn't lose queued jobs.
- **Safety net**: On application boot, a **reconciler** runs before the worker starts:
  - Resets emails stuck in `SENDING` state (crash mid-send) back to `SCHEDULED`
  - Re-enqueues any `PENDING`/`SCHEDULED` emails whose jobs are missing from Redis (e.g., after a Redis data wipe)
  - Uses the same deterministic `jobId` so BullMQ silently ignores already-existing jobs — **zero duplicates guaranteed**

### How Rate Limiting Works

Two layers of rate limiting, both backed by **atomic Redis Lua scripts**:

1. **Global hourly limit** (`MAX_EMAILS_PER_HOUR`): Redis counter keyed by `ratelimit-global-{YYYY-MM-DDTHH}`
2. **Per-sender hourly limit** (`MAX_EMAILS_PER_HOUR_PER_SENDER`): Redis counter keyed by `ratelimit-sender-{id}-{YYYY-MM-DDTHH}`

The Lua script does `INCR` first, then checks if the count exceeds the limit — this ensures the counter is always accurate even under concurrent access. When rate-limited, jobs are **rescheduled to the next hour window** (not dropped or failed).

**Trade-offs**:
- Fixed-window counters can allow up to 2× the limit at window boundaries (minute 59 + minute 0). Acceptable for email scheduling.
- The `INCR`-then-check pattern means the counter increment and limit check are atomic — no race window between check and increment.

### How Concurrency & Delay Are Enforced

- **Worker concurrency**: Configurable via `WORKER_CONCURRENCY`, passed directly to BullMQ `Worker({ concurrency })`.
- **Delay between sends**: Uses BullMQ's built-in `limiter: { max: 1, duration: MIN_DELAY_BETWEEN_EMAILS_MS }` on the Worker. This is **global across all worker instances** (backed by Redis) and doesn't block the Node.js event loop. Chosen over manual `setTimeout` because it's atomic and works correctly with multiple worker processes.

### Idempotency Guarantees

Two layers of defense against duplicate sends:

1. **BullMQ deterministic jobId**: Each email gets `jobId: "email-{uuid}"`. BullMQ rejects duplicate jobIds, so re-enqueuing (on restart/reconciliation) never creates a second job for the same email.
2. **DB status check**: The worker checks if `email.status === 'SENT'` before processing — already-sent emails are skipped even if they somehow end up in the queue again.

---

## Setup & Running

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (for PostgreSQL + Redis)
- Google Cloud OAuth credentials (for frontend login)

### 1. Start Infrastructure

```bash
docker compose up -d
```

This starts:
- PostgreSQL 16 on port 5432
- Redis 7 on port 6379 (with AOF persistence)

### 2. Backend Setup

```bash
cd backend

# Copy environment file
cp .env.example .env

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# (Optional) Seed test senders with Ethereal accounts
npm run db:seed

# Start the server (includes BullMQ worker in-process)
npm run dev
```

The backend starts on `http://localhost:4000`.

### 3. Frontend Setup

```bash
cd frontend

# Copy environment file
cp .env.example .env.local

# Edit .env.local with your Google OAuth credentials
# GOOGLE_CLIENT_ID=<your-client-id>
# GOOGLE_CLIENT_SECRET=<your-client-secret>
# AUTH_SECRET=<generate-with: npx auth secret>

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend starts on `http://localhost:3000`.

### 4. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Navigate to **APIs & Services > Credentials**
3. Create an **OAuth 2.0 Client ID** (Web application)
4. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy Client ID and Client Secret into `frontend/.env.local`

### 5. Ethereal Email Setup

Ethereal is a fake SMTP service — emails are captured but never actually delivered. Two options:

**Option A: Auto-generate** (recommended)
```bash
cd backend
npm run db:seed
# This creates test senders with auto-generated Ethereal credentials
```

**Option B: Use the API**
```bash
curl -X POST http://localhost:4000/api/senders \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Sender"}'
# Ethereal credentials are auto-generated
```

To view captured emails, check the worker logs for Ethereal preview URLs.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `PORT` | `4000` | Express server port |
| `FRONTEND_URL` | `http://localhost:3000` | CORS allowed origin |
| `WORKER_CONCURRENCY` | `5` | BullMQ worker concurrency |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | `500` | Minimum delay between individual sends (BullMQ limiter) |
| `MAX_EMAILS_PER_HOUR` | `100` | Global hourly email limit |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `50` | Per-sender hourly email limit |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `AUTH_SECRET` | NextAuth session encryption secret |
| `NEXTAUTH_URL` | Canonical URL for NextAuth callbacks |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/senders` | Register a new sender (auto-generates Ethereal account) |
| `GET` | `/api/senders` | List all senders |
| `POST` | `/api/schedule` | Create campaign + schedule all emails |
| `GET` | `/api/emails/scheduled` | Paginated list of scheduled emails |
| `GET` | `/api/emails/sent` | Paginated list of sent/failed emails |
| `GET` | `/api/campaigns` | List campaigns with progress stats |
| `GET` | `/api/campaigns/:id` | Campaign detail with email breakdown |

---

## Worker Process Model

**Development**: The BullMQ worker runs in-process with the Express server (`npm run dev`).

**Production**: Run the worker as a separate process for horizontal scaling:
```bash
# Terminal 1: API server
npm start

# Terminal 2: Worker(s) - scale by running multiple
npm run worker
```

Multiple worker instances safely share the same queue — BullMQ handles job locking, and rate limits are enforced via Redis (not in-memory).

---

## Feature Checklist

### Backend
- [x] BullMQ delayed job scheduling (no cron)
- [x] Deterministic, idempotent job IDs
- [x] Batch insert + batch enqueue (handles 1000+ recipients)
- [x] Boot-time DB↔Queue reconciliation
- [x] Configurable worker concurrency
- [x] BullMQ built-in limiter for minimum delay between sends
- [x] Atomic Redis Lua script rate limiting (global + per-sender)
- [x] Rate-limited job rescheduling (no drops)
- [x] Ethereal Email sending with preview URLs
- [x] Multiple sender support with transporter caching
- [x] Auto-generate Ethereal accounts programmatically
- [x] Status transitions (PENDING → SCHEDULED → SENDING → SENT/FAILED)
- [x] Campaign completion tracking
- [x] Graceful shutdown
- [x] RESTful API with Zod validation

### Frontend
- [x] Google OAuth login via NextAuth.js v5
- [x] Route protection (middleware)
- [x] Dashboard with user avatar/name/email
- [x] Tabs: Scheduled Emails / Sent Emails
- [x] Compose Campaign modal
- [x] CSV upload with client-side email extraction
- [x] Manual email input with real-time parsing
- [x] Start time picker, delay, hourly limit inputs
- [x] Loading skeletons and empty states
- [x] Status badges with color-coded pills
- [x] Pagination on email tables
- [x] Toast notifications for success/error
- [x] Dark theme with glassmorphism, gradients, micro-animations
- [x] Typed API client (no raw fetch in components)
- [x] Reusable UI components (Button, Input, Modal, Tabs, Badge, Toast)

### Infrastructure
- [x] Docker Compose for PostgreSQL + Redis
- [x] Redis AOF persistence for job durability
- [x] Prisma ORM with proper indexes
- [x] Environment variable documentation

---

## Assumptions & Shortcuts

1. **No email deduplication at SMTP level**: Ethereal doesn't care about duplicate messages, so the DB+BullMQ idempotency layers are sufficient. In production, you'd add a `Message-ID` dedup layer.

2. **No authentication on backend API**: The backend doesn't verify JWT tokens from the frontend. In production, pass the NextAuth session token and validate it server-side.

3. **Fixed-window rate limiting**: Uses a simple fixed-window counter instead of sliding window. Acceptable for email scheduling — a brief burst at window boundaries is not critical.

4. **Campaign ownership**: `createdBy` is stored but not enforced — all users see all campaigns. In production, add proper multi-tenant isolation.

5. **No email body templating**: The body is sent as-is. A production system would support template variables (`{{name}}`, `{{company}}`), but that's out of scope.
