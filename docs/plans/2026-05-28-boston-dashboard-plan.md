# Boston Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the `/boston` dashboard: a Mapbox-based address-lookup launchpad that loads real zoning data for a clicked or searched Boston parcel and hands off to the wizard route.

**Architecture:** React + Mapbox GL JS on the client. A single Netlify Function (`/api/parcel`) acts as a façade over Boston ArcGIS REST services, fanning out four parallel point-in-polygon queries (zoning, parcel, historic, flood), normalizing to one `ParcelInfo` shape, and edge-cached for 24h.

**Tech Stack:** Vite 8, React 19, TypeScript, React Router v6, Tailwind v4, Mapbox GL JS, @mapbox/search-js-react, Netlify Functions, Vitest.

**Reference design doc:** [`docs/plans/2026-05-28-boston-dashboard-design.md`](./2026-05-28-boston-dashboard-design.md). Read it before starting — this plan assumes that context.

---

## Pre-flight checks

- Work happens on `main` (no worktree). All current commits live there.
- Dev server may be running; `npm run dev` is idempotent — restart if needed.
- A live `MAPBOX_TOKEN` must be present in `.env` (the user provides; do not commit). Without it, the map can't initialize — Task 4 surfaces this clearly.
- All commits use the same `Co-Authored-By` line we've used so far.
- DRY, YAGNI, TDD for the backend; manual + types for the UI (per design doc rationale).

---

## Task 1: Install runtime + dev dependencies

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `package-lock.json` (via npm install)

**Step 1: Install Mapbox client libs**

Run:
```bash
npm install mapbox-gl @mapbox/search-js-react
```

Note: `mapbox-gl@3+` ships its own TypeScript types, so no `@types/mapbox-gl` install is needed (the DefinitelyTyped stub is deprecated).

Expected: packages added without peer-dep errors.

**Step 2: Install test tooling**

Run:
```bash
npm install --save-dev vitest @vitest/coverage-v8 jsdom @testing-library/jest-dom
```

Expected: vitest 1.x or 2.x installed.

**Step 3: Verify type-checking still passes**

Run: `npx tsc -b`
Expected: clean output.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Install Mapbox + Vitest deps for Boston dashboard"
```

---

## Task 2: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add scripts)

**Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['netlify/functions/**', 'src/**'],
    },
  },
})
```

**Step 2: Add npm scripts**

In `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 3: Sanity-check Vitest boots**

Run: `npm test`
Expected: "No test files found, exiting with code 0." Acceptable.

**Step 4: Commit**

```bash
git add vitest.config.ts package.json
git commit -m "Configure Vitest for backend unit tests"
```

---

## Task 3: Define ParcelInfo + ParcelError types

**Files:**
- Create: `src/types/parcel.ts`

**Step 1: Write the file**

```ts
export interface ParcelInfo {
  address: string
  parcelId: string
  coordinates: [number, number]
  zoning: {
    districtCode: string
    subdistrict: string | null
    article: string | null
    maxHeightFt: number | null
    maxFAR: number | null
    allowedUses: string[] | null
  }
  lot: {
    sizeSqFt: number | null
    lotType: string | null
  }
  overlays: {
    historicDistrict: string | null
    floodZone: string | null
  }
  sources: Record<string, string>
  fetchedAt: string
}

export type ParcelErrorCode =
  | 'OUT_OF_BBOX'
  | 'NO_PARCEL'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL'

export interface ParcelError {
  code: ParcelErrorCode
  message: string
}

export const BOSTON_BBOX = {
  south: 42.227,
  west: -71.191,
  north: 42.395,
  east: -70.986,
} as const

export function isInBostonBbox(lat: number, lng: number): boolean {
  return (
    lat >= BOSTON_BBOX.south &&
    lat <= BOSTON_BBOX.north &&
    lng >= BOSTON_BBOX.west &&
    lng <= BOSTON_BBOX.east
  )
}
```

**Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean.

**Step 3: Commit**

```bash
git add src/types/parcel.ts
git commit -m "Add ParcelInfo + ParcelError types + Boston bbox helper"
```

---

## Task 4: Write failing tests for input validation

**Files:**
- Create: `netlify/functions/parcel.test.ts`

**Step 1: Write the test file**

```ts
import { describe, it, expect } from 'vitest'
import { handler } from './parcel'

const callHandler = (qs: Record<string, string> = {}) =>
  handler({
    queryStringParameters: qs,
  } as unknown as Parameters<typeof handler>[0])

describe('parcel handler — input validation', () => {
  it('rejects missing lat/lng with 400 OUT_OF_BBOX', async () => {
    const res = await callHandler({})
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body)
    expect(body.code).toBe('OUT_OF_BBOX')
  })

  it('rejects non-numeric lat with 400', async () => {
    const res = await callHandler({ lat: 'banana', lng: '-71.06' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('OUT_OF_BBOX')
  })

  it('rejects out-of-bbox coords (DC) with 400', async () => {
    const res = await callHandler({ lat: '38.89', lng: '-77.03' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).code).toBe('OUT_OF_BBOX')
  })
})
```

**Step 2: Run, expect failure**

Run: `npm test`
Expected: FAIL — Vitest cannot resolve `./parcel` (the module doesn't exist yet). The suite fails to collect, which is the RED state.

---

## Task 5: Implement input validation in parcel function

**Files:**
- Modify: `netlify/functions/parcel.ts` (currently doesn't exist as a real handler — rename `ask.ts` pattern: copy structure but for `parcel`)

Wait — `parcel.ts` doesn't exist yet. The existing functions are `ask.ts` and `analyze.ts`. Create `parcel.ts`.

**Step 1: Create the file with minimal validation**

```ts
import type { Handler, HandlerEvent } from '@netlify/functions'
import { isInBostonBbox, type ParcelError } from '../../src/types/parcel'

const fail = (code: ParcelError['code'], message: string, status: number) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code, message } satisfies ParcelError),
})

export const handler: Handler = async (event: HandlerEvent) => {
  const lat = Number(event.queryStringParameters?.lat)
  const lng = Number(event.queryStringParameters?.lng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInBostonBbox(lat, lng)) {
    return fail(
      'OUT_OF_BBOX',
      'lat/lng missing, invalid, or outside Boston bbox.',
      400,
    )
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ todo: 'normalize parcel', lat, lng }),
  }
}
```

**Step 2: Run tests**

Run: `npm test`
Expected: 3 tests pass.

**Step 3: Commit**

```bash
git add netlify/functions/parcel.ts netlify/functions/parcel.test.ts
git commit -m "Add parcel function with input validation (TDD)"
```

---

## Task 6: Verify Boston ArcGIS service URLs

This is a research task — we need the actual REST endpoint URLs before writing the normalization tests. The design doc flags this as an open question.

**Step 1: Curl candidate endpoints**

Try (replace with whatever the Boston open-data portal shows under "BPDA Zoning" and "Assessing Parcels"):
```bash
curl -s 'https://services.arcgis.com/sFnw0xNflSi8J0uh/arcgis/rest/services?f=json' | head -200
```

The known starting point: BPDA's ArcGIS Online org is `sFnw0xNflSi8J0uh`. Look for `Zoning_Subdistricts` and similar feature services.

**Step 2: For each candidate service, hit its `/query` endpoint with a known-good point**

A point that should land on a Boston parcel — e.g., Boston City Hall (42.3601, -71.0589):
```bash
curl -s 'https://services.arcgis.com/<org>/arcgis/rest/services/<service>/FeatureServer/0/query?geometry=%7B%22x%22%3A-71.0589%2C%22y%22%3A42.3601%2C%22spatialReference%22%3A%7B%22wkid%22%3A4326%7D%7D&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json'
```

Expected: JSON with `features[0].attributes` containing district/parcel info.

**Step 3: Record the verified URLs**

Create `netlify/functions/_endpoints.ts`:

```ts
// URLs verified <YYYY-MM-DD> against live Boston open-data ArcGIS services.
// If a query starts failing, re-check the source dataset.
export const ENDPOINTS = {
  zoning: '<verified URL here>',
  parcels: '<verified URL here>',
  historic: '<verified URL here>',
  flood: '<verified URL here>',
} as const

export const FIELDS = {
  zoning: ['SUBDISTRICT', 'DISTRICT', 'ARTICLE'],
  parcels: ['PID_LONG', 'FULL_ADDRES', 'LAND_SF'],
  historic: ['NAME'],
  flood: ['FLD_ZONE'],
} as const
```

(Substitute the actual field names from the live attribute schemas you discover.)

**Step 4: If any endpoint is unreachable or schema differs significantly**

Stop and ask the user before continuing. The design doc explicitly says: don't ship fake data when sources are unavailable.

**Step 5: Commit**

```bash
git add netlify/functions/_endpoints.ts
git commit -m "Record verified Boston ArcGIS endpoint URLs + field schema"
```

---

## Task 7: Write failing test for the normalization happy path

**Files:**
- Modify: `netlify/functions/parcel.test.ts`

**Step 1: Append a normalization test using mocked fetch**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// ... existing imports

describe('parcel handler — normalization', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      // Match each endpoint and return canned data.
      // Use ENDPOINTS constants in real code; literal substrings here.
      if (u.includes('Zoning')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { Name: 'B-2-65', District: 'Downtown', Article: 'Article 8' } }]
        }))
      }
      if (u.includes('Parcels')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { pid: '0304567000', full_addre: '1 City Hall Sq', lot_size: 12450 } }]
        }))
      }
      if (u.includes('Historic')) {
        return new Response(JSON.stringify({ features: [] }))
      }
      if (u.includes('Flood')) {
        return new Response(JSON.stringify({
          features: [{ attributes: { FLD_ZONE: 'X' } }]
        }))
      }
      throw new Error('Unexpected fetch URL: ' + u)
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('joins all 4 datasets into ParcelInfo', async () => {
    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.address).toBe('1 City Hall Sq')
    expect(body.parcelId).toBe('0304567000')
    expect(body.zoning.districtCode).toBe('B-2-65')
    expect(body.zoning.article).toBe('Article 8')
    expect(body.overlays.historicDistrict).toBeNull()
    expect(body.overlays.floodZone).toBe('X')
    expect(body.lot.sizeSqFt).toBe(12450)
    expect(body.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})
```

**Step 2: Run, expect failure**

Run: `npm test`
Expected: FAIL — current handler returns the `todo` stub.

---

## Task 8: Implement upstream fan-out + normalization

**Files:**
- Modify: `netlify/functions/parcel.ts`

### Live-schema caveats (verified Task 6)

Read these before touching the normalization code. URLs + field lists live in `netlify/functions/_endpoints.ts`.

- **Zoning subdistrict code lives in `Name`**, not `SUBDISTRICT`. The broader category is in `District`. Example at City Hall: `Name: "OS-UP"`, `District: "Government Center/Markets"`. The user-facing `districtCode` field is the subdistrict code (`Name`); `subdistrict` in the normalized output should carry the broader `District` label.
- **Parcels schema is lowercase + truncated**: `pid`, `full_addre`, `lot_size` (plus `zoning_sub`, `neighborho`, `gross_area`, `living_are` if needed later). `owner` is available but is PII — do NOT request or log it. No `PID_LONG` / `FULL_ADDRES` / `LAND_SF`.
- **`gross_area` and `living_are` use `1` as a sentinel** for missing / non-building parcels (City Hall returned `1` for both). Treat `<= 1` as null when normalizing either field.
- **`lot_size` is integer square feet** — usable directly as a number, no parsing needed.
- **Historic districts**: empty result is the common case (most points are NOT in a historic district). Treat empty as `historicDistrict: null`, never as an error. The field is `HIST_NAME` (not `NAME`); `PLACE_NAME` carries the neighborhood label if needed.
- **FEMA flood**: `STATIC_BFE = -9999` is the "not applicable" sentinel (Zone X — no base flood elevation). Treat `-9999` as null. Zone code field is `FLD_ZONE`.
- **Spatial references differ across providers**: BPDA uses `wkid: 102686` (MA State Plane); FEMA uses `wkid: 4269` (NAD83). Every `/query` endpoint accepts `inSR=4326` (WGS84) and projects server-side, so all four calls use the same WGS84 lat/lng — no client-side reprojection.
- **FEMA's NFHL is a MapServer (not FeatureServer)** but its `/query` endpoint accepts the same parameter shape, so one `fetchFeatures` helper covers all four upstreams.

**Step 1: Replace handler body**

```ts
import type { Handler, HandlerEvent } from '@netlify/functions'
import { isInBostonBbox, type ParcelError, type ParcelInfo } from '../../src/types/parcel'
import { ENDPOINTS, FIELDS } from './_endpoints'

const fail = (code: ParcelError['code'], message: string, status: number) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code, message } satisfies ParcelError),
})

const buildQuery = (url: string, lat: number, lng: number, fields: readonly string[]) => {
  const u = new URL(url + '/query')
  u.searchParams.set('geometry', JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }))
  u.searchParams.set('geometryType', 'esriGeometryPoint')
  u.searchParams.set('inSR', '4326')
  u.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  u.searchParams.set('outFields', fields.join(','))
  u.searchParams.set('returnGeometry', 'false')
  u.searchParams.set('f', 'json')
  return u.toString()
}

type FeatureSet = { features?: Array<{ attributes: Record<string, unknown> }> }

const fetchFeatures = async (url: string, lat: number, lng: number, fields: readonly string[]): Promise<FeatureSet> => {
  const res = await fetch(buildQuery(url, lat, lng, fields))
  if (!res.ok) throw new Error(`Upstream ${url} returned ${res.status}`)
  return await res.json() as FeatureSet
}

const firstAttrs = (fs: FeatureSet) => fs.features?.[0]?.attributes ?? null

export const handler: Handler = async (event: HandlerEvent) => {
  const lat = Number(event.queryStringParameters?.lat)
  const lng = Number(event.queryStringParameters?.lng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInBostonBbox(lat, lng)) {
    return fail('OUT_OF_BBOX', 'lat/lng missing, invalid, or outside Boston bbox.', 400)
  }

  const t0 = Date.now()
  const [zoningR, parcelR, historicR, floodR] = await Promise.allSettled([
    fetchFeatures(ENDPOINTS.zoning, lat, lng, FIELDS.zoning),
    fetchFeatures(ENDPOINTS.parcels, lat, lng, FIELDS.parcels),
    fetchFeatures(ENDPOINTS.historic, lat, lng, FIELDS.historic),
    fetchFeatures(ENDPOINTS.flood, lat, lng, FIELDS.flood),
  ])

  // Critical: zoning + parcels must succeed
  if (zoningR.status === 'rejected' || parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', durationMs: Date.now() - t0, zoning: zoningR.status, parcel: parcelR.status })
    return fail('UPSTREAM_ERROR', 'A required upstream dataset is unavailable. Try again shortly.', 502)
  }

  const zoning = firstAttrs(zoningR.value)
  const parcel = firstAttrs(parcelR.value)

  if (!parcel) {
    return fail('NO_PARCEL', 'No parcel found at this location.', 404)
  }

  const historic = historicR.status === 'fulfilled' ? firstAttrs(historicR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  const info: ParcelInfo = {
    address: String(parcel.full_addre ?? 'Unknown address'),
    parcelId: String(parcel.pid ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: String(zoning?.Name ?? 'Unknown'),
      subdistrict: zoning?.District ? String(zoning.District) : null,
      article: zoning?.Article ? String(zoning.Article) : null,
      maxHeightFt: null,   // not in current attribute set; surfaced in wizard
      maxFAR: null,        // same
      allowedUses: null,   // open question in design doc
    },
    lot: {
      sizeSqFt: typeof parcel.lot_size === 'number' ? parcel.lot_size : null,
      lotType: null,
    },
    overlays: {
      historicDistrict: historic?.HIST_NAME ? String(historic.HIST_NAME) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
    },
    sources: ENDPOINTS,
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', durationMs: Date.now() - t0, parcelId: info.parcelId })

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
    body: JSON.stringify(info),
  }
}
```

**Step 2: Run tests**

Run: `npm test`
Expected: validation + normalization tests pass.

**Step 3: Commit**

```bash
git add netlify/functions/parcel.ts
git commit -m "Implement parcel fan-out, normalization, edge caching"
```

---

## Task 9: Test partial-failure (historic/flood reject, 200 returned)

**Files:**
- Modify: `netlify/functions/parcel.test.ts`

**Step 1: Add test**

```ts
describe('parcel handler — resilience', () => {
  it('returns 200 with null overlays when historic + flood reject', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('Zoning')) {
        return new Response(JSON.stringify({ features: [{ attributes: { Name: 'R-1' } }] }))
      }
      if (u.includes('Parcels')) {
        return new Response(JSON.stringify({ features: [{ attributes: { pid: '99', full_addre: '99 Main' } }] }))
      }
      throw new Error('upstream offline')
    })

    const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.overlays.historicDistrict).toBeNull()
    expect(body.overlays.floodZone).toBeNull()
  })
})
```

**Step 2: Run**

Run: `npm test`
Expected: PASS (the existing `Promise.allSettled` + per-result fulfilled check already supports this — verify, don't refactor).

**Step 3: Commit if any minor change was needed**

```bash
git add netlify/functions/parcel.test.ts
git commit -m "Verify partial-failure resilience for non-critical overlays"
```

---

## Task 10: Test critical-failure (zoning rejects → 502)

**Files:**
- Modify: `netlify/functions/parcel.test.ts`

**Step 1: Add test**

```ts
it('returns 502 when zoning upstream rejects', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url)
    if (u.includes('Zoning')) throw new Error('zoning down')
    return new Response(JSON.stringify({ features: [{ attributes: { pid: '1', full_addre: 'x' } }] }))
  })

  const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
  expect(res.statusCode).toBe(502)
  expect(JSON.parse(res.body).code).toBe('UPSTREAM_ERROR')
})
```

**Step 2: Run**

Run: `npm test`
Expected: PASS.

**Step 3: Commit**

```bash
git add netlify/functions/parcel.test.ts
git commit -m "Verify critical-failure returns 502 when zoning down"
```

---

## Task 11: Test no-parcel (404)

**Files:**
- Modify: `netlify/functions/parcel.test.ts`

**Step 1: Add test**

```ts
it('returns 404 when parcels dataset has no feature at point', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url)
    if (u.includes('Zoning')) {
      return new Response(JSON.stringify({ features: [{ attributes: { Name: 'OS' } }] }))
    }
    if (u.includes('Parcels')) {
      return new Response(JSON.stringify({ features: [] }))
    }
    return new Response(JSON.stringify({ features: [] }))
  })

  const res = await callHandler({ lat: '42.3601', lng: '-71.0589' })
  expect(res.statusCode).toBe(404)
  expect(JSON.parse(res.body).code).toBe('NO_PARCEL')
})
```

**Step 2: Run**

Run: `npm test`
Expected: PASS.

**Step 3: Commit**

```bash
git add netlify/functions/parcel.test.ts
git commit -m "Verify NO_PARCEL 404 when point lands off-parcel"
```

---

## Task 12: Refactor Layout — move container out

**Files:**
- Modify: `src/components/Layout.tsx`
- Create: `src/components/PageContainer.tsx`
- Modify: `src/routes/Home.tsx`, `BostonDashboard.tsx`, `BostonWizard.tsx`, `BostonResult.tsx`, `Ask.tsx`, `About.tsx`, `Methodology.tsx`

**Step 1: Create `PageContainer`**

```tsx
import type { ReactNode } from 'react'

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="max-w-6xl mx-auto px-6 py-12">{children}</div>
}
```

**Step 2: Update `Layout.tsx` `<main>` block**

Replace:
```tsx
<main className="flex-1">
  <div className="max-w-6xl mx-auto px-6 py-12">{children}</div>
</main>
```

With:
```tsx
<main className="flex-1">{children}</main>
```

**Step 3: Wrap every existing placeholder route in `PageContainer`**

Each route file (`Home.tsx` etc.) becomes:
```tsx
import { PageContainer } from '../components/PageContainer'

export default function Home() {
  return (
    <PageContainer>
      <h1 className="font-serif text-5xl tracking-tight">Home</h1>
    </PageContainer>
  )
}
```

Repeat for `About`, `Ask`, `BostonDashboard`, `BostonWizard`, `BostonResult`, `Methodology`. **Dashboard will be replaced in Task 14 — keep it `PageContainer`-wrapped for now so the regression is zero.**

**Step 4: Run dev server + visual check**

Run: `npm run dev`
Open each existing route. Should look identical to before (placeholder h1 in the centered container).

**Step 5: Commit**

```bash
git add src/components/Layout.tsx src/components/PageContainer.tsx src/routes/*.tsx
git commit -m "Move container out of Layout into PageContainer (enables full-bleed routes)"
```

---

## Task 13: Author Mapbox style overrides

**Files:**
- Create: `src/styles/bostonMapStyle.ts`

The cleanest, lowest-effort path: use Mapbox's hosted `light-v11` style as the base, then override paint colors at runtime. Avoids hand-authoring a full style spec.

**Step 1: Write the file**

```ts
// Brand-palette overrides applied to mapbox://styles/mapbox/light-v11.
// Apply via map.setPaintProperty(layerId, prop, value) on style.load.

export const BRAND = {
  burgundy: '#7A1B2E',
  charcoal: '#1A1A1A',
  bone: '#F5F1EA',
  gold: '#C9A55C',
} as const

export const BOSTON_CENTER: [number, number] = [-71.0589, 42.3601]
export const BOSTON_ZOOM = 12

export interface PaintOverride {
  layerId: string
  property: string
  value: string | number
}

export const BRAND_OVERRIDES: PaintOverride[] = [
  { layerId: 'background', property: 'background-color', value: BRAND.bone },
  { layerId: 'land', property: 'background-color', value: BRAND.bone },
  { layerId: 'water', property: 'fill-color', value: '#D9D2C6' },
  { layerId: 'road-primary', property: 'line-color', value: BRAND.charcoal },
  { layerId: 'road-secondary-tertiary', property: 'line-color', value: '#5C5C5C' },
]

export const ZONING_RASTER_URL =
  // Verified in Task 6 — Boston BPDA Zoning Subdistricts as ArcGIS exportTiles or MapServer.
  '<verified URL here>'
```

**Step 2: Commit**

```bash
git add src/styles/bostonMapStyle.ts
git commit -m "Add brand palette overrides + Boston map constants"
```

---

## Task 14: Build BostonDashboard route shell

**Files:**
- Modify: `src/routes/BostonDashboard.tsx` (full rewrite — remove PageContainer wrapper, add full-bleed layout)

**Step 1: Replace contents**

```tsx
import { useState } from 'react'

interface Selection {
  lat: number
  lng: number
}

export default function BostonDashboard() {
  const [selected, setSelected] = useState<Selection | null>(null)

  return (
    <div className="relative h-[calc(100vh-4rem-8.5rem)]">
      {/* 4rem header + ~8.5rem footer. Adjust if footer height changes. */}
      <div className="absolute inset-0 bg-piranha-charcoal/5 grid place-items-center">
        <p className="text-sm uppercase tracking-wider">Map placeholder — Task 15 wires Mapbox.</p>
      </div>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[28rem] max-w-[calc(100%-2rem)]">
        <div className="bg-piranha-bone border border-piranha-charcoal/10 p-3 text-sm">
          Search placeholder — Task 16 wires geocoder.
        </div>
      </div>
      {selected && (
        <div className="absolute right-4 top-4 bottom-4 z-10 w-[420px] max-w-[calc(100%-2rem)]">
          <div className="bg-piranha-bone border border-piranha-charcoal/10 h-full p-4 text-sm">
            Panel placeholder — Task 18 wires data. lat={selected.lat} lng={selected.lng}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Visual check**

Run: `npm run dev` and visit `/boston`. Expected: full-bleed gray placeholder with a centered search bar bar and no panel.

**Step 3: Commit**

```bash
git add src/routes/BostonDashboard.tsx
git commit -m "Build full-bleed BostonDashboard route shell (no map yet)"
```

---

## Task 15: Build `<Map>` component

**Files:**
- Create: `src/components/boston/Map.tsx`

**Step 1: Implement**

```tsx
import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  BOSTON_CENTER,
  BOSTON_ZOOM,
  BRAND_OVERRIDES,
  ZONING_RASTER_URL,
} from '../../styles/bostonMapStyle'

interface MapProps {
  onPointSelect: (lat: number, lng: number) => void
  focusedPoint: { lat: number; lng: number } | null
}

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

export function Map({ onPointSelect, focusedPoint }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)

  useEffect(() => {
    if (!TOKEN) return
    if (!containerRef.current || mapRef.current) return

    mapboxgl.accessToken = TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: BOSTON_CENTER,
      zoom: BOSTON_ZOOM,
      attributionControl: true,
    })
    mapRef.current = map

    map.on('style.load', () => {
      BRAND_OVERRIDES.forEach(({ layerId, property, value }) => {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, property as never, value as never)
        }
      })
      if (ZONING_RASTER_URL && !ZONING_RASTER_URL.startsWith('<')) {
        map.addSource('boston-zoning', {
          type: 'raster',
          tiles: [ZONING_RASTER_URL],
          tileSize: 256,
        })
        map.addLayer({
          id: 'boston-zoning',
          type: 'raster',
          source: 'boston-zoning',
          paint: { 'raster-opacity': 0.45 },
        })
      }
    })

    map.on('click', (e) => {
      onPointSelect(e.lngLat.lat, e.lngLat.lng)
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [onPointSelect])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !focusedPoint) return
    map.flyTo({ center: [focusedPoint.lng, focusedPoint.lat], zoom: 17, essential: true })
    if (markerRef.current) markerRef.current.remove()
    markerRef.current = new mapboxgl.Marker({ color: '#7A1B2E' })
      .setLngLat([focusedPoint.lng, focusedPoint.lat])
      .addTo(map)
  }, [focusedPoint])

  if (!TOKEN) {
    return (
      <div className="h-full grid place-items-center bg-piranha-charcoal/5">
        <div className="text-center max-w-sm p-6">
          <p className="font-semibold uppercase tracking-wider text-sm text-piranha-burgundy">
            Map unavailable
          </p>
          <p className="text-sm mt-2 text-piranha-charcoal/70">
            VITE_MAPBOX_TOKEN is not configured. Add it to .env to enable the map.
          </p>
        </div>
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full" />
}
```

**Step 2: Add the env var name**

Modify `.env.example`:
```
# Mapbox public token, required for the Boston dashboard map.
VITE_MAPBOX_TOKEN=
```

Remove the old `MAPBOX_TOKEN=` if it's there (we need the `VITE_` prefix to expose to the browser).

**Step 3: Wire into `BostonDashboard`**

Replace the placeholder map div with `<Map onPointSelect={(lat, lng) => setSelected({ lat, lng })} focusedPoint={selected} />`.

**Step 4: Visual check**

Add a real `VITE_MAPBOX_TOKEN` to `.env`, restart `npm run dev`, visit `/boston`. Expected: brand-tinted light map of Boston centered on City Hall. Click anywhere → console shows pin drops.

If the map shows but tinting doesn't take effect: log `map.getStyle().layers.map(l => l.id)` to confirm layer IDs match the overrides.

**Step 5: Commit**

```bash
git add src/components/boston/Map.tsx src/routes/BostonDashboard.tsx .env.example
git commit -m "Add Mapbox GL JS map with brand overrides + click handler"
```

---

## Task 16: Build `<SearchBar>` component

**Files:**
- Create: `src/components/boston/SearchBar.tsx`

**Step 1: Implement**

```tsx
import { SearchBox } from '@mapbox/search-js-react'
import { BOSTON_BBOX } from '../../types/parcel'

interface SearchBarProps {
  onSelect: (lat: number, lng: number) => void
}

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

export function SearchBar({ onSelect }: SearchBarProps) {
  if (!TOKEN) return null

  return (
    <SearchBox
      accessToken={TOKEN}
      options={{
        bbox: [BOSTON_BBOX.west, BOSTON_BBOX.south, BOSTON_BBOX.east, BOSTON_BBOX.north],
        country: 'us',
        proximity: { lng: -71.0589, lat: 42.3601 },
        types: 'address',
      }}
      placeholder="Search Boston address"
      onRetrieve={(res) => {
        const f = res.features?.[0]
        if (!f) return
        const [lng, lat] = f.geometry.coordinates
        onSelect(lat, lng)
      }}
    />
  )
}
```

**Step 2: Wire into `BostonDashboard`**

Replace the placeholder search div with `<SearchBar onSelect={(lat, lng) => setSelected({ lat, lng })} />`.

**Step 3: Visual check**

Type "100 Cambridge St" in the search box → suggestion appears → click → map flies to it and drops a pin.

**Step 4: Commit**

```bash
git add src/components/boston/SearchBar.tsx src/routes/BostonDashboard.tsx
git commit -m "Add Mapbox Search box constrained to Boston bbox"
```

---

## Task 17: Build `useParcelInfo` hook

**Files:**
- Create: `src/hooks/useParcelInfo.ts`

**Step 1: Implement**

```ts
import { useEffect, useState } from 'react'
import type { ParcelInfo, ParcelError } from '../types/parcel'

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: ParcelInfo }
  | { status: 'error'; error: ParcelError }

interface Args {
  lat: number
  lng: number
}

export function useParcelInfo(args: Args | null): State & { retry: () => void } {
  const [state, setState] = useState<State>({ status: 'idle' })
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!args) {
      setState({ status: 'idle' })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })
    fetch(`/api/parcel?lat=${args.lat}&lng=${args.lng}`)
      .then(async (res) => {
        const body = await res.json()
        if (cancelled) return
        if (res.ok) {
          setState({ status: 'loaded', data: body as ParcelInfo })
        } else {
          setState({ status: 'error', error: body as ParcelError })
        }
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          status: 'error',
          error: { code: 'INTERNAL', message: err instanceof Error ? err.message : 'Network error' },
        })
      })
    return () => {
      cancelled = true
    }
  }, [args?.lat, args?.lng, retryCount])

  return { ...state, retry: () => setRetryCount((n) => n + 1) }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useParcelInfo.ts
git commit -m "Add useParcelInfo hook (idle/loading/loaded/error + retry)"
```

---

## Task 18: Build `<ParcelPanel>` + `<ParcelPanelContent>`

**Files:**
- Create: `src/components/boston/ParcelPanel.tsx`
- Create: `src/components/boston/ParcelPanelContent.tsx`

**Step 1: Implement `ParcelPanelContent`**

```tsx
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import type { ParcelInfo, ParcelError } from '../../types/parcel'

type Props =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: ParcelInfo }
  | { status: 'error'; error: ParcelError; onRetry: () => void }

export function ParcelPanelContent(props: Props) {
  if (props.status === 'idle') {
    return (
      <div className="p-6 text-sm text-piranha-charcoal/70">
        Search an address or click the map to start.
      </div>
    )
  }

  if (props.status === 'loading') {
    return (
      <div className="p-6 space-y-3 animate-pulse">
        <div className="h-6 bg-piranha-charcoal/10 w-3/4" />
        <div className="h-4 bg-piranha-charcoal/10 w-1/2" />
        <div className="h-32 bg-piranha-charcoal/5 mt-6" />
        <div className="h-10 bg-piranha-charcoal/10 mt-6" />
      </div>
    )
  }

  if (props.status === 'error') {
    const msg =
      props.error.code === 'NO_PARCEL'
        ? 'No parcel at this location — try a building.'
        : props.error.code === 'OUT_OF_BBOX'
          ? 'That address is outside Boston coverage.'
          : "Couldn't load parcel info."
    return (
      <div className="p-6 space-y-4 text-sm">
        <p className="font-semibold uppercase tracking-wider text-piranha-burgundy">
          {msg}
        </p>
        <p className="text-piranha-charcoal/70">{props.error.message}</p>
        <Button size="sm" onClick={props.onRetry}>Retry</Button>
      </div>
    )
  }

  const { data } = props
  return (
    <div className="p-6 space-y-6 text-sm">
      <header>
        <h2 className="font-serif text-2xl tracking-tight">{data.address}</h2>
        <p className="text-piranha-charcoal/60 text-xs mt-1">Parcel {data.parcelId}</p>
      </header>

      <section>
        <h3 className="font-semibold uppercase tracking-wider text-xs mb-2">Zoning</h3>
        <div className="flex items-center gap-2 mb-2">
          <Badge tone="burgundy">{data.zoning.districtCode}</Badge>
          {data.zoning.subdistrict && <Badge tone="bone">{data.zoning.subdistrict}</Badge>}
        </div>
        {data.zoning.article && (
          <p className="text-piranha-charcoal/70">{data.zoning.article}</p>
        )}
      </section>

      {(data.zoning.maxHeightFt || data.zoning.maxFAR) && (
        <section>
          <h3 className="font-semibold uppercase tracking-wider text-xs mb-2">Dimensional limits</h3>
          <dl className="grid grid-cols-2 gap-3">
            {data.zoning.maxHeightFt && (
              <div><dt className="text-piranha-charcoal/60 text-xs">Max height</dt><dd>{data.zoning.maxHeightFt} ft</dd></div>
            )}
            {data.zoning.maxFAR && (
              <div><dt className="text-piranha-charcoal/60 text-xs">Max FAR</dt><dd>{data.zoning.maxFAR}</dd></div>
            )}
          </dl>
        </section>
      )}

      <section>
        <h3 className="font-semibold uppercase tracking-wider text-xs mb-2">Lot</h3>
        {data.lot.sizeSqFt ? <p>{data.lot.sizeSqFt.toLocaleString()} sq ft</p> : <p className="text-piranha-charcoal/60">Size unavailable</p>}
      </section>

      <section>
        <h3 className="font-semibold uppercase tracking-wider text-xs mb-2">Overlays</h3>
        <div className="flex flex-wrap gap-2">
          {data.overlays.historicDistrict && <Badge tone="gold">Historic: {data.overlays.historicDistrict}</Badge>}
          {data.overlays.floodZone && <Badge tone="charcoal">Flood Zone {data.overlays.floodZone}</Badge>}
          {!data.overlays.historicDistrict && !data.overlays.floodZone && (
            <p className="text-piranha-charcoal/60 text-xs">No overlays apply</p>
          )}
        </div>
      </section>

      <Link
        to={`/boston/start?parcelId=${encodeURIComponent(data.parcelId)}&lat=${data.coordinates[1]}&lng=${data.coordinates[0]}`}
        className="block"
      >
        <Button size="lg" className="w-full">Start full analysis</Button>
      </Link>
    </div>
  )
}
```

**Step 2: Implement `ParcelPanel` container**

```tsx
import { useParcelInfo } from '../../hooks/useParcelInfo'
import { ParcelPanelContent } from './ParcelPanelContent'

interface PanelProps {
  selected: { lat: number; lng: number } | null
}

export function ParcelPanel({ selected }: PanelProps) {
  const state = useParcelInfo(selected)

  return (
    <aside className="bg-piranha-bone border-l border-piranha-charcoal/10 h-full overflow-y-auto">
      {state.status === 'idle' && <ParcelPanelContent status="idle" />}
      {state.status === 'loading' && <ParcelPanelContent status="loading" />}
      {state.status === 'loaded' && <ParcelPanelContent status="loaded" data={state.data} />}
      {state.status === 'error' && (
        <ParcelPanelContent status="error" error={state.error} onRetry={state.retry} />
      )}
    </aside>
  )
}
```

**Step 3: Wire into `BostonDashboard`**

Replace the placeholder panel div with `<ParcelPanel selected={selected} />`. Show on `md:+` only; mobile sheet in next task.

**Step 4: Visual check**

Click a parcel → panel populates with real data.

**Step 5: Commit**

```bash
git add src/components/boston/ParcelPanel.tsx src/components/boston/ParcelPanelContent.tsx src/routes/BostonDashboard.tsx
git commit -m "Add ParcelPanel with empty/loading/loaded/error states"
```

---

## Task 19: Mobile bottom-sheet variant

**Files:**
- Modify: `src/routes/BostonDashboard.tsx`

**Step 1: Add responsive class swap**

The side panel container is `md:right-4 md:top-4 md:bottom-4 md:w-[420px]` on desktop; on mobile it becomes `left-0 right-0 bottom-0 max-h-[60vh]`.

Roughly:
```tsx
<div className="absolute z-10 md:right-4 md:top-4 md:bottom-4 md:w-[420px] left-0 right-0 bottom-0 max-h-[60vh] md:max-h-none">
  <ParcelPanel selected={selected} />
</div>
```

Only show when `selected` is non-null OR keep visible with empty state — design choice. The design doc shows the empty state on the panel, so keep it visible at all times on desktop, and only show on mobile when there's a selection.

```tsx
{(selected || matchesMd) && <div>...</div>}
```

Practically: just always render on desktop, only render on mobile when `selected`. Use CSS:
```tsx
<div className={`absolute z-10 md:block md:right-4 md:top-4 md:bottom-4 md:w-[420px] left-0 right-0 bottom-0 max-h-[60vh] md:max-h-none ${selected ? 'block' : 'hidden md:block'}`}>
  <ParcelPanel selected={selected} />
</div>
```

**Step 2: Visual check at < 768px width**

Browser DevTools: resize to 375px. With no selection: no panel. With a selection: bottom sheet ~60vh.

**Step 3: Commit**

```bash
git add src/routes/BostonDashboard.tsx
git commit -m "Add mobile bottom-sheet variant for ParcelPanel"
```

---

## Task 20: Final lint + build

**Step 1: Lint**

Run: `npm run lint`
Expected: clean.

**Step 2: Build**

Run: `npm run build`
Expected: clean.

**Step 3: Tests**

Run: `npm test`
Expected: all 5+ tests pass.

**Step 4: If anything fails, fix and re-commit. If clean, no new commit needed.**

---

## Task 21: Manual verification checklist

Walk these in a browser with the dev server running:

1. Map renders at `/boston` — Boston centered, zoning colors visible.
2. Search "100 Cambridge St" → suggestion → click → fly-to → pin → panel populates with real data.
3. Click an arbitrary building polygon → panel populates.
4. Click on Boston Harbor → "No parcel at this location" cleanly.
5. Search "1600 Pennsylvania Ave, DC" → filtered out OR out-of-Boston state.
6. DevTools offline → click parcel → error state + retry → re-enable → retry succeeds.
7. Resize to mobile → side panel becomes bottom sheet.
8. Click "Start full analysis" → navigates to `/boston/start?parcelId=...&lat=...&lng=...`.

For each: note pass/fail with one-line evidence (screenshot or quick description).

**If any item fails**: open a new task in this plan to fix it. Don't paper over.

---

## Task 22: PR / merge

Decide with the user whether to:
- Stay on `main` (current pattern), or
- Push a branch + open a PR (more reviewable, especially for the bigger ParcelPanel diff).

If PR, branch name: `boston-dashboard-mvp`.

---

## Conventions reminders

- TDD strictly enforced for the backend (Tasks 4–11). Each test commit is a separate atomic commit (`fail → implement → pass → commit`).
- For UI tasks (12–19), TypeScript is the safety net. Manual verification (Task 21) is the acceptance gate.
- Commit messages: imperative, present tense, no period. ~70-char subject.
- Never commit `.env`. Confirm `.gitignore` covers it (already does as of commit `f52bfae`).
- If an upstream Boston dataset is unreachable or returns an unexpected schema (Task 6), STOP and ask the user. Per the design doc: no fake data fallbacks.

---

**Plan complete.**
