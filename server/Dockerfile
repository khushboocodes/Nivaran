# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Multi-stage build for the Nivaran API server.
#
# The repo is a multi-workspace project: server depends on shared. We copy
# both into the build stage, generate the Prisma client, compile TS to JS,
# and ship the JS plus the production-only node_modules in a slim runtime.
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

# Generate the Prisma client against the bundled engine before compiling.
RUN cd server && npx prisma generate \
    && npx tsc -p tsconfig.json

# --- 3. runtime ----------------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

# OpenSSL is used by the Prisma engine at runtime; install it explicitly.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3001

# Copy compiled output, the generated Prisma client, the migrations folder
# (so `prisma migrate deploy` works), and only the production server deps.
COPY --from=build /repo/server/dist ./dist
COPY --from=build /repo/server/node_modules ./node_modules
COPY --from=build /repo/server/prisma ./prisma
COPY --from=build /repo/server/package.json ./package.json

EXPOSE 3001

# `prisma migrate deploy` runs every boot — idempotent and safe; it's a
# no-op when the schema is current.
CMD sh -c "npx prisma migrate deploy && node --enable-source-maps dist/server/src/index.js"
