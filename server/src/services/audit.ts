import type { Prisma } from '@prisma/client';
import { prisma } from '../db';

export type AuditEntity = 'complaint' | 'user' | 'notification' | 'feedback' | 'setting' | 'attachment';

export interface AuditEntry {
  actorId: string;
  action: string;
  entity: AuditEntity;
  entityId: string;
  /** Snapshot of the entity BEFORE the change. `null` for create. */
  before?: unknown;
  /** Snapshot of the entity AFTER the change. `null` for hard delete. */
  after?: unknown;
}

/**
 * Append a row to `audit_log`. Accepts an optional Prisma transaction
 * client so callers can write the audit row inside the same transaction
 * as the entity mutation. When no `tx` is supplied the standalone
 * `prisma` client is used.
 *
 * Failures are intentionally re-thrown — if the audit write can't
 * succeed, neither should the mutation. Pair this helper with a
 * `prisma.$transaction(...)` to keep the two atomic.
 */
export async function audit(
  entry: AuditEntry,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: (entry.before ?? null) as Prisma.InputJsonValue,
      after: (entry.after ?? null) as Prisma.InputJsonValue,
    },
  });
}
