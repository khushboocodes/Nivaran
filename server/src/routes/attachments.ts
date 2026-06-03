/**
 * Attachment routes. Mounted under `/api/complaints/:id/attachments`.
 *
 * Flow:
 *   1. Client calls POST `/sign` with kind/contentType/size →
 *      server returns { uploadUrl, objectKey, publicUrl }
 *   2. Client PUTs the file bytes directly to MinIO at `uploadUrl`
 *   3. Client calls POST `/` (finalize) with { kind, objectKey, sizeBytes }
 *      → server records an Attachment row and returns it
 *   4. Client lists with GET `/`
 *
 * Authorization mirrors the parent complaint:
 *   - citizens can only attach to their own complaints
 *   - officers can attach to complaints in their department
 *   - admins can attach anywhere
 */

import { Hono } from 'hono';
import { Prisma } from '@prisma/client';
import {
  AttachmentSignRequestSchema,
  AttachmentFinalizeSchema,
  type AttachmentKind,
} from '@nivaran/shared';
import { prisma } from '../db';
import { getUser } from '../auth/middleware';
import { audit } from '../services/audit';
import { presignPutUrl, publicUrlFor } from '../services/storage';

type SessionUser = { id: string; role: 'citizen' | 'officer' | 'admin' };

async function canAccessComplaint(user: SessionUser, complaintId: string): Promise<
  | { ok: true; complaint: Prisma.ComplaintGetPayload<{}> }
  | { ok: false; status: 401 | 403 | 404 }
> {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) return { ok: false, status: 404 };
  if (user.role === 'admin') return { ok: true, complaint };
  if (user.role === 'citizen') {
    if (complaint.citizenId !== user.id) return { ok: false, status: 403 };
    return { ok: true, complaint };
  }
  // officer
  const officer = await prisma.user.findUnique({
    where: { id: user.id },
    select: { departmentId: true },
  });
  if (!officer?.departmentId || officer.departmentId !== complaint.departmentId) {
    return { ok: false, status: 403 };
  }
  return { ok: true, complaint };
}

function extensionFor(kind: AttachmentKind, contentType: string): string {
  // Extract the part after the last "/" then strip parameters.
  const sub = contentType.split('/').pop()?.split(';')[0] ?? '';
  // Webm / mp4 / mp3 / jpeg / png / etc.
  const safe = sub.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (safe) return safe;
  return kind === 'photo' ? 'jpg' : kind === 'video' ? 'mp4' : 'webm';
}

const attachments = new Hono();

// :id is captured by the parent route; we read it via path-prefix matches.
attachments.use('*', async (c, next) => {
  // The mount point is `/api/complaints/:id/attachments` so :id is in the URL.
  const url = new URL(c.req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const idx = segments.indexOf('complaints');
  const complaintId = idx >= 0 ? segments[idx + 1] : undefined;
  if (!complaintId) return c.json({ code: 'invalid_input' }, 400);
  c.set('complaintId', complaintId);
  return next();
});

attachments.get('/', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const complaintId = c.get('complaintId');
  const access = await canAccessComplaint(user, complaintId);
  if (!access.ok) return c.json({ code: access.status === 404 ? 'not_found' : 'forbidden' }, access.status);

  const items = await prisma.attachment.findMany({
    where: { complaintId },
    orderBy: { createdAt: 'asc' },
  });
  return c.json({
    items: items.map((a) => ({
      id: a.id,
      complaintId: a.complaintId,
      kind: a.kind,
      url: a.url,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

attachments.post('/sign', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const complaintId = c.get('complaintId');
  const access = await canAccessComplaint(user, complaintId);
  if (!access.ok) return c.json({ code: access.status === 404 ? 'not_found' : 'forbidden' }, access.status);

  const body = await c.req.json().catch(() => null);
  const parsed = AttachmentSignRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }
  const { kind, contentType, sizeBytes } = parsed.data;

  // The S3 key namespaces objects by complaint id and timestamps each upload
  // so two attachments of the same kind never collide.
  const ext = extensionFor(kind, contentType);
  const objectKey = `complaints/${complaintId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const { uploadUrl, expiresInSeconds } = await presignPutUrl(objectKey, contentType);
  return c.json({
    uploadUrl,
    objectKey,
    expiresInSeconds,
    publicUrl: publicUrlFor(objectKey),
    sizeBytes,
  });
});

attachments.post('/', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const complaintId = c.get('complaintId');
  const access = await canAccessComplaint(user, complaintId);
  if (!access.ok) return c.json({ code: access.status === 404 ? 'not_found' : 'forbidden' }, access.status);

  const body = await c.req.json().catch(() => null);
  const parsed = AttachmentFinalizeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }

  const { kind, objectKey, sizeBytes } = parsed.data;
  const created = await prisma.attachment.create({
    data: {
      complaintId,
      kind,
      url: publicUrlFor(objectKey),
      sizeBytes,
    },
  });

  await audit({
    actorId: user.id,
    action: 'attachment.create',
    entity: 'attachment',
    entityId: created.id,
    after: {
      id: created.id,
      complaintId: created.complaintId,
      kind: created.kind,
      url: created.url,
      sizeBytes: created.sizeBytes,
    },
  });

  return c.json(
    {
      id: created.id,
      complaintId: created.complaintId,
      kind: created.kind,
      url: created.url,
      sizeBytes: created.sizeBytes,
      createdAt: created.createdAt.toISOString(),
    },
    201,
  );
});

export default attachments;
