import type { Context, MiddlewareHandler } from 'hono';
import { prisma } from '../db';
import { readSessionCookie } from './cookies';
import { verifySession } from './session';

declare module 'hono' {
  interface ContextVariableMap {
    user: { id: string; role: 'citizen' | 'officer' | 'admin' } | null;
    complaintId: string;
  }
}

export const sessionMiddleware: MiddlewareHandler = async (c, next) => {
  const token = readSessionCookie(c);
  if (!token) {
    c.set('user', null);
    return next();
  }
  const session = await verifySession(token);
  if (!session) {
    c.set('user', null);
    return next();
  }
  // Confirm the user still exists and the role hasn't changed.
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, role: true },
  });
  c.set('user', user);
  return next();
};

/** Helper for routes that require any authenticated user. */
export function requireUser(c: Context) {
  const user = c.get('user');
  if (!user) {
    throw new Error('UNAUTHENTICATED');
  }
  return user;
}

/**
 * Non-throwing accessor for the session user. Returns `null` when no
 * session is present so route handlers can branch instead of catching.
 */
export function getUser(c: Context) {
  return c.get('user');
}
