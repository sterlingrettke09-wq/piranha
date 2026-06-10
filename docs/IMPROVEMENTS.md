# Piranha — Round-Two Audit: Everything Left to Make Better

Date: 2026-06-09. Scope: the analysis engine (all 9 city providers + shared
libs), product/UX/content, live-site performance, operations, and a feature
roadmap. Round-one fixes (SEO/canonical, security headers, rate limiting,
admin auth, search-log dedupe, regex tightening, etc.) are excluded — this is
what's *still* weak, found by adversarial review of every engine file, every
route, and live probes of thepiranhaproject.com.

---

## A. Engine correctness — these can flip verdicts

**A1. ArcGIS "200-with-error-JSON" reads as "No parcel found" (CRITICAL).**
ArcGIS servers return HTTP 200 with `{"error":{...}}` when a field is renamed,
a layer re-indexed, or the service throttles. `arcgis.ts` checks only
`res.ok`, so an error body has no `.features` → `firstAttrs` returns null →
the provider returns NO_PARCEL (404). A schema change in any city presents to
users as "no parcel here" citywide, logs nothing, and looks identical to
clicking open water. Fix: after `json()`, `if ('error' in data) throw` so it
routes to the 502/UPSTREAM path and the logs.

**A2. NYC mixed-use FAR is fabricated (HIGH).** `nyc.ts` sets
`farByUse.mixed = max(ResidFAR, CommFAR)`. NYC mixed-use FAR is not the max of
the two — it's district-specific and often *lower*. A mixed project that needs
relief can read "as-of-right." Verdict-flipping. Fix: set `mixed` to
`min(resid, comm)` as the conservative floor, or null + INDETERMINATE with an
honest note.

**A3. Over-height towers pass when the city has no height data (HIGH).**
`feasibility.ts`: a null `maxHeightFt` (NYC always, SF/Chicago/Denver/
Minneapolis often) yields an INDETERMINATE height check, which doesn't drag
the overall verdict — so a 600 ft tower on a brownstone block returns
AS_OF_RIGHT. `envelopeKnown` hedges the prose but not the machine verdict or
the badge. Fix: when height is unknown and the proposal exceeds a sane
district-derived bound, cap the overall verdict at INDETERMINATE.

**A4. Demolition is priced in Boston/NYC only (HIGH).** Only those providers
populate `existing.buildingAreaSqFt`/`units`. In the other 7–8 cities a
teardown gets demolition = $0 with only a buried narrative caveat. Either
populate building area in more providers (most assessors publish it) or
surface the omission loudly in the cost card.

**A5. Internal inconsistencies in the envelope math (MEDIUM).**
- Envelope headline FAR uses `residential ?? mixed ?? maxFAR` while the
  feasibility check uses `farByUse[project.use]` — the same screen can show a
  20k sf envelope while passing a 30k sf commercial project.
- `envelope.ts` divides height by 11 ft/story for all uses; the rest of the
  engine uses 13 ft for commercial. ~18% story-count disagreement.
- `maxUnits` assumes 100% residential envelope at 1,300 sf even for mixed.
- `feasibility.ts` no-net-loss estimates existing units at 1,000 sf/unit while
  everything else uses 1,300 — the trigger over-fires by ~30%.
- `project.units ?? 1` treats an omitted unit count as "1 unit proposed,"
  firing housing-loss PROHIBITED on users who just left a field blank. Should
  be INDETERMINATE when units is unspecified.

**A6. Use-variance severity is backwards (MEDIUM).** A disallowed use is at
worst NEEDS_RELIEF while FAR >1.2× is PROHIBITED. Use variances are the
hardest relief to get in most states (some ban them outright). A factory in a
single-family zone should not score better than a 1.3× FAR overage.

**A7. Cost-model credibility nicks (MEDIUM, cheap to fix).**
- Demo rate cliff: 19,999 sf demo ≈ $240k, 20,000 sf = $360k. Interpolate.
- Soft-cost note says the 25% *includes* financing while the disclaimers say
  financing is *excluded*. Pick one.
- `assumptionsSummary` says permit fee is on "construction value"; the engine
  and Methodology say hard cost. Align the strings.
- Impact fees bill full GFA (incl. non-residential floors) and Denver's
  <10-unit branch ignores the per-unit-size cap and defaults `units ?? 1`.
- Height factor rounds stories from height before tiering — a 53 ft commercial
  building lands in the ≤4-story (wood) tier.

**A8. Hurdle/timeline plausibility (MEDIUM).**
- Entitlement hurdles combine via `max` only, so historic + CEQA + large-
  project review never stack — adding hurdles frequently changes the timeline
  by zero months, contradicting the Methodology's claim that they add time.
  Use max for the nested pair (environmental within entitlement) but let
  genuinely-serial processes (coastal, historic clearance) add.
- The 24-month discretionary cap is silent; say when it bound.
- NYC ULURP fires on raw GFA ≥50k even for as-of-right projects (ULURP only
  applies to discretionary actions). Chicago PD similar. Gate on
  `feasibility.path === 'variance'` or relief-triggering conditions.
- Seattle MHA hurdle fires for all residential/commercial, even though
  `seattle.ts` already fetches the MHA `feeArea` that could gate it precisely.

**A9. Caching is fighting itself (MEDIUM).** Raw float lat/lng is the CDN
cache key, so two clicks 1 cm apart are cache misses — the 24h cache hit rate
on real map use is ~0 while every miss fans out to 4–6 upstream queries.
Quantize lat/lng (~5–6 decimals) in the frontend before calling the API.
Separately, `analyze` responses bake estimate constants into a 24h+SWR cache;
a cost-model fix takes up to 8 days to fully propagate. Add a `?v=` param tied
to an estimates version.

**A10. Resilience (HIGH, ops).** No retries anywhere (one transient ArcGIS
blip = user-visible 502); the snap path can run exact (6s) + buffered (6s)
sequentially — 12s, past Netlify's 10s kill (Chicago's 9s timeouts: up to
18s). Budget a shared deadline (~8.5s), retry the required fetch once, and
return a clean UPSTREAM_ERROR instead of a platform kill. Austin's reverse
geocode runs sequentially after the parcel fetch — parallelize it.

**A11. Schema-drift canary (MEDIUM).** Providers coerce types safely but never
check field *presence*. If MapPLUTO renames `ResidFAR` (it has before), NYC
silently serves "FAR not in public data" citywide forever. Log a
`schema_drift` event when a parcel feature arrives without its critical
fields.

## B. Test gaps — what regresses silently today

8 of 9 city providers have **zero tests** (only Boston + one NYC path are
exercised). Untested: every per-city zoning parser (`laLimits`,
`denverMaxHeightFt`, `seattleMaxHeightFt`, `dcLimits`, `austinLimits`, every
`usesForZone`), `computeEnvelope`, `resolveTimeline`, `polygonAreaSqFt` (the
lot area behind every SF/LA/Chicago FAR verdict), `lngLatToUtm15`
(Minneapolis's entire parcel lookup), the ArcGIS error-200 case, impact fees,
and the discretionary-months cap. Any of these can break and ship green.
Highest-leverage single investment in the codebase: a fixture-based provider
test suite (one canned ArcGIS response per city) + envelope/timeline tests.
Then a GitHub Actions workflow — there is currently **no CI at all**; nothing
runs tests before deploy.

## C. Live-site performance (probed today)

- **Hashed assets ship with `Cache-Control: max-age=0, must-revalidate`** —
  browsers revalidate the 480 kB-gzip mapbox chunk on every visit. These are
  content-hashed files; add `/assets/*` → `public, max-age=31536000,
  immutable` in netlify.toml. Biggest free perf win available.
- **Soft 404s**: unknown URLs return HTTP 200 with the SPA shell. Crawlers
  index junk URLs. The og.ts edge function can match unknown paths against the
  route list and set status 404 while still serving the shell.
- **Hero image is 522 kB JPEG**, preloaded with `fetchpriority=high` — it IS
  the LCP. Recompress (~150–200 kB) and serve AVIF/WebP with JPEG fallback.
- Google Fonts CSS is render-blocking; self-hosting the 3 families (or
  `font-display: optional` + preload) removes a third-party round trip and
  lets the CSP drop two origins.

## D. Trust, legal, and content

- **No privacy policy or terms anywhere** — while the product collects
  waitlist emails, logs every searched street address server-side (rendered
  as an admin "most searched" leaderboard), and sends user questions to a
  third-party AI. Concrete CCPA/GDPR surface and a credibility tell. Two
  static pages + a one-line disclosure near the search box.
- **The printed PDF can ship with zero disclaimer** — the print stylesheet
  hides the footer and NextSteps, and the in-body disclaimers render only if
  the engine populated them. The PDF is the artifact most likely to reach a
  lender. Hard-code a disclaimer into the print-only footer.
- **"You can't build this here." overclaims** for verdicts that rest on
  unit-count heuristics. Soften PROHIBITED to "This likely can't be built as
  proposed" and put "verify with the city" inside the banner.
- **False precision**: CostBreakdown prints "$4,182,400" and "$425/sq ft" on
  an order-of-magnitude model whose own KeyMetrics rounds to "$4.2M". Round
  line items to 2–3 significant figures.
- **One verdict enum, four label sets** (VerdictBanner / Compare /
  FeasibilityChecklist / Admin). Centralize one canonical map.
- **No contact path** — zero mailto: in the product. No data-vintage line on
  results ("zoning data as of …"), which is the first question any developer
  asks a reg-tech tool. "10 cities" is hard-coded prose in 5 places; derive
  from `CITIES.length`.
- **No analytics, no error monitoring, no uptime checks.** You cannot
  currently answer "did anyone use the site today?" or "is Chicago broken?"
  except by reading the admin log. Plausible/Fathom (CSP-friendly, no-cookie)
  + Sentry (or even just Netlify function-log alerts) + a free uptime ping.

## E. Product & conversion

- **The highest-intent moment dead-ends off-site.** A developer holding a
  green verdict + dollar figure gets one CTA: a link to a .gov permit office.
  No email capture, no save, no follow-up. The only email capture in the
  product (request-city) serves users you *can't* serve yet.
- **Nothing brings anyone back weekly.** Stateless, URL-only reports. The
  natural retention loop: "watch this parcel — email me if zoning changes."
- **Compare is invisible** outside the result page, uses three different
  labels for the same action, silently locks parcel B to parcel A's project
  spec (explained only in a footnote below the table), and comparison mode
  has no cancel once `?cmp=` is set.
- Blocked/no-coverage results render no CTA at all (dead end); SearchBar
  renders literally nothing if the Mapbox token is misconfigured; the wizard
  has no review step before generating a $100M report from a fat-fingered
  slider.
- No sample report linked from Home (cheapest credibility win for skeptics).

## F. Feature roadmap — more red tape, deeper analysis

Ordered roughly by (impact on the product's promise) ÷ (build effort), using
data the code already touches or that the same city portals publish.

**F1. Real permit timelines from real permit data.** Boston, NYC, SF, Seattle,
Chicago, Austin, LA publish open permit datasets with application → issuance
dates. Compute median/p80 durations by permit type and neighborhood, and show
"city says X, the data says Y" next to the estimate. Nothing else on the site
would scream "we read the records" louder, it's pure batch work (no live
upstream risk), and it's content-marketing gold per city.

**F2. Variance/relief approval odds.** Boston ZBA, NYC BSA, SF Planning all
publish decisions. For NEEDS_RELIEF verdicts, show the historical grant rate
for that relief type. Turns "needs city permission" from a shrug into a
probability — the single deepest upgrade to the verdict itself.

**F3. More red tape per parcel (each is one overlay/lookup away):**
- **Parking minimums** by zone — the most universally despised red-tape item;
  many of the 10 cities publish requirements or have abolished them (a story
  in itself: "this city would force you to build N stalls; this one, zero").
- **Setbacks / lot coverage / yard requirements** — the envelope currently
  checks only FAR + height; setbacks are the third leg and published in the
  same zoning tables already parsed.
- **Inclusionary zoning specifics** — Seattle's MHA fee area is already
  fetched and then ignored; Denver/LA/NYC publish IZ thresholds and fee
  schedules. Convert the generic "labor/affordability" hurdles into dollar
  figures.
- **Tree ordinances** (Austin heritage trees, Seattle exceptional trees),
  **steep-slope/ECA zones** (Seattle), **liquefaction/seismic zones** (SF),
  **wetlands/coastal** (Boston Ch. 91, LA Coastal Zone — partially present).
- **Utility tap/connection fees** (Austin, Denver publish schedules) — a real
  5-figure line item currently absent from cost.
- **FEMA flood consequences** — the flood flag exists; add what it *means*:
  elevation requirement + insurance cost order-of-magnitude.

**F4. "Does it pencil?" pro-forma lite.** Providers already fetch
`assessedValue` for several cities — surface a land-cost proxy, add a
rent/sale comp band (HUD FMR or Census median by ZIP is free), and show
yield-on-cost as a range. The current product answers "may I?"; developers'
real question is "should I?". Even a crude range makes Compare genuinely
decisive.

**F5. Red Tape Index.** Cross-city scorecard computed from the engine's own
constants + F1's measured timelines (months of process, fees per sf, relief
odds, parking burden). Annual "cost of red tape" ranking = the advocacy
thesis ("where it has gone too far") made quantitative, and a press magnet.

**F6. Parcel watch + report email (the retention loop).** "Email me this
report" and "alert me if zoning or rules change here." Pairs with E's email
capture; a weekly diff job over the zoning layers you already query.

**F7. Multi-scenario compare on one parcel.** Same lot, 3 programs (e.g.
4-story residential vs mixed vs ADU) side by side — the engine already takes
all inputs via URL; this is mostly a UI.

**F8. The API as a product.** business/api-landing.md already sketches it.
The deterministic /api/analyze is the asset; a keyed, documented, metered
endpoint is the obvious first revenue surface and demands the A-section
hardening first (error-200, tests, schema canaries).

**F9. Lot assembly.** "What if I combine this parcel with its neighbor?" —
adjacent-parcel query + merged-lot envelope. Developers do this manually today.

**F10. ADU rule packs.** The wizard already has an ADU project type; CA/MA/WA
state ADU laws are well-documented and would make the ADU path genuinely
city-accurate instead of generic.

## G. Suggested order of attack

1. **A1 + A10 + A11** (engine resilience trio) — protects everything else.
2. **B** — provider/envelope/timeline tests + GitHub Actions CI.
3. **C** — immutable asset caching, hero image, soft-404s (one afternoon).
4. **D** — privacy/terms, PDF disclaimer, PROHIBITED softening, rounding,
   contact, data-vintage line (one day, mostly copy).
5. **A2–A9** — verdict-correctness fixes, in that order.
6. **E + F6** — result-page email capture + parcel watch (the conversion fix).
7. **F1 → F2 → F3** — the moat: measured timelines, relief odds, more red tape.
