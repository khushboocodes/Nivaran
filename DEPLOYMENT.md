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

## Step 2: Cloudflare R2 (File Storage)

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

## Free Tier Limits

| Platform | Limit | Notes |
|----------|-------|-------|
| Vercel | 100 GB bandwidth/mo | Plenty for a demo |
| Render | Server sleeps after 15 min | 750 free hours/mo |
| Neon | 0.5 GB storage | ~50k complaints |
| Cloudflare R2 | 10 GB storage | ~500 images |

---

## Troubleshooting

**API returns 500 on first request**
- Check Render logs → Dashboard → Logs tab
- Most likely: DATABASE_URL is wrong or Prisma migration failed

**Attachments fail to upload**
- Check R2 credentials in Render environment
- Verify bucket CORS settings allow PUT from your Vercel domain

**CORS errors in browser console**
- Make sure `PUBLIC_APP_URL` in Render matches your Vercel URL exactly (no trailing slash)

**Slow first load**
- Normal on Render's free tier — server is waking up
- Subsequent requests are fast

---

## Next Steps

- **Custom domain:** Vercel supports free custom domains (add in project settings)
- **Email notifications:** Sign up for Resend (3k emails/mo free) and add SMTP credentials
- **AI classification:** Add `OPENAI_API_KEY` to Render for smarter complaint routing
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
