import type { Context } from 'hono';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { IS_PROD, SESSION_COOKIE_NAME, SESSION_TTL_HOURS } from './config';

export function setSessionCookie(c: Context, token: string): void {
  // In production the frontend (Vercel) and API (Render) are on different
  // domains, so the session cookie must be SameSite=None + Secure to be
  // sent on cross-site requests. In dev they share localhost, so Lax works.
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: IS_PROD ? 'None' : 'Lax',
    secure: IS_PROD,
    path: '/',
    maxAge: SESSION_TTL_HOURS * 3600,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
}

export function readSessionCookie(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE_NAME);
}
