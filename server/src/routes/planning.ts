/**
 * National demand-intelligence API.
 *
 *   GET /api/planning/meta                    — categories, states, weights
 *   GET /api/planning/rank                    — ranked district-category rows
 *   GET /api/planning/district/:id            — one district, all categories, with briefing
 *   GET /api/planning/brief.pdf               — policy brief as a PDF
 *
 * Officers and admins only. The dataset is national, so a citizen has no
 * business here — same posture as the reports route.
 *
 * Every endpoint returns the deterministic scores computed in
 * services/planning/priority.ts. Narrative text, where present, comes from a
 * persisted Recommendation row and is always accompanied by the digest of the
 * figures it was written from, so a client can prove prose and numbers agree.
 */

import { Hono, type Context } from 'hono';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { prisma } from '../db';
import { getUser } from '../auth/middleware';
import { rankDistricts, loadWeights, normaliseWeights, DEFAULT_WEIGHTS } from '../services/planning/priority';
import { CATEGORY_SPECS } from '../services/planning/categories';
import { categoryToDepartment } from '../services/departments';

const planning = new Hono();

/**
 * Which planning categories belong to a department.
 *
 * Planning rows are keyed by district and category, with no department column —
 * the unit of analysis is infrastructure need, not organisational ownership. To
 * honour the admin sidebar scope we invert the existing complaint router:
 * `categoryToDepartment` already decides which department handles a category, so
 * asking it for all eight categories tells us which ones a given department
 * owns. Reusing that map matters — a second, hand-written mapping here would
 * drift from the one that actually routes complaints.
 *
 * Returns undefined for "no scope", which the ranker reads as all categories.
 */
async function categoriesForDepartment(deptId: string | undefined): Promise<string[] | undefined> {
  const wanted = deptId?.trim();
  if (!wanted || wanted === 'all') return undefined;

  const dept = await prisma.department.findUnique({
    where: { id: wanted },
    select: { name: true },
  });
  // An unknown id must not silently widen the view back to everything.
  if (!dept) return [];

  return CATEGORY_SPECS.filter((s) => categoryToDepartment(s.category) === dept.name).map(
    (s) => s.category,
  );
}

/**
 * Officer/admin gate, mirroring routes/reports.ts.
 *
 * Returns either an early `Response` to hand straight back, or the user.
 */
function guard(c: Context): { error: Response; user?: undefined } | { error?: undefined; user: NonNullable<ReturnType<typeof getUser>> } {
  const user = getUser(c);
  if (!user) return { error: c.json({ code: 'unauthenticated' }, 401) };
  if (user.role === 'citizen') return { error: c.json({ code: 'forbidden' }, 403) };
  return { user };
}

/**
 * Weights arrive as separate query params so the UI can drive them from sliders
 * without a round-trip through settings. Absent params fall back to the stored
 * configuration.
 */
const WeightQuery = z.object({
  wDemand: z.coerce.number().min(0).max(1).optional(),
  wGap: z.coerce.number().min(0).max(1).optional(),
  wInvestment: z.coerce.number().min(0).max(1).optional(),
  wEquity: z.coerce.number().min(0).max(1).optional(),
});

const RankQuery = WeightQuery.extend({
  category: z.string().min(1).optional(),
  stateId: z.string().min(1).optional(),
  /** Admin sidebar department scope. Absent or 'all' covers every category. */
  dept: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(25),
  includeSynthetic: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

/** Resolve weights from query params, falling back to stored settings. */
async function resolveWeights(q: z.infer<typeof WeightQuery>) {
  const anyProvided =
    q.wDemand != null || q.wGap != null || q.wInvestment != null || q.wEquity != null;
  if (!anyProvided) return loadWeights();
  const stored = await loadWeights();
  return normaliseWeights({
    demand: q.wDemand ?? stored.demand,
    gap: q.wGap ?? stored.gap,
    investment: q.wInvestment ?? stored.investment,
    equity: q.wEquity ?? stored.equity,
  });
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

/**
 * Everything the planning UI needs to render its controls, plus the
 * category-to-census-metric mapping including which mappings are proxies. The
 * client shows that distinction rather than presenting proxies as measurements.
 */
planning.get('/meta', async (c) => {
  const g = guard(c);
  if (g.error) return g.error;

  const [states, weights, indicatorCount, districtCount, investmentCount] = await Promise.all([
    prisma.state.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    loadWeights(),
    prisma.districtIndicator.count(),
    prisma.district.count(),
    prisma.investment.count(),
  ]);

  return c.json({
    states,
    categories: CATEGORY_SPECS.map((s) => ({
      category: s.category,
      department: s.department,
      metrics: s.metrics,
      direct: s.direct,
      basis: s.basis,
    })),
    weights,
    defaultWeights: DEFAULT_WEIGHTS,
    coverage: {
      districts: districtCount,
      indicators: indicatorCount,
      /**
       * False means the investment-deficit component is unavailable and its
       * weight is redistributed. The UI states this rather than showing a
       * misleading zero.
       */
      investmentDataAvailable: investmentCount > 0,
      censusYear: 2011,
      censusSource: 'Census of India 2011, district tables',
    },
  });
});

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

planning.get('/rank', async (c) => {
  const g = guard(c);
  if (g.error) return g.error;

  const parsed = RankQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }
  const q = parsed.data;

  const known = CATEGORY_SPECS.some((s) => s.category === q.category);
  if (q.category && !known) {
    return c.json({ code: 'invalid_input', message: `Unknown category "${q.category}"` }, 400);
  }

  const weights = await resolveWeights(q);
  const { rows, totalCells, investmentDataAvailable } = await rankDistricts({
    category: q.category,
    categories: await categoriesForDepartment(q.dept),
    stateId: q.stateId,
    includeSynthetic: q.includeSynthetic,
    limit: q.limit,
    weights,
  });

  // Attach persisted narratives where they exist. Absence is normal: briefings
  // are pre-generated for the top of the ranking, and a row without one still
  // carries complete scores.
  const recs = await prisma.recommendation.findMany({
    where: {
      OR: rows.map((r) => ({ districtId: r.districtId, category: r.category })),
    },
    select: {
      districtId: true,
      category: true,
      rationale: true,
      degraded: true,
      modelName: true,
      inputDigest: true,
      expectedBeneficiaries: true,
    },
  });
  const recByKey = new Map(recs.map((r) => [`${r.districtId}|${r.category}`, r]));

  return c.json({
    weights,
    totalCells,
    investmentDataAvailable,
    rows: rows.map((r) => {
      const rec = recByKey.get(`${r.districtId}|${r.category}`);
      return {
        rank: r.rank,
        districtId: r.districtId,
        district: r.districtName,
        state: r.stateName,
        censusCode: r.censusCode,
        category: r.category,
        priorityScore: r.priorityScore,
        demandScore: r.demandScore,
        gapScore: r.gapScore,
        equityScore: r.equityScore,
        investmentDeficitScore: r.investmentDeficitScore,
        componentsUsed: r.componentsUsed,
        gapIsDirect: r.gapIsDirect,
        complaints: r.complaints,
        demandPer100kHouseholds: r.demandPer100kHouseholds,
        population: r.population,
        households: r.households,
        expectedBeneficiaries: rec?.expectedBeneficiaries ?? null,
        hasBrief: !!rec && !rec.degraded,
        briefModel: rec?.degraded ? null : rec?.modelName ?? null,
      };
    }),
  });
});

// ---------------------------------------------------------------------------
// District detail
// ---------------------------------------------------------------------------

const DetailQuery = WeightQuery.extend({
  category: z.string().min(1).optional(),
});

planning.get('/district/:id', async (c) => {
  const g = guard(c);
  if (g.error) return g.error;

  const districtId = c.req.param('id');
  const parsed = DetailQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }

  const district = await prisma.district.findUnique({
    where: { id: districtId },
    select: {
      id: true,
      name: true,
      censusCode: true,
      population: true,
      households: true,
      literate: true,
      scPopulation: true,
      stPopulation: true,
      ruralHouseholds: true,
      urbanHouseholds: true,
      state: { select: { id: true, name: true } },
    },
  });
  if (!district) return c.json({ code: 'not_found' }, 404);

  const weights = await resolveWeights(parsed.data);

  // Rank nationally, then pick out this district's rows, so the rank shown is a
  // national position rather than a local one.
  const { rows } = await rankDistricts({ category: parsed.data.category, weights });
  const mine = rows.filter((r) => r.districtId === districtId);

  const [indicators, recs] = await Promise.all([
    prisma.districtIndicator.findMany({
      where: { districtId, source: 'census2011' },
      select: { metric: true, value: true, unit: true, asOf: true, source: true },
      orderBy: { metric: 'asc' },
    }),
    prisma.recommendation.findMany({
      where: { districtId, ...(parsed.data.category ? { category: parsed.data.category } : {}) },
      orderBy: { rank: 'asc' },
    }),
  ]);

  // A handful of real citizen quotes, so a policymaker sees the words behind the
  // aggregate. Synthetic rows are labelled, never passed off as real reports.
  const samples = await prisma.complaint.findMany({
    where: { districtId, ...(parsed.data.category ? { category: parsed.data.category } : {}) },
    select: {
      id: true,
      title: true,
      description: true,
      language: true,
      category: true,
      priority: true,
      status: true,
      isSynthetic: true,
      submittedAt: true,
    },
    orderBy: { submittedAt: 'desc' },
    take: 5,
  });

  return c.json({
    district: {
      id: district.id,
      name: district.name,
      censusCode: district.censusCode,
      state: district.state,
      population: district.population,
      households: district.households,
      literate: district.literate,
      scPopulation: district.scPopulation,
      stPopulation: district.stPopulation,
      ruralHouseholds: district.ruralHouseholds,
      urbanHouseholds: district.urbanHouseholds,
    },
    weights,
    scores: mine.map((r) => ({
      category: r.category,
      nationalRank: r.rank,
      priorityScore: r.priorityScore,
      demandScore: r.demandScore,
      gapScore: r.gapScore,
      equityScore: r.equityScore,
      investmentDeficitScore: r.investmentDeficitScore,
      componentsUsed: r.componentsUsed,
      gapIsDirect: r.gapIsDirect,
      complaints: r.complaints,
      demandPer100kHouseholds: r.demandPer100kHouseholds,
    })),
    indicators,
    briefings: recs.map((r) => ({
      category: r.category,
      rank: r.rank,
      rationale: r.rationale,
      interventions: r.interventions,
      risks: r.risks,
      expectedBeneficiaries: r.expectedBeneficiaries,
      // Provenance: which model wrote it, and the digest of the figures it saw.
      modelName: r.modelName,
      inputDigest: r.inputDigest,
      degraded: r.degraded,
      generatedAt: r.generatedAt,
    })),
    samples,
  });
});

// ---------------------------------------------------------------------------
// PDF policy brief
// ---------------------------------------------------------------------------

const PdfQuery = z.object({
  districtId: z.string().min(1),
  category: z.string().min(1),
});

planning.get('/brief.pdf', async (c) => {
  const g = guard(c);
  if (g.error) return g.error;

  const parsed = PdfQuery.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }
  const { districtId, category } = parsed.data;

  const rec = await prisma.recommendation.findFirst({
    where: { districtId, category },
    include: { district: { include: { state: true } } },
  });
  if (!rec) return c.json({ code: 'not_found', message: 'No briefing generated for this district and category yet.' }, 404);

  const spec = CATEGORY_SPECS.find((s) => s.category === category);
  const interventions = Array.isArray(rec.interventions) ? (rec.interventions as string[]) : [];
  const risks = Array.isArray(rec.risks) ? (rec.risks as string[]) : [];

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (ch: Buffer) => chunks.push(ch));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('#0F172A').text('Development Priority Brief');
    doc.moveDown(0.2);
    doc
      .fontSize(14)
      .fillColor('#0F172A')
      .text(`${rec.district.name}, ${rec.district.state.name} — ${category}`);
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .fillColor('#64748B')
      .text(
        `National rank ${rec.rank}    Priority score ${rec.priorityScore.toFixed(3)}    Generated ${rec.generatedAt.toISOString()}`,
      );
    doc.moveDown(1);

    // Scores
    doc.fontSize(12).fillColor('#0F172A').text('Computed scores', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor('#0F172A');
    doc.text(`Demand intensity: ${rec.demandScore.toFixed(3)}`);
    doc.text(`Infrastructure gap: ${rec.gapScore.toFixed(3)}${spec && !spec.direct ? '  (proxy measure)' : '  (directly measured)'}`);
    doc.text(`Equity weighting: ${rec.equityScore.toFixed(3)}`);
    doc.text(
      rec.degraded || rec.investmentDeficitScore === 0
        ? 'Investment deficit: not available — no public investment data ingested for this district'
        : `Investment deficit: ${rec.investmentDeficitScore.toFixed(3)}`,
    );
    if (rec.expectedBeneficiaries != null) {
      doc.text(`People affected by the measured deficit: ${rec.expectedBeneficiaries.toLocaleString('en-IN')}`);
    }
    doc.moveDown(0.8);

    if (spec) {
      doc.fontSize(12).fillColor('#0F172A').text('Basis of the gap measure', { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(10).fillColor('#64748B').text(spec.basis);
      doc.moveDown(0.8);
    }

    if (rec.degraded || !rec.rationale) {
      doc.fontSize(12).fillColor('#0F172A').text('Assessment', { underline: true });
      doc.moveDown(0.4);
      doc
        .fontSize(10)
        .fillColor('#64748B')
        .text(
          'No narrative assessment was generated for this district. The scores and ranking above are computed arithmetically and remain valid without it.',
        );
      doc.moveDown(0.8);
    } else {
      doc.fontSize(12).fillColor('#0F172A').text('Assessment', { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(10).fillColor('#0F172A').text(rec.rationale, { align: 'left' });
      doc.moveDown(0.8);

      if (interventions.length) {
        doc.fontSize(12).fillColor('#0F172A').text('Proposed interventions', { underline: true });
        doc.moveDown(0.4);
        doc.fontSize(10).fillColor('#0F172A');
        interventions.forEach((s, i) => doc.text(`${i + 1}. ${s}`, { align: 'left' }));
        doc.moveDown(0.8);
      }

      if (risks.length) {
        doc.fontSize(12).fillColor('#0F172A').text('Risks and caveats', { underline: true });
        doc.moveDown(0.4);
        doc.fontSize(10).fillColor('#0F172A');
        risks.forEach((s, i) => doc.text(`${i + 1}. ${s}`, { align: 'left' }));
        doc.moveDown(0.8);
      }
    }

    // Provenance footer. A brief that could inform spending has to say where its
    // numbers came from and what wrote its prose.
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#64748B');
    doc.text('Provenance', { underline: true });
    doc.moveDown(0.3);
    doc.text('Scores are computed arithmetically from Census of India 2011 district tables and recorded citizen demand. No language model participates in scoring or ranking.');
    doc.text(
      rec.degraded
        ? 'Narrative: none generated.'
        : `Narrative written by ${rec.modelName} from the computed figures only. Input digest ${rec.inputDigest.slice(0, 16)}.`,
    );
    doc.text('Citizen demand volumes in this deployment are modelled, weighted by the census deprivation figures above. See ATTRIBUTIONS.md.');

    doc.end();
  });

  const safe = `${rec.district.name}-${category}`.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  const ab = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength,
  ) as ArrayBuffer;
  return new Response(ab, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="nivaran-brief-${safe}.pdf"`,
    },
  });
});

export default planning;
