import type { Complaint, Status as PrismaStatus, Priority as PrismaPriority, Sentiment as PrismaSentiment } from '@prisma/client';
import type { Priority, Sentiment, Status } from '@nivaran/shared';

/**
 * Prisma's `@map` directive on enum *values* only changes the database
 * representation — TypeScript still sees the JS-safe identifier (e.g.
 * `UnderReview`). The shared wire schema uses the spaced form
 * (`'Under Review'`), so we translate at the boundary.
 */
const STATUS_TO_WIRE: Record<PrismaStatus, Status> = {
  Submitted: 'Submitted',
  UnderReview: 'Under Review',
  Assigned: 'Assigned',
  InProgress: 'In Progress',
  Resolved: 'Resolved',
};

const STATUS_FROM_WIRE: Record<Status, PrismaStatus> = {
  Submitted: 'Submitted',
  'Under Review': 'UnderReview',
  Assigned: 'Assigned',
  'In Progress': 'InProgress',
  Resolved: 'Resolved',
};

const SENTIMENT_TO_WIRE: Record<PrismaSentiment, Sentiment> = {
  Positive: 'Positive',
  Neutral: 'Neutral',
  Negative: 'Negative',
  HighlyNegative: 'Highly Negative',
};

export function statusToWire(s: PrismaStatus): Status {
  return STATUS_TO_WIRE[s];
}

export function statusFromWire(s: Status): PrismaStatus {
  return STATUS_FROM_WIRE[s];
}

export function priorityFromWire(p: Priority): PrismaPriority {
  // Priority enum identifiers match the wire form 1:1.
  return p as PrismaPriority;
}

type ComplaintWithMaybeDepartment = Complaint & {
  department?: { name: string } | null;
};

/** Wire shape returned by the API. Mirrors `@nivaran/shared` Complaint. */
export function serializeComplaint(c: ComplaintWithMaybeDepartment) {
  return {
    id: c.id,
    citizenId: c.citizenId,
    title: c.title,
    description: c.description,
    category: c.category,
    departmentId: c.departmentId,
    department: c.department?.name ?? null,
    assigneeId: c.assigneeId,
    priority: c.priority as Priority,
    status: STATUS_TO_WIRE[c.status],
    sentiment: SENTIMENT_TO_WIRE[c.sentiment],
    aiConfidence: c.aiConfidence,
    aiSummary: c.aiSummary,
    language: c.language,
    location: c.location,
    lat: c.lat,
    lng: c.lng,
    estimatedResolutionAt: c.estimatedResolutionAt?.toISOString() ?? null,
    submittedAt: c.submittedAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    resolvedAt: c.resolvedAt?.toISOString() ?? null,
  };
}
