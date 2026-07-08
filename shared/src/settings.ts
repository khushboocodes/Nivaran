import { z } from 'zod';

/**
 * Canonical shape for the application settings document. Stored in the DB
 * as one row per key but exposed to the admin UI as a single object.
 */
export const SettingsSchema = z.object({
  ai: z.object({
    autoClassify: z.boolean().default(true),
    sentiment: z.boolean().default(true),
  }),
  escalation: z.object({
    autoEscalateCritical: z.boolean().default(true),
    escalateAfterDays: z.number().int().positive().max(365).default(7),
  }),
  notifications: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
    publicDashboard: z.boolean().default(false),
  }),
  general: z.object({
    maxComplaintsPerUser: z.number().int().positive().default(10),
    defaultDepartment: z.string().default('Municipal Corporation'),
  }),
});
export type Settings = z.infer<typeof SettingsSchema>;
