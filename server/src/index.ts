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
import { sessionMiddleware } from './auth/middleware';
import { startSlaScheduler } from './services/sla';

// shared types come from '@nivaran/shared' (see shared/src)

const app = new Hono();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '',
    credentials: true,
  }),
);
app.use('*', sessionMiddleware);

app.get('/api/health', (c) => c.json({ ok: true, ts: Date.now() }));
app.route('/api/auth', auth);
app.route('/api/users', users);
app.route('/api/complaints', complaints);
app.route('/api/notifications', notifications);
app.route('/api/audit', auditRouter);
app.route('/api/ai', ai);
app.route('/api/feedback', feedback);
app.route('/api/settings', settings);
app.route('/api/reports', reports);

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[server] listening on http://localhost:${info.port}`);
  // Background SLA scheduler — runs every 5 minutes, escalates overdue complaints.
  startSlaScheduler();
});
