// Phoenix provider — City of Phoenix ArcGIS (maps.phoenix.gov/pub) + FEMA NFHL.
//
// Verified live 2026-08-09. Every endpoint below was point-queried at real
// Phoenix addresses before this file was written, and the probe parcel was
// re-queried six times in isolation 400 ms apart, returning exactly one feature
// with the same parcel id, the same SHAPE.STArea() to four decimals and the same
// zoning district on every pass (CLAUDE.md rule 10).
//
// Modelled on philadelphia.ts for the second-hop assessor join and on
// raleigh.ts / charlotte.ts for the county-parcels-vs-city-zoning mismatch.
//
// FOUR THINGS ABOUT THIS CITY'S DATA THAT ARE NOT OBVIOUS FROM THE SCHEMA:
//
//   1. THE PARCEL LAYER IS THE WHOLE COUNTY; THE ZONING LAYER IS THE CITY.
//      Measured: COUNTY_PARCELS/3 carries 1,759,634 features over an extent
//      spanning xmin -113.354 to xmax -111.077, i.e. all of Maricopa County,
//      while Zoning/0 carries 9,649 polygons over -112.326…-111.925. So a click
//      in Scottsdale, Mesa or Glendale returns a REAL parcel with NO Phoenix
//      zoning. This is Raleigh's and Charlotte's shape, and it is why the wired
//      bbox must be the ZONING layer's measured extent rather than a box drawn
//      round the city label.
//
//      ⚠️ AND A ZONING GAP IS NOT ENOUGH. `districtCode: 'Unknown'` with null
//      limits is the correct render of the ZONING, but the row still carries a
//      real address, a real lot area and a real assessed value — an answer-shaped
//      result for land this tool does not cover, and a lot area is all the cost
//      engine needs to print a confident dollar figure. So CityBoundary/0 is
//      fetched as a GATE and a point outside it is REFUSED. Pinned by a test.
//
//      WHY THE GATE IS THE POLYGON. The PARCEL layer has no jurisdiction column
//      at all: COUNTY_PARCELS/3's 27 fields were enumerated from the layer's own
//      field list 2026-08-09 — OBJECTID, SHAPE, ADDRESS, OWNER, PROP_CODE,
//      ASSESSOR_INFO, PROPERTY_USE_CODE, DESCRIPTION, PROPERTY_USE_GROUP,
//      GROUP_DESCRIPTION, PARCEL_COUNT, MAG_LU_CODE, the four PARCEL_GROUP_*
//      columns, the two SHAPE.* columns, APN, OWN_ADDR, SUITE and the six
//      STREET_* columns — and none of them names a city. There is no slot to
//      read, so the Dallas/Las Vegas question does not even arise on the layer
//      the gate would naturally sit on.
//
//      The SUPPLEMENT table does carry `JURISDICTION`, and it was measured
//      rather than dismissed: over 130 random in-bbox points, 85 returned a
//      parcel, and on the 84 with a supplement row `JURISDICTION = 'PHOENIX'`
//      agreed with CityBoundary/0 **84 / 84**. It is a sound corroborator and it
//      is still the wrong gate, for two structural reasons rather than an
//      accuracy one:
//        · it is reachable only through the second hop, an `APN_DASH` join that
//          fails independently of the parcel fetch — so the gate would inherit a
//          second failure mode, and the 85th point is exactly that case (`APN`
//          null, no supplement row, nothing to compare);
//        · the gate must run BEFORE the parcel is read, and the join needs the
//          parcel's APN to run at all.
//      CityBoundary/0 is one exact point query against one polygon, resolved in
//      parallel with everything else. (Dallas and Las Vegas publish a
//      jurisdiction column on the parcel layer itself, and it was measured and
//      rejected in both — see their headers for what it got wrong.)
//
//   2. THE LOT AREA IS ALREADY SQUARE FEET, AND THAT WAS MEASURED, NOT INFERRED
//      FROM THE FIELD NAME (the Miami `FLR` trap). The layer's native spatial
//      reference is wkid 2868 (NAD83(HARN) / Arizona Central, feet), and
//      requesting geometry at outSR=2868 and shoelacing the returned rings
//      reproduces the stored `SHAPE.STArea()` on 6 of 6 sampled parcels spanning
//      three orders of magnitude:
//
//          130 N Central Ave        6,914.7084 shoelace vs      6,914.7083
//          4050 N Central Ave      27,780.2241              vs     27,780.2240
//          735 E Apollo Rd         40,335.6028              vs     40,335.6027
//          4901 E Palomino Rd      56,899.7143              vs     56,899.7143
//          15215 S 48th St        202,230.7225              vs    202,230.7218
//          33.68,-112.11           65,135.9332              vs     65,135.9332
//
//      ratio 1.000000 on all six. The assessor's independent `LAND_SIZE` column
//      agrees to within 0.5–2% on the same parcels (6,875 vs 6,914; 55,822 vs
//      56,900; 40,000 vs 40,336), which corroborates the unit without being
//      precise enough to be the source. Nothing is converted here, so no
//      conversion can drift.
//
//      ⚠️ The OTHER parcel layer on this server, CityParcels/0, publishes a
//      `SHAPE.AREA` column that reads 0 — checked at a live point, where the
//      whole geometry-metadata block came back zeroed. It is not read.
//
//   3. THE ASSESSOR'S `CITY_ZONING` IS A DECOY AND IS NEVER READ. See FACT 5 in
//      ../zoning/phoenix.ts: measured over 60 sampled Phoenix parcels, it
//      disagrees with the City's own zoning polygon on 4 of them and not by
//      small margins ('C-3' vs S-1, 'CP/GCP' vs S-1). It also carries other
//      cities' vocabularies — a Scottsdale row reads 'S-R'. Every district code
//      in the output comes from Zoning/0's `ZONING` field. A test asserts the
//      column never reaches the output.
//
//   3b. THE ZONING READ IS **REQUIRED**, NOT OPTIONAL, AND THAT IS LOAD-BEARING.
//      It is fetched through `readRequired` (../requiredUpstream.ts) and a
//      failure REFUSES with UPSTREAM_ERROR. It used to sit in the same
//      `Promise.allSettled` as the cosmetic layers and degrade to
//      `districtCode: 'Unknown'`, which `assessDevelopability` renders as
//      "may sit in a neighboring city … that isn't in the zoning data we cover
//      yet" while analyze.ts zeroes cost, timeline and hurdles. Measured
//      2026-08-11: 7 of 20 answered parcels in a live batch, and 0 of 81
//      isolated calls on the same golden parcel hours later — the parcels never
//      changed, only the service's health. Read the contract in
//      ../requiredUpstream.ts before touching either fetch.
//
//      NOTE THE ASYMMETRY: an EMPTY zoning answer still means `Unknown`. That
//      is a real fact — no Phoenix polygon covers the point — and the
//      Scottsdale gate depends on it. Only a failed FETCH refuses.
//
//   4. THERE IS NO DWELLING-UNIT COUNT ANYWHERE IN THIS DATA, and that is a
//      stated gap rather than a zero. Neither COUNTY_PARCELS/3 nor its
//      supplemental table publishes a unit count; the closest thing is the
//      assessor's use description ("APARTMENTS 100+ UNITS 2 STORY"), which is a
//      class label and not a number. `existing.units` is therefore left absent.
//      It must not be inferred from the description string: "100+" is not a
//      count, and a parsed 100 would flow straight into the no-net-loss check.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import {
  fetchFeatures,
  fetchParcelSnap,
  fetchWhere,
  firstAttrs,
  sqlQuote,
  warnIfMissing,
  type ParcelResult,
} from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { cityLimitsGate, cityLimitsSource, fetchCityLimits, outsideCity } from '../jurisdiction'
import { resolvePhoenix, usesForZone, type PhoenixLimits } from '../zoning/phoenix'
import { recordAddress } from '../address'

// Layer ids read from each service's own layer index 2026-08-09, not guessed
// (CLAUDE.md rule 8).
const BASE = 'https://maps.phoenix.gov/pub/rest/services/Public'
/** "County Parcels" — Maricopa County parcel geometry with address, owner and
 *  the assessor's property-use description. Layer 3 of the COUNTY_PARCELS
 *  service (layer 0 is the outline-only variant). */
const PARCELS = `${BASE}/COUNTY_PARCELS/MapServer/3`
/** "County Parcels Supplemental Information" — a NON-SPATIAL table on the same
 *  service, keyed on APN_DASH. Holds year built, storey count and valuation. */
const PARCELS_SUPPLEMENT = `${BASE}/COUNTY_PARCELS/MapServer/4`
/** The City of Phoenix zoning layer — the only authority for the district. */
const ZONING = `${BASE}/Zoning/MapServer/0`
const ZONING_OVERLAYS = `${BASE}/ZoningOverlays/MapServer/0`
const HISTORIC = `${BASE}/HistoricProperties/MapServer/0`
/** THE JURISDICTION GATE. One polygon, `NAME = 'City of Phoenix'` — both counted
 *  and enumerated live 2026-08-09 (`returnCountOnly` → 1;
 *  `returnDistinctValues` on NAME → one value). Presence of a feature at the
 *  point IS the answer, so no attribute comparison is made and a renamed value
 *  cannot silently open the gate. Deliberately NOT `CityLimit/MapServer`, which
 *  is a 13-layer cartographic service of outlines, masks and label-only
 *  variants rather than a boundary polygon to query. */
// The URL, the match and the refusal wording live in ../jurisdiction.ts, one
// entry per live city — this gate existed in four providers and was missing
// from eight that were measured publishing their neighbours' land.
const PHOENIX_GATE = cityLimitsGate('phoenix')!

/** ArcGIS keys this column with the parentheses in the name. */
const SHAPE_AREA = 'SHAPE.STArea()'

/** Collapse internal whitespace and trim; whitespace-only becomes absent.
 *  Needed on nearly every string this server returns: the zoning layer pads
 *  empty columns with a single space (`TOD: ' '`, `ORD_NUM: ' '`), the assessor
 *  table right-pads to fixed width (`'PHOENIX                    '`), and one
 *  captured parcel has `ADDRESS: '        '`. */
const clean = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).replace(/\s+/g, ' ').trim()
  return s === '' ? null : s
}

/** Parse one of the assessor table's numeric-looking STRING columns. Every
 *  number on that table arrives as text — '1510.00', '1.00', '1952',
 *  '422000         ' — and the "unknown" fill is a run of spaces rather than a
 *  null, so a bare Number() would turn '    ' into 0. Zero is mapped to null
 *  deliberately: `LIVING_SPACE` reads '0.00' on every multi-family and
 *  commercial row (measured on a 100+ unit apartment complex), which means "not
 *  published for this class", never "no building". */
const posNum = (v: unknown): number | null => {
  const s = typeof v === 'string' ? v.trim() : v
  if (s == null || s === '') return null
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

const posInt = (v: unknown): number | null => {
  const n = posNum(v)
  return n == null ? null : Math.round(n)
}

/** A four-digit year, or null. Rejects the assessor's '    ' fill and any value
 *  outside a plausible construction range rather than publishing it. */
const year = (v: unknown): number | null => {
  const n = posInt(v)
  return n != null && n >= 1800 && n <= 2100 ? n : null
}

/** Build the street address from the parcel layer's own components.
 *
 *  `ADDRESS` on this layer is a single fixed-width string with the city and ZIP
 *  appended and runs of internal spaces —
 *  "805 W AMELIA AVE   PHOENIX  85013" — so it is NOT used directly; splitting
 *  it would mean writing a parser for a format nobody documented. The layer
 *  publishes the pieces separately, so they are joined instead. One captured row
 *  has every component null AND an all-spaces ADDRESS, which is why there is a
 *  final fallback.
 *
 *  The city in that string is also not a jurisdiction: a parcel whose ADDRESS
 *  reads "9910 W MONTEBELLO AVE   GLENDALE  85307" sits inside a Phoenix zoning
 *  polygon. Nothing here reads it as one. */
function streetAddress(p: Record<string, unknown>): string | null {
  const parts = [p.STREET_NUM, p.STREET_DIR, p.STREET_NAME, p.STREET_TYPE, p.STREET_POSTDIR]
    .map(clean)
    .filter((s): s is string => s != null)
  if (parts.length >= 2) return parts.join(' ')
  return clean(p.ADDRESS)
}

/** Render one height limit in the units the ordinance prints, and only those.
 *  There is no branch here that fills in the missing unit — a district stated in
 *  feet alone prints feet alone. */
function heightPhrase(ft: number | null, stories: number | null): string {
  if (ft != null && stories != null) return `${stories} stories and ${ft} ft`
  if (stories != null) return `${stories} stories`
  if (ft != null) return `${ft} ft`
  return 'no stated height'
}

/**
 * Build the `article` label: the district's name plus every qualification
 * without which the published figures would read as an unconditional by-right
 * ceiling.
 *
 * These are not decoration. `ParcelInfo['zoning']` has no field for a lot
 * coverage, a density, a conditional height, a plan-governed district or a
 * county island, and this task may not widen the shared type — so the only place
 * those facts can be stated is here. Two of them would otherwise render as
 * their opposite:
 *
 *   · A C-O parcel has a KNOWN height that we cannot pick between (zoning FACT
 *     4). With `maxHeightFt: null` and nothing said, the feasibility engine
 *     prints "no district height limit is available in public data" — the tool
 *     disclaiming knowledge it demonstrably has, which is the failure Raleigh's
 *     DX-7 hit.
 *   · A PUD or PAD parcel has standards fixed in an approved plan. Silence there
 *     reads as "unregulated" rather than "we cannot read the value".
 */
function buildArticle(limits: PhoenixLimits, overlayNames: string[]): string | null {
  const bits: string[] = []
  if (limits.name) bits.push(limits.name)

  if (limits.height) {
    // Restated in words next to the numeric fields so the "stories AND feet"
    // conjunction survives into the UI, where the two are separate columns.
    bits.push(
      `The ordinance states this district's maximum height as ${heightPhrase(limits.height.ft, limits.height.stories)} (${limits.height.source}). Both figures are the code's own; neither was derived from the other.`,
    )
  }

  if (limits.heightConditional) {
    const limbs = limits.heightConditional.limbs
      .map((l) => `${l.label} — ${heightPhrase(l.ft, l.stories)}`)
      .join('; ')
    bits.push(
      `The ordinance DOES state a maximum height here, but which one applies turns on ${limits.heightConditional.discriminator} — a fact that is in no dataset this tool reads. The limbs are: ${limbs}. No single height is published, because the larger would assume the most permissive regime and the smaller would impose a limit the code may not impose.`,
    )
  }

  for (const a of limits.heightAlternatives ?? []) {
    bits.push(`${a.label}: ${heightPhrase(a.ft, a.stories)} (${a.source})`)
  }

  if (limits.noPrincipalBuilding) {
    bits.push(
      'This district permits surface parking, carports and public utility facilities only — no principal habitable building — so the ordinance states no building height for it. That is the district\'s purpose, not a missing figure.',
    )
  }

  if (limits.planGoverned) {
    bits.push(
      'The dimensional standards here come from the plan and the council ordinance that approved this specific development, not from a district table, and that instrument is not published as data. The figures shown are therefore INCOMPLETE, not absent — a height, a density and a coverage limit do apply; we cannot read them.',
    )
  }

  if (limits.countyJurisdiction) {
    bits.push(
      'This polygon is a county island inside the city\'s mapped area: the Phoenix Zoning Ordinance does not govern it, the Maricopa County ordinance does, and this tool does not read the county ordinance. Nothing about the limits here should be inferred from Phoenix zoning.',
    )
  }

  if (limits.maxLotCoveragePct != null) {
    bits.push(`Maximum lot coverage ${limits.maxLotCoveragePct}% of net lot area (${limits.lotCoverageSource})`)
  } else if (limits.lotCoverageUnconstrained && limits.lotCoverageSource) {
    bits.push(`The code imposes NO maximum lot coverage here (${limits.lotCoverageSource})`)
  }

  // Density is the instrument Phoenix uses where other cities use FAR, so it is
  // stated wherever the code states it — and `ParcelInfo` has nowhere else to
  // put it.
  if (limits.maxUnitsPerGrossAcre != null) {
    bits.push(
      `Maximum residential density ${limits.maxUnitsPerGrossAcre} dwelling units per GROSS acre (${limits.densitySource}). Gross acreage includes land this parcel polygon does not measure, so applying this rate to the parcel area understates what the code allows.`,
    )
  } else if (limits.minLotAreaPerUnitSqFt != null) {
    bits.push(
      `Density is stated as a minimum lot area per dwelling unit: ${limits.minLotAreaPerUnitSqFt.toLocaleString('en-US')} sq ft per unit (${limits.densitySource}).`,
    )
  } else if (limits.densitySource) {
    bits.push(limits.densitySource)
  }

  if (limits.farUnconstrained) {
    bits.push(
      'The Phoenix Zoning Ordinance imposes NO floor-area ratio in this district — that is what the code says, not a gap in our data. Its district standards enumerate lot area, width, depth, setbacks, height, lot coverage and density, and contain no floor-area-ratio item; the ordinance defines FAR at §202 and prints it as a table row in §626.H.1 where it does apply. Floor area here is governed by height, lot coverage, setbacks and density instead.',
    )
  } else if (limits.farSource) {
    bits.push(`Floor area ratio: ${limits.farSource}`)
  }

  if (limits.restrictedNote) bits.push(limits.restrictedNote)

  if (overlayNames.length > 0) {
    bits.push(
      `Mapped overlay${overlayNames.length > 1 ? 's' : ''}: ${overlayNames.join('; ')}. Overlay standards are not resolved by this tool and can bind BELOW the base district.`,
    )
  }

  if (limits.source) bits.push(`Source: ${limits.source}`)

  return bits.length > 0 ? bits.join(' · ') : null
}

/** Fields on COUNTY_PARCELS/3 the provider reads. */
const PARCEL_FIELDS = [
  'APN',
  'ADDRESS',
  'STREET_NUM',
  'STREET_DIR',
  'STREET_NAME',
  'STREET_TYPE',
  'STREET_POSTDIR',
  'OWNER',
  SHAPE_AREA,
  'DESCRIPTION',
  'PROPERTY_USE_CODE',
  'PARCEL_GROUP_CLASS',
  'ASSESSOR_INFO',
] as const

/** Fields on Zoning/0. */
const ZONING_FIELDS = ['ZONING', 'LABEL1', 'GEN_ZONE', 'TOD', 'HISTORIC', 'REDEFINE1', 'ORD_NUM', 'ACRES'] as const

// ── The request's time budget ────────────────────────────────────────────────
// Measured 2026-08-11 against the live services. Every layer this provider
// reads answers in 60–680 ms when the servers are healthy (parcels 142–458,
// zoning 111–205, city boundary 133–681, overlays 105–189, historic 118–354,
// FEMA 61–1225, the assessor supplement 136–453), and 32 simultaneous zoning
// queries showed no degradation at all. So the 8.7 s the smoke run recorded was
// an upstream CONDITION, not a fixed cost of the fan-out — but the code had no
// bound that would keep a bad day inside Netlify's 10 s wall:
//
//   fetchParcelSnap's own budget            8000 ms
// + the serial assessor hop's default       6000 ms
// = 14 s worst case, i.e. a platform kill rather than a clean UPSTREAM_ERROR.
//
// And the six parallel fetches are awaited together, so under load the SLOWEST
// sets the response time — including three layers whose absence renders as
// nothing at all. A 6 s hang on the FEMA flood layer used to cost six seconds
// for a field the UI omits when it is null.
//
// These caps change no query — same URLs, same fields, same spatial filter —
// only how long we wait before giving up on one. Verified byte-identical on
// live parcels; see the report accompanying this change.
const OPTIONAL_TIMEOUT_MS = 3000
/** The city-boundary GATE keeps its original 6 s. It is the cheapest query here
 *  (one polygon, one layer) and it is never the latency source, while shortening
 *  it would make the gate fail OPEN more often — and failing open is the one
 *  degradation on this provider that lets an out-of-city point through. */
const GATE_TIMEOUT_MS = 6000
/** Ceiling for the whole function, inside Netlify's 10 s kill. The serial
 *  assessor hop runs after the parallel group, so it gets what remains. */
const WALL_MS = 9200
const SECOND_HOP_CAP_MS = 2500

export async function getPhoenixParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const deadline = requestDeadline()
  const capped = (ms: number) => Math.max(500, Math.min(ms, deadline - Date.now()))

  // REQUIRED reads run through readRequired; OPTIONAL ones keep allSettled. The
  // two categories are meant to look different in the source — see the contract
  // at the top of ../requiredUpstream.ts. All of it is in flight at once.
  const [parcelR, zoningR, optional] = await Promise.all([
    // maxAttempts 2, not 3: fetchParcelSnap already retries its exact query
    // internally, so three outer attempts would be up to six queries.
    readRequired(
      'parcel',
      (t) => fetchParcelSnap(PARCELS, lat, lng, PARCEL_FIELDS, false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    // ⚠️ EXACT POINT, NOT A SNAP — and this is a correction, not a style
    // choice. Written first as `fetchParcelSnap(ZONING, …)` (which is what the
    // other county-parcel cities do), it passed every fixture test and then
    // FAILED on the live run: a Scottsdale parcel at 33.48038, -111.95623
    // returned `districtCode: 'R1-10'`, because the exact query found nothing
    // and the 30 m buffered retry snapped to a Phoenix polygon 30 m away.
    // Measured directly against the layer at that point — exact: 0 features;
    // 30 m buffer: R1-10; 200 m buffer: RE-43, R1-10 and R-5. A parcel Phoenix
    // does not zone was being given a Phoenix district, a Phoenix height and
    // `farUnconstrained: true`. That is the rule-5 failure exactly, and it
    // produced a plausible answer rather than a null (rule 18).
    //
    // The snap buys nothing here, because this layer covers rights-of-way:
    // checked at four street-centre and river-bed points inside the city
    // (Central Ave at Roosevelt, Camelback at 16th St, 7th St at Indian School,
    // the Salt River bed), the exact query returned a zoning polygon at all
    // four while the PARCEL layer returned nothing at two of them. So the parcel
    // fetch keeps its snap and the zoning fetch does not need one.
    //
    // Note what caught it: not the suite. The fixture for the out-of-city case
    // routes zoning to zero features, so the test asserted 'Unknown' and passed
    // against code that could not produce 'Unknown' in the field. Only running
    // the real entry point against the real services showed it (rule 9).
    //
    // ⚠️ AND IT IS A **REQUIRED** READ — this is the second correction on this
    // fetch, and it is the same rule as the first. It used to sit in the
    // `Promise.allSettled` below and be read as
    // `zoningR.status === 'fulfilled' ? firstAttrs(...) : null`, so a rejected
    // fetch and a point no polygon covers produced the identical `null` →
    // `districtCode: 'Unknown'` → `no_coverage` → *"may sit in a neighboring
    // city … that isn't in the zoning data we cover yet"*, with cost, timeline
    // and hurdles zeroed by analyze.ts. A timeout was being published as a
    // geographic fact about a parcel that is fully covered. Measured: 7 of 20
    // answered Phoenix parcels in the 2026-08-11 batch, and 0 of 81 isolated
    // calls on the same golden parcel a few hours later. Nothing about the
    // parcels changed; only the service's health did.
    readRequired('zoning', (t) => fetchFeatures(ZONING, lat, lng, ZONING_FIELDS, false, undefined, t), {
      deadline,
      maxAttempts: 3,
      attemptCapMs: 3000,
    }),
    Promise.allSettled([
      // Exact point, never a snap — for the same reason the zoning fetch above is
      // exact. A buffered retry on a boundary layer reaches 30 m across the line
      // and re-opens the gate for the Scottsdale parcel that motivated it.
      fetchCityLimits(PHOENIX_GATE, lat, lng, capped(GATE_TIMEOUT_MS)),
      fetchFeatures(ZONING_OVERLAYS, lat, lng, ['NAME', 'REGULATORY'], false, undefined, capped(OPTIONAL_TIMEOUT_MS)),
      fetchFeatures(HISTORIC, lat, lng, ['NAME', 'TYPE', 'STATUS'], false, undefined, capped(OPTIONAL_TIMEOUT_MS)),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE'], false, undefined, capped(OPTIONAL_TIMEOUT_MS)),
    ]),
  ])
  const [cityR, overlayR, histR, floodR] = optional

  // ── Jurisdiction gate ────────────────────────────────────────────────────
  // Run BEFORE the parcel is read, so nothing about an out-of-city parcel can
  // reach the response. The county fabric answers for Scottsdale, Tempe, Mesa,
  // Glendale, Chandler, Peoria and the rest of Maricopa County, and several of
  // them sit inside PHOENIX_BBOX.
  //
  // It degrades OPEN on a fetch failure, matching columbus.ts: refusing a real
  // Phoenix address because an optional layer timed out is a worse failure than
  // the one this prevents, and an out-of-city point still surfaces as a zoning
  // gap without it.
  //
  // ⚠️ IT ALSO RUNS BEFORE THE STATE SPLIT BELOW, and that ordering is a
  // decision rather than an accident. This layer answers independently of the
  // zoning layer, so a zero-feature result is a COMPLETE answer about the point
  // and the more useful one to return. Refusing with "we couldn't reach the
  // service" because zoning happened to time out on the same request would
  // discard a fact we actually have. Every gated provider orders it the same
  // way, and upstreamSplit.test.ts pins all twelve.
  const outside = outsideCity('phoenix', cityR, t0)
  if (outside) return outside

  // THE STATE SPLIT. "The service did not answer" is an error, and the only
  // legal handling of it is to refuse: no default district, no fall-through to a
  // verdict, no zeroed report. "The service answered and found nothing" is a
  // different fact and it survives past this line, where `firstAttrs` of an
  // empty feature set becomes the `Unknown` the no-coverage copy is *for*.
  //
  // One `if` narrows both reads for the rest of the function, which is what
  // makes the check hard to forget rather than merely documented (rule 14).
  if (!parcelR.ok || !zoningR.ok) {
    return upstreamUnavailable('phoenix', 'Phoenix', [parcelR, zoningR], t0)
  }

  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['APN', 'ADDRESS', SHAPE_AREA, 'OWNER'], 'phoenix')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED. A null here therefore means
  // one thing — no Phoenix zoning polygon contains this point — and that is the
  // fact `districtCode: 'Unknown'` is allowed to express.
  const zoning = firstAttrs(zoningR.value)
  warnIfMissing(zoning, ['ZONING'], 'phoenix')
  const overlayFs = overlayR.status === 'fulfilled' ? (overlayR.value.features ?? []) : []
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // ── Second hop: the assessor's supplemental table ────────────────────────
  // Non-spatial and keyed on APN_DASH — the DASHED form, which is what the
  // geometry layer's `APN` field carries. Checked live: `APN='110-11-022'`
  // returns nothing on this table (its own `APN` column is undashed,
  // '11011022'), while `APN_DASH='110-11-022'` returns the row. Joining on the
  // similarly named wrong column would have produced a silent, total loss of
  // year built and valuation on every parcel — with a perfectly healthy-looking
  // response.
  //
  // A miss here degrades: the parcel, its lot and its zoning are all already
  // resolved, and the supplemental table has 1,759,497 rows against the parcel
  // layer's 1,759,634, so a missing row is a real state and not a failure.
  //
  // ⏱ It is also the only SERIAL hop — it needs the parcel's APN, so it cannot
  // start until the parallel group is done, and its cost lands on top of the
  // slowest of those. Its timeout is therefore what remains of the function's
  // wall-clock ceiling rather than the 6 s default that used to make 14 s
  // arithmetically reachable. Measured 136–453 ms live, so the 2.5 s cap has
  // roughly 5× headroom and never binds on a healthy service.
  const apn = clean(parcel.APN)
  const suppR = apn
    ? await Promise.allSettled([
        fetchWhere(
          PARCELS_SUPPLEMENT,
          `APN_DASH = ${sqlQuote(apn)}`,
          [
            'APN_DASH',
            'CONST_YEAR',
            'LIVING_SPACE',
            'NUMBER_STORIES',
            'FCV_CUR',
            'LPV_CUR',
            'TAX_YR_CUR',
            'JURISDICTION',
          ],
          Math.max(500, Math.min(SECOND_HOP_CAP_MS, t0 + WALL_MS - Date.now())),
        ),
      ])
    : []
  const supp = suppR[0]?.status === 'fulfilled' ? firstAttrs(suppR[0].value) : null

  // ── Zoning ───────────────────────────────────────────────────────────────
  // `ZONING` is the district code and the ONLY field read as one. The layer also
  // carries `LABEL1` (a display string that appends the historic suffix,
  // "R1-6 HP", and a '*' on conditionally-rezoned polygons) and `GEN_ZONE` (a
  // family label: 'SF Residential', 'Downtown Code', 'Non-Developable'). Both
  // feed display only.
  //
  // The assessor's `CITY_ZONING` is deliberately not fetched at all — see note 3
  // in the header. Not fetching it is stronger than fetching and ignoring it.
  const code = clean(zoning?.ZONING)
  const limits = resolvePhoenix(code)

  // ── Lot area ─────────────────────────────────────────────────────────────
  // SHAPE.STArea() is the polygon area in EPSG:2868 feet — i.e. already square
  // feet, measured against the geometry (see the header). There is no fallback
  // to the assessor's LAND_SIZE: it disagrees by up to 2% and rounds, so mixing
  // the two would make the published lot size depend on which service answered.
  const shapeArea = Number(parcel[SHAPE_AREA])
  const lotSqFt = Number.isFinite(shapeArea) && shapeArea > 0 ? Math.round(shapeArea) : null

  // ── Overlays ─────────────────────────────────────────────────────────────
  // Measured: one point returns THREE overlay polygons, and only some carry
  // REGULATORY = 'Yes'. The regulatory ones are listed first because they are
  // the ones that can change the rules, but every one is listed — a
  // non-regulatory specific plan is still a fact about the site.
  const overlays = overlayFs
    .map((f) => ({ name: clean(f.attributes.NAME), regulatory: clean(f.attributes.REGULATORY) === 'Yes' }))
    .filter((o): o is { name: string; regulatory: boolean } => o.name != null)
  const overlayNames = [
    ...overlays.filter((o) => o.regulatory).map((o) => `${o.name} (regulatory)`),
    ...overlays.filter((o) => !o.regulatory).map((o) => o.name),
  ]

  // ── Historic ─────────────────────────────────────────────────────────────
  // Two independent signals, and they are not interchangeable:
  //   · the Historic Properties layer NAMES a listing on the Phoenix Historic
  //     Property Register (§815), which may be a district or a single property;
  //   · the zoning layer's own `HISTORIC` column carries the §810 zoning suffix
  //     'HP' or 'HP-L', which is the thing that triggers a Certificate of
  //     Appropriateness under §812.
  // The named listing is preferred because it is more informative. Where only
  // the suffix is present, the suffix is reported AS a suffix rather than
  // dressed up as a district name we do not have.
  const histName = clean(hist?.NAME)
  const hpSuffix = clean(zoning?.HISTORIC)
  const historicDistrict =
    histName ??
    (hpSuffix === 'HP' || hpSuffix === 'HP-L' || hpSuffix === 'HP L'
      ? `Historic preservation zoning suffix "${hpSuffix}" (Phoenix Zoning Ordinance §810) — the register listing is not named in this layer`
      : null)

  // ── Existing structure ───────────────────────────────────────────────────
  // OWNER is read ONLY to derive a government-owned boolean; the name is
  // discarded here and never stored or returned.
  const ownerPublic = isGovernmentOwner(clean(parcel.OWNER))
  const existingBase = {
    landUse: clean(parcel.DESCRIPTION),
    yearBuilt: year(supp?.CONST_YEAR),
    // Residential living area only — 0.00 on multi-family and commercial rows,
    // which posNum maps to null. See the fixture note on the apartment complex.
    buildingAreaSqFt: posInt(supp?.LIVING_SPACE),
    stories: posInt(supp?.NUMBER_STORIES),
    // ⚠️ NO `units`. Neither layer publishes a dwelling-unit count; see note 4
    // in the header. An absent field is the honest render — a 0 would flow into
    // the no-net-loss check as "nothing to lose".
    assessedValue: posInt(supp?.FCV_CUR),
    assessedValueBasis:
      'Maricopa County Assessor FULL CASH VALUE (FCV) for valuation year 2027 — the statutory market-value estimate, NOT the Limited Property Value (LPV) that most Arizona property tax is levied on',
  }
  const hasAnyExisting = Object.entries(existingBase).some(
    ([k, v]) => k !== 'assessedValueBasis' && v != null,
  )
  const existing = ownerPublic
    ? { ...existingBase, ownerPublic: true }
    : hasAnyExisting
      ? existingBase
      : undefined

  const sources: Record<string, string> = {
    parcels: PARCELS,
    parcelDetail: PARCELS_SUPPLEMENT,
    zoning: ZONING,
    // Was published here as `cityBoundary` with the same URL. Renamed, not
    // added: twelve gates publishing under one key is the point, and three
    // spellings for one claim read as three different things.
    ...cityLimitsSource('phoenix'),
    overlays: ZONING_OVERLAYS,
    historic: HISTORIC,
    flood: ENDPOINTS.flood,
    zoningCode: 'https://phoenix.municipal.codes/ZO/contents',
  }
  // The parcel layer hands out a per-parcel deep link into the Maricopa County
  // Assessor's own map, which is where the valuation above can be checked.
  const assessorLink = clean(parcel.ASSESSOR_INFO)
  if (assessorLink && /^https?:\/\//i.test(assessorLink)) sources.assessor = assessorLink

  const info: ParcelInfo = {
    ...recordAddress(streetAddress(parcel)),
    parcelId: clean(parcel.APN) ?? '',
    coordinates: [lng, lat],
    zoning: {
      districtCode: code ?? 'Unknown',
      subdistrict: clean(zoning?.LABEL1) ?? clean(zoning?.GEN_ZONE),
      article: buildArticle(limits, overlayNames),
      // Feet where the ordinance prints feet, storeys where it prints storeys,
      // and NEITHER derived from the other — this provider has no
      // feet-per-storey constant and the zoning module has none either
      // (zoning/phoenix.ts FACT 1).
      maxHeightFt: limits.height?.ft ?? null,
      ...(limits.height?.stories != null ? { maxStories: limits.height.stories } : {}),
      // Null on every mapped Phoenix district: the ordinance states a FAR only
      // in §626.H.1, and both mapped Commerce Park options hold an em dash
      // there. `farUnconstrained` below is what distinguishes that from a gap.
      maxFAR: limits.maxFAR,
      // The module already establishes this district as plan/site-plan
      // governed, with a citation and the disclosure text above. Carrying the
      // flag through lets the envelope report it as a planned development
      // rather than as a failure to look it up.
      ...(limits.planGoverned ? { planGoverned: true } : {}),
      allowedUses: usesForZone(code),
      // The KNOWN absence, kept distinct from an unresolved lookup. Set only
      // where the district's own standards enumeration has no floor-area-ratio
      // item at all — never on CP/BP or CP/GCP, where the slot exists and is
      // empty, and never on an unrecognised code, so a gap can never render as
      // "FAR does not bind here" and can never fall back to an assumed 1.0.
      ...(limits.farUnconstrained ? { farUnconstrained: true } : {}),
    },
    lot: { sizeSqFt: lotSqFt, lotType: null },
    overlays: {
      historicDistrict,
      floodZone: clean(flood?.FLD_ZONE),
      // `historicDistrict` has TWO sources — the named register listing on the
      // optional HISTORIC layer, and the HP/HP-L suffix on the REQUIRED zoning
      // read — so a failed HISTORIC read is only a gap when the suffix did not
      // answer it either (CLAUDE.md rule 13). See `lib/unresolvedOverlays.ts`.
      ...unresolvedOverlays({
        historic: historicDistrict == null && readFailed(histR),
        flood: readFailed(floodR),
      }),
    },
    existing,
    // The Assessor's Full Cash Value. Labelled on `existing.assessedValueBasis`
    // because Arizona publishes TWO values per parcel and they are not close:
    // measured over 6,000 sampled Phoenix rows, LPV/FCV has a median of 0.48,
    // a 5th percentile of 0.393, and exceeded 1.0 on ZERO of 5,998 rows with
    // both populated — LPV is always the smaller. Publishing LPV as a
    // land-cost proxy would understate by roughly half.
    //
    // FCV was missing or zero on 2 of those 6,000 rows and CONST_YEAR on 452
    // (7.5%), so a null here is sparse data rather than a geographic hole.
    //
    // TAX_YR_CUR reads '2027' on every row in the table (measured with
    // returnDistinctValues — it is the only value the field takes), which is a
    // forward valuation year, not a stale one. No claim is made about how this
    // tracks the market; none has been measured, and a disclaimer naming the
    // wrong direction is worse than none (CLAUDE.md rule 7).
    assessedValue: posInt(supp?.FCV_CUR),
    sources,
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'phoenix', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}

/** THE PARCEL LAYER AND THE COLUMN THIS PROVIDER READS ITS ID FROM.
 *
 *  Exported rather than transcribed into a registry. The layer URLs here are
 *  built from per-file base constants, so any second copy would be a hand-typed
 *  duplicate of a fact this file already holds — and this repo has paid for that
 *  three times. The watchlist checker re-finds a stored parcel BY ID, which is a
 *  different query from the point-in-polygon the report uses, and it needs both
 *  halves from the one place that already knows them. */
export const PARCEL_SOURCE = { layer: PARCELS, idField: 'APN' } as const
