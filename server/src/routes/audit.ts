import { Hono } from 'hono';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { getUser } from '../auth/middleware';

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
});

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
  const { entity, entityId, actorId, action, from, to, page, pageSize, format } = parsed.data;

  const where: Prisma.AuditLogWhereInput = {};
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
