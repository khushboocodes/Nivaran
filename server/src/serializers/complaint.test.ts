import { describe, it, expect } from 'vitest';
import {
  serializeComplaint,
  statusFromWire,
  statusToWire,
  priorityFromWire,
} from './complaint';
import type { Complaint as PrismaComplaint } from '@prisma/client';

/**
 * The serializer is the boundary between Prisma's enum identifiers
 * (UnderReview, InProgress, HighlyNegative — JS-safe TS literals) and
 * the wire shape that the shared schema uses (the spaced human form).
 * Every API response funnels through here, so a regression breaks
 * filtering, rendering, and the whole admin UI.
 */
describe('status enum round-trip', () => {
  it('maps every wire form back to its Prisma identifier', () => {
    expect(statusFromWire('Submitted')).toBe('Submitted');
    expect(statusFromWire('Under Review')).toBe('UnderReview');
    expect(statusFromWire('Assigned')).toBe('Assigned');
    expect(statusFromWire('In Progress')).toBe('InProgress');
    expect(statusFromWire('Resolved')).toBe('Resolved');
  });

  it('round-trips Prisma → wire → Prisma without loss', () => {
    const all = ['Submitted', 'UnderReview', 'Assigned', 'InProgress', 'Resolved'] as const;
    for (const s of all) {
      const wire = statusToWire(s);
      expect(statusFromWire(wire)).toBe(s);
    }
  });
});

describe('priorityFromWire', () => {
  it('passes priority strings through unchanged', () => {
    expect(priorityFromWire('Low')).toBe('Low');
    expect(priorityFromWire('Medium')).toBe('Medium');
    expect(priorityFromWire('High')).toBe('High');
    expect(priorityFromWire('Critical')).toBe('Critical');
  });
});

describe('serializeComplaint', () => {
  // Build the minimum Prisma row shape the serializer reads. Anything not
  // referenced is left undefined and Prisma's strict types are widened
  // through the `as` cast.
  const submittedAt = new Date('2026-05-26T12:00:00.000Z');
  const updatedAt = new Date('2026-05-26T13:00:00.000Z');
  const baseRow = {
    id: 'cmp_1',
    citizenId: 'cit_1',
    title: 'Water leak',
    description: 'Pipe burst',
    category: 'Water Supply',
    departmentId: 'dept_1',
    assigneeId: null,
    priority: 'Medium',
    status: 'UnderReview',
    sentiment: 'Negative',
    aiConfidence: 0.85,
    aiSummary: 'High priority water leak',
    language: 'en',
    location: '12.97, 77.59',
    lat: 12.97,
    lng: 77.59,
    estimatedResolutionAt: null,
    submittedAt,
    updatedAt,
    resolvedAt: null,
  } as unknown as PrismaComplaint;

  it('translates Prisma enum identifiers to the wire form', () => {
    const w = serializeComplaint(baseRow);
    expect(w.status).toBe('Under Review');
    expect(w.sentiment).toBe('Negative');
    expect(w.priority).toBe('Medium');
  });

  it('serializes dates as ISO strings', () => {
    const w = serializeComplaint(baseRow);
    expect(w.submittedAt).toBe(submittedAt.toISOString());
    expect(w.updatedAt).toBe(updatedAt.toISOString());
    expect(w.resolvedAt).toBeNull();
  });

  it('joins department.name when the include is present', () => {
    const w = serializeComplaint({
      ...baseRow,
      department: { name: 'Water Supply Board' },
    } as unknown as Parameters<typeof serializeComplaint>[0]);
    expect(w.department).toBe('Water Supply Board');
  });

  it('returns null department when the include is missing', () => {
    const w = serializeComplaint(baseRow);
    expect(w.department).toBeNull();
  });

  it('translates HighlyNegative to the spaced wire form', () => {
    const row = { ...baseRow, sentiment: 'HighlyNegative' } as unknown as PrismaComplaint;
    expect(serializeComplaint(row).sentiment).toBe('Highly Negative');
  });
});
