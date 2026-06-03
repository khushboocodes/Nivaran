import { Hono } from 'hono';
import {
  SignupInputSchema,
  LoginInputSchema,
  ForgotPasswordInputSchema,
  ResetPasswordInputSchema,
  type Role,
} from '@nivaran/shared';
import { prisma } from '../db';
import { hashPassword, verifyPassword } from '../auth/password';
import { signSession } from '../auth/session';
import { setSessionCookie, clearSessionCookie } from '../auth/cookies';
import { mintToken, hashToken } from '../auth/tokens';
import { newSecret, verifyCode } from '../auth/totp';
import { sendPasswordResetEmail } from '../services/email';

const auth = new Hono();

const RESET_TTL_MINUTES = 30;

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

auth.post('/signup', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = SignupInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'invalid_input', message: 'Invalid signup payload', details: parsed.error.flatten() },
      400,
    );
  }

  const { name, email, phone, city, password, language } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return c.json({ code: 'email_in_use', message: 'Email is already registered' }, 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      city,
      passwordHash,
      language,
      role: 'citizen',
    },
  });

  const token = await signSession({ sub: user.id, role: user.role });
  setSessionCookie(c, token);

  return c.json({ user: publicUser(user) }, 201);
});

auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = LoginInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'invalid_input', message: 'Invalid login payload', details: parsed.error.flatten() },
      400,
    );
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return c.json({ code: 'invalid_credentials', message: 'Invalid email or password' }, 401);
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    return c.json({ code: 'invalid_credentials', message: 'Invalid email or password' }, 401);
  }

  // 2FA enforcement: if the account has 2FA enrolled, require a valid TOTP
  // alongside the password before issuing a session.
  if (user.twoFactorEnabled) {
    if (!parsed.data.totp) {
      return c.json({ code: 'twofa_required', message: '2FA verification is required' }, 401);
    }
    if (!user.twoFactorSecret || !verifyCode(user.twoFactorSecret, parsed.data.totp)) {
      return c.json({ code: 'invalid_totp', message: 'Invalid 2FA code' }, 401);
    }
  }

  const token = await signSession({ sub: user.id, role: user.role });
  setSessionCookie(c, token);

  return c.json({ user: publicUser(user) });
});

auth.post('/logout', (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

auth.get('/me', async (c) => {
  const session = c.get('user');
  if (!session) return c.json({ user: null });

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return c.json({ user: null });

  return c.json({ user: publicUser(user) });
});

auth.post('/2fa/enroll', async (c) => {
  const session = c.get('user');
  if (!session) return c.json({ code: 'unauthenticated' }, 401);
  if (session.role !== 'admin') {
    return c.json({ code: 'forbidden', message: '2FA enrollment is admin-only' }, 403);
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  // Don't overwrite an already-enrolled secret. Force the admin to disable
  // first if they want to re-enroll. (A disable endpoint can land later.)
  if (user.twoFactorEnabled) {
    return c.json(
      { code: 'already_enrolled', message: '2FA is already enabled for this account' },
      409,
    );
  }

  const { base32, uri } = newSecret(user.email);

  // Stage the secret on the user but leave `twoFactorEnabled` false. Only
  // /verify flips it on, after the user proves they have the secret.
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: base32 },
  });

  return c.json({ otpauthUri: uri, secret: base32 });
});

auth.post('/2fa/verify', async (c) => {
  const session = c.get('user');
  if (!session) return c.json({ code: 'unauthenticated' }, 401);

  const body = await c.req.json().catch(() => null);
  const code = (body && typeof body.code === 'string' ? body.code : '').trim();
  if (!/^\d{6}$/.test(code)) {
    return c.json({ code: 'invalid_input', message: 'A 6-digit code is required' }, 400);
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user || !user.twoFactorSecret) {
    return c.json({ code: 'not_enrolled', message: 'Run /2fa/enroll first' }, 400);
  }

  if (!verifyCode(user.twoFactorSecret, code)) {
    return c.json({ code: 'invalid_code', message: 'Code is invalid or expired' }, 401);
  }

  if (!user.twoFactorEnabled) {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });
  }

  return c.json({ ok: true });
});

auth.post('/forgot', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = ForgotPasswordInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'invalid_input', message: 'Invalid forgot-password payload', details: parsed.error.flatten() },
      400,
    );
  }

  const { email } = parsed.data;

  // Always return 200 to prevent account enumeration. Only mint+send when
  // the user actually exists.
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const { token, hash } = mintToken();
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt },
    });

    const baseUrl = process.env.PUBLIC_APP_URL ?? 'http://localhost:3000';
    const resetUrl = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;

    await sendPasswordResetEmail({ to: user.email, resetUrl, expiresAt });
  }

  return c.json({ ok: true });
});

auth.post('/reset', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = ResetPasswordInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { code: 'invalid_input', message: 'Invalid reset payload', details: parsed.error.flatten() },
      400,
    );
  }

  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return c.json({ code: 'invalid_token', message: 'Reset link is invalid or expired' }, 400);
  }

  const newHash = await hashPassword(password);

  // Atomically: update the password, mark the token used, invalidate other
  // outstanding reset tokens for this user.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: newHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, NOT: { id: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  return c.json({ ok: true });
});

export default auth;
