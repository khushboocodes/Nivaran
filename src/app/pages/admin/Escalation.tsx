import AdminLayout from '../../components/layouts/AdminLayout';
import { AlertTriangle, Zap, Clock, Loader2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api/client';
import { useDepartmentScope } from '../../contexts/DepartmentScopeContext';
import { getStatusColor } from '../../../lib/badge-colors';

/**
 * Escalation Center.
 *
 * Previously filtered the complaint list held in the client cache — a single page
 * of 25 rows — so with ~150,000 complaints it reported 2 escalated and 0 overdue.
 * The real figures are 23,624 and 112,548. Nothing was wrong with the arithmetic;
 * it was applied to a page and presented as the whole picture.
 *
 * Counts now come from a server aggregate, and each panel loads its own page of
 * rows. "Overdue" is evaluated server-side against the same
 * `escalation.escalateAfterDays` setting the SLA scheduler uses, so this screen and
 * the scheduler cannot disagree about what is late.
 */

interface EscalationStats {
  escalated: number;
  criticalOpen: number;
  overdue: number;
}

interface ListRow {
  id: string;
  title: string;
  department?: string | null;
  status: string;
  priority: string;
  submittedAt: string;
}

interface ListResponse {
  items: ListRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** Rows shown per panel. The count in the badge is the true total. */
const PANEL_SIZE = 25;

export default function AdminEscalation() {
  const { scope } = useDepartmentScope();
  const deptQuery = scope !== 'all' ? { dept: scope } : {};

  const statsQuery = useQuery<EscalationStats>({
    queryKey: ['complaints', 'stats', 'escalation', scope],
    queryFn: () =>
      apiClient.get<EscalationStats>('/complaints/stats', {
        query: { ...deptQuery },
      }),
  });

  // Critical and still open.
  const escalatedQuery = useQuery<ListResponse>({
    queryKey: ['complaints', 'list', 'escalated', scope],
    queryFn: () =>
      apiClient.get<ListResponse>('/complaints', {
        query: { priority: 'Critical', openOnly: 'true', pageSize: PANEL_SIZE, ...deptQuery },
      }),
  });

  // All Critical, resolved included.
  const criticalQuery = useQuery<ListResponse>({
    queryKey: ['complaints', 'list', 'critical', scope],
    queryFn: () =>
      apiClient.get<ListResponse>('/complaints', {
        query: { priority: 'Critical', pageSize: PANEL_SIZE, ...deptQuery },
      }),
  });

  // Unresolved past the SLA threshold.
  const overdueQuery = useQuery<ListResponse>({
    queryKey: ['complaints', 'list', 'overdue', scope],
    queryFn: () =>
      apiClient.get<ListResponse>('/complaints', {
        query: { overdue: 'true', pageSize: PANEL_SIZE, ...deptQuery },
      }),
  });

  const stats = statsQuery.data;
  const fmt = (n: number | undefined) => (n == null ? '—' : n.toLocaleString('en-IN'));

  const panels = [
    {
      key: 'escalated',
      icon: AlertTriangle,
      iconColour: 'text-[#EF4444]',
      title: 'Escalated complaints',
      subtitle: 'Critical priority and still open',
      total: stats?.criticalOpen,
      query: escalatedQuery,
    },
    {
      key: 'critical',
      icon: Zap,
      iconColour: 'text-[#F5A524]',
      title: 'Critical priority',
      subtitle: 'All Critical complaints, including resolved',
      total: stats?.escalated,
      query: criticalQuery,
    },
    {
      key: 'overdue',
      icon: Clock,
      iconColour: 'text-[#F5A524]',
      title: 'Overdue',
      subtitle: 'Unresolved past the configured SLA threshold',
      total: stats?.overdue,
      query: overdueQuery,
    },
  ] as const;

  return (
    <AdminLayout>
      <div className="p-4 md:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Escalation Center</h1>
          <p className="text-sm text-[#7C8AA5]">
            Critical and overdue complaints requiring attention, across the full dataset
          </p>
        </div>

        {/* Headline counts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
          {[
            {
              label: 'Escalated',
              hint: 'Critical and open',
              value: stats?.criticalOpen,
              icon: AlertTriangle,
              bg: 'from-[#FEE2E2]',
              iconBg: 'bg-[#EF4444]',
              text: 'text-[#EF4444]',
            },
            {
              label: 'Critical priority',
              hint: 'Including resolved',
              value: stats?.escalated,
              icon: Zap,
              bg: 'from-[#FEF3C7]',
              iconBg: 'bg-[#F5A524]',
              text: 'text-[#F5A524]',
            },
            {
              label: 'Overdue',
              hint: 'Past the SLA threshold',
              value: stats?.overdue,
              icon: Clock,
              bg: 'from-[#FEF3C7]',
              iconBg: 'bg-[#F5A524]',
              text: 'text-[#F5A524]',
            },
          ].map((tile) => (
            <Card
              key={tile.label}
              className={`p-5 border-[#E5EAF3] rounded-[20px] bg-gradient-to-br ${tile.bg} to-white`}
              style={{ boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)' }}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-xl ${tile.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm`}
                >
                  <tile.icon className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className={`text-2xl font-bold ${tile.text} mb-0.5 tabular-nums`}>
                    {statsQuery.isLoading ? '…' : fmt(tile.value)}
                  </div>
                  <div className="text-xs text-[#0F172A] font-medium">{tile.label}</div>
                  <div className="text-[11px] text-[#7C8AA5]">{tile.hint}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Panels */}
        <div className="space-y-5">
          {panels.map((panel) => {
            const rows = panel.query.data?.items ?? [];
            const total = panel.total;
            return (
              <Card
                key={panel.key}
                className="p-5 border-[#E5EAF3] rounded-[20px] bg-white"
                style={{ boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)' }}
              >
                <div className="flex items-center gap-2.5 mb-1">
                  <panel.icon className={`w-[18px] h-[18px] ${panel.iconColour}`} strokeWidth={2} />
                  <h3 className="font-semibold text-[#0F172A] text-sm">{panel.title}</h3>
                  {panel.query.isFetching && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7C8AA5]" />
                  )}
                  <Badge
                    variant="secondary"
                    className="ml-auto bg-[#F4F7FB] text-[#7C8AA5] text-xs font-medium rounded-full px-2.5 tabular-nums"
                  >
                    {fmt(total)}
                  </Badge>
                </div>
                <p className="text-xs text-[#7C8AA5] mb-4">{panel.subtitle}</p>

                {panel.query.isError && (
                  <div className="text-center py-8 text-[#B91C1C] text-sm">
                    Could not load this list. Please retry.
                  </div>
                )}

                {!panel.query.isError && rows.length === 0 && !panel.query.isLoading && (
                  <div className="text-center py-10 text-[#7C8AA5] text-sm">
                    No complaints in this category
                  </div>
                )}

                {rows.length > 0 && (
                  <>
                    <div className="space-y-1">
                      {rows.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between py-2.5 border-b border-[#E5EAF3] last:border-0"
                        >
                          <div className="min-w-0 pr-4">
                            <div className="text-sm font-medium text-[#0F172A] truncate">
                              {c.title}
                            </div>
                            <div className="text-xs text-[#7C8AA5] truncate">
                              {c.id} • {c.department ?? 'Unassigned'} •{' '}
                              {new Date(c.submittedAt).toLocaleDateString('en-IN')}
                            </div>
                          </div>
                          <Badge className={getStatusColor(c.status)}>{c.status}</Badge>
                        </div>
                      ))}
                    </div>
                    {/* The badge shows the true total; this says what is on screen,
                        so a reader is never left thinking 25 is all there is. */}
                    {total != null && total > rows.length && (
                      <p className="mt-3 text-xs text-[#7C8AA5]">
                        Showing the {rows.length} most recent of {fmt(total)}. Use Complaints to
                        filter and page through the rest.
                      </p>
                    )}
                  </>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
