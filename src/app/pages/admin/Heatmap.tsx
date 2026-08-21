import { useMemo, useState, useEffect } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Info, Loader2, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api/client';
import { useDepartmentScope } from '../../contexts/DepartmentScopeContext';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Complaint heatmap.
 *
 * This used to plot one marker per complaint from the client's cached page. That
 * was broken two ways at once: the page held 25 rows out of ~150,000, and almost
 * none of them carried coordinates, so the map rendered empty while the tile above
 * it confidently reported "25 Total Complaints".
 *
 * It now reads a server-side aggregate. Complaints are counted per state in
 * Postgres and drawn as proportional circles. The district-to-state rollup is real
 * Census 2011 data; only the circle's *position* is approximate, being a state
 * centroid rather than any claim about where a complaint was filed. That
 * distinction is stated on the page rather than left to inference.
 *
 * Complaints that carry genuine coordinates — anything filed with "Use my
 * location" — are drawn separately as exact pins, so real geolocated reports are
 * never conflated with an aggregate.
 */

const CATEGORY_COLORS: Record<string, string> = {
  Electricity: '#F5A524',
  'Water Supply': '#2F5BFF',
  'Roads & Infrastructure': '#9333EA',
  Sanitation: '#14B86A',
  Drainage: '#EC4899',
  'Public Health': '#EF4444',
  'Street Lights': '#F5A524',
  'Waste Management': '#14B86A',
  Other: '#A855F7',
};

const colorFor = (category: string) => CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other;

/** Categories the filter offers, matching what the classifier actually emits. */
const FILTER_CATEGORIES = [
  'Water Supply',
  'Electricity',
  'Sanitation',
  'Drainage',
  'Waste Management',
  'Street Lights',
  'Roads & Infrastructure',
  'Public Health',
];

/** India-wide default view, so the map is sensible before data arrives. */
const DEFAULT_CENTER: [number, number] = [22.5937, 78.9629];
const DEFAULT_ZOOM = 4;

interface GeoResponse {
  states: { state: string; lat: number; lng: number; count: number; districts: number }[];
  pins: { id: string; title: string; category: string; priority: string; lat: number; lng: number }[];
  coverage: { total: number; mapped: number; withCoordinates: number };
}

/**
 * Fit the map to the rendered markers.
 *
 * Deliberately skipped once there are several states in view: fitting to all of
 * India produces the same frame as the default, and refitting on every filter
 * change makes the map jump around while someone is reading it.
 */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0]!, 9);
      return;
    }
    if (points.length > 6) return;
    map.fitBounds(points as LatLngBoundsExpression, { padding: [60, 60] });
  }, [points, map]);
  return null;
}

export default function AdminHeatmap() {
  const { scope } = useDepartmentScope();
  const [category, setCategory] = useState<string>('all');

  const geoQuery = useQuery<GeoResponse>({
    queryKey: ['complaints', 'geo', scope, category],
    queryFn: () =>
      apiClient.get<GeoResponse>('/complaints/geo', {
        query: {
          ...(scope !== 'all' ? { dept: scope } : {}),
          ...(category !== 'all' ? { category } : {}),
        },
      }),
  });

  const geo = geoQuery.data;
  const states = geo?.states ?? [];
  const pins = geo?.pins ?? [];
  const coverage = geo?.coverage;

  const maxCount = useMemo(() => Math.max(1, ...states.map((s) => s.count)), [states]);

  /**
   * Circle radius from complaint count, on a square-root scale.
   *
   * Area is what the eye actually compares, and area grows with the square of the
   * radius. Scaling the radius linearly would make Uttar Pradesh's 25,161 look
   * enormously more than ten times Goa's 199. Square root makes area proportional
   * to count, which is the honest encoding.
   */
  const radiusFor = (count: number) => 6 + Math.sqrt(count / maxCount) * 26;

  const points = useMemo<[number, number][]>(
    () => states.map((s) => [s.lat, s.lng]),
    [states],
  );

  const mappedPct =
    coverage && coverage.total > 0 ? Math.round((coverage.mapped / coverage.total) * 100) : 0;

  return (
    <AdminLayout>
      <div className="p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Complaint Heatmap</h1>
            <p className="text-sm text-[#7C8AA5]">
              Geographic distribution across {states.length} states and union territories
            </p>
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 px-3.5 border border-[#E5EAF3] rounded-[14px] bg-white text-[#0F172A] text-sm font-medium min-w-[200px] focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
          >
            <option value="all">All Categories</option>
            {FILTER_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* What the circles mean. Stated before the map, because a circle on a map
            reads as a location and here it is a state aggregate. */}
        <Card className="p-3.5 mb-5 border-[#BFDBFE] bg-[#EFF6FF] rounded-[14px]">
          <div className="flex gap-2.5">
            <Info className="w-4 h-4 text-[#1D4ED8] mt-0.5 shrink-0" strokeWidth={2} />
            <p className="text-[13px] leading-relaxed text-[#1E3A8A]">
              Circles are <strong>complaint counts aggregated by state</strong>, drawn at the state's
              geographic centre and sized so area is proportional to volume. The district-to-state
              rollup is Census 2011 data; the circle position is not the location of any individual
              complaint. Complaints filed with a precise location appear as small separate pins.
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {[
            {
              value: coverage ? coverage.total.toLocaleString('en-IN') : '—',
              label: 'Total complaints',
            },
            {
              value: coverage ? coverage.mapped.toLocaleString('en-IN') : '—',
              label: 'Placed on the map',
            },
            { value: states.length ? String(states.length) : '—', label: 'States represented' },
            { value: `${mappedPct}%`, label: 'Geographic coverage' },
          ].map((tile) => (
            <Card
              key={tile.label}
              className="p-4 border-[#E5EAF3] rounded-[20px] bg-white text-center"
              style={{ boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)' }}
            >
              <div className="text-2xl font-bold text-[#0F172A] mb-0.5 tabular-nums">
                {geoQuery.isLoading ? '…' : tile.value}
              </div>
              <div className="text-xs text-[#7C8AA5] font-medium">{tile.label}</div>
            </Card>
          ))}
        </div>

        <Card
          className="p-4 md:p-6 border-[#E5EAF3] rounded-[20px] bg-white"
          style={{ boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)' }}
        >
          {geoQuery.isError && (
            <p className="text-sm text-[#B91C1C] mb-3">
              Could not load the geographic distribution. Please retry.
            </p>
          )}

          <div className="h-[460px] rounded-[14px] border border-[#E5EAF3] overflow-hidden relative">
            {geoQuery.isFetching && (
              <div className="absolute top-3 right-3 z-[1000] bg-white/95 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2F5BFF]" />
                <span className="text-xs text-[#475569]">Updating…</span>
              </div>
            )}
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              scrollWheelZoom
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds points={points} />

              {/* State aggregates */}
              {states.map((s) => (
                <CircleMarker
                  key={s.state}
                  center={[s.lat, s.lng]}
                  radius={radiusFor(s.count)}
                  pathOptions={{
                    color: '#2F5BFF',
                    fillColor: '#2F5BFF',
                    fillOpacity: 0.35,
                    weight: 1.5,
                  }}
                >
                  <Tooltip>
                    <div className="text-xs">
                      <div className="font-semibold text-[#0F172A]">{s.state}</div>
                      <div className="text-[#0F172A] tabular-nums">
                        {s.count.toLocaleString('en-IN')} complaints
                      </div>
                      <div className="text-[#7C8AA5]">
                        across {s.districts} district{s.districts === 1 ? '' : 's'}
                      </div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              ))}

              {/* Exact pins for complaints that carry their own coordinates.
                  Rendered after the aggregates so they sit on top. */}
              {pins.map((p) => (
                <CircleMarker
                  key={p.id}
                  center={[p.lat, p.lng]}
                  radius={5}
                  pathOptions={{
                    color: '#0F172A',
                    fillColor: colorFor(p.category),
                    fillOpacity: 0.95,
                    weight: 2,
                  }}
                >
                  <Tooltip>
                    <div className="text-xs">
                      <div className="font-semibold text-[#0F172A]">{p.title}</div>
                      <div className="text-[#7C8AA5]">
                        {p.category} · {p.priority}
                      </div>
                      <div className="text-[#14B86A]">exact location reported</div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          {/* Top states, so the ranking is readable without hovering circles. */}
          {states.length > 0 && (
            <div className="mt-5">
              <h2 className="text-sm font-semibold text-[#0F172A] mb-3">
                Highest volume {category !== 'all' && <span className="font-normal">— {category}</span>}
              </h2>
              <div className="space-y-2">
                {states.slice(0, 8).map((s) => (
                  <div key={s.state} className="flex items-center gap-3">
                    <span className="text-xs text-[#475569] w-40 shrink-0 truncate">{s.state}</span>
                    <div className="flex-1 h-2 rounded-full bg-[#E5EAF3] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#2F5BFF]"
                        style={{ width: `${Math.max(2, (s.count / maxCount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-[#0F172A] tabular-nums w-16 text-right">
                      {s.count.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-[#E5EAF3] flex flex-wrap gap-2 items-center">
            <span className="text-xs text-[#7C8AA5] mr-1">Exact-location pins:</span>
            {Object.entries(CATEGORY_COLORS)
              .filter(([name]) => name !== 'Other')
              .map(([name, colour]) => (
                <Badge
                  key={name}
                  variant="outline"
                  className="border-[#E5EAF3] rounded-full px-2.5 py-1 text-xs"
                >
                  <div className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: colour }} />
                  {name}
                </Badge>
              ))}
            {coverage && coverage.withCoordinates > 0 && (
              <span className="text-xs text-[#7C8AA5] flex items-center gap-1 ml-1">
                <MapPin className="w-3 h-3" strokeWidth={2} />
                {coverage.withCoordinates} complaint{coverage.withCoordinates === 1 ? '' : 's'} with
                exact coordinates
              </span>
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
