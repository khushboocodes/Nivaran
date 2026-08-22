# Deployment Guide — 100% Free Hosting

This guide walks through deploying Nivaran on free tiers across 4 platforms.

**Total time: ~20 minutes**

## Prerequisites

- GitHub account (you already have the repo pushed)
- Email for signups

---

## Step 1: Neon (Postgres Database)

**Why:** Free Postgres with 0.5 GB storage forever.

1. Go to **[neon.tech](https://neon.tech)** → Sign in with GitHub
2. Click **New Project**
   - Name: `nivaran`
   - Region: Pick the closest to your users
   - Postgres version: 16 (default)
3. Click **Create Project**
4. Copy the **connection string** from the dashboard — looks like:
   ```
   postgresql://username:password@host.region.neon.tech/nivaran?sslmode=require
   ```
5. **Save this string** — you'll need it for Render in Step 3

✅ Database ready

---

## Step 2: Cloudflare R2 (File Storage) — OPTIONAL

> **Skip this step unless you need it.** Attachment uploads work out of the box
> with no object storage at all. The default `db` storage driver keeps file
> bytes in the `attachment_blobs` Postgres table and serves them from
> `GET /api/uploads/<key>`, so photos, video, audio and voice recordings all
> work with nothing configured beyond `DATABASE_URL`.
>
> Switch to a bucket when file volume outgrows your database plan — bytes in
> Postgres count against storage (0.5 GB on Neon's free plan) and every read
> passes through the API. To switch, set `STORAGE_DRIVER=s3` plus the `S3_*`
> variables below. The driver is chosen by that one variable and is never
> inferred, so a half-configured bucket cannot silently take over.
>
> Note that R2 also needs a bucket CORS policy allowing `PUT` from your Vercel
> origin, which the database driver does not.

## Step 2 (optional): Cloudflare R2

**Why:** Free 10 GB storage for complaint attachments, no egress fees.

1. Go to **[cloudflare.com](https://cloudflare.com)** → Sign up (or log in)
2. Dashboard → **R2** (left sidebar)
3. Click **Create bucket**
   - Name: `nivaran-attachments`
   - Location: Automatic
4. Click **Create bucket**
5. Go to **Manage R2 API Tokens** (top right)
6. Click **Create API Token**
   - Name: `nivaran-server`
   - Permissions: Object Read & Write
   - Apply to specific buckets only: `nivaran-attachments`
7. Click **Create API Token**
8. **Copy and save these values:**
   - Account ID
   - Access Key ID
   - Secret Access Key
   - Bucket name: `nivaran-attachments`
9. Get the **public bucket URL**:
   - Go back to the bucket → Settings tab
   - Under **Public Access** → Enable public access (if you want attachments viewable via link)
   - Copy the **Public bucket URL** — looks like `https://pub-xyz.r2.dev`
   - If you don't want public access, use the R2 dev URL format: `https://<account-id>.r2.cloudflarestorage.com/<bucket-name>`

✅ Storage ready

---

## Step 3: Render (Backend API)

**Why:** Free Docker hosting. Spins down after 15 min inactivity but perfect for demos.

1. Go to **[render.com](https://render.com)** → Sign in with GitHub
2. Dashboard → **New +** → **Web Service**
3. **Connect your GitHub repo:**
   - Find `khushboocodes/Nivaran`
   - Click **Connect**
4. **Configure the service:**
   - Name: `nivaran-api`
   - Region: Same as Neon (or closest to your users)
   - Branch: `main`
   - Runtime: **Docker**
   - Dockerfile Path: `./server/Dockerfile`
   - Docker Build Context Directory: `.` (root)
5. **Scroll down to Environment Variables** — Add these one by one:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Paste the Neon connection string from Step 1 |
   | `SESSION_SECRET` | Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
   | `SESSION_COOKIE_NAME` | `nivaran_session` |
   | `SESSION_TTL_HOURS` | `168` |
   | `PUBLIC_APP_URL` | Leave blank for now, update after Step 4 |
   | `PORT` | `3001` |
   | `S3_ENDPOINT` | `https://xyz.r2.cloudflarestorage.com` (replace `xyz` with your Cloudflare account ID) |
   | `S3_REGION` | `auto` |
   | `S3_ACCESS_KEY` | Your R2 Access Key ID from Step 2 |
   | `S3_SECRET_KEY` | Your R2 Secret Access Key from Step 2 |
   | `S3_BUCKET` | `nivaran-attachments` |
   | `S3_PUBLIC_URL` | Your R2 public URL from Step 2 |
   | `S3_FORCE_PATH_STYLE` | `false` |
   | `SMTP_HOST` | Leave blank (emails log to console) or add Resend/Mailtrap credentials |
   | `SMS_PROVIDER` | `console` |
   | `AI_PROVIDER` | `heuristic` |

6. **Instance Type:** Free
7. Click **Create Web Service**
8. Wait for the build to finish (~5 min)
9. Once live, copy your API URL — looks like `https://nivaran-api.onrender.com`

✅ API deployed

---

## Step 4: Vercel (Frontend)

**Why:** Free hosting for static sites, unlimited bandwidth.

1. Go to **[vercel.com](https://vercel.com)** → Sign in with GitHub
2. Click **Add New...** → **Project**
3. **Import your repo:**
   - Find `khushboocodes/Nivaran`
   - Click **Import**
4. **Configure the project:**
   - Framework Preset: **Vite** (auto-detected)
   - Root Directory: `.` (leave default)
   - Build Command: `npm run build` (leave default)
   - Output Directory: `dist` (leave default)
5. **Environment Variables** — Add one:

   | Key | Value |
   |-----|-------|
   | `VITE_API_BASE_URL` | Your Render API URL from Step 3 (e.g., `https://nivaran-api.onrender.com/api`) |

6. Click **Deploy**
7. Wait for build (~2 min)
8. Once live, copy your frontend URL — looks like `https://nivaran.vercel.app`

✅ Frontend deployed

---

## Step 5: Update Backend with Frontend URL

The backend needs to know the frontend URL for CORS and cookie settings.

1. Go back to **Render dashboard** → Your `nivaran-api` service
2. Go to **Environment** tab
3. Find `PUBLIC_APP_URL` → Edit → Set to your Vercel URL (e.g., `https://nivaran.vercel.app`)
4. Click **Save Changes**
5. Render will auto-redeploy (~2 min)

✅ All connected

---

## Step 6: Test It

1. Open your Vercel URL: `https://nivaran.vercel.app`
2. Click **Admin Login** → Use demo credentials from `DEMO_ACCOUNTS.md`
3. First request might be slow (~30 sec) as Render wakes up the server
4. Try filing a complaint, uploading an attachment, checking the dashboard

---

## What You Just Deployed

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | `https://nivaran.vercel.app` |
| API | Render | `https://nivaran-api.onrender.com` |
| Database | Neon | (managed) |
| File Storage | Cloudflare R2 | (managed) |

---

## Step 7: Load the demand corpus into the cloud database

A freshly migrated database has the schema but no data, and an empty national
planning screen is indistinguishable from a broken one. Push the local corpus
up in one command:

```bash
npm run db:backup
npm run db:seed-cloud -- backups/<newest>.dump "postgresql://user:pass@host/db?sslmode=require"
```

`db:seed-cloud` runs `pg_restore` inside the local Postgres container, so no
host-side Postgres client is needed and there is no client/server version skew.
It refuses a non-`postgresql://` target and refuses a localhost target, because
it restores with `--clean` and a mistyped target would wipe the dev database.
The connection string is passed through the environment rather than argv, so it
does not appear in a process list.

Reference size: 149,986 complaints + 640 districts + 6,400 census indicators is
**122 MB** on disk, or a 7.5 MB compressed dump.

---

## Free Tier Limits

| Platform | Limit | Notes |
|----------|-------|-------|
| Vercel | 100 GB bandwidth/mo | Plenty for a demo |
| Render | Server sleeps after 15 min | 750 free hours/mo; cold start ~50 s |
| Neon | 0.5 GB storage | ~600k complaints (150k ≈ 122 MB) |
| Cloudflare R2 | 10 GB storage | ~500 images |

> **Render's own free Postgres expires 30 days after creation and is then
> deleted.** Neon's free tier does not expire, which is why it is the database
> in this guide. If you used a Render database, expect it to vanish after a
> month — see "the site loads a blank page" below for what that looks like.

---

## Health endpoints

Two separate probes, because "the process is dead" and "the database is dead"
need different responses:

| Endpoint | Touches DB | Meaning |
|----------|-----------|---------|
| `GET /api/health` | No | Liveness. The process is up and serving. Use this as the platform health check so a database outage does not cause endless container restarts. |
| `GET /api/ready` | Yes | Readiness. `200` with `{"database":"up"}`, or `503` with the connection error when Postgres is unreachable. |

```bash
curl https://<your-api-host>/api/health   # {"ok":true,...}
curl https://<your-api-host>/api/ready    # {"ok":true,"database":"up",...}
```

---

## Troubleshooting

**The site loads a blank white page**

Check the API first — this is almost always a backend fault, not a frontend one:

```bash
curl -m 60 https://<your-api-host>/api/health
curl -m 60 https://<your-api-host>/api/ready
```

- `/api/health` **hangs with no response at all** → the container is not
  listening. The platform router accepts your TCP connection and then waits
  forever for an upstream that never answers. Check the Render logs for a crash
  loop at boot.
- `/api/health` is `200` but `/api/ready` is `503` → the process is fine and the
  database is unreachable. Read the `error` field: it names the host and port.
  The usual cause is an expired free database or a stale `DATABASE_URL`.

The frontend is built so neither case can blank the page: requests carry a 45 s
deadline so they always settle, public pages render without waiting on the API,
and signed-in pages show a "cannot reach the server" screen. If you *do* see a
blank page, the deployed bundle predates that fix — redeploy from `main`.

**API returns 500 on first request**
- Check Render logs → Dashboard → Logs tab
- Hit `/api/ready` first; a `503` there identifies it as a database problem in one step
- Most likely: `DATABASE_URL` is wrong, or the database was deleted

**Attachments fail to upload**

First check which storage driver is active — the API logs it on boot:

```
[storage] attachment driver: db
```

- `db` (the default): uploads need no external service. A failure here is a
  database problem, so check `/api/ready`. Files larger than 25 MB are
  rejected with `413`.
- `s3`: check the `S3_*` credentials in the Render environment, and verify the
  bucket's CORS policy allows `PUT` from your Vercel domain.

If uploads fail with a network error and the driver says `s3` when you never
configured a bucket, remove `STORAGE_DRIVER` so it falls back to `db`.

**CORS errors in browser console**
- Make sure `PUBLIC_APP_URL` in Render matches your Vercel URL exactly (no trailing slash)

**Slow first load**
- Normal on Render's free tier — server is waking up
- Subsequent requests are fast

---

## Next Steps

- **Custom domain:** Vercel supports free custom domains (add in project settings)
- **Email notifications:** Sign up for Resend (3k emails/mo free) and add SMTP credentials
- **AI classification:** Add `GEMINI_API_KEY` to Render (with `AI_PROVIDER=gemini`)
  for model-backed classification, triage and policy briefings. Without a key the
  API silently falls back to the deterministic heuristic classifier, so the
  deployment keeps working — but the AI features are not exercised.
- **Remove demo accounts:** Delete them from the Users page before going live

---

## Costs (if you outgrow free tier)

| Platform | Paid tier |
|----------|-----------|
| Vercel | $20/mo for Pro (only if you need more bandwidth) |
| Render | $7/mo for always-on server (no cold starts) |
| Neon | $19/mo for 10 GB storage |
| Cloudflare R2 | $0.015/GB after 10 GB |

**Total to start:** $0  
**Total if you scale:** ~$26/mo for a production-ready setup
