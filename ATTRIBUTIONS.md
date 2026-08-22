# Attributions

Nivaran itself is released under the [MIT License](LICENSE). This file credits
third-party code, design assets, and public datasets the project depends on, as
required by the hackathon's originality and citation rules.

## Code and UI

- UI primitives from [shadcn/ui](https://ui.shadcn.com/), used under the
  [MIT license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).
- Photographs from [Unsplash](https://unsplash.com), used under the
  [Unsplash license](https://unsplash.com/license).
- Map tiles from [OpenStreetMap](https://www.openstreetmap.org/copyright),
  © OpenStreetMap contributors, available under the Open Database License.
- Icons from [Lucide](https://lucide.dev), MIT licensed.

Runtime dependencies are declared in the three `package.json` files with their
licences resolvable via `npm ls --long`. No dependency was vendored or copied
into this repository by hand.

## Datasets

### Census of India 2011 — district-level demographics and household amenities

Underlying data is published by the Office of the Registrar General & Census
Commissioner, India, via [censusindia.gov.in](https://censusindia.gov.in). It
provides population, literacy, Scheduled Caste and Scheduled Tribe counts, and
household amenity tables covering drinking-water source, electric lighting,
latrine facilities, and internet access, for 640 districts.

**Licensing note.** The official district tables are distributed as per-district
PDF handbooks, which are impractical to parse inside a hackathon window. For
development convenience this project reads a community-compiled CSV of the same
Census 2011 district tables from
[nishusharma1608/India-Census-2011-Analysis](https://github.com/nishusharma1608/India-Census-2011-Analysis).

That repository carries **no licence file**, so it is treated as all-rights-reserved
and is **not redistributed here**. The file is not committed to this repository:
`server/prisma/ingest/data/` is gitignored, and the ingest script downloads the
CSV on first run. Anyone reproducing this project fetches it themselves from the
original location. The underlying figures are Government of India census facts,
and the citation above credits that primary source.

If this project were taken beyond a prototype, the correct step is to parse the
official censusindia.gov.in tables directly rather than rely on a community
mirror.

### District boundary geometries

[DataMeet `maps`](https://github.com/datameet/maps) — the repository is MIT
licensed, and its README states that datasets within it are shared under
CC BY 4.0 unless stated otherwise. Attribution as requested by the project:

> India boundaries by DataMeet India community (CC BY 4.0)

### OpenStreetMap / Nominatim — reverse geocoding

When a citizen taps "Use my location", the coordinates are turned into a place
name using [Nominatim](https://nominatim.openstreetmap.org/), the geocoding
service run by the OpenStreetMap Foundation. This is what lets a report filed
from a phone resolve to a Census district instead of staying an unlabelled point.

OpenStreetMap data is licensed under the
[Open Database Licence (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Required attribution:

> Location data © OpenStreetMap contributors, available under the Open Database
> Licence (ODbL).

We follow the
[Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/):
requests are proxied through our own API with a descriptive `User-Agent`,
serialised to at most one request per second, and cached at roughly 110 m
precision so repeated reports from the same neighbourhood cost one upstream
lookup. No bulk geocoding is performed, and a lookup failure degrades to storing
plain coordinates rather than retrying.

### Jal Jeevan Mission village scheme infrastructure data — pending

[JJM Village Scheme Infrastructure Data](https://aikosh.indiaai.gov.in/home/datasets/details/jjm_village_scheme_infrastructure_data.html)
on AIKosh (IndiaAI), published by the Department of Drinking Water and
Sanitation, Ministry of Jal Shakti. Listed licence: **MIT**.

This dataset is marked *Restricted* visibility and requires an approval request.
At the time of writing that request is **pending**, so the dataset is **not used**
in the current build. It is documented here because it is the intended source for
rupee-denominated public investment figures (scheme cost and expenditure in
lakhs) once access is granted.

### CPGRAMS grievance volumes — reference only

National grievance statistics published by the Department of Administrative
Reforms and Public Grievances in its
[monthly CPGRAMS reports](https://pgportal.gov.in/). Used only as a published
reference point for validating the plausibility of modelled demand volumes. No
CPGRAMS data is ingested or redistributed.

## Synthetic data disclosure

Citizen demand records used to demonstrate district hotspots are **synthetically
generated**, not real citizen submissions. They are weighted by the real Census
2011 deprivation figures above so that hotspots correspond to genuine
infrastructure gaps rather than random noise.

Every generated record is flagged `isSynthetic = true` in the database, badged in
the user interface, and excluded from any claim about real citizen behaviour.
Complaints filed through the application by real users are stored unflagged and
remain distinguishable at all times.
