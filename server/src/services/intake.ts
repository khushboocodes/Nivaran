/**
 * Channel-agnostic complaint intake.
 *
 * WHY THIS EXISTS
 * ---------------
 * Problem statement 01 asks for a platform that "aggregates citizen development
 * requests via voice, text, and messaging apps". Those are three front doors to
 * one process: classify, route to a department, resolve a district, record it,
 * notify the citizen, write an audit entry.
 *
 * That process used to live inline in `POST /api/complaints`, which meant any
 * second channel would either duplicate it or quietly skip parts of it. A
 * Telegram complaint that missed district resolution would still appear in the
 * national counters while being invisible to the planning layer — the exact
 * class of bug that is hard to notice, because nothing errors.
 *
 * So the process lives here once and every channel calls it. Adding WhatsApp or
 * SMS later is a new adapter that calls this function, not a second
 * implementation of it.
 */

import type { IntakeChannel, Prisma } from '@prisma/client';
import { prisma } from '../db';
import { resolveDepartmentByCategory } from '../services/departments';
import { resolveDistrict } from '../services/districts';
import { audit } from '../services/audit';
import { serializeComplaint } from '../serializers/complaint';
import { sendComplaintEvent } from '../services/email';

/** Wire-form sentiment, as the AI layer and shared schema express it. */
type WireSentiment = 'Positive' | 'Neutral' | 'Negative' | 'Highly Negative';

export interface IntakeInput {
  /** The citizen this complaint belongs to. */
  citizenId: string;
  /** Which front door it came through. */
  channel: IntakeChannel;
  title: string;
  description: string;
  category: string;
  language?: string;
  location?: string;
  lat?: number;
  lng?: number;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  sentiment?: WireSentiment;
  aiConfidence?: number;
  aiSummary?: string;
  /** Original-language transcript, for voice and voice-note intake. */
  sourceTranscript?: string;
  sourceLanguage?: string;
}

type ComplaintWithDept = Prisma.ComplaintGetPayload<{
  include: { department: { select: { name: true } } };
}>;

/**
 * Create a complaint from any channel.
 *
 * Returns the created row including its department, ready to serialise.
 */
export async function createComplaintFromIntake(
  input: IntakeInput,
): Promise<ComplaintWithDept> {
  const departmentId = await resolveDepartmentByCategory(input.category);

  // Attach a district so the complaint reaches the planning layer and the
  // heatmap, not just the national counters. Citizens never pick a district, so
  // it is inferred from the free-text location, falling back to their profile
  // city. Returns null rather than guessing when a name is ambiguous, because a
  // wrong district would feed another region's demand signal and distort a
  // funding recommendation.
  const author = await prisma.user.findUnique({
    where: { id: input.citizenId },
    select: { city: true, email: true, name: true },
  });
  const districtMatch = await resolveDistrict(input.location, author?.city);
  if (districtMatch) {
    // eslint-disable-next-line no-console
    console.log(
      `[intake:${input.channel}] mapped to ${districtMatch.districtName}, ` +
        `${districtMatch.stateName} via ${districtMatch.matchedOn} "${districtMatch.token}"`,
    );
  }

  // One transaction so the complaint, its first notification and its audit
  // entry land together or not at all.
  const created = await prisma.$transaction(async (tx) => {
    const complaint = await tx.complaint.create({
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        language: input.language ?? 'en',
        location: input.location,
        lat: input.lat,
        lng: input.lng,
        citizenId: input.citizenId,
        departmentId,
        channel: input.channel,
        // Null when the location could not be resolved confidently. The
        // complaint still counts nationally, it just does not appear in
        // district aggregates.
        districtId: districtMatch?.districtId ?? null,
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.sentiment !== undefined
          ? {
              sentiment:
                input.sentiment === 'Highly Negative' ? 'HighlyNegative' : input.sentiment,
            }
          : {}),
        ...(input.aiConfidence !== undefined ? { aiConfidence: input.aiConfidence } : {}),
        ...(input.aiSummary !== undefined ? { aiSummary: input.aiSummary } : {}),
        // Voice provenance: the original-language transcript sits next to the
        // translated description so the record stays auditable rather than
        // replacing the citizen's own words with a translation.
        ...(input.sourceTranscript !== undefined
          ? { sourceTranscript: input.sourceTranscript }
          : {}),
        ...(input.sourceLanguage !== undefined
          ? { sourceLanguage: input.sourceLanguage }
          : {}),
      },
      include: { department: { select: { name: true } } },
    });

    await tx.notification.create({
      data: {
        userId: input.citizenId,
        type: 'submitted',
        message: `Your complaint "${complaint.title}" has been successfully submitted`,
        complaintId: complaint.id,
      },
    });

    await audit(
      {
        actorId: input.citizenId,
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

  // Fire-and-forget. The email service swallows its own failures, so a mail
  // outage can never fail an intake that already succeeded.
  if (author?.email) {
    void sendComplaintEvent({
      to: author.email,
      name: author.name ?? 'Citizen',
      type: 'submitted',
      complaintId: created.id,
      title: created.title,
      message: `Your complaint "${created.title}" has been successfully submitted`,
    }).catch(() => undefined);
  }

  return created;
}
