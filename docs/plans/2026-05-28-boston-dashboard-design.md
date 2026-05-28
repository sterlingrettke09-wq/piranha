# Boston Dashboard — Design

**Date**: 2026-05-28
**Status**: Approved (brainstorm)
**Next**: Implementation plan via `writing-plans` skill

## Goal

The `/boston` route is the launchpad for Piranha's regulatory-intelligence
workflow. A user lands here, finds a specific Boston address (search or
map click), sees zoning + key constraints for that parcel, and clicks
"Start full analysis" to enter the wizard at `/boston/start`.

The dashboard is **address-lookup primary** — not a passive city
overview, not a saved-properties view, not a browseable directory.

## Approach

**Approach A — Backend-mediated** (chosen).

Frontend calls a Netlify function (`/api/parcel`) that queries Boston
ArcGIS REST services server-side, joins the results, normalizes the
shape, and returns clean JSON. The React tree never sees ArcGIS
semantics.

Alternative considered:
- **B (direct client → ArcGIS)** — rejected. Faster to ship, but
  spreads brittle ArcGIS query syntax through React components and
  bakes data-source assumptions into the UI tree.
- **C (vector-tile zoning + function for parcel)** — deferred. Best
  visual UX (continuous zoning colors as a Mapbox vector source) but
  requires a tile-generation pipeline (`tippecanoe` or Mapbox Tiling
  Service). We capture most of C's visual benefit by overlaying
  Boston's hosted ArcGIS zoning tiles as a Mapbox **raster** layer —
  no pipeline needed.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser — /boston route                                     │
│                                                              │
│   <BostonDashboard>                                          │
│     ├── <Map>             Mapbox GL JS                       │
│     │     ├── basemap     brand-styled (bone/charcoal/burg.) │
│     │     └── overlay     Boston ArcGIS zoning tiles (raster)│
│     ├── <SearchBar>       @mapbox/search-js-react, BOS bbox  │
│     └── <ParcelPanel>     side drawer / mobile bottom sheet  │
│                                                              │
│   fetch('/api/parcel?lat=…&lng=…')                           │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Netlify Function: netlify/functions/parcel.ts               │
│                                                              │
│  1. Validate input (lat/lng numeric, in Boston bbox)         │
│  2. Promise.allSettled 4 ArcGIS point-in-polygon queries:    │
│     • Zoning Subdistricts (BPDA)                             │
│     • Parcels / Assessing                                    │
│     • Historic Districts (BPDA)                              │
│     • FEMA Flood Zones                                       │
│  3. Join, normalize, return ParcelInfo JSON                  │
│  4. Edge-cache 24h (Cache-Control)                           │
└──────────────────────────────────────────────────────────────┘
```

### Key choices

- **Map style**: a custom Mapbox style authored as JSON, committed to
  the repo for reviewability. Bone-tinted land, charcoal water/roads,
  burgundy accents.
- **Zoning overlay**: Boston BPDA's hosted ArcGIS tile service consumed
  by Mapbox as a raster source. Continuous zoning color across the
  city without our own tile pipeline.
- **Search**: Mapbox Search JS, bbox-constrained to Boston so
  suggestions don't drift (e.g., Boston, NY).
- **Backend façade**: the Netlify function is the only thing that talks
  to ArcGIS. We can swap data sources later without touching React.
- **Cache**: `Cache-Control: public, s-maxage=86400,
  stale-while-revalidate=604800`. Same parcel hit twice within 24h ≈
  free; stale-while-revalidate keeps it fast even when upstream is
  slow.

## Components

```
src/routes/BostonDashboard.tsx        orchestrates state, full-bleed
src/components/boston/
  ├── Map.tsx                          Mapbox GL JS wrapper
  ├── SearchBar.tsx                    Mapbox Search JS, BOS-bounded
  ├── ParcelPanel.tsx                  side drawer / mobile sheet
  └── ParcelPanelContent.tsx           skeleton / loaded / error UIs
src/hooks/useParcelInfo.ts            fetch + state for /api/parcel
src/types/parcel.ts                    ParcelInfo / ParcelError types
src/styles/boston-map-style.ts        brand-palette Mapbox style JSON
netlify/functions/parcel.ts            replaces the existing stub
```

### State

`BostonDashboard` owns one piece of state:
`selected: { lat: number; lng: number } | null`.

Both `SearchBar` and `Map` call `setSelected`. `ParcelPanel` reads it
and calls `useParcelInfo(selected)`, which drives skeleton → data →
error states.

No global-state library (Zustand/Redux). Only the dashboard cares.

### Layout impact

The current `Layout` component wraps children in
`max-w-6xl mx-auto px-6 py-12`. The dashboard needs full bleed (map
edge-to-edge). Two changes:

1. Move the container out of `Layout` and into a small
   `<PageContainer>` helper.
2. Each existing route (`Home`, `About`, etc.) wraps itself in
   `<PageContainer>`. `BostonDashboard` doesn't.

This is a one-time touch; behavior of every other route is unchanged.

### Responsive

- **≥ md (768px)**: map fills, panel docks right at ~420px.
- **< md**: map fills, panel becomes a bottom sheet with a drag handle
  (~60vh expanded).

Same `ParcelPanel` component — only the container class changes.

### Panel states

```
       no selection
       ┌──────────────┐
       │ EMPTY STATE  │  "Search an address or click the map."
       └─────┬────────┘
             │ setSelected(...)
             ▼
       ┌──────────────┐
       │  LOADING     │  Skeleton rows matching final layout.
       └─────┬────────┘
       ┌────┴────┐
       ▼         ▼
  ┌────────┐  ┌───────────────┐
  │ LOADED │  │ ERROR (typed) │  Copy varies by error code.
  └────────┘  └─────┬─────────┘
                    │ Retry
                    ▼
                 LOADING ...
```

## Data flow & contracts

### TypeScript types (`src/types/parcel.ts`)

```ts
export interface ParcelInfo {
  address: string
  parcelId: string
  coordinates: [number, number]    // [lng, lat]
  zoning: {
    districtCode: string           // e.g. "B-2-65"
    subdistrict: string | null
    article: string | null
    maxHeightFt: number | null
    maxFAR: number | null
    allowedUses: string[] | null   // null if not derivable
  }
  lot: { sizeSqFt: number | null; lotType: string | null }
  overlays: {
    historicDistrict: string | null
    floodZone: string | null
  }
  sources: Record<string, string>  // dataset URLs we hit
  fetchedAt: string                // ISO
}

export type ParcelError = {
  code: 'OUT_OF_BBOX' | 'NO_PARCEL' | 'UPSTREAM_ERROR' | 'INTERNAL'
  message: string
}
```

### ArcGIS query shape (used for all 4 datasets)

```
GET <featureservice>/query
  ?geometry={"x":<lng>,"y":<lat>,"spatialReference":{"wkid":4326}}
  &geometryType=esriGeometryPoint
  &inSR=4326
  &spatialRel=esriSpatialRelIntersects
  &outFields=<comma-separated fields>
  &returnGeometry=false
  &f=json
```

### Endpoint contract — `GET /api/parcel?lat=&lng=`

| Status | Body | Meaning |
|--------|------|---------|
| 200 | `ParcelInfo` | Success |
| 400 | `ParcelError(OUT_OF_BBOX)` | lat/lng outside Boston bbox |
| 404 | `ParcelError(NO_PARCEL)` | Point not on a parcel (water/road) |
| 502 | `ParcelError(UPSTREAM_ERROR)` | Critical dataset failed |
| 500 | `ParcelError(INTERNAL)` | Unexpected error |

Boston bbox (approx): south 42.227, west -71.191, north 42.395, east
-70.986.

### Resilience

- **Critical** (zoning + parcel): if either hard-fails → `502`. We do
  not fake or estimate.
- **Nice-to-have** (historic + flood): allowed to fail. `overlays.*`
  becomes `null` and the panel shows a small footnote.
- All 4 queries fan out in `Promise.allSettled` — total latency =
  slowest single upstream, not the sum.

### Wizard handoff

"Start full analysis" CTA →
`/boston/start?parcelId=<pid>&lat=<lat>&lng=<lng>`. The wizard
re-fetches from `/api/parcel` (cache hit) — no client-side state
coupling.

## Error handling & UX states

| Where | Failure | What user sees |
|-------|---------|----------------|
| Map init | Missing/invalid `MAPBOX_TOKEN` | Static fallback panel ("Map unavailable — check configuration"). |
| Map tiles | Network/Mapbox down | Mapbox built-in error tile state; search + panel still work. |
| Search | Geocoder API failure | "Search temporarily unavailable" inline; map click still works. |
| Search | No results | Empty suggestion list with "No Boston addresses matched." |
| Selection | Out-of-Boston address | Frontend bbox pre-check, then panel: "That address is outside Boston coverage." |
| Selection | Clicked on water/road | `404 NO_PARCEL` → "No parcel at this location — try a building." |
| Backend | 5xx / timeout | Panel error state + Retry button. CTA hidden. |
| Backend | Critical upstream down | `502 UPSTREAM_ERROR` → same error state + Retry. No degraded data. |
| Backend | Non-critical upstream down | 200 with `null` overlays + footnote "Overlay data unavailable." |
| Network | User offline | Browser fetch error → same retry UX. |

### Behavior we explicitly do NOT do
- No silent fallback to fake data.
- No automatic retries — human-in-the-loop only.
- No optimistic UI in the panel.
- No client-side caching across navigations (HTTP / edge cache only).

### Backend input hygiene
- `lat`/`lng` parsed as floats; rejected if `NaN` or out-of-bbox.
- Upstream URLs are constants; lat/lng inserted via
  `URL.searchParams` — no string interpolation, no injection surface.
- Function never logs raw upstream response bodies (some BPDA records
  contain owner contact data).

### Logging
- Frontend: `console.error` (Sentry not in scope this session).
- Function: structured `console.log({ event, durationMs, code })` —
  surfaces in Netlify function logs.

## Testing & verification

### Automated — write this session
Unit tests for `netlify/functions/parcel.ts` with Vitest + mocked
`fetch`:

1. Rejects out-of-bbox coords → 400.
2. Rejects non-numeric coords → 400.
3. Canned ArcGIS responses → expected `ParcelInfo`.
4. Historic/flood mocks reject but zoning/parcel resolve → 200 with
   `null` overlays.
5. Zoning mock rejects → 502.

### Not worth writing this session
- React component snapshots (brittle).
- `useParcelInfo` tests (thin fetch wrapper, types + function tests
  cover the contract).
- E2E (Playwright) — heavy setup for one-developer manual click-
  through.

### Gates
- `npm run build` (`tsc -b && vite build`) clean.
- `npm run lint` clean.

### Manual verification checklist
1. Map renders at `/boston` — Boston centered, zoning colors visible.
2. Search "100 Cambridge St" → suggestion → click → fly-to → pin →
   panel populates with real data.
3. Click an arbitrary building polygon → same panel populates.
4. Click on Boston Harbor → "No parcel at this location" cleanly.
5. Search "1600 Pennsylvania Ave, DC" → either filtered out, or
   out-of-Boston state.
6. DevTools offline → click parcel → error state + retry → re-enable →
   retry succeeds.
7. Resize to mobile → side panel becomes bottom sheet.
8. Click "Start full analysis" → navigates to
   `/boston/start?parcelId=...&lat=...&lng=...` (placeholder route is
   fine for this session).

## Open questions to resolve during build

1. **Allowed uses**: BPDA's zoning attribute table may not list allowed
   uses cleanly per district — that lives in the article text. If the
   GIS data doesn't carry it, options are (a) ship a small static
   lookup keyed by article number, or (b) leave `allowedUses: null`
   and rely on the wizard's LLM step to surface them. Decide after
   inspecting actual attribute schema.
2. **Exact service URLs**: BPDA + Assessing publish to ArcGIS Online;
   verify each URL responds and returns the expected schema before
   wiring. If one is unavailable, return to user before shipping.

## Out of scope for this session

- The wizard (`/boston/start`) — placeholder stays.
- The result page (`/boston/result`) — placeholder stays.
- LLM-backed analysis — that's in the wizard.
- Persisting selected parcels across sessions.
- Authentication / saved properties.
- Sentry, analytics, performance tracing.
