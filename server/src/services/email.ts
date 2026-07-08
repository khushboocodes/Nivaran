/**
 * Email service.
 *
 * Two delivery modes selected by env vars:
 *   - SMTP transport (Nodemailer) when `SMTP_HOST` is set. Works with
 *     Mailtrap / Gmail App Password / Resend SMTP / Brevo etc.
 *   - Dev console transport otherwise — every email is logged to stdout
 *     so the prototype stays runnable without any external account.
 *
 * Public API:
 *   - sendPasswordResetEmail({ to, resetUrl, expiresAt })
 *   - sendComplaintEvent({ to, name?, type, complaintId, title, message })
 *
 * Both calls are awaitable but failures are non-fatal — call sites should
 * `void` the promise so a flaky SMTP server never breaks an API request.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { prisma } from '../db';

type ComplaintEventType =
  | 'submitted'
  | 'status_updated'
  | 'assigned'
  | 'resolved'
  | 'escalated';

interface PasswordResetEmail {
  to: string;
  resetUrl: string;
  expiresAt: Date;
}

interface ComplaintEventEmail {
  to: string;
  name?: string | null;
  type: ComplaintEventType;
  complaintId: string;
  title: string;
  /** Pre-rendered notification message used as the email body fallback. */
  message: string;
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

let cachedTransport: Transporter | null = null;

function buildTransport(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

function getTransport(): Transporter | null {
  if (cachedTransport) return cachedTransport;
  cachedTransport = buildTransport();
  return cachedTransport;
}

const FROM_ADDRESS = process.env.SMTP_FROM ?? 'Nivaran <noreply@nivaran.local>';

// ---------------------------------------------------------------------------
// Settings gate
// ---------------------------------------------------------------------------

/**
 * Admins can disable email channels from the Settings page. The default
 * is "on" whenever SMTP is configured. We read a single boolean from the
 * `settings` table at key
 * `notifications.email`. Missing row → default true.
 */
async function emailChannelEnabled(): Promise<boolean> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'notifications.email' } });
    if (!row) return true;
    const v = row.value as unknown;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'object' && v !== null && 'enabled' in v) {
      return Boolean((v as { enabled?: unknown }).enabled);
    }
    return true;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Public sends
// ---------------------------------------------------------------------------

export async function sendPasswordResetEmail(message: PasswordResetEmail): Promise<void> {
  const subject = 'Reset your Nivaran password';
  const text = [
    'Hi,',
    '',
    'We received a request to reset your Nivaran password. Use the link',
    'below within the next hour to choose a new one. If you didn\'t ask',
    'for this, you can safely ignore this message.',
    '',
    `Reset link: ${message.resetUrl}`,
    `Expires:    ${message.expiresAt.toISOString()}`,
    '',
    '— The Nivaran team',
  ].join('\n');

  const transport = getTransport();
  if (!transport) {
    // eslint-disable-next-line no-console
    console.log(
      [
        '[email:dev] Password reset',
        `  to:        ${message.to}`,
        `  reset URL: ${message.resetUrl}`,
        `  expires:   ${message.expiresAt.toISOString()}`,
      ].join('\n'),
    );
    return;
  }

  try {
    await transport.sendMail({ from: FROM_ADDRESS, to: message.to, subject, text });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] failed to send password reset', err);
  }
}

const subjectByType: Record<ComplaintEventType, string> = {
  submitted: 'We received your complaint',
  status_updated: 'Your complaint status was updated',
  assigned: 'Your complaint has been assigned',
  resolved: 'Your complaint has been resolved',
  escalated: 'Your complaint has been escalated',
};

export async function sendComplaintEvent(payload: ComplaintEventEmail): Promise<void> {
  if (!(await emailChannelEnabled())) return;

  const subject = subjectByType[payload.type];
  const greeting = payload.name ? `Hi ${payload.name},` : 'Hi,';
  const text = [
    greeting,
    '',
    payload.message,
    '',
    `Complaint: ${payload.title}`,
    `Reference: ${payload.complaintId}`,
    '',
    '— The Nivaran team',
  ].join('\n');

  const transport = getTransport();
  if (!transport) {
    // eslint-disable-next-line no-console
    console.log(
      [
        `[email:dev] ${subject}`,
        `  to:         ${payload.to}`,
        `  complaint:  ${payload.complaintId} (${payload.title})`,
        `  message:    ${payload.message}`,
      ].join('\n'),
    );
    return;
  }

  try {
    await transport.sendMail({ from: FROM_ADDRESS, to: payload.to, subject, text });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] failed to send complaint event', payload.type, err);
  }
}
