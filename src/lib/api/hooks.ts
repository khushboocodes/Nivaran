/**
 * React Query hooks for the Nivaran complaint and notification APIs.
 *
 * These hooks talk to the live HTTP API via {@link apiClient}.
 * The server is the source of truth for complaints and notifications.
 *
 * Wire vs. legacy shapes:
 *   The `@nivaran/shared` types describe the wire shape (ISO date strings,
 *   `estimatedResolutionAt`, `Notification.createdAt`, etc.). The legacy
 *   in-app types in `ComplaintContext` (real `Date` objects,
 *   `estimatedResolution: string`, `Notification.timestamp`) are what every
 *   existing UI component reads. To keep the call sites untouched, the
 *   hooks below convert wire shapes into legacy shapes inside `queryFn`
 *   and after each mutation. Mutations accept legacy-shaped input from
 *   call sites and forward only the wire fields the server expects.
 *
 * Query-key strategy:
 *
 *   ['complaints']                      — list (unfiltered)
 *   ['complaints', filter]              — list (filtered)
 *   ['complaints', id]                  — single complaint
 *   ['notifications']                   — notification list
 *
 * A single `invalidateQueries({ queryKey: ['complaints'] })` after a
 * mutation refreshes lists and single-record queries at once.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';

import { apiClient, ApiError } from './client';
import type {
  Complaint as WireComplaint,
  ComplaintListQuery as WireFilter,
  Notification as WireNotification,
} from '@nivaran/shared';
import type {
  Complaint as LegacyComplaint,
  Notification as LegacyNotification,
} from '../../app/contexts/ComplaintContext';

// ---------------------------------------------------------------------------
// Legacy shape conversion
// ---------------------------------------------------------------------------

/**
 * Convert a wire-shaped complaint (ISO date strings) to the legacy in-app
 * shape (Date objects, `estimatedResolution: string` not `estimatedResolutionAt`).
 * The conversion is intentionally lossy in the same direction the legacy
 * shape was — we drop fields the legacy UI doesn't display and add the
 * `estimatedResolution: string | undefined` text view for the modal.
 */
function toLegacyComplaint(c: WireComplaint): LegacyComplaint {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    category: c.category,
    department: c.department ?? c.departmentId,
    priority: c.priority,
    status: c.status,
    sentiment: c.sentiment,
    aiConfidence: typeof c.aiConfidence === 'number' && c.aiConfidence <= 1
      ? Math.round(c.aiConfidence * 100)
      : Math.round(c.aiConfidence),
    aiSummary: c.aiSummary ?? '',
    location: c.location ?? undefined,
    submittedAt: new Date(c.submittedAt),
    updatedAt: new Date(c.updatedAt),
    estimatedResolution: c.estimatedResolutionAt
      ? new Date(c.estimatedResolutionAt).toLocaleDateString()
      : undefined,
    lat: c.lat ?? null,
    lng: c.lng ?? null,
  };
}

/**
 * Convert a wire-shaped notification to the legacy shape:
 *  - `createdAt` (string) → `timestamp` (Date)
 *  - `userId` is dropped (the legacy UI doesn't render it)
 */
function toLegacyNotification(n: WireNotification): LegacyNotification {
  return {
    id: n.id,
    type: n.type,
    message: n.message,
    complaintId: n.complaintId,
    timestamp: new Date(n.createdAt),
    read: n.read,
  };
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const keys = {
  complaints: ['complaints'] as const,
  complaintsList: (filter?: WireFilter) =>
    filter && Object.keys(filter).length > 0
      ? (['complaints', filter] as const)
      : (['complaints'] as const),
  complaint: (id: string) => ['complaints', id] as const,
  notifications: ['notifications'] as const,
};

export const complaintQueryKeys = keys;

// ---------------------------------------------------------------------------
// Server response shapes
// ---------------------------------------------------------------------------

interface ComplaintListResponse {
  items: WireComplaint[];
  page: number;
  pageSize: number;
  total: number;
}

interface NotificationListResponse {
  items: WireNotification[];
  unread: number;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function useInvalidateAll(): () => Promise<void> {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.complaints }),
      queryClient.invalidateQueries({ queryKey: keys.notifications }),
    ]);
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useComplaintsQuery(
  filter?: WireFilter,
  options?: Omit<UseQueryOptions<LegacyComplaint[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<LegacyComplaint[]>({
    queryKey: keys.complaintsList(filter),
    queryFn: async () => {
      const r = await apiClient.get<ComplaintListResponse>('/complaints', {
        query: filter as Record<string, string | number | boolean | undefined>,
      });
      return r.items.map(toLegacyComplaint);
    },
    ...options,
  });
}

export function useComplaintQuery(
  id: string | undefined,
  options?: Omit<UseQueryOptions<LegacyComplaint | undefined>, 'queryKey' | 'queryFn' | 'enabled'>,
) {
  return useQuery<LegacyComplaint | undefined>({
    queryKey: keys.complaint(id ?? ''),
    queryFn: async () => {
      if (!id) return undefined;
      try {
        const w = await apiClient.get<WireComplaint>(`/complaints/${id}`);
        return toLegacyComplaint(w);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return undefined;
        throw err;
      }
    },
    enabled: !!id,
    ...options,
  });
}

export function useNotificationsQuery(
  options?: Omit<UseQueryOptions<LegacyNotification[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<LegacyNotification[]>({
    queryKey: keys.notifications,
    queryFn: async () => {
      const r = await apiClient.get<NotificationListResponse>('/notifications');
      return r.items.map(toLegacyNotification);
    },
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Body for `POST /api/complaints`. Mirrors `ComplaintCreateSchema` on the
 * server (`title`, `description`, `category`, optional `language`,
 * `location`, `lat`, `lng`, plus the AI fields when the client has
 * already classified the description in the browser).
 */
type SubmitInput = {
  title: string;
  description: string;
  category: string;
  language?: string;
  location?: string;
  lat?: number;
  lng?: number;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  sentiment?: 'Positive' | 'Neutral' | 'Negative' | 'Highly Negative';
  aiConfidence?: number;
  aiSummary?: string;
};

export function useSubmitComplaint(
  options?: UseMutationOptions<LegacyComplaint, ApiError, SubmitInput | LegacyComplaint>,
) {
  const invalidate = useInvalidateAll();
  return useMutation<LegacyComplaint, ApiError, SubmitInput | LegacyComplaint>({
    mutationFn: async (input) => {
      // Accept either a fresh SubmitInput from a future call site OR a
      // fully-formed legacy Complaint passed by ComplaintContext.addComplaint.
      // In both cases we send only the wire-shaped fields the server expects.
      const anyInput = input as Record<string, unknown>;
      const body: SubmitInput = 'title' in input
        ? {
            title: input.title,
            description: input.description,
            category: input.category,
            language: typeof anyInput.language === 'string' ? (anyInput.language as string) : undefined,
            location: input.location ?? undefined,
            lat: typeof anyInput.lat === 'number' ? (anyInput.lat as number) : undefined,
            lng: typeof anyInput.lng === 'number' ? (anyInput.lng as number) : undefined,
            // Forward AI metadata the citizen dashboard already classified
            // in the browser. The legacy shape stores confidence as 0..100;
            // the wire schema expects 0..1, so divide here.
            priority: typeof anyInput.priority === 'string'
              ? (anyInput.priority as SubmitInput['priority'])
              : undefined,
            sentiment: typeof anyInput.sentiment === 'string'
              ? (anyInput.sentiment as SubmitInput['sentiment'])
              : undefined,
            aiConfidence: typeof anyInput.aiConfidence === 'number'
              ? Math.max(0, Math.min(1, (anyInput.aiConfidence as number) / 100))
              : undefined,
            aiSummary: typeof anyInput.aiSummary === 'string'
              ? (anyInput.aiSummary as string)
              : undefined,
          }
        : (input as SubmitInput);
      const wire = await apiClient.post<WireComplaint>('/complaints', body);
      return toLegacyComplaint(wire);
    },
    ...options,
    onSuccess: async (data, variables, context) => {
      await invalidate();
      await options?.onSuccess?.(data, variables, context);
    },
  });
}

export function useUpdateStatus(
  options?: UseMutationOptions<LegacyComplaint, ApiError, { id: string; status: LegacyComplaint['status'] }>,
) {
  const invalidate = useInvalidateAll();
  return useMutation<LegacyComplaint, ApiError, { id: string; status: LegacyComplaint['status'] }>({
    mutationFn: async ({ id, status }) => {
      const wire = await apiClient.patch<WireComplaint>(`/complaints/${id}`, { status });
      return toLegacyComplaint(wire);
    },
    ...options,
    onSuccess: async (data, variables, context) => {
      await invalidate();
      await options?.onSuccess?.(data, variables, context);
    },
  });
}

export function useUpdateComplaint(
  options?: UseMutationOptions<LegacyComplaint, ApiError, { id: string; patch: Partial<LegacyComplaint> }>,
) {
  const invalidate = useInvalidateAll();
  return useMutation<LegacyComplaint, ApiError, { id: string; patch: Partial<LegacyComplaint> }>({
    mutationFn: async ({ id, patch }) => {
      // The legacy patch shape is a superset of the server's accepted PATCH
      // input. Forward only the supported keys.
      const body: Record<string, unknown> = {};
      if (patch.status !== undefined) body.status = patch.status;
      if (patch.priority !== undefined) body.priority = patch.priority;
      if ((patch as { assignee?: string | null }).assignee !== undefined) {
        body.assigneeId = (patch as { assignee?: string | null }).assignee ?? null;
      }
      if (patch.category !== undefined) body.category = patch.category;
      const wire = await apiClient.patch<WireComplaint>(`/complaints/${id}`, body);
      return toLegacyComplaint(wire);
    },
    ...options,
    onSuccess: async (data, variables, context) => {
      await invalidate();
      await options?.onSuccess?.(data, variables, context);
    },
  });
}

export function useEscalateComplaint(
  options?: UseMutationOptions<LegacyComplaint, ApiError, string>,
) {
  const invalidate = useInvalidateAll();
  return useMutation<LegacyComplaint, ApiError, string>({
    mutationFn: async (id) => {
      const wire = await apiClient.post<WireComplaint>(`/complaints/${id}/escalate`);
      return toLegacyComplaint(wire);
    },
    ...options,
    onSuccess: async (data, variables, context) => {
      await invalidate();
      await options?.onSuccess?.(data, variables, context);
    },
  });
}

export function useResolveComplaint(
  options?: UseMutationOptions<LegacyComplaint, ApiError, string>,
) {
  const invalidate = useInvalidateAll();
  return useMutation<LegacyComplaint, ApiError, string>({
    mutationFn: async (id) => {
      const wire = await apiClient.post<WireComplaint>(`/complaints/${id}/resolve`);
      return toLegacyComplaint(wire);
    },
    ...options,
    onSuccess: async (data, variables, context) => {
      await invalidate();
      await options?.onSuccess?.(data, variables, context);
    },
  });
}

export function useMarkNotificationRead(
  options?: UseMutationOptions<LegacyNotification, ApiError, string>,
) {
  const invalidate = useInvalidateAll();
  return useMutation<LegacyNotification, ApiError, string>({
    mutationFn: async (id) => {
      const wire = await apiClient.post<WireNotification>(`/notifications/${id}/read`);
      return toLegacyNotification(wire);
    },
    ...options,
    onSuccess: async (data, variables, context) => {
      await invalidate();
      await options?.onSuccess?.(data, variables, context);
    },
  });
}

export function useMarkAllNotificationsRead(
  options?: UseMutationOptions<{ updated: number }, ApiError, void>,
) {
  const invalidate = useInvalidateAll();
  return useMutation<{ updated: number }, ApiError, void>({
    mutationFn: () => apiClient.post<{ updated: number }>('/notifications/read-all'),
    ...options,
    onSuccess: async (data, variables, context) => {
      await invalidate();
      await options?.onSuccess?.(data, variables, context);
    },
  });
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

interface WireFeedback {
  id: string;
  complaintId: string;
  citizenId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  complaint?: { id: string; title: string; category: string } | null;
}

interface FeedbackListResponse {
  items: WireFeedback[];
}

export interface FeedbackStats {
  average: number;
  total: number;
  satisfactionRate: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  byCategory: { category: string; average: number; count: number }[];
  recent: {
    id: string;
    complaintId: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    citizenName: string | null;
    complaint: { id: string; title: string; category: string } | null;
  }[];
}

export function useFeedbackStatsQuery(
  options?: Omit<UseQueryOptions<FeedbackStats>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<FeedbackStats>({
    queryKey: ['feedback', 'stats'],
    queryFn: () => apiClient.get<FeedbackStats>('/feedback/stats'),
    ...options,
  });
}

export function useMyFeedbackQuery() {
  return useQuery<WireFeedback[]>({
    queryKey: ['feedback', 'mine'],
    queryFn: async () => {
      const r = await apiClient.get<FeedbackListResponse>('/feedback');
      return r.items;
    },
  });
}

export function useSubmitFeedback(
  options?: UseMutationOptions<
    WireFeedback,
    ApiError,
    { complaintId: string; rating: number; comment?: string }
  >,
) {
  const queryClient = useQueryClient();
  return useMutation<
    WireFeedback,
    ApiError,
    { complaintId: string; rating: number; comment?: string }
  >({
    mutationFn: (input) => apiClient.post<WireFeedback>('/feedback', input),
    ...options,
    onSuccess: async (data, variables, context) => {
      await queryClient.invalidateQueries({ queryKey: ['feedback'] });
      await options?.onSuccess?.(data, variables, context);
    },
  });
}

// ---------------------------------------------------------------------------
// Spec-friendly aliases
// ---------------------------------------------------------------------------

export {
  useComplaintsQuery as useComplaints,
  useComplaintQuery as useComplaint,
  useEscalateComplaint as useEscalate,
  useResolveComplaint as useResolve,
  useMarkNotificationRead as useMarkRead,
};
