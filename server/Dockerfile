# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Multi-stage build for the Nivaran API server.
#
# The repo is a multi-workspace project: server depends on shared. We copy
# both into the build stage, generate the Prisma client, bundle the server
# (and the shared package) into one JS file, and ship that bundle plus
# node_modules in a slim runtime.
#
# Build context: the repository root (so `shared/` is reachable).
# Build:  docker build -f server/Dockerfile -t nivaran-server .
# Run:    docker run --env-file server/.env -p 3001:3001 nivaran-server
# ---------------------------------------------------------------------------

# --- 1. deps -------------------------------------------------------------
FROM node:20-bookworm-slim AS deps
WORKDIR /repo

# Argon2 needs a C toolchain and Python at install time.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

# Bring just the workspace manifests in first so cached layers win on
# code-only edits.
COPY shared/package.json shared/package-lock.json* ./shared/
COPY server/package.json server/package-lock.json* ./server/

RUN cd shared && npm install --no-audit --no-fund \
    && cd ../server && npm install --no-audit --no-fund

# --- 2. build ------------------------------------------------------------
FROM deps AS build
WORKDIR /repo

COPY shared ./shared
COPY server ./server

# Generate the Prisma client against the bundled engine, then bundle the
# server into a single JS file with esbuild. See server/esbuild.config.mjs for
# why esbuild and not tsc: the tsc output was not runnable by Node.
RUN cd server && npx prisma generate \
    && npm run build

# --- 3. runtime ----------------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# OpenSSL is used by the Prisma engine at runtime; install it explicitly.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3001

# The self-contained bundle, the node_modules holding the external runtime
# deps and the generated Prisma client, the migrations folder (so
# `prisma migrate deploy` works), and the manifest.
#
# The TypeScript sources are deliberately NOT copied: nothing at runtime reads
# them any more. `@nivaran/shared` is inlined into the bundle, and the copy
# under node_modules is kept only so an ad-hoc maintenance script
# (`npx tsx prisma/seed-staff.ts`) can still resolve the alias inside the
# container.
COPY --from=build /repo/server/dist ./dist
COPY --from=build /repo/server/node_modules ./node_modules
COPY --from=build /repo/server/prisma ./prisma
COPY --from=build /repo/server/package.json ./package.json
COPY --from=build /repo/shared ./node_modules/@nivaran/shared

EXPOSE 3001

# Migrations run on boot, but a migration failure must NOT stop the server
# from listening. With `&&`, an unreachable or expired database meant the
# process exited before binding the port — the platform's router then had no
# upstream and held every incoming request open without ever writing a
# response, so the API looked hung rather than broken and the browser sat on
# a blank page. Starting regardless turns that silent hang into an
# HTTP-level failure that `/api/health` and `/api/ready` can explain.
#
# The migration step calls the CLI binary directly rather than through `npx`,
# which would re-resolve the package on every boot, and the server starts from
# the prebuilt bundle rather than transpiling TypeScript at startup. Both sit
# on the critical path of a cold start, which on a free instance that spins
# down after 15 minutes idle is latency paid by the next visitor.
CMD sh -c "./node_modules/.bin/prisma migrate deploy || echo '[boot] prisma migrate deploy FAILED — starting the server anyway so /api/health and /api/ready can report the fault'; exec node --enable-source-maps dist/server.js"
