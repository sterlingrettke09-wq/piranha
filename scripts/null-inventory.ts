// Regenerate docs/NULL-INVENTORY.md from LIVE probes.
//
// WHY THIS IS A SCRIPT AND NOT A DOCUMENT
// The inventory is a measurement of the system, and a hand-written one drifts
// from it. Within a single session (2026-08-04 → 05) three entries went stale:
// Chicago was recorded unresolved while B3-2 resolves, San Diego's probe
// coordinate was a landmark rather than a parcel, and Philadelphia's RM
// districts began resolving once the FAR parser was fixed.
//
// That matters more than it sounds. The inventory determines what work is worth
// doing — a wrong entry misdirects the whole backlog. It is the same failure as
// measuring your probe instead of the pipeline (CLAUDE.md rule 11), one level up.
//
// Every entry carries the timestamp it was verified. An inventory without
// timestamps cannot tell you which parts of it you still trust.
//
// ⚠️ AND THE RETRY USED TO HIDE THE THING IT WAS ADDED TO PROTECT (fixed
// 2026-08-11). `probe()` retried up to 3× whenever a city came back with
// `districtCode: 'Unknown'` and returned the first clean result. That is rule 10
// done right for the RECORDED verdict — a transient failure must not be written
// down as a permanent one. But the retry was also the only place the failure was
// ever observed, and nothing counted it. Phoenix fails roughly one call in five;
// three tries make that resolve cleanly on ~99% of runs, so the document reported
// 23 of 23 cities clean while one of them was failing 19% of requests.
//
// The instrument was measuring the BEST case and publishing it as the state. That
// is rule 18 inside the tool: the retry produced an answer, an answer gets less
// scrutiny than a gap, and the discarded attempts were the measurement.
//
// So: the retry stays, the recorded verdict still comes from the first clean
// call, and every call is now COUNTED. Each city is sampled a fixed number of
// times with no early exit — an early exit biases the sample towards success by
// construction — and the doc prints clean/total per city. A city that needed a
// second attempt can no longer render identically to one that needed none.
//
//   npx vite-node scripts/null-inventory.ts          # print
//   npx vite-node scripts/null-inventory.ts --write  # rewrite the doc

// ⚠️ AND THE ONE PARCEL WAS BEING READ AS THE CITY (fixed 2026-08-12). Every
// caveat above is about whether the probe ANSWERED. None of them touches the
// deeper problem: the probe is a single hand-picked parcel, and its Outcome
// column was the city's row. Denver's probe is `G-MU-5`, a current form-based
// DZC district that resolves cleanly six times out of six — and the 575-parcel
// live sample drew `R-2` / `O-1` / `I-B` / `H-1-A`, former Chapter 59 codes that
// fall through, withholding the verdict on 4 of the 6 developable parcels the
// pipeline answered for. Denver's row read exactly like Chicago's, which
// withheld none. Same for Las Vegas (2 of 9 resolved), Miami (5 of 15), Austin
// (6 of 14) and LA (7 of 16).
//
// Nothing was misreported. The Method section at the foot of this file said so
// in as many words — "a single probed parcel does not characterise a whole
// city" — and it was read as a rate anyway, because a table of one-per-city
// verdicts is a rate-shaped object. A caveat under a table does not survive
// contact with the table.
//
// So the row now carries BOTH. The golden parcel stays: it is a fixed point, its
// stability check catches provider drift, and replacing it with an aggregate
// would trade a regression signal for a headline. Beside it is `Sampled rate` —
// the share of sampled developable parcels for which the envelope actually
// resolved, with its denominator — read from the committed measurement
// `netlify/functions/lib/data/envelopeSample.json`. A city that resolves a third
// of the time can no longer render identically to one that resolves always.

import { writeFileSync } from 'node:fs'
import { getParcelInfo, type ParcelResult } from '../netlify/functions/lib/parcel'
import { buildDefaultSpec } from '../src/lib/defaultSpec'
import { assessFeasibility } from '../netlify/functions/lib/feasibility'
import { EXAMPLE_PARCELS } from '../src/config/exampleParcels'
import {
  envelopeSample,
  envelopeSampleLabel,
  ENVELOPE_SAMPLED_CITIES,
  type EnvelopeSample,
} from '../src/config/envelopeSample'

/** Probe points for cities without a published example parcel. Chosen to land on
 *  a real parcel — a city landmark is often a street or a plaza (San Diego's
 *  first probe returned NO_PARCEL for exactly that reason). */
const EXTRA: Record<string, [number, number]> = {
  // Derived from a DOR_Parcel centroid, not guessed. The previous point
  // (39.97, -75.17) returned NO_PARCEL on two of three isolated re-probes and a
  // valid RSA-5 parcel on the third — an unstable probe reads as an upstream
  // defect when it is really a coordinate sitting off a parcel edge.
  philadelphia: [39.9208, -75.23192],
  miami: [25.7743, -80.1918],
  // ⚠️ BOTH REPLACED 2026-08-06. The old points were civic land, and each failed
  // in its own way:
  //   · sandiego [32.7157, -117.1611] — Horton Plaza, city-owned. It sits on
  //     OVERLAPPING ownership polygons, so the exact-match query returns several
  //     features that all contain the point, "nearest" cannot discriminate, and
  //     the server's ordering decides. Four calls returned parcelIds 5861800900
  //     and 4174800800 at lot sizes 97,106 / 39,615 / 21,389 / 8,500 sq ft. This
  //     is NOT the unstable-edge failure the Philadelphia comment records — that
  //     was a point off any parcel; this is a point on too many.
  //   · sanjose [37.3382, -121.8863] — a PQP public/quasi-public lot.
  // Both were non-developable, so analyze.ts zeroed their hurdles and NEITHER
  // city's regulatory encoding was exercised by this inventory at all. The rows
  // measured a blocked parcel, not the city.
  // Replacements are ordinary residential parcels, each verified STABLE over four
  // isolated re-probes (same parcelId and lot size every time).
  sandiego: [32.735, -117.129], // RS-1-7, 7,958 sq ft, parcel 4536510700
  sanjose: [37.345, -121.9], // R-1-8, 5,018 sq ft, parcel 25919043
  nashville: [36.1627, -86.7816],
  // 810 Daniels St — R-6, 9,433 sq ft, parcel 1704142690, privately owned,
  // one existing dwelling, no historic/NCOD/TOD overlay, FEMA zone X.
  //
  // Chosen the way the San Diego and San Jose replacements were: from a parcel
  // QUERY, not from a landmark. Filtered on the Wake County attributes for an
  // ordinary developable residential lot (PLANNING_JURISDICTION 'RA' so it is
  // Raleigh and not Cary or Apex, LAND_CLASS_DECODE 'Residential Less Than 10
  // Acres', TOTUNITS 1, 7,000–11,000 sq ft), then took the polygon's own
  // centroid rather than an address pin — an address pin is what put the old
  // Philadelphia probe off a parcel edge.
  //
  // STABILITY VERIFIED BEFORE ADOPTION, through getParcelInfo (the real entry
  // point), not the provider: two independent runs of four isolated calls each,
  // 400 ms apart, eight calls total. Every one returned parcelId 1704142690 and
  // lot 9,433 sq ft — one distinct value, not "close enough". This is the check
  // San Diego's old probe failed by returning two parcelIds at four different
  // lot sizes, and it is invisible to any single call.
  //
  // It is DEVELOPABLE, which is the second thing both replaced probes got
  // wrong: a blocked parcel makes analyze.ts zero the hurdles, so the row
  // measures the block rather than the city. This one runs the real path —
  // verdict AS_OF_RIGHT, farBasis 'unconstrained'.
  raleigh: [35.79544, -78.65841],

  // ── The 2026-08-08 cohort ────────────────────────────────────────────────
  // All four picked by the Raleigh method and held to the same two properties,
  // so the reasoning is written once here rather than four times:
  //
  //   CHOSEN FROM A PARCEL QUERY, NOT A LANDMARK. Each city's parcel layer was
  //   filtered for an ordinary developable single-dwelling lot in the 6,000–
  //   9,500 sq ft band, government owners excluded, and the point taken is the
  //   POLYGON'S OWN CENTROID.
  //
  //   ⚠️ AND THE CENTROID WAS TESTED FOR CONTAINMENT, which is a step Raleigh's
  //   note does not mention because Raleigh did not need it. Charlotte did. The
  //   first Charlotte candidate — a 6,365 sq ft lot on Kaybird Ln — has a
  //   concave footprint whose area-weighted centroid falls OUTSIDE it, in the
  //   neighbouring 50,192 sq ft parcel. `getParcelInfo` answered stably and
  //   developably, with a real address and a real district, so all four calls
  //   agreed and nothing looked wrong: the probe would have been adopted, and
  //   the comment recording "filtered for a ~6,400 sq ft single-family lot"
  //   would have been false about the parcel actually measured. Rule 18 — the
  //   wrong answer was the one that looked like an answer. Candidates are now
  //   ray-cast against their own rings and rejected if the centroid is not
  //   inside; the adopted Charlotte point is a different parcel entirely.
  //
  //   STABILITY VERIFIED BEFORE ADOPTION, through getParcelInfo (the real entry
  //   point) and not the providers: two independent runs of four isolated calls
  //   each, 400 ms apart — EIGHT calls per city. Every call returned one
  //   distinct parcelId, one distinct lot size and one distinct districtCode.
  //   This is the check San Diego's old probe failed by returning two parcelIds
  //   at four lot sizes, and it is invisible to any single call.
  //
  //   ALL FOUR ARE DEVELOPABLE — privately owned, no government owner, no
  //   historic overlay, FEMA zone X — which is the second thing the replaced
  //   San Diego and San Jose probes got wrong. A blocked parcel makes
  //   analyze.ts zero the hurdles, so the row measures the block rather than
  //   the city.

  // 9221 N BURBANK AV — RS4, 7,559 sq ft, parcel (TAXKEY) 0050006000, one
  // dwelling unit, privately owned. Filter: C_A_CLASS '1' (residential),
  // NR_UNITS 1, PARCEL_TYPE 0, LOT_AREA 6,000–9,000, ZONING LIKE 'RS%'.
  // PARCEL_TYPE is worth noting: 0 is the ordinary parcel and 1 is the
  // condominium row type — the stacked-parcel case the provider's
  // `selectParcel` exists for — so filtering to 0 avoids probing a stack.
  milwaukee: [43.185337, -88.015701],

  // 145 N EUREKA AVE — R4, 9,563 sq ft, parcel 010-000045, privately owned, no
  // overlay. Filter: COUNTY 'FRANKLIN', CLASSDSCRP LIKE 'SINGLE FAMILY%',
  // ACRES 0.14–0.22. The returned lot size is ACRES × 43,560 exactly
  // (0.21952586 → 9,563), which is the provider's only lot-area path;
  // STATEDAREA — the decoy holding square feet on ~78% of Franklin County
  // parcels and acres on the rest — is unreachable by construction.
  //
  // ⚠️ THE FIRST CANDIDATE WAS REJECTED, AND WHY IS WORTH KEEPING. 1364 Forsythe
  // Ave (parcel 010-000015, R4, 8,804 sq ft) is equally stable, equally
  // developable, and equally private — and it sits inside the UNIVERSITY
  // DISTRICT ZONING OVERLAY, where C.C. Ch. 3325 imposes a floor-area ratio
  // that varies by subarea, by project type, and for apartment-residential lots
  // on the average originally-platted lot size within 200 ft. The provider
  // resolves that correctly: `farUnconstrained` is NOT set, `farBasis` is null,
  // and the verdict is withheld as INDETERMINATE — the base district and the
  // overlay read jointly, which is rule 13 working.
  //
  // But the inventory row it produced said `GAP — verdict withheld` for
  // Columbus, and that would have been a true statement about one parcel and a
  // false impression of the city: Columbus's Title 33 FAR is a READ, STATED
  // ABSENCE across 40-odd districts, not an unresolved lookup. This file's own
  // header says the inventory determines what work is worth doing, so a row
  // reading GAP would have put "columbus — FAR research" in the backlog for
  // work already done. Same failure shape as the Chicago 1,528 entry.
  //
  // The replacement is the SAME district (R4) outside the overlay, so the swap
  // changes the overlay exposure and nothing else.
  columbus: [39.958354, -83.06604],

  // 2127 CRESCENT AV — N1-C, 9,412 sq ft, parcel 15503104, one dwelling unit,
  // privately owned. Filter: municipality 'CHARLOTTE', descpropertyuse
  // 'Single-Family', units 1, totalac 0.14–0.24, restricted to parcels inside a
  // mapped N1-C polygon.
  //
  // The district choice is deliberate. Charlotte's zoning layer carries 218
  // distinct ZoneDes values and a large share are CONDITIONAL variants —
  // 'R-8(CD)' and the like — which UDO Sec. 1.4.C expressly leaves under the
  // PRIOR (1992) ordinance. The first stable candidate found landed on
  // R-8(CD). A probe there would have measured the legacy-conditional path on
  // every run and never once exercised the UDO table this city was built
  // around, which is the San Jose failure in a different costume: a row that
  // looks like a city measurement and is really a measurement of one branch.
  charlotte: [35.205662, -80.820579],

  // 2278 OAKVIEW ROAD NE — R-4, 7,274 sq ft, parcel 15 205 01 141, privately
  // owned. Filter: SITECITY 'ATLANTA', CLASSDSCRP 'R3' (the Georgia assessment
  // class for residential), SHAPE.AREA 6,000–9,000 applied client-side.
  //
  // Two notes so the filter is not copied blind. LIVUNITS is NULL on ordinary
  // Fulton rows, so a `LIVUNITS=1` clause returns zero features rather than
  // "single-family lots" — checked, not assumed. And SHAPE.AREA cannot be used
  // in a where clause on this layer at all (the server returns HTTP 400 on the
  // qualified name, quoted or not), which is why the size band was applied to
  // the returned attribute instead. The returned lot size, 7,274, is
  // SHAPE.AREA verbatim — the provider converts nothing.
  atlanta: [33.751563, -84.313204],

  // ── The 2026-08-09 cohort ────────────────────────────────────────────────
  // All three chosen from a PARCEL QUERY on the layer's own attributes, then
  // taken as the polygon's own centroid rather than an address pin, and all
  // three stability-checked over repeated isolated calls before adoption.
  //
  // All three cities also gained a CITY-BOUNDARY GATE in this session (their
  // parcel layers are regional and each has a neighbouring jurisdiction inside
  // its bbox), so a probe point must now be inside the city POLYGON and not
  // merely inside the rectangle. Each point below was re-checked against its
  // city's boundary layer, not assumed from the bbox.

  // 7322 THURSTON DR — R-7.5(A), 7,610 sq ft, account 00000213379000000,
  // privately owned, SPTBCODE 'A11' (single family residence), FEMA zone X, no
  // historic / SUP / PD overlay. Filter: CITY='DALLAS', SPTBCODE='A1',
  // AREA_FEET 7,600–8,600. Verified developable through the real
  // `assessDevelopability` → { developable: true, reason: null }, and stable
  // over four isolated calls 400 ms apart — one distinct
  // (ACCT, AREA_FEET, LONG_ZONE_DIST) triple.
  dallas: [32.833874, -96.851017],

  // 4617 PROVIDENCE LN — R-1, 7,064 sq ft, parcel 13931210029, privately owned,
  // single-family (LUCODE 110, CONSTYR 1961), FEMA zone X. Filter: ZONE='R-1'
  // AND SHAPE_Area 7,000–11,000, then LUCODE 110 and STRCITY='LV'.
  //
  // ⚠️ The lot figure is SHAPE_Area, never LOTSQFT. On this parcel LOTSQFT reads
  // 1,690 — the RESIDENTIAL BUILDING floor area — so a probe reading it would
  // have recorded a 7,064 sq ft lot as 1,690 and looked entirely plausible.
  // Stability verified through the provider's exported entry point: two
  // independent runs of four isolated calls, eight in all, every one returning
  // parcel 13931210029 at 7,064 sq ft, R-1. One distinct value.
  lasvegas: [36.169485, -115.203709],

  // 805 W AMELIA AVE — R1-6, 7,025 sq ft, APN 110-11-022, privately owned, no
  // overlay, no historic listing, FEMA zone X. Filter: DESCRIPTION LIKE 'SFR%',
  // 7,000–11,000 sq ft, inside a central-Phoenix envelope.
  //
  // Neighbouring candidates were rejected because they fall inside the Campus
  // Vista Historic District — the same reasoning that moved the Columbus probe
  // out of the University District overlay, and for the same reason: a probe
  // sitting under an overlay measures the overlay path on every run and never
  // exercises the base table the city was built around. Stability verified
  // through the provider entry point over six isolated calls 400 ms apart:
  // one distinct 110-11-022 | 7025 | R1-6 | 30 ft | 2 storeys.
  phoenix: [33.493479, -112.08442],
}

const CITIES = [
  'boston', 'nyc', 'chicago', 'sf', 'seattle', 'dc', 'austin', 'la',
  'denver', 'minneapolis', 'philadelphia', 'miami', 'sandiego', 'sanjose', 'nashville',
  'raleigh', 'milwaukee', 'columbus', 'charlotte', 'atlanta',
  'dallas', 'lasvegas', 'phoenix',
]

interface Row {
  city: string
  district: string
  farBasis: string
  gfaBasis: string
  verdict: string
  outcome: string
  note: string
  rel: Reliability
  /** The city's measured resolve rate, from the committed multi-parcel sample.
   *  Beside the golden parcel, never instead of it. */
  sample: EnvelopeSample
}

/** How many isolated calls each city gets. FIXED, and taken with no early exit.
 *
 *  6 is not an increase in live load: the old code made up to 3 retry calls plus
 *  3 unconditional stability calls, so 6 was already the worst case. It is now
 *  the only case, and one sample answers both questions (does it resolve, and
 *  does it land on the same parcel) instead of two samples answering one each. */
const CALLS_PER_CITY = 6
const CALL_GAP_MS = 400

export type Prober = (city: string, lat: number, lng: number) => Promise<ParcelResult>

/** What one live call produced, reduced to the two axes this document reports. */
export type CallOutcome = 'clean' | 'unknown-district' | 'error'

export interface ProbeCall {
  outcome: CallOutcome
  /** `parcelId/lotSqFt` — the identity axis. `ERR` when the call failed. */
  identity: string
}

export function classify(r: ParcelResult): ProbeCall {
  if (!r.ok) return { outcome: 'error', identity: 'ERR' }
  return {
    outcome: r.info.zoning.districtCode === 'Unknown' ? 'unknown-district' : 'clean',
    identity: `${r.info.parcelId}/${r.info.lot.sizeSqFt}`,
  }
}

export interface Reliability {
  calls: number
  clean: number
  /** 1-based index of the first clean call; null if none ever came back clean. */
  firstCleanAt: number | null
  /** Distinct parcel identities across the sample.
   *
   *  A point inside OVERLAPPING parcel polygons returns an arbitrary one: every
   *  candidate contains it, so `nearestFeatureSet()` has no tiebreak and the
   *  server's ordering decides. San Diego's old probe did exactly this — four
   *  calls gave two parcelIds at lot sizes 97,106 / 39,615 / 21,389 / 8,500 sq ft.
   *  A single call always looks fine, which is why it went unnoticed.
   *
   *  >1 means the COORDINATE is ambiguous, not that the city is broken — and note
   *  that this axis is INDEPENDENT of `clean`. That independence is how the
   *  Phoenix failure survived: identity was sampled unconditionally and district
   *  resolution was not, and a call that returns the right parcel with
   *  `districtCode: 'Unknown'` is stable on this axis and dirty on the other. */
  identities: string[]
  stable: boolean
  outcomes: CallOutcome[]
}

export function reliability(calls: ProbeCall[]): Reliability {
  const identities = [...new Set(calls.map((c) => c.identity))]
  const firstClean = calls.findIndex((c) => c.outcome === 'clean')
  return {
    calls: calls.length,
    clean: calls.filter((c) => c.outcome === 'clean').length,
    firstCleanAt: firstClean === -1 ? null : firstClean + 1,
    identities,
    // An unsampled city is NOT stable. Zero observations agreeing with each other
    // is the vacuous pass of rule 20; `seen.size === 1` used to call it stable.
    stable: calls.length > 0 && identities.length === 1,
    outcomes: calls.map((c) => c.outcome),
  }
}

/** Sample a city `calls` times with NO early exit, and report both the full
 *  sample and the result that should be RECORDED.
 *
 *  The two halves are deliberately different, and that is the whole fix:
 *
 *  · `recorded` is the FIRST CLEAN call if there was one. Rule 10 stands — a
 *    transient `Unknown` under load must not be written down as a permanent
 *    failure. Chicago returned `Unknown` once during a 15-city batch and resolved
 *    to `B3-2` on three consecutive isolated re-probes.
 *  · `calls` is EVERY attempt, including the ones the retry threw away. Stopping
 *    at the first success would sample until the answer is good and then report
 *    it, which is how a 19%-failing city came to be published as clean.
 *
 *  `prober` is injected so the accounting can be tested without touching a live
 *  service — the accounting is the part that was broken, and it must not be
 *  checkable only by hitting a city and hoping it misbehaves. */
export async function sampleCity(
  city: string,
  lat: number,
  lng: number,
  opts: { calls?: number; gapMs?: number; prober?: Prober } = {},
): Promise<{ calls: ProbeCall[]; recorded: ParcelResult | null }> {
  const n = opts.calls ?? CALLS_PER_CITY
  const gap = opts.gapMs ?? CALL_GAP_MS
  const prober = opts.prober ?? getParcelInfo
  const calls: ProbeCall[] = []
  let firstClean: ParcelResult | null = null
  let last: ParcelResult | null = null
  for (let i = 0; i < n; i++) {
    const r = await prober(city, lat, lng)
    const c = classify(r)
    calls.push(c)
    last = r
    if (c.outcome === 'clean' && firstClean == null) firstClean = r
    if (i < n - 1 && gap > 0) await new Promise((res) => setTimeout(res, gap))
  }
  return { calls, recorded: firstClean ?? last }
}

/** The per-row cell. The DENOMINATOR is always printed.
 *
 *  Rule 20 applied to this column: a bare "clean" can be produced by a sample of
 *  zero, and a reader cannot tell those apart. `6/6` and `0/0` cannot be
 *  confused; "clean" and "clean" can. */
export function reliabilityCell(rel: Reliability): string {
  if (rel.calls === 0) return '**NOT SAMPLED**'
  const base = `${rel.clean}/${rel.calls}`
  if (rel.clean === rel.calls) return base
  if (rel.clean === 0) return `**${base} — never clean**`
  return `⚠️ **${base}** (first clean on call ${rel.firstCleanAt})`
}

/** The `Sampled rate` cell, beside the golden parcel's Outcome.
 *
 *  Rule 20 again, and for the same reason the `Live sample` column prints its
 *  denominator: the two states with no rate must not render as a blank, because
 *  a blank is also what a fully-resolving city would look like if the column
 *  ever went quiet. `envelopeSampleLabel` returns words — "not sampled", "no
 *  sample (0 of 25)" — for exactly those two.
 *
 *  A rate below 100% is bolded. The point of the column is that Denver's row and
 *  Chicago's row used to be identical; a difference nobody's eye lands on is
 *  half a fix. */
export function sampledRateCell(s: EnvelopeSample): string {
  const label = envelopeSampleLabel(s)
  if (s.kind !== 'measured') return `**${label}**`
  return s.resolved === s.n ? label : `**${label}**`
}

/** The paragraph under the table, ranked worst-first.
 *
 *  Cannot pass by finding nothing: an empty city list is stated as such and
 *  named as a measurement failure, not printed as a clean run. */
export function sampledRateSummary(slugs: string[]): string {
  const rows = slugs.map((slug) => ({ slug, s: envelopeSample(slug) }))
  const unmeasured = rows.filter((r) => r.s.kind === 'unmeasured').map((r) => r.slug)
  const noDenom = rows.filter((r) => r.s.kind === 'no-denominator').map((r) => r.slug)
  const measured = rows.flatMap((r) => (r.s.kind === 'measured' ? [{ slug: r.slug, s: r.s }] : []))

  if (rows.length === 0 || measured.length === 0)
    return [
      '**⚠️ NO SAMPLED RATES AVAILABLE — the committed measurement is empty or unreadable.**',
      '',
      'Every `Sampled rate` cell above is therefore a non-answer, and the Outcome',
      'column beside it is once again one parcel being read as a city. Re-run',
      '`npx vite-node scripts/smoke-parcels.ts`; do not publish this file.',
    ].join('\n')

  const n = measured.reduce((a, m) => a + m.s.n, 0)
  const ok = measured.reduce((a, m) => a + m.s.resolved, 0)
  // The two columns are dated INDEPENDENTLY and the header's "verified live on
  // the date shown" is about the probe, not about this. Saying so matters most
  // exactly when they disagree — a city whose probe failed today can still carry
  // a rate measured last week, and the reader has to be able to see that.
  const dates = [...new Set(measured.map((m) => m.s.counts.sampledOn))].sort()
  const when =
    dates.length === 1
      ? `Measured ${dates[0]}`
      : `Measured per city between ${dates[0]} and ${dates[dates.length - 1]}`
  const out = [
    `**Sampled rate: ${ok} of ${n} sampled developable parcels across ${cityN(measured.length)} resolved an envelope (${pct(ok / n)}).**`,
    `${when} — a different run from the golden-parcel probe above, so the two`,
    'columns can carry different dates, and a probe failing today does not erase a',
    'rate measured earlier (nor the other way round).',
    '',
  ]
  if (unmeasured.length)
    out.push(
      `**⚠️ ${cityN(unmeasured.length)} NOT SAMPLED** — ${unmeasured.join(', ')}. Their Outcome`,
      'column is one parcel and nothing else. An unsampled city is not a resolving one.',
      '',
    )
  if (noDenom.length)
    out.push(
      `**⚠️ ${cityN(noDenom.length)} sampled with NO DENOMINATOR** — ${noDenom.join(', ')}: not one`,
      'sampled parcel came back both answered and developable, so there is no rate.',
      '',
    )
  const worst = [...measured].sort((a, b) => a.s.share - b.s.share).filter((m) => m.s.share < 1)
  if (worst.length)
    out.push(
      `**${cityN(worst.length)} resolve for less than every sampled parcel**, worst first — ${worst
        .map((m) => `${m.slug} ${m.s.resolved}/${m.s.n} (${pct(m.s.share)})`)
        .join(', ')}.`,
      '',
      'Read the Outcome column beside these with the rate in hand. The probe is one',
      'hand-picked parcel, and for the low rows it is a parcel that works in a city',
      'where most do not — Denver’s `G-MU-5` is a current form-based DZC district,',
      'while the sample drew former Chapter 59 codes that fall through.',
      '',
    )
  else
    out.push(
      `Every sampled city resolved an envelope for all ${n} of its sampled developable`,
      'parcels. That is a statement about the parcels the sampler drew, not a',
      'guarantee: the denominators are printed per row precisely because a rate of',
      '100% over 6 parcels and one over 25 are different claims.',
      '',
    )
  return out.join('\n').trimEnd()
}

/** Given `n` consecutive clean calls, the highest per-call failure rate still
 *  consistent with that at 95% one-sided: `1 - 0.05^(1/n)`.
 *
 *  This exists so the clean case cannot be read as a measurement of zero. Six
 *  clean calls admit a true failure rate near 40% — which is roughly twice
 *  Phoenix's actual 19%, i.e. this sample size would have caught Phoenix most
 *  runs but certifies nothing about a city it did not catch. */
export function failureCeiling(n: number): number {
  return n > 0 ? 1 - Math.pow(0.05, 1 / n) : 1
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const cityN = (n: number) => `${n} ${n === 1 ? 'city' : 'cities'}`

/** The paragraph under the table. It must be impossible for this to read as a
 *  clean run when nothing was measured, so every branch names its denominator
 *  and the empty case is loud rather than absent. */
export function reliabilitySummary(rows: Array<{ city: string; rel: Reliability }>): string {
  const observations = rows.reduce((n, r) => n + r.rel.calls, 0)
  if (rows.length === 0 || observations === 0)
    return [
      '**⚠️ NO OBSERVATIONS RECORDED — this run sampled nothing.**',
      '',
      'The table above is not evidence of anything, clean or otherwise. This line',
      'exists because a reliability column that renders blank on an empty sample is',
      'indistinguishable from one that renders blank on a healthy system (rule 20).',
      'Re-run the inventory; do not publish this file.',
    ].join('\n')

  const clean = rows.reduce((n, r) => n + r.rel.clean, 0)
  const sizes = [...new Set(rows.map((r) => r.rel.calls))]
  const shape =
    sizes.length === 1
      ? `${rows.length} cities × ${sizes[0]} isolated calls = ${observations} observations`
      : `${observations} observations across ${rows.length} cities`

  const unsampled = rows.filter((r) => r.rel.calls === 0)
  const never = rows.filter((r) => r.rel.calls > 0 && r.rel.clean === 0)
  const intermittent = rows.filter((r) => r.rel.clean > 0 && r.rel.clean < r.rel.calls)

  const out = [`**Sample: ${shape}; ${clean} came back clean (${pct(clean / observations)}).**`, '']

  if (unsampled.length)
    out.push(
      `**⚠️ ${cityN(unsampled.length)} NOT SAMPLED** — ${unsampled.map((r) => r.city).join(', ')}.`,
      'Their rows describe nothing. An unsampled city is not a clean one.',
      '',
    )
  if (never.length)
    out.push(
      `**⚠️ ${cityN(never.length)} never came back clean** — ${never.map((r) => `${r.city} 0/${r.rel.calls}`).join(', ')}.`,
      '',
    )
  if (intermittent.length)
    out.push(
      `**⚠️ ${cityN(intermittent.length)} INTERMITTENT** — ${intermittent
        .map((r) => `${r.city} ${r.rel.clean}/${r.rel.calls} (first clean on call ${r.rel.firstCleanAt})`)
        .join(', ')}.`,
      '',
      'The recorded row for each is the first CLEAN call, which is right — a',
      'transient failure must not be written down as a permanent one (rule 10). But',
      'a user of these cities hits the failure at the rate shown, and before',
      '2026-08-11 this document rendered them exactly like a city that never failed.',
      '',
    )
  if (!unsampled.length && !never.length && !intermittent.length) {
    const n = Math.min(...rows.map((r) => r.rel.calls))
    out.push(
      `Every one of the ${observations} observations came back clean on the first call.`,
      '',
      `**Read that as "no intermittent failure was OBSERVED", not as "the failure`,
      `rate is zero".** ${n} clean calls for a city are still consistent with a true`,
      `per-call failure rate of up to ${pct(failureCeiling(n))} (95% one-sided). This paragraph`,
      'names its own denominator so that a run which sampled nothing cannot render',
      'as a clean one — the failure this column was added to fix was precisely a',
      'green reading produced by discarded evidence.',
      '',
    )
  }
  return out.join('\n').trimEnd()
}

async function main() {
  const stamp = new Date().toISOString().slice(0, 10)
  const rows: Row[] = []

  for (const city of CITIES) {
    const ex = EXAMPLE_PARCELS[city]
    const [lat, lng] = ex ? [ex.lat, ex.lng] : EXTRA[city]
    const { calls, recorded: r } = await sampleCity(city, lat, lng)
    const rel = reliability(calls)
    if (rel.clean < rel.calls)
      console.warn(
        `  ⚠️ ${city}: ${rel.calls - rel.clean} of ${rel.calls} calls did not resolve — ${rel.outcomes.join(',')}`,
      )
    if (!rel.stable)
      console.warn(`  ⚠️ ${city}: probe UNSTABLE — ${rel.identities.join(' | ')} (overlapping parcels?)`)
    const sample = envelopeSample(city)
    if (!r || !r.ok) {
      rows.push({ city, district: '—', farBasis: '—', gfaBasis: '—', verdict: '—',
        outcome: 'PROBE FAILED', note: 'not a pass — re-run before trusting', rel, sample })
      continue
    }
    const env = r.info.envelope
    const spec = buildDefaultSpec(r.info, city)
    const verdict = spec ? assessFeasibility(r.info, spec).overall : 'n/a'
    const farBasis = env?.farBasis ?? 'null'
    const gfaBasis = spec?.gfaBasis ?? 'no-spec'

    // `no-spec` is its own outcome, NOT a gap. Rule 5, applied to this
    // instrument's own output: a parcel that resolved an envelope too small to
    // hold the smallest default program (or gave no size basis at all) declined
    // to produce a spec deliberately — that is an answer about the parcel, and
    // it must not print as "no FAR resolvable", which is a hole in our data.
    const outcome =
      gfaBasis === 'envelope' ? 'RESOLVED'
      : gfaBasis === 'assumed-unconstrained' ? 'UNCONSTRAINED (an answer)'
      : gfaBasis === 'no-spec' ? 'NO DEFAULT SPEC (an answer)'
      : 'GAP — verdict withheld'
    const note =
      gfaBasis === 'envelope' ? `FAR ${r.info.zoning.maxFAR ?? '(per-use)'} from published data`
      : gfaBasis === 'assumed-unconstrained' ? 'code affirmatively imposes no FAR; lot area is a placeholder'
      : gfaBasis === 'no-spec' ? `envelope ${env?.maxFloorAreaSqFt ?? 'null'} sq ft — too small for a default program, or no size basis; the panel offers the wizard instead`
      : 'no FAR resolvable; cost/timeline still estimated and disclosed'

    rows.push({
      city,
      district: String(r.info.zoning.districtCode).slice(0, 22),
      farBasis, gfaBasis, verdict, outcome, rel, sample,
      note: rel.stable ? note : `${note} ⚠️ PROBE UNSTABLE — returned ${rel.identities.length} different parcels; this row is not reproducible`,
    })
  }

  const resolved = rows.filter((r) => r.gfaBasis === 'envelope').length
  const unc = rows.filter((r) => r.gfaBasis === 'assumed-unconstrained').length
  const gaps = rows.filter((r) => r.gfaBasis === 'assumed-far-1.0').length
  const noSpec = rows.filter((r) => r.gfaBasis === 'no-spec').length
  const failed = rows.filter((r) => r.outcome === 'PROBE FAILED').length
  // These four buckets are published as this document's headline, so they must
  // PARTITION the rows: a city landing outside all of them would vanish from the
  // summary while the table still listed it, which is the shape of a count that
  // reads clean because it stopped seeing something (rule 20).
  if (resolved + unc + gaps + noSpec + failed !== rows.length) {
    throw new Error(
      `null-inventory: ${rows.length} rows but ${resolved + unc + gaps + noSpec + failed} counted — a gfaBasis the summary does not bucket`,
    )
  }

  // The narrative below names five cities by their measured rate. Those figures
  // are READ from the artifact, never typed — a hand-typed count in a generated
  // document is the failure this file already records once (the stale test
  // count), and prose is exactly where a retracted number survives longest
  // (rule 17: headers and summaries are read FIRST).
  const rateStr = (slug: string): string => {
    const s = envelopeSample(slug)
    return s.kind === 'measured' ? `${s.resolved} of ${s.n}` : `**${envelopeSampleLabel(s)}**`
  }
  const attemptedStr = (slug: string): string => {
    const s = envelopeSample(slug)
    return s.kind === 'unmeasured' ? 'an unrecorded number of' : String(s.counts.attempted)
  }
  const nStr = (slug: string): string => {
    const s = envelopeSample(slug)
    return s.kind === 'measured' ? String(s.n) : 'no'
  }
  const denverAttempted = attemptedStr('denver')
  const lasVegasN = nStr('lasvegas')
  const lasVegasAttempted = attemptedStr('lasvegas')

  const md = `# Null inventory — what the tool actually knows

**GENERATED, not hand-written.** Run \`npx vite-node scripts/null-inventory.ts --write\`.
Every entry below was verified live on the date shown.

A hand-maintained version of this file drifted from the system inside a single
session: Chicago sat recorded as unresolved while \`B3-2\` resolves, San Diego's
probe coordinate was a landmark rather than a parcel, and Philadelphia's RM
districts started resolving once the FAR parser was corrected. **The inventory
determines what work is worth doing, so a stale entry misdirects the backlog** —
the same failure as measuring your probe instead of the pipeline (rule 11), one
level up.

**This is the artifact that says whether the tool is fit to ship — not the test
count.** The whole suite passes whether a city resolves a FAR or assumes one —
and, until 2026-08-11, whether a city answered every request or one in five.
(A hand-typed test count used to sit here; the suite had grown well past it. A
generated document should not carry a number its generator cannot see.)

## Verified ${stamp}

Two independent columns, measuring two different things. **Read the last one
first.**

- \`Live sample\` — clean calls / calls made, from ${CALLS_PER_CITY} isolated calls to the ONE
  golden parcel. Does the pipeline answer? See
  [why that column exists](#why-there-is-a-live-sample-column).
- \`Outcome\` / \`Verdict\` / \`What it means\` — what the pipeline returned **for that
  one parcel.** A fixed point, not a rate.
- \`Sampled rate\` — over a multi-parcel live sample drawn from the city's own
  parcel layer, the share of DEVELOPABLE, answered parcels for which the envelope
  actually resolved, and the \`n\` it is over. This is the column that describes
  the city. See [why it was added](#why-there-is-a-sampled-rate-column).

| City | District probed | Live sample | Outcome | Verdict | Sampled rate | What it means |
|---|---|---|---|---|---|---|
${rows.map((r) => `| ${r.city} | \`${r.district}\` | ${reliabilityCell(r.rel)} | **${r.outcome}** | ${r.verdict} | ${sampledRateCell(r.sample)} | ${r.note} |`).join('\n')}

**Golden parcel, one per city: ${resolved} resolved from published data · ${unc} unconstrained (an answer) · ${gaps} gaps · ${noSpec} no default spec · ${failed} probe failures.**
Those five counts describe ${cityN(rows.length)}' worth of hand-picked parcels and nothing
more. The \`Sampled rate\` column is the one that generalises.

${sampledRateSummary(rows.map((r) => r.city))}

${reliabilitySummary(rows)}

### Why there is a \`Live sample\` column

Until 2026-08-11 there wasn't one, and this document said **23 of 23 cities clean**
while Phoenix was failing about one request in five.

The probe retried up to 3× whenever a city returned \`districtCode: 'Unknown'\` and
recorded the first clean result. That half is correct and still stands: a
transient failure must not be written down as a permanent one (rule 10). What was
wrong is that **the retry was the only place the failure was ever observed, and
nothing counted it.** At a 19% per-call failure rate, three tries hide the failure
on ~99% of runs. The instrument measured the best case and published it as the
state — rule 18 turned on the tool itself, since the retry produced an answer and
an answer gets less scrutiny than a gap.

Two changes, and the pair is the point:

- Each city is now sampled a **fixed ${CALLS_PER_CITY} times with no early exit.** Stopping at the
  first clean call samples until the answer is good and then reports it, which
  biases the estimate towards success by construction.
- The recorded row is **still the first clean call.** The fix is not to start
  recording transients as defects; it is to stop discarding the evidence.

This is also why the column prints \`6/6\` rather than a tick. A tick on an empty
sample and a tick on a healthy system are the same glyph, and that is the vacuous
pass rule 20 is about. The denominator makes an unsampled city loud.

### Why there is a \`Sampled rate\` column

The \`Live sample\` column fixed whether the probe ANSWERED. It did not touch the
older and larger problem: **the probe is one hand-picked parcel, and its Outcome
was being read as the city's.**

Denver is the clean example. Its golden parcel is \`G-MU-5\`, a current form-based
DZC district that resolves ${CALLS_PER_CITY} times out of ${CALLS_PER_CITY}. A ${denverAttempted}-parcel live sample drawn
from Denver's own parcel layer returned \`R-2\`, \`O-1\`, \`I-B\`, \`H-1-A\` — former
Chapter 59 codes that fall through — and the envelope resolved for **${rateStr('denver')}**
developable parcels the pipeline answered for. Denver's row rendered exactly
like Chicago's, which resolved ${rateStr('chicago')}. Four more cities sat in the same place:
Las Vegas ${rateStr('lasvegas')}, Miami ${rateStr('miami')}, Austin ${rateStr('austin')}, LA ${rateStr('la')}.

Nothing here was misreported, and that is the part worth keeping. The Method
section at the foot of this file has said "a single probed parcel does not
characterise a whole city" the whole time. **A caveat under a table does not
survive contact with the table** — a grid of one-verdict-per-city is a
rate-shaped object, and readers, including the coverage matrix on /math, read it
as one.

So the fix is not a stronger caveat. It is a second number, measured:

- **The golden parcel stays.** It is a fixed point whose stability check catches
  provider drift, and swapping it for an aggregate would trade a regression
  signal for a headline. Both columns, not one replacing the other.
- **The rate's denominator is developable, ANSWERED parcels** — not parcels
  attempted. A parcel the sampler drew outside the city gate, or one nobody can
  build on, is not an envelope failure; counting it as one would score each city
  by how much public land it has. Those exclusions shrink \`n\`, which is why \`n\`
  is printed in every cell: Las Vegas's rate is over ${lasVegasN} of the ${lasVegasAttempted} parcels
  sampled for it, and a rate over ${lasVegasN} is a weaker claim than the same rate over ${lasVegasAttempted}.
- **\`unconstrained\` counts as resolved**, because a code that affirmatively
  imposes no FAR is an answer (rule 5). Only the fall-through to an assumed FAR
  is a gap.
- **It is DERIVED from a committed measurement**
  (\`netlify/functions/lib/data/envelopeSample.json\`), not typed in here, and
  \`src/config/coverage.ts\` reads the same file — so the /math matrix and this
  document cannot disagree, and re-running the sampler moves both.

## What a "gap" costs the user, post fail-closed audit

A gap no longer produces a confident claim. On \`assumed-far-1.0\`:

- **Verdict is withheld** — INDETERMINATE, not AS_OF_RIGHT. The tool will not
  assert legal permission derived from a size the code never stated.
- **Size-triggered required hurdles are downgraded to \`info\`**, with the doubt
  named rather than the hurdle deleted.
- **Cost and timeline are still produced**, disclosed at the assumptions panel.
  They claim what building that much would cost, not what the code allows.

\`assumed-unconstrained\` is NOT a gap: the code affirmatively imposes no FAR
(SF Planning Code §124(b), Denver's form-based DZC), so verdicts and hurdles
stand and the lot-area figure is a placeholder under a stated absence.

## Known remaining gaps, by fix cost

| Reason | Cities | What it needs |
|---|---|---|
| \`published-not-fetched\` | dc (D/NC/ARTS/CG/PDR + MU-11…14) · seattle (NR + non-NC/C) · miami (Art. 4 Table 2) · sandiego (LDC tables) | research + a table |
| \`fetched-not-mapped\` | dc (\`IZ_Designation\` — inclusionary, published per polygon, never fetched) | wiring |
| \`fetched-not-mapped\` | minneapolis (Corridor/Transit/Core/Production — base FAR + earned premiums) | wiring, once Table 540-2 is read |
| \`not-published\` | sanjose · nashville | code-text extraction, or it stays null |

### Permit timing: \`not-published\` in four cities, and the queries are already written

Filing→issuance is measured from the city's own open-data portal for **11 of 15
cities**. It is NOT measurable in **Boston, DC, Minneapolis and San Jose** — those
four publish only issue-side dates. This is a fact about municipal data
transparency, not a gap in this pipeline, and it is the kind of thing a user of
this tool would want to know.

Absence was established the right way — by asking whether the schema has a SLOT
for an application date, not whether a row was blank — and every tempting
substitute was tested and rejected rather than assumed unusable:

| city | what it publishes | substitute tested and rejected |
|---|---|---|
| boston | \`issued_date\`, \`expiration_date\` | none available; confirmed 3 ways (datastore schema, raw CSV header, full row dump) |
| dc | \`ISSUE_DATE\` across all 8 year layers | \`CREATED_DATE\` is an identical ETL stamp on every row; \`LASTMODIFIEDDATE\` post-dates issuance |
| minneapolis | \`issueDate\`, \`completeDate\` | \`completeDate\` falls AFTER \`issueDate\` in **409 of 409** sampled records — the far side of the leg |
| sanjose | \`ISSUEDATE\`, \`FINALDATE\` | \`FINALDATE\` is final inspection — same trap |

**Do not re-do the filter work.** In DC, Minneapolis and San Jose the
new-construction filter is already identified and correct
(\`PERMIT_SUBTYPE_NAME = 'NEW BUILDING'\`, \`workType = 'New'\`,
\`WORKDESCRIPTION = 'New Construction'\`). If any of those cities adds an
application date, this becomes a config change, not research.

### Highest-ranked open item: DC's RA and MU provenance

**44 DC districts publish a FAR whose only source is a code comment.** Subtitles
F (RA) and G (MU) were not read when Subtitles D and E were, so those numbers
stand exactly where DC's no-FAR claims stood before Title 11 was opened — by
assertion.

Nothing regressed and this is not a defect. It ranks above the unread-overlay
question for one reason: **it affects numbers the tool currently publishes,
rather than verdicts it currently withholds.** A wrong published FAR reaches
cost, unit counts and fees; a withheld verdict reaches nobody.

### Philadelphia's remaining blanks — still gaps, deliberately

Ten residential districts (RSD-1/2/3, RSA-1…5, RTA-1/2, RM-1) are now verified
stated absences against the Feb 2026 Quick Guide. The other ten — CMX-2,
CMX-2.5, CA-1, CA-2, I-P, SP-INS, SP-ENT, SP-STA, SP-PO-A/P, SP-AIR — are NOT,
because those pages were not read. Two successful classifications are not a
licence to generalise the pattern to a district nobody has looked at.

### Resolved: Philadelphia's residential blanks

The city's \`ZoningCodeCharacteristics\` table carries 36 districts. 13 publish a
numeric FAR, 3 publish prose the parser cannot reduce to a number (\`RMX-1\` and
\`RMX-2\` say "150% / 250% of District Area (excluding streets)" — a different
denominator, not a FAR; \`CMX-1\` defers to adjacent districts), and **20 publish
no value at all** — including every RSA/RSD rowhouse district and \`RM-1\`, while
\`RM-2/3/4\` carry 0.7 / 1.5 / 3.5.

Whether those 20 blanks are a stated absence (the code governs them by occupied
area instead — the table's own \`MinPercent\` field) or an unfilled column is
**unresolved, and it is not resolvable by reading this table.** It matters:
\`unconstrained\` restores an AS_OF_RIGHT verdict, \`null\` withholds one. Deciding
it from the shape of the data would be exactly the mechanism-without-a-
measurement that rule 1 forbids. It needs §14-701 itself.

**Chicago is NOT on that list, and the reason is worth recording.** It was, on the
strength of an enumeration reporting 1,528 unhandled zone classes. That number was
an artifact: the script read \`.maxFAR\` off a resolver returning \`{ far, heightFt }\`,
so every value scored unhandled. Chicago resolves **63 classes** — the full by-right
B/C/D/M/RM/RS/RT ladder. Of the remainder, 1,457 are PD/PMD planned developments
with no by-right FAR (a stated absence) and 5 are POS/T parks, open space and
transportation (likewise). A backlog entry sized off a broken instrument is the
most expensive kind of wrong — it buys research nobody needed.

## Method

- One real parcel per city; published example parcels where they exist.
- **${CALLS_PER_CITY} isolated calls per city, ${CALL_GAP_MS} ms apart, with no early exit**, and every one of
  them counted in the \`Live sample\` column. The recorded row is the first CLEAN
  call, so a transient \`Unknown\` is still not written down as a permanent failure
  (rule 10 — Chicago returned \`Unknown\` once under concurrent load and resolved
  to \`B3-2\` on three consecutive isolated re-probes). Retrying and *not counting*
  is what published Phoenix as clean at a 19% failure rate.
- This is not more live load than before: the old code made up to 3 retry calls
  plus 3 unconditional stability calls. One sample now answers both questions.
- **A clean sample bounds the failure rate; it does not measure it as zero.**
  ${CALLS_PER_CITY} clean calls admit a true per-call failure rate up to ${pct(failureCeiling(CALLS_PER_CITY))} (95% one-sided).
  A city quieter than that can still be broken and this table will not see it.
- Exercises the REAL entry point (\`getParcelInfo\` → \`computeEnvelope\` →
  \`buildDefaultSpec\` → \`assessFeasibility\`). An earlier attempt called
  \`resolveZoningLimits\` with \`maxFAR: null\`, bypassed every provider-side
  resolver, and reported "11/65 resolved" — it measured the probe, not the
  pipeline.
- A single probed parcel does not characterise a whole city. Columns 2–5 say
  what the pipeline returned for ONE real address, which is enough to separate
  "resolves" from "falls back" and not enough to quantify coverage. That
  sentence sat here alone until 2026-08-12 and did not stop five cities being
  read as covered; \`Sampled rate\` is the same statement made as a number.

### Method for \`Sampled rate\`

- **A different instrument, deliberately.** \`scripts/smoke-parcels.ts\` grids each
  city's bbox, pulls one real parcel polygon per cell **from the same layer the
  city's provider reads**, and takes an interior point of it — so the population
  sampled is the one the tool actually serves. Hand-picked parcels are the ones
  that already work.
- **The same composition as \`netlify/functions/analyze.ts\`**, step for step
  (rule 11). If it would change the answer to call a layer directly, calling the
  layer directly measures the layer.
- Written to \`netlify/functions/lib/data/envelopeSample.json\` as COUNTS. The
  share is computed in \`src/config/envelopeSample.ts\` and nowhere else, so a
  percentage cannot drift from its own numerator, and this document and the
  /math coverage matrix read the same file.
- **Not part of \`npm test\`.** It is about an hour of live municipal-GIS traffic;
  the committed artifact is what ships, as with the permit pipelines. Regenerate
  with \`npx vite-node scripts/smoke-parcels.ts\`.
- Each city's entry carries its own \`sampledOn\`, so re-running one city cannot
  restamp the other 22 as freshly measured.
- **A sampled rate is not a guarantee either.** \`n\` is printed in every cell
  because 100% over 6 parcels and 100% over 25 are different claims, and because
  the sample is drawn from a grid over a bbox — spread across the city, but not
  a random draw from its parcel population.
`

  const obs = rows.reduce((n, r) => n + r.rel.calls, 0)
  const cleanCalls = rows.reduce((n, r) => n + r.rel.clean, 0)

  if (process.argv.includes('--write')) {
    writeFileSync('docs/NULL-INVENTORY.md', md)
    console.log(`wrote docs/NULL-INVENTORY.md — ${resolved} resolved · ${unc} unconstrained · ${gaps} gaps · ${noSpec} no-spec · ${failed} failed`)
  } else {
    console.log(md)
  }
  console.log(`sample: ${cleanCalls}/${obs} calls clean across ${rows.length} cities`)

  // Rule 20, on this script's own output. The expected observation count is
  // pinned, so the reliability column going quiet reads RED rather than clean:
  // a run that made no calls, or a `CALLS_PER_CITY` someone dropped to 1, is a
  // measurement failure and not a healthy system.
  const expected = CITIES.length * CALLS_PER_CITY
  if (obs !== expected) {
    console.error(
      `\nFAIL — expected ${expected} observations (${CITIES.length} cities × ${CALLS_PER_CITY}), got ${obs}.`,
    )
    console.error('The reliability column is not measuring what the document claims it measures.')
    process.exitCode = 1
  }

  // Rule 20, on the OTHER column. `Sampled rate` is read from a committed
  // artifact this script does not produce, so it can go quiet in a way the run
  // itself would never notice: delete the file, or add a city and forget to
  // sample it, and every affected cell renders "not sampled" while the run
  // exits 0. Pin the membership, not just the count — a set that matches in
  // size and not in members is the regex that silently stopped matching.
  const unsampled = CITIES.filter((c) => !ENVELOPE_SAMPLED_CITIES.includes(c))
  if (unsampled.length) {
    console.error(`\nFAIL — ${unsampled.length} probed cities carry no sampled rate: ${unsampled.join(', ')}.`)
    console.error('Their Outcome column is one parcel being read as a city, which is the defect')
    console.error('the Sampled rate column exists to close. Run `npx vite-node scripts/smoke-parcels.ts`.')
    process.exitCode = 1
  }
}

// Importing this module (the colocated test does) must not fire live probes at
// 23 cities. Same guard, and the same reasoning, as `check-citations.ts`: it
// FAILS OPEN — it runs unless it can see it is under Vitest — because an
// is-this-the-entry-point check silently no-ops under any runner whose `argv[1]`
// it does not recognise, and a measurement tool that quietly does nothing is the
// exact failure this file exists to prevent.
if (process.env.VITEST == null) void main()
