import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import CitizenLayout from '../../components/layouts/CitizenLayout';
import { FileText, Clock, CheckCircle2, AlertTriangle, Plus, Search, Bot, Bell, TrendingUp, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { useComplaints } from '../../contexts/ComplaintContext';
import { differenceInDays, formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const { t } = useTranslation(['citizen', 'common', 'status']);
  const { complaints, getStats, getCategoryStats } = useComplaints();
  const stats = getStats();

  const recentComplaints = complaints.slice(0, 5);

  // ---------------------------------------------------------------------
  // AI Insights — derived from the citizen's own complaints rather than
  // hard-coded placeholders. Falls back to dashes when there's no data.
  // ---------------------------------------------------------------------
  const insights = useMemo(() => {
    const total = complaints.length;
    const resolved = complaints.filter((c) => c.status === 'Resolved');
    const resolutionRatePct = total > 0 ? Math.round((resolved.length / total) * 100) : null;

    const classified = complaints.filter((c) => (c.aiConfidence ?? 0) > 0);
    const avgConfidence = classified.length > 0
      ? classified.reduce((acc, c) => acc + (c.aiConfidence ?? 0), 0) / classified.length
      : null;

    const categoryStats = getCategoryStats();
    const topCategoryEntry = Object.entries(categoryStats).sort(
      (a, b) => b[1] - a[1],
    )[0];
    const topCategory = topCategoryEntry?.[0] ?? null;
    const topCategoryCount = topCategoryEntry?.[1] ?? 0;

    let avgResolutionDays: number | null = null;
    if (resolved.length > 0) {
      const totalDays = resolved.reduce(
        (acc, c) => acc + Math.max(0, differenceInDays(c.updatedAt, c.submittedAt)),
        0,
      );
      avgResolutionDays = totalDays / resolved.length;
    }

    const tips: string[] = [];
    if (topCategory && topCategoryCount > 1) {
      tips.push(
        t('citizen:dashboard.insights.tipTopCategory', {
          category: topCategory,
          count: topCategoryCount,
        }),
      );
    }
    if (resolutionRatePct !== null && resolved.length > 0) {
      tips.push(
        t('citizen:dashboard.insights.tipResolutionRate', { pct: resolutionRatePct }),
      );
    }
    if (avgResolutionDays !== null) {
      const display = avgResolutionDays < 1
        ? t('common:lessThanADay')
        : `${avgResolutionDays.toFixed(1)} ${t('common:days')}`;
      tips.push(t('citizen:dashboard.insights.tipAvgDays', { display }));
    }
    if (stats.escalated > 0) {
      tips.push(
        t('citizen:dashboard.insights.tipEscalated', { count: stats.escalated }),
      );
    }
    if (tips.length < 3) {
      const generic = [
        t('citizen:dashboard.insights.tipPhotos'),
        t('citizen:dashboard.insights.tipTrack'),
        t('citizen:dashboard.insights.tipLanguage'),
      ];
      for (const g of generic) {
        if (tips.length >= 3) break;
        tips.push(g);
      }
    }

    return {
      topCategory,
      resolutionRatePct,
      avgConfidence,
      tips,
    };
  }, [complaints, getCategoryStats, stats.escalated, t]);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Water Supply': 'bg-[#3B82F6]',
      'Electricity': 'bg-[#F59E0B]',
      'Roads & Infrastructure': 'bg-[#8B5CF6]',
      'Sanitation': 'bg-[#22C55E]',
      'Drainage': 'bg-[#EC4899]',
      'Waste Management': 'bg-[#14B8A6]',
    };
    return colors[category] || 'bg-[#6B7280]';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Submitted': 'bg-[#3B82F6] text-white',
      'Under Review': 'bg-[#F59E0B] text-white',
      'Assigned': 'bg-[#8B5CF6] text-white',
      'In Progress': 'bg-[#22C55E] text-white',
      'Resolved': 'bg-[#10B981] text-white',
    };
    return colors[status] || 'bg-[#6B7280] text-white';
  };

  /**
   * Map the canonical English status label (the one stored on the
   * complaint) to the translated user-facing string. Falls back to the
   * English label if the namespace lookup misses.
   */
  const translateStatus = (s: string): string => {
    const map: Record<string, string> = {
      'Submitted': t('status:submitted'),
      'Under Review': t('status:underReview'),
      'Assigned': t('status:assigned'),
      'In Progress': t('status:inProgress'),
      'Resolved': t('status:resolved'),
    };
    return map[s] ?? s;
  };

  const resolutionRate = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;

  return (
    <CitizenLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold mb-1">
              {t('common:portalCitizen').toUpperCase()}
            </div>
            <h1 className="text-3xl font-bold text-[#0B1220]">{t('citizen:dashboard.welcome')}</h1>
          </div>
          <div className="flex gap-3">
            <Link to="/citizen/track">
              <Button variant="outline" className="border-[#E5E7EB] bg-white hover:bg-[#F8FAFC] h-10">
                <Search className="w-4 h-4 mr-2" />
                {t('citizen:dashboard.headerTrack')}
              </Button>
            </Link>
            <Link to="/citizen/submit">
              <Button className="bg-[#2952E3] hover:bg-[#1e3a8a] h-10">
                <Plus className="w-4 h-4 mr-2" />
                {t('citizen:dashboard.headerNew')}
              </Button>
            </Link>
          </div>
        </div>

        {/* Top Stats - 4 Cards in One Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Total Filed */}
          <Card className="p-5 border-[#E5E7EB] bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold">
                {t('citizen:dashboard.stats.totalFiled')}
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#2952E3]" strokeWidth={2} />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0B1220] mb-1">{stats.total}</div>
            <div className="text-xs text-[#6B7280]">{t('citizen:dashboard.stats.totalFiledHint')}</div>
          </Card>

          {/* Pending */}
          <Card className="p-5 border-[#E5E7EB] bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="text-[10px] text-[#F59E0B] uppercase tracking-wider font-semibold">
                {t('citizen:dashboard.stats.pending')}
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#F59E0B]" strokeWidth={2} />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0B1220] mb-1">{stats.pending}</div>
            <div className="text-xs text-[#6B7280]">{t('citizen:dashboard.stats.pendingHint')}</div>
          </Card>

          {/* Resolved */}
          <Card className="p-5 border-[#E5E7EB] bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="text-[10px] text-[#22C55E] uppercase tracking-wider font-semibold">
                {t('citizen:dashboard.stats.resolved')}
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#DCFCE7] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-[#22C55E]" strokeWidth={2} />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0B1220] mb-1">{stats.resolved}</div>
            <div className="text-xs text-[#22C55E] flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {t('citizen:dashboard.stats.resolutionRate', { pct: resolutionRate })}
            </div>
          </Card>

          {/* Escalated */}
          <Card className="p-5 border-[#E5E7EB] bg-white shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="text-[10px] text-[#EF4444] uppercase tracking-wider font-semibold">
                {t('citizen:dashboard.stats.escalated')}
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#FEE2E2] flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[#EF4444]" strokeWidth={2} />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0B1220] mb-1">{stats.escalated}</div>
            <div className="text-xs text-[#6B7280]">{t('citizen:dashboard.stats.escalatedHint')}</div>
          </Card>
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Quick Actions */}
          <Card className="p-6 border-[#E5E7EB] bg-white shadow-sm">
            <h3 className="font-semibold text-[#0B1220] mb-4 text-base">
              {t('citizen:dashboard.quickActions').toUpperCase()}
            </h3>
            <div className="space-y-2">
              <Link to="/citizen/submit">
                <div className="group flex items-center gap-4 p-3.5 rounded-xl hover:bg-[#F8FAFC] transition-all cursor-pointer border border-transparent hover:border-[#E5E7EB]">
                  <div className="w-11 h-11 rounded-xl bg-[#2952E3] flex items-center justify-center flex-shrink-0">
                    <Plus className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[#0B1220] text-sm">{t('citizen:dashboard.action.fileNew')}</div>
                    <div className="text-xs text-[#6B7280]">{t('citizen:dashboard.action.fileNewHint')}</div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-[#6B7280] group-hover:text-[#2952E3] transition-colors flex-shrink-0" />
                </div>
              </Link>

              <Link to="/citizen/track">
                <div className="group flex items-center gap-4 p-3.5 rounded-xl hover:bg-[#F8FAFC] transition-all cursor-pointer border border-transparent hover:border-[#E5E7EB]">
                  <div className="w-11 h-11 rounded-xl bg-[#8B5CF6] flex items-center justify-center flex-shrink-0">
                    <Search className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[#0B1220] text-sm">{t('citizen:dashboard.action.track')}</div>
                    <div className="text-xs text-[#6B7280]">{t('citizen:dashboard.action.trackHint')}</div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-[#6B7280] group-hover:text-[#8B5CF6] transition-colors flex-shrink-0" />
                </div>
              </Link>

              <Link to="/citizen/assistant">
                <div className="group flex items-center gap-4 p-3.5 rounded-xl hover:bg-[#F8FAFC] transition-all cursor-pointer border border-transparent hover:border-[#E5E7EB]">
                  <div className="w-11 h-11 rounded-xl bg-[#0B1220] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[#0B1220] text-sm">{t('citizen:dashboard.action.assistant')}</div>
                    <div className="text-xs text-[#6B7280]">{t('citizen:dashboard.action.assistantHint')}</div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-[#6B7280] group-hover:text-[#0B1220] transition-colors flex-shrink-0" />
                </div>
              </Link>

              <Link to="/citizen/notifications">
                <div className="group flex items-center gap-4 p-3.5 rounded-xl hover:bg-[#F8FAFC] transition-all cursor-pointer border border-transparent hover:border-[#E5E7EB]">
                  <div className="w-11 h-11 rounded-xl bg-[#F59E0B] flex items-center justify-center flex-shrink-0">
                    <Bell className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[#0B1220] text-sm">{t('citizen:dashboard.action.notifications')}</div>
                    <div className="text-xs text-[#6B7280]">{t('citizen:dashboard.action.notificationsHint')}</div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-[#6B7280] group-hover:text-[#F59E0B] transition-colors flex-shrink-0" />
                </div>
              </Link>
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="p-6 border-[#E5E7EB] bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#0B1220] text-base">{t('citizen:dashboard.recent.title')}</h3>
              <Link to="/citizen/complaints">
                <Button variant="link" className="text-[#2952E3] h-auto p-0 text-sm font-medium hover:no-underline">
                  {t('common:viewAll')} <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            {recentComplaints.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-[#F8FAFC] flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-[#6B7280]" strokeWidth={1.5} />
                </div>
                <div className="text-sm text-[#0B1220] font-medium mb-1">{t('citizen:dashboard.recent.empty')}</div>
                <div className="text-xs text-[#6B7280]">{t('citizen:dashboard.recent.emptyHint')}</div>
              </div>
            ) : (
              <div className="space-y-3">
                {recentComplaints.map(complaint => (
                  <div key={complaint.id} className="flex items-start gap-3 p-3 rounded-xl border border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors">
                    <div className={`w-2 h-2 rounded-full ${getCategoryColor(complaint.category)} mt-2 flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-medium text-[#0B1220] text-sm truncate">{complaint.title}</div>
                        <Badge className={`${getStatusColor(complaint.status)} text-[10px] px-2 py-0 flex-shrink-0`}>
                          {translateStatus(complaint.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                        <span>{complaint.category}</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(complaint.submittedAt, { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* AI Insights */}
        <Card className="p-6 border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#8B5CF6] flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-semibold text-[#0B1220] text-base">{t('citizen:dashboard.insights.title')}</h3>
              <div className="text-xs text-[#6B7280]">{t('citizen:dashboard.insights.subtitle')}</div>
            </div>
          </div>

          {/* Insight Grid */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#E5E7EB]">
              <div className="text-xs text-[#6B7280] mb-2 font-medium">{t('citizen:dashboard.insights.topCategory')}</div>
              <div className="text-2xl font-bold text-[#0B1220] mb-1 truncate">
                {insights.topCategory ?? '—'}
              </div>
              <div className="text-xs text-[#6B7280]">{t('citizen:dashboard.insights.topCategoryHint')}</div>
            </div>

            <div className="bg-gradient-to-br from-[#EEF2FF] to-[#F8FAFC] rounded-xl p-4 border border-[#E5E7EB]">
              <div className="text-xs text-[#6B7280] mb-2 font-medium">{t('citizen:dashboard.insights.confidence')}</div>
              <div className="text-2xl font-bold text-[#2952E3] mb-1">
                {insights.avgConfidence !== null
                  ? `${insights.avgConfidence.toFixed(1)}%`
                  : '—'}
              </div>
              <div className="text-xs text-[#6B7280]">{t('citizen:dashboard.insights.confidenceHint')}</div>
            </div>

            <div className="bg-[#F8FAFC] rounded-xl p-4 border border-[#E5E7EB]">
              <div className="text-xs text-[#6B7280] mb-2 font-medium">{t('citizen:dashboard.insights.resolutionTitle')}</div>
              <div className="text-2xl font-bold text-[#0B1220] mb-1">
                {insights.resolutionRatePct !== null ? `${insights.resolutionRatePct}%` : '—'}
              </div>
              <div className="text-xs text-[#22C55E]">
                {t('citizen:dashboard.insights.resolutionDetail', { resolved: stats.resolved, total: stats.total })}
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="space-y-2.5">
            {insights.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm">
                <ArrowRight className="w-4 h-4 text-[#2952E3] mt-0.5 flex-shrink-0" strokeWidth={2} />
                <span className="text-[#6B7280]">{tip}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </CitizenLayout>
  );
}
