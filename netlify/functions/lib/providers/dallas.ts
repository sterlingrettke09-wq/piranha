// Dallas provider — City of Dallas ArcGIS (gis.dallascityhall.com) + FEMA NFHL.
//
// Verified live 2026-08-09. Every endpoint below was point-queried at real
// Dallas addresses before this file was written, and the load-bearing results
// were re-probed four times in isolation (CLAUDE.md rule 10) and came back
// identical on every pass — parcel account, AREA_FEET to three decimals and
// zoning district, at points in Lake Highlands, the CBD and Deep Ellum.
//
// Modelled on atlanta.ts: one parcel layer carrying assessor attributes and
// owner, one separate base-zoning layer, optional overlays, no second-hop join.
//
// ─────────────────────────────────────────────────────────────────────────────
// THREE THINGS TO KNOW BEFORE CHANGING ANYTHING HERE.
//
// 1. THE LOT AREA IS ALREADY SQUARE FEET — measured, not inferred from the field
//    name (which is the Miami `FLR` trap). The layer's native spatial reference
//    is wkid 2276 (NAD83 / Texas North Central, US survey feet; the service
//    reports it as 102738 / latestWkid 2276). Requesting geometry with
//    outSR=2276 and shoelacing the returned rings reproduces `AREA_FEET` on 4 of
//    4 sampled parcels spanning two orders of magnitude:
//
//        2715 Main St        10,058.18 shoelace  vs  AREA_FEET 10,058.179
//        412 W 8th St         6,277.43           vs             6,277.429
//        1400 Young St      697,962.89           vs           697,962.896
//        2523 McKinney Ave    8,071.11           vs             8,071.108
//
//    ratio 1.000000 on all four. `AREA_FEET` is also invariant to the query's
//    outSR (checked at 4326 / 3857 / 2276 — same value), so it is a stored
//    attribute in the native SR and not a reprojected one. The layer's
//    `SHAPE.STArea()` column agrees with it to three decimals on the same four
//    parcels. Nothing is converted here, so no conversion can drift.
//
// 2. THE PARCEL LAYER IS REGIONAL AND THE ZONING LAYER IS NOT — the Raleigh
//    mismatch, and worse. The service describes itself as "Tax parcels from
//    Dallas, Collin, Denton, Kaufman and Rockwall county appraisal districts.
//    Includes City of Dallas and one-mile buffer", and only 290,743 of its
//    500,142 rows carry CITY='DALLAS'. The Base Zoning layer stops at the city
//    limits, and that is measured twice rather than assumed. Its extent
//    (xmin -97.000646 ymin 32.605923 xmax -96.464391 ymax 33.030771) matches the
//    Basemap/CityLimits layer's own extent to four decimal places; and
//    shoelacing the city-limits polygon in EPSG:2276 gives 245,474 acres against
//    243,769 acres of zoning polygons — 99.3% of the city, zoned.
//
//    ⚠️ A BBOX CANNOT FIX THIS, and that is the part that differs from Raleigh.
//    Highland Park and University Park are independent cities entirely SURROUNDED
//    by Dallas, so their parcels sit in the middle of any Dallas bounding box.
//
//    THE GATE IS THE CITY-LIMITS POLYGON, NOT THE `CITY` ATTRIBUTE, and that is a
//    measurement rather than a preference. Both instruments were cross-tabulated
//    against the zoning layer over 119 random points inside DALLAS_BBOX that
//    returned a parcel (two independent seeds, 2026-08-09):
//
//        City-limits polygon   119 / 119 agree with the zoning layer
//        CITY = 'DALLAS'       118 / 119
//
//    The single disagreement is the one that matters: at 33.00695, -96.83756 the
//    parcel row carries `CITY: null` and the zoning layer returns a real Dallas
//    district. An attribute gate refuses that parcel — an answer rendered as a
//    gap, rule 5 in the direction nobody checks for. The layer's own vocabulary
//    predicts it: `CITY` has 33 distinct values including `null`, `''` and the
//    literal `'NO TOWN'`. The polygon has no such holes.
//
//    A point outside the polygon is REFUSED (`OUT_OF_BBOX`), not answered. Before
//    the gate existed, a click in University Park returned a real 3,986,676 sq ft
//    parcel with `districtCode: 'Unknown'` — and a lot area is all the cost
//    engine needs to produce a confident dollar figure for land this tool does
//    not cover. The zoning gap alone did not stop it. There is a test.
//
// 3. THIS LAYER PUBLISHES NO PROPERTY VALUE AND NO UNIT COUNT, and that is a
//    stated absence of the FIELD rather than sparsity. All 43 columns were
//    enumerated from the layer's own schema: there is no appraised value, no
//    assessed value, no year built, no living-unit count and no building count.
//    `assessedValue` and `existing.units` are therefore never set — not set to
//    zero, and not set from a proxy. `Website` is a per-parcel deep link into
//    the Dallas Central Appraisal District, which is where those figures live,
//    so it is surfaced in `sources` instead.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { narrowestFarSubCap, resolveDallas, usesForZone } from '../zoning/dallas'

// "Tax Parcels" — the five counties' appraisal-district parcels as republished
// by the City of Dallas.
const PARCELS = 'https://gis.dallascityhall.com/arcgis/rest/services/Basemap/DallasTaxParcels/MapServer/0'
const ZONING_BASE = 'https://gis.dallascityhall.com/arcgis/rest/services/sdc_public/Zoning/MapServer'
// Layer ids read from the service's own layer index 2026-08-09, not guessed
// (CLAUDE.md rule 8). The service publishes 20 layers; these are the four that
// bear on feasibility:
//   2  Historic Overlay (158 polygons)   4  SUP (1,338)
//   9  PD Subdistricts (1,274)          15  Base Zoning (3,815)
// The other sixteen are deliberately not fetched, and each omission is a
// decision rather than an oversight: Deed Restrictions (971) and Dry Overlay
// (365) do not bear on building envelope; Parking Management Overlay is EMPTY
// (0 rows, measured); Height Map (6), Shop Front (15), Pedestrian (2), Turtle
// Creek (1), Demolition Delay (4), MD (3), NSO (13) and SPSD (69) are small
// enough that fetching them on every click costs more than they return, and
// each of their standards is set per-overlay in a separate ordinance this build
// has not read — so surfacing their presence without their content would be a
// label with nothing behind it. They are a known omission, not a claim.
const ZONING = `${ZONING_BASE}/15`
const PD_SUBDISTRICTS = `${ZONING_BASE}/9`
const HISTORIC = `${ZONING_BASE}/2`
const SUP = `${ZONING_BASE}/4`

// THE JURISDICTION GATE. One polygon, `CITY = 'Dallas'`, fields OBJECTID / CITY /
// Shape — read from the layer's own schema 2026-08-09, and its description says
// verbatim that it is the "city limits of the City of Dallas, Texas". Presence
// of a feature at the point IS the answer; no attribute comparison is needed and
// none is made, so a renamed value cannot silently open the gate.
const CITY_LIMITS = 'https://gis.dallascityhall.com/arcgis/rest/services/Basemap/CityLimits/MapServer/0'

// The publisher's own chapter node for the article this city's limits come from.
// Deliberately NOT written as a comment citation — see the header of
// ../zoning/dallas.ts: codelibrary.amlegal.com answers non-browser clients with
// HTTP 403, and scripts/check-citations.ts would read that as a repeal.
const CODE_ARTICLE_IV = 'https://codelibrary.amlegal.com/codes/dallas/latest/dallas_tx/0-0-0-75159'

/** The layer pads empty string columns with a single space rather than nulling
 *  them (`PD_NUM` and `EXPIRES` both arrive as `' '`) and leaves trailing
 *  whitespace on others ("PD-269 (Tract A) ", "State Thomas "). Collapse and
 *  trim, and treat whitespace-only as absent. */
const clean = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).replace(/\s+/g, ' ').trim()
  return s === '' ? null : s
}

/** ⚠️ 'MULTIPLE' IS NOT AN ACCOUNT NUMBER. Measured citywide: 3,660 of the
 *  500,142 parcel rows carry the literal string 'MULTIPLE' in ACCT (2,564 of
 *  them inside Dallas), and on those rows the address, owner and classification
 *  columns are all null while the geometry and area are real — they are
 *  condominium footprints, and the upstream's own `Website` value switches from
 *  `AcctDetail.aspx` to `AcctDetailGIS.aspx?ID=CONDO…` on them. Publishing
 *  'MULTIPLE' as this parcel's id would put a string that matches nothing at
 *  DCAD in front of a user, and it would look exactly like a real id. A further
 *  29,090 rows carry an empty ACCT and 2,633 a null one. */
const parcelAccount = (v: unknown): string | null => {
  const s = clean(v)
  return s == null || s === 'MULTIPLE' ? null : s
}

/** ST_NUM + ST_DIR + ST_NAME + ST_TYPE, in the upstream's own casing. ST_TYPE is
 *  empty on every row sampled because ST_NAME already carries the suffix
 *  ("MAIN ST", "N CARROLL AVE"), but it is a real column and is concatenated
 *  rather than dropped, so a row that does populate it is not silently truncated. */
function buildAddress(p: Record<string, unknown>): string | null {
  const parts = [clean(p.ST_NUM), clean(p.ST_DIR), clean(p.ST_NAME), clean(p.ST_TYPE)].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
}

/**
 * Build the `article` label: the district's name from § 51A-4.101, plus every
 * qualification without which the published figures would read as an
 * unconditional by-right ceiling.
 *
 * These are NOT decoration. Four of them exist because `ParcelInfo['zoning']`
 * has no structured field for them and this task may not widen the shared type:
 *
 *   · "Maximum structure height is any legal height" is an ANSWER
 *     (zoning/dallas.ts FACT 3) and there is no `heightUnconstrained` flag to
 *     carry it. Without this sentence `maxHeightFt: null` renders as "No
 *     district height limit is available in public data" — the tool disclaiming
 *     knowledge it demonstrably has, which is the failure Raleigh's DX-7 hit.
 *   · A FAR sub-cap on a narrower program (FACT 4) is a figure the engine cannot
 *     apply — it multiplies one lot area by one ratio — so an office developer
 *     in a CR district has to be told the 0.75 is not their number.
 *   · A PD or CD parcel's limits exist and are in another chapter. That is an
 *     incompleteness, not an absence, and the two must not read alike.
 *   · The residential proximity slope cuts the published height on the part of a
 *     site near a protected district, and no distance has been measured here.
 *     Which slope, and originating where, DEPENDS ON THE DISTRICT — see
 *     `SLOPE_FORM` below.
 */
// ─── Residential proximity slope ─────────────────────────────────────────────
//
// The sentence this replaces said the slope rises from "a neighbouring R, R(A),
// D, D(A), TH or TH(A) district boundary (§ 51A-4.412)" for every district that
// publishes a height. Three separate things were wrong with that, and the third
// is the reason this is a lookup table rather than a longer list.
//
//   1. § 51A-4.412 STATES NO 26-FOOT FIGURE. Read 2026-08-10 from American Legal
//      (Volume III → Ch. 51A → Art. IV → Div. 51A-4.400 → § 51A-4.412, node
//      0-0-0-83004, walked from the publisher's own TOC). The only numbers in
//      the whole section are 36 (the PD/CD threshold in (a)(3)(B)), 18.4°, 45°
//      and 50 feet. The 26 feet lives in each DISTRICT's own height paragraph,
//      at (4)(E)(i), and that is what the note now cites.
//
//   2. THE SIX-DISTRICT LIST IS ONLY ONE LIMB. § 51A-4.412(c) is a two-row
//      table, and the second row was dropped entirely: R/R(A)/D/D(A)/TH/TH(A)
//      project at 18.4° with INFINITE extent, but CH/MF-1/MF-1(A)/MF-2/MF-2(A)
//      project at 45° terminating 50 feet out. A 1-to-1 plane from 50 feet away
//      is a harder constraint near the boundary than a 1-to-3 plane, so
//      publishing only the 1:3 limb understates the binding case.
//
//   3. ⚠️ THE SIX-DISTRICT LIST IS NOT A PROPERTY OF § 51A-4.412 AT ALL — it is
//      a property of the district you are standing in, and the districts split
//      three ways. Every district section in Divisions 51A-4.110 and 51A-4.120
//      was read (§§ 51A-4.111 through 51A-4.117 and 51A-4.121 through 51A-4.127,
//      fetched same-origin and grepped, so the enumeration is exhaustive over
//      the two divisions rather than sampled):
//
//        · CH and multifamily (§§ 51A-4.115, 51A-4.116) QUALIFY the clause —
//          "…above a residential proximity slope originating in an R, R(A), D,
//          D(A), TH, or TH(A) district." Six districts, 1:3 limb only. The old
//          sentence was right here and nowhere else.
//        · Office, retail, commercial-service/industrial, mixed use and multiple
//          commercial (§§ 51A-4.121, .122, .123, .125, .126) say only "…above a
//          residential proximity slope." — FULL STOP, no district named. The
//          whole of § 51A-4.412 applies: thirteen origination districts plus
//          PD/CD portions, and both angle limbs. On exactly these districts —
//          the ones a commercial developer is standing in — the old sentence
//          understated the constraint.
//        · A(A), single family, duplex, townhouse, MH(A) and central area
//          (§§ 51A-4.111, .112, .113, .114, .117, .124) HAVE NO SLOPE CLAUSE.
//          The old sentence fired on all of them and was simply false. This is
//          the rule-5 slot test, not a failure to find something: in these
//          districts slot (E) reads "Height. Maximum structure height is 36
//          feet." with no subparagraphs, while in the seven above it reads
//          "Height. (i) Residential proximity slope. …(ii) Maximum height."
//          The clause is absent exactly where the structure has no room for it.
//
// § 51A-4.127 (urban corridor) also carries the unqualified form, at (E)(iii)
// rather than (E)(i) — deliberately NOT in the table below, because no UC
// district is curated in zoning/dallas.ts and an entry no input can reach is an
// untested claim. `slopeNote` returns null for any section it does not know, so
// adding UC districts later yields silence rather than a wrong citation.
type SlopeForm = 'six' | 'full' | 'none'

export const SLOPE_FORM: Readonly<Record<string, SlopeForm>> = {
  '51A-4.111': 'none', // A(A)
  '51A-4.112': 'none', // single family
  '51A-4.113': 'none', // D(A)
  '51A-4.114': 'none', // townhouse
  '51A-4.115': 'six', //  CH
  '51A-4.116': 'six', //  multifamily
  '51A-4.117': 'none', // MH(A)
  '51A-4.121': 'full', // office
  '51A-4.122': 'full', // retail
  '51A-4.123': 'full', // commercial service and industrial
  '51A-4.124': 'none', // central area
  '51A-4.125': 'full', // mixed use
  '51A-4.126': 'full', // multiple commercial
}

/** Verbatim from § 51A-4.412(a)(3)(A). Thirteen, not six. */
const SITES_OF_ORIGINATION =
  'R, R(A), D, D(A), TH, TH(A), CH, MF-1, MF-1(A), MF-1(SAH), MF-2, MF-2(A), or MF-2(SAH)'

/**
 * The slope note for a district, keyed off the section its height was read
 * from. Returns null — no sentence at all — when the district carries no slope
 * clause, and also when the section is unknown or the citation cannot be built:
 * silence is the only safe output, because every wrong version of this sentence
 * reads exactly as authoritative as the right one (rule 18).
 *
 * `heightSource` is `§ 51A-4.116(a)(4)(E)(ii)` and the slope clause is its
 * sibling `(4)(E)(i)`, so the citation is derived from the shared prefix rather
 * than restated — a district cannot be cited for a height from one section and a
 * slope from another.
 */
export function slopeNote(heightSource: string | null): string | null {
  if (!heightSource) return null

  const sec = /51A-4\.\d+/.exec(heightSource)?.[0]
  if (!sec) return null

  const form = SLOPE_FORM[sec]
  if (form === undefined || form === 'none') return null

  const at = heightSource.indexOf('(4)(E)')
  if (at === -1) return null
  const cite = `${heightSource.slice(0, at + '(4)(E)'.length)}(i)`

  const trigger =
    `Residential proximity slope: this district's own height paragraph states that if any portion of a structure is over 26 feet in height, that portion may not be located above a residential proximity slope`

  // Quoted verbatim from (4)(E)(ii), which is identical in all seven district
  // sections that carry the clause — the published height is conditional in the
  // code's own words, not merely in ours.
  const tail =
    `The height above is stated "unless further restricted under" that clause, and resolving the restriction needs a distance measurement this tool has not made — so the height shown is the district figure, which parts of this site may not reach.`

  if (form === 'six') {
    return (
      `${trigger} originating in an R, R(A), D, D(A), TH, or TH(A) district (${cite}). ` +
      `Both the 26-foot trigger and that six-district list are stated there, not in § 51A-4.412 — that section states no 26-foot figure. ` +
      `For those six districts § 51A-4.412(c) projects the plane at 18.4° (a 1 to 3 slope) with infinite extent, rising from the origination district's boundary line at the grade of the restricted structure (§ 51A-4.412(b)). ` +
      tail
    )
  }

  return (
    `${trigger} (${cite}) — naming no origination district, unlike the CH and multifamily districts, so § 51A-4.412 governs here in full. ` +
    `The 26-foot trigger is stated at that citation, not in § 51A-4.412, which states no 26-foot figure. ` +
    `A site of origination is any private property in an ${SITES_OF_ORIGINATION} district, or an identifiable portion of a planned development or conservation district restricted to residential uses not exceeding 36 feet in height (§ 51A-4.412(a)(3)); a private street or alley, a railroad right-of-way, a cemetery or mausoleum, and property whose main use is a utility and public service use are excluded from "private property" and so originate no slope (§ 51A-4.412(a)(1)). ` +
    `Two angles apply, not one (§ 51A-4.412(c)): 18.4° (a 1 to 3 slope) of INFINITE extent from R, R(A), D, D(A), TH and TH(A); and 45° (a 1 to 1 slope) from CH, MF-1, MF-1(A), MF-2 and MF-2(A), terminating at a horizontal distance of 50 feet from the site of origination. That table lists no angle for MF-1(SAH) or MF-2(SAH), which subsection (a)(3) does list as sites of origination, so no angle is published for those two and none is assumed here. ` +
    `The plane rises from the origination district's boundary line at the grade of the restricted structure (§ 51A-4.412(b)). ` +
    tail
  )
}

function buildArticle(
  longCode: string | null,
  zoneDist: string | null,
  commonName: string | null,
  supUse: string | null,
): string | null {
  const limits = resolveDallas(longCode, zoneDist)
  const bits: string[] = []

  if (limits.name) bits.push(limits.name)
  if (commonName) bits.push(`Mapped as "${commonName}"`)

  if (limits.planGoverned) {
    bits.push(
      'Planned Development district: § 51A-4.702(a)(4) requires the ordinance that established this PD to set its own building height, floor area, lot coverage, density and yards, and § 51A-4.702(a)(5) codifies those regulations in Chapter 51P — one ordinance per district. Limits DO bind this parcel; they are simply not in Chapter 51A, and this tool has not read them. The figures here are therefore incomplete, not absent.',
    )
  }
  if (limits.ordinanceGoverned) {
    bits.push(
      'Conservation District: § 51A-4.505 puts the standards in the ordinance establishing this particular CD, which conserves an area\'s character through neighbourhood-specific regulations. Those standards are not in Chapter 51A and this tool has not read them, so the figures here are incomplete, not absent.',
    )
  }

  if (limits.heightUnconstrained) {
    bits.push(
      `The zoning code imposes NO maximum structure height in this district — "Maximum structure height is any legal height" (${limits.heightSource}). That is what the code says, not a gap in our data.`,
    )
  }
  for (const alt of limits.heightAlternatives ?? []) {
    bits.push(`Height alternative — ${alt.label}: ${alt.heightFt} ft (${alt.source})`)
  }

  if (limits.farUnconstrained) {
    bits.push(
      `This district has NO maximum floor area ratio — the code's own words at ${limits.farSource} are "No maximum floor area ratio". Size here is governed by height, setbacks and lot coverage instead.`,
    )
  }
  const sub = narrowestFarSubCap(limits)
  if (limits.far != null && sub) {
    const caps = (limits.farSubCaps ?? [])
      .map((s) => `${s.far} for ${s.label}`)
      .join('; ')
    bits.push(
      `The floor-area ratio shown (${limits.far}) is the code's figure for ALL USES COMBINED. The same section states lower ratios for narrower programs — ${caps} (${limits.farSource}) — so a single-use building is capped below the headline. This tool applies the combined figure only.`,
    )
  }

  if (limits.stories != null) {
    bits.push(`Maximum ${limits.stories} stories above grade (${limits.storiesSource}), stated by the code alongside the height in feet and not derived from it.`)
  } else if (limits.storiesUnconstrained) {
    bits.push(`The code states no maximum number of stories here (${limits.storiesSource}).`)
  } else if (limits.storiesSource) {
    // FACT 2's third state: the slot is filled, and its limbs do not reach this
    // case. Neither an answer nor a silence to be mistaken for one.
    bits.push(
      `The story limit at ${limits.storiesSource} is stated only for the mixed-use-project heights, so no story maximum applies to a base-case project here and none is published.`,
    )
  }

  if (limits.densityDuPerAcre != null) {
    bits.push(
      `Maximum dwelling unit density is ${limits.densityDuPerAcre} units per net acre (${limits.densitySource}) — on a small lot this binds a residential program harder than the floor area does.`,
    )
  }

  if (limits.farAlternatives && limits.farAlternatives.length > 0) {
    bits.push(
      'The higher ratios listed as alternatives are earned by qualifying as a mixed use project or multiple commercial project: the development must contain two or more use categories above the floor-area percentages the section states, and a project plan must be submitted to and approved by the building official. They are programs to elect, not allowances.',
    )
  }

  // NOT gated on `heightFt != null || heightUnconstrained` — that gate is what
  // put the slope on single family, duplex, townhouse, A(A), MH(A) and the
  // central area districts, none of which carry a slope clause. The district's
  // own section decides, and `slopeNote` returns null where there is nothing to
  // say.
  const slope = slopeNote(limits.heightSource)
  if (slope) bits.push(slope)

  if (supUse) {
    bits.push(
      `A specific use permit is recorded on this site for "${supUse}" (§ 51A-4.219). An SUP attaches conditions to a named use on a named tract; it does not change the district's dimensional standards, but any change of use here is measured against it.`,
    )
  }

  if (limits.source) bits.push(`Source: Dallas Development Code, Chapter 51A, Article IV — ${limits.source}`)

  return bits.length > 0 ? bits.join(' · ') : null
}

export async function getDallasParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const deadline = requestDeadline()
  // REQUIRED reads go through readRequired; OPTIONAL ones keep allSettled. See
  // the contract at the top of ../requiredUpstream.ts. maxAttempts 2, not 3:
  // fetchParcelSnap already retries its exact query internally, so three outer
  // attempts would be up to six queries.
  const [parcelR, zoningR, optional] = await Promise.all([
    readRequired(
      'parcel',
      (t) => fetchParcelSnap(PARCELS, lat, lng, [
      'ACCT',
      'ST_NUM',
      'ST_DIR',
      'ST_NAME',
      'ST_TYPE',
      'AREA_FEET',
      'PROP_CL',
      'BLDG_CL',
      'TAXPANAME1',
      'CITY',
      'COUNTY',
      'APPRAISALYEAR',
      'Website',
    ], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired(
      'zoning',
      (t) => fetchParcelSnap(ZONING, lat, lng, [
      'LONG_ZONE_DIST',
      'ZONE_DIST',
      'PD_NUM',
      'CD_NUM',
      'COMMON_NAME',
      'ORD_NUM',
      'CASE_NUMBER',
    ], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    Promise.allSettled([
      // Exact point, never a snap: a buffered retry on a boundary layer would pull
      // the city limits 30 m across the line and open the gate for the enclave it
      // exists to close.
      fetchFeatures(CITY_LIMITS, lat, lng, ['CITY']),
      fetchFeatures(PD_SUBDISTRICTS, lat, lng, ['LONG_ZONE_DIST', 'PD_NUM', 'SUBDIST1', 'SUBDIST2', 'COMMON_NAME']),
      fetchFeatures(HISTORIC, lat, lng, ['H_OVERLAY', 'NAME', 'ORD_NUM']),
      fetchFeatures(SUP, lat, lng, ['SUP_NUM', 'SPECIFICUSE', 'STATUS', 'EXPIRES']),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    ]),
  ])
  const [cityR, pdSubR, histR, supR, floodR] = optional


  // ── Jurisdiction gate ────────────────────────────────────────────────────
  // Run BEFORE the parcel is read, so nothing about an out-of-city parcel can
  // reach the response. The parcel layer is regional and will answer for
  // Highland Park, University Park, Richardson, Garland, Irving and twenty-eight
  // other places (33 distinct CITY values, measured).
  //
  // It degrades OPEN on a fetch failure, matching columbus.ts: refusing a real
  // Dallas address because an optional layer timed out is a worse failure than
  // the one this prevents, and a genuine out-of-city point still surfaces as a
  // zoning gap on its own.
  if (cityR.status === 'fulfilled' && (cityR.value.features?.length ?? 0) === 0) {
    console.log({ event: 'parcel.outside_city', city: 'dallas', durationMs: Date.now() - t0 })
    return {
      ok: false,
      code: 'OUT_OF_BBOX',
      message:
        'That point is inside the Dallas area but outside the City of Dallas — Highland Park and University Park are separate cities. Dallas zoning is the only zoning this tool has here.',
      status: 400,
    }
  }

  // THE STATE SPLIT, and it sits AFTER the gate on purpose. The boundary layer
  // answers independently of the zoning layer, so when it says the point is
  // outside the city that is a complete answer and the more useful one — no
  // reason to trade it for "we couldn't reach the service" just because zoning
  // also timed out. Past this line, "the service did not answer" refuses and
  // "the service answered and found nothing" becomes the `Unknown` the
  // no-coverage copy is written for.
  if (!parcelR.ok || !zoningR.ok) {
    return upstreamUnavailable('dallas', 'Dallas', [parcelR, zoningR], t0)
  }

  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['ACCT', 'ST_NAME', 'AREA_FEET', 'TAXPANAME1'], 'dallas')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED.
  const zoning = firstAttrs(zoningR.value)
  warnIfMissing(zoning, ['LONG_ZONE_DIST', 'ZONE_DIST'], 'dallas')
  const pdSub = pdSubR.status === 'fulfilled' ? firstAttrs(pdSubR.value) : null
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const sup = supR.status === 'fulfilled' ? firstAttrs(supR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // ── Zoning ───────────────────────────────────────────────────────────────
  // BOTH fields are read, and that is not belt-and-braces (zoning/dallas.ts
  // FACT 8, CLAUDE.md rule 13): LONG_ZONE_DIST is the mapped label and
  // ZONE_DIST the family, and exactly one live polygon carries the typo 'MU=1'
  // in the first with a correct 'MU-1' in the second. A resolver given one field
  // publishes that parcel as a gap, and no test on a clean code can see it.
  const longCode = clean(zoning?.LONG_ZONE_DIST)
  const zoneDist = clean(zoning?.ZONE_DIST)
  const limits = resolveDallas(longCode, zoneDist)
  // The code shown to the user is the mapped label, because that is what the
  // city's own zoning map prints. It is NOT the resolution key.
  const districtCode = longCode ?? zoneDist

  // ── Lot area ─────────────────────────────────────────────────────────────
  // AREA_FEET is the polygon area in EPSG:2276 US survey feet — i.e. already
  // square feet (measured against the geometry; see the header). A missing
  // AREA_FEET is a null lot, never an estimated one.
  const area = Number(parcel.AREA_FEET)
  const lotSqFt = Number.isFinite(area) && area > 0 ? Math.round(area) : null

  // ── Overlays ─────────────────────────────────────────────────────────────
  // Only the Historic Overlay layer may populate `historicDistrict`, because
  // downstream code treats that field as a preservation-review trigger. The PD
  // Subdistricts layer feeds `subdistrict` — its LONG_ZONE_DIST is the tract
  // label ("PD-269 (Tract A)") and it is what a PD applicant is actually
  // working within.
  const historicDistrict = clean(hist?.NAME)
  const commonName = clean(zoning?.COMMON_NAME)
  const subdistrict = clean(pdSub?.LONG_ZONE_DIST) ?? clean(pdSub?.SUBDIST1) ?? commonName
  const supUse = clean(sup?.SPECIFICUSE)

  // ── Existing structure ───────────────────────────────────────────────────
  // TAXPANAME1 is read ONLY to derive a government-owned boolean; the name is
  // discarded here and never stored or returned.
  //
  // ⚠️ NO `units` AND NO `assessedValue`. See header note 3: this layer carries
  // neither column. A null unit count here means "the city does not publish it
  // on this layer", and mapping any other field onto it — SPTBCODE 'B11' means
  // "apartment", not "N apartments" — would be an invented number wearing a
  // citation (CLAUDE.md rule 4).
  const ownerPublic = isGovernmentOwner(clean(parcel.TAXPANAME1))
  const landUse = clean(parcel.PROP_CL) ?? clean(parcel.BLDG_CL)
  const existing =
    ownerPublic || landUse != null
      ? { ...(landUse != null ? { landUse } : {}), ...(ownerPublic ? { ownerPublic: true } : {}) }
      : undefined

  const sources: Record<string, string> = {
    parcels: PARCELS,
    zoning: ZONING,
    cityLimits: CITY_LIMITS,
    pdSubdistricts: PD_SUBDISTRICTS,
    historic: HISTORIC,
    sup: SUP,
    flood: ENDPOINTS.flood,
    zoningCode: CODE_ARTICLE_IV,
  }
  // The parcel layer hands out a per-parcel deep link into the Dallas Central
  // Appraisal District — which is where the value and unit figures this layer
  // omits actually live, so it is the honest place to send a reader.
  const dcad = clean(parcel.Website)
  if (dcad && /^https?:\/\//i.test(dcad)) sources.appraisalDistrict = dcad

  const info: ParcelInfo = {
    address: buildAddress(parcel) ?? 'Selected location',
    parcelId: parcelAccount(parcel.ACCT) ?? '',
    coordinates: [lng, lat],
    zoning: {
      districtCode: districtCode ?? 'Unknown',
      subdistrict,
      article: buildArticle(longCode, zoneDist, commonName, supUse),
      // Feet where Article IV prints feet, null where it does not. NEVER derived
      // from the story count — Dallas states both, in two separate lettered
      // slots, and five different ft/story ratios appear across adjacent
      // districts (zoning/dallas.ts FACT 2).
      maxHeightFt: limits.heightFt,
      // Stories where Article IV prints stories. NEVER derived from feet, for
      // the same reason and in the same direction.
      ...(limits.stories != null ? { maxStories: limits.stories } : {}),
      maxFAR: limits.far,
      allowedUses: usesForZone(longCode, zoneDist),
      // ⚠️ `farByUse` is deliberately NEVER set for Dallas, and that is a
      // decision rather than an omission. The code's limbs are "office uses",
      // "retail and personal service uses", "any combination of lodging, office,
      // and retail and personal service uses" and "all uses combined" — a
      // vocabulary that does not map onto this type's residential/commercial/
      // mixed/institutional keys without inventing the correspondence. An
      // invented mapping would be indistinguishable from a measured one six
      // months from now (rule 4), so the limbs are stated in `article` in the
      // code's own words and the engine applies the combined figure only.
      //
      // The KNOWN absence, kept distinct from an unresolved lookup: set only
      // where the code writes "No maximum floor area ratio" into slot (D). An
      // unrecognised code leaves it off entirely, so a gap can never render as
      // "FAR does not bind here" and can never fall back to an assumed FAR of 1.0.
      ...(limits.farUnconstrained ? { farUnconstrained: true } : {}),
      ...(limits.farAlternatives
        ? {
            farAlternatives: limits.farAlternatives.map((a) => ({
              label: a.label,
              far: a.far,
              source: a.source,
            })),
          }
        : {}),
    },
    lot: { sizeSqFt: lotSqFt, lotType: null },
    overlays: {
      historicDistrict,
      floodZone: clean(flood?.FLD_ZONE),
    },
    ...(existing ? { existing } : {}),
    sources,
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'dallas', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
