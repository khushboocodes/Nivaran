import { describe, it, expect } from 'vitest';
import { verifyFigures, digestOf, toBriefInput, BriefSchema, type BriefInput } from './brief';
import type { ScoredCell } from './priority';

/**
 * The briefing layer's whole value is a guarantee: Gemini interprets numbers, it
 * never invents them. These tests cover the two mechanisms that enforce it —
 * digest stability (so prose is traceable to exact inputs) and figure
 * verification (so an invented statistic is caught rather than published).
 */

function scoredCell(over: Partial<ScoredCell> = {}): ScoredCell {
  return {
    districtId: 'd1',
    districtName: 'Supaul',
    censusCode: 210,
    stateName: 'Bihar',
    category: 'Water Supply',
    complaints: 60,
    households: 600_102,
    population: 2_229_076,
    metrics: { no_tapwater_pct: 99.1, water_source_away_pct: 30.5 },
    sanctionedLakh: null,
    demandPer100kHouseholds: 10.0,
    demandScore: 0.75,
    gapScore: 0.648,
    investmentDeficitScore: null,
    equityScore: 0.44,
    priorityScore: 0.62,
    gapIsDirect: true,
    componentsUsed: ['demand', 'gap', 'equity'],
    rank: 1,
    ...over,
  };
}

describe('input digest', () => {
  it('is stable across key ordering so identical figures reuse a narrative', () => {
    const a = toBriefInput(scoredCell());
    // Rebuild with the same values but a shuffled object literal.
    const b: BriefInput = {
      ...a,
      censusMetrics: Object.fromEntries(Object.entries(a.censusMetrics).reverse()),
    };
    expect(digestOf(b)).toBe(digestOf(a));
  });

  it('changes when any figure changes, so stale prose cannot masquerade as current', () => {
    const base = toBriefInput(scoredCell());
    const moved = toBriefInput(scoredCell({ gapScore: 0.9 }));
    expect(digestOf(moved)).not.toBe(digestOf(base));
  });

  it('produces a sha256 hex string', () => {
    expect(digestOf(toBriefInput(scoredCell()))).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('affected population is computed here, never asked of the model', () => {
  it('derives it from population and the deficit rate', () => {
    const input = toBriefInput(scoredCell({ population: 1_000_000, gapScore: 0.5 }));
    expect(input.estimatedAffectedPeople).toBe(500_000);
  });

  it('is null when population is unknown rather than guessed', () => {
    expect(toBriefInput(scoredCell({ population: null })).estimatedAffectedPeople).toBeNull();
  });
});

describe('proxy honesty is carried into the payload', () => {
  it('passes the direct flag and the justification text through', () => {
    const direct = toBriefInput(scoredCell({ category: 'Water Supply', gapIsDirect: true }));
    expect(direct.gapIsDirect).toBe(true);
    expect(direct.gapBasis).toContain('drinking-water source');

    const proxy = toBriefInput(scoredCell({ category: 'Roads & Infrastructure', gapIsDirect: false }));
    expect(proxy.gapIsDirect).toBe(false);
    expect(proxy.gapBasis).toMatch(/^Proxy\./);
  });

  it('reports whether investment data existed', () => {
    expect(toBriefInput(scoredCell({ investmentDeficitScore: null })).investmentDataAvailable).toBe(false);
    expect(toBriefInput(scoredCell({ investmentDeficitScore: 0.4 })).investmentDataAvailable).toBe(true);
  });
});

describe('figure verification', () => {
  const allowed = new Set(['99.1', '64.8', '60', '10', '2229076', '22.3', '1', '100']);

  it('accepts prose that only restates supplied figures', () => {
    expect(verifyFigures('99.1% of households lack tap water; 60 complaints were filed.', allowed)).toEqual([]);
  });

  it('catches a figure that was never supplied', () => {
    const found = verifyFigures('An estimated 4,200 crore is required.', allowed);
    expect(found).toContain('4200');
  });

  it('ignores thousands separators when matching', () => {
    expect(verifyFigures('A population of 2,229,076 people.', allowed)).toEqual([]);
  });

  it('tolerates rounding within one percent', () => {
    // 99.0 against a supplied 99.1 is a rounding artefact, not an invention.
    expect(verifyFigures('Roughly 99.0% of households.', allowed)).toEqual([]);
  });

  it('deduplicates repeated offenders', () => {
    const found = verifyFigures('7777 here and 7777 again.', allowed);
    expect(found).toEqual(['7777']);
  });

  it('returns nothing for prose with no numerals', () => {
    expect(verifyFigures('Most households rely on handpumps.', allowed)).toEqual([]);
  });
});

describe('response contract has no numeric fields', () => {
  it('accepts a well-formed prose-only brief', () => {
    const ok = BriefSchema.safeParse({
      rationale: 'This district reports the highest measured water deficit in the state and warrants priority attention.',
      interventions: ['Extend the piped distribution network to uncovered habitations.', 'Commission water-quality testing at the block level.'],
      risks: ['Census figures date from 2011 and may understate recent progress.'],
    });
    expect(ok.success).toBe(true);
  });

  it('rejects a brief with too few interventions to be actionable', () => {
    const bad = BriefSchema.safeParse({
      rationale: 'A sufficiently long rationale string for validation purposes here.',
      interventions: ['Only one action provided'],
      risks: ['Some risk'],
    });
    expect(bad.success).toBe(false);
  });

  it('strips unknown keys, so a stray numeric field cannot become data', () => {
    const parsed = BriefSchema.parse({
      rationale: 'A sufficiently long rationale string for validation purposes here.',
      interventions: ['First concrete action', 'Second concrete action'],
      risks: ['A caveat'],
      estimatedCostCrore: 4200,
    });
    expect(parsed).not.toHaveProperty('estimatedCostCrore');
  });
});
