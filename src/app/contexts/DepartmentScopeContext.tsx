/**
 * Admin "department scope" — the value backing the sidebar selector.
 *
 *   - 'all'       → show every department (default)
 *   - <deptId>    → show only complaints in that department
 *
 * Persisted to localStorage so a refresh keeps the chosen scope.
 * Pages use {@link useDepartmentScope} to read the current id and
 * {@link useScopedComplaints} to apply the filter to a list.
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api/client';
import type { Complaint } from './ComplaintContext';

const STORAGE_KEY = 'admin.departmentScope';

interface Department {
  id: string;
  name: string;
}

interface DepartmentScopeContextValue {
  scope: string; // 'all' | departmentId
  setScope: (next: string) => void;
  departments: Department[];
  scopeLabel: string;
  isLoading: boolean;
}

const DepartmentScopeContext = createContext<DepartmentScopeContextValue | null>(null);

export function DepartmentScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScopeState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? 'all';
    } catch {
      return 'all';
    }
  });

  // Use the public departments endpoint when we have one; otherwise derive
  // the list from the complaints query (less ideal but always available).
  // The server doesn't yet expose /api/departments, so we settle for the
  // unique departments seen in the complaint feed. This keeps the change
  // local until the proper endpoint lands in a later phase.
  const departmentsQuery = useQuery<Department[]>({
    queryKey: ['admin', 'departments-from-complaints'],
    queryFn: async () => {
      const r = await apiClient.get<{ items: { departmentId: string; department?: string | null }[] }>(
        '/complaints',
        { query: { pageSize: 100 } },
      );
      const map = new Map<string, string>();
      for (const c of r.items) {
        if (!map.has(c.departmentId)) {
          map.set(c.departmentId, c.department ?? c.departmentId);
        }
      }
      return Array.from(map.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const setScope = (next: string) => {
    setScopeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore quota / private-mode failures — scope still works in memory.
    }
  };

  // If the persisted scope points at a department we no longer see, fall
  // back to 'all' rather than rendering an inert filter.
  useEffect(() => {
    if (scope === 'all' || !departmentsQuery.data) return;
    if (!departmentsQuery.data.some((d) => d.id === scope)) {
      setScope('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentsQuery.data, scope]);

  const value = useMemo<DepartmentScopeContextValue>(() => {
    const departments = departmentsQuery.data ?? [];
    const found = departments.find((d) => d.id === scope);
    return {
      scope,
      setScope,
      departments,
      scopeLabel: scope === 'all' ? 'All Departments' : found?.name ?? 'All Departments',
      isLoading: departmentsQuery.isLoading,
    };
  }, [scope, departmentsQuery.data, departmentsQuery.isLoading]);

  return (
    <DepartmentScopeContext.Provider value={value}>{children}</DepartmentScopeContext.Provider>
  );
}

export function useDepartmentScope(): DepartmentScopeContextValue {
  const ctx = useContext(DepartmentScopeContext);
  if (!ctx) {
    // Fallback when used outside the provider (e.g. in tests or non-admin
    // surfaces). Behaves as 'all' so consumers don't need to special-case.
    return {
      scope: 'all',
      setScope: () => undefined,
      departments: [],
      scopeLabel: 'All Departments',
      isLoading: false,
    };
  }
  return ctx;
}

/**
 * Apply the current department scope to a complaint list. We filter by
 * department *name* because the legacy in-app Complaint shape stores the
 * resolved name, not the id — preserves the existing call sites.
 */
export function useScopedComplaints(complaints: Complaint[]): Complaint[] {
  const { scope, departments } = useDepartmentScope();
  return useMemo(() => {
    if (scope === 'all') return complaints;
    const found = departments.find((d) => d.id === scope);
    if (!found) return complaints;
    return complaints.filter((c) => c.department === found.name);
  }, [complaints, scope, departments]);
}
