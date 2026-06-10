# Phase 8 — The Experience Spec: alive map, loud verdicts, memory, momentum

Owner mandate (2026-06-10): the content must be (1) easy to understand,
(2) f***ing awesome, (3) fun to use and read. The Red Tape Index is the
editorial brand; the reports are the neutral tool; the index funnels readers
into the tool. Depth in all ten cities is a standing workstream, not a
limitation to design around. Same execution rules as
SPEC-2026-06-fixes-and-features.md: every WO verified (tsc/eslint/vitest/
build), tests required, conservative VERDICT logic never weakened, no
fabricated data, CSP extended deliberately when new origins are needed.

## WO-8.1 The map comes alive  [biggest single UX win]
Today: bare basemap; click-and-pray; no parcel outlines, no hover, no
selection feedback beyond a pin.
Build:
a. **Selected-parcel highlight.** New `netlify/functions/parcel-shape.ts`:
   given city/lat/lng, return the snapped parcel's polygon as GeoJSON
   (reuse fetchParcelSnap with returnGeometry + outSR 4326; cache like
   /api/parcel; rate-limit via guard). Dashboard draws it as a Mapbox
   fill+line layer (burgundy outline, soft fill) the moment the panel
   resolves. The pin stays; the parcel SHAPE is the confirmation.
b. **Zoning-district overlay.** Client fetches the city's zoning
   FeatureServer (the SAME endpoints the providers query) with
   `f=geojson` + viewport-envelope geometry filter, debounced on moveend,
   zoom ≥ 14 only. Render as a translucent fill colored by district
   family (residential greens → commercial burgundies → industrial grays;
   one shared palette in bostonMapStyle.ts) + hover popup showing the
   district code. Per-city layer/field map lives in cities.ts or a new
   config — Boston FeatureServer/93 verified; reuse each provider's ZONING
   constant and code field. Cities whose servers reject geojson or CORS:
   feature-detect and skip gracefully (no overlay ≠ broken map).
   CSP: add the specific GIS hosts to connect-src (list them in the
   netlify.toml comment).
c. **Hover affordance** on desktop: cursor pointer over the map; after
   first overlay load, hovering a district shows its code chip.
d. Legend chip row (collapsible) when the overlay is on.
Accept: click → parcel polygon highlights; zoom in → districts visible
with hover; all 10 cities either render or skip cleanly; map tests for the
new endpoint; CSP updated; no regression in map create-once behavior.

## WO-8.2 The verdict gets loud
Today: the differentiated data (measured times, relief odds, parking) is
muted footnotes; estimates dominate.
Build:
a. Result-page hierarchy: VerdictBanner stays the opener, then a NEW
   "Reality check" band (full-width, visually distinct — bone-on-charcoal
   inversion) showing up to three big stat cards: **Measured permit time**
   ("City data: median X months filing→permit, n=…"), **Relief odds**
   ("The board says yes XX% of the time"), **Parking** ("No minimums —
   abolished 2025"). Only cards with real data render; zero cards → no
   band. Estimates follow beneath as today.
b. Each card gets a one-line "so what" in plain English ("Permits here are
   fast; entitlement is what eats the calendar").
c. Print: the band prints as a simple table row set.
Accept: SF/Seattle/Chicago/Austin/LA/Boston results show ≥1 card; cards
absent cleanly elsewhere; copy reads like a human wrote it; tests for the
selection logic (which cards render per data shape).

## WO-8.3 Memory (no accounts yet)
Build `src/lib/recentReports.ts`: localStorage ring buffer (max 12) of
{url, address, city, verdict, totalCost, ts}, written on every loaded
result. Surface: (a) dashboard — a compact "Recent" chip row under the
search bar (click → result URL; ✕ to remove; clear-all); (b) Home — a
"Pick up where you left off" row when non-empty. Pinning: a star toggle on
the result page header persists entries past the ring buffer. Privacy page
gains one line (stored only in your browser). Tests for the buffer logic
(cap, dedupe by URL, pin survival).

## WO-8.4 Momentum: instant analysis
Today: click → panel → CTA → 4-step wizard → report (6 interactions).
Build: the parcel panel gains a primary **"Instant report"** action that
builds a default spec from the parcel itself — use: first allowed use
(prefer residential/mixed); gfa: envelope.maxFloorAreaSqFt × 0.85 (rounded
to 500) when known, else lot × 1.0 FAR fallback, clamped to sane bounds;
units: derived via avgUnitGrossSqFt for residential; stories: from
envelope.maxStories capped at 6 — and navigates straight to /result with
those params + `&auto=1`. The result page, when auto=1, shows a slim
banner: "Built from this parcel's own limits — refine the assumptions" →
links to the wizard pre-filled (existing round-trip already works). The
wizard remains for refinement. Panel keeps "Customize analysis" as the
secondary action. Tests: default-spec builder unit tests (envelope known /
unknown / non-residential district).

## WO-8.5 Mobile pass
a. Bottom sheet: default to a peek state (~35vh, address + verdict-ready
   summary + actions) expandable to 85vh via drag handle / tap; map stays
   interactive in peek.
b. CityIntro: skip entirely on coarse pointers when `saveData` or low
   `deviceMemory`; otherwise cap dive duration to 2.5s on mobile.
c. Wizard inputs: numeric steppers (+/- buttons) beside sliders; inputs
   `inputMode="numeric"`.
d. Result tables: confirm no horizontal overflow at 360px (fix any).
Accept: tested at 360/390/768 widths in dev tools (agent: reason via CSS,
verify build; no screenshot infra needed).

## WO-8.6 Smaller-stuff batch
a. Red Tape Index in the header nav (and footer).
b. Ask embedded on results: collapsible "Ask about this report" panel above
   NextSteps reusing AskAssistant, seeded placeholder ("e.g. What's a
   variance and how long does one take?").
c. Map-click skeleton: panel shows address-line shimmer immediately on
   click (it already has loading state — make it instant and obvious).
d. Compare entry: result nav link renamed "Compare with another parcel";
   when arriving at /map with cmp, the banner names the first parcel's
   address (decode from cmp), not just "pick a second parcel".
e. NotFound page gets search + recent reports (ties into 8.3).

## WO-8.7 Editorial funnel: the Index is the front door
a. /red-tape becomes a real editorial page: ranked table stays, but each
   city row expands into a 2–3 sentence plain-English story computed from
   its own data ("Chicago issues a new-construction permit in a month —
   the fastest we measure — but stack zoning relief on top and the
   calendar triples."). Generated from constants + permitStats +
   reliefStats + parkingRules so it can't drift; written in the house
   voice: confident, concrete, a little sharp.
b. Every city row CTA: "Run a parcel in {city} →" (the funnel).
c. Home hero gets a second CTA: "Read the Red Tape Index".
d. og card description sharpened; the index page gets its own share-worthy
   stats baked into the meta description.
e. Result pages cross-link back: the Reality-check band's cards each link
   to /red-tape ("how {city} compares →").

## WO-8.8 Depth program (standing workstream — first tranche here)
Goal: shrink INDETERMINATE. Mechanism: per-city curated district tables
(FAR/height/uses by district code), same shape as austin.ts's
AUSTIN_LIMITS, stored per city in netlify/functions/lib/zoning/<city>.ts
with source + as-of comments, consumed by resolveZoningLimits as the layer
between provider data (wins) and family heuristics (fallback).
Tranche 1 (this phase): **Chicago** (the published Title 17 FAR/height
tables for B/C/D/M districts — currently null FAR for ALL of them) and
**Denver** (height already derived; add FAR for the common MX/RH/RO
codes). Each table ≥ the 20 most common districts, tested per city.
Subsequent tranches (NYC contextual R-districts, Seattle SM suffixes, DC
matter-of-right tables, LA height districts refinement, Minneapolis
built-form FAR, Boston neighborhood articles) are queued in
docs/DEPTH-BACKLOG.md created by this WO with per-city source links.

Execution waves: Wave 1 = 8.1 + 8.3 + 8.6 (parallel agents, disjoint
files). Wave 2 = 8.2 + 8.4 (result-side, one agent) + 8.7. Wave 3 = 8.5 +
8.8. One commit per WO or coherent pair.
