import { useMemo, useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bot,
  Download,
  Info,
  Loader2,
  MapPin,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { apiClient, buildUrl } from '../../../lib/api/client';

/**
 * National Demand Intelligence.
 *
 * Where the grievance console answers "is this citizen's problem fixed?", this
 * screen answers "across the country, where should the next rupee of
 * infrastructure investment go?".
 *
 * A deliberate presentation rule runs through it: numbers and narrative are
 * visually separated and separately attributed. Scores come from arithmetic over
 * Census 2011 and recorded demand; prose comes from Gemini reading those scores.
 * Proxy measures, absent datasets, and modelled demand are labelled in place
 * rather than in a footnote, because a policymaker acting on this needs to know
 * which parts are measured and which are inferred.
 */

// ---------------------------------------------------------------------------
// Wire shapes
// ---------------------------------------------------------------------------

interface CategoryMeta {
  category: string;
  department: string;
  metrics: string[];
  direct: boolean;
  basis: string;
}

interface Meta {
  states: { id: string; name: string }[];
  categories: CategoryMeta[];
  weights: Weights;
  defaultWeights: Weights;
  coverage: {
    districts: number;
    indicators: number;
    investmentDataAvailable: boolean;
    censusYear: number;
    censusSource: string;
  };
}

interface Weights {
  demand: number;
  gap: number;
  investment: number;
  equity: number;
}

interface RankRow {
  rank: number;
  districtId: string;
  district: string;
  state: string;
  censusCode: number;
  category: string;
  priorityScore: number;
  demandScore: number;
  gapScore: number;
  equityScore: number;
  investmentDeficitScore: number | null;
  componentsUsed: string[];
  gapIsDirect: boolean;
  complaints: number;
  demandPer100kHouseholds: number;
  population: number | null;
  households: number | null;
  expectedBeneficiaries: number | null;
  hasBrief: boolean;
  briefModel: string | null;
}

interface RankResponse {
  weights: Weights;
  totalCells: number;
  investmentDataAvailable: boolean;
  rows: RankRow[];
}

interface Briefing {
  category: string;
  rank: number;
  rationale: string;
  interventions: string[] | null;
  risks: string[] | null;
  expectedBeneficiaries: number | null;
  modelName: string;
  inputDigest: string;
  degraded: boolean;
  generatedAt: string;
}

interface DistrictDetail {
  district: {
    id: string;
    name: string;
    censusCode: number;
    state: { id: string; name: string };
    population: number | null;
    households: number | null;
    scPopulation: number | null;
    stPopulation: number | null;
    ruralHouseholds: number | null;
  };
  scores: {
    category: string;
    nationalRank: number;
    priorityScore: number;
    demandScore: number;
    gapScore: number;
    equityScore: number;
    investmentDeficitScore: number | null;
    componentsUsed: string[];
    gapIsDirect: boolean;
    complaints: number;
    demandPer100kHouseholds: number;
  }[];
  indicators: { metric: string; value: number; unit: string; asOf: string; source: string }[];
  briefings: Briefing[];
  samples: {
    id: string;
    title: string;
    description: string;
    language: string;
    category: string;
    priority: string;
    status: string;
    isSynthetic: boolean;
    submittedAt: string;
  }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const num = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-IN');

const pct = (n: number | null | undefined) => (n == null ? 'n/a' : `${(n * 100).toFixed(0)}%`);

/** Human label for a census metric key. */
const METRIC_LABELS: Record<string, string> = {
  no_tapwater_pct: 'Households without tap water',
  water_source_away_pct: 'Fetching water from away',
  no_electricity_pct: 'Without electric lighting',
  no_latrine_pct: 'Without a latrine on premises',
  open_defecation_pct: 'Open defecation',
  no_internet_pct: 'Without internet access',
  dilapidated_housing_pct: 'Dilapidated housing',
  illiteracy_pct: 'Unable to read and write',
  sc_st_share_pct: 'Scheduled Caste / Tribe share',
  rural_household_share_pct: 'Rural households',
};

/** A labelled 0..1 bar. `null` renders as an explicit "no data" state. */
function ScoreBar({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | null;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-[#475569]">{label}</span>
        <span className="text-xs font-medium text-[#0F172A] tabular-nums">
          {value == null ? 'no data' : value.toFixed(2)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#E5EAF3] overflow-hidden">
        {value == null ? (
          // Hatched rather than empty: an absent measure must not read as zero.
          <div
            className="h-full w-full opacity-40"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #94A3B8 0 4px, transparent 4px 8px)',
            }}
          />
        ) : (
          <div
            className="h-full rounded-full bg-[#2F5BFF]"
            style={{ width: `${Math.max(2, value * 100)}%` }}
          />
        )}
      </div>
      {hint && <p className="mt-1 text-[11px] leading-snug text-[#94A3B8]">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminPlanning() {
  const [category, setCategory] = useState<string>('');
  const [stateId, setStateId] = useState<string>('');
  const [limit, setLimit] = useState(25);
  const [weights, setWeights] = useState<Weights | null>(null);
  const [openDistrict, setOpenDistrict] = useState<{ id: string; category: string } | null>(null);
  const [downloading, setDownloading] = useState(false);

  const metaQuery = useQuery<Meta>({
    queryKey: ['planning', 'meta'],
    queryFn: () => apiClient.get<Meta>('/planning/meta'),
  });

  const effectiveWeights = weights ?? metaQuery.data?.weights ?? null;

  const rankQuery = useQuery<RankResponse>({
    queryKey: ['planning', 'rank', category, stateId, limit, effectiveWeights],
    queryFn: () =>
      apiClient.get<RankResponse>('/planning/rank', {
        query: {
          ...(category ? { category } : {}),
          ...(stateId ? { stateId } : {}),
          limit: String(limit),
          ...(effectiveWeights
            ? {
                wDemand: String(effectiveWeights.demand),
                wGap: String(effectiveWeights.gap),
                wInvestment: String(effectiveWeights.investment),
                wEquity: String(effectiveWeights.equity),
              }
            : {}),
        },
      }),
    enabled: !!metaQuery.data,
  });

  const detailQuery = useQuery<DistrictDetail>({
    queryKey: ['planning', 'district', openDistrict?.id, openDistrict?.category, effectiveWeights],
    queryFn: () =>
      apiClient.get<DistrictDetail>(`/planning/district/${openDistrict!.id}`, {
        query: effectiveWeights
          ? {
              wDemand: String(effectiveWeights.demand),
              wGap: String(effectiveWeights.gap),
              wInvestment: String(effectiveWeights.investment),
              wEquity: String(effectiveWeights.equity),
            }
          : undefined,
      }),
    enabled: !!openDistrict,
  });

  const rows = rankQuery.data?.rows ?? [];
  const meta = metaQuery.data;
  const categoryMeta = useMemo(
    () => meta?.categories.find((x) => x.category === category),
    [meta, category],
  );

  /** Mean priority by state, to show where need concentrates geographically. */
  const stateRollup = useMemo(() => {
    const byState = new Map<string, { total: number; n: number }>();
    for (const r of rows) {
      const cur = byState.get(r.state) ?? { total: 0, n: 0 };
      cur.total += r.priorityScore;
      cur.n += 1;
      byState.set(r.state, cur);
    }
    return [...byState.entries()]
      .map(([state, v]) => ({ state, score: Number((v.total / v.n).toFixed(3)), districts: v.n }))
      .sort((a, b) => b.districts - a.districts || b.score - a.score)
      .slice(0, 8);
  }, [rows]);

  const downloadBrief = async (districtId: string, cat: string) => {
    setDownloading(true);
    try {
      const params = new URLSearchParams({ districtId, category: cat });
      // buildUrl so the request targets the API host, not the frontend origin.
      const res = await fetch(`${buildUrl('/planning/brief.pdf')}?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        alert(
          res.status === 404
            ? 'No briefing has been generated for this district yet. Run the briefing job first.'
            : `Could not download the brief (HTTP ${res.status}).`,
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nivaran-brief-${districtId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const setWeight = (key: keyof Weights, value: number) => {
    const base = effectiveWeights ?? { demand: 0.35, gap: 0.3, investment: 0.2, equity: 0.15 };
    setWeights({ ...base, [key]: value });
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">National Demand Intelligence</h1>
          <p className="text-sm text-[#64748B]">
            Citizen demand aggregated to district level and ranked against Census {meta?.coverage.censusYear ?? 2011}{' '}
            deprivation, to surface where infrastructure investment is most warranted.
          </p>
        </div>

        {/* Provenance banner. Deliberately above the data, not below it: the
            caveats change how the numbers should be read. */}
        <Card className="p-4 mb-5 border-[#FDE68A] bg-[#FFFBEB]">
          <div className="flex gap-3">
            <Info className="w-4 h-4 text-[#B45309] mt-0.5 shrink-0" strokeWidth={2} />
            <div className="text-[13px] leading-relaxed text-[#78350F] space-y-1">
              <p>
                <strong>Scores are computed arithmetically</strong> from {num(meta?.coverage.indicators)} Census
                2011 indicator values across {num(meta?.coverage.districts)} districts. No language model
                participates in scoring or ranking.
              </p>
              <p>
                <strong>Citizen demand volumes here are modelled</strong>, weighted by those real deprivation
                figures so hotspots fall where measured gaps are. Rows filed by real users are unflagged and
                stay separable.
              </p>
              {meta && !meta.coverage.investmentDataAvailable && (
                <p>
                  <strong>Public investment data is not loaded</strong>, so that component is excluded and its
                  weight is redistributed across the rest. Nothing here implies a district is either funded or
                  neglected.
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Controls */}
        <Card className="p-4 mb-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[200px] flex-1">
              <label htmlFor="pl-cat" className="block text-xs font-medium text-[#475569] mb-1">
                Service category
              </label>
              <select
                id="pl-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 rounded-lg border border-[#E5EAF3] px-3 text-sm text-[#0F172A] bg-white"
              >
                <option value="">All categories</option>
                {meta?.categories.map((x) => (
                  <option key={x.category} value={x.category}>
                    {x.category}
                    {x.direct ? '' : ' (proxy)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[180px] flex-1">
              <label htmlFor="pl-state" className="block text-xs font-medium text-[#475569] mb-1">
                State or union territory
              </label>
              <select
                id="pl-state"
                value={stateId}
                onChange={(e) => setStateId(e.target.value)}
                className="w-full h-9 rounded-lg border border-[#E5EAF3] px-3 text-sm text-[#0F172A] bg-white"
              >
                <option value="">All of India</option>
                {meta?.states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[120px]">
              <label htmlFor="pl-limit" className="block text-xs font-medium text-[#475569] mb-1">
                Show
              </label>
              <select
                id="pl-limit"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full h-9 rounded-lg border border-[#E5EAF3] px-3 text-sm text-[#0F172A] bg-white"
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    Top {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {categoryMeta && (
            <div className="mt-3 flex gap-2 items-start text-[12px] text-[#475569]">
              {categoryMeta.direct ? (
                <Badge className="bg-[#DCFCE7] text-[#166534] hover:bg-[#DCFCE7] shrink-0">
                  Directly measured
                </Badge>
              ) : (
                <Badge className="bg-[#FEF3C7] text-[#92400E] hover:bg-[#FEF3C7] shrink-0">Proxy measure</Badge>
              )}
              <span className="leading-snug">{categoryMeta.basis}</span>
            </div>
          )}

          {/* Weight sliders. Exposed because the weighting is a policy judgement,
              not a fact, and a ministry should be able to argue with it. */}
          <div className="mt-4 pt-4 border-t border-[#E5EAF3]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-[#475569]">
                Scoring weights — adjust to see the ranking change
              </p>
              {weights && (
                <button
                  onClick={() => setWeights(null)}
                  className="text-xs text-[#2F5BFF] hover:underline"
                >
                  Reset to configured
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(
                [
                  ['demand', 'Citizen demand'],
                  ['gap', 'Measured gap'],
                  ['investment', 'Investment deficit'],
                  ['equity', 'Equity'],
                ] as [keyof Weights, string][]
              ).map(([key, label]) => (
                <div key={key}>
                  <div className="flex justify-between text-[11px] text-[#475569] mb-1">
                    <span>{label}</span>
                    <span className="tabular-nums font-medium">
                      {(effectiveWeights?.[key] ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={effectiveWeights?.[key] ?? 0}
                    onChange={(e) => setWeight(key, Number(e.target.value))}
                    className="w-full accent-[#2F5BFF]"
                    aria-label={`${label} weight`}
                    disabled={key === 'investment' && !meta?.coverage.investmentDataAvailable}
                  />
                  {key === 'investment' && !meta?.coverage.investmentDataAvailable && (
                    <p className="text-[10px] text-[#94A3B8] mt-0.5">No data — excluded</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* State concentration */}
        {stateRollup.length > 1 && (
          <Card className="p-4 mb-5">
            <h2 className="text-sm font-semibold text-[#0F172A] mb-1">
              Where the top {rows.length} concentrate
            </h2>
            <p className="text-xs text-[#64748B] mb-3">
              Districts appearing in this ranking, by state, with their mean priority score.
            </p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stateRollup} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF3" vertical={false} />
                  <XAxis dataKey="state" tick={{ fontSize: 11, fill: '#64748B' }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5EAF3' }}
                    formatter={(value: number, name: string) =>
                      name === 'districts' ? [value, 'Districts in ranking'] : [value, 'Mean priority']
                    }
                  />
                  <Bar dataKey="districts" fill="#2F5BFF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Ranking table */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5EAF3] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0F172A]">
              Priority ranking
              {rankQuery.data && (
                <span className="ml-2 font-normal text-[#64748B]">
                  {rows.length} of {num(rankQuery.data.totalCells)} district-category pairs
                </span>
              )}
            </h2>
            {rankQuery.isFetching && <Loader2 className="w-4 h-4 animate-spin text-[#64748B]" />}
          </div>

          {rankQuery.isError && (
            <div className="p-6 text-sm text-[#B91C1C]">Could not load the ranking. Please retry.</div>
          )}

          {!rankQuery.isError && rows.length === 0 && !rankQuery.isFetching && (
            <div className="p-6 text-sm text-[#64748B]">No districts match these filters.</div>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[#475569] text-xs">
                    <th className="text-left font-medium px-4 py-2.5 w-12">#</th>
                    <th className="text-left font-medium px-4 py-2.5">District</th>
                    <th className="text-left font-medium px-4 py-2.5">Category</th>
                    <th className="text-right font-medium px-4 py-2.5">Priority</th>
                    <th className="text-right font-medium px-4 py-2.5">Gap</th>
                    <th className="text-right font-medium px-4 py-2.5">Demand /100k hh</th>
                    <th className="text-right font-medium px-4 py-2.5">People affected</th>
                    <th className="text-left font-medium px-4 py-2.5">Brief</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={`${r.districtId}-${r.category}`}
                      onClick={() => setOpenDistrict({ id: r.districtId, category: r.category })}
                      className="border-t border-[#E5EAF3] hover:bg-[#F8FAFC] cursor-pointer"
                    >
                      <td className="px-4 py-2.5 text-[#64748B] tabular-nums">{r.rank}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-[#0F172A]">{r.district}</div>
                        <div className="text-xs text-[#64748B]">{r.state}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[#0F172A]">{r.category}</span>
                        {!r.gapIsDirect && (
                          <span
                            className="ml-1.5 text-[10px] uppercase tracking-wide text-[#92400E]"
                            title="The gap for this category is inferred from proxy census measures"
                          >
                            proxy
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#0F172A]">
                        {r.priorityScore.toFixed(3)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[#475569]">
                        {pct(r.gapScore)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[#475569]">
                        {r.demandPer100kHouseholds.toFixed(1)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[#475569]">
                        {num(r.expectedBeneficiaries)}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.hasBrief ? (
                          <span className="inline-flex items-center gap-1 text-xs text-[#166534]">
                            <Sparkles className="w-3 h-3" strokeWidth={2} />
                            {r.briefModel}
                          </span>
                        ) : (
                          <span className="text-xs text-[#94A3B8]">scores only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* District drawer */}
      {openDistrict && (
        <div className="fixed inset-0 z-50 flex">
          <button
            className="flex-1 bg-black/30"
            onClick={() => setOpenDistrict(null)}
            aria-label="Close district detail"
          />
          <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-[#E5EAF3] px-5 py-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">
                  {detailQuery.data?.district.name ?? 'Loading…'}
                </h2>
                <p className="text-xs text-[#64748B] flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" strokeWidth={2} />
                  {detailQuery.data?.district.state.name} · census code{' '}
                  {detailQuery.data?.district.censusCode}
                </p>
              </div>
              <button
                onClick={() => setOpenDistrict(null)}
                className="p-1 rounded hover:bg-[#F1F5F9]"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-[#64748B]" />
              </button>
            </div>

            {detailQuery.isLoading && (
              <div className="p-6 flex items-center gap-2 text-sm text-[#64748B]">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading district detail…
              </div>
            )}

            {detailQuery.data && (
              <div className="p-5 space-y-6">
                {/* Census facts */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Population', num(detailQuery.data.district.population)],
                    ['Households', num(detailQuery.data.district.households)],
                    ['SC population', num(detailQuery.data.district.scPopulation)],
                    ['ST population', num(detailQuery.data.district.stPopulation)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-[#E5EAF3] p-3">
                      <p className="text-[11px] text-[#64748B]">{label}</p>
                      <p className="text-sm font-semibold text-[#0F172A] tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Score breakdown for the clicked category */}
                {(() => {
                  const s = detailQuery.data.scores.find((x) => x.category === openDistrict.category);
                  if (!s) return null;
                  return (
                    <div>
                      <h3 className="text-sm font-semibold text-[#0F172A] mb-1">
                        {s.category} — national rank {s.nationalRank}
                      </h3>
                      <p className="text-xs text-[#64748B] mb-3">
                        Composite {s.priorityScore.toFixed(3)}, from {s.componentsUsed.join(', ')}.
                      </p>
                      <div className="space-y-3">
                        <ScoreBar label="Citizen demand intensity" value={s.demandScore} />
                        <ScoreBar
                          label="Measured infrastructure gap"
                          value={s.gapScore}
                          hint={s.gapIsDirect ? undefined : 'Inferred from proxy census measures'}
                        />
                        <ScoreBar label="Equity weighting" value={s.equityScore} />
                        <ScoreBar
                          label="Investment deficit"
                          value={s.investmentDeficitScore}
                          hint={
                            s.investmentDeficitScore == null
                              ? 'No public investment data ingested; weight redistributed'
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Gemini briefing */}
                {(() => {
                  const b = detailQuery.data!.briefings.find(
                    (x) => x.category === openDistrict.category,
                  );
                  if (!b || b.degraded || !b.rationale) {
                    return (
                      <div className="rounded-lg border border-[#E5EAF3] bg-[#F8FAFC] p-4">
                        <div className="flex gap-2 text-sm text-[#475569]">
                          <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-[#94A3B8]" />
                          <div>
                            <p className="font-medium text-[#0F172A]">No narrative assessment</p>
                            <p className="text-xs mt-1 leading-relaxed">
                              None has been generated for this district and category. The scores and
                              ranking above are computed arithmetically and remain valid without it.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="w-4 h-4 text-[#2F5BFF]" strokeWidth={2} />
                        <h3 className="text-sm font-semibold text-[#0F172A]">Policy assessment</h3>
                        <Badge className="bg-[#EEF2FF] text-[#3730A3] hover:bg-[#EEF2FF] text-[10px]">
                          {b.modelName}
                        </Badge>
                      </div>
                      <p className="text-sm text-[#334155] leading-relaxed">{b.rationale}</p>

                      {b.interventions && b.interventions.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-[#475569] uppercase tracking-wide mb-2">
                            Proposed interventions
                          </h4>
                          <ol className="space-y-1.5 text-sm text-[#334155] list-decimal list-inside">
                            {b.interventions.map((s, i) => (
                              <li key={i} className="leading-relaxed">
                                {s}
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {b.risks && b.risks.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-xs font-semibold text-[#475569] uppercase tracking-wide mb-2 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Risks and caveats
                          </h4>
                          <ul className="space-y-1.5 text-sm text-[#334155] list-disc list-inside">
                            {b.risks.map((s, i) => (
                              <li key={i} className="leading-relaxed">
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Provenance: proves prose and numbers agree. */}
                      <p className="mt-4 text-[11px] text-[#94A3B8] leading-relaxed">
                        Written from the computed figures only, which are never produced by the model.
                        Input digest <code className="font-mono">{b.inputDigest.slice(0, 16)}</code>,
                        generated {new Date(b.generatedAt).toLocaleString('en-IN')}.
                      </p>

                      <Button
                        onClick={() => downloadBrief(openDistrict.id, openDistrict.category)}
                        disabled={downloading}
                        className="mt-4 bg-[#0F172A] hover:bg-[#1D4ED8] text-white"
                      >
                        {downloading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 mr-2" />
                        )}
                        Export policy brief
                      </Button>
                    </div>
                  );
                })()}

                {/* Census indicators */}
                <div>
                  <h3 className="text-sm font-semibold text-[#0F172A] mb-2">
                    Census 2011 indicators
                  </h3>
                  <div className="space-y-2">
                    {detailQuery.data.indicators.map((ind) => (
                      <div key={ind.metric} className="flex items-center justify-between text-xs">
                        <span className="text-[#475569]">
                          {METRIC_LABELS[ind.metric] ?? ind.metric}
                        </span>
                        <span className="tabular-nums font-medium text-[#0F172A]">
                          {ind.value.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Citizen voices */}
                <div>
                  <h3 className="text-sm font-semibold text-[#0F172A] mb-2">Recent reports</h3>
                  <div className="space-y-2">
                    {detailQuery.data.samples.map((s) => (
                      <div key={s.id} className="rounded-lg border border-[#E5EAF3] p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-[#0F172A]">{s.title}</p>
                          {s.isSynthetic && (
                            <Badge className="bg-[#F1F5F9] text-[#475569] hover:bg-[#F1F5F9] text-[10px] shrink-0">
                              modelled
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[#64748B] mt-1 leading-relaxed">{s.description}</p>
                        <p className="text-[11px] text-[#94A3B8] mt-1.5">
                          {s.category} · {s.priority} · {s.status} · {s.language}
                        </p>
                      </div>
                    ))}
                    {detailQuery.data.samples.length === 0 && (
                      <p className="text-xs text-[#64748B]">
                        No reports recorded for this district and category.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
