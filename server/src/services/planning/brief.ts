/**
 * Gemini policy briefing — the narrative layer over the deterministic ranking.
 *
 * THE ONE RULE THIS MODULE ENFORCES
 * ---------------------------------
 * Gemini never produces a number.
 *
 * Every figure a policymaker reads — priority score, deprivation percentage,
 * complaint intensity, affected population — is computed in `priority.ts` from
 * database rows. Gemini receives that finished table and writes prose about it:
 * why this district ranks where it does, what interventions follow, what could
 * go wrong. It interprets; it does not calculate.
 *
 * This is not stylistic fussiness. A ranking that decides where public money
 * goes has to be reproducible and auditable, and a language model is neither.
 * Three mechanisms hold the line:
 *
 *   1. The response schema has no numeric fields. There is nowhere for a
 *      hallucinated figure to be stored as data.
 *   2. `inputDigest` records a SHA-256 of the exact payload the model saw, so
 *      any sentence can be traced back to the numbers that produced it.
 *   3. `verifyFigures` scans the generated prose for numbers and checks each one
 *      against the figures we supplied. Anything unaccounted for is recorded on
 *      the row rather than silently published.
 *
 * And when Gemini is unavailable or misbehaves, the ranking still stands: the
 * row persists with `degraded = true` and no prose. The same
 * never-fail-the-caller posture as the complaint classifier in services/ai.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../db';
import { geminiUrl } from '../ai';
import { specFor } from './categories';
import type { ScoredCell } from './priority';

// ---------------------------------------------------------------------------
// Payload handed to the model
// ---------------------------------------------------------------------------

/**
 * The complete, numbers-only view of one district-category pair that the model
 * is allowed to see. Nothing else is sent — no raw complaint text, no citizen
 * identifiers, no rows.
 */
export interface BriefInput {
  district: string;
  state: string;
  category: string;
  rank: number;
  /** 0..1, the composite from priority.ts. */
  priorityScore: number;
  demandScore: number;
  gapScore: number;
  equityScore: number;
  investmentDeficitScore: number | null;
  /** Percentage of households affected by the measured deficit. */
  gapPct: number;
  /** Whether the deficit is directly measured or proxied. */
  gapIsDirect: boolean;
  /** Why these census metrics stand in for this category. */
  gapBasis: string;
  complaints: number;
  demandPer100kHouseholds: number;
  households: number | null;
  population: number | null;
  /** Population implied by the deficit rate. Computed here, not by the model. */
  estimatedAffectedPeople: number | null;
  /** The underlying census rates, so the model can cite the specific deficit. */
  censusMetrics: Record<string, number>;
  investmentDataAvailable: boolean;
}

/**
 * Derive the model-visible payload from a scored cell.
 *
 * `estimatedAffectedPeople` is arithmetic we do ourselves — population times the
 * deficit rate. Asking the model for it would be exactly the boundary violation
 * this module exists to prevent.
 */
export function toBriefInput(cell: ScoredCell): BriefInput {
  const spec = specFor(cell.category);
  const gapPct = round1(cell.gapScore * 100);
  const censusMetrics: Record<string, number> = {};
  for (const m of spec?.metrics ?? []) {
    const v = cell.metrics[m];
    if (typeof v === 'number') censusMetrics[m] = round1(v);
  }

  return {
    district: cell.districtName,
    state: cell.stateName,
    category: cell.category,
    rank: cell.rank,
    priorityScore: round3(cell.priorityScore),
    demandScore: round3(cell.demandScore),
    gapScore: round3(cell.gapScore),
    equityScore: round3(cell.equityScore),
    investmentDeficitScore:
      cell.investmentDeficitScore == null ? null : round3(cell.investmentDeficitScore),
    gapPct,
    gapIsDirect: cell.gapIsDirect,
    gapBasis: spec?.basis ?? 'No mapping recorded for this category.',
    complaints: cell.complaints,
    demandPer100kHouseholds: round1(cell.demandPer100kHouseholds),
    households: cell.households,
    population: cell.population,
    estimatedAffectedPeople:
      cell.population != null ? Math.round(cell.population * (cell.gapScore || 0)) : null,
    censusMetrics,
    investmentDataAvailable: cell.investmentDeficitScore != null,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** SHA-256 of the payload, with keys ordered so the digest is stable. */
export function digestOf(input: BriefInput): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex');
}

/** JSON.stringify with deterministic key ordering, so digests are comparable. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

// ---------------------------------------------------------------------------
// Response contract
// ---------------------------------------------------------------------------

/**
 * Note what is absent: no numeric fields at all. The model returns prose or
 * nothing. Anything quantitative is already in `BriefInput`.
 */
export const BriefSchema = z.object({
  rationale: z.string().trim().min(20).max(1400),
  interventions: z.array(z.string().trim().min(5).max(300)).min(2).max(5),
  risks: z.array(z.string().trim().min(5).max(300)).min(1).max(4),
});

export type Brief = z.infer<typeof BriefSchema>;

export interface BriefResult {
  brief: Brief | null;
  modelName: string;
  inputDigest: string;
  degraded: boolean;
  /** Numbers in the prose that were not present in the payload. */
  unverifiedFigures: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Numeric provenance
// ---------------------------------------------------------------------------

/**
 * Collect every numeric string a faithful narrative could legitimately mention,
 * in the various forms a model might write them.
 */
function allowedFigures(input: BriefInput): Set<string> {
  const out = new Set<string>();
  const add = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(n)) return;
    out.add(String(n));
    out.add(String(Math.round(n)));
    out.add(String(round1(n)));
    // Scores are often quoted as percentages.
    if (n <= 1) {
      out.add(String(round1(n * 100)));
      out.add(String(Math.round(n * 100)));
    }
    // Large counts are often abbreviated in lakhs, the Indian convention.
    if (n >= 100_000) {
      out.add(String(round1(n / 100_000)));
      out.add(String(Math.round(n / 100_000)));
    }
    if (n >= 10_000_000) {
      out.add(String(round1(n / 10_000_000)));
    }
  };

  add(input.rank);
  add(input.priorityScore);
  add(input.demandScore);
  add(input.gapScore);
  add(input.equityScore);
  add(input.investmentDeficitScore);
  add(input.gapPct);
  add(input.complaints);
  add(input.demandPer100kHouseholds);
  add(input.households);
  add(input.population);
  add(input.estimatedAffectedPeople);
  for (const v of Object.values(input.censusMetrics)) add(v);
  // Denominators and small ordinals that appear in ordinary prose.
  for (const n of [0, 1, 2, 3, 4, 5, 10, 100, 1000, 100_000, 2011]) out.add(String(n));
  return out;
}

/**
 * Find numbers in `text` that we never supplied.
 *
 * Deliberately advisory rather than a hard failure: prose legitimately contains
 * numerals, and this cannot distinguish every benign case. It exists so an
 * invented statistic is recorded and visible instead of quietly reaching a
 * policymaker. Findings are stored on the row.
 */
export function verifyFigures(text: string, allowed: Set<string>): string[] {
  const found = text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  const unverified: string[] = [];
  for (const raw of found) {
    const cleaned = raw.replace(/,/g, '');
    if (allowed.has(cleaned)) continue;
    const asNum = Number(cleaned);
    if (!Number.isFinite(asNum)) continue;
    // Tolerate rounding: accept if any allowed figure is within 1%.
    const near = [...allowed].some((a) => {
      const an = Number(a);
      if (!Number.isFinite(an)) return false;
      const scale = Math.max(Math.abs(an), Math.abs(asNum), 1);
      return Math.abs(an - asNum) / scale < 0.01;
    });
    if (!near) unverified.push(cleaned);
  }
  return [...new Set(unverified)];
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = [
  'You advise Indian national policymakers on where infrastructure investment should go.',
  'You will receive a JSON object of ALREADY-COMPUTED statistics for one district and one service category.',
  '',
  'ABSOLUTE RULES:',
  '1. Do NOT calculate, estimate, or invent any number. Every figure you mention must appear verbatim in the JSON you were given.',
  '2. If you want to make a quantitative point for which no figure was supplied, describe it qualitatively instead.',
  '3. Do not speculate about causes the data cannot support. Do not reference events, schemes, or budgets not present in the input.',
  '4. If `gapIsDirect` is false, the deficit measure is a PROXY. Say so plainly in the rationale; do not present it as a direct measurement.',
  '5. If `investmentDataAvailable` is false, acknowledge that existing public spending in this district is unknown, and do not imply the area is either funded or unfunded.',
  '',
  'Return ONLY a JSON object with exactly these keys:',
  '  rationale     — 3 to 5 sentences explaining why this district-category pair warrants attention, citing supplied figures. Plain administrative English.',
  '  interventions — array of 2 to 5 concrete, implementable actions a ministry could fund. Specific, not generic advice.',
  '  risks         — array of 1 to 4 risks or caveats, including data limitations where relevant.',
  '',
  'No commentary, no code fences, no markdown. Write for a senior civil servant: direct, unadorned, no salesmanship.',
].join('\n');

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Extract the retry delay Gemini suggests on a 429.
 *
 * The API returns a RetryInfo entry in the error details carrying a duration
 * like "27s". Honouring it is considerably more effective than guessing, since
 * the free tier enforces both per-minute and per-day quotas.
 */
function suggestedRetryMs(bodyText: string): number | null {
  const m = bodyText.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (!m?.[1]) return null;
  const seconds = Number(m[1]);
  return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : null;
}

/**
 * POST to Gemini, retrying on rate limits and transient server errors.
 *
 * The free tier rate-limits aggressively, and a batch of briefings will hit it.
 * Without this, a run silently degrades most of its rows — which is safe, but
 * leaves the demo without narrative. Retries are capped so a genuinely exhausted
 * daily quota fails fast rather than hanging.
 */
async function fetchWithRetry(url: string, body: string, attempts = 4): Promise<Response> {
  let lastRes: Response | null = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    // 429 = quota. 5xx = transient upstream fault. Both are worth another try.
    if (res.status !== 429 && res.status < 500) return res;

    lastRes = res;
    if (attempt === attempts) break;

    // Read the body to find the suggested delay. This consumes the stream, so
    // the response is not reusable afterwards — acceptable, we are retrying.
    const text = await res.clone().text();

    // A per-minute quota clears in seconds and is worth waiting out. A per-day
    // quota will not clear today, so retrying is pure delay: a run that hit the
    // daily limit spent 400 seconds backing off to gain four briefings. Bail
    // immediately and let the caller degrade.
    if (/PerDay/i.test(text)) {
      console.warn('[planning] Gemini daily quota exhausted; not retrying. Rows will persist without narrative.');
      return res;
    }

    const suggested = suggestedRetryMs(text);
    // Exponential backoff as the floor, capped so a run cannot stall for
    // minutes on end.
    const backoff = Math.min(2000 * 2 ** (attempt - 1), 30_000);
    const waitMs = Math.min(Math.max(suggested ?? backoff, backoff), 45_000);

    console.warn(
      `[planning] Gemini ${res.status} (attempt ${attempt}/${attempts}); retrying in ${(waitMs / 1000).toFixed(1)}s`,
    );
    await sleep(waitMs);
  }

  return lastRes as Response;
}

/**
 * Ask Gemini to narrate one computed row.
 *
 * Never throws. A failure returns `degraded: true` with a null brief, because a
 * missing paragraph must not take down a ranking that is already correct.
 */
export async function generateBrief(input: BriefInput): Promise<BriefResult> {
  const inputDigest = digestOf(input);
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

  if (!apiKey) {
    return {
      brief: null,
      modelName: 'none',
      inputDigest,
      degraded: true,
      unverifiedFigures: [],
      error: 'GEMINI_API_KEY not configured',
    };
  }

  try {
    const body = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${SYSTEM_PROMPT}\n\nDATA:\n${JSON.stringify(input, null, 2)}` }],
        },
      ],
      generationConfig: {
        // Zero temperature: the same figures should yield a stable reading,
        // not a fresh interpretation on every refresh.
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    const res = await fetchWithRetry(geminiUrl(model, apiKey), body);
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned empty content');

    const parsed = BriefSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      throw new Error(`response failed schema: ${parsed.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`);
    }

    const allowed = allowedFigures(input);
    const prose = [parsed.data.rationale, ...parsed.data.interventions, ...parsed.data.risks].join(' ');
    const unverifiedFigures = verifyFigures(prose, allowed);
    if (unverifiedFigures.length) {
      console.warn(
        `[planning] ${input.district}/${input.category}: prose contains figures absent from the payload: ${unverifiedFigures.join(', ')}`,
      );
    }

    return { brief: parsed.data, modelName: model, inputDigest, degraded: false, unverifiedFigures };
  } catch (err) {
    console.warn(`[planning] brief generation failed for ${input.district}/${input.category}:`, err);
    return {
      brief: null,
      modelName: 'none',
      inputDigest,
      degraded: true,
      unverifiedFigures: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Narrate the supplied cells and persist them as Recommendation rows.
 *
 * Reuses an existing row when its `inputDigest` matches, so refreshing a page
 * does not re-bill the API or produce fresh wording for identical numbers. Pass
 * `force` to regenerate regardless.
 */
export async function persistRecommendations(
  cells: ScoredCell[],
  opts: { force?: boolean; concurrency?: number } = {},
): Promise<{ generated: number; reused: number; degraded: number }> {
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 3, 8));
  let generated = 0;
  let reused = 0;
  let degraded = 0;

  // Small worker pool: enough to keep the demo responsive, gentle enough not to
  // trip Gemini's free-tier rate limits.
  const queue = [...cells];
  async function worker() {
    for (;;) {
      const cell = queue.shift();
      if (!cell) return;

      const input = toBriefInput(cell);
      const inputDigest = digestOf(input);

      if (!opts.force) {
        const existing = await prisma.recommendation.findFirst({
          where: { districtId: cell.districtId, category: cell.category, inputDigest, degraded: false },
        });
        if (existing) {
          // Rank can shift without the underlying figures changing.
          if (existing.rank !== cell.rank) {
            await prisma.recommendation.update({ where: { id: existing.id }, data: { rank: cell.rank } });
          }
          reused++;
          continue;
        }
      }

      const result = await generateBrief(input);
      if (result.degraded) degraded++;
      else generated++;

      const risks = result.brief ? [...result.brief.risks] : [];
      if (result.unverifiedFigures.length) {
        risks.push(
          `Data integrity: the generated narrative referenced ${result.unverifiedFigures.length} figure(s) not present in the computed inputs (${result.unverifiedFigures.join(', ')}). Treat those specific numbers as unverified.`,
        );
      }

      // One row per district-category pair: replace rather than accumulate, so
      // the table always reflects the current ranking.
      await prisma.$transaction(async (tx) => {
        await tx.recommendation.deleteMany({
          where: { districtId: cell.districtId, category: cell.category },
        });
        await tx.recommendation.create({
          data: {
            districtId: cell.districtId,
            category: cell.category,
            rank: cell.rank,
            demandScore: cell.demandScore,
            gapScore: cell.gapScore,
            // Persisted as 0 only because the column is non-null; `degraded`
            // and componentsUsed upstream carry the "unknown" signal.
            investmentDeficitScore: cell.investmentDeficitScore ?? 0,
            equityScore: cell.equityScore,
            priorityScore: cell.priorityScore,
            rationale: result.brief?.rationale ?? '',
            interventions: result.brief ? result.brief.interventions : undefined,
            risks: risks.length ? risks : undefined,
            expectedBeneficiaries: input.estimatedAffectedPeople,
            modelName: result.modelName,
            inputDigest,
            degraded: result.degraded,
          },
        });
      });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return { generated, reused, degraded };
}
