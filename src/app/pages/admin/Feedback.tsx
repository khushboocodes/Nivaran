import AdminLayout from '../../components/layouts/AdminLayout';
import { Star } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useFeedbackStatsQuery } from '../../../lib/api/hooks';

export default function AdminFeedback() {
  // Live aggregates from /api/feedback/stats. While loading or on error we
  // keep the page rendering with safe zeros so the layout never shifts.
  const { data } = useFeedbackStatsQuery();

  const distribution = data?.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const ratingData = [
    { id: 1, stars: '1★', count: distribution[1] ?? 0 },
    { id: 2, stars: '2★', count: distribution[2] ?? 0 },
    { id: 3, stars: '3★', count: distribution[3] ?? 0 },
    { id: 4, stars: '4★', count: distribution[4] ?? 0 },
    { id: 5, stars: '5★', count: distribution[5] ?? 0 },
  ];

  const total = data?.total ?? 0;
  const average = data?.average ?? 0;
  const averageDisplay = total > 0 ? average.toFixed(1) : '0';
  const filledStars = Math.round(average);
  const satisfactionRate = data?.satisfactionRate ?? 0;
  const satisfactionDisplay = total > 0 ? `${Math.round(satisfactionRate * 100)}%` : '0%';
  const byCategory = data?.byCategory ?? [];
  const recent = data?.recent ?? [];

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Feedback Analytics</h1>
          <p className="text-sm text-[#7C8AA5]">Citizen satisfaction scores and feedback analysis</p>
        </div>

        {/* Metrics - 3 cards side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="text-xs text-[#7C8AA5] mb-2 font-medium">Average Rating</div>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold text-[#F5A524]">{averageDisplay}</div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => {
                  const filled = i <= filledStars;
                  return (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${filled ? 'text-[#F5A524]' : 'text-[#E5EAF3]'}`}
                      fill={filled ? '#F5A524' : '#E5EAF3'}
                      strokeWidth={0}
                    />
                  );
                })}
              </div>
            </div>
          </Card>

          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="text-xs text-[#7C8AA5] mb-2 font-medium">Total Responses</div>
            <div className="text-3xl font-bold text-[#2F5BFF]">{total}</div>
          </Card>

          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="text-xs text-[#7C8AA5] mb-2 font-medium">Satisfaction Rate (4-5★)</div>
            <div className="text-3xl font-bold text-[#14B86A]">{satisfactionDisplay}</div>
          </Card>
        </div>

        {/* Charts - 2 cards side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <h3 className="font-semibold text-[#0F172A] mb-4 text-sm">Rating Distribution</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingData} key="feedback-ratings-chart">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF3" vertical={false} />
                  <XAxis dataKey="stars" stroke="#7C8AA5" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#7C8AA5" fontSize={10} tickLine={false} axisLine={false} />
                  <Bar dataKey="count" fill="#F5A524" radius={[6, 6, 0, 0]} isAnimationActive={false} name="ratings" id="feedback-ratings-bar" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <h3 className="font-semibold text-[#0F172A] mb-4 text-sm">Avg Rating by Category</h3>
            <div className="h-52">
              {byCategory.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-sm text-[#7C8AA5]">No feedback data yet</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={byCategory.map((b) => ({
                      category: b.category,
                      average: Number(b.average.toFixed(2)),
                    }))}
                    key="feedback-by-category-chart"
                    layout="vertical"
                    margin={{ top: 5, right: 16, left: 8, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF3" horizontal={false} />
                    <XAxis type="number" domain={[0, 5]} stroke="#7C8AA5" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="category" stroke="#7C8AA5" fontSize={10} tickLine={false} axisLine={false} width={100} />
                    <Bar dataKey="average" fill="#2F5BFF" radius={[0, 6, 6, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>

        {/* Recent Feedback */}
        <Card className="p-5 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
          <h3 className="font-semibold text-[#0F172A] mb-4 text-sm">Recent Feedback</h3>
          {recent.length === 0 ? (
            <div className="text-center py-10 text-[#7C8AA5] text-sm">
              No feedback submitted yet
            </div>
          ) : (
            <ul className="divide-y divide-[#E5EAF3]">
              {recent.map((f) => (
                <li key={f.id} className="py-3 flex items-start gap-4">
                  <div className="flex gap-0.5 pt-0.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((i) => {
                      const filled = i <= f.rating;
                      return (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${filled ? 'text-[#F5A524]' : 'text-[#E5EAF3]'}`}
                          fill={filled ? '#F5A524' : '#E5EAF3'}
                          strokeWidth={0}
                        />
                      );
                    })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[#7C8AA5]">
                      <span className="font-medium text-[#0F172A] truncate">
                        {f.complaint?.title ?? 'Complaint'}
                      </span>
                      {f.complaint?.category ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#F1F4FB] text-[#0F172A]">
                          {f.complaint.category}
                        </span>
                      ) : null}
                      <span>•</span>
                      <span>{f.citizenName ?? 'Citizen'}</span>
                      <span>•</span>
                      <span>{new Date(f.createdAt).toLocaleDateString()}</span>
                    </div>
                    {f.comment ? (
                      <p className="mt-1 text-sm text-[#0F172A] leading-relaxed">{f.comment}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
