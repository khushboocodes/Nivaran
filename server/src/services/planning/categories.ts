/**
 * The bridge between citizen complaint categories and Census 2011 deprivation
 * metrics.
 *
 * This mapping is the single most contestable judgement in the planning engine,
 * so it lives in one place, is annotated, and is exposed to the UI rather than
 * buried. A policymaker is entitled to ask "why does a drainage complaint get
 * scored against open-defecation data?" and the answer has to be legible.
 *
 * `direct: true`  — the census measures the thing the category is about.
 * `direct: false` — we are using a proxy because Census 2011 carries no column
 *                   for it. Proxies are still useful signal, but the UI labels
 *                   them so they are never passed off as measurements.
 *
 * Imported by both the demand generator and the prioritisation engine so the
 * two can never drift apart.
 */

export interface CategorySpec {
  /** Category as emitted by the AI classifier. */
  category: string;
  /** Department that owns this category, matching the seeded department names. */
  department: string;
  /**
   * Census deprivation metrics evidencing this category's gap. When more than
   * one is listed the gap score is their mean, which smooths single-metric
   * noise.
   */
  metrics: string[];
  /** Whether the census measures this directly, or we are proxying. */
  direct: boolean;
  /** Human-readable justification, surfaced in the planning UI. */
  basis: string;
  /**
   * Relative likelihood that a given household with this deprivation actually
   * files a complaint about it. Daily-friction problems surface far more often
   * than latent ones: a dry tap is noticed every morning, an absent clinic is
   * not. Used only to shape modelled demand; it does not affect scoring.
   */
  propensity: number;
}

export const CATEGORY_SPECS: CategorySpec[] = [
  {
    category: 'Water Supply',
    department: 'Water Supply Board',
    metrics: ['no_tapwater_pct', 'water_source_away_pct'],
    direct: true,
    basis:
      'Census 2011 records each household\'s main drinking-water source and how far it is fetched from.',
    propensity: 1.0,
  },
  {
    category: 'Electricity',
    department: 'Electricity Department',
    metrics: ['no_electricity_pct'],
    direct: true,
    basis: 'Census 2011 records whether a household uses electricity for lighting.',
    propensity: 0.85,
  },
  {
    category: 'Sanitation',
    department: 'Sanitation Department',
    metrics: ['no_latrine_pct'],
    direct: true,
    basis: 'Census 2011 records whether a latrine is available within the premises.',
    propensity: 0.45,
  },
  {
    category: 'Drainage',
    department: 'Municipal Corporation',
    metrics: ['open_defecation_pct', 'no_latrine_pct'],
    direct: false,
    basis:
      'Proxy. Census 2011 has no drainage or sewerage column. Open defecation and absent latrines are the closest available signal for missing sewerage networks.',
    propensity: 0.6,
  },
  {
    category: 'Waste Management',
    department: 'Sanitation Department',
    metrics: ['no_latrine_pct', 'dilapidated_housing_pct'],
    direct: false,
    basis:
      'Proxy. Census 2011 does not measure solid-waste collection. Sanitation absence and dilapidated housing stand in as indicators of weak municipal service delivery.',
    propensity: 0.7,
  },
  {
    category: 'Street Lights',
    department: 'Electricity Department',
    metrics: ['no_electricity_pct'],
    direct: false,
    basis:
      'Proxy. Street lighting is not a census variable. Household electrification is used as a proxy for local electrical infrastructure reach.',
    propensity: 0.5,
  },
  {
    category: 'Roads & Infrastructure',
    department: 'Public Works Department',
    metrics: ['rural_household_share_pct', 'water_source_away_pct', 'dilapidated_housing_pct'],
    direct: false,
    basis:
      'Proxy. Census 2011 contains no road-quality column. Rurality, distance to water, and dilapidated housing together approximate weak physical connectivity and built-environment investment.',
    propensity: 0.9,
  },
  {
    category: 'Public Health',
    department: 'Healthcare Department',
    metrics: ['no_latrine_pct', 'no_tapwater_pct', 'illiteracy_pct'],
    direct: false,
    basis:
      'Proxy. Census 2011 records no health facilities or outcomes. Water and sanitation deprivation are established determinants of communicable disease burden, and literacy correlates with health-seeking behaviour.',
    propensity: 0.3,
  },
];

/** Every category name the planning engine knows about. */
export const CATEGORIES = CATEGORY_SPECS.map((s) => s.category);

const BY_CATEGORY = new Map(CATEGORY_SPECS.map((s) => [s.category, s]));

/** Look up a category spec, or undefined for an unrecognised category. */
export function specFor(category: string): CategorySpec | undefined {
  return BY_CATEGORY.get(category);
}

/** Every distinct census metric referenced by any category. */
export const REFERENCED_METRICS = [...new Set(CATEGORY_SPECS.flatMap((s) => s.metrics))].sort();
