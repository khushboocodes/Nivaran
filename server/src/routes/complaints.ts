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
} from '../serializers/complaint';
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
  const { status, priority, q, dept, page, pageSize } = parsed.data;

  const baseWhere = await scopedWhere(user);
  const filters: Prisma.ComplaintWhereInput = { ...baseWhere };

  if (status) filters.status = statusFromWire(status);
  if (priority) filters.priority = priorityFromWire(priority);
  if (dept) filters.departmentId = dept;
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
        // Persist the optional AI fields when the client provided them so
        // the citizen dashboard's "AI Confidence" tile reflects real data.
        ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
        ...(parsed.data.sentiment !== undefined
          ? { sentiment: parsed.data.sentiment === 'Highly Negative' ? 'HighlyNegative' : parsed.data.sentiment }
          : {}),
        ...(parsed.data.aiConfidence !== undefined ? { aiConfidence: parsed.data.aiConfidence } : {}),
        ...(parsed.data.aiSummary !== undefined ? { aiSummary: parsed.data.aiSummary } : {}),
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
