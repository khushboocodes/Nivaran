/**
 * District prioritisation engine.
 *
 * Answers: across every district in the country, where is infrastructure
 * investment most warranted, and why?
 *
 * DESIGN CONSTRAINT THAT DRIVES EVERYTHING HERE
 * ---------------------------------------------
 * Every number this module produces is computed arithmetically from database
 * rows. No language model participates in scoring or ranking. Gemini is handed
 * the finished table and asked to explain it in prose (see brief.ts), because a
 * ministry needs a ranking it can reproduce, audit, and defend in public — and
 * an LLM cannot offer any of those three.
 *
 * A consequence worth stating: the same inputs always yield the same output.
 * `scoreCells` is a pure function, so the ranking is testable without a
 * database and re-runnable without drift.
 *
 * A CAVEAT TO BE HONEST ABOUT WHILE DEMAND IS MODELLED
 * ----------------------------------------------------
 * The demand corpus is generated from census deprivation (see
 * prisma/ingest/synthesize-demand.ts), so `demandScore` and `gapScore` are
 * correlated by construction. They are not independent evidence of the same
 * conclusion, and should not be presented as though they were. With real
 * complaint volumes the two would diverge — and that divergence is the genuinely
 * interesting signal, because a district with severe measured deprivation but
 * little reported demand usually means people have stopped reporting, or never
 * could. The engine already emits zero-demand cells so that case stays visible.
 */
import { prisma } from '../../db';
import { CATEGORY_SPECS, REFERENCED_METRICS, specFor, type CategorySpec } from './categories';

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

/**
 * Relative influence of each component on the final score.
 *
 * These are a policy judgement, not a fact, which is exactly why they are
 * surfaced as a parameter and adjustable in the UI rather than hardcoded deep in
 * a query. A ministry that weights equity higher than raw demand should be able
 * to see the ranking change and argue about it.
 */
export interface Weights {
  /** How loudly citizens in this district are asking, per capita. */
  demand: number;
  /** How severe the measured infrastructure deficit is. */
  gap: number;
  /** How little public money has already been committed here. */
  investment: number;
  /** How structurally disadvantaged the population is. */
  equity: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  demand: 0.35,
  gap: 0.3,
  investment: 0.2,
  equity: 0.15,
};

/** Setting row holding operator-configured weights, if any. */
const WEIGHTS_KEY = 'planning.weights';

/**
 * Coerce arbitrary input into usable weights.
 *
 * Negative values are clamped to zero, and a set that sums to zero falls back to
 * the defaults rather than producing a divide-by-zero and a table of NaN.
 */
export function normaliseWeights(input: Partial<Weights> | null | undefined): Weights {
  const w: Weights = {
    demand: Math.max(0, Number(input?.demand ?? DEFAULT_WEIGHTS.demand) || 0),
    gap: Math.max(0, Number(input?.gap ?? DEFAULT_WEIGHTS.gap) || 0),
    investment: Math.max(0, Number(input?.investment ?? DEFAULT_WEIGHTS.investment) || 0),
    equity: Math.max(0, Number(input?.equity ?? DEFAULT_WEIGHTS.equity) || 0),
  };
  const sum = w.demand + w.gap + w.investment + w.equity;
  if (sum <= 0) return { ...DEFAULT_WEIGHTS };
  return w;
}

/** Load operator-configured weights, falling back to defaults. */
export async function loadWeights(): Promise<Weights> {
  const row = await prisma.setting.findUnique({ where: { key: WEIGHTS_KEY } });
  if (!row) return { ...DEFAULT_WEIGHTS };
  return normaliseWeights(row.value as Partial<Weights>);
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** Raw, unscored facts about one district-category pair. */
export interface DemandCell {
  districtId: string;
  districtName: string;
  censusCode: number;
  stateName: string;
  category: string;
  /** Complaints recorded in this district for this category. */
  complaints: number;
  households: number | null;
  population: number | null;
  /** Census deprivation rates for this district, keyed by metric. 0..100. */
  metrics: Record<string, number>;
  /** Public money already committed, in lakhs. Null means no data at all. */
  sanctionedLakh: number | null;
}

/** One fully scored row, ready to rank or hand to the narrative step. */
export interface ScoredCell extends DemandCell {
  /** Complaints per 100,000 households. The size-independent demand measure. */
  demandPer100kHouseholds: number;
  /** 0..1 each. */
  demandScore: number;
  gapScore: number;
  investmentDeficitScore: number | null;
  equityScore: number;
  priorityScore: number;
  /** Whether `gapScore` rests on direct census measurement or a proxy. */
  gapIsDirect: boolean;
  /** Which components actually contributed, after dropping unavailable ones. */
  componentsUsed: string[];
  rank: number;
}

/** Metrics standing in for structural disadvantage, averaged into equityScore. */
const EQUITY_METRICS = [
  'sc_st_share_pct',
  'illiteracy_pct',
  'rural_household_share_pct',
  'dilapidated_housing_pct',
] as const;

// ---------------------------------------------------------------------------
// Pure scoring
// ---------------------------------------------------------------------------

/** Mean of the values present for `keys`, or null when none are. */
function meanOf(metrics: Record<string, number>, keys: readonly string[]): number | null {
  const vals = keys.map((k) => metrics[k]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Value at a percentile of a sorted-ascending array, by linear interpolation.
 */
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  // Indexed access is narrowed defensively: the project compiles with
  // noUncheckedIndexedAccess, and a silent undefined here would poison every
  // downstream score with NaN.
  const vLo = sortedAsc[lo] ?? 0;
  const vHi = sortedAsc[hi] ?? vLo;
  if (lo === hi) return vLo;
  return vLo + (vHi - vLo) * (idx - lo);
}

/**
 * Score and rank a set of cells.
 *
 * Pure: no database, no clock, no randomness. Same input, same output, always.
 *
 * @param cells Raw facts, typically from `loadDemandCells`.
 * @param weights Component influence. Normalised internally.
 */
export function scoreCells(cells: DemandCell[], weights: Weights = DEFAULT_WEIGHTS): ScoredCell[] {
  const w = normaliseWeights(weights);
  if (cells.length === 0) return [];

  // --- Demand intensity, normalised ---------------------------------------
  // Per 100k households rather than absolute counts, otherwise large districts
  // dominate purely by being large and the ranking just re-discovers population.
  const intensities = cells.map((c) =>
    c.households && c.households > 0 ? (c.complaints / c.households) * 100_000 : 0,
  );

  // Choosing the divisor is a real tradeoff, so it adapts to the distribution.
  //
  // Dividing by a fixed high percentile makes everything at or above it clamp to
  // 1.0 and stop differentiating. Measured on the current corpus that was
  // actively harmful: intensities run min 0.09, median 5.7, p95 11.2, p99 14.2,
  // max 16.6 per 100k households. The max is only 17% above p99 — there is no
  // freak outlier — yet a p95 divisor flattened the entire top 5% of cells to an
  // identical 1.00, erasing the signal precisely among the districts this
  // ranking exists to separate.
  //
  // So: divide by the maximum, which preserves the full ordering and magnitude,
  // unless the maximum is a genuine outlier (more than 3x the 99th percentile),
  // in which case fall back to p99 so one aberrant district cannot compress
  // everyone else toward zero.
  const sortedIntensities = [...intensities].sort((a, b) => a - b);
  const p99 = percentile(sortedIntensities, 0.99);
  const max = sortedIntensities[sortedIntensities.length - 1] ?? 0;
  const intensityDivisor = p99 > 0 && max > p99 * 3 ? p99 : max > 0 ? max : 1;

  // --- Investment deficit -------------------------------------------------
  // Measured against the national median commitment per 100k population, so
  // "underinvested" means relative to peers rather than an arbitrary threshold.
  const perCapita = cells
    .filter((c) => c.sanctionedLakh != null && c.population && c.population > 0)
    .map((c) => (c.sanctionedLakh! / c.population!) * 100_000);
  const medianPerCapita =
    perCapita.length > 0 ? percentile([...perCapita].sort((a, b) => a - b), 0.5) : null;

  const scored: Omit<ScoredCell, 'rank'>[] = cells.map((cell, i) => {
    const spec: CategorySpec | undefined = specFor(cell.category);

    const demandPer100kHouseholds = intensities[i] ?? 0;
    const demandScore = clamp01(demandPer100kHouseholds / intensityDivisor);

    // Deprivation rates are already 0..100, so this is a straight rescale.
    const gapRaw = spec ? meanOf(cell.metrics, spec.metrics) : null;
    const gapScore = gapRaw == null ? 0 : clamp01(gapRaw / 100);

    const equityRaw = meanOf(cell.metrics, EQUITY_METRICS);
    const equityScore = equityRaw == null ? 0 : clamp01(equityRaw / 100);

    // Null, not zero, when we genuinely have no investment data. Zero would
    // read as "fully funded" and silently push deprived districts down the
    // ranking — the opposite of the truth.
    //
    // WHY THIS IS CURRENTLY NULL FOR EVERY DISTRICT
    // --------------------------------------------
    // No district-level, rupee-denominated public investment dataset proved
    // obtainable. Four sources were investigated; each failed on its own terms:
    //
    //   1. AIKosh "JJM Village Scheme Infrastructure Data" — visibility
    //      Restricted, download request stayed pending.
    //   2. data.gov.in resource API — needs an API key, and registration
    //      delegates to the JanParichay SSO whose signup routes return 404.
    //   3. AIKosh "District-wise MGNREGA Data at a Glance" — obtained and
    //      inspected. 28 metric columns and *no identifier column at all*: no
    //      district, no state, no code, no period. Its own published metadata
    //      declares "Primary Key / Indicator: N.A." and "Geographical
    //      Coverage: Country", and the file holds 29 rows rather than 640 —
    //      state-level aggregate despite the "District-wise" title. Using it
    //      would have meant inferring identity from row order, i.e. inventing
    //      the join key. Licence is also declared "NA".
    //   4. nrega.nic.in public reports — reachable without authentication, but
    //      served as ASP.NET pages with viewstate, so district figures would
    //      need scraping per state.
    //
    // So the component is wired, weighted and tested, and reports honestly that
    // it has nothing to say. Weights renormalise across the components that do
    // have data, so the ranking never treats an unmeasured factor as a measured
    // zero, and the UI renders a hatched "no data" bar rather than an empty one.
    // Any district-keyed source populates this without touching the scoring.
    let investmentDeficitScore: number | null = null;
    if (medianPerCapita != null && medianPerCapita > 0 && cell.population && cell.population > 0) {
      if (cell.sanctionedLakh != null) {
        const own = (cell.sanctionedLakh / cell.population) * 100_000;
        investmentDeficitScore = clamp01(1 - own / medianPerCapita);
      } else {
        // Data exists nationally but this district has no recorded commitment,
        // which is itself evidence of neglect.
        investmentDeficitScore = 1;
      }
    }

    // --- Weighted sum over *available* components only -------------------
    // When a component is unavailable we renormalise across the rest instead of
    // treating it as zero. Otherwise every district would be uniformly deflated
    // by the missing weight and the scores would silently stop meaning "0..1".
    const parts: { name: string; weight: number; value: number }[] = [
      { name: 'demand', weight: w.demand, value: demandScore },
      { name: 'gap', weight: w.gap, value: gapScore },
      { name: 'equity', weight: w.equity, value: equityScore },
    ];
    if (investmentDeficitScore != null) {
      parts.push({ name: 'investment', weight: w.investment, value: investmentDeficitScore });
    }

    const usable = parts.filter((p) => p.weight > 0);
    const weightSum = usable.reduce((a, p) => a + p.weight, 0);
    const priorityScore =
      weightSum > 0 ? usable.reduce((a, p) => a + p.weight * p.value, 0) / weightSum : 0;

    return {
      ...cell,
      demandPer100kHouseholds,
      demandScore,
      gapScore,
      investmentDeficitScore,
      equityScore,
      priorityScore,
      gapIsDirect: spec?.direct ?? false,
      componentsUsed: usable.map((p) => p.name),
    };
  });

  // Deterministic ordering: score descending, then census code so ties never
  // shuffle between runs.
  scored.sort((a, b) => b.priorityScore - a.priorityScore || a.censusCode - b.censusCode);

  return scored.map((s, i) => ({ ...s, rank: i + 1 }));
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

export interface LoadOptions {
  /** Restrict to one category. Omit for all. */
  category?: string;
  /**
   * Restrict to a set of categories. Omit for all.
   *
   * Used by the admin department scope: a department owns one or two of the
   * eight planning categories (Electricity covers both Electricity and Street
   * Lights), so scoping the planning view to a department means restricting it
   * to that department's categories. Intersected with `category` when both are
   * given, so a narrower explicit choice always wins over the sidebar scope.
   */
  categories?: string[];
  /** Restrict to one state by id. Omit for all of India. */
  stateId?: string;
  /**
   * Include modelled demand rows. Default true, because with real complaint
   * volumes still in the low hundreds a real-only view has nothing to rank.
   * Exposed so the distinction is always inspectable.
   */
  includeSynthetic?: boolean;
}

/**
 * Gather the raw facts for scoring.
 *
 * Four narrow queries joined in memory, rather than one wide SQL statement with
 * a pivot. The aggregate is grouped in the database (where 150k rows belong),
 * and 6,400 indicator rows are trivial to join in JS. The tradeoff buys
 * considerably more readable code.
 */
export async function loadDemandCells(opts: LoadOptions = {}): Promise<DemandCell[]> {
  const includeSynthetic = opts.includeSynthetic ?? true;

  /**
   * The category set this run covers, or undefined for all eight.
   *
   * `category` and `categories` are intersected rather than one overriding the
   * other: `categories` carries the department scope from the sidebar, and
   * `category` is the user's explicit pick within the page. Letting either one
   * win outright would show a department a category it does not own, or ignore
   * a filter the user just set.
   */
  const selectedCategories: string[] | undefined = (() => {
    const fromList = opts.categories?.length ? opts.categories : undefined;
    if (opts.category && fromList) {
      return fromList.includes(opts.category) ? [opts.category] : [];
    }
    if (opts.category) return [opts.category];
    return fromList;
  })();

  const districtWhere = opts.stateId ? { stateId: opts.stateId } : {};

  const [districts, grouped, indicators, investments] = await Promise.all([
    prisma.district.findMany({
      where: districtWhere,
      select: {
        id: true,
        name: true,
        censusCode: true,
        households: true,
        population: true,
        state: { select: { name: true } },
      },
    }),
    prisma.complaint.groupBy({
      by: ['districtId', 'category'],
      where: {
        districtId: { not: null },
        ...(selectedCategories ? { category: { in: selectedCategories } } : {}),
        ...(includeSynthetic ? {} : { isSynthetic: false }),
      },
      _count: { _all: true },
      // Prisma requires an orderBy alongside groupBy on this shape.
      orderBy: [{ districtId: 'asc' }, { category: 'asc' }],
    }),
    prisma.districtIndicator.findMany({
      where: { source: 'census2011', metric: { in: [...REFERENCED_METRICS, ...EQUITY_METRICS] } },
      select: { districtId: true, metric: true, value: true },
    }),
    prisma.investment.groupBy({
      by: ['districtId'],
      _sum: { costLakh: true },
      orderBy: { districtId: 'asc' },
    }),
  ]);

  const districtById = new Map(districts.map((d) => [d.id, d]));

  const metricsByDistrict = new Map<string, Record<string, number>>();
  for (const row of indicators) {
    let m = metricsByDistrict.get(row.districtId);
    if (!m) metricsByDistrict.set(row.districtId, (m = {}));
    m[row.metric] = row.value;
  }

  const sanctionedByDistrict = new Map(
    investments.map((i) => [i.districtId, i._sum.costLakh ?? null] as const),
  );

  const demandByKey = new Map<string, number>();
  for (const g of grouped) {
    if (!g.districtId) continue;
    demandByKey.set(`${g.districtId}|${g.category}`, g._count._all);
  }

  // Emit a cell for every district-category pair, including zero-demand ones.
  // A district with severe measured deprivation and no complaints is a real and
  // important case — it usually means people have given up reporting, or cannot.
  // Dropping those rows would bias the ranking toward places that already have
  // a working feedback loop.
  const categories = selectedCategories
    ? CATEGORY_SPECS.filter((s) => selectedCategories.includes(s.category))
    : CATEGORY_SPECS;

  const cells: DemandCell[] = [];
  for (const d of districtById.values()) {
    const metrics = metricsByDistrict.get(d.id) ?? {};
    for (const spec of categories) {
      cells.push({
        districtId: d.id,
        districtName: d.name,
        censusCode: d.censusCode,
        stateName: d.state.name,
        category: spec.category,
        complaints: demandByKey.get(`${d.id}|${spec.category}`) ?? 0,
        households: d.households,
        population: d.population,
        metrics,
        sanctionedLakh: sanctionedByDistrict.get(d.id) ?? null,
      });
    }
  }

  return cells;
}

/** Convenience: load, score, rank, and take the top `limit` rows. */
export async function rankDistricts(
  opts: LoadOptions & { limit?: number; weights?: Weights } = {},
): Promise<{ rows: ScoredCell[]; weights: Weights; totalCells: number; investmentDataAvailable: boolean }> {
  const weights = opts.weights ? normaliseWeights(opts.weights) : await loadWeights();
  const cells = await loadDemandCells(opts);
  const scored = scoreCells(cells, weights);
  const investmentDataAvailable = scored.some((s) => s.investmentDeficitScore != null);
  return {
    rows: typeof opts.limit === 'number' ? scored.slice(0, opts.limit) : scored,
    weights,
    totalCells: scored.length,
    investmentDataAvailable,
  };
}
