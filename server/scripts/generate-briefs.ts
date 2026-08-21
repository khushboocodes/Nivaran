/**
 * Pre-generate Gemini policy briefings for the highest-priority districts.
 *
 *   npm --prefix server run planning:briefs
 *   npm --prefix server run planning:briefs -- --limit 40 --category "Water Supply"
 *   npm --prefix server run planning:briefs -- --force
 *
 * WHY THIS IS A BATCH JOB RATHER THAN ON-DEMAND
 * ---------------------------------------------
 * A single briefing takes roughly ten seconds. Generating one when a user clicks
 * a district would mean a ten-second empty drawer, and a demo that stalls in
 * front of an audience. So briefings are generated ahead of time and persisted;
 * the planning UI reads stored rows and renders instantly.
 *
 * Reruns are cheap. Each row records a SHA-256 of the exact figures it was
 * written from, so unchanged districts are reused rather than regenerated. Only
 * districts whose numbers actually moved cost an API call.
 *
 * The deterministic ranking never depends on this job. If it has not run, or if
 * Gemini is unavailable, the planning screen still shows scores and rankings —
 * just without narrative.
 */
import { rankDistricts } from '../src/services/planning/priority';
import { persistRecommendations } from '../src/services/planning/brief';
import { CATEGORIES } from '../src/services/planning/categories';
import { prisma } from '../src/db';

interface Args {
  limit: number;
  category?: string;
  force: boolean;
  concurrency: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const value = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const limitRaw = Number(value('--limit'));
  const concRaw = Number(value('--concurrency'));
  const category = value('--category');

  if (category && !CATEGORIES.includes(category)) {
    throw new Error(`Unknown category "${category}". Expected one of: ${CATEGORIES.join(', ')}`);
  }

  return {
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? Math.round(limitRaw) : 25,
    category,
    force: argv.includes('--force'),
    // Deliberately low. The Gemini free tier rate-limits hard: a run at
    // concurrency 3 hit "You exceeded your current quota" and degraded 13 of 25
    // rows. Requests now back off and retry on 429, but keeping concurrency at 2
    // avoids provoking the limit in the first place.
    concurrency: Number.isFinite(concRaw) && concRaw > 0 ? Math.min(Math.round(concRaw), 8) : 2,
  };
}

async function main() {
  const args = parseArgs();

  if (!process.env.GEMINI_API_KEY) {
    console.warn(
      '[briefs] GEMINI_API_KEY is not set. Rows will be written with deterministic scores only,\n' +
        '         marked degraded, and the planning screen will render rankings without narrative.',
    );
  }

  const { rows, weights, investmentDataAvailable, totalCells } = await rankDistricts({
    category: args.category,
    limit: args.limit,
  });

  console.log(
    `[briefs] ranked ${totalCells.toLocaleString()} district-category cells; briefing the top ${rows.length}` +
      (args.category ? ` for "${args.category}"` : ' nationally'),
  );
  console.log(
    `[briefs] weights demand=${weights.demand} gap=${weights.gap} investment=${weights.investment} equity=${weights.equity}`,
  );
  if (!investmentDataAvailable) {
    console.log(
      '[briefs] no investment data present, so that component is excluded and the remaining\n' +
        '         weights are renormalised. Briefings will state that existing spending is unknown.',
    );
  }

  const started = Date.now();
  const result = await persistRecommendations(rows, {
    force: args.force,
    concurrency: args.concurrency,
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(
    `[briefs] generated ${result.generated}, reused ${result.reused}, degraded ${result.degraded} in ${seconds}s`,
  );

  if (result.degraded > 0) {
    console.warn(
      `[briefs] ${result.degraded} row(s) have no narrative. Scores and ranks are still correct and\n` +
        '         will render; re-run to retry the narrative step.',
    );
  }

  const flagged = await prisma.recommendation.count({
    where: { risks: { not: undefined }, degraded: false },
  });
  console.log(`[briefs] ${flagged} row(s) carry recorded risks or data caveats`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('[briefs] done');
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
