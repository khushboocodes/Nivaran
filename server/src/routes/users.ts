import { Hono } from 'hono';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import type { Role } from '@nivaran/shared';
import { prisma } from '../db';
import { getUser } from '../auth/middleware';
import { hashPassword, verifyPassword } from '../auth/password';
import { audit } from '../services/audit';

const users = new Hono();

const ProfileUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().min(7).max(20).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  language: z.string().min(2).max(10).optional(),
});

const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

const RoleSchema = z.enum(['citizen', 'officer', 'admin']);

const AdminInviteSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().min(1).max(120),
  role: RoleSchema,
  departmentId: z.string().nullable().optional(),
  password: z.string().min(8).max(200),
});

const AdminUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: RoleSchema.optional(),
  departmentId: z.string().nullable().optional(),
});

function publicUser(u: {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  city: string | null;
  role: Role;
  language: string;
  twoFactorEnabled: boolean;
  departmentId: string | null;
  createdAt: Date;
}) {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    name: u.name,
    city: u.city,
    role: u.role,
    language: u.language,
    twoFactorEnabled: u.twoFactorEnabled,
    departmentId: u.departmentId,
    createdAt: u.createdAt.toISOString(),
  };
}

users.get('/me', async (c) => {
  const session = getUser(c);
  if (!session) return c.json({ code: 'unauthenticated' }, 401);
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return c.json({ code: 'unauthenticated' }, 401);
  return c.json({ user: publicUser(user) });
});

users.patch('/me', async (c) => {
  const session = getUser(c);
  if (!session) return c.json({ code: 'unauthenticated' }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = ProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }

  // Build a sparse update — only include fields the client actually sent.
  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone || null;
  if (parsed.data.city !== undefined) data.city = parsed.data.city || null;
  if (parsed.data.language !== undefined) data.language = parsed.data.language;

  if (Object.keys(data).length === 0) {
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    return c.json({ user: user ? publicUser(user) : null });
  }

  const before = await prisma.user.findUnique({ where: { id: session.id } });
  const updated = await prisma.user.update({
    where: { id: session.id },
    data,
  });
  if (before) {
    await audit({
      actorId: session.id,
      action: 'user.update',
      entity: 'user',
      entityId: updated.id,
      before: publicUser(before),
      after: publicUser(updated),
    });
  }

  return c.json({ user: publicUser(updated) });
});

users.post('/me/password', async (c) => {
  const session = getUser(c);
  if (!session) return c.json({ code: 'unauthenticated' }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = PasswordChangeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const ok = await verifyPassword(user.passwordHash, parsed.data.currentPassword);
  if (!ok) {
    return c.json({ code: 'invalid_password', message: 'Current password is incorrect' }, 400);
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  await audit({
    actorId: session.id,
    action: 'user.password_changed',
    entity: 'user',
    entityId: user.id,
  });

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin-only user management
// ---------------------------------------------------------------------------

const ListQuery = z.object({
  role: RoleSchema.optional(),
  q: z.string().optional(),
});

users.get('/', async (c) => {
  const session = getUser(c);
  if (!session) return c.json({ code: 'unauthenticated' }, 401);
  if (session.role !== 'admin') return c.json({ code: 'forbidden' }, 403);

  const parsed = ListQuery.safeParse(
    Object.fromEntries(new URL(c.req.url).searchParams),
  );
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }
  const where: Prisma.UserWhereInput = {};
  if (parsed.data.role) where.role = parsed.data.role;
  if (parsed.data.q && parsed.data.q.trim()) {
    where.OR = [
      { email: { contains: parsed.data.q, mode: 'insensitive' } },
      { name: { contains: parsed.data.q, mode: 'insensitive' } },
    ];
  }

  const [items, departments] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { department: { select: { id: true, name: true } } },
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return c.json({
    items: items.map((u) => ({
      ...publicUser(u),
      departmentName: u.department?.name ?? null,
    })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
  });
});

users.post('/', async (c) => {
  const session = getUser(c);
  if (!session) return c.json({ code: 'unauthenticated' }, 401);
  if (session.role !== 'admin') return c.json({ code: 'forbidden' }, 403);

  const body = await c.req.json().catch(() => null);
  const parsed = AdminInviteSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return c.json({ code: 'email_in_use' }, 409);
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const created = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      departmentId: parsed.data.departmentId ?? null,
      passwordHash,
    },
  });

  await audit({
    actorId: session.id,
    action: 'user.create',
    entity: 'user',
    entityId: created.id,
    after: publicUser(created),
  });

  return c.json({ user: publicUser(created) }, 201);
});

users.patch('/:id', async (c) => {
  const session = getUser(c);
  if (!session) return c.json({ code: 'unauthenticated' }, 401);
  if (session.role !== 'admin') return c.json({ code: 'forbidden' }, 403);

  const id = c.req.param('id');
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return c.json({ code: 'not_found' }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = AdminUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }

  // Don't let an admin demote themselves — saves us from an UI/auth edge
  // case where the only admin removes their own role.
  if (id === session.id && parsed.data.role && parsed.data.role !== 'admin') {
    return c.json(
      { code: 'self_demote_forbidden', message: 'Admins cannot demote their own account' },
      400,
    );
  }

  const data: Prisma.UserUpdateInput = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.departmentId !== undefined) {
    data.department = parsed.data.departmentId
      ? { connect: { id: parsed.data.departmentId } }
      : { disconnect: true };
  }

  const updated = await prisma.user.update({ where: { id }, data });

  await audit({
    actorId: session.id,
    action: 'user.admin_update',
    entity: 'user',
    entityId: id,
    before: publicUser(before),
    after: publicUser(updated),
  });

  return c.json({ user: publicUser(updated) });
});

users.delete('/:id', async (c) => {
  const session = getUser(c);
  if (!session) return c.json({ code: 'unauthenticated' }, 401);
  if (session.role !== 'admin') return c.json({ code: 'forbidden' }, 403);

  const id = c.req.param('id');

  if (id === session.id) {
    return c.json({ code: 'self_delete_forbidden', message: 'You cannot delete your own account' }, 400);
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return c.json({ code: 'not_found' }, 404);

  await prisma.user.delete({ where: { id } });

  await audit({
    actorId: session.id,
    action: 'user.delete',
    entity: 'user',
    entityId: id,
    before: publicUser(target),
  });

  return c.json({ ok: true });
});

export default users;
