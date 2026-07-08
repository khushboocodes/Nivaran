/**
 * Settings persistence.
 *
 * The whole settings document lives in a single row of the `settings`
 * table at key `app.settings`. We persist as one blob so partial writes
 * never leave us in a half-configured state, and so the SLA scheduler
 * can read everything in one query.
 *
 * For backwards compatibility with the per-leaf rows the email/sms
 * services check (`notifications.email`, `notifications.sms`), we mirror
 * those legacy keys on every save. New code should read through
 * `loadSettings()` instead.
 */

import { SettingsSchema, type Settings } from '@nivaran/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';

const SETTINGS_KEY = 'app.settings';

const DEFAULTS: Settings = SettingsSchema.parse({
  ai: { autoClassify: true, sentiment: true },
  escalation: { autoEscalateCritical: true, escalateAfterDays: 7 },
  notifications: { email: true, sms: false, publicDashboard: false },
  general: { maxComplaintsPerUser: 10, defaultDepartment: 'Municipal Corporation' },
});

export async function loadSettings(): Promise<Settings> {
  const row = await prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return DEFAULTS;
  const parsed = SettingsSchema.safeParse(row.value);
  // If a stored doc fails parse (e.g. an older shape), surface defaults
  // rather than crashing — this keeps the admin UI rendering.
  return parsed.success ? parsed.data : DEFAULTS;
}

export async function saveSettings(next: Settings): Promise<Settings> {
  await prisma.$transaction(async (tx) => {
    await tx.setting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value: next as Prisma.InputJsonValue },
      update: { value: next as Prisma.InputJsonValue },
    });
    // Mirror the legacy per-leaf keys so `email.ts` / `sms.ts` keep working
    // even if they're called before the cache warms up.
    await tx.setting.upsert({
      where: { key: 'notifications.email' },
      create: { key: 'notifications.email', value: next.notifications.email },
      update: { value: next.notifications.email },
    });
    await tx.setting.upsert({
      where: { key: 'notifications.sms' },
      create: { key: 'notifications.sms', value: next.notifications.sms },
      update: { value: next.notifications.sms },
    });
  });
  return next;
}
