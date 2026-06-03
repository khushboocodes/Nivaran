/**
 * Settings endpoints.
 *
 *   GET  /api/settings  → current Settings object (admin only)
 *   PUT  /api/settings  → replace Settings (admin only)
 *
 * Officers/citizens are forbidden to keep the settings surface a true
 * admin tool. Every save records an audit row with before/after.
 */

import { Hono } from 'hono';
import { SettingsSchema } from '@nivaran/shared';
import { getUser } from '../auth/middleware';
import { audit } from '../services/audit';
import { loadSettings, saveSettings } from '../services/settings';

const settings = new Hono();

settings.get('/', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);
  if (user.role !== 'admin') return c.json({ code: 'forbidden' }, 403);
  return c.json(await loadSettings());
});

settings.put('/', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);
  if (user.role !== 'admin') return c.json({ code: 'forbidden' }, 403);

  const body = await c.req.json().catch(() => null);
  const parsed = SettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }

  const before = await loadSettings();
  const next = await saveSettings(parsed.data);
  await audit({
    actorId: user.id,
    action: 'settings.update',
    entity: 'setting',
    entityId: 'app.settings',
    before,
    after: next,
  });
  return c.json(next);
});

export default settings;
