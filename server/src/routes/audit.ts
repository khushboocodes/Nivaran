import { Hono } from 'hono';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { getUser } from '../auth/middleware';
import { resolveDeptScope, type DeptScope } from '../services/scope';

const audit = new Hono();

const QuerySchema = z.object({
  entity: z.string().optional(),
  entityId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  /** ISO datetime, inclusive lower bound. */
  from: z.string().datetime().optional(),
  /** ISO datetime, exclusive upper bound. */
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  format: z.enum(['json', 'csv']).default('json'),
  /** Admin sidebar department scope. Absent or 'all' means every department. */
  dept: z.string().optional(),
});

/**
 * Department scope for the audit log, applied through the **actor**.
 *
 * A deliberate interpretation, because there are two defensible ones. An entry
 * records `entity` + `entityId` as bare strings with no relation, so scoping by
 * the affected complaint's department would need `entityId IN (...)` over every
 * complaint in that department — tens of thousands of ids, against an index
 * that only covers `(entity, entityId)` for equality. Not viable.
 *
 * Scoping by the actor's department answers "what did this department's staff
 * do", which is the question an audit trail is usually asked. Note that
 * automated actions are attributed to a system account with no department, so
 * they drop out of a scoped view — correct, since they are nobody's
 * departmental activity, but worth knowing when a scoped log looks quiet.
 */
function auditScopeWhere(scope: DeptScope): Prisma.AuditLogWhereInput {
  if (scope.impossible) return { actorId: '__no_results__' };
  if (!scope.departmentId) return {};
  return { actor: { departmentId: scope.departmentId } };
}

audit.get('/', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);
  if (user.role !== 'admin') {
    return c.json({ code: 'forbidden', message: 'Audit log is admin-only' }, 403);
  }

  const parsed = QuerySchema.safeParse(
    Object.fromEntries(new URL(c.req.url).searchParams),
  );
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }
  const { entity, entityId, actorId, action, from, to, page, pageSize, format, dept } =
    parsed.data;

  const where: Prisma.AuditLogWhereInput = auditScopeWhere(
    await resolveDeptScope(user, dept),
  );
  if (entity) where.entity = entity;
  if (entityId) where.entityId = entityId;
  if (actorId) where.actorId = actorId;
  if (action) where.action = action;
  if (from || to) {
    where.at = {};
    if (from) where.at.gte = new Date(from);
    if (to) where.at.lt = new Date(to);
  }

  if (format === 'csv') {
    // CSV export: cap at 10k rows to avoid blowing up memory, in
    // line with what an admin export realistically needs.
    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: { at: 'desc' },
      take: 10_000,
    });
    const header = ['id', 'at', 'actorId', 'action', 'entity', 'entityId'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.at.toISOString(),
          r.actorId,
          escapeCsv(r.action),
          escapeCsv(r.entity),
          r.entityId,
        ].join(','),
      );
    }
    const csv = lines.join('\n');
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="audit-${Date.now()}.csv"`);
    return c.body(csv);
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return c.json({
    items: items.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      before: r.before,
      after: r.after,
      at: r.at.toISOString(),
    })),
    page,
    pageSize,
    total,
  });
});

/** Quote a CSV cell when it contains a comma, double quote, or newline. */
function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export default audit;
