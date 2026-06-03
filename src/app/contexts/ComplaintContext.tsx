import { createContext, useContext, useMemo, ReactNode } from 'react';

import {
  useComplaintsQuery,
  useNotificationsQuery,
  useSubmitComplaint,
  useUpdateStatus,
  useUpdateComplaint as useUpdateComplaintMutation,
  useEscalateComplaint,
  useResolveComplaint,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../../lib/api/hooks';

/**
 * Canonical client-side complaint shape. Kept here for backwards
 * compatibility with every existing UI consumer. The hooks in
 * `src/lib/api/hooks.ts` convert the wire-shaped `@nivaran/shared`
 * Complaint into this shape on read and forward only the wire-shaped
 * fields on write.
 */
export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  department: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Submitted' | 'Under Review' | 'Assigned' | 'In Progress' | 'Resolved';
  sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Highly Negative';
  aiConfidence: number;
  aiSummary: string;
  location?: string;
  submittedAt: Date;
  updatedAt: Date;
  estimatedResolution?: string;
  /**
   * Optional officer name or email the complaint has been assigned to.
   * Set by the admin "Assign to officer" action — additive field, safe for
   * existing data that omits it.
   */
  assignee?: string;
  /**
   * Optional geocoordinates set when the citizen used "Use my location"
   * on submit. Used by the admin Heatmap.
   */
  lat?: number | null;
  lng?: number | null;
}

export interface Notification {
  id: string;
  type: 'submitted' | 'status_updated' | 'assigned' | 'resolved' | 'escalated';
  message: string;
  complaintId: string;
  timestamp: Date;
  read: boolean;
}

interface ComplaintContextType {
  complaints: Complaint[];
  notifications: Notification[];
  addComplaint: (complaint: Omit<Complaint, 'id' | 'submittedAt' | 'updatedAt'>) => Promise<Complaint>;
  updateComplaintStatus: (id: string, status: Complaint['status']) => void;
  updateComplaint: (id: string, updates: Partial<Complaint>) => void;
  escalateComplaint: (id: string) => void;
  resolveComplaint: (id: string) => void;
  getComplaintById: (id: string) => Complaint | undefined;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  getStats: () => {
    total: number;
    pending: number;
    resolved: number;
    escalated: number;
  };
  getCategoryStats: () => Record<string, number>;
  getPriorityStats: () => Record<string, number>;
}

const ComplaintContext = createContext<ComplaintContextType | undefined>(undefined);

/**
 * Provider for the legacy {@link useComplaints} context API.
 *
 * Internally this is now a thin shim over the React Query hooks in
 * `src/lib/api/hooks.ts`. The provider keeps the original public surface so
 * every existing consumer continues to work unchanged:
 *
 * - `complaints` and `notifications` come from the corresponding query
 *   hooks. They default to `[]` while the queries are still loading so
 *   consumers never see `undefined`.
 * - `addComplaint` stays synchronous: it constructs the new `Complaint`
 *   inline (matching the adapter's id/timestamp shape), fires the mutation
 *   in the background to persist it, and returns the constructed object so
 *   call sites can read `complaint.id` immediately. The mutation's
 *   `onSuccess` invalidates the relevant queries so the list refreshes.
 * - The other mutators (`updateComplaintStatus`, `updateComplaint`,
 *   `escalateComplaint`, `resolveComplaint`, `markNotificationAsRead`) are
 *   fire-and-forget wrappers around `mutate`, preserving their original
 *   `void`-returning signatures.
 * - `getComplaintById` reads from the cached list (not the query cache) so
 *   it stays purely synchronous.
 * - `getStats`, `getCategoryStats`, and `getPriorityStats` derive their
 *   values from the cached `complaints` array, mirroring the original
 *   logic and staying consistent with the list after every invalidation.
 */
export function ComplaintProvider({ children }: { children: ReactNode }) {
  const complaintsQuery = useComplaintsQuery();
  const notificationsQuery = useNotificationsQuery();

  const submitMutation = useSubmitComplaint();
  const updateStatusMutation = useUpdateStatus();
  const updateMutation = useUpdateComplaintMutation();
  const escalateMutation = useEscalateComplaint();
  const resolveMutation = useResolveComplaint();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const complaints = complaintsQuery.data ?? [];
  const notifications = notificationsQuery.data ?? [];

  const value = useMemo<ComplaintContextType>(() => {
    const addComplaint: ComplaintContextType['addComplaint'] = async (complaintData) => {
      // The server is the source of truth for id, timestamps, and so on.
      // We forward both the user-entered fields and the AI metadata the
      // citizen page already classified in the browser, so the row lands
      // with real `aiConfidence`, `priority`, `sentiment`, and `aiSummary`.
      const extras = complaintData as Partial<{ lat: number; lng: number }>;
      const created = await submitMutation.mutateAsync({
        title: complaintData.title,
        description: complaintData.description,
        category: complaintData.category,
        language: 'en',
        location: complaintData.location,
        lat: typeof extras.lat === 'number' ? extras.lat : undefined,
        lng: typeof extras.lng === 'number' ? extras.lng : undefined,
        // The legacy shape carries the AI fields from SubmitComplaint.tsx;
        // hand them off as-is and let the hook handle confidence scaling.
        priority: complaintData.priority,
        sentiment: complaintData.sentiment,
        aiConfidence: complaintData.aiConfidence,
        aiSummary: complaintData.aiSummary,
      } as never);
      return created;
    };

    const updateComplaintStatus: ComplaintContextType['updateComplaintStatus'] = (id, status) => {
      updateStatusMutation.mutate({ id, status });
    };

    const updateComplaint: ComplaintContextType['updateComplaint'] = (id, updates) => {
      updateMutation.mutate({ id, patch: updates });
    };

    const escalateComplaint: ComplaintContextType['escalateComplaint'] = (id) => {
      escalateMutation.mutate(id);
    };

    const resolveComplaint: ComplaintContextType['resolveComplaint'] = (id) => {
      resolveMutation.mutate(id);
    };

    const getComplaintById: ComplaintContextType['getComplaintById'] = (id) => {
      return complaints.find((c) => c.id === id);
    };

    const markNotificationAsRead: ComplaintContextType['markNotificationAsRead'] = (id) => {
      markReadMutation.mutate(id);
    };

    const markAllNotificationsAsRead: ComplaintContextType['markAllNotificationsAsRead'] = () => {
      markAllReadMutation.mutate();
    };

    const getStats: ComplaintContextType['getStats'] = () => ({
      total: complaints.length,
      pending: complaints.filter(
        (c) => c.status === 'Submitted' || c.status === 'Under Review',
      ).length,
      resolved: complaints.filter((c) => c.status === 'Resolved').length,
      escalated: complaints.filter((c) => c.priority === 'Critical').length,
    });

    const getCategoryStats: ComplaintContextType['getCategoryStats'] = () => {
      const stats: Record<string, number> = {};
      for (const complaint of complaints) {
        stats[complaint.category] = (stats[complaint.category] ?? 0) + 1;
      }
      return stats;
    };

    const getPriorityStats: ComplaintContextType['getPriorityStats'] = () => {
      const stats: Record<string, number> = {};
      for (const complaint of complaints) {
        stats[complaint.priority] = (stats[complaint.priority] ?? 0) + 1;
      }
      return stats;
    };

    return {
      complaints,
      notifications,
      addComplaint,
      updateComplaintStatus,
      updateComplaint,
      escalateComplaint,
      resolveComplaint,
      getComplaintById,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      getStats,
      getCategoryStats,
      getPriorityStats,
    };
  }, [
    complaints,
    notifications,
    submitMutation,
    updateStatusMutation,
    updateMutation,
    escalateMutation,
    resolveMutation,
    markReadMutation,
    markAllReadMutation,
  ]);

  return <ComplaintContext.Provider value={value}>{children}</ComplaintContext.Provider>;
}

export function useComplaints() {
  const context = useContext(ComplaintContext);
  if (!context) {
    throw new Error('useComplaints must be used within ComplaintProvider');
  }
  return context;
}
