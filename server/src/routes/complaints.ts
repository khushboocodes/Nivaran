import { Hono } from 'hono';
import { Prisma } from '@prisma/client';
import {
  ComplaintCreateSchema,
  ComplaintUpdateSchema,
  ComplaintListQuerySchema,
  ComplaintAssignSchema,
} from '@nivaran/shared';
import { prisma } from '../db';
import { getUser } from '../auth/middleware';
import { resolveDepartmentByCategory } from '../services/departments';
import { audit } from '../services/audit';
import {
  priorityFromWire,
  serializeComplaint,
  statusFromWire,
  statusToWire,
} from '../serializers/complaint';
import { centroidFor } from '../services/planning/state-centroids';
import { loadSettings } from '../services/settings';
import { resolveDistrict } from '../services/districts';
import { sendComplaintEvent } from '../services/email';
import { sendSms } from '../services/sms';
import attachments from './attachments';

const complaints = new Hono();

// Mount the attachments sub-router. Hono passes the parameterised path
// through, so the routes resolve at /api/complaints/:id/attachments[/...].
complaints.route('/:id/attachments', attachments);

type SessionUser = { id: string; role: 'citizen' | 'officer' | 'admin' };

/**
 * Build the WHERE clause that scopes the visible complaint set to the
 * caller's authority:
 *  - citizens see only their own complaints
 *  - officers see only complaints in their department
 *  - admins see everything
 */
async function scopedWhere(user: SessionUser): Promise<Prisma.ComplaintWhereInput> {
  if (user.role === 'admin') return {};
  if (user.role === 'officer') {
    const officer = await prisma.user.findUnique({
      where: { id: user.id },
      select: { departmentId: true },
    });
    if (!officer?.departmentId) {
      // An officer without a department sees nothing. This is a safer
      // default than seeing everything.
      return { id: '__no_results__' };
    }
    return { departmentId: officer.departmentId };
  }
  return { citizenId: user.id };
}

type ComplaintWithDept = Prisma.ComplaintGetPayload<{
  include: { department: { select: { name: true } } };
}>;

/**
 * Fire-and-forget email dispatch for a complaint event. Looks up the
 * citizen's email and sends an event email — failures are swallowed by
 * the email service so they can never break the API request.
 */
async function emitComplaintEmail(
  complaint: ComplaintWithDept,
  type: 'submitted' | 'status_updated' | 'assigned' | 'resolved' | 'escalated',
  message: string,
): Promise<void> {
  const citizen = await prisma.user.findUnique({
    where: { id: complaint.citizenId },
    select: { email: true, name: true },
  });
  if (!citizen) return;
  await sendComplaintEvent({
    to: citizen.email,
    name: citizen.name,
    type,
    complaintId: complaint.id,
    title: complaint.title,
    message,
  });
}

/**
 * SMS sibling of {@link emitComplaintEmail}. Only called for critical /
 * escalated events to keep the SMS volume (and any future cost) bounded.
 */
async function emitComplaintSms(
  complaint: ComplaintWithDept,
  category: 'critical' | 'escalated',
  body: string,
): Promise<void> {
  const citizen = await prisma.user.findUnique({
    where: { id: complaint.citizenId },
    select: { phone: true },
  });
  if (!citizen?.phone) return;
  await sendSms({ to: citizen.phone, body, category });
}

type AuthorizedComplaintResult =
  | { complaint: ComplaintWithDept; code: 'ok' }
  | { complaint: null; code: 'not_found' }
  | { complaint: null; code: 'forbidden' };

async function loadAuthorizedComplaint(
  user: SessionUser,
  id: string,
): Promise<AuthorizedComplaintResult> {
  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: { department: { select: { name: true } } },
  });
  if (!complaint) return { complaint: null, code: 'not_found' };
  if (user.role === 'admin') return { complaint, code: 'ok' };
  if (user.role === 'citizen' && complaint.citizenId !== user.id) {
    return { complaint: null, code: 'forbidden' };
  }
  if (user.role === 'officer') {
    const officer = await prisma.user.findUnique({
      where: { id: user.id },
      select: { departmentId: true },
    });
    if (!officer?.departmentId || complaint.departmentId !== officer.departmentId) {
      return { complaint: null, code: 'forbidden' };
    }
  }
  return { complaint, code: 'ok' };
}

complaints.get('/', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const parsed = ComplaintListQuerySchema.safeParse(
    Object.fromEntries(new URL(c.req.url).searchParams),
  );
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }
  const { status, priority, q, dept, overdue, openOnly, page, pageSize } = parsed.data;

  const baseWhere = await scopedWhere(user);
  const filters: Prisma.ComplaintWhereInput = { ...baseWhere };

  if (status) filters.status = statusFromWire(status);
  if (priority) filters.priority = priorityFromWire(priority);
  if (dept) filters.departmentId = dept;
  if (openOnly) filters.status = { not: 'Resolved' };
  if (overdue) {
    // Read the same threshold the SLA scheduler uses, so "overdue" means one
    // thing across the system rather than being hardcoded per screen.
    const settings = await loadSettings();
    const days = settings.escalation.escalateAfterDays;
    filters.submittedAt = { lt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    filters.status = { not: 'Resolved' };
  }
  if (q && q.trim()) {
    filters.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { id: { equals: q } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.complaint.findMany({
      where: filters,
      orderBy: { submittedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { department: { select: { name: true } } },
    }),
    prisma.complaint.count({ where: filters }),
  ]);

  return c.json({
    items: items.map(serializeComplaint),
    page,
    pageSize,
    total,
  });
});

/**
 * Aggregate statistics over the caller's whole visible dataset.
 *
 *   GET /api/complaints/stats?dept=<id>&days=14
 *
 * WHY THIS EXISTS
 * ---------------
 * The dashboards used to derive their tiles and charts from the complaint list
 * already in the client cache. That list is a single page — 25 rows by default —
 * so an admin looking at ~150,000 complaints saw "Total: 25". The numbers were
 * arithmetically correct for the data in the cache and completely wrong about the
 * system.
 *
 * Counting happens in Postgres, where it belongs. The client renders what it is
 * given and no longer computes totals from a page it happens to hold.
 *
 * Registered before `GET /:id` on purpose: Hono matches in order, so a later
 * registration would let `:id` swallow "stats".
 */
complaints.get('/stats', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const url = new URL(c.req.url);
  const deptParam = url.searchParams.get('dept') ?? undefined;
  const daysRaw = Number(url.searchParams.get('days'));
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(Math.round(daysRaw), 365) : 14;

  // Resolve visibility once, as plain values, so the same scope drives both the
  // Prisma aggregates and the raw daily-series query.
  let citizenId: string | undefined;
  let departmentId: string | undefined = deptParam;
  let impossible = false;

  if (user.role === 'citizen') {
    citizenId = user.id;
  } else if (user.role === 'officer') {
    const officer = await prisma.user.findUnique({
      where: { id: user.id },
      select: { departmentId: true },
    });
    if (!officer?.departmentId) {
      // An officer with no department sees nothing, matching scopedWhere.
      impossible = true;
    } else {
      // An officer cannot widen their own scope via ?dept=.
      departmentId = officer.departmentId;
    }
  }

  if (impossible) {
    return c.json({
      total: 0,
      pending: 0,
      resolved: 0,
      escalated: 0,
      byStatus: {},
      byCategory: {},
      byPriority: {},
      daily: [],
      aiConfidence: { average: null, classified: 0 },
      dataset: { real: 0, modelled: 0 },
      windowDays: days,
    });
  }

  const where: Prisma.ComplaintWhereInput = {
    ...(citizenId ? { citizenId } : {}),
    ...(departmentId ? { departmentId } : {}),
  };

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [
    total,
    resolved,
    pending,
    escalated,
    byStatusRows,
    byCategoryRows,
    byPriorityRows,
    bySentimentRows,
    criticalByCategoryRows,
    confidence,
    modelled,
    criticalOpen,
    overdueCount,
  ] = await Promise.all([
    prisma.complaint.count({ where }),
    prisma.complaint.count({ where: { ...where, status: 'Resolved' } }),
    prisma.complaint.count({ where: { ...where, status: { in: ['Submitted', 'UnderReview'] } } }),
    prisma.complaint.count({ where: { ...where, priority: 'Critical' } }),
    prisma.complaint.groupBy({ by: ['status'], where, _count: { _all: true }, orderBy: { status: 'asc' } }),
    prisma.complaint.groupBy({ by: ['category'], where, _count: { _all: true }, orderBy: { category: 'asc' } }),
    prisma.complaint.groupBy({ by: ['priority'], where, _count: { _all: true }, orderBy: { priority: 'asc' } }),
    prisma.complaint.groupBy({ by: ['sentiment'], where, _count: { _all: true }, orderBy: { sentiment: 'asc' } }),
    // Critical count per category, so urgency can be expressed as a share of
    // each category's own volume rather than of the national total.
    prisma.complaint.groupBy({
      by: ['category'],
      where: { ...where, priority: 'Critical' },
      _count: { _all: true },
      orderBy: { category: 'asc' },
    }),
    // Average only over rows a classifier actually scored. Modelled demand rows
    // carry 0 by design, and including them would drag the figure toward zero
    // and misreport classifier accuracy.
    prisma.complaint.aggregate({
      where: { ...where, aiConfidence: { gt: 0 } },
      _avg: { aiConfidence: true },
      _count: { _all: true },
    }),
    prisma.complaint.count({ where: { ...where, isSynthetic: true } }),
    // Critical and still open — what the Escalation Center means by "escalated".
    // Distinct from the plain Critical count, which includes resolved cases.
    prisma.complaint.count({
      where: { ...where, priority: 'Critical', status: { not: 'Resolved' } },
    }),
    // Unresolved past the SLA threshold, read from the same setting the scheduler
    // uses so the two can never disagree.
    loadSettings().then((settings) =>
      prisma.complaint.count({
        where: {
          ...where,
          status: { not: 'Resolved' },
          submittedAt: {
            lt: new Date(Date.now() - settings.escalation.escalateAfterDays * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ),
  ]);

  // Daily volume. Raw SQL because date_trunc has no Prisma equivalent and
  // grouping by a raw timestamp would produce one bucket per complaint.
  // Conditions are assembled as parameterised fragments, never string-concatenated.
  const conds: Prisma.Sql[] = [Prisma.sql`submitted_at >= ${cutoff}`];
  if (citizenId) conds.push(Prisma.sql`citizen_id = ${citizenId}`);
  if (departmentId) conds.push(Prisma.sql`department_id = ${departmentId}`);

  const dailyRows = await prisma.$queryRaw<{ day: Date; n: bigint }[]>(
    Prisma.sql`
      SELECT date_trunc('day', submitted_at) AS day, count(*) AS n
      FROM complaints
      WHERE ${Prisma.join(conds, ' AND ')}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  );

  /** Fold groupBy output into a plain record, converting Prisma enums to wire form. */
  const fold = <K extends string>(
    rows: { _count: { _all: number } }[],
    key: (row: never) => K,
  ): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const row of rows) out[key(row as never)] = row._count._all;
    return out;
  };

  return c.json({
    total,
    pending,
    resolved,
    /** All Critical, including resolved ones. */
    escalated,
    /** Critical and still open — the Escalation Center's headline figure. */
    criticalOpen,
    /** Unresolved past the configured SLA threshold. */
    overdue: overdueCount,
    resolutionRate: total > 0 ? resolved / total : 0,
    byStatus: fold(byStatusRows, (r: { status: Prisma.ComplaintGroupByOutputType['status'] }) =>
      statusToWire(r.status),
    ),
    byCategory: fold(byCategoryRows, (r: { category: string }) => r.category),
    byPriority: fold(byPriorityRows, (r: { priority: string }) => String(r.priority)),
    // Prisma's identifier is HighlyNegative; the wire and UI use the spaced form.
    bySentiment: fold(bySentimentRows, (r: { sentiment: string }) =>
      String(r.sentiment) === 'HighlyNegative' ? 'Highly Negative' : String(r.sentiment),
    ),
    criticalByCategory: fold(criticalByCategoryRows, (r: { category: string }) => r.category),
    // Postgres count() is bigint; JSON cannot carry BigInt, so narrow to number.
    daily: dailyRows.map((r) => ({
      date: r.day instanceof Date ? r.day.toISOString() : String(r.day),
      count: Number(r.n),
    })),
    aiConfidence: {
      average: confidence._avg.aiConfidence ?? null,
      classified: confidence._count._all,
    },
    // Surfaced so the UI can state how much of the corpus is modelled rather
    // than leaving a reader to assume it is all real citizen reporting.
    dataset: { real: total - modelled, modelled },
    windowDays: days,
  });
});

/**
 * Geographic distribution, for the heatmap.
 *
 *   GET /api/complaints/geo?dept=<id>&category=<name>
 *
 * WHY THIS AGGREGATES RATHER THAN RETURNING POINTS
 * ------------------------------------------------
 * The heatmap previously plotted one marker per complaint from the client's
 * cached page. That was doubly broken: the page held 25 rows, and almost none of
 * them carried coordinates, so the map rendered empty while claiming 25
 * complaints.
 *
 * Sending 150,000 points to the browser is not the fix — it would be slow and
 * unreadable. Instead complaints are counted per state in Postgres and returned
 * as 35 proportional circles. Districts are real census records, so the
 * district-to-state rollup is real data; only the circle's position is
 * approximate, and it is explicitly a state centroid rather than a claim about
 * where any individual complaint was filed.
 *
 * Complaints that carry genuine coordinates — anything filed with "Use my
 * location" — are returned separately as exact pins, capped so a future flood of
 * real submissions cannot bloat the response.
 *
 * Registered before `GET /:id` so `:id` cannot swallow "geo".
 */
complaints.get('/geo', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);
  if (user.role === 'citizen') return c.json({ code: 'forbidden' }, 403);

  const url = new URL(c.req.url);
  const deptParam = url.searchParams.get('dept') ?? undefined;
  const category = url.searchParams.get('category') ?? undefined;

  let departmentId: string | undefined = deptParam;
  if (user.role === 'officer') {
    const officer = await prisma.user.findUnique({
      where: { id: user.id },
      select: { departmentId: true },
    });
    if (!officer?.departmentId) {
      return c.json({ states: [], pins: [], coverage: { total: 0, mapped: 0, withCoordinates: 0 } });
    }
    // An officer cannot widen scope via ?dept=.
    departmentId = officer.departmentId;
  }

  const where: Prisma.ComplaintWhereInput = {
    ...(departmentId ? { departmentId } : {}),
    ...(category ? { category } : {}),
  };

  const [grouped, total, pinRows] = await Promise.all([
    // Group by district, then roll up to state in memory. Grouping by state
    // directly is not possible in one Prisma query because the relation is two
    // hops away, and 640 district rows are trivial to fold.
    prisma.complaint.groupBy({
      by: ['districtId'],
      where: { ...where, districtId: { not: null } },
      _count: { _all: true },
      orderBy: { districtId: 'asc' },
    }),
    prisma.complaint.count({ where }),
    prisma.complaint.findMany({
      where: { ...where, lat: { not: null }, lng: { not: null } },
      select: { id: true, title: true, category: true, priority: true, lat: true, lng: true },
      orderBy: { submittedAt: 'desc' },
      take: 500,
    }),
  ]);

  const districts = await prisma.district.findMany({
    where: { id: { in: grouped.map((g) => g.districtId).filter((id): id is string => !!id) } },
    select: { id: true, name: true, state: { select: { name: true } } },
  });
  const stateByDistrict = new Map(districts.map((d) => [d.id, d.state.name]));

  const byState = new Map<string, { count: number; districts: number }>();
  let mapped = 0;
  for (const g of grouped) {
    if (!g.districtId) continue;
    const stateName = stateByDistrict.get(g.districtId);
    if (!stateName) continue;
    const cur = byState.get(stateName) ?? { count: 0, districts: 0 };
    cur.count += g._count._all;
    cur.districts += 1;
    byState.set(stateName, cur);
    mapped += g._count._all;
  }

  const states = [...byState.entries()]
    .map(([name, v]) => {
      const centre = centroidFor(name);
      return centre
        ? { state: name, lat: centre.lat, lng: centre.lng, count: v.count, districts: v.districts }
        : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.count - a.count);

  // A state present in the data but absent from the centroid table would be
  // silently dropped above, so surface it rather than losing complaints quietly.
  const unmapped = [...byState.keys()].filter((n) => !centroidFor(n));
  if (unmapped.length) {
    console.warn(`[geo] no centroid for state(s): ${unmapped.join(', ')}`);
  }

  return c.json({
    states,
    pins: pinRows.map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      priority: p.priority,
      lat: p.lat,
      lng: p.lng,
    })),
    coverage: {
      total,
      /** Complaints attributable to a state, and so represented on the map. */
      mapped,
      /** Complaints carrying their own exact coordinates. */
      withCoordinates: pinRows.length,
    },
  });
});

complaints.post('/', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = ComplaintCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }
  const { title, description, category, language, location, lat, lng } = parsed.data;
  const departmentId = await resolveDepartmentByCategory(category);

  // Attach a district so the complaint reaches the planning layer and the
  // heatmap, not just the national counters. Citizens never pick a district, so
  // it is inferred from the free-text location, falling back to their profile
  // city. Returns null rather than guessing when the name is ambiguous — a wrong
  // district would feed another region's demand signal and distort a funding
  // recommendation, which is worse than no district at all.
  const author = await prisma.user.findUnique({
    where: { id: user.id },
    select: { city: true },
  });
  const districtMatch = await resolveDistrict(location, author?.city);
  if (districtMatch) {
    console.log(
      `[complaints] mapped to ${districtMatch.districtName}, ${districtMatch.stateName} ` +
        `via ${districtMatch.matchedOn} "${districtMatch.token}"`,
    );
  }

  // Use a transaction so the complaint and its first notification land atomically.
  const created = await prisma.$transaction(async (tx) => {
    const complaint = await tx.complaint.create({
      data: {
        title,
        description,
        category,
        language,
        location,
        lat,
        lng,
        citizenId: user.id,
        departmentId,
        // Null when the location could not be resolved confidently. The complaint
        // still counts nationally, it just does not appear in district aggregates.
        districtId: districtMatch?.districtId ?? null,
        // Persist the optional AI fields when the client provided them so
        // the citizen dashboard's "AI Confidence" tile reflects real data.
        ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
        ...(parsed.data.sentiment !== undefined
          ? { sentiment: parsed.data.sentiment === 'Highly Negative' ? 'HighlyNegative' : parsed.data.sentiment }
          : {}),
        ...(parsed.data.aiConfidence !== undefined ? { aiConfidence: parsed.data.aiConfidence } : {}),
        ...(parsed.data.aiSummary !== undefined ? { aiSummary: parsed.data.aiSummary } : {}),
        // Voice intake provenance: the original-language transcript is stored
        // next to the translated description so the record stays auditable.
        ...(parsed.data.sourceTranscript !== undefined
          ? { sourceTranscript: parsed.data.sourceTranscript }
          : {}),
        ...(parsed.data.sourceLanguage !== undefined
          ? { sourceLanguage: parsed.data.sourceLanguage }
          : {}),
      },
      include: { department: { select: { name: true } } },
    });
    await tx.notification.create({
      data: {
        userId: user.id,
        type: 'submitted',
        message: `Your complaint "${complaint.title}" has been successfully submitted`,
        complaintId: complaint.id,
      },
    });
    await audit(
      {
        actorId: user.id,
        action: 'complaint.create',
        entity: 'complaint',
        entityId: complaint.id,
        before: null,
        after: serializeComplaint(complaint),
      },
      tx,
    );
    return complaint;
  });

  void emitComplaintEmail(
    created,
    'submitted',
    `Your complaint "${created.title}" has been successfully submitted`,
  );

  return c.json(serializeComplaint(created), 201);
});

complaints.get('/:id', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const result = await loadAuthorizedComplaint(user, c.req.param('id'));
  if (result.code === 'not_found') return c.json({ code: 'not_found' }, 404);
  if (result.code === 'forbidden') return c.json({ code: 'forbidden' }, 403);
  return c.json(serializeComplaint(result.complaint));
});

complaints.patch('/:id', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);
  if (user.role === 'citizen') {
    return c.json({ code: 'forbidden', message: 'Only officers and admins can patch complaints' }, 403);
  }

  const id = c.req.param('id');
  const before = await loadAuthorizedComplaint(user, id);
  if (before.code === 'not_found') return c.json({ code: 'not_found' }, 404);
  if (before.code === 'forbidden') return c.json({ code: 'forbidden' }, 403);
  const previous = before.complaint;

  const body = await c.req.json().catch(() => null);
  const parsed = ComplaintUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }

  // Translate the wire-format enum values to Prisma's TS enum identifiers.
  const data: Prisma.ComplaintUpdateInput = {};
  if (parsed.data.status !== undefined) data.status = statusFromWire(parsed.data.status);
  if (parsed.data.priority !== undefined) data.priority = priorityFromWire(parsed.data.priority);
  if (parsed.data.category !== undefined) data.category = parsed.data.category;
  if (parsed.data.departmentId !== undefined) {
    data.department = { connect: { id: parsed.data.departmentId } };
  }
  if (parsed.data.assigneeId !== undefined) {
    data.assignee = parsed.data.assigneeId
      ? { connect: { id: parsed.data.assigneeId } }
      : { disconnect: true };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.complaint.update({
      where: { id },
      data,
      include: { department: { select: { name: true } } },
    });

    // Emit a notification to the citizen on status change.
    if (parsed.data.status && statusFromWire(parsed.data.status) !== previous.status) {
      await tx.notification.create({
        data: {
          userId: previous.citizenId,
          type: 'status_updated',
          message: `Complaint ${id} status updated to: ${parsed.data.status}`,
          complaintId: id,
        },
      });
    }

    await audit(
      {
        actorId: user.id,
        action: 'complaint.update',
        entity: 'complaint',
        entityId: id,
        before: serializeComplaint(previous),
        after: serializeComplaint(next),
      },
      tx,
    );

    return next;
  });

  if (parsed.data.status && statusFromWire(parsed.data.status) !== previous.status) {
    void emitComplaintEmail(
      updated,
      'status_updated',
      `Complaint ${id} status updated to: ${parsed.data.status}`,
    );
  }

  if (
    parsed.data.priority === 'Critical' &&
    previous.priority !== priorityFromWire('Critical')
  ) {
    void emitComplaintSms(
      updated,
      'critical',
      `Nivaran: your complaint ${id} has been marked Critical and will be expedited.`,
    );
  }

  return c.json(serializeComplaint(updated));
});

complaints.post('/:id/assign', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);
  if (user.role === 'citizen') return c.json({ code: 'forbidden' }, 403);

  const id = c.req.param('id');
  const before = await loadAuthorizedComplaint(user, id);
  if (before.code === 'not_found') return c.json({ code: 'not_found' }, 404);
  if (before.code === 'forbidden') return c.json({ code: 'forbidden' }, 403);
  const previous = before.complaint;

  const body = await c.req.json().catch(() => null);
  const parsed = ComplaintAssignSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }

  const data: Prisma.ComplaintUpdateInput = {
    assignee: parsed.data.assigneeId
      ? { connect: { id: parsed.data.assigneeId } }
      : { disconnect: true },
    status: parsed.data.assigneeId ? 'Assigned' : previous.status,
  };

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.complaint.update({
      where: { id },
      data,
      include: { department: { select: { name: true } } },
    });

    if (parsed.data.assigneeId && previous.assigneeId !== parsed.data.assigneeId) {
      await tx.notification.create({
        data: {
          userId: previous.citizenId,
          type: 'assigned',
          message: `Complaint ${id} has been assigned`,
          complaintId: id,
        },
      });
    }

    await audit(
      {
        actorId: user.id,
        action: 'complaint.assign',
        entity: 'complaint',
        entityId: id,
        before: serializeComplaint(previous),
        after: serializeComplaint(next),
      },
      tx,
    );

    return next;
  });

  if (parsed.data.assigneeId && previous.assigneeId !== parsed.data.assigneeId) {
    void emitComplaintEmail(
      updated,
      'assigned',
      `Complaint ${id} has been assigned`,
    );
  }

  return c.json(serializeComplaint(updated));
});

complaints.post('/:id/escalate', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);
  if (user.role === 'citizen') return c.json({ code: 'forbidden' }, 403);

  const id = c.req.param('id');
  const before = await loadAuthorizedComplaint(user, id);
  if (before.code === 'not_found') return c.json({ code: 'not_found' }, 404);
  if (before.code === 'forbidden') return c.json({ code: 'forbidden' }, 403);
  const previous = before.complaint;

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.complaint.update({
      where: { id },
      data: { priority: 'Critical' },
      include: { department: { select: { name: true } } },
    });
    await tx.notification.create({
      data: {
        userId: previous.citizenId,
        type: 'escalated',
        message: `Complaint ${id} has been escalated to Critical priority`,
        complaintId: id,
      },
    });
    await audit(
      {
        actorId: user.id,
        action: 'complaint.escalate',
        entity: 'complaint',
        entityId: id,
        before: serializeComplaint(previous),
        after: serializeComplaint(next),
      },
      tx,
    );
    return next;
  });

  void emitComplaintEmail(
    updated,
    'escalated',
    `Complaint ${id} has been escalated to Critical priority`,
  );
  void emitComplaintSms(
    updated,
    'escalated',
    `Nivaran: complaint ${id} escalated to Critical. We'll keep you posted.`,
  );

  return c.json(serializeComplaint(updated));
});

complaints.post('/:id/resolve', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);
  if (user.role === 'citizen') return c.json({ code: 'forbidden' }, 403);

  const id = c.req.param('id');
  const before = await loadAuthorizedComplaint(user, id);
  if (before.code === 'not_found') return c.json({ code: 'not_found' }, 404);
  if (before.code === 'forbidden') return c.json({ code: 'forbidden' }, 403);
  const previous = before.complaint;

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.complaint.update({
      where: { id },
      data: { status: 'Resolved', resolvedAt: new Date() },
      include: { department: { select: { name: true } } },
    });
    await tx.notification.create({
      data: {
        userId: previous.citizenId,
        type: 'resolved',
        message: `Complaint ${id} has been successfully resolved`,
        complaintId: id,
      },
    });
    await audit(
      {
        actorId: user.id,
        action: 'complaint.resolve',
        entity: 'complaint',
        entityId: id,
        before: serializeComplaint(previous),
        after: serializeComplaint(next),
      },
      tx,
    );
    return next;
  });

  void emitComplaintEmail(
    updated,
    'resolved',
    `Complaint ${id} has been successfully resolved`,
  );

  return c.json(serializeComplaint(updated));
});

export default complaints;
