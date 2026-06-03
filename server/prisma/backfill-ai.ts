/**
 * One-shot backfill for AI metadata on existing complaints.
 *
 * Every row that has `aiConfidence === 0` (the schema default) is rerun
 * through the heuristic classifier and the priority / sentiment /
 * confidence / summary fields are updated. Already-classified rows are
 * skipped so reruns are cheap and safe.
 *
 * Usage:
 *   npm --prefix server run backfill:ai
 */

import { prisma } from '../src/db';
import { heuristicService } from '../src/services/ai/index';
import type { Status as PrismaStatus, Priority as PrismaPriority, Sentiment as PrismaSentiment } from '@prisma/client';

void PRISMA_TYPE_GUARD;
function PRISMA_TYPE_GUARD() {
  // Just to keep the imported types referenced; tsx ESM build complains
  // about purely type-only imports in some configs.
  const a: PrismaStatus = 'Submitted';
  const b: PrismaPriority = 'Medium';
  const c: PrismaSentiment = 'Neutral';
  return [a, b, c];
}

const SENTIMENT_TO_PRISMA: Record<string, PrismaSentiment> = {
  Positive: 'Positive',
  Neutral: 'Neutral',
  Negative: 'Negative',
  'Highly Negative': 'HighlyNegative',
};

async function main() {
  const candidates = await prisma.complaint.findMany({
    where: { aiConfidence: 0 },
    select: { id: true, title: true, description: true, language: true },
  });

  if (candidates.length === 0) {
    console.log('No complaints to backfill — every row already has an AI confidence > 0.');
    return;
  }

  console.log(`Backfilling ${candidates.length} complaint${candidates.length === 1 ? '' : 's'}…`);
  let done = 0;
  for (const c of candidates) {
    try {
      const result = await heuristicService.classify({
        title: c.title,
        description: c.description,
        language: c.language ?? 'en',
      });
      await prisma.complaint.update({
        where: { id: c.id },
        data: {
          priority: result.priority as PrismaPriority,
          sentiment: SENTIMENT_TO_PRISMA[result.sentiment] ?? 'Neutral',
          aiConfidence: result.confidence,
          aiSummary: result.summary,
        },
      });
      done += 1;
    } catch (err) {
      console.error(`[backfill] failed on ${c.id}:`, err);
    }
  }
  console.log(`Done — updated ${done}/${candidates.length} complaints.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
