/**
 * Approximate geographic centre of each state and union territory.
 *
 * WHY THESE ARE HARDCODED
 * -----------------------
 * The complaint heatmap needs coordinates. Complaints carry a district, and
 * districts are real Census 2011 records, but the census tables contain no
 * geometry — `District.lat`/`lng` are null for all 640 rows.
 *
 * Getting true district centroids turned out to be disproportionately awkward.
 * DataMeet publishes district boundaries only as ~10 MB shapefiles and its
 * GeoJSON paths 404. GeoNames' plain-text `admin2Codes.txt` carries no
 * coordinates at all, and the per-country dump that does is a zip archive Node
 * cannot read without another dependency.
 *
 * So the heatmap aggregates to state level, using the 35 coordinates below. That
 * is not merely a fallback: for a national view, 35 proportional circles are
 * considerably more readable than 640 overlapping district pins, and the
 * underlying district-to-state mapping is real census data rather than an
 * approximation.
 *
 * Keys match `State.name` exactly as produced by the census ingest, which
 * title-cases the source file's shouted names — hence "Nct Of Delhi" and
 * "Andaman And Nicobar Islands". These are the 35 states and union territories as
 * they existed at the 2011 census, so Telangana is still part of Andhra Pradesh
 * and Ladakh part of Jammu and Kashmir. Matching the census vintage matters more
 * than matching today's map, because the deprivation data is from 2011.
 *
 * Coordinates are approximate centres to roughly four decimal places, which is
 * about 10 m — far finer than a state-level aggregate needs, and they exist only
 * to position a circle.
 */

export interface StateCentroid {
  lat: number;
  lng: number;
}

export const STATE_CENTROIDS: Record<string, StateCentroid> = {
  'Andaman And Nicobar Islands': { lat: 11.7401, lng: 92.6586 },
  'Andhra Pradesh': { lat: 15.9129, lng: 79.74 },
  'Arunachal Pradesh': { lat: 28.218, lng: 94.7278 },
  Assam: { lat: 26.2006, lng: 92.9376 },
  Bihar: { lat: 25.0961, lng: 85.3131 },
  Chandigarh: { lat: 30.7333, lng: 76.7794 },
  Chhattisgarh: { lat: 21.2787, lng: 81.8661 },
  'Dadra And Nagar Haveli': { lat: 20.1809, lng: 73.0169 },
  'Daman And Diu': { lat: 20.4283, lng: 72.8397 },
  Goa: { lat: 15.2993, lng: 74.124 },
  Gujarat: { lat: 22.2587, lng: 71.1924 },
  Haryana: { lat: 29.0588, lng: 76.0856 },
  'Himachal Pradesh': { lat: 31.1048, lng: 77.1734 },
  'Jammu And Kashmir': { lat: 33.7782, lng: 76.5762 },
  Jharkhand: { lat: 23.6102, lng: 85.2799 },
  Karnataka: { lat: 15.3173, lng: 75.7139 },
  Kerala: { lat: 10.8505, lng: 76.2711 },
  Lakshadweep: { lat: 10.5667, lng: 72.6417 },
  'Madhya Pradesh': { lat: 22.9734, lng: 78.6569 },
  Maharashtra: { lat: 19.7515, lng: 75.7139 },
  Manipur: { lat: 24.6637, lng: 93.9063 },
  Meghalaya: { lat: 25.467, lng: 91.3662 },
  Mizoram: { lat: 23.1645, lng: 92.9376 },
  Nagaland: { lat: 26.1584, lng: 94.5624 },
  'Nct Of Delhi': { lat: 28.7041, lng: 77.1025 },
  Orissa: { lat: 20.9517, lng: 85.0985 },
  Pondicherry: { lat: 11.9416, lng: 79.8083 },
  Punjab: { lat: 31.1471, lng: 75.3412 },
  Rajasthan: { lat: 27.0238, lng: 74.2179 },
  Sikkim: { lat: 27.533, lng: 88.5122 },
  'Tamil Nadu': { lat: 11.1271, lng: 78.6569 },
  Tripura: { lat: 23.9408, lng: 91.9882 },
  'Uttar Pradesh': { lat: 26.8467, lng: 80.9462 },
  Uttarakhand: { lat: 30.0668, lng: 79.0193 },
  'West Bengal': { lat: 22.9868, lng: 87.855 },
};

/** Centroid for a state name, or null when the name is unrecognised. */
export function centroidFor(stateName: string): StateCentroid | null {
  return STATE_CENTROIDS[stateName] ?? null;
}
