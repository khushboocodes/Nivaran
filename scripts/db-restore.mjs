#!/usr/bin/env node
/**
 * Restore a dump produced by scripts/db-backup.mjs.
 *
 *   npm run db:restore -- backups/nivaran-<timestamp>.dump
 *
 * This OVERWRITES the current dev database, so it requires an explicit file
 * path and refuses to guess which dump you meant.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const CONTAINER = process.env.PG_CONTAINER ?? 'nivaran-postgres';
const DB_USER = process.env.PG_USER ?? 'nivaran';
const DB_NAME = process.env.PG_DB ?? 'nivaran';

const argPath = process.argv[2];
if (!argPath) {
  console.error('Usage: npm run db:restore -- <path-to-.dump>');
  process.exit(1);
}

const hostFile = resolve(process.cwd(), argPath);
if (!existsSync(hostFile) || statSync(hostFile).size === 0) {
  console.error(`[restore] missing or empty dump file: ${hostFile}`);
  process.exit(1);
}

function run(cmd, args, { allowFailure = false } = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (!allowFailure && result.status !== 0) {
    console.error(`[restore] ${cmd} ${args.join(' ')} exited with ${result.status}`);
    process.exit(result.status ?? 1);
  }
  return result.status ?? 1;
}

const running = spawnSync(
  'docker',
  ['inspect', '-f', '{{.State.Running}}', CONTAINER],
  { encoding: 'utf8' },
);
if (running.status !== 0 || running.stdout.trim() !== 'true') {
  console.error(
    `[restore] container "${CONTAINER}" is not running. Start it with: docker compose up -d`,
  );
  process.exit(1);
}

const inContainer = `/tmp/${basename(hostFile)}`;
run('docker', ['cp', hostFile, `${CONTAINER}:${inContainer}`]);

// --clean --if-exists drops existing objects first so the restore is not
// blocked by the schema Prisma already created. Ownership/ACL notices are
// normal here, so a non-zero pg_restore status is reported but not fatal.
const status = run(
  'docker',
  [
    'exec', CONTAINER,
    'pg_restore', '-U', DB_USER, '-d', DB_NAME,
    '--clean', '--if-exists', '--no-owner', '--no-privileges',
    inContainer,
  ],
  { allowFailure: true },
);
run('docker', ['exec', CONTAINER, 'rm', '-f', inContainer], { allowFailure: true });

if (status !== 0) {
  console.warn(
    '[restore] pg_restore reported warnings (usually harmless ownership/ACL notices). Verify your data below.',
  );
}
console.log('[restore] done. Verify with:');
console.log(
  `  docker exec ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME} -c "select count(*) from users;"`,
);
