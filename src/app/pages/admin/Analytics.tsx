import { useMemo, useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { Bot, Loader2, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api/client';
import { useDepartmentScope } from '../../contexts/DepartmentScopeContext';

/**
 * Server-computed aggregates. Analytics previously derived every breakdown from
 * the complaint list in the client cache — a single page of 25 rows — so with
 * ~150,000 complaints in the database this page reported on 25 of them. Counting
 * happens in Postgres now.
 */
interface AnalyticsStats {
  total: number;
  pending: number;
  resolved: number;
  escalated: number;
  resolutionRate: number;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  bySentiment: Record<string, number>;
  criticalByCategory: Record<string, number>;
  byStatus: Record<string, number>;
  aiConfidence: { average: number | null; classified: number };
}

export default function AdminAnalytics() {
  const { scope } = useDepartmentScope();
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const statsQuery = useQuery<AnalyticsStats>({
    queryKey: ['complaints', 'stats', 'analytics', scope],
    queryFn: () =>
      apiClient.get<AnalyticsStats>('/complaints/stats', {
        query: scope !== 'all' ? { dept: scope } : undefined,
      }),
  });
  const stats = statsQuery.data;

  const generateAIReport = async () => {
    if (!stats || stats.total === 0) {
      alert('No complaints to analyze. Submit some complaints first.');
      return;
    }
    setIsGenerating(true);
    try {
      // The figures sent to the model are the server's aggregates over the whole
      // dataset, not a sample of it. Previously this described 25 rows while
      // implying it described everything.
      const prompt = [
        'Analyze these civic complaint statistics and provide a brief actionable report:',
        `Total complaints: ${stats.total}`,
        `Categories: ${JSON.stringify(stats.byCategory)}`,
        `Priority breakdown: ${JSON.stringify(stats.byPriority)}`,
        `Sentiment: ${JSON.stringify(stats.bySentiment)}`,
        `Status: ${JSON.stringify(stats.byStatus)}`,
        '',
        'Provide: 1) Key findings (2-3 bullet points), 2) Top concern areas, 3) Recommended actions (2-3 points). Keep it under 200 words.',
      ].join('\n');

      // Use the chat endpoint for the report
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok || !res.body) throw new Error('Failed to generate report');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let report = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 2);
          if (!frame.startsWith('data:')) continue;
          const payload = frame.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload) as { delta?: string };
            if (json.delta) report += json.delta;
          } catch { /* ignore */ }
        }
      }

      setAiReport(report || 'No report generated. Please try again.');
    } catch {
      setAiReport('Failed to generate AI report. Please ensure the AI service is configured and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const sentimentCounts = useMemo(
    () => ({
      Positive: stats?.bySentiment['Positive'] ?? 0,
      Neutral: stats?.bySentiment['Neutral'] ?? 0,
      Negative: stats?.bySentiment['Negative'] ?? 0,
      'Highly Negative': stats?.bySentiment['Highly Negative'] ?? 0,
    }),
    [stats?.bySentiment],
  );

  const priorityData = useMemo(() => {
    const p = stats?.byPriority ?? {};
    return [
      { id: 1, label: 'low', value: p.Low ?? 0 },
      { id: 2, label: 'medium', value: p.Medium ?? 0 },
      { id: 3, label: 'high', value: p.High ?? 0 },
      { id: 4, label: 'critical', value: p.Critical ?? 0 },
    ];
  }, [stats?.byPriority]);

  const categoryStats = stats?.byCategory ?? {};
  const hasCategories = Object.keys(categoryStats).length > 0;

  // Per-category urgency: the critical share of each category's own volume.
  const urgencyEntries = useMemo(() => {
    const totals = stats?.byCategory ?? {};
    const criticals = stats?.criticalByCategory ?? {};
    return Object.entries(totals).map(([category, total]) => ({
      category,
      pct: total > 0 ? Math.round(((criticals[category] ?? 0) / total) * 100) : 0,
    }));
  }, [stats?.byCategory, stats?.criticalByCategory]);

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] mb-1">AI Analytics</h1>
            <p className="text-sm text-[#7C8AA5]">Machine learning insights on complaint patterns</p>
          </div>
          <Button
            onClick={generateAIReport}
            disabled={isGenerating}
            className="bg-[#2F5BFF] hover:bg-[#2549D9] h-10 px-5 rounded-[14px] text-sm shadow-sm transition-all disabled:opacity-60"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={2} />
            ) : (
              <Bot className="w-4 h-4 mr-2" strokeWidth={2} />
            )}
            {isGenerating ? 'Generating…' : 'Generate AI Report'}
          </Button>
        </div>

        {/* Analytics Grid - 2x2 perfect grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* By Category */}
          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-[18px] h-[18px] text-[#2F5BFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              <h3 className="font-semibold text-[#0F172A] text-sm">By Category</h3>
            </div>
            {hasCategories ? (
              <div className="h-52 overflow-auto space-y-2 pr-1">
                {Object.entries(getCategoryStats()).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="text-[#0F172A]">{cat}</span>
                    <span className="font-semibold text-[#0F172A]">{count as number}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-52 flex items-center justify-center">
                <div className="text-sm text-[#7C8AA5]">No category data yet</div>
              </div>
            )}
          </Card>

          {/* Sentiment Analysis */}
          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <h3 className="font-semibold text-[#0F172A] mb-4 text-sm">Sentiment Analysis</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-[#2F5BFF]" />
                  <span className="text-sm text-[#0F172A]">Positive</span>
                </div>
                <span className="text-sm font-semibold text-[#0F172A]">{sentimentCounts['Positive']}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-[#9333EA]" />
                  <span className="text-sm text-[#0F172A]">Neutral</span>
                </div>
                <span className="text-sm font-semibold text-[#0F172A]">{sentimentCounts['Neutral']}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-[#14B86A]" />
                  <span className="text-sm text-[#0F172A]">Negative</span>
                </div>
                <span className="text-sm font-semibold text-[#0F172A]">{sentimentCounts['Negative']}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-[#F5A524]" />
                  <span className="text-sm text-[#0F172A]">Highly Negative</span>
                </div>
                <span className="text-sm font-semibold text-[#0F172A]">{sentimentCounts['Highly Negative']}</span>
              </div>
            </div>
          </Card>

          {/* Priority Breakdown */}
          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <h3 className="font-semibold text-[#0F172A] mb-4 text-sm">Priority Breakdown</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} layout="vertical" key="analytics-priority-chart">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF3" />
                  <XAxis type="number" stroke="#7C8AA5" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis dataKey="label" type="category" stroke="#7C8AA5" fontSize={10} tickLine={false} axisLine={false} />
                  <Bar dataKey="value" fill="#2F5BFF" radius={[0, 6, 6, 0]} isAnimationActive={false} name="priority" id="analytics-priority-bar" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Urgency by Category */}
          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-[18px] h-[18px] text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h3 className="font-semibold text-[#0F172A] text-sm">Urgency by Category</h3>
            </div>
            {urgencyEntries.length > 0 ? (
              <div className="h-52 overflow-auto space-y-2 pr-1">
                {urgencyEntries.map((row) => (
                  <div key={row.category} className="flex items-center justify-between text-sm">
                    <span>{row.category}</span>
                    <span className="font-semibold">{row.pct}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-52 flex items-center justify-center">
                <div className="text-sm text-[#7C8AA5]">No urgency data yet</div>
              </div>
            )}
          </Card>
        </div>
        {/* AI Report Modal */}
        {aiReport && (
          <Card className="mt-5 p-5 border-[#E5EAF3] rounded-[20px] bg-white relative" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <button
              onClick={() => setAiReport(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-[#F8FAFC] flex items-center justify-center"
            >
              <X className="w-4 h-4 text-[#7C8AA5]" strokeWidth={2} />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-5 h-5 text-[#2F5BFF]" strokeWidth={2} />
              <h3 className="font-semibold text-[#0F172A] text-sm">AI Generated Report</h3>
            </div>
            <div className="text-sm text-[#0F172A] leading-relaxed whitespace-pre-wrap">
              {aiReport}
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
