import { describe, it, expect } from 'vitest';
import { scoreCells, normaliseWeights, DEFAULT_WEIGHTS, type DemandCell, type Weights } from './priority';

/**
 * The prioritisation engine decides which districts a ministry is told to fund
 * first. It is the one part of this system whose output could move public money,
 * so its arithmetic is tested directly rather than inferred from the UI.
 *
 * `scoreCells` is pure by design, which is what makes this possible without a
 * database.
 */

/** Build a cell with sensible defaults, overriding only what a test cares about. */
function cell(over: Partial<DemandCell> = {}): DemandCell {
  return {
    districtId: over.districtId ?? 'd1',
    districtName: over.districtName ?? 'Testpur',
    censusCode: over.censusCode ?? 1,
    stateName: over.stateName ?? 'Teststate',
    category: over.category ?? 'Water Supply',
    complaints: over.complaints ?? 100,
    households: over.households ?? 100_000,
    population: over.population ?? 500_000,
    metrics: over.metrics ?? { no_tapwater_pct: 50, water_source_away_pct: 50 },
    sanctionedLakh: over.sanctionedLakh ?? null,
  };
}

describe('demand intensity is size-independent', () => {
  it('ranks a small deprived district above a large comfortable one', () => {
    // Same absolute complaint count, ten times the households. The larger
    // district is proportionally quieter and must not win on size alone.
    const rows = scoreCells([
      cell({ districtId: 'small', censusCode: 1, complaints: 100, households: 100_000 }),
      cell({ districtId: 'large', censusCode: 2, complaints: 100, households: 1_000_000 }),
    ]);

    const small = rows.find((r) => r.districtId === 'small')!;
    const large = rows.find((r) => r.districtId === 'large')!;

    expect(small.demandPer100kHouseholds).toBeCloseTo(100);
    expect(large.demandPer100kHouseholds).toBeCloseTo(10);
    expect(small.demandScore).toBeGreaterThan(large.demandScore);
  });

  it('treats a district with no households as zero demand rather than dividing by zero', () => {
    const [row] = scoreCells([cell({ households: 0, complaints: 50 })]);
    expect(Number.isFinite(row.demandPer100kHouseholds)).toBe(true);
    expect(row.demandPer100kHouseholds).toBe(0);
    expect(row.demandScore).toBe(0);
  });
});

describe('gap score reflects the census deprivation rate', () => {
  it('rescales a percentage into 0..1', () => {
    const [row] = scoreCells([cell({ metrics: { no_tapwater_pct: 90, water_source_away_pct: 70 } })]);
    // Mean of 90 and 70 is 80%.
    expect(row.gapScore).toBeCloseTo(0.8);
  });

  it('scores zero when no metric for the category is present', () => {
    const [row] = scoreCells([cell({ metrics: {} })]);
    expect(row.gapScore).toBe(0);
  });

  it('flags whether the gap rests on direct measurement or a proxy', () => {
    const rows = scoreCells([
      cell({ districtId: 'a', censusCode: 1, category: 'Water Supply' }),
      cell({ districtId: 'b', censusCode: 2, category: 'Roads & Infrastructure' }),
    ]);
    expect(rows.find((r) => r.category === 'Water Supply')!.gapIsDirect).toBe(true);
    // Census 2011 has no road column, so this one is explicitly a proxy.
    expect(rows.find((r) => r.category === 'Roads & Infrastructure')!.gapIsDirect).toBe(false);
  });
});

describe('missing investment data is reported, never faked', () => {
  it('leaves the component null when nothing is known nationally', () => {
    const rows = scoreCells([cell({ sanctionedLakh: null })]);
    expect(rows[0].investmentDeficitScore).toBeNull();
    expect(rows[0].componentsUsed).not.toContain('investment');
  });

  it('renormalises the remaining weights so scores stay on a 0..1 scale', () => {
    // Everything at full deprivation. With investment unavailable the score
    // should still reach 1.0, not be deflated to 0.8 by the missing 20% weight.
    const rows = scoreCells([
      cell({
        metrics: {
          no_tapwater_pct: 100,
          water_source_away_pct: 100,
          sc_st_share_pct: 100,
          illiteracy_pct: 100,
          rural_household_share_pct: 100,
          dilapidated_housing_pct: 100,
        },
        sanctionedLakh: null,
      }),
    ]);
    expect(rows[0].investmentDeficitScore).toBeNull();
    expect(rows[0].priorityScore).toBeCloseTo(1);
  });

  it('treats an unfunded district as fully deficient once peers have data', () => {
    const rows = scoreCells([
      cell({ districtId: 'funded', censusCode: 1, sanctionedLakh: 1000, population: 100_000 }),
      cell({ districtId: 'unfunded', censusCode: 2, sanctionedLakh: null, population: 100_000 }),
    ]);
    expect(rows.find((r) => r.districtId === 'unfunded')!.investmentDeficitScore).toBe(1);
    // At or above the national median commitment, so no deficit.
    expect(rows.find((r) => r.districtId === 'funded')!.investmentDeficitScore).toBe(0);
  });
});

describe('weights', () => {
  it('shifts the ranking when equity is weighted over demand', () => {
    const loudLowEquity = cell({
      districtId: 'loud',
      censusCode: 1,
      complaints: 1000,
      metrics: { no_tapwater_pct: 40, water_source_away_pct: 40, sc_st_share_pct: 1, illiteracy_pct: 1, rural_household_share_pct: 1, dilapidated_housing_pct: 1 },
    });
    const quietHighEquity = cell({
      districtId: 'quiet',
      censusCode: 2,
      complaints: 10,
      metrics: { no_tapwater_pct: 40, water_source_away_pct: 40, sc_st_share_pct: 99, illiteracy_pct: 99, rural_household_share_pct: 99, dilapidated_housing_pct: 99 },
    });

    const demandLed: Weights = { demand: 1, gap: 0, investment: 0, equity: 0 };
    const equityLed: Weights = { demand: 0, gap: 0, investment: 0, equity: 1 };

    expect(scoreCells([loudLowEquity, quietHighEquity], demandLed)[0].districtId).toBe('loud');
    expect(scoreCells([loudLowEquity, quietHighEquity], equityLed)[0].districtId).toBe('quiet');
  });

  it('falls back to defaults rather than producing NaN when all weights are zero', () => {
    const w = normaliseWeights({ demand: 0, gap: 0, investment: 0, equity: 0 });
    expect(w).toEqual(DEFAULT_WEIGHTS);
    const rows = scoreCells([cell()], { demand: 0, gap: 0, investment: 0, equity: 0 });
    expect(Number.isFinite(rows[0].priorityScore)).toBe(true);
  });

  it('clamps negative weights to zero', () => {
    expect(normaliseWeights({ demand: -5 }).demand).toBe(0);
  });
});

describe('ranking is deterministic', () => {
  it('breaks ties by census code so runs never shuffle', () => {
    const a = cell({ districtId: 'a', censusCode: 7 });
    const b = cell({ districtId: 'b', censusCode: 3 });
    const first = scoreCells([a, b]);
    const second = scoreCells([b, a]);

    expect(first[0].priorityScore).toBeCloseTo(first[1].priorityScore);
    expect(first.map((r) => r.censusCode)).toEqual([3, 7]);
    expect(second.map((r) => r.censusCode)).toEqual([3, 7]);
  });

  it('assigns contiguous ranks from 1', () => {
    const rows = scoreCells([
      cell({ districtId: 'a', censusCode: 1, complaints: 10 }),
      cell({ districtId: 'b', censusCode: 2, complaints: 500 }),
      cell({ districtId: 'c', censusCode: 3, complaints: 250 }),
    ]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    // Ranks must follow score order.
    expect(rows[0].priorityScore).toBeGreaterThanOrEqual(rows[1].priorityScore);
    expect(rows[1].priorityScore).toBeGreaterThanOrEqual(rows[2].priorityScore);
  });

  it('returns an empty array for no input', () => {
    expect(scoreCells([])).toEqual([]);
  });
});

describe('scores stay within bounds', () => {
  it('keeps every component and the total inside 0..1 for extreme input', () => {
    const rows = scoreCells([
      cell({
        districtId: 'extreme',
        censusCode: 1,
        complaints: 10_000_000,
        households: 1,
        metrics: { no_tapwater_pct: 999, water_source_away_pct: -50, sc_st_share_pct: 500 },
        sanctionedLakh: 0,
        population: 1,
      }),
      cell({ districtId: 'normal', censusCode: 2 }),
    ]);

    for (const r of rows) {
      expect(r.demandScore).toBeGreaterThanOrEqual(0);
      expect(r.demandScore).toBeLessThanOrEqual(1);
      expect(r.gapScore).toBeGreaterThanOrEqual(0);
      expect(r.gapScore).toBeLessThanOrEqual(1);
      expect(r.equityScore).toBeGreaterThanOrEqual(0);
      expect(r.equityScore).toBeLessThanOrEqual(1);
      expect(r.priorityScore).toBeGreaterThanOrEqual(0);
      expect(r.priorityScore).toBeLessThanOrEqual(1);
    }
  });
});
