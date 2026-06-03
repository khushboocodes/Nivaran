import { z } from 'zod';

export const AuditLogSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  before: z.unknown().optional().nullable(),
  after: z.unknown().optional().nullable(),
  at: z.string().datetime(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;
