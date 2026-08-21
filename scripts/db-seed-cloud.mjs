#!/usr/bin/env node
/**
 * Load a local dump into a *remote* Postgres (Neon, Render, Supabase, RDS).
 *
 *   npm run db:seed-cloud -- backups/nivaran-<timestamp>.dump "postgresql://user:pass@host/db?sslmode=require"
 *
 * Why this exists: `db:restore` targets the Docker dev database by name, so it
 * cannot seed a managed instance. A deployed demo with an empty database looks
 * broken in a way that is indistinguishable from a bug, so getting the real
 * corpus into the cloud needs to be one command rather than a manual
 * pg_restore incantation.
 *
 * `pg_restore` runs *inside* the existing Postgres container. That deliberately
 * avoids requiring a matching Postgres client on the host: version skew
 * between a host `pg_restore` and the server that produced the dump is a
 * classic source of confusing partial restores.
 *
 * The connection string is passed via the environment, never as an argv entry
 * on the container command line, so it does not show up in `docker inspect` or
 * in a process list.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const CONTAINER = process.env.PG_CONTAINER ?? 'nivaran-postgres';

const [dumpArg, urlArg] = process.argv.slice(2);
const targetUrl = urlArg ?? process.env.TARGET_DATABASE_URL;

if (!dumpArg || !targetUrl) {
  console.error(
    'Usage: npm run db:seed-cloud -- <path-to-.dump> "<target DATABASE_URL>"\n' +
      '       (or set TARGET_DATABASE_URL and pass only the dump path)',
  );
  process.exit(1);
}

if (!/^postgres(ql)?:\/\//i.test(targetUrl)) {
  console.error('[seed-cloud] target must be a postgresql:// connection string');
  process.exit(1);
}

// Refuse to point this at the local dev database. The whole purpose is to push
// *out* to a managed instance, and a mistyped target that happens to be
// localhost would wipe the working dataset via --clean.
if (/@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/i.test(targetUrl)) {
  console.error(
    '[seed-cloud] refusing to run against a local target. Use `npm run db:restore` for the dev database.',
  );
  process.exit(1);
}

const hostFile = resolve(process.cwd(), dumpArg);
if (!existsSync(hostFile) || statSync(hostFile).size === 0) {
  console.error(`[seed-cloud] missing or empty dump file: ${hostFile}`);
  process.exit(1);
}

/** Redact credentials before anything reaches the console. */
function safe(url) {
  return url.replace(/\/\/[^@/]*@/, '//***:***@');
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.error) {
    console.error(`[seed-cloud] failed to launch ${cmd}: ${result.error.message}`);
    process.exit(1);
  }
  if (!opts.allowFailure && result.status !== 0) {
    console.error(`[seed-cloud] ${cmd} exited with ${result.status}`);
    process.exit(result.status ?? 1);
  }
  return result.status ?? 1;
}

const running = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', CONTAINER], {
  encoding: 'utf8',
});
if (running.status !== 0 || running.stdout.trim() !== 'true') {
  console.error(
    `[seed-cloud] container "${CONTAINER}" is not running (it supplies pg_restore). Start it with: docker compose up -d`,
  );
  process.exit(1);
}

console.log(`[seed-cloud] target: ${safe(targetUrl)}`);
console.log(`[seed-cloud] dump:   ${hostFile} (${(statSync(hostFile).size / 1024).toFixed(1)} KB)`);

const inContainer = `/tmp/${basename(hostFile)}`;
run('docker', ['cp', hostFile, `${CONTAINER}:${inContainer}`]);

// --clean --if-exists drops conflicting objects first, so this also works when
// `prisma migrate deploy` has already created the schema on the target.
// --no-owner/--no-privileges because managed providers own the role, not us.
// Ownership and ACL notices are expected, so a non-zero status is reported
// rather than treated as fatal.
const status = run(
  'docker',
  [
    'exec',
    '-e',
    'PGCONNECT_TIMEOUT=30',
    '-e',
    // Consumed by pg_restore's --dbname=$TARGET below without appearing in argv.
    `TARGET=${targetUrl}`,
    CONTAINER,
    'sh',
    '-c',
    `pg_restore --dbname="$TARGET" --clean --if-exists --no-owner --no-privileges --verbose ${inContainer}`,
  ],
  { allowFailure: true },
);

run('docker', ['exec', CONTAINER, 'rm', '-f', inContainer], { allowFailure: true });

if (status !== 0) {
  console.warn(
    '[seed-cloud] pg_restore reported warnings (usually harmless ownership/ACL notices). Verify the counts below.',
  );
}

console.log('[seed-cloud] done. Verify with:');
console.log('  curl https://<your-api-host>/api/ready');
console.log('  curl https://<your-api-host>/api/health');
