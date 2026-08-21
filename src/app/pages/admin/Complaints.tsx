import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { Search } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api/client';
import { toLegacyComplaint } from '../../../lib/api/hooks';
import { type Complaint } from '../../contexts/ComplaintContext';
import { useDepartmentScope } from '../../contexts/DepartmentScopeContext';
import { getStatusColor, getPriorityColor } from '../../../lib/badge-colors';
import ComplaintDetailsModal from '../../components/modals/ComplaintDetailsModal';
import { format } from 'date-fns';

// Map kebab-case <select> values to the canonical `Complaint` enum values.
const STATUS_FROM_OPTION: Record<string, Complaint['status']> = {
  'submitted': 'Submitted',
  'under-review': 'Under Review',
  'assigned': 'Assigned',
  'in-progress': 'In Progress',
  'resolved': 'Resolved',
};

const PRIORITY_FROM_OPTION: Record<string, Complaint['priority']> = {
  'low': 'Low',
  'medium': 'Medium',
  'high': 'High',
  'critical': 'Critical',
};

/** Page size options. Capped at 100 by the API. */
const PAGE_SIZES = [25, 50, 100];

interface ListResponse {
  items: Parameters<typeof toLegacyComplaint>[0][];
  total: number;
  page: number;
  pageSize: number;
}

export default function AdminComplaints() {
  const { scope } = useDepartmentScope();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all-status');
  const [priorityFilter, setPriorityFilter] = useState('all-priority');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  /** Debounced search term, so typing does not fire a query per keystroke. */
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Any change to the filters invalidates the current page number: staying on
  // page 7 of a narrower result set would show an empty table.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, priorityFilter, pageSize, scope]);

  /**
   * Filtering, searching and paging all happen in Postgres.
   *
   * This page used to filter the complaint list held in the client cache, which
   * meant it could only ever show and search within 25 rows out of ~150,000 — and
   * gave no indication that the rest existed.
   */
  const listQuery = useQuery<ListResponse>({
    queryKey: ['complaints', 'list', 'admin', { page, pageSize, debouncedSearch, statusFilter, priorityFilter, scope }],
    queryFn: () =>
      apiClient.get<ListResponse>('/complaints', {
        query: {
          page,
          pageSize,
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
          // 'escalated' is not a status. The system models escalation as
          // Critical priority, so the option maps to a priority filter.
          ...(statusFilter === 'escalated'
            ? { priority: 'Critical' }
            : statusFilter !== 'all-status'
              ? { status: STATUS_FROM_OPTION[statusFilter] }
              : {}),
          ...(priorityFilter !== 'all-priority' && statusFilter !== 'escalated'
            ? { priority: PRIORITY_FROM_OPTION[priorityFilter] }
            : {}),
          ...(scope !== 'all' ? { dept: scope } : {}),
        },
      }),
    // Keep the previous page visible while the next one loads, so paging does not
    // flash an empty table.
    placeholderData: keepPreviousData,
  });

  const filteredComplaints = useMemo(
    () => (listQuery.data?.items ?? []).map(toLegacyComplaint),
    [listQuery.data],
  );

  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Complaints Management</h1>
          <p className="text-sm text-[#7C8AA5]">
            {listQuery.isLoading ? (
              'Loading…'
            ) : (
              <>
                <span className="font-semibold text-[#0F172A]">
                  {total.toLocaleString('en-IN')}
                </span>{' '}
                complaint{total === 1 ? '' : 's'} match
                {total === 1 ? 'es' : ''} the current filters. Search and paging run against the
                whole dataset.
              </>
            )}
          </p>
        </div>

        <Card className="border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
          {/* Search & Filters */}
          <div className="p-5 border-b border-[#E5EAF3]">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[180px] relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#7C8AA5]" strokeWidth={2} />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search complaints..."
                  className="pl-10 border-[#E5EAF3] h-10 rounded-[14px] focus:ring-2 focus:ring-[#2F5BFF] focus:border-[#2F5BFF]"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3.5 border border-[#E5EAF3] rounded-[14px] bg-white text-[#0F172A] text-sm font-medium min-w-[150px] focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
              >
                <option value="all-status">All Status</option>
                <option value="submitted">Submitted</option>
                <option value="under-review">Under Review</option>
                <option value="assigned">Assigned</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="escalated">Escalated</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-10 px-3.5 border border-[#E5EAF3] rounded-[14px] bg-white text-[#0F172A] text-sm font-medium min-w-[150px] focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
              >
                <option value="all-priority">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow className="border-[#E5EAF3] bg-[#F8FAFC]">
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Complaint</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Category</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Priority</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Citizen</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Filed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredComplaints.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-56 text-center">
                    <div className="text-sm text-[#7C8AA5]">
                      {listQuery.isLoading
                        ? 'Loading complaints…'
                        : listQuery.isError
                          ? 'Could not load complaints. Please retry.'
                          : 'No complaints match your filters'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredComplaints.map((c) => (
                  <TableRow key={c.id} onClick={() => setSelectedComplaint(c)} className="border-[#E5EAF3] cursor-pointer">
                    <TableCell>
                      <div className="text-sm font-medium text-[#0F172A]">{c.title}</div>
                      <div className="text-xs text-[#7C8AA5]">{c.id} • {c.department}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-[#0F172A]">{c.category}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getStatusColor(c.status)} text-xs`}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getPriorityColor(c.priority)} text-xs`}>
                        {c.priority}
                      </Badge>
                    </TableCell>
                    {/* TODO: replace once auth lands */}
                    <TableCell>
                      <div className="text-sm text-[#0F172A]">You</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-[#7C8AA5]">{format(c.submittedAt, 'MMM dd, yyyy')}</div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination. Without this the table could only ever show the first
              page, with nothing on screen to suggest 149,000 more rows existed. */}
          <div className="p-4 border-t border-[#E5EAF3] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#7C8AA5] tabular-nums">
                {total === 0
                  ? 'No results'
                  : `Showing ${firstRow.toLocaleString('en-IN')}–${lastRow.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')}`}
              </span>
              {listQuery.isFetching && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7C8AA5]" />
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-[#7C8AA5]">
                Rows
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="ml-1.5 h-8 px-2 border border-[#E5EAF3] rounded-lg bg-white text-[#0F172A] text-xs"
                  aria-label="Rows per page"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || listQuery.isFetching}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#E5EAF3] text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8FAFC]"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                </button>
                <span className="text-xs text-[#0F172A] tabular-nums px-2">
                  Page {page.toLocaleString('en-IN')} of {totalPages.toLocaleString('en-IN')}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || listQuery.isFetching}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#E5EAF3] text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8FAFC]"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Complaint Details Modal */}
      {selectedComplaint && (
        <ComplaintDetailsModal
          complaint={selectedComplaint}
          isOpen={!!selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          mode="admin"
        />
      )}
    </AdminLayout>
  );
}
