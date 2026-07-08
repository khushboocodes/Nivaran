import { useMemo } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { AlertTriangle, Zap, Clock } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { useComplaints } from '../../contexts/ComplaintContext';
import { useScopedComplaints } from '../../contexts/DepartmentScopeContext';
import { getStatusColor } from '../../../lib/badge-colors';
import { differenceInDays } from 'date-fns';

export default function AdminEscalation() {
  const { complaints: allComplaints } = useComplaints();
  const complaints = useScopedComplaints(allComplaints);

  const escalatedList = useMemo(
    () => complaints.filter((c) => c.priority === 'Critical' && c.status !== 'Resolved'),
    [complaints],
  );

  const criticalList = useMemo(
    () => complaints.filter((c) => c.priority === 'Critical'),
    [complaints],
  );

  const overdueList = useMemo(() => {
    const now = new Date();
    return complaints.filter(
      (c) => c.status !== 'Resolved' && differenceInDays(now, c.submittedAt) > 7,
    );
  }, [complaints]);

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Escalation Center</h1>
          <p className="text-sm text-[#7C8AA5]">Manage critical and escalated complaints requiring immediate attention</p>
        </div>

        {/* Alert Cards - 3 cards side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-gradient-to-br from-[#FEE2E2] to-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#EF4444] flex items-center justify-center flex-shrink-0 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-2xl font-bold text-[#EF4444] mb-0.5">{escalatedList.length}</div>
                <div className="text-xs text-[#0F172A] font-medium">Escalated</div>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-gradient-to-br from-[#FEF6E6] to-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#F5A524] flex items-center justify-center flex-shrink-0 shadow-sm">
                <Zap className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-2xl font-bold text-[#F5A524] mb-0.5">{criticalList.length}</div>
                <div className="text-xs text-[#0F172A] font-medium">Critical Priority</div>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-gradient-to-br from-[#FEF6E6] to-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#F5A524] flex items-center justify-center flex-shrink-0 shadow-sm">
                <Clock className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-2xl font-bold text-[#F5A524] mb-0.5">{overdueList.length}</div>
                <div className="text-xs text-[#0F172A] font-medium">Overdue &gt;7 days</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Management Panels */}
        <div className="space-y-5">
          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-center gap-2.5 mb-4">
              <AlertTriangle className="w-[18px] h-[18px] text-[#EF4444]" strokeWidth={2} />
              <h3 className="font-semibold text-[#0F172A] text-sm">Escalated Complaints</h3>
              <Badge variant="secondary" className="ml-auto bg-[#F4F7FB] text-[#7C8AA5] text-xs font-medium rounded-full px-2.5">{escalatedList.length}</Badge>
            </div>
            {escalatedList.length > 0 ? (
              <div className="space-y-1">
                {escalatedList.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-[#E5EAF3] last:border-0">
                    <div className="min-w-0 pr-4">
                      <div className="text-sm font-medium text-[#0F172A] truncate">{c.title}</div>
                      <div className="text-xs text-[#7C8AA5]">{c.id} • {c.department}</div>
                    </div>
                    <Badge className={getStatusColor(c.status)}>{c.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-[#7C8AA5] text-sm">
                No complaints in this category
              </div>
            )}
          </Card>

          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-center gap-2.5 mb-4">
              <Zap className="w-[18px] h-[18px] text-[#F5A524]" strokeWidth={2} />
              <h3 className="font-semibold text-[#0F172A] text-sm">Critical Priority</h3>
              <Badge variant="secondary" className="ml-auto bg-[#F4F7FB] text-[#7C8AA5] text-xs font-medium rounded-full px-2.5">{criticalList.length}</Badge>
            </div>
            {criticalList.length > 0 ? (
              <div className="space-y-1">
                {criticalList.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-[#E5EAF3] last:border-0">
                    <div className="min-w-0 pr-4">
                      <div className="text-sm font-medium text-[#0F172A] truncate">{c.title}</div>
                      <div className="text-xs text-[#7C8AA5]">{c.id} • {c.department}</div>
                    </div>
                    <Badge className={getStatusColor(c.status)}>{c.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-[#7C8AA5] text-sm">
                No complaints in this category
              </div>
            )}
          </Card>

          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-center gap-2.5 mb-4">
              <Clock className="w-[18px] h-[18px] text-[#F5A524]" strokeWidth={2} />
              <h3 className="font-semibold text-[#0F172A] text-sm">Overdue (&gt;7 days)</h3>
              <Badge variant="secondary" className="ml-auto bg-[#F4F7FB] text-[#7C8AA5] text-xs font-medium rounded-full px-2.5">{overdueList.length}</Badge>
            </div>
            {overdueList.length > 0 ? (
              <div className="space-y-1">
                {overdueList.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-[#E5EAF3] last:border-0">
                    <div className="min-w-0 pr-4">
                      <div className="text-sm font-medium text-[#0F172A] truncate">{c.title}</div>
                      <div className="text-xs text-[#7C8AA5]">{c.id} • {c.department}</div>
                    </div>
                    <Badge className={getStatusColor(c.status)}>{c.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-[#7C8AA5] text-sm">
                No complaints in this category
              </div>
            )}
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
