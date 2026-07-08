import { useMemo } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { FileText, Clock, CheckCircle2, AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { useComplaints } from '../../contexts/ComplaintContext';
import { useScopedComplaints } from '../../contexts/DepartmentScopeContext';
import { getStatusColor, getPriorityColor } from '../../../lib/badge-colors';
import { format, subDays } from 'date-fns';

export default function AdminDashboard() {
  const { complaints: allComplaints, getStats, getCategoryStats, getPriorityStats } = useComplaints();
  const complaints = useScopedComplaints(allComplaints);

  // Aggregate stats need to respect the scope too — recompute locally so
  // they don't fall back to the full unscoped list.
  const stats = useMemo(
    () => ({
      total: complaints.length,
      pending: complaints.filter(
        (c) => c.status === 'Submitted' || c.status === 'Under Review',
      ).length,
      resolved: complaints.filter((c) => c.status === 'Resolved').length,
      escalated: complaints.filter((c) => c.priority === 'Critical').length,
    }),
    [complaints],
  );
  const categoryStats = useMemo(
    () =>
      complaints.reduce<Record<string, number>>((acc, c) => {
        acc[c.category] = (acc[c.category] ?? 0) + 1;
        return acc;
      }, {}),
    [complaints],
  );
  const priorityStats = useMemo(
    () =>
      complaints.reduce<Record<string, number>>((acc, c) => {
        acc[c.priority] = (acc[c.priority] ?? 0) + 1;
        return acc;
      }, {}),
    [complaints],
  );
  // Silence unused-var linting for the destructured helpers — we keep the
  // import shape stable so the context API stays a single hook.
  void getStats;
  void getCategoryStats;
  void getPriorityStats;

  const resolutionRate =
    stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
  const criticalCount = priorityStats['Critical'] ?? 0;

  // Last 14 days of submission counts. Build day-by-day starting 13 days ago
  // so the array is already ascending by date, matching the chart's natural
  // left-to-right reading order.
  const volumeData = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const day = subDays(today, 13 - i);
      const dayStart = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
      ).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const value = complaints.filter((c) => {
        const t = c.submittedAt.getTime();
        return t >= dayStart && t < dayEnd;
      }).length;
      return { id: i + 1, date: format(day, 'MMM d'), value };
    });
  }, [complaints]);

  const recentComplaints = useMemo(
    () =>
      [...complaints]
        .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
        .slice(0, 5),
    [complaints],
  );

  const priorityTotal = Object.values(priorityStats).reduce((a, b) => a + b, 0);
  const categoryEntries = Object.entries(categoryStats);

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] mb-0.5">Overview</h1>
            <p className="text-sm text-[#7C8AA5]">AI Governance Intelligence • May 8, 2026</p>
          </div>
          <div className="flex gap-2.5">
            <Button variant="outline" className="border-[#E5EAF3] h-9 px-4 rounded-[14px] text-sm hover:border-[#2F5BFF] hover:text-[#2F5BFF] transition-all">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
              Refresh
            </Button>
            <Badge className="bg-[#DCFCE7] text-[#14B86A] hover:bg-[#DCFCE7] px-3.5 h-9 flex items-center gap-1.5 rounded-full shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-[#14B86A] animate-pulse" />
              <span className="font-medium">Live</span>
            </Badge>
          </div>
        </div>

        {/* Top Metrics Row - 4 cards side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-[#EEF4FF]">
                <FileText className="w-[18px] h-[18px] text-[#2F5BFF]" strokeWidth={2} />
              </div>
            </div>
            <div className="text-[10px] text-[#7C8AA5] mb-1.5 font-semibold uppercase tracking-wider">Total Complaints</div>
            <div className="text-3xl font-bold text-[#0F172A]">{stats.total}</div>
          </Card>

          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-[#FEF6E6]">
                <Clock className="w-[18px] h-[18px] text-[#F5A524]" strokeWidth={2} />
              </div>
            </div>
            <div className="text-[10px] text-[#7C8AA5] mb-1.5 font-semibold uppercase tracking-wider">Pending Action</div>
            <div className="text-3xl font-bold text-[#0F172A]">{stats.pending}</div>
          </Card>

          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-[#DCFCE7]">
                <CheckCircle2 className="w-[18px] h-[18px] text-[#14B86A]" strokeWidth={2} />
              </div>
            </div>
            <div className="text-[10px] text-[#7C8AA5] mb-1.5 font-semibold uppercase tracking-wider">Resolved</div>
            <div className="text-3xl font-bold text-[#0F172A] mb-1">{stats.resolved}</div>
            <div className="text-xs text-[#14B86A] flex items-center gap-1 font-medium">
              <TrendingUp className="w-3 h-3" strokeWidth={2} />
              {resolutionRate}% rate
            </div>
          </Card>

          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-[#FEE2E2]">
                <AlertTriangle className="w-[18px] h-[18px] text-[#EF4444]" strokeWidth={2} />
              </div>
            </div>
            <div className="text-[10px] text-[#7C8AA5] mb-1.5 font-semibold uppercase tracking-wider">Escalated</div>
            <div className="text-3xl font-bold text-[#0F172A]">{stats.escalated}</div>
          </Card>
        </div>

        {/* Second Metrics Row - 3 cards side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#2F5BFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#7C8AA5] mb-1 font-medium">AI Routing Accuracy</div>
                <div className="text-2xl font-bold text-[#2F5BFF] mb-0.5">94%</div>
                <div className="text-[11px] text-[#7C8AA5]">Classification confidence</div>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#FEE2E2] flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#EF4444]" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#7C8AA5] mb-1 font-medium">Critical Priority</div>
                <div className="text-2xl font-bold text-[#0F172A] mb-0.5">{criticalCount}</div>
                <div className="text-[11px] text-[#7C8AA5]">Needs urgent action</div>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#DCFCE7] flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-[#14B86A]" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#7C8AA5] mb-1 font-medium">Resolution Rate</div>
                <div className="text-2xl font-bold text-[#0F172A] mb-0.5">{resolutionRate}%</div>
                <div className="text-[11px] text-[#7C8AA5]">Of all filed complaints</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Row - 70/30 split */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5 mb-5">
          {/* Volume Chart */}
          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="mb-4">
              <h3 className="font-semibold text-[#0F172A] mb-0.5 text-sm">Complaint Volume — Last 14 Days</h3>
              <p className="text-xs text-[#7C8AA5]">Daily submissions tracked in real time</p>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={volumeData} key="dashboard-volume-chart">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#7C8AA5"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#7C8AA5"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#2F5BFF"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                    name="volume"
                    id="dashboard-volume-line"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Priority Split */}
          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="mb-4">
              <h3 className="font-semibold text-[#0F172A] mb-0.5 text-sm">Priority Split</h3>
              <p className="text-xs text-[#7C8AA5]">Distribution by urgency level</p>
            </div>
            <div className="h-44 flex items-center justify-center">
              {priorityTotal > 0 ? (
                <div className="space-y-2 self-start w-full">
                  {(['Low', 'Medium', 'High', 'Critical'] as const).map((label) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-sm text-[#0F172A]">{label}</span>
                      <span className="text-sm font-semibold text-[#0F172A]">{priorityStats[label] ?? 0}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-[#7C8AA5] text-sm">No priority data yet</div>
              )}
            </div>
          </Card>
        </div>

        {/* Bottom Row - 2 equal cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* By Category */}
          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="mb-4">
              <h3 className="font-semibold text-[#0F172A] mb-0.5 text-sm">By Category</h3>
              <p className="text-xs text-[#7C8AA5]">Volume per service area</p>
            </div>
            <div className="h-36 flex items-center justify-center">
              {categoryEntries.length > 0 ? (
                <div className="space-y-2 self-start w-full overflow-auto max-h-full">
                  {categoryEntries.map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="text-sm text-[#0F172A]">{cat}</span>
                      <span className="text-sm font-semibold text-[#0F172A]">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-[#7C8AA5] text-sm">No category data yet</div>
              )}
            </div>
          </Card>

          {/* Recent Complaints */}
          <Card className="border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="px-5 py-4 border-b border-[#E5EAF3]">
              <h3 className="font-semibold text-[#0F172A] mb-0.5 text-sm">Recent Complaints</h3>
              <p className="text-xs text-[#7C8AA5]">Latest submissions</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-[#E5EAF3] bg-[#F8FAFC]">
                  <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Complaint</TableHead>
                  <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Category</TableHead>
                  <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Priority</TableHead>
                  <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Filed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complaints.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="text-sm text-[#7C8AA5]">No complaints yet</div>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentComplaints.map((c) => (
                    <TableRow key={c.id} className="border-[#E5EAF3]">
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
                      <TableCell>
                        <div className="text-sm text-[#7C8AA5]">{format(c.submittedAt, 'MMM dd, yyyy')}</div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
