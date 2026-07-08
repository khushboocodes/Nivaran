# Setup Guide — Run Nivaran on a New Machine

## Prerequisites (install these first)

| Software | Version | Download |
|----------|---------|----------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) — pick the LTS version |
| Docker Desktop | Latest | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop) |
| Git | Latest | [git-scm.com](https://git-scm.com) |

That's it. No Python, no Java, no other tools needed.

---

## Step-by-step Setup

### 1. Extract the zip

Extract `Nivaran.zip` to any folder (e.g. `C:\Projects\Nivaran` or `~/Nivaran`).

Open a terminal and navigate to the extracted folder:

```bash
cd path/to/Nivaran
```

### 2. Start Docker Desktop

Open Docker Desktop from Start menu and wait until it shows "Engine running" (green icon).

### 3. Start Postgres and MinIO (database + file storage)

```bash
docker compose up -d
```

### 4. Install dependencies

```bash
npm install
npm --prefix shared install
npm --prefix server install
```

### 5. Set up environment variables

```bash
copy server\.env.example server\.env
```

(On Mac/Linux use `cp` instead of `copy`)

Then open `server\.env` and add your Gemini API key:
- Go to [aistudio.google.com](https://aistudio.google.com) → Get API Key → Create
- Paste it as `GEMINI_API_KEY=your_key_here`
- This enables AI complaint classification and the chat assistant (free, no credit card)

### 6. Generate Prisma client and run migrations

```bash
npm --prefix server run prisma:generate
npm --prefix server run prisma:migrate
```

### 7. Seed the database with demo accounts

```bash
npm --prefix server run db:seed
```

### 8. Start the app

```bash
npm run dev:all
```

### 9. Open in browser

- **Citizen portal:** http://localhost:5173/login
- **Admin console:** http://localhost:5173/admin/login

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Citizen | citizen@demo.nivaran.in | Citizen@2026 |
| Admin | admin@demo.nivaran.in | Admin@2026 |

---

## Stopping the app

- Press `Ctrl+C` in the terminal to stop the web + API servers
- Run `docker compose stop` to pause the database (data is preserved)
- Next time, just run `docker compose up -d` and `npm run dev:all` again

---

## Troubleshooting

**"docker compose" not recognized**
→ Docker Desktop is not installed or not running. Install from docker.com.

**Port 5432 already in use**
→ Another Postgres is running. Stop it or change the port in docker-compose.yml.

**npm install fails with Python/build errors**
→ The server uses argon2 which needs build tools. On Windows, run:
```bash
npm install -g windows-build-tools
```
Or install Visual Studio Build Tools from Microsoft.

**"prisma migrate" fails with connection error**
→ Docker containers aren't ready yet. Wait 10 seconds and try again.

---

## System Requirements

- **OS:** Windows 10/11, macOS 12+, or Linux
- **RAM:** 4 GB minimum (8 GB recommended)
- **Disk:** ~2 GB (for node_modules + Docker images)
- **Ports:** 3001, 5173, 5432, 9000, 9001 must be free
