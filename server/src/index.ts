import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import auth from './routes/auth';
import complaints from './routes/complaints';
import notifications from './routes/notifications';
import auditRouter from './routes/audit';
import ai from './routes/ai';
import users from './routes/users';
import feedback from './routes/feedback';
import settings from './routes/settings';
import reports from './routes/reports';
import planning from './routes/planning';
import uploads from './routes/uploads';
import { sessionMiddleware } from './auth/middleware';
import { startSlaScheduler } from './services/sla';
import { storageDriver } from './services/storage';
import { prisma } from './db';

// shared types come from '@nivaran/shared' (see shared/src)

const app = new Hono();

app.use('*', logger());

// Liveness probe, mounted before every other middleware on purpose.
//
// This must answer using nothing but the event loop. If it needed the
// session middleware or the database, then "process is dead" and "database
// is dead" would look identical from outside, and a platform health check
// would keep recycling a perfectly healthy container because its database
// was unreachable. Readiness — can we actually serve data? — is a separate
// question, answered by /api/ready below.
app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }));

// CORS: allow the configured app URL, localhost for dev, and any Vercel
// deployment subdomain (preview + production URLs both end in .vercel.app).
const staticOrigins = process.env.PUBLIC_APP_URL
  ? [process.env.PUBLIC_APP_URL, 'http://localhost:5173', 'http://localhost:3000']
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return staticOrigins[0];
      if (staticOrigins.includes(origin)) return origin;
      // Accept any *.vercel.app origin so preview and production URLs work.
      if (origin.endsWith('.vercel.app')) return origin;
      return staticOrigins[0];
    },
    credentials: true,
  }),
);
// Raw attachment bytes. Mounted ahead of the session middleware because
// neither endpoint uses a session: the PUT carries its own signed token and
// the GET is public, matching the presigned-PUT / public-read pair it stands
// in for. Skipping the middleware also avoids a pointless user lookup on
// every image request a page makes.
app.route('/api/uploads', uploads);

app.use('*', sessionMiddleware);

/**
 * Readiness probe: confirms the process can actually reach its database.
 *
 * Returns 503 with the failure reason when the database is unreachable, so a
 * broken deployment is diagnosable with a single curl instead of guesswork
 * over why pages are empty. The error message is included deliberately —
 * connection errors name the host and port, never credentials.
 */
app.get('/api/ready', async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ ok: true, database: 'up', ts: Date.now() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, database: 'down', error: message, ts: Date.now() }, 503);
  }
});

app.route('/api/auth', auth);
app.route('/api/users', users);
app.route('/api/complaints', complaints);
app.route('/api/notifications', notifications);
app.route('/api/audit', auditRouter);
app.route('/api/ai', ai);
app.route('/api/feedback', feedback);
app.route('/api/settings', settings);
app.route('/api/reports', reports);
app.route('/api/planning', planning);

// Last-resort safety net. Node terminates on an unhandled rejection by
// default, so one stray background promise anywhere in the process can kill
// a server that is otherwise serving requests correctly. Logging and staying
// up is the right trade for an API: a degraded endpoint is recoverable, a
// dead container behind a proxy is an unexplained hang for every user.
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] uncaught exception:', err);
});

// Bind to 0.0.0.0 explicitly. Container platforms route to the published
// port from outside the container, so a loopback-only bind would accept
// nothing from the platform router.
const port = Number(process.env.PORT ?? 3001);
const hostname = process.env.HOST ?? '0.0.0.0';

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`[server] listening on ${hostname}:${info.port}`);
  console.log(`[storage] attachment driver: ${storageDriver}`);
  // Background SLA scheduler — runs every 5 minutes, escalates overdue complaints.
  startSlaScheduler();
});
