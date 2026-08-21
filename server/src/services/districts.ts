/**
 * Resolve a complaint to a district.
 *
 * WHY THIS EXISTS
 * ---------------
 * The planning layer and the heatmap both key on `Complaint.districtId`. Without
 * it, a complaint is invisible to district aggregates — which meant a complaint
 * filed live through the app updated the dashboard, analytics, reports and
 * feedback, but silently never appeared in the two screens that are the whole
 * point of the planning work.
 *
 * Citizens do not pick a district. They type a free-text location like
 * "Kondhwa, Pune" and their profile carries a city. Both usually contain a
 * district name, because Indian districts are named after their principal city
 * far more often than not.
 *
 * This is deliberately conservative. It matches whole tokens against real Census
 * 2011 district names and returns null when it cannot be confident. A wrong
 * district is worse than no district: it would put a complaint into another
 * region's demand signal and quietly distort a funding recommendation. Null just
 * means the complaint counts nationally but not geographically, which is honest.
 */
import { prisma } from '../db';

interface DistrictKey {
  id: string;
  name: string;
  stateName: string;
}

/**
 * Name to district, built once per process.
 *
 * 640 rows is small enough to hold in memory and districts change on the scale of
 * years, so a per-request query would be pure waste.
 */
let cache: Map<string, DistrictKey> | null = null;

/** Ambiguous names are dropped from the cache — see `buildCache`. */
let ambiguous: Set<string> = new Set();

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function buildCache(): Promise<Map<string, DistrictKey>> {
  if (cache) return cache;

  const districts = await prisma.district.findMany({
    select: { id: true, name: true, state: { select: { name: true } } },
  });

  const byName = new Map<string, DistrictKey>();
  const seenTwice = new Set<string>();

  for (const d of districts) {
    const key = normalise(d.name);
    if (!key) continue;
    if (byName.has(key)) {
      // The same district name exists in more than one state — Aurangabad is in
      // both Maharashtra and Bihar, Bilaspur in Chhattisgarh and Himachal.
      // Guessing between them would fabricate geography, so the name is
      // discarded and such complaints stay unassigned.
      seenTwice.add(key);
      continue;
    }
    byName.set(key, { id: d.id, name: d.name, stateName: d.state.name });
  }

  for (const key of seenTwice) byName.delete(key);
  ambiguous = seenTwice;

  cache = byName;
  return byName;
}

/** Drop the cache. Call after ingesting districts within the same process. */
export function resetDistrictCache(): void {
  cache = null;
  ambiguous = new Set();
}

export interface DistrictMatch {
  districtId: string;
  districtName: string;
  stateName: string;
  /** Which input produced the match, for logging and auditability. */
  matchedOn: 'location' | 'city';
  /** The token that matched. */
  token: string;
}

/**
 * Try to resolve a district from a free-text location and a profile city.
 *
 * Location is preferred: it describes where the problem is, whereas the profile
 * city is where the citizen says they live, and those differ often enough to
 * matter.
 *
 * Longer tokens are tried first so "Mumbai Suburban" wins over "Mumbai" when both
 * appear.
 */
export async function resolveDistrict(
  location?: string | null,
  city?: string | null,
): Promise<DistrictMatch | null> {
  const byName = await buildCache();

  const candidates: { text: string; source: 'location' | 'city' }[] = [];
  if (location?.trim()) candidates.push({ text: location, source: 'location' });
  if (city?.trim()) candidates.push({ text: city, source: 'city' });

  for (const candidate of candidates) {
    const norm = normalise(candidate.text);
    if (!norm) continue;

    // Whole string first — handles "Mumbai Suburban" and single-word inputs.
    const whole = byName.get(norm);
    if (whole) {
      return {
        districtId: whole.id,
        districtName: whole.name,
        stateName: whole.stateName,
        matchedOn: candidate.source,
        token: norm,
      };
    }

    // Then multi-word then single-word spans, longest first, so a two-word
    // district name is preferred over either of its halves.
    const words = norm.split(' ');
    for (let span = Math.min(3, words.length); span >= 1; span--) {
      for (let i = 0; i + span <= words.length; i++) {
        const token = words.slice(i, i + span).join(' ');
        const hit = byName.get(token);
        if (hit) {
          return {
            districtId: hit.id,
            districtName: hit.name,
            stateName: hit.stateName,
            matchedOn: candidate.source,
            token,
          };
        }
        if (ambiguous.has(token)) {
          // Recognised but not unique. Say so rather than looking like a miss.
          console.warn(
            `[districts] "${token}" matches districts in more than one state; leaving unassigned`,
          );
        }
      }
    }
  }

  return null;
}
