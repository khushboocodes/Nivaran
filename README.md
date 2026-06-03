# NIVARAN — Citizen Grievance Platform

NIVARAN is an AI-assisted civic-grievance platform. Citizens file complaints in any of 11 Indian languages, attach photos / videos / audio, drop a pin on the map, and watch the status. Officers and admins triage, assign, escalate, and resolve from a separate console with analytics, heatmaps, audit logs, and exportable reports.

The whole stack runs locally with two commands. No paid services required.

## Stack

| Layer | Tech |
| --- | --- |
| Web client | Vite 6, React 18, TypeScript 5, Tailwind 4, shadcn/ui, React Query, react-hook-form + zod, react-i18next, Leaflet |
| Backend | Hono 4 on Node 20, TypeScript, Argon2id, JOSE JWT cookies, Prisma 5 |
| Database | Postgres 16 |
| Object storage | MinIO (S3-compatible) — for complaint attachments |
| AI | Heuristic classifier (free, ships by default) or OpenAI Chat Completions (optional, $0.000015/call) |
| Email | Nodemailer SMTP — Mailtrap / Resend / Brevo / Gmail App Password all work, dev mode logs to stdout |
| SMS | Twilio / MSG91 ready, dev mode logs to stdout |
| Tests | Vitest + Testing Library |
| CI | GitHub Actions (typecheck, build, test) |
| Maps | OpenStreetMap tiles |
| Telemetry | PostHog (opt-in) — falls back to console |

## Quick start

```cmd
git clone <your-fork-url>
cd <repo>

docker compose up -d

npm install
npm --prefix shared install
npm --prefix server install

copy server\.env.example server\.env
npm --prefix server run prisma:generate
npm --prefix server run prisma:migrate
npm --prefix server run db:seed

npm run dev:all
```

Wait for both servers to log "ready". Then visit:

- **Citizen portal** — http://localhost:5173/login
- **Admin console** — http://localhost:5173/admin/login
- **MinIO console** — http://localhost:9001 (`nivaran` / `nivaran-dev-only`)

The single `npm run dev:all` script starts the Vite client and the API server side-by-side via `concurrently`. If you close the terminal, both stop.

## Demo accounts (seeded by `db:seed`)

| Role | Email | Password |
| --- | --- | --- |
| Citizen | `citizen@demo.nivaran.in` | `Citizen@2026` |
| Officer | invite from the Users page | — |
| Admin | `admin@demo.nivaran.in` | `Admin@2026` |

Officers are department-scoped — they only see complaints assigned to their department. Invite them from the Admin console → Users page and assign a department. See [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md) for more details.

## Features

### Citizen portal
- Sign up, login, password reset, profile, password change
- File a complaint with title, description, category, language (11 languages: EN, HI, TA, TE, KN, ML, MR, BN, GU, PA, UR)
- AI-assisted classification: category, department, priority, sentiment, summary
- Photo / video / audio attachments via direct browser → MinIO uploads (presigned URLs)
- Live audio recording via MediaRecorder API
- Geolocation pin drop ("Use my location")
- Track any complaint by ID with a step-by-step status timeline
- Real-time notifications with unread badge and "Mark all as read"
- Streaming AI assistant chatbot
- Star rating + comment feedback on resolved complaints

### Admin console
- Department-scoped dashboard, complaints list, analytics, escalation, heatmap, reports
- Complaint detail modal with status / priority / assignee / escalate / resolve actions
- Leaflet heatmap with category-coloured markers
- SLA scheduler that auto-escalates overdue complaints every 5 minutes
- Settings page with persistent storage (notifications, escalation thresholds, AI flags)
- JSON / CSV / PDF reports via `/api/reports`
- User & role management (invite officers, assign departments, toggle roles) — admin only
- Audit log with CSV export — every mutation is recorded
- Feedback analytics (avg rating, distribution, by category, recent comments)

### Officer console
- Department-scoped view — officers only see complaints routed to their department
- Update complaint status, priority, and add resolution notes
- Escalate complaints up to admin when needed
- Receive email / SMS notifications on new assignments

### Cross-cutting
- Hard auth: bfcache-aware logout, role-gated routes, sealed-room navigation (signed-in users can't see login pages, signed-out can't reach protected ones)
- Mobile-friendly: hamburger drawer below 1024px, responsive grids, no horizontal scroll on phones
- Email + SMS notifications (gated by admin toggle)
- Opt-in telemetry banner (PostHog-ready, console by default)
- Dockerfile + GitHub Actions CI

## Project layout

```
.
├── server/                 # Hono API + Prisma
│   ├── src/                # Routes, services, auth
│   ├── prisma/             # Schema, migrations, seed, backfill
│   └── Dockerfile
├── shared/                 # zod schemas + TS types reused by client and server
│   └── src/
├── src/                    # Web client (Vite + React)
│   ├── app/                # Pages, layouts, contexts, components
│   ├── lib/                # Telemetry, API client, i18n, helpers
│   └── styles/
├── docker-compose.yml      # Postgres + MinIO
├── .github/workflows/ci.yml
└── docs/operations.md      # Env vars, migrations, backups, ops checklist
```

## Configuration

All server config lives in `server/.env`. Defaults match the local Docker stack — copy from `server/.env.example` and you're done. Optional knobs:

| Var | Default | Effect |
| --- | --- | --- |
| `AI_PROVIDER` | `heuristic` | Set to `openai` to call the OpenAI Chat API. Falls back transparently. |
| `OPENAI_API_KEY` | _unset_ | Required when `AI_PROVIDER=openai`. |
| `SMTP_HOST` | _unset_ | When unset, every email is logged to stdout. |
| `SMS_PROVIDER` | `console` | Logs to stdout. Switch to `twilio` / `msg91` / `sns` once you wire up keys. |
| `S3_*` | MinIO defaults | Repoint to Cloudflare R2 (10 GB free) or AWS S3 in production. |

Full list with explanations is in [`docs/operations.md`](docs/operations.md).

## Available scripts

```cmd
npm run dev          REM Web client only
npm run dev:server   REM API server only
npm run dev:all      REM Both, recommended
npm run build        REM Web client production build
npm test             REM Vitest suite (23 tests)
```

Server-only scripts (run with `npm --prefix server run <name>`):

```
prisma:generate    REM Regenerate Prisma client after schema changes
prisma:migrate     REM Apply pending migrations
prisma:studio      REM Visual DB browser at localhost:5555
db:seed            REM Insert demo users + departments
db:reset           REM Drop and re-create the database (destructive)
backfill:ai        REM Re-run AI classifier on every existing complaint
build              REM Compile TS to dist/
start              REM Run compiled server
```

## Cost reality

Everything in this README runs on the free path. No credit card required.

| Component | Default | Free option | Paid path |
| --- | --- | --- | --- |
| Database | Postgres in Docker | ✅ | Supabase / Neon / RDS |
| Object storage | MinIO in Docker | ✅ | Cloudflare R2 (10 GB free) → AWS S3 |
| AI classifier | Heuristic (~88% accuracy) | ✅ | OpenAI gpt-4o-mini (~95%) at $0.000015/call |
| Email | Console logger | ✅ | Resend (3k/mo free) / Mailtrap / Gmail App Password |
| SMS | Console logger | ✅ | Twilio / MSG91 (paid per message in India) |
| Maps | OpenStreetMap tiles | ✅ | Mapbox / Google (paid) |
| Hosting | localhost | ✅ | Fly.io / Railway / Render / your own VPS |

## Documentation

- [`docs/operations.md`](docs/operations.md) — env vars, migrations, backups, production checklist
- [`DEMO_ACCOUNTS.md`](DEMO_ACCOUNTS.md) — credentials, role behaviours, how to invite staff

## Tests

```cmd
npm test
```

23 tests across 3 suites:
- Badge color helpers
- Server-side complaint serializer (Prisma↔wire round-trip)
- AI heuristic classifier (routing, priority, sentiment, stemming, Hinglish keywords, negation)

CI runs them on every push and PR. See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## License

Copyright (c) 2026 Nivaran. All rights reserved.

This source code is made available for viewing purposes only.
Copying, modification, distribution, or use of any kind is not permitted
without explicit written permission from the author.
