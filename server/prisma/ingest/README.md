# Dataset ingest

Scripts that load public datasets into the national planning tables
(`states`, `districts`, `district_indicators`, `investments`).

## Running

```cmd
npm --prefix server run ingest:census
```

Every script is idempotent. Districts are upserted on their Census 2011 code, and
indicator rows for a given `source` are replaced wholesale on each run, so
re-running is always safe.

## The `data/` folder

Source files are cached in `data/`, which is **gitignored**. Scripts download on
first run and work offline afterwards, so a live demo never depends on network
access.

`data/` is not committed because not every upstream mirror is licensed for
redistribution. The Census CSV in particular comes from a community repository
with no licence file, so shipping a copy inside this repo would not be
permissible. Anyone reproducing the project downloads it themselves on first run.
See [ATTRIBUTIONS.md](../../../ATTRIBUTIONS.md).

If a download is blocked in your environment, the script prints the exact path to
drop the file at and then exits.

## What ingests today

| Script | Source | Writes |
| --- | --- | --- |
| `census2011.ts` | Census of India 2011 district tables | 35 states, 640 districts, 6,400 indicator rows |
| `synthesize-demand.ts` | Modelled, weighted by the above | ~150,000 flagged synthetic complaints |

### Census 2011 indicators

Ten derived metrics, all expressed so that **higher always means worse
deprivation**, which lets the prioritisation engine treat them uniformly without
per-metric sign handling:

| Metric | Meaning |
| --- | --- |
| `no_tapwater_pct` | Households without treated tap water |
| `water_source_away_pct` | Households fetching water from away |
| `no_electricity_pct` | Households without electric lighting |
| `no_latrine_pct` | Households without a latrine on the premises |
| `open_defecation_pct` | Households resorting to open defecation |
| `no_internet_pct` | Households without internet access |
| `dilapidated_housing_pct` | Households in dilapidated housing |
| `illiteracy_pct` | Population unable to read and write |
| `sc_st_share_pct` | Scheduled Caste and Scheduled Tribe share of population |
| `rural_household_share_pct` | Rural share of households |

Raw counts (population, households, literate, SC, ST, rural/urban households)
are stored on `districts` so figures stay auditable against the published census
tables. Rates are our derivation and live in `district_indicators`.

**Sanity check.** The most water-deprived districts come out as Supaul,
Kishanganj, Araria and Madhepura, all in north Bihar, at 98–99% of households
without tap water. That matches the published 2011 picture, where rural Bihar
relied almost entirely on handpumps. `no_internet_pct` averaging 98.3%
nationally is likewise correct for 2011.

**One metric deliberately omitted.** The file carries twelve `Power_Parity_*`
income bands, but `Total_Power_Parity` is not household-denominated — across all
640 districts it is a median of 0.52% of a district's households, with no
documented sampling methodology. Shares computed from it are not defensible, so
no income metric is derived. Equity is carried by the full-count measures above
instead. The reasoning is recorded in `census2011.ts` next to where the metric
would have gone.

## Modelled citizen demand

```cmd
npm --prefix server run ingest:demand
npm --prefix server run ingest:demand -- --count 50000
```

Requires `ingest:census` and `db:seed` to have run first; the script checks both
and exits with instructions if either is missing.

### Why it is modelled

Nivaran has no access to real national grievance microdata. CPGRAMS, India's
central grievance portal, publishes only aggregate monthly PDFs. So demonstrating
district-level hotspots requires generated demand, and the responsible way to do
that is to make the model explicit:

```
expected complaints(district, category)
    ∝ households(district)                  <- real Census 2011
    × deprivation(district, category)        <- real Census 2011
    × propensity(category)                   <- stated assumption
```

The volume is synthetic. The **spatial distribution is driven by real census
deprivation**, so hotspots fall where infrastructure gaps genuinely are.

`propensity` encodes that daily-friction problems are reported far more often
than latent ones — a dry tap is noticed every morning, an absent clinic is not.
It shapes modelled volume only and has no effect on scoring. Values live in
`src/services/planning/categories.ts` alongside the category-to-metric mapping,
so the generator and the prioritisation engine cannot drift apart.

### Citizen feedback

Resolved complaints also receive ratings, at a 32% response rate — a minority, as
in any real grievance system. Ratings are driven by turnaround rather than drawn at
random, because satisfaction tracking resolution speed is the most robust finding
in public-service feedback and it gives the analytics a signal worth reading.

Turnaround itself is modelled per category, reflecting the real shape of the work:

| Category | Typical days | Observed mean | Mean rating |
| --- | --- | --- | --- |
| Electricity | 5 | 6.5 | 3.75 |
| Street Lights | 6 | 7.6 | 3.60 |
| Waste Management | 7 | 8.8 | 3.50 |
| Water Supply | 9 | 11.2 | 3.40 |
| Sanitation | 14 | 17.3 | 3.03 |
| Drainage | 18 | 21.6 | 2.84 |
| Public Health | 21 | 25.2 | 2.64 |
| Roads & Infrastructure | 32 | 36.5 | 2.41 |

Correlation between category mean turnaround and category mean rating: **-0.979**.

An earlier version picked the resolution date uniformly between submission and
today. That gave a mean turnaround near three months and, being independent of
category, put every category's satisfaction score within 0.1 of every other — the
by-category panel was populated and analytically worthless. Swapping a streetlight
bulb and resurfacing a road are not the same job, and the data now says so.

### Verification

Correlation between real Census `no_tapwater_pct` and modelled water-complaint
intensity per 100,000 households, measured across 637 districts: **0.909**.

| District | State | Households without tap water | Water complaints per 100k households |
| --- | --- | --- | --- |
| Supaul | Bihar | 99.1% | 10.0 |
| Araria | Bihar | 98.9% | 10.0 |
| Barpeta | Assam | 98.8% | 10.4 |
| Chandigarh | Chandigarh | 23.8% | 2.3 |
| Theni | Tamil Nadu | 22.0% | 2.4 |
| Hyderabad | Andhra Pradesh | 19.2% | 2.0 |

A roughly fivefold intensity gradient tracking the real deprivation gradient.

### Honesty guarantees

- Every generated row has `isSynthetic = true` and is badged in the UI.
- All rows belong to one clearly-labelled account,
  `modelled.demand@synthetic.nivaran.invalid`. The `.invalid` TLD is reserved by
  RFC 2606 and can never resolve, so it cannot collide with a real citizen.
- `aiConfidence` stays 0, because these rows were never classified by the model.
  Inventing a confidence would corrupt the AI-accuracy figure the admin dashboard
  computes over `aiConfidence > 0`.
- Complaints filed through the app by real users are never flagged and remain
  separable with a single predicate.
- Generation is deterministic (fixed seed), so the corpus is reproducible and
  auditable rather than different on every run.

Re-running clears previous synthetic rows first, so the corpus never
double-counts.

## Adding a dataset

1. Add a script here that uses `cachedDownload` and `readCsv` from `util.ts`.
2. Write derived rates into `district_indicators` with a new `source` value.
   The table is tall, so no migration is needed for new metrics.
3. Join on `District.censusCode`, or on `District.lgdCode` for scheme-level data
   keyed to the Local Government Directory.
4. Record the source and its licence in `ATTRIBUTIONS.md`.
