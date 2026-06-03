import { Hono } from 'hono';
import type { Notification as PrismaNotification } from '@prisma/client';
import { prisma } from '../db';
import { getUser } from '../auth/middleware';

const notifications = new Hono();

function serialize(n: PrismaNotification) {
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    message: n.message,
    complaintId: n.complaintId,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

notifications.get('/', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  const unread = items.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);
  return c.json({ items: items.map(serialize), unread });
});

notifications.post('/:id/read', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const id = c.req.param('id');
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return c.json({ code: 'not_found' }, 404);
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { read: true },
  });

  return c.json(serialize(updated));
});

notifications.post('/read-all', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const result = await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });

  return c.json({ updated: result.count });
});

export default notifications;
