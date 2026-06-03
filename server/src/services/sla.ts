/**
 * SLA scheduler.
 *
 * Runs every 5 minutes. For every complaint that is older than
 * `escalation.escalateAfterDays`, is not already at Critical priority,
 * and isn't Resolved, we:
 *   - bump the priority to Critical
 *   - emit a notification to the citizen
 *   - write an audit row tagged `complaint.sla_escalate`
 *
 * The whole loop is one transaction per complaint so a partial failure
 * never leaves us with a state mismatch. The interval handle is
 * exported so tests / shutdown hooks can stop it cleanly.
 */

import { prisma } from '../db';
import { audit } from './audit';
import { loadSettings } from './settings';
import { sendComplaintEvent } from './email';
import { sendSms } from './sms';

const INTERVAL_MS = 5 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let inFlight = false;

export async function runSlaPass(): Promise<{ escalated: number }> {
  // Re-entrancy guard: skip if a previous pass is still running.
  if (inFlight) return { escalated: 0 };
  inFlight = true;
  try {
    const settings = await loadSettings();
    if (!settings.escalation.autoEscalateCritical) return { escalated: 0 };

    const days = settings.escalation.escalateAfterDays;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Find candidates: submitted before the cutoff, not Critical yet, not Resolved.
    const candidates = await prisma.complaint.findMany({
      where: {
        submittedAt: { lt: cutoff },
        priority: { not: 'Critical' },
        status: { not: 'Resolved' },
      },
      select: {
        id: true,
        title: true,
        citizenId: true,
        priority: true,
        submittedAt: true,
      },
      take: 100,
    });
    if (candidates.length === 0) return { escalated: 0 };

    // Use the system actor (the first admin in the DB) for the audit row
    // so the ledger is consistent. If no admin exists yet, skip — there's
    // nothing meaningful to attribute the action to.
    const sysAdmin = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: { id: true, email: true, name: true },
    });
    if (!sysAdmin) return { escalated: 0 };

    let escalated = 0;
    for (const c of candidates) {
      try {
        const updated = await prisma.$transaction(async (tx) => {
          const next = await tx.complaint.update({
            where: { id: c.id },
            data: { priority: 'Critical' },
          });
          await tx.notification.create({
            data: {
              userId: c.citizenId,
              type: 'escalated',
              message: `Complaint ${c.id} auto-escalated to Critical (no resolution after ${days} days)`,
              complaintId: c.id,
            },
          });
          await audit(
            {
              actorId: sysAdmin.id,
              action: 'complaint.sla_escalate',
              entity: 'complaint',
              entityId: c.id,
              before: { priority: c.priority },
              after: { priority: 'Critical' },
            },
            tx,
          );
          return next;
        });

        // Fire-and-forget multi-channel notifications. Failures are caught
        // inside the email/sms services so they can't break the pass.
        const citizen = await prisma.user.findUnique({
          where: { id: c.citizenId },
          select: { email: true, name: true, phone: true },
        });
        if (citizen) {
          void sendComplaintEvent({
            to: citizen.email,
            name: citizen.name,
            type: 'escalated',
            complaintId: c.id,
            title: c.title,
            message: `Auto-escalated to Critical after ${days} days without resolution.`,
          });
          if (citizen.phone) {
            void sendSms({
              to: citizen.phone,
              category: 'escalated',
              body: `Nivaran: complaint ${c.id} auto-escalated to Critical after ${days} days.`,
            });
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _ = updated;
        escalated += 1;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[sla] failed to escalate complaint', c.id, err);
      }
    }

    if (escalated > 0) {
      // eslint-disable-next-line no-console
      console.log(`[sla] escalated ${escalated} complaint${escalated > 1 ? 's' : ''}`);
    }
    return { escalated };
  } finally {
    inFlight = false;
  }
}

export function startSlaScheduler(): void {
  if (timer) return;
  // Run once on boot so an admin can see results immediately, then on the cadence.
  void runSlaPass();
  timer = setInterval(() => {
    void runSlaPass();
  }, INTERVAL_MS);
  // Keeping the interval `unref`ed lets the process exit during tests.
  timer.unref?.();
}

export function stopSlaScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
