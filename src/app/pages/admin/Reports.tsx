import { useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { Bot, Calendar, Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api/client';

type ReportType = 'category' | 'priority' | 'status' | 'department';

interface ReportResponse {
  type: ReportType;
  days: number;
  total: number;
  resolved: number;
  resolutionRate: number;
  rows: { key: string; count: number }[];
}

export default function AdminReports() {
  const [reportType, setReportType] = useState<ReportType>('category');
  const [dateRangeDays, setDateRangeDays] = useState('30');
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null);

  const reportQuery = useQuery<ReportResponse>({
    queryKey: ['reports', reportType, dateRangeDays],
    queryFn: () =>
      apiClient.get<ReportResponse>('/reports', {
        query: { type: reportType, days: dateRangeDays, format: 'json' },
      }),
  });

  const data = reportQuery.data;
  const total = data?.total ?? 0;
  const resolved = data?.resolved ?? 0;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const rows = data?.rows ?? [];

  const downloadReport = async (format: 'pdf' | 'csv') => {
    setDownloading(format);
    try {
      // Build the URL through the same /api proxy used by apiClient so the
      // session cookie is sent. We hit the API directly here so the browser
      // can stream the binary response into a file save.
      const params = new URLSearchParams({
        type: reportType,
        days: dateRangeDays,
        format,
      });
      const res = await fetch(`/api/reports?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nivaran-${reportType}-${dateRangeDays}d.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('Could not download report. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Reports</h1>
          <p className="text-sm text-[#7C8AA5]">Generate and export governance reports</p>
        </div>

        {/* Controls */}
        <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white mb-5" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[180px] space-y-1.5">
              <label className="text-xs font-medium text-[#0F172A]">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="w-full h-10 px-3.5 border border-[#E5EAF3] rounded-[14px] bg-white text-[#0F172A] text-sm focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
              >
                <option value="category">By Category</option>
                <option value="priority">By Priority</option>
                <option value="status">By Status</option>
                <option value="department">By Department</option>
              </select>
            </div>

            <div className="flex-1 min-w-[180px] space-y-1.5">
              <label className="text-xs font-medium text-[#0F172A]">Date Range</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#7C8AA5]" strokeWidth={2} />
                <select
                  value={dateRangeDays}
                  onChange={(e) => setDateRangeDays(e.target.value)}
                  className="w-full h-10 pl-10 pr-3.5 border border-[#E5EAF3] rounded-[14px] bg-white text-[#0F172A] text-sm focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
                >
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="365">Last year</option>
                </select>
              </div>
            </div>

            <Button
              onClick={() => downloadReport('pdf')}
              disabled={downloading !== null || reportQuery.isLoading}
              className="bg-[#2F5BFF] hover:bg-[#2549D9] h-10 px-5 rounded-[14px] text-sm shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {downloading === 'pdf' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={2} />
              ) : (
                <Bot className="w-4 h-4 mr-2" strokeWidth={2} />
              )}
              Generate AI Report
            </Button>

            <Button
              variant="outline"
              onClick={() => downloadReport('csv')}
              disabled={downloading !== null || reportQuery.isLoading}
              className="h-10 px-4 rounded-[14px] text-sm border-[#E5EAF3] text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {downloading === 'csv' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={2} />
              ) : (
                <FileText className="w-4 h-4 mr-2" strokeWidth={2} />
              )}
              CSV
            </Button>

            <Button
              variant="outline"
              onClick={() => downloadReport('pdf')}
              disabled={downloading !== null || reportQuery.isLoading}
              className="h-10 px-4 rounded-[14px] text-sm border-[#E5EAF3] text-[#0F172A] hover:bg-[#F8FAFC] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {downloading === 'pdf' ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={2} />
              ) : (
                <Download className="w-4 h-4 mr-2" strokeWidth={2} />
              )}
              PDF
            </Button>
          </div>
        </Card>

        {/* Stats Row - 3 cards side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
          <Card className="p-4 border-[#E5EAF3] rounded-[20px] bg-white text-center" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="text-2xl font-bold text-[#0F172A] mb-0.5">{total}</div>
            <div className="text-xs text-[#7C8AA5] font-medium">Total Complaints</div>
          </Card>

          <Card className="p-4 border-[#E5EAF3] rounded-[20px] bg-white text-center" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="text-2xl font-bold text-[#0F172A] mb-0.5">{resolved}</div>
            <div className="text-xs text-[#7C8AA5] font-medium">Resolved</div>
          </Card>

          <Card className="p-4 border-[#E5EAF3] rounded-[20px] bg-white text-center" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="text-2xl font-bold text-[#0F172A] mb-0.5">{resolutionRate}%</div>
            <div className="text-xs text-[#7C8AA5] font-medium">Resolution Rate</div>
          </Card>
        </div>

        {/* Report Content */}
        <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
          <h3 className="font-semibold text-[#0F172A] mb-4 text-sm">Report Preview</h3>
          {reportQuery.isLoading ? (
            <div className="h-52 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-[#2F5BFF] animate-spin" strokeWidth={2} />
            </div>
          ) : rows.length > 0 ? (
            <div className="h-52 overflow-auto space-y-2 pr-1">
              {rows.map(({ key, count }) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-[#0F172A]">{key}</span>
                  <span className="font-semibold text-[#0F172A]">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center">
              <div className="text-sm text-[#7C8AA5]">No complaints in this window</div>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
