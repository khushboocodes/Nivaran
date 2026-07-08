# Nivaran Operations

How to run, configure, back up, and extend the Nivaran platform. This is the single source of truth for env vars, migrations, and provider configuration. Update it whenever you add a new service or env-driven switch.

## 1. One-shot local boot

```cmd
docker compose up -d
npm install
npm --prefix shared install
npm --prefix server install
npm --prefix server run prisma:generate
npm --prefix server run prisma:migrate
npm --prefix server run db:seed
npm run dev:all
```

Web at `http://localhost:5173`, API at `http://localhost:3001`, Postgres at `localhost:5432`, MinIO API at `localhost:9000`, MinIO console at `localhost:9001`.

Demo accounts seeded by `db:seed`:

- citizen — `citizen@demo.nivaran.in` / `Citizen@2026`
- admin — `admin@demo.nivaran.in` / `Admin@2026`

## 2. Workspaces

| Workspace | Path | Role |
| --- | --- | --- |
| Web client | `/` (root) | Vite + React 18 + Tailwind 4 |
| Server | `/server` | Hono + Prisma + Argon2id + JOSE |
| Shared | `/shared` | zod schemas + types reused by client and server |

The workspaces are linked via `pnpm-workspace.yaml` but installs work with plain `npm install --prefix <dir>` — no pnpm needed. Postgres, MinIO, and any future infra come from `docker-compose.yml`.

## 3. Server environment variables

All server vars live in `server/.env`. `server/.env.example` is the template.

### Database
| Var | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://nivaran:nivaran@localhost:5432/nivaran?schema=public` | Pooled URL works in production too. |

### Auth
| Var | Default | Notes |
| --- | --- | --- |
| `SESSION_SECRET` | dev-only | Generate `openssl rand -base64 32` for production. |
| `SESSION_COOKIE_NAME` | `nivaran_session` | Change only if you serve multiple apps from the same domain. |
| `SESSION_TTL_HOURS` | 168 | Session lifetime, 7 days by default. |
| `PUBLIC_APP_URL` | `http://localhost:3000` | Used in password-reset email links. |

### AI provider
| Var | Default | Notes |
| --- | --- | --- |
| `AI_PROVIDER` | `gemini` | `gemini` (default when key present), `openai`, or `heuristic` (fully offline). |
| `GEMINI_API_KEY` | _unset_ | Free from [aistudio.google.com](https://aistudio.google.com). No credit card required. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | 15 RPM, 1000 requests/day on the free tier. |
| `OPENAI_API_KEY` | _unset_ | Required when `AI_PROVIDER=openai`. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Override to a model your key has access to. |

The classifier caches results by SHA-256 of `(description, language)` for 24 hours. If Gemini/OpenAI fails the response transparently degrades to the heuristic.

Provider priority: Gemini (if key set) → OpenAI (if key set) → Heuristic.

**Gemini powers:**
- Complaint classification (category, department, priority, sentiment, summary)
- Streaming AI chat assistant (context-aware, knows all citizen complaints)
- AI-generated analytics reports (admin console)

### Object storage (attachments)
| Var | Default | Notes |
| --- | --- | --- |
| `S3_ENDPOINT` | `http://localhost:9000` | MinIO inside the Compose network. |
| `S3_REGION` | `us-east-1` | MinIO ignores it; AWS/R2 require it. |
| `S3_ACCESS_KEY` | `nivaran` | |
| `S3_SECRET_KEY` | `nivaran-dev-only` | |
| `S3_BUCKET` | `nivaran-attachments` | Created automatically with public-read policy. |
| `S3_PUBLIC_URL` | `http://localhost:9000` | URL prefix written into the database; switch to a CDN/R2 URL in prod. |
| `S3_FORCE_PATH_STYLE` | `true` | MinIO requires path style. AWS S3 in path-style mode also works. |

The browser uploads bytes via presigned PUT URLs straight to storage, never through the API.

### Email
| Var | Default | Notes |
| --- | --- | --- |
| `SMTP_HOST` | _unset_ | When unset, every email is logged to stdout — keeps the prototype runnable without an SMTP account. |
| `SMTP_PORT` | 587 | |
| `SMTP_SECURE` | auto (true on 465) | |
| `SMTP_USER` | _unset_ | |
| `SMTP_PASSWORD` | _unset_ | |
| `SMTP_FROM` | `Nivaran <noreply@nivaran.local>` | Free providers that work today: Mailtrap (sandbox), Resend (3k/month free), Brevo (300/day free), Gmail with an App Password. |

The admin Settings page has a master toggle (`notifications.email`); when off, no emails are sent regardless of SMTP config.

### SMS
| Var | Default | Notes |
| --- | --- | --- |
| `SMS_PROVIDER` | `console` | Logs every send to stdout. Set to `twilio`, `msg91`, or `sns` once a paid provider is wired in. |

The dispatcher is provider-agnostic — call sites use `sendSms(...)`. Critical and SLA-escalated events are the only triggers, so cost stays bounded once you turn it on.

## 4. Database

### Migrations
- Author a new migration after editing `server/prisma/schema.prisma`:
  ```cmd
  npm --prefix server run prisma:migrate -- --name describe_change
  ```
- Apply pending migrations to a fresh database:
  ```cmd
  npm --prefix server run prisma:migrate
  ```
- Inspect the database visually with Prisma Studio:
  ```cmd
  npm --prefix server run prisma:studio
  ```

### Seed
`prisma/seed.ts` creates the demo users, departments, and a few sample complaints. It's idempotent — safe to re-run.

### Reset (dev only)
```cmd
npm --prefix server run db:reset
npm --prefix server run db:seed
```

### Backups
Container-local Postgres lives in the `nivaran_pgdata` volume. For production:
- Use the cloud provider's snapshot service (RDS automated backups, Neon point-in-time, Supabase automatic backups).
- For self-hosted, schedule `pg_dump` via cron, write to `S3_BUCKET`/backups, and rotate.

```cmd
docker exec nivaran-postgres pg_dump -U nivaran -d nivaran -Fc > nivaran-%date%.dump
```

## 5. Background jobs

The SLA scheduler runs in-process every 5 minutes. It:
1. Loads `escalation.escalateAfterDays` from settings.
2. Finds complaints submitted before `now - days`, not Critical, not Resolved.
3. Bumps each to Critical, writes a notification + audit row, and fires email/SMS.

When the API process restarts the scheduler resumes within ~5 minutes. There's no external cron runner. If the deployment runs multiple API replicas, gate the scheduler behind a `RUN_SLA_SCHEDULER=true` env on a single replica to avoid duplicate writes.

## 6. Routes summary

| Path | Notes |
| --- | --- |
| `POST /api/auth/{signup,login,logout}` | Argon2id + HTTP-only session cookie |
| `GET /api/auth/me` | Resolves the session user |
| `POST /api/auth/{forgot,reset}` | Password-reset flow with hashed tokens |
| `POST /api/auth/2fa/{enroll,verify}` | TOTP enrollment, admin-required at login |
| `GET/POST /api/complaints` | List / create |
| `GET/PATCH /api/complaints/:id` | Read / update |
| `POST /api/complaints/:id/{assign,escalate,resolve}` | State transitions |
| `GET/POST /api/complaints/:id/attachments` | List + finalize |
| `POST /api/complaints/:id/attachments/sign` | Presigned upload URL |
| `GET /api/notifications` | Per-user feed |
| `POST /api/notifications/:id/read`, `/read-all` | Mark read |
| `GET/PATCH /api/users/me`, `POST /me/password` | Citizen profile |
| `GET/POST /api/users`, `PATCH/DELETE /api/users/:id` | Admin user management |
| `GET/POST /api/feedback`, `GET /api/feedback/stats` | Citizen feedback + admin aggregates |
| `GET /api/audit` | Audit ledger (admin/officer) |
| `GET/PUT /api/settings` | Admin settings persistence |
| `GET /api/reports?type=&days=&format=json\|csv\|pdf` | Reports + export |
| `POST /api/ai/classify`, `POST /api/ai/chat` | Classifier + streaming chatbot |

## 7. Production checklist

- [ ] Generate a real `SESSION_SECRET`.
- [ ] Move object storage to Cloudflare R2 (free 10 GB) or AWS S3, set `S3_PUBLIC_URL` to the CDN.
- [ ] Pick an SMTP provider, set `SMTP_*`.
- [ ] Decide on SMS — Twilio/MSG91/SNS — only when you're ready to pay.
- [ ] Set `AI_PROVIDER=gemini` and add `GEMINI_API_KEY` (free from aistudio.google.com). Falls back to heuristic if unset.
- [ ] Run migrations, then seed only in dev.
- [ ] Put HTTPS in front of the API (cookies are SameSite=Lax + Secure in production).
- [ ] Run a single replica of the API (or gate the SLA scheduler) so escalation isn't double-fired.
- [ ] Set `PUBLIC_APP_URL` to the real domain so password-reset links work.
- [ ] Smoke-test with the Playwright suite once it lands.
