import { Hono } from 'hono';
import { z } from 'zod';
import { FeedbackCreateSchema } from '@nivaran/shared';
import { prisma } from '../db';
import { getUser } from '../auth/middleware';
import { audit } from '../services/audit';

const feedback = new Hono();

const ListQuery = z.object({
  complaintId: z.string().optional(),
});

feedback.get('/', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const parsed = ListQuery.safeParse(
    Object.fromEntries(new URL(c.req.url).searchParams),
  );
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }

  // Citizens only see their own feedback. Officers/admins see everything;
  // we surface this for the admin Feedback page.
  const where: Record<string, unknown> = {};
  if (user.role === 'citizen') where.citizenId = user.id;
  if (parsed.data.complaintId) where.complaintId = parsed.data.complaintId;

  const items = await prisma.feedback.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { complaint: { select: { id: true, title: true, category: true } } },
  });

  return c.json({
    items: items.map((f) => ({
      id: f.id,
      complaintId: f.complaintId,
      citizenId: f.citizenId,
      rating: f.rating,
      comment: f.comment,
      createdAt: f.createdAt.toISOString(),
      complaint: f.complaint,
    })),
  });
});

/**
 * Admin/officer-only aggregate stats for the Feedback Analytics page.
 * Returns the small, denormalized payload the admin UI needs:
 *   - average rating across all submitted feedback
 *   - total responses
 *   - satisfaction rate (% rating >= 4)
 *   - star distribution (1..5)
 *   - average rating per complaint category
 *   - the 10 most recent feedback rows with complaint title + category
 *
 * All numbers come from a single transaction so the page is consistent.
 */
feedback.get('/stats', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);
  if (user.role === 'citizen') return c.json({ code: 'forbidden' }, 403);

  const [agg, distRows, all, recent] = await prisma.$transaction([
    prisma.feedback.aggregate({
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.feedback.groupBy({
      by: ['rating'],
      _count: { _all: true },
      orderBy: { rating: 'asc' },
    }),
    prisma.feedback.findMany({
      select: {
        rating: true,
        complaint: { select: { category: true } },
      },
    }),
    prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        complaint: { select: { id: true, title: true, category: true } },
        citizen: { select: { name: true } },
      },
    }),
  ]);

  const total = agg._count._all;
  const average = agg._avg.rating ?? 0;

  // Star distribution: ensure every bucket from 1..5 is represented even
  // when the table has none of that rating yet, so the chart never reflows.
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of distRows) {
    const r = row.rating as 1 | 2 | 3 | 4 | 5;
    const count = (row._count as { _all: number } | undefined)?._all ?? 0;
    distribution[r] = count;
  }

  // Satisfaction rate = share of ratings that are 4 or 5.
  const satisfied = (distribution[4] ?? 0) + (distribution[5] ?? 0);
  const satisfactionRate = total > 0 ? satisfied / total : 0;

  // Per-category averages, computed in app code so we can join to the
  // complaint category in the same query (Prisma can't groupBy across a
  // relation today).
  const sums = new Map<string, { sum: number; n: number }>();
  for (const row of all) {
    const cat = row.complaint?.category ?? 'Other';
    const cur = sums.get(cat) ?? { sum: 0, n: 0 };
    cur.sum += row.rating;
    cur.n += 1;
    sums.set(cat, cur);
  }
  const byCategory = Array.from(sums.entries())
    .map(([category, { sum, n }]) => ({ category, average: sum / n, count: n }))
    .sort((a, b) => b.count - a.count);

  return c.json({
    average,
    total,
    satisfactionRate,
    distribution,
    byCategory,
    recent: recent.map((f) => ({
      id: f.id,
      complaintId: f.complaintId,
      rating: f.rating,
      comment: f.comment,
      createdAt: f.createdAt.toISOString(),
      citizenName: f.citizen?.name ?? null,
      complaint: f.complaint,
    })),
  });
});

feedback.post('/', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = FeedbackCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }
  const { complaintId, rating, comment } = parsed.data;

  // Authorization: only the citizen who filed the complaint may rate it,
  // and only when it has been resolved.
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) return c.json({ code: 'not_found' }, 404);
  if (complaint.citizenId !== user.id) return c.json({ code: 'forbidden' }, 403);
  if (complaint.status !== 'Resolved') {
    return c.json(
      { code: 'not_resolved', message: 'Feedback is only accepted on resolved complaints' },
      409,
    );
  }

  const existing = await prisma.feedback.findUnique({ where: { complaintId } });
  if (existing) {
    return c.json(
      { code: 'already_submitted', message: 'You have already rated this complaint' },
      409,
    );
  }

  const created = await prisma.feedback.create({
    data: {
      complaintId,
      citizenId: user.id,
      rating,
      comment,
    },
  });
  await audit({
    actorId: user.id,
    action: 'feedback.create',
    entity: 'feedback',
    entityId: created.id,
    after: {
      id: created.id,
      complaintId: created.complaintId,
      rating: created.rating,
      comment: created.comment,
    },
  });

  return c.json(
    {
      id: created.id,
      complaintId: created.complaintId,
      citizenId: created.citizenId,
      rating: created.rating,
      comment: created.comment,
      createdAt: created.createdAt.toISOString(),
    },
    201,
  );
});

export default feedback;
