# Boston Analysis Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `/boston/start` and `/boston/result` stubs into a 3-step project wizard plus a hybrid feasibility+cost engine (`/api/analyze`) that tells a user whether their proposed Boston project is buildable, why, and what it costs.

**Architecture:** Backend-mediated, mirroring the existing `parcel.ts` façade. A Netlify function `analyze.ts` orchestrates pure logic modules in `netlify/functions/lib/` (shared parcel fetch, zoning-limit resolution, feasibility math, cost estimation, templated narrative). The wizard collects inputs and navigates to a result URL carrying all params; the result page calls the engine. URL is the single source of truth — analysis is reproducible and shareable.

**Tech Stack:** TypeScript, React 19, React Router v7, Netlify Functions, Vitest. No new runtime dependencies.

**Design spec:** `docs/plans/2026-05-28-boston-analysis-wizard-design.md`

---

## File structure

```
netlify/functions/
  analyze.ts                 engine handler (replaces stub)
  parcel.ts                  thin handler (refactored to delegate)
  lib/
    parcel.ts                getParcelInfo(lat,lng) — extracted shared fetch/normalize
    parcel.test.ts           moved here from top level (kills deploy warning)
    zoningLimits.ts          resolveZoningLimits() — seed district→limits lookup
    zoningLimits.test.ts
    feasibility.ts           assessFeasibility() — pure
    feasibility.test.ts
    cost.ts                  estimateCost() — pure
    cost.test.ts
    narrative.ts             buildNarrative() — templated prose
    narrative.test.ts
    assumptions.ts           seed cost/time constants + summary
    analyze.test.ts          handler tests (mocked fetch)
src/types/analysis.ts        shared analysis types
src/hooks/useAnalysis.ts     fetch hook (mirrors useParcelInfo)
src/routes/BostonWizard.tsx  wizard orchestration (replaces stub)
src/routes/BostonResult.tsx  result page (replaces stub)
src/components/boston/wizard/
  WizardProgress.tsx
  ParcelContextHeader.tsx
  StepUse.tsx
  StepSize.tsx
  StepHeight.tsx
src/components/boston/result/
  VerdictBanner.tsx
  FeasibilityChecklist.tsx
  CostBreakdown.tsx
  Timeline.tsx
  NarrativeSection.tsx
  AssumptionsDisclosure.tsx
```

Backend tests live under `netlify/functions/lib/` (a subdirectory Netlify does NOT treat as deployable functions), which is why the existing top-level `parcel.test.ts` moves there in Task 1.

---

## Task 1: Extract shared parcel fetch into `lib/parcel.ts`

Pull the ArcGIS fetch + normalize logic out of `parcel.ts` so `analyze.ts` can reuse it without duplicating query syntax. Also relocate the test to kill the `parcel.test` deploy warning.

**Files:**
- Create: `netlify/functions/lib/parcel.ts`
- Modify: `netlify/functions/parcel.ts` (becomes a thin handler)
- Move: `netlify/functions/parcel.test.ts` → `netlify/functions/lib/parcel.test.ts`

- [ ] **Step 1: Create `netlify/functions/lib/parcel.ts`**

```ts
import { isInBostonBbox, type ParcelError, type ParcelInfo } from '../../../src/types/parcel'
import { ENDPOINTS, FIELDS } from '../_endpoints'

export type ParcelResult =
  | { ok: true; info: ParcelInfo }
  | { ok: false; code: ParcelError['code']; message: string; status: number }

const buildQuery = (url: string, lat: number, lng: number, fields: readonly string[]) => {
  const base = url.endsWith('/') ? url.slice(0, -1) : url
  const u = new URL(base + '/query')
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
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  try {
    const res = await fetch(buildQuery(url, lat, lng, fields), { signal: ctrl.signal })
    if (!res.ok) throw new Error(`Upstream ${url} returned ${res.status}`)
    return await res.json() as FeatureSet
  } finally {
    clearTimeout(timer)
  }
}

const firstAttrs = (fs: FeatureSet) => fs.features?.[0]?.attributes ?? null

export async function getParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInBostonBbox(lat, lng)) {
    return { ok: false, code: 'OUT_OF_BBOX', message: 'lat/lng missing, invalid, or outside Boston bbox.', status: 400 }
  }

  const t0 = Date.now()
  const [zoningR, parcelR, historicR, floodR] = await Promise.allSettled([
    fetchFeatures(ENDPOINTS.zoning, lat, lng, FIELDS.zoning),
    fetchFeatures(ENDPOINTS.parcels, lat, lng, FIELDS.parcels),
    fetchFeatures(ENDPOINTS.historic, lat, lng, FIELDS.historic),
    fetchFeatures(ENDPOINTS.flood, lat, lng, FIELDS.flood),
  ])

  if (zoningR.status === 'rejected' || parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', durationMs: Date.now() - t0, zoning: zoningR.status, parcel: parcelR.status })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const zoning = firstAttrs(zoningR.value)
  const parcel = firstAttrs(parcelR.value)
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
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
      maxHeightFt: null,
      maxFAR: null,
      allowedUses: null,
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
  return { ok: true, info }
}
```

- [ ] **Step 2: Replace `netlify/functions/parcel.ts` with the thin handler**

```ts
import type { Handler, HandlerEvent } from '@netlify/functions'
import type { ParcelError } from '../../src/types/parcel'
import { getParcelInfo } from './lib/parcel'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

const fail = (code: ParcelError['code'], message: string, status: number) => ({
  statusCode: status,
  headers: JSON_HEADERS,
  body: JSON.stringify({ code, message } satisfies ParcelError),
})

export const handler: Handler = async (event: HandlerEvent) => {
  const lat = Number(event.queryStringParameters?.lat)
  const lng = Number(event.queryStringParameters?.lng)
  const r = await getParcelInfo(lat, lng)
  if (!r.ok) return fail(r.code, r.message, r.status)
  return {
    statusCode: 200,
    headers: { ...JSON_HEADERS, 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    body: JSON.stringify(r.info),
  }
}
```

- [ ] **Step 3: Move the test and fix its import**

```bash
git mv netlify/functions/parcel.test.ts netlify/functions/lib/parcel.test.ts
```

In `netlify/functions/lib/parcel.test.ts`, change the import on line 2 from:
```ts
import { handler } from './parcel'
```
to:
```ts
import { handler } from '../parcel'
```
(The test still exercises the handler end-to-end; no other changes — the mocked fetch URLs are unchanged because `ENDPOINTS` is unchanged.)

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS, 8 tests (same as before — behavior preserved).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc -b && npx eslint .`
Expected: both clean, no output.

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/lib/parcel.ts netlify/functions/lib/parcel.test.ts netlify/functions/parcel.ts
git commit -m "Extract getParcelInfo into lib/ for reuse by analyze"
```

---

## Task 2: Analysis types

Shared types consumed by both backend and frontend.

**Files:**
- Create: `src/types/analysis.ts`

- [ ] **Step 1: Create `src/types/analysis.ts`**

```ts
export type Use = 'residential' | 'commercial' | 'mixed' | 'institutional'
export type CheckStatus = 'AS_OF_RIGHT' | 'NEEDS_RELIEF' | 'PROHIBITED' | 'INDETERMINATE'
export type ApprovalPath = 'as_of_right' | 'variance' | 'prohibited'

export interface AnalysisInput {
  parcelId: string
  lat: number
  lng: number
  use: Use
  gfa: number
  units?: number
  stories?: number
  heightFt?: number
}

export interface FeasibilityCheck {
  dimension: 'use' | 'far' | 'height'
  status: CheckStatus
  proposed: string
  allowed: string
  note: string | null
}

export interface AnalysisResult {
  parcel: { address: string; parcelId: string; districtCode: string }
  project: AnalysisInput
  feasibility: { overall: CheckStatus; checks: FeasibilityCheck[] }
  costs: { hard: number; soft: number; permit: number; total: number; currency: 'USD' }
  timeline: { months: number; path: ApprovalPath }
  narrative: string
  assumptions: Record<string, string>
  disclaimers: string[]
  generatedAt: string
}

export interface AnalysisError {
  code: 'BAD_INPUT' | 'NO_PARCEL' | 'OUT_OF_BBOX' | 'UPSTREAM_ERROR' | 'INTERNAL'
  message: string
}

export const USES: Use[] = ['residential', 'commercial', 'mixed', 'institutional']
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean (types only; nothing imports them yet).

- [ ] **Step 3: Commit**

```bash
git add src/types/analysis.ts
git commit -m "Add analysis types"
```

---

## Task 3: Seed assumptions table

The single, clearly-labeled home for cost/time estimates. Every value is a tunable seed ballpark.

**Files:**
- Create: `netlify/functions/lib/assumptions.ts`
- Test: `netlify/functions/lib/assumptions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { costPerSqFtByUse, softCostPct, timelineMonthsByPath, assumptionsSummary, FT_PER_STORY } from './assumptions'

describe('assumptions', () => {
  it('has positive hard-cost rates for every use', () => {
    for (const v of Object.values(costPerSqFtByUse)) expect(v).toBeGreaterThan(0)
  })
  it('soft cost is a fraction between 0 and 1', () => {
    expect(softCostPct).toBeGreaterThan(0)
    expect(softCostPct).toBeLessThan(1)
  })
  it('variance timeline is longer than as-of-right', () => {
    expect(timelineMonthsByPath.variance).toBeGreaterThan(timelineMonthsByPath.as_of_right)
  })
  it('feet-per-story is a sane positive number', () => {
    expect(FT_PER_STORY).toBeGreaterThan(5)
  })
  it('summary returns human-readable strings', () => {
    const s = assumptionsSummary()
    expect(typeof s.softCost).toBe('string')
    expect(Object.keys(s).length).toBeGreaterThan(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run netlify/functions/lib/assumptions.test.ts`
Expected: FAIL — cannot resolve `./assumptions`.

- [ ] **Step 3: Create `netlify/functions/lib/assumptions.ts`**

```ts
// SEED ESTIMATES — labeled ballpark values for the Boston analysis MVP.
// All figures are rough and meant to be tuned. Sources noted inline.
import type { Use } from '../../../src/types/analysis'

export const FT_PER_STORY = 11 // typical residential floor-to-floor incl. structure (ft)

export const costPerSqFtByUse: Record<Use, number> = {
  residential: 350, // mid-rise multifamily hard cost, Boston ~2025 ($/sf)
  commercial: 400,
  mixed: 375,
  institutional: 450,
}

export const softCostPct = 0.25 // soft costs as a share of hard cost

export const PERMIT_BASE_FEE = 100 // flat building-permit filing fee (USD)
export const PERMIT_RATE_PER_1000 = 10 // $ per $1,000 of construction value (Boston ISD ballpark)
export const VARIANCE_FILING_FEE = 600 // ZBA variance filing + intake (USD)

export const timelineMonthsByPath = {
  as_of_right: 4,
  variance: 12,
  prohibited: 0,
} as const

export function assumptionsSummary(): Record<string, string> {
  return {
    hardCostResidential: `$${costPerSqFtByUse.residential}/sf`,
    hardCostCommercial: `$${costPerSqFtByUse.commercial}/sf`,
    hardCostMixed: `$${costPerSqFtByUse.mixed}/sf`,
    hardCostInstitutional: `$${costPerSqFtByUse.institutional}/sf`,
    softCost: `${Math.round(softCostPct * 100)}% of hard cost`,
    permitFee: `$${PERMIT_BASE_FEE} + $${PERMIT_RATE_PER_1000} per $1,000 of construction value`,
    varianceFiling: `$${VARIANCE_FILING_FEE} when relief required`,
    asOfRightTimeline: `${timelineMonthsByPath.as_of_right} months`,
    varianceTimeline: `${timelineMonthsByPath.variance} months`,
    feetPerStory: `${FT_PER_STORY} ft`,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run netlify/functions/lib/assumptions.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/lib/assumptions.ts netlify/functions/lib/assumptions.test.ts
git commit -m "Add seed assumptions table for cost/time estimates"
```

---

## Task 4: Zoning-limit resolver

The parcel feed returns `null` for `maxFAR`/`maxHeightFt`/`allowedUses`. This module derives seed limits from the district code so the feasibility verdict isn't always `INDETERMINATE`. Heuristics are labeled and tunable.

**Files:**
- Create: `netlify/functions/lib/zoningLimits.ts`
- Test: `netlify/functions/lib/zoningLimits.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { resolveZoningLimits } from './zoningLimits'

const z = (districtCode: string) => ({ districtCode, maxFAR: null, maxHeightFt: null, allowedUses: null })

describe('resolveZoningLimits', () => {
  it('parses trailing height from a coded district like B-2-65', () => {
    const r = resolveZoningLimits(z('B-2-65'))
    expect(r.maxHeightFt).toBe(65)
    expect(r.maxFAR).toBe(2.0)
    expect(r.allowedUses).toContain('commercial')
  })

  it('treats an OS district as open-space family with no parsed height', () => {
    const r = resolveZoningLimits(z('OS-UP'))
    expect(r.maxHeightFt).toBeNull()
    expect(r.maxFAR).toBe(0.1)
    expect(r.allowedUses).toEqual(['institutional'])
  })

  it('handles a residential district with a single-digit suffix (no height parse)', () => {
    const r = resolveZoningLimits(z('R-1'))
    expect(r.maxHeightFt).toBeNull()
    expect(r.maxFAR).toBe(1.0)
    expect(r.allowedUses).toEqual(['residential'])
  })

  it('returns all nulls for an unknown district', () => {
    const r = resolveZoningLimits(z('Unknown'))
    expect(r.maxFAR).toBeNull()
    expect(r.maxHeightFt).toBeNull()
    expect(r.allowedUses).toBeNull()
  })

  it('prefers explicit non-null values from the parcel feed', () => {
    const r = resolveZoningLimits({ districtCode: 'B-2-65', maxFAR: 5, maxHeightFt: 200, allowedUses: ['residential'] })
    expect(r.maxFAR).toBe(5)
    expect(r.maxHeightFt).toBe(200)
    expect(r.allowedUses).toEqual(['residential'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run netlify/functions/lib/zoningLimits.test.ts`
Expected: FAIL — cannot resolve `./zoningLimits`.

- [ ] **Step 3: Create `netlify/functions/lib/zoningLimits.ts`**

```ts
// SEED HEURISTICS — Boston zoning, labeled estimates. Tune here.
// Boston subdistrict codes often encode the height limit as the trailing
// number, e.g. "B-2-65" => 65 ft. Family (leading letters) maps to seed
// FAR and allowed uses. Unknowns return null -> feasibility INDETERMINATE.
import type { Use } from '../../../src/types/analysis'

export interface ResolvedLimits {
  maxFAR: number | null
  maxHeightFt: number | null
  allowedUses: Use[] | null
}

const FAMILY_FAR: Record<string, number> = {
  R: 1.0, // residential
  S: 0.5, // single-family / suburban
  B: 2.0, // business
  C: 4.0, // commercial / downtown
  I: 2.0, // industrial
  OS: 0.1, // open space
}

const FAMILY_USES: Record<string, Use[]> = {
  R: ['residential'],
  S: ['residential'],
  B: ['commercial', 'mixed', 'residential'],
  C: ['commercial', 'mixed', 'residential', 'institutional'],
  I: ['commercial', 'institutional'],
  OS: ['institutional'],
}

function family(code: string): string | null {
  const c = code.toUpperCase().trim()
  if (c.startsWith('OS')) return 'OS'
  const m = c.match(/^[A-Z]/)
  return m ? m[0] : null
}

function parseHeight(code: string): number | null {
  const m = code.match(/-(\d{2,3})(?:\D|$)/)
  if (!m) return null
  const n = Number(m[1])
  return n >= 20 && n <= 700 ? n : null
}

export function resolveZoningLimits(zoning: {
  districtCode: string
  maxFAR: number | null
  maxHeightFt: number | null
  allowedUses: string[] | null
}): ResolvedLimits {
  const fam = family(zoning.districtCode)
  return {
    maxFAR: zoning.maxFAR ?? (fam ? FAMILY_FAR[fam] ?? null : null),
    maxHeightFt: zoning.maxHeightFt ?? parseHeight(zoning.districtCode),
    allowedUses: (zoning.allowedUses as Use[] | null) ?? (fam ? FAMILY_USES[fam] ?? null : null),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run netlify/functions/lib/zoningLimits.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/lib/zoningLimits.ts netlify/functions/lib/zoningLimits.test.ts
git commit -m "Add seed zoning-limit resolver from district codes"
```

---

## Task 5: Feasibility engine

Pure function: given parcel + project, produce per-dimension checks and an overall verdict.

**Files:**
- Create: `netlify/functions/lib/feasibility.ts`
- Test: `netlify/functions/lib/feasibility.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { assessFeasibility } from './feasibility'
import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput } from '../../../src/types/analysis'

const parcel = (over: Partial<ParcelInfo['zoning']> = {}, lotSize: number | null = 10000): ParcelInfo => ({
  address: '1 Test St', parcelId: 'p1', coordinates: [-71.06, 42.36],
  zoning: { districtCode: 'B-2-65', subdistrict: null, article: null, maxHeightFt: null, maxFAR: null, allowedUses: null, ...over },
  lot: { sizeSqFt: lotSize, lotType: null },
  overlays: { historicDistrict: null, floodZone: null },
  sources: {}, fetchedAt: '2026-05-28T00:00:00Z',
})
const project = (over: Partial<AnalysisInput> = {}): AnalysisInput =>
  ({ parcelId: 'p1', lat: 42.36, lng: -71.06, use: 'commercial', gfa: 15000, heightFt: 50, ...over })

describe('assessFeasibility', () => {
  it('is as-of-right when use allowed, FAR and height within limits', () => {
    // B-2-65 -> maxFAR 2.0, maxHeight 65, uses include commercial. 15000/10000 = FAR 1.5, 50ft.
    const r = assessFeasibility(parcel(), project())
    expect(r.overall).toBe('AS_OF_RIGHT')
    expect(r.path).toBe('as_of_right')
  })

  it('needs relief when FAR exceeds the district limit', () => {
    const r = assessFeasibility(parcel(), project({ gfa: 30000 })) // FAR 3.0 > 2.0
    expect(r.overall).toBe('NEEDS_RELIEF')
    expect(r.path).toBe('variance')
    expect(r.checks.find((c) => c.dimension === 'far')?.status).toBe('NEEDS_RELIEF')
  })

  it('needs relief when height exceeds the district limit', () => {
    const r = assessFeasibility(parcel(), project({ heightFt: 90 })) // > 65
    expect(r.checks.find((c) => c.dimension === 'height')?.status).toBe('NEEDS_RELIEF')
    expect(r.overall).toBe('NEEDS_RELIEF')
  })

  it('flags use needing relief when not in the allowed list', () => {
    const r = assessFeasibility(parcel({ districtCode: 'R-1' }), project({ use: 'commercial', gfa: 5000, heightFt: 30 }))
    expect(r.checks.find((c) => c.dimension === 'use')?.status).toBe('NEEDS_RELIEF')
  })

  it('is indeterminate when district is unknown', () => {
    const r = assessFeasibility(parcel({ districtCode: 'Unknown' }), project())
    expect(r.overall).toBe('INDETERMINATE')
    expect(r.path).toBe('as_of_right')
  })

  it('derives height from stories when heightFt is absent', () => {
    const r = assessFeasibility(parcel(), project({ heightFt: undefined, stories: 7 })) // 7*11=77 > 65
    expect(r.checks.find((c) => c.dimension === 'height')?.status).toBe('NEEDS_RELIEF')
  })

  it('is indeterminate on FAR when lot size is missing', () => {
    const r = assessFeasibility(parcel({}, null), project())
    expect(r.checks.find((c) => c.dimension === 'far')?.status).toBe('INDETERMINATE')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run netlify/functions/lib/feasibility.test.ts`
Expected: FAIL — cannot resolve `./feasibility`.

- [ ] **Step 3: Create `netlify/functions/lib/feasibility.ts`**

```ts
import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput, ApprovalPath, CheckStatus, FeasibilityCheck } from '../../../src/types/analysis'
import { resolveZoningLimits } from './zoningLimits'
import { FT_PER_STORY } from './assumptions'

const SEVERITY: Record<CheckStatus, number> = {
  AS_OF_RIGHT: 0,
  INDETERMINATE: 1,
  NEEDS_RELIEF: 2,
  PROHIBITED: 3,
}

export interface Feasibility {
  overall: CheckStatus
  checks: FeasibilityCheck[]
  path: ApprovalPath
}

export function assessFeasibility(parcel: ParcelInfo, project: AnalysisInput): Feasibility {
  const limits = resolveZoningLimits(parcel.zoning)
  const checks: FeasibilityCheck[] = []

  // USE
  if (!limits.allowedUses) {
    checks.push({ dimension: 'use', status: 'INDETERMINATE', proposed: project.use, allowed: 'not derivable', note: 'Allowed uses not derivable from available zoning data.' })
  } else if (limits.allowedUses.includes(project.use)) {
    checks.push({ dimension: 'use', status: 'AS_OF_RIGHT', proposed: project.use, allowed: limits.allowedUses.join(', '), note: null })
  } else {
    checks.push({ dimension: 'use', status: 'NEEDS_RELIEF', proposed: project.use, allowed: limits.allowedUses.join(', '), note: 'Proposed use is not listed for this district; a use variance would be required.' })
  }

  // FAR
  if (limits.maxFAR == null || parcel.lot.sizeSqFt == null) {
    checks.push({ dimension: 'far', status: 'INDETERMINATE', proposed: `${project.gfa.toLocaleString()} sf`, allowed: 'not derivable', note: 'FAR cannot be evaluated without lot size and a district FAR limit.' })
  } else {
    const proposedFAR = project.gfa / parcel.lot.sizeSqFt
    const status: CheckStatus = proposedFAR <= limits.maxFAR ? 'AS_OF_RIGHT' : 'NEEDS_RELIEF'
    checks.push({ dimension: 'far', status, proposed: `FAR ${proposedFAR.toFixed(2)}`, allowed: `max FAR ${limits.maxFAR.toFixed(2)}`, note: status === 'NEEDS_RELIEF' ? 'Proposed floor area exceeds the district FAR; dimensional relief would be required.' : null })
  }

  // HEIGHT
  const effHeight = project.heightFt ?? (project.stories != null ? project.stories * FT_PER_STORY : null)
  if (limits.maxHeightFt == null || effHeight == null) {
    checks.push({ dimension: 'height', status: 'INDETERMINATE', proposed: effHeight != null ? `${effHeight} ft` : 'unspecified', allowed: limits.maxHeightFt != null ? `max ${limits.maxHeightFt} ft` : 'not derivable', note: 'Height cannot be evaluated without both a proposed height and a district height limit.' })
  } else {
    const status: CheckStatus = effHeight <= limits.maxHeightFt ? 'AS_OF_RIGHT' : 'NEEDS_RELIEF'
    checks.push({ dimension: 'height', status, proposed: `${effHeight} ft`, allowed: `max ${limits.maxHeightFt} ft`, note: status === 'NEEDS_RELIEF' ? 'Proposed height exceeds the district limit; dimensional relief would be required.' : null })
  }

  const overall = checks.reduce<CheckStatus>(
    (worst, c) => (SEVERITY[c.status] > SEVERITY[worst] ? c.status : worst),
    'AS_OF_RIGHT',
  )
  const path: ApprovalPath = overall === 'PROHIBITED' ? 'prohibited' : overall === 'NEEDS_RELIEF' ? 'variance' : 'as_of_right'
  return { overall, checks, path }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run netlify/functions/lib/feasibility.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/lib/feasibility.ts netlify/functions/lib/feasibility.test.ts
git commit -m "Add pure feasibility engine"
```

---

## Task 6: Cost estimator

Pure function: given project + feasibility, compute the four cost dimensions and timeline from the assumptions table.

**Files:**
- Create: `netlify/functions/lib/cost.ts`
- Test: `netlify/functions/lib/cost.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { estimateCost } from './cost'
import type { AnalysisInput } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'

const project: AnalysisInput = { parcelId: 'p1', lat: 42.36, lng: -71.06, use: 'residential', gfa: 10000 }
const asOfRight: Feasibility = { overall: 'AS_OF_RIGHT', checks: [], path: 'as_of_right' }
const variance: Feasibility = { overall: 'NEEDS_RELIEF', checks: [], path: 'variance' }

describe('estimateCost', () => {
  it('computes hard cost as gfa x $/sf for the use', () => {
    // residential seed = $350/sf -> 10000*350 = 3,500,000
    expect(estimateCost(project, asOfRight).costs.hard).toBe(3_500_000)
  })

  it('computes soft cost as a fraction of hard', () => {
    const c = estimateCost(project, asOfRight).costs
    expect(c.soft).toBe(Math.round(c.hard * 0.25))
  })

  it('total is hard + soft + permit', () => {
    const c = estimateCost(project, asOfRight).costs
    expect(c.total).toBe(c.hard + c.soft + c.permit)
  })

  it('adds a variance filing fee and a longer timeline on the variance path', () => {
    const aor = estimateCost(project, asOfRight)
    const v = estimateCost(project, variance)
    expect(v.costs.permit).toBeGreaterThan(aor.costs.permit)
    expect(v.timeline.months).toBeGreaterThan(aor.timeline.months)
    expect(v.timeline.path).toBe('variance')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run netlify/functions/lib/cost.test.ts`
Expected: FAIL — cannot resolve `./cost`.

- [ ] **Step 3: Create `netlify/functions/lib/cost.ts`**

```ts
import type { AnalysisInput } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'
import {
  costPerSqFtByUse,
  softCostPct,
  PERMIT_BASE_FEE,
  PERMIT_RATE_PER_1000,
  VARIANCE_FILING_FEE,
  timelineMonthsByPath,
} from './assumptions'

export interface CostEstimate {
  costs: { hard: number; soft: number; permit: number; total: number; currency: 'USD' }
  timeline: { months: number; path: Feasibility['path'] }
}

export function estimateCost(project: AnalysisInput, feasibility: Feasibility): CostEstimate {
  const hard = Math.round(project.gfa * costPerSqFtByUse[project.use])
  const soft = Math.round(hard * softCostPct)
  const constructionValue = hard
  let permit = Math.round(PERMIT_BASE_FEE + (constructionValue / 1000) * PERMIT_RATE_PER_1000)
  if (feasibility.path === 'variance') permit += VARIANCE_FILING_FEE
  const total = hard + soft + permit
  return {
    costs: { hard, soft, permit, total, currency: 'USD' },
    timeline: { months: timelineMonthsByPath[feasibility.path], path: feasibility.path },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run netlify/functions/lib/cost.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/lib/cost.ts netlify/functions/lib/cost.test.ts
git commit -m "Add pure cost/timeline estimator"
```

---

## Task 7: Templated narrative

Isolated module that turns the structured result into the "why" prose. Keeping it in its own pure function is the LLM seam: swapping in a Claude call later is a one-file change. No env-var branch now (YAGNI — the LLM call isn't implemented yet).

**Files:**
- Create: `netlify/functions/lib/narrative.ts`
- Test: `netlify/functions/lib/narrative.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buildNarrative } from './narrative'
import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'
import type { CostEstimate } from './cost'

const parcel = { address: '1 Test St', zoning: { districtCode: 'B-2-65' } } as ParcelInfo
const project = { use: 'commercial', gfa: 15000 } as AnalysisInput
const cost: CostEstimate = {
  costs: { hard: 6_000_000, soft: 1_500_000, permit: 60_100, total: 7_560_100, currency: 'USD' },
  timeline: { months: 4, path: 'as_of_right' },
}

describe('buildNarrative', () => {
  it('states the verdict and the total cost', () => {
    const f: Feasibility = { overall: 'AS_OF_RIGHT', checks: [], path: 'as_of_right' }
    const text = buildNarrative(parcel, project, f, cost)
    expect(text).toMatch(/as-of-right/i)
    expect(text).toContain('$7,560,100')
  })

  it('names blocking constraints when relief is needed', () => {
    const f: Feasibility = {
      overall: 'NEEDS_RELIEF',
      path: 'variance',
      checks: [{ dimension: 'far', status: 'NEEDS_RELIEF', proposed: 'FAR 3.00', allowed: 'max FAR 2.00', note: null }],
    }
    const text = buildNarrative(parcel, project, f, { ...cost, timeline: { months: 12, path: 'variance' } })
    expect(text).toMatch(/relief/i)
    expect(text).toContain('far')
  })

  it('calls out indeterminate dimensions', () => {
    const f: Feasibility = {
      overall: 'INDETERMINATE',
      path: 'as_of_right',
      checks: [{ dimension: 'height', status: 'INDETERMINATE', proposed: 'unspecified', allowed: 'not derivable', note: null }],
    }
    const text = buildNarrative(parcel, project, f, cost)
    expect(text).toMatch(/could not be evaluated/i)
    expect(text).toContain('height')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run netlify/functions/lib/narrative.test.ts`
Expected: FAIL — cannot resolve `./narrative`.

- [ ] **Step 3: Create `netlify/functions/lib/narrative.ts`**

```ts
import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput, CheckStatus } from '../../../src/types/analysis'
import type { Feasibility } from './feasibility'
import type { CostEstimate } from './cost'

const usd = (n: number) => `$${n.toLocaleString('en-US')}`

const VERDICT_LEAD: Record<CheckStatus, string> = {
  AS_OF_RIGHT: 'appears buildable as-of-right',
  NEEDS_RELIEF: 'would require zoning relief',
  PROHIBITED: 'appears to be prohibited',
  INDETERMINATE: 'cannot be fully determined from available data',
}

export function buildNarrative(parcel: ParcelInfo, project: AnalysisInput, f: Feasibility, c: CostEstimate): string {
  const lead = `A ${project.gfa.toLocaleString()} sf ${project.use} project at ${parcel.address} (district ${parcel.zoning.districtCode}) ${VERDICT_LEAD[f.overall]}.`

  const blockers = f.checks.filter((ch) => ch.status === 'NEEDS_RELIEF' || ch.status === 'PROHIBITED')
  const reason = blockers.length
    ? ` Constraints: ${blockers.map((b) => `${b.dimension} (${b.proposed} vs ${b.allowed})`).join('; ')}.`
    : ''

  const unknowns = f.checks.filter((ch) => ch.status === 'INDETERMINATE').map((ch) => ch.dimension)
  const caveat = unknowns.length
    ? ` The following could not be evaluated and are treated conservatively: ${unknowns.join(', ')}.`
    : ''

  const cost = ` Estimated cost is ${usd(c.costs.total)} (hard ${usd(c.costs.hard)}, soft ${usd(c.costs.soft)}, permitting ${usd(c.costs.permit)}), with an approval timeline of roughly ${c.timeline.months} months on the ${c.timeline.path.replace(/_/g, '-')} path.`

  return lead + reason + caveat + cost
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run netlify/functions/lib/narrative.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/lib/narrative.ts netlify/functions/lib/narrative.test.ts
git commit -m "Add templated analysis narrative (LLM seam)"
```

---

## Task 8: `analyze.ts` engine handler

Wires validation → `getParcelInfo` → feasibility → cost → narrative into the `AnalysisResult` contract.

**Files:**
- Modify: `netlify/functions/analyze.ts` (replaces the stub)
- Test: `netlify/functions/lib/analyze.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handler } from '../analyze'

const call = (qs: Record<string, string> = {}) =>
  handler({ queryStringParameters: qs } as unknown as Parameters<typeof handler>[0])

const baseParams = { lat: '42.3601', lng: '-71.0589', use: 'commercial', gfa: '15000', heightFt: '50' }

const mockParcel = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url)
    if (u.includes('Zoning')) return new Response(JSON.stringify({ features: [{ attributes: { Name: 'B-2-65' } }] }))
    if (u.includes('BPDA_Parcels')) return new Response(JSON.stringify({ features: [{ attributes: { pid: '99', full_addre: '1 Test St', lot_size: 10000 } }] }))
    return new Response(JSON.stringify({ features: [] }))
  })

describe('analyze handler', () => {
  afterEach(() => vi.restoreAllMocks())

  describe('validation', () => {
    beforeEach(() => mockParcel())
    it('rejects out-of-bbox coords with 400 OUT_OF_BBOX', async () => {
      const res = await call({ ...baseParams, lat: '38.89', lng: '-77.03' })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).code).toBe('OUT_OF_BBOX')
    })
    it('rejects missing gfa with 400 BAD_INPUT', async () => {
      const res = await call({ lat: baseParams.lat, lng: baseParams.lng, use: 'commercial' })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).code).toBe('BAD_INPUT')
    })
    it('rejects an unknown use with 400 BAD_INPUT', async () => {
      const res = await call({ ...baseParams, use: 'spaceport' })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).code).toBe('BAD_INPUT')
    })
  })

  describe('success', () => {
    beforeEach(() => mockParcel())
    it('returns 200 AS_OF_RIGHT with costs and narrative', async () => {
      const res = await call(baseParams)
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.feasibility.overall).toBe('AS_OF_RIGHT')
      expect(body.costs.total).toBeGreaterThan(0)
      expect(typeof body.narrative).toBe('string')
      expect(body.parcel.districtCode).toBe('B-2-65')
      expect(body.disclaimers.length).toBeGreaterThan(0)
    })
    it('returns NEEDS_RELIEF when the project exceeds FAR', async () => {
      const res = await call({ ...baseParams, gfa: '40000' })
      expect(JSON.parse(res.body).feasibility.overall).toBe('NEEDS_RELIEF')
    })
  })

  describe('parcel failures propagate', () => {
    it('returns 502 when zoning upstream rejects', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).includes('Zoning')) throw new Error('down')
        return new Response(JSON.stringify({ features: [{ attributes: { pid: '1', full_addre: 'x' } }] }))
      })
      const res = await call(baseParams)
      expect(res.statusCode).toBe(502)
      expect(JSON.parse(res.body).code).toBe('UPSTREAM_ERROR')
    })
    it('returns 404 when no parcel at the point', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).includes('Zoning')) return new Response(JSON.stringify({ features: [{ attributes: { Name: 'B-2-65' } }] }))
        return new Response(JSON.stringify({ features: [] }))
      })
      const res = await call(baseParams)
      expect(res.statusCode).toBe(404)
      expect(JSON.parse(res.body).code).toBe('NO_PARCEL')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run netlify/functions/lib/analyze.test.ts`
Expected: FAIL — handler is still the stub (no `feasibility` field).

- [ ] **Step 3: Replace `netlify/functions/analyze.ts`**

```ts
import type { Handler, HandlerEvent } from '@netlify/functions'
import { isInBostonBbox } from '../../src/types/parcel'
import type { AnalysisError, AnalysisInput, AnalysisResult, Use } from '../../src/types/analysis'
import { USES } from '../../src/types/analysis'
import { getParcelInfo } from './lib/parcel'
import { assessFeasibility } from './lib/feasibility'
import { estimateCost } from './lib/cost'
import { buildNarrative } from './lib/narrative'
import { assumptionsSummary } from './lib/assumptions'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

const DISCLAIMERS = [
  'Estimates only — not legal, engineering, or financial advice.',
  'Verify zoning, fees, and permitting with the City of Boston before relying on these figures.',
]

const fail = (code: AnalysisError['code'], message: string, status: number) => ({
  statusCode: status,
  headers: JSON_HEADERS,
  body: JSON.stringify({ code, message } satisfies AnalysisError),
})

const num = (v: string | undefined): number | undefined => {
  if (v == null) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

export const handler: Handler = async (event: HandlerEvent) => {
  const q = event.queryStringParameters ?? {}
  const lat = Number(q.lat)
  const lng = Number(q.lng)
  const use = q.use as Use
  const gfa = Number(q.gfa)

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isInBostonBbox(lat, lng)) {
    return fail('OUT_OF_BBOX', 'lat/lng missing, invalid, or outside Boston bbox.', 400)
  }
  if (!USES.includes(use) || !Number.isFinite(gfa) || gfa <= 0) {
    return fail('BAD_INPUT', 'Missing or invalid project inputs (use, gfa).', 400)
  }

  const parcelResult = await getParcelInfo(lat, lng)
  if (!parcelResult.ok) {
    return fail(parcelResult.code, parcelResult.message, parcelResult.status)
  }
  const parcel = parcelResult.info

  const project: AnalysisInput = {
    parcelId: parcel.parcelId,
    lat,
    lng,
    use,
    gfa,
    units: num(q.units),
    stories: num(q.stories),
    heightFt: num(q.heightFt),
  }

  const feasibility = assessFeasibility(parcel, project)
  const estimate = estimateCost(project, feasibility)
  const narrative = buildNarrative(parcel, project, feasibility, estimate)

  const result: AnalysisResult = {
    parcel: { address: parcel.address, parcelId: parcel.parcelId, districtCode: parcel.zoning.districtCode },
    project,
    feasibility: { overall: feasibility.overall, checks: feasibility.checks },
    costs: estimate.costs,
    timeline: estimate.timeline,
    narrative,
    assumptions: assumptionsSummary(),
    disclaimers: DISCLAIMERS,
    generatedAt: new Date().toISOString(),
  }

  return {
    statusCode: 200,
    headers: { ...JSON_HEADERS, 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    body: JSON.stringify(result),
  }
}
```

- [ ] **Step 4: Run the full backend suite**

Run: `npm test`
Expected: PASS — all suites green (parcel 8 + assumptions 5 + zoningLimits 5 + feasibility 7 + cost 4 + narrative 3 + analyze 7).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc -b && npx eslint .`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/analyze.ts netlify/functions/lib/analyze.test.ts
git commit -m "Implement analyze engine handler"
```

---

## Task 9: `useAnalysis` hook

Fetch + state for `/api/analyze`, mirroring `useParcelInfo` (keyed result, derived idle/loading, no synchronous setState in effect — required for the `react-hooks/set-state-in-effect` lint rule).

**Files:**
- Create: `src/hooks/useAnalysis.ts`

No unit test (thin fetch wrapper; the handler tests cover the contract — consistent with the dashboard spec's stance on `useParcelInfo`).

- [ ] **Step 1: Create `src/hooks/useAnalysis.ts`**

```ts
import { useEffect, useState } from 'react'
import type { AnalysisResult, AnalysisError, AnalysisInput } from '../types/analysis'

type Resolved =
  | { status: 'loaded'; data: AnalysisResult }
  | { status: 'error'; error: AnalysisError }

type State = { status: 'idle' } | { status: 'loading' } | Resolved

function toQuery(input: AnalysisInput): string {
  const p = new URLSearchParams()
  p.set('lat', String(input.lat))
  p.set('lng', String(input.lng))
  p.set('parcelId', input.parcelId)
  p.set('use', input.use)
  p.set('gfa', String(input.gfa))
  if (input.units != null) p.set('units', String(input.units))
  if (input.stories != null) p.set('stories', String(input.stories))
  if (input.heightFt != null) p.set('heightFt', String(input.heightFt))
  return p.toString()
}

export function useAnalysis(input: AnalysisInput | null): State & { retry: () => void } {
  const [retryCount, setRetryCount] = useState(0)
  const [result, setResult] = useState<{ key: string; value: Resolved } | null>(null)

  const qs = input ? toQuery(input) : null
  const key = qs ? `${qs},${retryCount}` : null

  useEffect(() => {
    if (key === null || qs === null) return
    let cancelled = false
    fetch(`/api/analyze?${qs}`)
      .then(async (res) => {
        const body = await res.json()
        if (cancelled) return
        setResult({
          key,
          value: res.ok
            ? { status: 'loaded', data: body as AnalysisResult }
            : { status: 'error', error: body as AnalysisError },
        })
      })
      .catch((err) => {
        if (cancelled) return
        setResult({
          key,
          value: {
            status: 'error',
            error: { code: 'INTERNAL', message: err instanceof Error ? err.message : 'Network error' },
          },
        })
      })
    return () => {
      cancelled = true
    }
  }, [key, qs])

  let state: State
  if (key === null) state = { status: 'idle' }
  else if (result?.key === key) state = result.value
  else state = { status: 'loading' }

  return { ...state, retry: () => setRetryCount((n) => n + 1) }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc -b && npx eslint .`
Expected: both clean (in particular no `react-hooks/set-state-in-effect` error — setState only runs in async callbacks).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAnalysis.ts
git commit -m "Add useAnalysis hook"
```

---

## Task 10: Wizard step components

Presentational, controlled step components. No internal state — the parent owns the form values.

**Files:**
- Create: `src/components/boston/wizard/WizardProgress.tsx`
- Create: `src/components/boston/wizard/ParcelContextHeader.tsx`
- Create: `src/components/boston/wizard/StepUse.tsx`
- Create: `src/components/boston/wizard/StepSize.tsx`
- Create: `src/components/boston/wizard/StepHeight.tsx`

- [ ] **Step 1: Create `WizardProgress.tsx`**

```tsx
interface Props {
  step: number // 1-based
  total: number
}

export function WizardProgress({ step, total }: Props) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-piranha-burgundy' : 'bg-piranha-charcoal/15'}`}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `ParcelContextHeader.tsx`**

```tsx
import type { ParcelInfo } from '../../../types/parcel'

interface Props {
  status: 'loading' | 'loaded' | 'error'
  parcel?: ParcelInfo
}

export function ParcelContextHeader({ status, parcel }: Props) {
  if (status === 'loading') {
    return <div className="h-6 w-64 animate-pulse rounded bg-piranha-charcoal/10" />
  }
  if (status === 'error' || !parcel) {
    return <p className="text-sm text-piranha-charcoal/70">Parcel details unavailable — analysis uses the selected location.</p>
  }
  return (
    <div className="text-sm text-piranha-charcoal/80">
      Analyzing <span className="font-semibold text-piranha-charcoal">{parcel.address}</span>{' '}
      <span className="text-piranha-charcoal/60">· district {parcel.zoning.districtCode}</span>
    </div>
  )
}
```

- [ ] **Step 3: Create `StepUse.tsx`**

```tsx
import type { Use } from '../../../types/analysis'

interface Props {
  value: Use | null
  onChange: (use: Use) => void
}

const OPTIONS: { value: Use; label: string; hint: string }[] = [
  { value: 'residential', label: 'Residential', hint: 'Housing — apartments, condos, multifamily' },
  { value: 'commercial', label: 'Commercial', hint: 'Retail, office, hospitality' },
  { value: 'mixed', label: 'Mixed-use', hint: 'Residential over ground-floor commercial' },
  { value: 'institutional', label: 'Institutional', hint: 'Civic, educational, healthcare' },
]

export function StepUse({ value, onChange }: Props) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-serif text-2xl tracking-tight">What kind of project?</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-lg border p-4 text-left transition-colors ${
              value === o.value
                ? 'border-piranha-burgundy bg-piranha-burgundy/5'
                : 'border-piranha-charcoal/15 hover:border-piranha-charcoal/40'
            }`}
          >
            <span className="block font-semibold text-piranha-charcoal">{o.label}</span>
            <span className="block text-sm text-piranha-charcoal/60">{o.hint}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 4: Create `StepSize.tsx`**

```tsx
import type { Use } from '../../../types/analysis'

interface Props {
  use: Use | null
  gfa: string
  units: string
  onGfa: (v: string) => void
  onUnits: (v: string) => void
}

const inputClass =
  'w-full rounded-md border border-piranha-charcoal/20 bg-white px-3 py-2 text-piranha-charcoal focus:border-piranha-burgundy focus:outline-none'

export function StepSize({ use, gfa, units, onGfa, onUnits }: Props) {
  const showUnits = use === 'residential' || use === 'mixed'
  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl tracking-tight">How big?</h2>
      <label className="block space-y-1">
        <span className="text-sm font-medium text-piranha-charcoal">Gross floor area (sq ft)</span>
        <input type="number" inputMode="numeric" min={1} value={gfa} onChange={(e) => onGfa(e.target.value)} className={inputClass} placeholder="e.g. 15000" />
      </label>
      {showUnits && (
        <label className="block space-y-1">
          <span className="text-sm font-medium text-piranha-charcoal">Number of units (optional)</span>
          <input type="number" inputMode="numeric" min={0} value={units} onChange={(e) => onUnits(e.target.value)} className={inputClass} placeholder="e.g. 12" />
        </label>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create `StepHeight.tsx`**

```tsx
interface Props {
  stories: string
  heightFt: string
  onStories: (v: string) => void
  onHeight: (v: string) => void
}

const inputClass =
  'w-full rounded-md border border-piranha-charcoal/20 bg-white px-3 py-2 text-piranha-charcoal focus:border-piranha-burgundy focus:outline-none'

export function StepHeight({ stories, heightFt, onStories, onHeight }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl tracking-tight">How tall?</h2>
      <p className="text-sm text-piranha-charcoal/60">Enter height in feet, or stories, or both. Feet is used when provided.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-piranha-charcoal">Height (ft)</span>
          <input type="number" inputMode="numeric" min={0} value={heightFt} onChange={(e) => onHeight(e.target.value)} className={inputClass} placeholder="e.g. 55" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-piranha-charcoal">Stories</span>
          <input type="number" inputMode="numeric" min={0} value={stories} onChange={(e) => onStories(e.target.value)} className={inputClass} placeholder="e.g. 5" />
        </label>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc -b && npx eslint .`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/boston/wizard/
git commit -m "Add wizard step components"
```

## Task 11: `BostonWizard` orchestration

Owns the form state and step flow. Reads `parcelId`/`lat`/`lng` from the URL (set by the dashboard's "Analyze" link → `/boston/start?parcelId=…&lat=…&lng=…`). Shows the parcel context header via `useParcelInfo`. On submit, navigates to `/boston/result?…` with every input as a query param (Approach A — the result page runs the engine).

**Files:**
- Modify (replace stub): `src/routes/BostonWizard.tsx`

- [ ] **Step 1: Replace `src/routes/BostonWizard.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { useParcelInfo } from '../hooks/useParcelInfo'
import type { Use } from '../types/analysis'
import { WizardProgress } from '../components/boston/wizard/WizardProgress'
import { ParcelContextHeader } from '../components/boston/wizard/ParcelContextHeader'
import { StepUse } from '../components/boston/wizard/StepUse'
import { StepSize } from '../components/boston/wizard/StepSize'
import { StepHeight } from '../components/boston/wizard/StepHeight'

const TOTAL_STEPS = 3

export default function BostonWizard() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const parcelId = params.get('parcelId') ?? ''
  const lat = Number(params.get('lat'))
  const lng = Number(params.get('lng'))
  const hasLocation = parcelId !== '' && Number.isFinite(lat) && Number.isFinite(lng)

  const parcelArgs = useMemo(
    () => (hasLocation ? { lat, lng } : null),
    [hasLocation, lat, lng],
  )
  const parcelState = useParcelInfo(parcelArgs)

  const [step, setStep] = useState(1)
  const [use, setUse] = useState<Use | null>(null)
  const [gfa, setGfa] = useState('')
  const [units, setUnits] = useState('')
  const [stories, setStories] = useState('')
  const [heightFt, setHeightFt] = useState('')

  if (!hasLocation) {
    return (
      <PageContainer>
        <h1 className="font-serif text-4xl tracking-tight">Start an analysis</h1>
        <p className="mt-4 text-piranha-charcoal/70">
          Pick a parcel from the{' '}
          <a className="text-piranha-burgundy underline" href="/boston">
            Boston map
          </a>{' '}
          to begin — we need a location to analyze.
        </p>
      </PageContainer>
    )
  }

  const gfaNum = Number(gfa)
  const canAdvanceUse = use !== null
  const canAdvanceSize = gfa !== '' && Number.isFinite(gfaNum) && gfaNum > 0
  const canSubmit = heightFt !== '' || stories !== ''

  function goResult() {
    const p = new URLSearchParams()
    p.set('parcelId', parcelId)
    p.set('lat', String(lat))
    p.set('lng', String(lng))
    p.set('use', use as Use)
    p.set('gfa', String(gfaNum))
    if (units !== '') p.set('units', String(Number(units)))
    if (stories !== '') p.set('stories', String(Number(stories)))
    if (heightFt !== '') p.set('heightFt', String(Number(heightFt)))
    navigate(`/boston/result?${p.toString()}`)
  }

  const parcelStatus =
    parcelState.status === 'loaded'
      ? 'loaded'
      : parcelState.status === 'error'
        ? 'error'
        : 'loading'

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl space-y-6">
        <ParcelContextHeader
          status={parcelStatus}
          parcel={parcelState.status === 'loaded' ? parcelState.data : undefined}
        />
        <WizardProgress step={step} total={TOTAL_STEPS} />

        {step === 1 && <StepUse value={use} onChange={(u) => setUse(u)} />}
        {step === 2 && (
          <StepSize use={use} gfa={gfa} units={units} onGfa={setGfa} onUnits={setUnits} />
        )}
        {step === 3 && (
          <StepHeight
            stories={stories}
            heightFt={heightFt}
            onStories={setStories}
            onHeight={setHeightFt}
          />
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="rounded-md px-4 py-2 text-piranha-charcoal/70 disabled:opacity-40"
          >
            Back
          </button>
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 ? !canAdvanceUse : !canAdvanceSize}
              className="rounded-md bg-piranha-burgundy px-5 py-2 font-medium text-piranha-bone disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={goResult}
              disabled={!canSubmit}
              className="rounded-md bg-piranha-burgundy px-5 py-2 font-medium text-piranha-bone disabled:opacity-40"
            >
              Analyze
            </button>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc -b && npx eslint .`
Expected: both clean.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, open `/boston`, click a parcel inside Boston, click "Analyze". Confirm the wizard loads with the parcel address in the header, you can pick a use → size → height, and "Analyze" navigates to `/boston/result?…` with the params in the URL.

- [ ] **Step 4: Commit**

```bash
git add src/routes/BostonWizard.tsx
git commit -m "Wire BostonWizard orchestration"
```

---

## Task 12: Result components

Presentational components that render an `AnalysisResult`. No fetching, no state — pure rendering from props.

**Files:**
- Create: `src/components/boston/result/VerdictBanner.tsx`
- Create: `src/components/boston/result/FeasibilityChecklist.tsx`
- Create: `src/components/boston/result/CostBreakdown.tsx`
- Create: `src/components/boston/result/Timeline.tsx`
- Create: `src/components/boston/result/NarrativeSection.tsx`
- Create: `src/components/boston/result/AssumptionsDisclosure.tsx`

- [ ] **Step 1: Create `VerdictBanner.tsx`**

```tsx
import type { CheckStatus } from '../../../types/analysis'

const COPY: Record<CheckStatus, { label: string; sub: string; cls: string }> = {
  AS_OF_RIGHT: {
    label: 'Likely buildable as-of-right',
    sub: 'The proposal appears to fit the zoning envelope without discretionary relief.',
    cls: 'bg-emerald-50 border-emerald-600/30 text-emerald-900',
  },
  NEEDS_RELIEF: {
    label: 'Buildable with zoning relief',
    sub: 'The proposal exceeds at least one limit and would require a variance or other approval.',
    cls: 'bg-amber-50 border-amber-600/30 text-amber-900',
  },
  PROHIBITED: {
    label: 'Not permitted as proposed',
    sub: 'The use or scale conflicts with the district in a way relief is unlikely to cure.',
    cls: 'bg-rose-50 border-rose-600/30 text-rose-900',
  },
  INDETERMINATE: {
    label: 'Indeterminate from available data',
    sub: 'Public data did not provide the limits needed to judge one or more dimensions.',
    cls: 'bg-piranha-charcoal/5 border-piranha-charcoal/20 text-piranha-charcoal',
  },
}

export function VerdictBanner({ overall }: { overall: CheckStatus }) {
  const c = COPY[overall]
  return (
    <div className={`rounded-xl border p-5 ${c.cls}`}>
      <h2 className="font-serif text-2xl tracking-tight">{c.label}</h2>
      <p className="mt-1 text-sm opacity-90">{c.sub}</p>
    </div>
  )
}
```

- [ ] **Step 2: Create `FeasibilityChecklist.tsx`**

```tsx
import type { FeasibilityCheck, CheckStatus } from '../../../types/analysis'

const DOT: Record<CheckStatus, string> = {
  AS_OF_RIGHT: 'bg-emerald-500',
  NEEDS_RELIEF: 'bg-amber-500',
  PROHIBITED: 'bg-rose-500',
  INDETERMINATE: 'bg-piranha-charcoal/30',
}

const DIMENSION_LABEL: Record<FeasibilityCheck['dimension'], string> = {
  use: 'Use',
  far: 'Floor-area ratio',
  height: 'Height',
}

export function FeasibilityChecklist({ checks }: { checks: FeasibilityCheck[] }) {
  return (
    <section className="space-y-3">
      <h3 className="font-serif text-xl tracking-tight">How we got there</h3>
      <ul className="divide-y divide-piranha-charcoal/10 rounded-lg border border-piranha-charcoal/10">
        {checks.map((c) => (
          <li key={c.dimension} className="flex gap-3 p-4">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[c.status]}`} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold text-piranha-charcoal">{DIMENSION_LABEL[c.dimension]}</span>
                <span className="text-sm text-piranha-charcoal/60">
                  proposed {c.proposed} · allowed {c.allowed}
                </span>
              </div>
              {c.note && <p className="mt-1 text-sm text-piranha-charcoal/70">{c.note}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 3: Create `CostBreakdown.tsx`**

```tsx
import type { AnalysisResult } from '../../../types/analysis'

function usd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function CostBreakdown({ costs }: { costs: AnalysisResult['costs'] }) {
  const rows: { label: string; value: number }[] = [
    { label: 'Construction (hard)', value: costs.hard },
    { label: 'Soft costs', value: costs.soft },
    { label: 'Permitting & approvals', value: costs.permit },
  ]
  return (
    <section className="space-y-3">
      <h3 className="font-serif text-xl tracking-tight">Estimated cost</h3>
      <dl className="rounded-lg border border-piranha-charcoal/10">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between border-b border-piranha-charcoal/10 px-4 py-3 last:border-0">
            <dt className="text-piranha-charcoal/70">{r.label}</dt>
            <dd className="font-medium text-piranha-charcoal tabular-nums">{usd(r.value)}</dd>
          </div>
        ))}
        <div className="flex justify-between bg-piranha-charcoal/5 px-4 py-3">
          <dt className="font-semibold text-piranha-charcoal">Total</dt>
          <dd className="font-semibold text-piranha-charcoal tabular-nums">{usd(costs.total)}</dd>
        </div>
      </dl>
    </section>
  )
}
```

- [ ] **Step 4: Create `Timeline.tsx`**

```tsx
import type { AnalysisResult } from '../../../types/analysis'

const PATH_LABEL: Record<AnalysisResult['timeline']['path'], string> = {
  as_of_right: 'As-of-right permitting',
  variance: 'Variance / discretionary approval',
  prohibited: 'No viable approval path',
}

export function Timeline({ timeline }: { timeline: AnalysisResult['timeline'] }) {
  return (
    <section className="space-y-2">
      <h3 className="font-serif text-xl tracking-tight">Time to approval</h3>
      <p className="text-piranha-charcoal/80">
        <span className="text-2xl font-semibold text-piranha-charcoal">
          {timeline.months > 0 ? `~${timeline.months} months` : 'N/A'}
        </span>
        <span className="ml-2 text-sm text-piranha-charcoal/60">{PATH_LABEL[timeline.path]}</span>
      </p>
    </section>
  )
}
```

- [ ] **Step 5: Create `NarrativeSection.tsx`**

```tsx
export function NarrativeSection({ narrative }: { narrative: string }) {
  return (
    <section className="space-y-2">
      <h3 className="font-serif text-xl tracking-tight">Summary</h3>
      <p className="whitespace-pre-line leading-relaxed text-piranha-charcoal/85">{narrative}</p>
    </section>
  )
}
```

- [ ] **Step 6: Create `AssumptionsDisclosure.tsx`**

```tsx
export function AssumptionsDisclosure({ assumptions }: { assumptions: Record<string, string> }) {
  const entries = Object.entries(assumptions)
  if (entries.length === 0) return null
  return (
    <details className="rounded-lg border border-piranha-charcoal/10 p-4">
      <summary className="cursor-pointer font-medium text-piranha-charcoal">Assumptions used</summary>
      <dl className="mt-3 space-y-2 text-sm">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-piranha-charcoal/60">{k}</dt>
            <dd className="text-right text-piranha-charcoal/85">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}
```

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc -b && npx eslint .`
Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/boston/result/
git commit -m "Add result presentation components"
```

---

## Task 13: `BostonResult` route

Parses the analysis inputs from the URL, runs the engine via `useAnalysis`, and composes the result components. Handles idle/loading/error and renders disclaimers. Approach A: this page is the shareable, re-runnable analysis URL.

**Files:**
- Modify (replace stub): `src/routes/BostonResult.tsx`

- [ ] **Step 1: Replace `src/routes/BostonResult.tsx`**

```tsx
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageContainer } from '../components/PageContainer'
import { useAnalysis } from '../hooks/useAnalysis'
import { USES, type AnalysisInput, type Use } from '../types/analysis'
import { VerdictBanner } from '../components/boston/result/VerdictBanner'
import { FeasibilityChecklist } from '../components/boston/result/FeasibilityChecklist'
import { CostBreakdown } from '../components/boston/result/CostBreakdown'
import { Timeline } from '../components/boston/result/Timeline'
import { NarrativeSection } from '../components/boston/result/NarrativeSection'
import { AssumptionsDisclosure } from '../components/boston/result/AssumptionsDisclosure'

function parseInput(params: URLSearchParams): AnalysisInput | null {
  const parcelId = params.get('parcelId') ?? ''
  const lat = Number(params.get('lat'))
  const lng = Number(params.get('lng'))
  const use = params.get('use') as Use | null
  const gfa = Number(params.get('gfa'))
  if (parcelId === '' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (use === null || !USES.includes(use)) return null
  if (!Number.isFinite(gfa) || gfa <= 0) return null

  const num = (k: string): number | undefined => {
    const raw = params.get(k)
    if (raw === null || raw === '') return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }
  return { parcelId, lat, lng, use, gfa, units: num('units'), stories: num('stories'), heightFt: num('heightFt') }
}

export default function BostonResult() {
  const [params] = useSearchParams()
  const input = useMemo(() => parseInput(params), [params])
  const state = useAnalysis(input)

  if (input === null) {
    return (
      <PageContainer>
        <h1 className="font-serif text-4xl tracking-tight">Analysis</h1>
        <p className="mt-4 text-piranha-charcoal/70">
          This link is missing the project details.{' '}
          <Link className="text-piranha-burgundy underline" to="/boston">
            Start from the map
          </Link>
          .
        </p>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl space-y-8 pb-16">
        {state.status === 'loading' && (
          <div className="space-y-4">
            <div className="h-24 animate-pulse rounded-xl bg-piranha-charcoal/10" />
            <div className="h-40 animate-pulse rounded-lg bg-piranha-charcoal/5" />
          </div>
        )}

        {state.status === 'error' && (
          <div className="space-y-4 rounded-xl border border-rose-600/30 bg-rose-50 p-5">
            <h2 className="font-serif text-2xl tracking-tight text-rose-900">Couldn’t run the analysis</h2>
            <p className="text-sm text-rose-900/80">{state.error.message}</p>
            <button
              type="button"
              onClick={state.retry}
              className="rounded-md bg-piranha-burgundy px-4 py-2 text-sm font-medium text-piranha-bone"
            >
              Try again
            </button>
          </div>
        )}

        {state.status === 'loaded' && (
          <>
            <header className="space-y-1">
              <h1 className="font-serif text-3xl tracking-tight">{state.data.parcel.address}</h1>
              <p className="text-sm text-piranha-charcoal/60">
                Parcel {state.data.parcel.parcelId} · district {state.data.parcel.districtCode}
              </p>
            </header>
            <VerdictBanner overall={state.data.feasibility.overall} />
            <NarrativeSection narrative={state.data.narrative} />
            <FeasibilityChecklist checks={state.data.feasibility.checks} />
            <CostBreakdown costs={state.data.costs} />
            <Timeline timeline={state.data.timeline} />
            <AssumptionsDisclosure assumptions={state.data.assumptions} />
            {state.data.disclaimers.length > 0 && (
              <footer className="space-y-1 border-t border-piranha-charcoal/10 pt-4 text-xs text-piranha-charcoal/55">
                {state.data.disclaimers.map((d, i) => (
                  <p key={i}>{d}</p>
                ))}
              </footer>
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc -b && npx eslint .`
Expected: both clean (no `react-hooks/set-state-in-effect` — `useAnalysis` owns all effects).

- [ ] **Step 3: Commit**

```bash
git add src/routes/BostonResult.tsx
git commit -m "Wire BostonResult route"
```

---

## Task 14: Final verification

End-to-end check of the whole feature: build, lint, full test suite, the Netlify function-name warning, and a manual click-through.

**Files:** none (verification only).

- [ ] **Step 1: Full static checks**

Run: `npx tsc -b && npx eslint . && npm run build`
Expected: all three clean. `dist/` is produced.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the relocated `lib/parcel.test.ts` and the new engine tests (`lib/assumptions.test.ts`, `lib/zoningLimits.test.ts`, `lib/feasibility.test.ts`, `lib/cost.test.ts`, `lib/narrative.test.ts`).

- [ ] **Step 3: Confirm the Netlify function-name warning is gone**

Run: `npx netlify dev` (or `npm run dev` if that wraps it).
Expected: startup logs list `parcel` and `analyze` as functions, with NO "invalid function name" warning for `parcel.test` (tests now live under `lib/`, which Netlify does not treat as a deployable function).

- [ ] **Step 4: Manual end-to-end click-through**

With the dev server running:
1. Open `/boston`, search or click a parcel inside Boston → parcel panel loads.
2. Click "Analyze" → wizard at `/boston/start?parcelId=…` shows the parcel address in the header.
3. Pick a use, enter GFA (and units if residential/mixed), enter height or stories, click "Analyze".
4. Land on `/boston/result?…` → verdict banner, narrative, feasibility checklist, cost breakdown, timeline, assumptions, disclaimers all render.
5. Edit a query param (e.g. bump `gfa`) and reload → analysis re-runs with the new value (confirms Approach A shareable URL).
6. Try an off-parcel / out-of-bbox location → result page shows the error state with a working "Try again".

- [ ] **Step 5: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "Finalize Boston analysis wizard"
```

If no fixes were needed, there is nothing to commit — proceed to finishing the branch.

---

## Done

After Task 14, all spec requirements are implemented and verified. Use **superpowers:finishing-a-development-branch** to verify tests, present merge/PR options, and complete the work.
