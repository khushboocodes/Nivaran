/**
 * Ingest Census of India 2011 district tables.
 *
 *   npm --prefix server run ingest:census
 *
 * Populates:
 *   states              — 35 states and union territories as of 2011
 *   districts           — 640 districts with raw population/household counts
 *   district_indicators — derived deprivation rates, one row per metric
 *
 * Why store absolutes on `districts` but rates in `district_indicators`?
 * The absolutes are what the published census tables actually contain, so they
 * stay auditable against the source. The rates are our interpretation, and
 * keeping them in a tall table means adding a new indicator never needs a
 * migration.
 *
 * Idempotent: re-running upserts districts by census code and replaces this
 * source's indicator rows wholesale.
 *
 * Data provenance and licensing are documented in ATTRIBUTIONS.md. The CSV is
 * not committed to this repository.
 */
import { PrismaClient } from '@prisma/client';
import { cachedDownload, readCsv, headerIndex, int, pct, deprivationPct, titleCase } from './util';

const prisma = new PrismaClient();

const SOURCE = 'census2011';
/** Census 2011 reference date: 1 March 2011. */
const AS_OF = new Date('2011-03-01T00:00:00.000Z');

const CSV_URL =
  'https://raw.githubusercontent.com/nishusharma1608/India-Census-2011-Analysis/master/india-districts-census-2011.csv';
const CSV_FILE = 'india-districts-census-2011.csv';

/**
 * Derived indicators. Each is a *deprivation* rate — higher always means worse
 * — so the prioritisation engine can treat them uniformly without per-metric
 * sign handling.
 *
 * `direct: true` means the census measures the thing itself. `direct: false`
 * means we are using a proxy because Census 2011 carries no column for it, and
 * that limitation is surfaced in the UI rather than hidden.
 */
interface MetricSpec {
  metric: string;
  label: string;
  direct: boolean;
  compute: (get: (col: string) => number | null, households: number | null, population: number | null) => number | null;
}

const METRICS: MetricSpec[] = [
  {
    metric: 'no_tapwater_pct',
    label: 'Households without treated tap water',
    direct: true,
    compute: (get, hh) => deprivationPct(get('Main_source_of_drinking_water_Tapwater_Households'), hh),
  },
  {
    metric: 'water_source_away_pct',
    label: 'Households fetching water from away',
    direct: true,
    compute: (get, hh) => pct(get('Location_of_drinking_water_source_Away_Households'), hh),
  },
  {
    metric: 'no_electricity_pct',
    label: 'Households without electric lighting',
    direct: true,
    // Upstream column name carries a typo ("Housholds"); matched exactly on purpose.
    compute: (get, hh) => deprivationPct(get('Housholds_with_Electric_Lighting'), hh),
  },
  {
    metric: 'no_latrine_pct',
    label: 'Households without a latrine on the premises',
    direct: true,
    compute: (get, hh) => deprivationPct(get('Having_latrine_facility_within_the_premises_Total_Households'), hh),
  },
  {
    metric: 'open_defecation_pct',
    label: 'Households resorting to open defecation',
    direct: true,
    compute: (get, hh) =>
      pct(get('Not_having_latrine_facility_within_the_premises_Alternative_source_Open_Households'), hh),
  },
  {
    metric: 'no_internet_pct',
    label: 'Households without internet access',
    direct: true,
    compute: (get, hh) => deprivationPct(get('Households_with_Internet'), hh),
  },
  {
    metric: 'dilapidated_housing_pct',
    label: 'Households in dilapidated housing',
    direct: true,
    compute: (get, hh) => pct(get('Condition_of_occupied_census_houses_Dilapidated_Households'), hh),
  },
  {
    metric: 'illiteracy_pct',
    label: 'Population unable to read and write',
    direct: true,
    compute: (get, _hh, pop) => deprivationPct(get('Literate'), pop),
  },
  {
    metric: 'sc_st_share_pct',
    label: 'Scheduled Caste and Scheduled Tribe share of population',
    direct: true,
    compute: (get, _hh, pop) => {
      const sc = get('SC');
      const st = get('ST');
      if (sc == null && st == null) return null;
      return pct((sc ?? 0) + (st ?? 0), pop);
    },
  },
  {
    metric: 'rural_household_share_pct',
    label: 'Rural share of households',
    direct: true,
    compute: (get, hh) => pct(get('Rural_Households'), hh),
  },
  // DELIBERATELY OMITTED: an income metric derived from the Power_Parity_*
  // columns.
  //
  // Those columns look inviting — twelve income bands plus a total — but
  // `Total_Power_Parity` is not household-denominated. Measured across all 640
  // districts it comes to a median of just 0.52% of a district's households
  // (min 0.01%, mean 1.3%), i.e. roughly one observation per two hundred
  // households, and the file documents no sampling methodology. Two districts
  // (Imphal West, Ukhrul) have the lowest band exactly equal to the total,
  // which would compute to "100% low income".
  //
  // A share within an unexplained ~0.5% sample is not something we can put in
  // front of a policymaker and defend, so it is left out entirely. Equity is
  // instead carried by sc_st_share_pct, illiteracy_pct,
  // rural_household_share_pct and dilapidated_housing_pct, all of which are
  // full-count census measures.
];

async function main() {
  const path = await cachedDownload(CSV_URL, CSV_FILE);
  const rows = readCsv(path);
  if (rows.length < 2) throw new Error('[census] CSV has no data rows');

  const idx = headerIndex(rows[0]);
  const required = [
    'District code',
    'State name',
    'District name',
    'Population',
    'Households',
    'Literate',
    'SC',
    'ST',
  ];
  const missing = required.filter((c) => !idx.has(c));
  if (missing.length) {
    throw new Error(
      `[census] expected columns missing from the source file: ${missing.join(', ')}.\n` +
        'The upstream mirror may have changed shape. Inspect the header before continuing.',
    );
  }

  const dataRows = rows.slice(1);
  console.log(`[census] parsed ${dataRows.length} district rows, ${rows[0].length} columns`);

  // --- States -------------------------------------------------------------
  // Census 2011 has no numeric state code in this file, so states are keyed by
  // name. Title-cased for display; the source SHOUTS them.
  const stateNames = [...new Set(dataRows.map((r) => titleCase(r[idx.get('State name')!])))].sort();
  const stateIdByName = new Map<string, string>();
  for (const name of stateNames) {
    const state = await prisma.state.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    stateIdByName.set(name, state.id);
  }
  console.log(`[census] upserted ${stateIdByName.size} states/UTs`);

  // --- Districts ----------------------------------------------------------
  const indicatorRows: {
    districtId: string;
    source: string;
    metric: string;
    value: number;
    unit: string;
    asOf: Date;
  }[] = [];

  let districtCount = 0;
  const skippedMetrics = new Map<string, number>();

  for (const r of dataRows) {
    const censusCode = int(r[idx.get('District code')!]);
    const name = r[idx.get('District name')!]?.trim();
    const stateName = titleCase(r[idx.get('State name')!]);
    if (censusCode == null || !name) continue;

    const stateId = stateIdByName.get(stateName);
    if (!stateId) throw new Error(`[census] no state row for "${stateName}"`);

    /** Look a column up by name for the current row. */
    const get = (col: string): number | null => {
      const i = idx.get(col);
      return i == null ? null : int(r[i]);
    };

    const population = get('Population');
    const households = get('Households');

    const district = await prisma.district.upsert({
      where: { censusCode },
      create: {
        censusCode,
        name,
        stateId,
        population,
        households,
        literate: get('Literate'),
        scPopulation: get('SC'),
        stPopulation: get('ST'),
        ruralHouseholds: get('Rural_Households'),
        urbanHouseholds: get('Urban_Households'),
      },
      update: {
        name,
        stateId,
        population,
        households,
        literate: get('Literate'),
        scPopulation: get('SC'),
        stPopulation: get('ST'),
        ruralHouseholds: get('Rural_Households'),
        urbanHouseholds: get('Urban_Households'),
      },
    });
    districtCount++;

    for (const spec of METRICS) {
      const value = spec.compute(get, households, population);
      if (value == null) {
        // Track rather than silently drop, so a systematically missing column
        // shows up in the run summary instead of quietly skewing rankings.
        skippedMetrics.set(spec.metric, (skippedMetrics.get(spec.metric) ?? 0) + 1);
        continue;
      }
      indicatorRows.push({
        districtId: district.id,
        source: SOURCE,
        metric: spec.metric,
        value: Number(value.toFixed(4)),
        unit: 'pct',
        asOf: AS_OF,
      });
    }
  }
  console.log(`[census] upserted ${districtCount} districts`);

  // --- Indicators ---------------------------------------------------------
  // Replace-then-insert keeps the run idempotent and is far faster than 7,000
  // individual upserts.
  const deleted = await prisma.districtIndicator.deleteMany({ where: { source: SOURCE } });
  if (deleted.count) console.log(`[census] cleared ${deleted.count} previous ${SOURCE} indicator rows`);

  for (let i = 0; i < indicatorRows.length; i += 1000) {
    await prisma.districtIndicator.createMany({ data: indicatorRows.slice(i, i + 1000) });
  }
  console.log(`[census] wrote ${indicatorRows.length} indicator rows across ${METRICS.length} metrics`);

  if (skippedMetrics.size) {
    console.warn('[census] metrics skipped for want of source data:');
    for (const [metric, count] of [...skippedMetrics].sort((a, b) => b[1] - a[1])) {
      console.warn(`  ${metric}: ${count} districts`);
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('[census] done');
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
