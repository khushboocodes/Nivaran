import { useMemo, useState, useEffect } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { useComplaints } from '../../contexts/ComplaintContext';
import { useScopedComplaints } from '../../contexts/DepartmentScopeContext';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// The set of categories that have their own dropdown option. Any complaint
// whose category is NOT one of these is grouped under the "Other" filter.
const KNOWN_FILTER_CATEGORIES = new Set([
  'electricity',
  'water-supply',
  'roads',
  'roads-infrastructure',
  'sanitation',
  'public-services',
  'drainage',
  'healthcare',
  'public-health',
  'traffic',
]);

const normalizeCategory = (s: string) =>
  s.toLowerCase().replace(/[\s&]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

// Fits the Leaflet map to show every visible marker. Runs whenever the set
// of points changes so "All Categories" frames all pins instead of one.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(points as LatLngBoundsExpression, { padding: [50, 50] });
  }, [points, map]);
  return null;
}

// Map complaint categories to legend colours. Anything not in this map
// falls through to the "Other" colour so new categories don't break.
const CATEGORY_COLORS: Record<string, string> = {
  Electricity: '#F5A524',
  'Water Supply': '#2F5BFF',
  Roads: '#9333EA',
  'Roads & Infrastructure': '#9333EA',
  Sanitation: '#14B86A',
  'Public Services': '#6366F1',
  Drainage: '#EC4899',
  Healthcare: '#EF4444',
  'Public Health': '#EF4444',
  Traffic: '#7C8AA5',
  'Street Lights': '#F5A524',
  'Waste Management': '#14B86A',
  Other: '#A855F7',
};

const colorFor = (category: string) => CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other;

// India bbox-ish default view so the map renders sensibly even with no pins.
const DEFAULT_CENTER: [number, number] = [22.5937, 78.9629];
const DEFAULT_ZOOM = 5;

// Lat/Lng now flow through the legacy Complaint type, so we don't need
// the unknown-cast trick anymore. We still tolerate null/undefined.

export default function AdminHeatmap() {
  const { complaints } = useComplaints();
  const scopedComplaints = useScopedComplaints(complaints);
  const [filter, setFilter] = useState<string>('all');

  const withLocation = useMemo(
    () =>
      scopedComplaints.filter(
        (c) =>
          typeof c.lat === 'number' &&
          typeof c.lng === 'number' &&
          Number.isFinite(c.lat) &&
          Number.isFinite(c.lng),
      ),
    [scopedComplaints],
  );

  const visible = useMemo(() => {
    if (filter === 'all') return withLocation;
    return withLocation.filter((c) => {
      const norm = normalizeCategory(c.category);
      // "Other" catches any category that has no dedicated dropdown option
      // (e.g. Street Lights, Waste Management).
      if (filter === 'other') return !KNOWN_FILTER_CATEGORIES.has(norm);
      return norm === filter;
    });
  }, [withLocation, filter]);

  const total = scopedComplaints.length;
  const located = withLocation.length;
  const visibleCount = visible.length;
  const coverage = total > 0 ? Math.round((located / total) * 100) : 0;

  // Coordinates of every visible pin — passed to FitBounds so the map frames
  // all of them (rather than centering on just the first).
  const points = useMemo(
    () => visible.map((c) => [c.lat as number, c.lng as number] as [number, number]),
    [visible],
  );

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Complaint Heatmap</h1>
            <p className="text-sm text-[#7C8AA5]">Geographic distribution of citizen complaints</p>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-10 px-3.5 border border-[#E5EAF3] rounded-[14px] bg-white text-[#0F172A] text-sm font-medium min-w-[180px] focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="electricity">Electricity</option>
            <option value="water-supply">Water Supply</option>
            <option value="roads">Roads</option>
            <option value="roads-infrastructure">Roads & Infrastructure</option>
            <option value="sanitation">Sanitation</option>
            <option value="public-services">Public Services</option>
            <option value="drainage">Drainage</option>
            <option value="healthcare">Healthcare</option>
            <option value="public-health">Public Health</option>
            <option value="traffic">Traffic</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Metrics - 4 cards in one row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
          <Card className="p-4 border-[#E5EAF3] rounded-[20px] bg-white text-center" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="text-2xl font-bold text-[#0F172A] mb-0.5">{total}</div>
            <div className="text-xs text-[#7C8AA5] font-medium">Total Complaints</div>
          </Card>

          <Card className="p-4 border-[#E5EAF3] rounded-[20px] bg-white text-center" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="text-2xl font-bold text-[#0F172A] mb-0.5">{located}</div>
            <div className="text-xs text-[#7C8AA5] font-medium">With Location</div>
          </Card>

          <Card className="p-4 border-[#E5EAF3] rounded-[20px] bg-white text-center" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="text-2xl font-bold text-[#0F172A] mb-0.5">{visibleCount}</div>
            <div className="text-xs text-[#7C8AA5] font-medium">Visible Pins</div>
          </Card>

          <Card className="p-4 border-[#E5EAF3] rounded-[20px] bg-white text-center" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="text-2xl font-bold text-[#0F172A] mb-0.5">{coverage}%</div>
            <div className="text-xs text-[#7C8AA5] font-medium">Location Coverage</div>
          </Card>
        </div>

        {/* Map Area */}
        <Card className="p-6 border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
          <div className="h-[420px] rounded-[14px] border border-[#E5EAF3] overflow-hidden">
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
              {visible.map((c) => (
                <CircleMarker
                  key={c.id}
                  center={[c.lat as number, c.lng as number]}
                  radius={8}
                  pathOptions={{
                    color: colorFor(c.category),
                    fillColor: colorFor(c.category),
                    fillOpacity: 0.7,
                    weight: 2,
                  }}
                >
                  <Tooltip>
                    <div className="text-xs">
                      <div className="font-semibold text-[#0F172A]">{c.title}</div>
                      <div className="text-[#7C8AA5]">{c.category} · {c.status}</div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          {/* Legend */}
          <div className="mt-5 flex flex-wrap gap-2 justify-center">
            <Badge variant="outline" className="border-[#E5EAF3] rounded-full px-2.5 py-1 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-[#F5A524] mr-1.5" />
              Electricity
            </Badge>
            <Badge variant="outline" className="border-[#E5EAF3] rounded-full px-2.5 py-1 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-[#2F5BFF] mr-1.5" />
              Water Supply
            </Badge>
            <Badge variant="outline" className="border-[#E5EAF3] rounded-full px-2.5 py-1 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-[#9333EA] mr-1.5" />
              Roads
            </Badge>
            <Badge variant="outline" className="border-[#E5EAF3] rounded-full px-2.5 py-1 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-[#14B86A] mr-1.5" />
              Sanitation
            </Badge>
            <Badge variant="outline" className="border-[#E5EAF3] rounded-full px-2.5 py-1 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-[#6366F1] mr-1.5" />
              Public Services
            </Badge>
            <Badge variant="outline" className="border-[#E5EAF3] rounded-full px-2.5 py-1 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-[#EC4899] mr-1.5" />
              Drainage
            </Badge>
            <Badge variant="outline" className="border-[#E5EAF3] rounded-full px-2.5 py-1 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444] mr-1.5" />
              Healthcare
            </Badge>
            <Badge variant="outline" className="border-[#E5EAF3] rounded-full px-2.5 py-1 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-[#7C8AA5] mr-1.5" />
              Traffic
            </Badge>
            <Badge variant="outline" className="border-[#E5EAF3] rounded-full px-2.5 py-1 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-[#A855F7] mr-1.5" />
              Other
            </Badge>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
