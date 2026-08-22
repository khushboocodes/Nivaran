/**
 * Reverse geocoding for the "Use my location" button.
 * Mounted at `/api/geo`.
 *
 *   GET /api/geo/reverse?lat=18.5204&lng=73.8567
 *     → { label: "Kasba Peth, Pune, Maharashtra", district: "Pune", state: "Maharashtra" }
 *
 * WHY THIS EXISTS
 * ---------------
 * Tapping "Use my location" used to write bare coordinates into the complaint's
 * location field. `resolveDistrict` matches Census 2011 district *names* against
 * that text, so a coordinate pair matched nothing and the complaint fell back to
 * the citizen's profile city — which is optional at signup. A citizen who signed
 * up without a city and used their real location produced a complaint that was
 * stored, and appeared as a pin on the heatmap, but carried no `districtId`. It
 * was therefore invisible to every district aggregate and to the planning layer,
 * which is the one place that complaint most needed to appear.
 *
 * Turning coordinates into a place name fixes that at the source: the resolver
 * keeps working on names, and the citizen sees an address they can sanity-check
 * instead of two numbers they cannot.
 *
 * WHY SERVER-SIDE
 * ---------------
 * Nominatim's usage policy asks for a descriptive User-Agent and at most one
 * request per second. A browser cannot set User-Agent, and per-browser rate
 * limiting is unenforceable. Proxying here lets us identify ourselves honestly,
 * serialise outbound calls, and cache — so a hundred citizens in one
 * neighbourhood cost one upstream request rather than a hundred.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getUser } from '../auth/middleware';

const geo = new Hono();

const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

interface Place {
  label: string | null;
  locality: string | null;
  district: string | null;
  state: string | null;
}

const EMPTY: Place = { label: null, locality: null, district: null, state: null };

/**
 * Cache keyed to ~110 m precision.
 *
 * Three decimal places is a deliberate balance: fine enough that the label still
 * describes the right neighbourhood, coarse enough that repeat reports from one
 * street share a cache entry. It also means we are not retaining callers' exact
 * positions in memory as map keys.
 */
const cache = new Map<string, Place>();
const CACHE_LIMIT = 5_000;

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

/**
 * Nominatim asks for a maximum of one request per second. Requests are chained
 * through this promise so concurrent callers queue instead of bursting, which is
 * the difference between being a good citizen of a free service and being
 * blocked by it.
 */
const MIN_GAP_MS = 1_100;
let gate: Promise<void> = Promise.resolve();
let lastCall = 0;

function scheduled<T>(work: () => Promise<T>): Promise<T> {
  const run = gate.then(async () => {
    const wait = Math.max(0, lastCall + MIN_GAP_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return work();
  });
  // Keep the chain alive even when a call rejects, otherwise one failure
  // permanently wedges every later request behind a rejected promise.
  gate = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

const USER_AGENT =
  'Nivaran/1.0 (civic grievance and development planning platform; https://github.com/khushboocodes/Nivaran)';

interface NominatimAddress {
  suburb?: string;
  neighbourhood?: string;
  village?: string;
  town?: string;
  city_district?: string;
  city?: string;
  county?: string;
  state_district?: string;
  state?: string;
}

/**
 * Build the human-readable label.
 *
 * `state_district` is the field that carries the Census district name in India
 * ("Pune"), so it is preferred over `county`, which Nominatim fills with
 * subdistrict names like "Pune City Subdistrict" that match no Census row.
 */
function toPlace(address: NominatimAddress): Place {
  const locality =
    address.suburb ??
    address.neighbourhood ??
    address.village ??
    address.town ??
    address.city_district ??
    null;
  const district = address.state_district ?? address.city ?? address.county ?? null;
  const state = address.state ?? null;

  // De-duplicate: "Pune, Pune, Maharashtra" reads like a bug to a citizen.
  const parts = [locality, district, state].filter(
    (p, i, arr): p is string => !!p && arr.indexOf(p) === i,
  );

  return { label: parts.length ? parts.join(', ') : null, locality, district, state };
}

async function reverseGeocode(lat: number, lng: number): Promise<Place> {
  const url =
    'https://nominatim.openstreetmap.org/reverse' +
    `?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&zoom=14`;

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);

  const body = (await res.json()) as { address?: NominatimAddress };
  return body.address ? toPlace(body.address) : EMPTY;
}

geo.get('/reverse', async (c) => {
  // Authenticated so this cannot be used as an open geocoding proxy against a
  // free service we do not own.
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const parsed = Query.safeParse({ lat: c.req.query('lat'), lng: c.req.query('lng') });
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }
  const { lat, lng } = parsed.data;

  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit) return c.json({ ...hit, cached: true });

  try {
    const place = await scheduled(() => reverseGeocode(lat, lng));
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(key, place);
    return c.json({ ...place, cached: false });
  } catch (err) {
    // A geocoding outage must not block filing a complaint. Answer 200 with a
    // null label so the client falls back to plain coordinates instead of
    // treating this as an error the citizen has to resolve.
    // eslint-disable-next-line no-console
    console.warn('[geo] reverse lookup failed:', err instanceof Error ? err.message : err);
    return c.json({ ...EMPTY, cached: false, degraded: true });
  }
});

export default geo;
