import { describe, it, expect } from 'vitest';
import { getStatusColor, getPriorityColor } from './badge-colors';

describe('getStatusColor', () => {
  it('maps every known status to a non-empty class string', () => {
    const statuses = ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved'] as const;
    for (const s of statuses) {
      const cls = getStatusColor(s);
      expect(cls).toBeTruthy();
      expect(cls).toMatch(/bg-/);
      expect(cls).toMatch(/text-/);
    }
  });

  it('returns a fallback for unknown statuses instead of throwing', () => {
    // We pass an invalid value through `as never` to test the runtime fallback,
    // not the type system.
    const cls = getStatusColor('Mystery' as never);
    expect(typeof cls).toBe('string');
    expect(cls.length).toBeGreaterThan(0);
  });
});

describe('getPriorityColor', () => {
  it('maps every priority level to a class string', () => {
    const priorities = ['Low', 'Medium', 'High', 'Critical'] as const;
    for (const p of priorities) {
      const cls = getPriorityColor(p);
      expect(cls).toBeTruthy();
      expect(cls).toMatch(/bg-/);
    }
  });

  it('uses red for Critical so escalations stand out', () => {
    expect(getPriorityColor('Critical')).toMatch(/EF4444|red/i);
  });
});
