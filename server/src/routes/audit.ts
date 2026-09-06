import { Hono } from 'hono';
import { z } from 'zod';
// Value import, not `import type`: Prisma.sql / Prisma.join are used below to
// build a parameterised raw query.
import { Prisma } from '@prisma/client';
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
 * Audit ids belonging to one department, resolved in SQL.
 *
 * An entry stores `entity` + `entityId` as bare strings with no relation, so
 * Prisma cannot express "audit rows whose complaint is in this department".
 * The alternatives were both worse: `entityId IN (...)` would inline tens of
 * thousands of complaint ids, and scoping by the *actor's* department returns
 * nothing at all here, because no staff account in this deployment has a
 * department assigned — a filter that is technically correct and practically
 * useless.
 *
 * So the join is done in SQL and only the matching ids for the requested page
 * come back. Prisma then fetches those rows normally, which keeps one
 * serialisation path instead of two. The join is cheap: it hits the complaints
 * primary key.
 *
 * Scoping necessarily restricts the log to complaint-related entries, since
 * nothing else carries a department.
 */
async function auditIdsForDepartment(
  departmentId: string,
  filters: { action?: string; from?: Date; to?: Date },
  skip: number,
  take: number,
): Promise<{ ids: string[]; total: number }> {
  const conds: Prisma.Sql[] = [
    Prisma.sql`a.entity = 'Complaint'`,
    Prisma.sql`c.department_id = ${departmentId}`,
  ];
  if (filters.action) conds.push(Prisma.sql`a.action = ${filters.action}`);
  if (filters.from) conds.push(Prisma.sql`a.at >= ${filters.from}`);
  if (filters.to) conds.push(Prisma.sql`a.at < ${filters.to}`);
  const whereSql = Prisma.join(conds, ' AND ');

  const [rows, counted] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT a.id
        FROM audit_log a
        JOIN complaints c ON c.id = a.entity_id
        WHERE ${whereSql}
        ORDER BY a.at DESC
        LIMIT ${take} OFFSET ${skip}
      `,
    ),
    prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM audit_log a
        JOIN complaints c ON c.id = a.entity_id
        WHERE ${whereSql}
      `,
    ),
  ]);

  return { ids: rows.map((r) => r.id), total: Number(counted[0]?.count ?? 0) };
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

  const scope = await resolveDeptScope(user, dept);

  const where: Prisma.AuditLogWhereInput = {};
  // An officer with no department sees nothing, rather than everything.
  if (scope.impossible) where.id = '__no_results__';
  if (scope.departmentId) {
    const { ids } = await auditIdsForDepartment(
      scope.departmentId,
      { action: action || undefined, from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined },
      // The CSV branch below wants everything, the JSON branch one page. Resolve
      // generously here and let each branch slice; capped so a huge department
      // cannot produce an unbounded id list.
      0,
      format === 'csv' ? 10_000 : page * pageSize,
    );
    where.id = { in: ids.slice(format === 'csv' ? 0 : (page - 1) * pageSize) };
  }
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
