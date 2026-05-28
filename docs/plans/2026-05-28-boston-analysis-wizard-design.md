# Boston Analysis Wizard — Design

**Date**: 2026-05-28
**Status**: Approved (brainstorm)
**Next**: Implementation plan via `writing-plans` skill
**Builds on**: `2026-05-28-boston-dashboard-design.md` (the dashboard hands off to this wizard)

## Goal

Turn the `/boston/start` and `/boston/result` placeholder routes into the
"full analysis" the dashboard CTA promises. A user arrives from the
dashboard with a chosen parcel, describes a proposed project, and gets:

1. **Can I build this here?** — a feasibility verdict.
2. **If not, why?** — which regulation blocks it.
3. **If so, what does it cost and why?** — a development budget across
   four cost dimensions: permitting/approval, hard (construction), soft
   (professional services), and time.

The analysis is decision-support, not legal/financial advice. Every
number is a labeled, tunable estimate and the UI says so.

## Decisions locked during brainstorm

| Question | Decision |
|----------|----------|
| Core job | "Can I build X — if not why, if so how much and why." |
| Cost dimensions | All four: permit, hard, soft, time. |
| Engine | **Hybrid**: zoning math for feasibility, curated assumptions table for cost/time, LLM for narrative. |
| Input depth | **Moderate** (~3 steps): use type, size (GFA / units), height. |
| LLM rollout | **Wired but off** — runs with templated prose until an API key is added; no spend required now. |
| Wiring | **Approach A** — wizard collects inputs, result page calls the engine. Shareable/reproducible result URL. |

## Approach

**Hybrid engine, backend-mediated** (mirrors the dashboard's `parcel.ts`
façade). A Netlify function (`/api/analyze`) owns all rules, data, and
(future) LLM calls. React renders structured JSON and never sees zoning
math or cost schedules.

Alternatives considered and rejected:

- **LLM-only** — Claude produces verdict + costs from its own knowledge.
  Fastest, but figures are unverifiable and can hallucinate; unacceptable
  for a tool people make money decisions on.
- **Deterministic, no LLM ever** — encode every rule and schedule. Fully
  auditable but a large data effort and rigid prose. We keep the
  deterministic core and add the LLM as an *explanation* layer only, so
  numbers stay defensible while prose stays readable.

## Flow & routes

```
/boston  ──"Start full analysis"──▶  /boston/start  ──submit──▶  /boston/result
(dashboard)                          (BostonWizard)              (BostonResult)
parcelId,lat,lng in URL              + project inputs in URL     GET /api/analyze
                                     re-fetch /api/parcel        render verdict + costs
                                     (cache hit) for context
```

- **Wizard** (`/boston/start`) reads `parcelId/lat/lng` from the query
  string (set by the dashboard CTA). It re-fetches `/api/parcel` (edge
  cache hit) only to display *which parcel is being analyzed* as context
  at the top of the form. It then collects the project inputs and, on
  submit, navigates to the result URL with all params appended.
- **Result** (`/boston/result`) reads every parameter from the URL,
  calls `/api/analyze`, and renders. Because the engine is deterministic,
  the same URL always reproduces the same analysis — the result is
  shareable and bookmarkable (the "hand it to a client" property).

No cross-route React state. URL is the single source of truth, matching
the dashboard's stateless pattern.

## Wizard input (moderate)

Three linear steps with back/next and a progress indicator, then a
compact review line before submit:

1. **Use** — `residential | commercial | mixed | institutional`
   (radio cards).
2. **Size** — gross floor area (sqft, required); unit count (shown when
   use is residential or mixed).
3. **Height** — stories and/or feet.

No persistence across sessions. Inputs travel to the result page as query
params: `use, gfa, units?, stories?, heightFt?` (plus the inherited
`parcelId, lat, lng`).

## Backend `/api/analyze` (the engine)

`GET /api/analyze?parcelId=&lat=&lng=&use=&gfa=&units=&stories=&heightFt=`

1. **Validate** inputs (numeric sizes, known use, lat/lng in Boston
   bbox). Reject with a typed error otherwise.
2. **Get `ParcelInfo`** — refactor the parcel fetch/normalize logic out
   of `netlify/functions/parcel.ts` into a shared `lib/` module imported
   by both `parcel.ts` and `analyze.ts`. No duplicated ArcGIS query
   syntax.
3. **Feasibility** (`lib/feasibility.ts`, pure function): for each
   dimension produce a status:
   - **Use** — proposed use ∈ `zoning.allowedUses`?
   - **FAR** — proposed FAR = `gfa / lot.sizeSqFt`, compared to
     `zoning.maxFAR`.
   - **Height** — `heightFt` (or stories→feet estimate) vs
     `zoning.maxHeightFt`.

   Status enum per check: `AS_OF_RIGHT | NEEDS_RELIEF | PROHIBITED |
   INDETERMINATE`. `INDETERMINATE` when the underlying parcel field is
   `null` (data not derivable). **Overall verdict = worst-case** across
   checks.
4. **Cost & time** (`lib/cost.ts`, pure function) from
   `lib/assumptions.ts`:
   - `hard = gfa × costPerSqFt[use]`
   - `soft = hard × softCostPct`
   - `permit` = Boston permit-fee formula applied to construction value
     (≈ hard cost) plus flat filing fees.
   - `timeline.months` keyed by approval path (as-of-right vs.
     variance/relief). `NEEDS_RELIEF` lengthens the timeline and may add
     relief-filing cost.
   - `total = hard + soft + permit`.
5. **Narrative seam**: if `process.env.ANTHROPIC_API_KEY` is set, call
   Claude to write the "why" grounded in the already-computed structured
   numbers; otherwise emit deterministic templated prose. The structured
   result is identical either way — the LLM only rewrites the explanation.
   Off by default; no spend until a key is added.
6. Return `AnalysisResult` JSON.

### Contract

| Status | Body | Meaning |
|--------|------|---------|
| 200 | `AnalysisResult` | Success (including `INDETERMINATE` checks). |
| 400 | `AnalysisError(BAD_INPUT)` | Missing/invalid project params (bad use, non-numeric size, etc.). |
| 400 | `AnalysisError(OUT_OF_BBOX)` | lat/lng outside the Boston bbox. |
| 404 | `AnalysisError(NO_PARCEL)` | No parcel at the coordinates. |
| 502 | `AnalysisError(UPSTREAM_ERROR)` | Critical parcel dataset failed — cannot analyze. |
| 500 | `AnalysisError(INTERNAL)` | Unexpected error. |

## Assumptions table (`lib/assumptions.ts`)

A single committed, clearly-labeled module — the one place cost/time
estimates live:

- `costPerSqFtByUse: Record<Use, number>`
- `softCostPct: number`
- permit-fee constants (rate per $1,000 of construction value + flat
  fees)
- `timelineMonthsByPath: Record<ApprovalPath, number>`

**Every value carries a source comment and is an explicit seed ballpark.**
The result page always discloses these as assumptions. Tuning the model
later means editing this one file.

## Types (`src/types/analysis.ts`)

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
  proposed: string   // human-readable, e.g. "FAR 3.1"
  allowed: string    // e.g. "max FAR 2.0" or "not derivable"
  note: string | null
}

export interface AnalysisResult {
  parcel: { address: string; parcelId: string; districtCode: string }
  project: AnalysisInput
  feasibility: { overall: CheckStatus; checks: FeasibilityCheck[] }
  costs: { hard: number; soft: number; permit: number; total: number; currency: 'USD' }
  timeline: { months: number; path: ApprovalPath }
  narrative: string             // always populated — templated prose is the fallback when the LLM is off
  assumptions: Record<string, string>  // labeled seed values used
  disclaimers: string[]
  generatedAt: string           // ISO
}

export interface AnalysisError {
  code: 'BAD_INPUT' | 'NO_PARCEL' | 'OUT_OF_BBOX' | 'UPSTREAM_ERROR' | 'INTERNAL'
  message: string
}
```

## Frontend components

```
src/routes/BostonWizard.tsx          orchestrates steps + parcel context
src/routes/BostonResult.tsx          reads URL, renders AnalysisResult
src/components/boston/wizard/
  ├── ParcelContextHeader.tsx        "Analyzing: <address> (<district>)"
  ├── StepUse.tsx
  ├── StepSize.tsx
  ├── StepHeight.tsx
  └── WizardProgress.tsx
src/components/boston/result/
  ├── VerdictBanner.tsx              overall status, color-coded
  ├── FeasibilityChecklist.tsx       per-dimension checks
  ├── CostBreakdown.tsx              hard / soft / permit / total
  ├── Timeline.tsx                   months + approval path
  ├── NarrativeSection.tsx           the "why" prose
  └── AssumptionsDisclosure.tsx      collapsible seed assumptions + disclaimers
src/hooks/useAnalysis.ts             fetch + state for /api/analyze (mirrors useParcelInfo)
src/types/analysis.ts                shared types
netlify/functions/analyze.ts         replaces the stub — the engine
netlify/functions/lib/
  ├── parcel.ts                      shared getParcelInfo(lat,lng) (extracted)
  ├── feasibility.ts                 pure feasibility function
  ├── cost.ts                        pure cost/time function
  └── assumptions.ts                 seed estimate table
```

`useAnalysis` mirrors `useParcelInfo`: `idle | loading | loaded | error`
with `retry`. Result UI is brand-styled via the existing `PageContainer`.

## Error handling & UX states

| Where | Failure | What the user sees |
|-------|---------|--------------------|
| Result page | Missing/invalid params | Friendly error + "Back to dashboard." |
| Result page | `/api/parcel` re-fetch fails (404/502) | "Couldn't load parcel — cannot analyze," + Retry. |
| Feasibility | Parcel field `null` (e.g. `maxFAR`) | Check shown as `INDETERMINATE` — "not derivable from available data." Cost still estimated, flagged with a caveat. |
| Feasibility | Proposal exceeds a limit | `NEEDS_RELIEF` — names the relief (e.g. variance) and how it shifts timeline/cost. Proposal flatly disallowed → `PROHIBITED`. |
| Engine | Validation fails | `400 BAD_INPUT`, wizard surfaces the message. |
| Always | — | Persistent disclaimer: estimates only, not legal/financial advice, verify with the City of Boston. |

### Behavior we explicitly do NOT do
- No silent fabrication of missing zoning data — `INDETERMINATE` is shown
  honestly.
- No client-side caching across navigations (HTTP/edge cache only).
- No persisting projects across sessions.
- No spend by default — LLM stays off until a key is present.

## Testing & verification

### Automated — this work
- **Unit tests** for `lib/feasibility.ts` and `lib/cost.ts` (pure
  functions → highest value): as-of-right, needs-relief, prohibited,
  indeterminate, boundary cases.
- **Handler tests** for `analyze.ts` with mocked parcel fetch: input
  validation (400), as-of-right 200, needs-relief 200, indeterminate 200,
  parcel-fetch failure (502).
- **Netlify config fix**: exclude `*.test.ts` from deployable functions
  (resolves the existing `parcel.test` invalid-function-name warning, now
  that we add more `lib/*.test.ts`).

### Not worth writing
- React component snapshots (brittle — consistent with the dashboard
  spec's stance).
- `useAnalysis` tests (thin fetch wrapper; types + handler tests cover
  the contract).
- E2E — manual click-through for a one-developer MVP.

### Gates
- `npm run build` (`tsc -b && vite build`) clean.
- `npm run lint` clean.
- `npm test` green.

### Manual verification checklist
1. From `/boston`, select a parcel → "Start full analysis" → wizard shows
   the correct parcel context header.
2. Walk the 3 steps; review line reflects inputs; submit → `/boston/result`
   with all params in the URL.
3. Result renders verdict + 4-part cost breakdown + timeline + templated
   narrative + assumptions disclosure.
4. Reload the result URL → identical analysis (reproducible).
5. Propose something that exceeds `maxFAR`/`maxHeightFt` → `NEEDS_RELIEF`
   or `PROHIBITED` with a clear reason.
6. Choose a parcel whose `maxFAR` is `null` → `INDETERMINATE` shown
   honestly, cost still estimated with caveat.
7. Tamper with the URL (drop `gfa`) → `400 BAD_INPUT` handled gracefully.
8. Mobile width → wizard and result are usable.

## Open questions to resolve during build

1. **Seed cost values**: source defensible ballpark numbers for
   `costPerSqFt` by use, `softCostPct`, Boston permit-fee rate, and
   timeline months. They need only be reasonable and clearly labeled for
   the MVP; tune later in `assumptions.ts`.
2. **Allowed-uses matching**: `zoning.allowedUses` may be `null` or coarse
   (carried over from the dashboard's open question). When `null`, the use
   check is `INDETERMINATE` rather than a hard pass/fail.
3. **Stories→feet**: if the user gives stories but not feet, pick a
   per-story assumption (e.g. ~10–12 ft) in `assumptions.ts` and disclose
   it.

## Out of scope

- LLM narrative *content quality* tuning (the seam is built; prompt
  refinement is later, once a key exists).
- The `/ask` Q&A route (separate stub).
- Saved projects, authentication, multi-parcel comparison.
- Non-Boston jurisdictions.
- Sentry, analytics.
