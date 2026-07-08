/**
 * SMS service. Currently provider-less in the prototype: every send is
 * logged to stdout so the rest of the app (escalation flows, critical
 * alerts) can call `sendSms(...)` without depending on a paid SMS gateway.
 *
 * To turn on real delivery later, set:
 *   SMS_PROVIDER=twilio | msg91 | sns
 *   TWILIO_ACCOUNT_SID=...     (Twilio)
 *   TWILIO_AUTH_TOKEN=...
 *   TWILIO_FROM=+1...
 *
 * The implementation here only wires the dispatcher; bolting on the real
 * client when payment is approved is a one-file change.
 *
 * Like the email service, failures are non-fatal — bad SMS config can
 * never break an API request.
 */

import { prisma } from '../db';

interface SmsMessage {
  to: string;
  body: string;
  /**
   * Tag for admin filtering / future settings. The Settings table can
   * gate per-category SMS (e.g. 'critical_only') but for now every send
   * is allowed unless `notifications.sms` is explicitly disabled.
   */
  category?: 'critical' | 'escalated' | 'general';
}

async function smsChannelEnabled(): Promise<boolean> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'notifications.sms' } });
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

export async function sendSms(message: SmsMessage): Promise<void> {
  if (!(await smsChannelEnabled())) return;

  const provider = process.env.SMS_PROVIDER ?? 'console';
  if (provider === 'console') {
    // eslint-disable-next-line no-console
    console.log(
      [
        `[sms:dev] ${message.category ?? 'general'}`,
        `  to:   ${message.to}`,
        `  body: ${message.body}`,
      ].join('\n'),
    );
    return;
  }

  // Real providers slot in here. Keeping the call sites stable so payment
  // decisions don't ripple through the codebase.
  // eslint-disable-next-line no-console
  console.warn(`[sms] provider '${provider}' is not implemented; falling back to console`);
  // eslint-disable-next-line no-console
  console.log(
    [
      `[sms:fallback] ${message.category ?? 'general'}`,
      `  to:   ${message.to}`,
      `  body: ${message.body}`,
    ].join('\n'),
  );
}
