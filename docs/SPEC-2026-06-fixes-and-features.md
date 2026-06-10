# Piranha Implementation Spec — Fix Everything, Then Build the Moat

Date: 2026-06-09. Companion to `docs/IMPROVEMENTS.md` (the audit that found
these). This document is written to be executed by Claude Code phase by
phase. Every work order (WO) is independently shippable and states its own
acceptance criteria. Line references were verified against the repo at commit
`39cc07d`.

---

## How to execute this spec

- Work phases **in order** (0 → 7). Within a phase, WOs are ordered by
  dependency; otherwise parallel-safe.
- **Definition of done for every WO:** `npx tsc -b` clean, `npx eslint .`
  clean, `npx vitest run` all green (including the new tests the WO
  requires), `npx vite build` succeeds. No WO is done without its tests.
- **Global invariants — never violate:**
  - Heuristics stay conservative: never broaden a block/trigger regex or
    threshold without a test proving a legitimate private parcel still passes.
  - `src/config/estimates.ts` remains the single source of truth for
    cost/timeline constants; the Methodology page derives from it. Any new
    constant goes there, not inline.
  - No secrets client-side except `VITE_MAPBOX_TOKEN`. New third-party
    origins require extending the CSP in `netlify.toml`.
  - `netlify/edge-functions/og.ts` string-matches tags in `index.html`; if
    either changes shape, update both and re-run the rewrite checks.
  - Public functions return generic error messages; detail goes to
    `console.log` as structured `{ event: '...' }` objects.
- When a WO says "decision point," implement the stated default unless the
  owner has said otherwise; note the decision in the commit message.

---

# PHASE 0 — CI and test scaffolding (prerequisite for everything)

### WO-0.1 GitHub Actions CI
**Problem:** No CI exists; nothing runs tests before deploy.
**Change:** Add `.github/workflows/ci.yml`: on push + PR → Node 20.20 (match
`netlify.toml` NODE_VERSION), `npm ci`, `npx tsc -b`, `npx eslint .`,
`npx vitest run`, `npx vite build`. Cache npm.
**Accept:** Workflow file present; a deliberate failing test fails the run
locally via `act` or by inspection of workflow correctness.

### WO-0.2 ArcGIS fixture harness
**Problem:** 8 of 9 providers untested; no way to test against realistic
upstream payloads.
**Change:** Create `netlify/functions/lib/providers/__fixtures__/` with one
canned ArcGIS JSON response set per city (parcel + zoning + overlay layers,
trimmed to the fields each provider reads — copy field names exactly from the
provider code, e.g. NYC `ResidFAR`/`CommFAR`/`BldgArea`/`UnitsTotal`, Seattle
`SQFTLOT`, Denver `HEIGHT_STORIES`). Add a `mockArcgisFetch(fixtures)` helper
(pattern exists in `lib/parcel.test.ts`) that routes by URL substring.
**Accept:** Helper exported from a test util; used by WO-2.x tests.

---

# PHASE 1 — Engine resilience (protects all 10 cities)

### WO-1.1 Detect ArcGIS 200-with-error-JSON  [CRITICAL]
**Files:** `netlify/functions/lib/arcgis.ts` (all four `res.json()` sites in
`fetchFeatures` / `fetchFeaturesXY` and the snap path).
**Current:** Only `res.ok` is checked. ArcGIS returns HTTP 200 with
`{"error":{code,message,...}}` on malformed queries, renamed fields, or
throttling. The error object has no `.features`, so providers read it as
"no parcel" → user-facing NO_PARCEL 404, no log, indistinguishable from
clicking water.
**Change:** After parsing, `if (data && typeof data === 'object' && 'error'
in data) throw new Error('arcgis_error: ' + JSON.stringify((data as
{error:{code?:number;message?:string}}).error).slice(0, 300))`. This routes to
the existing rejected/UPSTREAM_ERROR path and its logging.
**Tests:** New case in `arcgis.test.ts`: mock 200 + `{error:{code:400}}` →
expect throw; provider-level test: same mock → handler returns 502
UPSTREAM_ERROR, not 404 NO_PARCEL.

### WO-1.2 Timeout budget under Netlify's 10s ceiling  [HIGH]
**Files:** `arcgis.ts` (default `timeoutMs`, snap path), `providers/chicago.ts`
(9000ms call sites), `providers/austin.ts` (sequential `reverseGeocode`).
**Current:** Snap path = exact query (6s timeout) then buffered query (6s)
**sequentially** = 12s worst case; Chicago uses 9s timeouts → 18s. Netlify
kills at 10s → opaque platform error, no clean response, no log.
**Change:**
1. Give the snap path a shared deadline: total ≤ 8s (e.g. exact 4s, buffered
   gets `min(4s, remaining)`).
2. Reduce Chicago's 9000 → 6000 and let it share the same budget.
3. In `providers/austin.ts`, run `reverseGeocode` inside the existing
   `Promise.allSettled` fan-out instead of awaiting it afterward.
4. Add one retry (250ms delay) for the **required** parcel/zoning fetch on
   network error, 5xx, or the WO-1.1 error-JSON throw — bounded by the same
   deadline. Optional overlays keep zero retries.
**Tests:** Fake timers: exact times out at 4s → buffered still completes
within budget; retry fires exactly once on a transient failure then succeeds.

### WO-1.3 Schema-drift canary  [MEDIUM]
**Files:** all 9 providers.
**Current:** Coercion (`Number()`/`String()`) is silent. If a city renames a
critical field (NYC has renamed PLUTO fields before), the provider serves
nulls citywide forever with no signal.
**Change:** Tiny helper in `lib/arcgis.ts`:
`warnIfMissing(attrs, fields: string[], city: string)` → for each field not
present as a key (distinct from null), `console.log({ event: 'schema_drift',
city, field })`. Call it in each provider on the parcel/zoning attrs with that
provider's 2–4 critical fields (the ones whose absence nulls the verdict
inputs: e.g. NYC `ResidFAR`, Seattle `SQFTLOT`, Denver `HEIGHT_STORIES`,
DC `LANDAREA`, Boston `LAND_SF`).
**Tests:** Fixture minus one critical field → log spy sees `schema_drift`;
full fixture → no warning.

### WO-1.4 Cache-key quantization  [MEDIUM]
**Files:** `src/hooks/useParcelInfo.ts`, `src/hooks/useAnalysis.ts` (or a
shared util), `netlify/functions/parcel.ts`, `netlify/functions/analyze.ts`.
**Current:** Raw float lat/lng from map clicks = unbounded CDN cache-key
cardinality; two clicks 1cm apart are both misses; effective hit rate ~0
while every miss fans out to 4–6 upstream queries.
**Change:** Round lat/lng to 6 decimals (≈0.1m) **client-side** before
building API URLs (single `quantize(n)` util used by both hooks and the
wizard/result URL builders). Server-side, also round parsed lat/lng to 6
decimals before use so stragglers normalize.
**Tests:** Util test: `quantize(42.36014999)` → `42.360150`; hook test (if
present) builds URL with quantized values.

### WO-1.5 Estimates version cache-buster  [MEDIUM]
**Files:** `src/config/estimates.ts`, both hooks, `analyze.ts`.
**Current:** `/api/analyze` responses cache 24h + 7d SWR with cost constants
baked in; a model fix takes up to 8 days to propagate and can't be purged
selectively.
**Change:** Export `export const ESTIMATES_VERSION = 1` from `estimates.ts`.
`useAnalysis` appends `&v=${ESTIMATES_VERSION}` (cache key changes); analyze
ignores the param functionally. Bump the constant whenever cost/timeline
constants change (add a comment at the top of estimates.ts saying so).
**Tests:** URL builder includes `v=`; bumping the constant changes the URL.

---

# PHASE 2 — Test coverage for the engine (everything regresses silently today)

### WO-2.1 Provider tests ×9
**Files:** new `providers/*.test.ts` for nyc, sf, chicago, seattle, dc,
austin, la, denver, minneapolis (Boston already covered via
`lib/parcel.test.ts`).
**Change:** Using WO-0.2 fixtures, per city assert: happy path (address,
districtCode, lot size, FAR/height extraction, allowedUses), the snap path,
the "optional overlay failed → nulls, still 200" path, and the WO-1.1
error-JSON → throw path. Pin each city's tricky parser explicitly:
- LA: `[Q]`/`[T]` prefix strip; height-district FAR resolution.
- Denver: `HEIGHT_STORIES` × 12; Former-Chapter-59 guard.
- Seattle: height regex (must NOT match digits inside overlay codes — add a
  case like `MIO-105-NC3-65` resolving 65, not 105); industrial-unlimited rule.
- DC: lettered sub-zone falls back to parent zone limits.
- Minneapolis: `lngLatToUtm15` round-trip sanity (see WO-2.3).
**Accept:** ≥4 assertions per city; suite green.

### WO-2.2 Envelope + timeline + discretionary tests
**Files:** new `lib/envelope.test.ts`, `lib/timeline.test.ts`; extend
`lib/analyze.test.ts`.
**Change:** Pin current behavior BEFORE Phase 5 changes it (then update):
envelope FAR pick order, maxStories division, maxUnits math;
`resolveTimeline` demolition add, >50k sf teardown scaling, `Math.max(1,…)`
floor; analyze discretionary months: spine vs entitlement `max`, parallel
add, 24-month cap binding and non-binding cases.

### WO-2.3 Geometry tests
**Files:** new `lib/geo.test.ts`.
**Change:** `polygonAreaSqFt`: unit square ring → 1; ring with hole; the
`unitToFeet=3.28084` meter branch (currently dead code — test it so it works
the day a meter-SR city lands). `lngLatToUtm15`: Minneapolis City Hall
(-93.2650, 44.9778) → assert within ~1m of the known UTM15N coordinate
(easting ≈ 478,000; northing ≈ 4,980,000 — compute the exact expected pair
with an independent implementation in the test, not by calling the function
itself).

### WO-2.4 Cost-model edge tests
**Files:** extend `lib/cost.test.ts`.
**Change:** impactFee for every city branch (incl. Seattle/SF informational
`applied:false`); the demo-rate boundary at 4,999/5,000/19,999/20,000 (pins
current cliff; WO-5.6 will change expectations); permit fee on hard cost;
variance filing fee add.

---

# PHASE 3 — Performance quick wins (one afternoon, live-site verified)

### WO-3.1 Immutable caching for hashed assets  [biggest free win]
**File:** `netlify.toml`.
**Current (probed live):** `/assets/*.js` ship `Cache-Control:
public,max-age=0,must-revalidate` — browsers revalidate the 480 kB-gzip
mapbox chunk every visit.
**Change:** Add a headers block BEFORE the `/*` one:
```toml
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```
(Vite content-hashes everything in /assets, so immutable is safe.)
**Accept:** After deploy, `curl -sI .../assets/<hash>.js | grep -i cache`
shows `immutable`. Pre-deploy: toml parses, build passes.

### WO-3.2 Hero image weight
**Files:** `public/images/piranha-hero.jpg`, `index.html`, the Home component
that renders it.
**Current:** 522 kB JPEG, preloaded `fetchpriority=high` — it is the LCP.
**Change:** Generate AVIF + WebP + recompressed JPEG (~quality 72, same
dimensions; target ≤200 kB JPEG, ≤120 kB AVIF) via a script (sharp). Serve
with `<picture>` (or `image-set`) and update the preload to the AVIF with
`type="image/avif"` fallback handling.
**Accept:** Total bytes for hero ≤40% of current on a modern browser; visual
parity at normal viewing size.

### WO-3.3 Real 404 status for unknown routes
**File:** `netlify/edge-functions/og.ts`.
**Current (probed live):** any junk URL returns HTTP 200 + SPA shell
(soft-404s get indexed).
**Change:** Maintain a known-prefix list (mirror `src/App.tsx` routes: `/`,
`/map`, `/boston`, `/boston/*`, `/result`, `/start`, `/compare`, `/cities`,
`/ask`, `/request-city`, `/about`, `/math`, `/admin`). If `url.pathname`
matches none AND has no file extension, return the HTML with `status: 404`
(React still renders NotFound). Keep 200 for known routes.
**Tests:** Extend the og rewrite check script-style test (or a small unit on
an exported `isKnownRoute()`): `/zzz` → 404, `/map` → 200, `/boston/result`
→ 200.
**Accept:** Post-deploy `curl -s -o /dev/null -w "%{http_code}" /no-such` →
404.

### WO-3.4 Self-host fonts (removes render-blocking third party)
**Files:** `index.html`, `src/index.css`, `netlify.toml` (CSP), new
`public/fonts/`.
**Current:** Google Fonts CSS is render-blocking; CSP must allow two Google
origins.
**Change:** Download the exact Libre Caslon Display / Libre Caslon Text /
Inter woff2 subsets (latin), serve from `/fonts/`, declare `@font-face` with
`font-display: swap` in `index.css`, remove the Google `<link>`s and
preconnects, tighten CSP (`style-src` drops fonts.googleapis.com; `font-src`
drops fonts.gstatic.com). Add `<link rel="preload" as="font">` for the two
serif faces used above the fold.
**Accept:** No requests to google domains; fonts render; CSP updated; build
green. (Licensing: all three are OFL — fine to self-host.)

---

# PHASE 4 — Trust, legal, honesty (mostly copy; one day)

### WO-4.1 Privacy policy + Terms pages
**Files:** new `src/routes/Privacy.tsx`, `src/routes/Terms.tsx`; routes in
`src/App.tsx`; footer links in `src/components/Layout.tsx`; entries in
`public/sitemap.xml`; titles in `og.ts` metaFor.
**Content requirements (plain English, no boilerplate dump):**
- Privacy: what's collected — request-city emails (Netlify Forms), searched
  addresses logged server-side (anonymous, no account linkage, retained for
  product analytics; rendered only to the site owner), Ask questions sent to
  Google's Gemini API; no ads; no sale of data; contact email for deletion
  requests; effective date.
- Terms: estimates not legal/engineering/financial advice; no warranty;
  verify with the city; acceptable use (no scraping/abuse); liability cap.
**Also:** one-line notice near the map search bar or panel: "Searches are
logged anonymously to improve coverage." (small, muted, once).
**Accept:** `/privacy` and `/terms` render, linked in footer, in sitemap,
og titles set.

### WO-4.2 Self-disclaiming PDF export
**Files:** `src/routes/BostonResult.tsx` (print-only footer block),
`src/index.css` print styles.
**Current:** The printed report's disclaimer renders only if
`state.data.disclaimers.length > 0`; footer and NextSteps are print-hidden.
**Change:** Hard-code into the existing `print-only` footer: "Estimates only
— not legal, engineering, or financial advice. Construction cost excludes
land and financing. Generated <date> from public records; verify with the
city. thepiranhaproject.com". Unconditional.
**Accept:** Print preview (or printToPDF in a headless check) shows the line
on every report including blocked/no-coverage ones.

### WO-4.3 Soften PROHIBITED + unify verdict labels
**Files:** new `src/lib/verdictLabels.ts`; consume in
`components/boston/result/VerdictBanner.tsx`, `routes/Compare.tsx`,
`components/boston/result/FeasibilityChecklist.tsx`, `routes/Admin.tsx`.
**Current:** Four divergent label sets for one enum; PROHIBITED headline is
the flat "You can't build this here." even when the verdict rests on
unit-count heuristics.
**Change:** One canonical map exporting `{ headline, short, checklist }` per
status. PROHIBITED headline → "This likely can't be built as proposed." Put
"Verify with the city before acting on this." inside the banner sub-line for
PROHIBITED and NEEDS_RELIEF. Compare uses `short` ("Likely buildable",
"Needs city permission", "Likely not allowed", "Can't tell").
**Tests:** Snapshot/unit on the label map; grep-level assertion that no route
defines its own verdict strings anymore.

### WO-4.4 Kill false precision in cost output
**Files:** `components/boston/result/CostBreakdown.tsx`, `KeyMetrics.tsx`
(verify consistency), `routes/Compare.tsx` usd().
**Current:** Line items and totals print to the dollar ("$4,182,400",
"$425/sq ft") on an order-of-magnitude model; KeyMetrics already says "$4.2M".
**Change:** Shared `formatEstimate(n)` → 3 significant figures with magnitude
suffix ($4.18M, $425k, $62.5k); $/sf and $/unit to 3 sig figs. Use everywhere
costs render.
**Tests:** Unit: 4_182_400 → "$4.18M"; 425.4 → "$425"; Compare and breakdown
use it.

### WO-4.5 Contact + data-vintage surfaces
**Files:** `Layout.tsx` footer (mailto: piranha@louisburgstrategies.com — the
address already configured for Netlify Forms notifications per
`public/__forms.html`); `components/boston/result/SourceLinks.tsx` or
`SiteFacts.tsx`.
**Change:** Footer gains "Contact" mailto. Result page gains one muted line:
"Parcel and zoning data fetched live from <city>'s public records; cost
tables: RSMeans 2026 base rates, 2021 city indices." (pull the vintage
strings from `estimates.ts` so they can't drift — add them as exported
constants there).
**Accept:** Visible on result page + footer; constants exported from
estimates.ts.

### WO-4.6 Derive "10 cities" from config
**Files:** `routes/Home.tsx` (STATS), `routes/About.tsx`,
`routes/RequestCity.tsx`, `routes/Ask.tsx` (FAQ), `routes/Cities.tsx`.
**Change:** Replace hard-coded "10"/"ten" city-count claims with
`CITIES.length` (or `CITIES.filter(c => c.live).length`) interpolation where
it reads naturally; where prose needs a word ("ten"), keep the word but add a
test asserting `CITIES.length === 10` with a comment listing the prose sites
to update — pick interpolation wherever possible.
**Accept:** Adding an 11th city to config changes every count surface (or
fails the guard test listing where to edit).

### WO-4.7 Analytics + error monitoring  [decision point]
**Default decision:** Plausible (script from plausible.io, cookie-less, CSP
addition required) for traffic; **no** Sentry yet — instead add a tiny
`window.onerror`/`onunhandledrejection` beacon to a new
`netlify/functions/client-error.ts` (rate-limited via lib/guard, logs
structured events; view in Netlify function logs). Re-evaluate real Sentry
when there's revenue.
**Files:** `index.html` (script tag), `netlify.toml` (CSP: add
plausible.io to script-src + connect-src), new function, small client util.
**Accept:** Pageviews visible in Plausible; thrown test error appears in
function logs; CSP doesn't block either; everything else still loads.

---

# PHASE 5 — Verdict correctness (the engine tells fewer lies)

### WO-5.1 NYC mixed FAR  [verdict-flipping]
**File:** `providers/nyc.ts` line ~89.
**Current:** `farByUse.mixed = Math.max(resid ?? 0, comm ?? 0)` — overstates
the mixed envelope; mixed projects needing relief can read as-of-right.
**Change:** Conservative floor: `const mixed = Math.min(...[resid, comm]
.filter((n): n is number => n != null && n > 0))`; only set when at least one
component exists. Add note in code: NYC mixed-use FAR is district-specific;
min() is the conservative bound (never overstates what's allowed; may
understate → worst case NEEDS_RELIEF instead of AS_OF_RIGHT, which is the
safe direction for this product).
**Tests:** Provider fixture with ResidFAR 6.02 / CommFAR 10 → mixed 6.02;
only ResidFAR present → mixed = resid; neither → mixed absent.

### WO-5.2 Unknown height can't yield AS_OF_RIGHT for tall proposals
**File:** `lib/feasibility.ts` (overall verdict derivation, lines ~130–150).
**Current:** Height INDETERMINATE (null city limit) is non-decisive; a 600 ft
proposal where height data is missing returns overall AS_OF_RIGHT.
**Change:** If the height check is INDETERMINATE **and** the proposal's
effective height > 85 ft (≈ the tallest common by-right envelope outside
downtown cores; constant in estimates.ts with comment), cap overall verdict
at INDETERMINATE. Keep small projects unaffected (a 30 ft house on a
null-height lot stays AS_OF_RIGHT — the hedge shouldn't punish bungalows).
**Tests:** 600 ft + null limit → overall INDETERMINATE; 28 ft + null limit +
use/FAR pass → AS_OF_RIGHT; 600 ft + known limit keeps existing behavior.

### WO-5.3 Units-unknown must not fire housing-loss PROHIBITED
**File:** `lib/feasibility.ts` line ~101 (`project.units ?? 1`) and the
no-net-loss block (~lines 100–122).
**Current:** Omitted unit count = "1 unit proposed" → demolishing a
multifamily fires PROHIBITED/NEEDS_RELIEF off a blank field. Also the
existing-unit estimate divides by 1,000 sf while the rest of the engine uses
1,300 (`avgUnitGrossSqFt`).
**Change:** When `project.units == null` for residential/mixed on a
multifamily teardown, emit the housing check as INDETERMINATE with note
"Enter the proposed unit count to check the city's housing-replacement
rules." Use `avgUnitGrossSqFt` (1,300) for `effectiveExUnits` instead of
1,000.
**Tests:** units undefined + multifamily existing → INDETERMINATE (not
PROHIBITED); units 2 vs existing 6 → still fires as today; estimate uses
1,300 (assert via a fixture where /1000 vs /1300 changes the trigger).

### WO-5.4 Use-variance severity
**File:** `lib/feasibility.ts` use check (~lines 40–51).
**Current:** Disallowed use is at worst NEEDS_RELIEF; FAR >1.2× is
PROHIBITED. Backwards — use variances are the hardest relief to get.
**Change:** Disallowed use → PROHIBITED when the district's allowed-use list
is known and the use plainly isn't in it (e.g. industrial/commercial project
in a single-family residential district); keep NEEDS_RELIEF for adjacent
cases (mixed proposed where residential allowed, institutional ambiguity).
Implementation: add an adjacency map in `zoningUse.ts` (residential↔mixed
adjacent; commercial↔mixed adjacent; commercial/industrial in pure
residential = PROHIBITED).
**Tests:** commercial in R-only district → PROHIBITED; mixed in residential
district → NEEDS_RELIEF; existing zoningUse tests still pass.

### WO-5.5 Envelope/feasibility consistency
**File:** `lib/envelope.ts`.
**Current:** Headline FAR = `residential ?? mixed ?? maxFAR` regardless of
context; stories always /11 ft; maxUnits assumes all-residential envelope.
**Change:** `computeEnvelope` already lacks project context by design (it
describes the parcel) — keep that, but (a) label the basis: add
`farBasis: 'residential' | 'mixed' | 'district'` to the envelope object and
show it in `ParcelPanelContent`/`SiteFacts` ("max floor area (residential
FAR)"); (b) compute `maxStories` from `ftPerStory('residential')` when basis
is residential, `ftPerStory('commercial')` when district/commercial — import
`ftPerStory` instead of flat `FT_PER_STORY`; (c) for mixed-basis maxUnits,
apply a 0.85 residential-share factor (constant in estimates.ts, commented).
**Tests:** WO-2.2's envelope tests updated to pin new behavior; UI shows the
basis label.

### WO-5.6 Cost-model consistency pack
**Files:** `lib/cost.ts`, `src/config/estimates.ts`, `lib/assumptions.ts`,
`routes/Methodology.tsx`.
**Change (all small, do together):**
1. Demo rate: replace the $10/$12/$18 cliffs with linear interpolation
   between (5,000 sf, $10) and (20,000 sf, $18); below/above clamp. Update
   Methodology prose if it states the tiers.
2. Soft-cost contradiction: change the estimates.ts soft-cost description to
   exclude financing ("A&E, permitting consultants, legal, developer
   overhead") — financing stays excluded everywhere, matching disclaimers.
3. `assumptionsSummary`: "construction value" → "hard cost".
4. Impact fees: apply per-sf fee to **residential GFA share** — for `mixed`,
   multiply by the same 0.85 share constant as WO-5.5; Denver: drop the
   `units ?? 1` default → when units unknown for residential, skip the
   <10-unit branch and use the ≥10 path only when units known ≥10; otherwise
   emit fee with `applied:false` + note "unit count needed to determine
   Denver's linkage-fee tier."
5. Height factor: compute stories as `ceil(heightFt / ftPerStory(use))` (not
   round) so a 53 ft commercial building lands in the 5-story (concrete)
   tier — conservative direction.
6. Bump `ESTIMATES_VERSION` (WO-1.5).
**Tests:** WO-2.4 expectations updated; interpolation midpoint asserted
(12,500 sf → $14/sf); Denver units-unknown → applied:false.

### WO-5.7 Hurdle gating
**File:** `lib/hurdles.ts`.
**Change:**
1. NYC ULURP + Chicago PD hurdles: fire only when `feasibility.path ===
   'variance'` OR projectType implies discretionary action — pass the
   feasibility result (or path) into `assessHurdles` (signature change;
   analyze.ts already computes feasibility before hurdles, reorder the calls
   if needed).
2. Seattle MHA: gate on `parcel.overlays.feeArea` presence (already fetched
   in seattle.ts and currently ignored here); keep the generic hurdle with
   "confirm" language when feeArea is null.
3. LA Coastal: leave category `environmental` but mark `serial: true` (new
   optional field) — consumed by WO-5.8.
**Tests:** `hurdles.test.ts`: as-of-right 60k sf NYC project → no ULURP;
variance-path same project → ULURP; Seattle with/without feeArea.

### WO-5.8 Discretionary timeline combine
**File:** `netlify/functions/analyze.ts` (lines ~163–181).
**Current:** `min(24, max(spine, entitlementMax) + parallelSum)` — multiple
entitlement hurdles never stack; adding hurdles often changes nothing,
contradicting Methodology.
**Change:** `entitlement = max(spine, entitlementMax) +
0.5 * (sum(entitlementMonths) - entitlementMax)` — the longest process
governs, others contribute half (partial overlap), `serial: true` hurdles
(WO-5.7) add in full. Keep the 24-month cap but when it binds, append a
disclaimers entry: "Entitlement time was capped at 24 months; heavily
contested projects can exceed this." Update the Methodology paragraph to
describe max + half-overlap honestly.
**Tests:** extend analyze.test.ts: hurdle set {7,3} → 8.5 not 7 not 10;
cap-binding case adds the disclaimer; no-hurdle variance path unchanged.

### WO-5.9 Demolition data beyond Boston/NYC
**Files:** `providers/sf.ts`, `chicago.ts`, `dc.ts`, `seattle.ts`,
`denver.ts`, `minneapolis.ts`, `austin.ts`, `la.ts`; fallback in
`components/boston/result/CostBreakdown.tsx`.
**Current:** Only Boston (`GROSS_AREA`) and NYC (`BldgArea`/`UnitsTotal`)
populate `existing.buildingAreaSqFt`/`units` → demolition = $0 in the other
cities with a buried caveat.
**Change (two parts):**
1. Research pass per city (use each provider's existing endpoints first):
   many assessor layers already in `_endpoints.ts` carry building area or
   units fields not currently read. Wire any that exist (same fetch, more
   fields). Document per city in the provider header comment which field was
   used or why none exists.
2. Where no field exists: when a teardown is detected but unsized
   (`demolitionSqFt === null`), CostBreakdown must show a visible "Demolition:
   not estimated — no building-size data for <city>" line item (not just
   narrative prose), so the omission is in the table a developer reads.
**Tests:** Per-city fixture asserts buildingAreaSqFt extraction where wired;
UI line renders when null + teardown.

---

# PHASE 6 — Conversion and retention

### WO-6.1 Result-page email capture  [decision point]
**Default decision:** Netlify Forms (zero new vendors, pattern proven by
request-city + `public/__forms.html`).
**Files:** new `src/components/boston/result/EmailReport.tsx`; render in
`BostonResult` after VerdictBanner (print-hidden); add form to
`public/__forms.html` (`name="report-email"`, fields: email, address, city,
verdict, url, bot-field honeypot).
**Behavior:** "Email me this report" — submits to Netlify Forms (owner gets
notification, sends the link manually at first; full automation is F6 v2).
Microcopy: "We'll send a link to this report. No spam — see our privacy
policy." Success state inline. This is deliberately v0: the goal is capturing
the contact + intent, not building email infra.
**Accept:** Form registers in Netlify (static mirror present), submission
captured, privacy page mentions it (WO-4.1 dependency).

### WO-6.2 Compare: discoverable, cancelable, honest
**Files:** `routes/Home.tsx` (feature mention), `BostonDashboard.tsx` (cmp
banner), `Compare.tsx`, `BostonResult.tsx`, `ParcelPanelContent.tsx`.
**Change:** (a) one verb everywhere: "Compare" (link text "Compare another
parcel" stays; panel button becomes "Compare with this parcel" → keep, but
the dashboard banner and Compare empty-state reference the same words the UI
actually shows); (b) cmp banner gets an ✕ that strips `?cmp=` via
`setParams`; (c) hoist "Both columns run the same project spec; only the
parcel differs." to a labeled note ABOVE the compare table; (d) Home gets a
one-line feature row mentioning compare ("Run a parcel, then line a second
one up against it.").
**Accept:** cmp mode escapable in one click; copy consistent; note above
table.

### WO-6.3 Dead-end and degraded states
**Files:** `BostonResult.tsx` blocked branch, `SearchBar.tsx`,
`BostonWizard.tsx` step 4.
**Change:** (a) blocked/no-coverage results render a "← Try another parcel"
CTA back to `/map?city=…`; (b) `SearchBar` with no token renders a disabled
input "Search unavailable — map clicks still work" instead of `null`;
(c) wizard step 4 shows a one-line summary ("New construction · residential ·
12,000 sf · 4 stories") above the submit button.
**Accept:** All three states reachable in dev and render the new UI.

### WO-6.4 Sample report link
**Files:** `routes/Home.tsx`.
**Change:** "See a sample report →" linking to a real `/result?...` URL for a
known-good Boston parcel (pick one in dev; quantized coords per WO-1.4, full
spec in the URL). CDN cache makes this cheap.
**Accept:** Link renders a complete report without user input.

---

# PHASE 7 — The moat (new features; each is its own mini-project)

Order: F1 → F3a → F2 → F4 → F5. (F6 v2 parcel-watch, F7 multi-scenario, F8
API productization, F9 lot assembly, F10 ADU packs follow; spec them when
reached.)

### WO-7.1 (F1) Measured permit timelines
**Goal:** "The city's published pace vs. what the records show." Next to the
estimate: "Median for this permit type in <city>: X months (p80: Y) — based
on N permits issued since 2023."
**Architecture:** Offline pipeline, not runtime: new `scripts/permits/`
(Node/TS) per city fetching the open permit dataset (Boston: data.boston.gov
approved-building-permits; NYC: DOB NOW / BIS via NYC Open Data; SF:
data.sfgov.org building permits; Seattle, Chicago, Austin, LA equivalents —
verify each dataset id at build time, they're all Socrata/CKAN). Compute
median/p80 application→issuance by mapped permit class (new construction /
alteration / demolition), output ONE committed artifact
`netlify/functions/lib/data/permitStats.json` (small: cities × classes ×
{median, p80, n, vintage}). `resolveTimeline` reads it and the result UI
shows the comparison line with vintage. Re-run quarterly by hand (document in
README); no live dependency.
**Accept:** JSON artifact ≥6 cities; result page shows the line with n and
vintage; timeline tests cover the join; pipeline re-runnable with one command
per city.

### WO-7.2 (F3a) Parking minimums + setbacks per zone
**Goal:** Two new envelope facts + one new hurdle. Start with the 3 cities
where the zoning table is cleanest (Minneapolis: abolished citywide —
trivially "0, abolished 2021"; Austin: abolished 2023; Seattle: reduced/none
in urban villages), then Boston/Denver/Chicago tables.
**Architecture:** Extend `zoningLimits.ts` shape with
`parking: { stallsPerUnit: number | null, note: string } | null` and
`setbacks: { front: number | null, side: number | null, rear: number | null }
| null`, sourced from per-city lookup tables in a new
`lib/data/zoningRules/<city>.ts` (hand-built from each city's published
zoning code tables, with source URL + as-of date in comments — this is
curation work, be explicit about vintage). Surface in SiteFacts + a hurdle
("Parking minimum: N stalls — adds ~$X/stall structured" using a new
estimates.ts constant) only when `stallsPerUnit > 0`.
**Accept:** ≥5 cities populated; INDETERMINATE-safe (null = "not in our
tables yet", never a guess); tests per city table; Methodology section added.
**Note:** abolition stories (Minneapolis/Austin) render as a positive badge —
on-thesis for the product.

### WO-7.3 (F2) Relief approval odds
**Goal:** NEEDS_RELIEF verdicts show "Boston ZBA granted ~N% of variance
requests (2022–2025, n=M)."
**Architecture:** Same offline-pipeline pattern as WO-7.1. Start with Boston
(ZBA decisions on data.boston.gov) and SF (Planning Commission actions);
expand later. Output `lib/data/reliefStats.json`; `narrative.ts` + a small
result-page line consume it. Where no data: say nothing (no fabrication).
**Accept:** ≥2 cities; line renders only for NEEDS_RELIEF; vintage + n shown.

### WO-7.4 (F4) "Does it pencil?" pro-forma lite  [decision point]
**Default decision:** v1 = land-cost proxy only. Providers already fetch
`assessedValue` in several cities — surface "Assessed value (county records):
$X — land basis is typically above this" as a SiteFacts line + add assessed
value to the Compare table. Defer rent comps / yield-on-cost to v2 (needs a
data-source decision: HUD FMR vs Census ACS vs commercial API).
**Accept:** Assessed value shown where the provider has it; absent otherwise;
no fabricated yields anywhere.

### WO-7.5 (F5) Red Tape Index
**Goal:** `/red-tape` page ranking the 10 cities from the engine's own
constants + WO-7.1/7.3 measured data: months of process (lifecycle + relief
adder), fees per sf (permit+impact on a reference project), parking burden
(WO-7.2), measured permit median (WO-7.1), relief odds (WO-7.3). One
composite score, methodology shown inline, derived 100% from
`estimates.ts` + committed data artifacts (same no-drift property as the
Methodology page).
**Files:** new `src/routes/RedTape.tsx`, route, sitemap, og.ts entry, Home
link.
**Accept:** Page computes entirely from config/artifacts (no hand-typed
numbers); a constants change reorders the table automatically; shareable
(good og description — it's the press-bait page).

---

## Deferred (explicitly out of scope until the above ships)
Keyboard parcel selection on the map (needs a parcel-vector layer first);
Sentry; accounts/auth; parcel-watch automation (F6 v2 — requires scheduled
functions + email provider decision); API keys/metering (F8); lot assembly
(F9); ADU rule packs (F10).
