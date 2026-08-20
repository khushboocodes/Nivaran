#!/usr/bin/env node
/**
 * Dump the dev Postgres database to ./backups/nivaran-<timestamp>.dump
 *
 * Why a Node script instead of a one-line npm script?
 * `docker exec ... pg_dump -Fc > file.dump` relies on the shell to redirect a
 * *binary* stream. That is fragile across cmd.exe / PowerShell / bash, and a
 * mangled dump only reveals itself at restore time. Here we dump to a path
 * inside the container and use `docker cp`, so no shell ever touches the bytes.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CONTAINER = process.env.PG_CONTAINER ?? 'nivaran-postgres';
const DB_USER = process.env.PG_USER ?? 'nivaran';
const DB_NAME = process.env.PG_DB ?? 'nivaran';
const BACKUP_DIR = join(process.cwd(), 'backups');

/** Run a command, echo it, and abort the script on a non-zero exit. */
function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.error) {
    console.error(`[backup] failed to launch ${cmd}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`[backup] ${cmd} ${args.join(' ')} exited with ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

// Fail early with a clear message if the database container is not up, rather
// than emitting a 0-byte dump that looks like a success.
const running = spawnSync(
  'docker',
  ['inspect', '-f', '{{.State.Running}}', CONTAINER],
  { encoding: 'utf8' },
);
if (running.status !== 0 || running.stdout.trim() !== 'true') {
  console.error(
    `[backup] container "${CONTAINER}" is not running. Start it with: docker compose up -d`,
  );
  process.exit(1);
}

// Colons are illegal in Windows filenames, so use a filesystem-safe stamp.
const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
const fileName = `nivaran-${stamp}.dump`;
const inContainer = `/tmp/${fileName}`;
const onHost = join(BACKUP_DIR, fileName);

mkdirSync(BACKUP_DIR, { recursive: true });

// -Fc is Postgres' compressed custom format: smaller than plain SQL and
// restorable selectively via pg_restore.
run('docker', ['exec', CONTAINER, 'pg_dump', '-U', DB_USER, '-d', DB_NAME, '-Fc', '-f', inContainer]);
run('docker', ['cp', `${CONTAINER}:${inContainer}`, onHost]);
run('docker', ['exec', CONTAINER, 'rm', '-f', inContainer]);

const { size } = statSync(onHost);
if (size === 0) {
  console.error(`[backup] wrote a 0-byte file, treating as failure: ${onHost}`);
  process.exit(1);
}
console.log(`[backup] ${onHost} (${(size / 1024).toFixed(1)} KB)`);
console.log('[backup] restore with: npm run db:restore -- backups/' + fileName);
