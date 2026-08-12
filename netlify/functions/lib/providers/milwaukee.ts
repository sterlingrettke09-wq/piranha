// Milwaukee provider — City of Milwaukee ArcGIS (milwaukeemaps.milwaukee.gov)
// + FEMA NFHL.
//
// Verified live 2026-08-08. Every endpoint below was point-queried at real
// Milwaukee addresses before this file was written — 2318 N Sherman Bl, 1030 W
// Scott St, 789 N Water St, 200 E Wells St (City Hall), 200 S Rite-Hite Wa and
// the 311 E Chicago St condominium — and the load-bearing results were
// re-queried across separate isolated runs (CLAUDE.md rule 10) and came back
// identical. All layers accept inSR=4326 point queries; observed 0.2-1.3 s.
//
// Modelled on denver.ts (one parcel layer carrying assessor attributes AND
// owner, one separate zoning layer, optional overlays, a curated table for the
// dimensional standards the GIS does not publish). Milwaukee differs in five
// ways that each remove or add a specific class of error:
//
//   1. THE GIS PUBLISHES NO HEIGHT AND NO FLOOR-AREA FIELD AT ALL. The zoning
//      layer carries `Zoning`, `ZoningCategory` and `ZoningType` and nothing
//      else, so every dimensional figure comes from the curated Chapter 295
//      table in ../zoning/milwaukee.ts. There is no live number to cross-check
//      against and none to be silently preferred over the code (the Denver
//      HEIGHT_STORIES defect cannot occur here).
//   2. HEIGHT IS IN FEET THROUGHOUT. Chapter 295 states no story cap anywhere,
//      so `maxStories` is never set and no conversion exists to drift
//      (CLAUDE.md rule 12).
//   3. LOT AREA ARRIVES IN SQUARE FEET, verified against the geometry rather
//      than inferred from the field name (CLAUDE.md rule 9): the layer's
//      spatial reference is EPSG:32054 (NAD27 / Wisconsin South, US feet), and
//      shoelacing the returned polygon rings in that projection reproduces
//      `LOT_AREA` to a median ratio of 1.0000 across 25 sampled ordinary
//      parcels (min 0.9983, max 1.0116). That is also why the polygon is a
//      sound fallback where LOT_AREA is unusable — see LOT AREA below.
//   4. A POINT CAN LAND ON A STACK OF PARCELS. Condominium units are separately
//      taxed rows sharing ONE polygon: the 311 E Chicago St point returns 15
//      features, all `PARCEL_TYPE = 1`, all with the same 21,651 sq ft ring and
//      each carrying a per-unit `LOT_AREA` of 566-2,255 sq ft. Taking
//      `features[0]` would be the San Diego probe defect — an arbitrary pick
//      whose identity depends on the server's ordering.
//   5. TAX-EXEMPT PARCELS REPORT '0'. City Hall's `C_A_TOTAL` is the string
//      '0'; the real figure sits in `C_A_EXM_TOTAL` (10,966,000). Reading only
//      the first would publish a $0 valuation for every church, school, park
//      and public building in the city — a fabricated answer, not a gap.
//
// Jurisdiction note: unlike Raleigh's county-wide parcel service, both the
// parcel layer (148,937 features) and the zoning layer (148,099) are City of
// Milwaukee only, so the two datasets cover the same ground and a click outside
// the city returns no parcel rather than a parcel with no zoning.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { resolveMilwaukee, usesForZone, MILWAUKEE_DISTRICT_NAMES } from '../zoning/milwaukee'

// MPROP_full (layer 2), not MPROP_lite (layer 1). Both are the same 159,963
// features over the same geometry, but only _full carries `C_A_EXM_*` — the
// exempt-value columns without which every tax-exempt parcel publishes $0 —
// plus `NR_STORIES` and `YR_ASSMT`. The cost is that _full has no pre-assembled
// `ADDRESS` field, so the address is composed from its components below.
const PARCELS = 'https://milwaukeemaps.milwaukee.gov/arcgis/rest/services/property/parcels_mprop/MapServer/2'
// Layer 12 "Zoning with downtown subdistricts". Layer 11 "Zoning" was queried
// at all four probe points and returned the identical feature (same OBJECTID,
// same value) each time, and both layers report 148,099 features and the same
// 52 distinct `Zoning` values — they are redundant. Layer 12 is used because
// its name is the one that promises the downtown subdistrict, and the
// subdistrict is load-bearing: C9F(B) and C9F(C) have different height limits.
const ZONING = 'https://milwaukeemaps.milwaukee.gov/arcgis/rest/services/planning/zoning/MapServer/12'
// LOCAL historic districts (33 polygons) — the ones the Milwaukee Historic
// Preservation Commission administers, which is what makes `historicDistrict` a
// preservation-review trigger downstream. Layer 18 on the same service is the
// NATIONAL REGISTER districts and is deliberately NOT read: national listing
// alone imposes no local design review on private work, and putting it in this
// field would be false in a field downstream code treats as a review gate. The
// two disagree in both directions at real points — 2318 N Sherman Bl is in the
// local "Sherman Boulevard" district AND the national "North Sherman
// Boulevard" one, while 200 E Wells St is in a national district and no local
// one.
const HISTORIC = 'https://milwaukeemaps.milwaukee.gov/arcgis/rest/services/planning/special_districts/MapServer/17'

const OVERLAYS_BASE = 'https://milwaukeemaps.milwaukee.gov/arcgis/rest/services/planning/zoning/MapServer'
// Layer ids read off the service's own layer index 2026-08-08, not guessed
// (CLAUDE.md rule 8): 4 DIZ · 5 Interim Study · 6 Lakefront · 7 Master sign ·
// 8 Neighborhood Conservation · 9 SPROZ · 10 Shoreland/wetland.
//
// Three are fetched, and the reason is the ordinance rather than the layer
// name. s. 295-1001 says overlay zones "may also ALTER the standards of any
// base zoning district except a planned development district", and two of them
// say so about height explicitly:
//   · DIZ, s. 295-1007-3-a — performance standards "may include ... building
//     height, bulk, placement ... These standards shall supercede the standards
//     of the underlying district." 26 polygons.
//   · SPROZ, s. 295-1009-3-a — design standards "may include ... building
//     height, bulk, placement ..." and the same supersession clause. 40
//     polygons.
//   · NC, s. 295-1003 — the neighborhood conservation plan and guidelines it
//     adopts govern maintenance, protection and infill. 3 polygons.
// The Interim Study layer currently holds ZERO features (measured), so it is
// not fetched; master sign, lakefront and shoreland/wetland do not bear on the
// height or floor-area figures this provider publishes.
const OVERLAY_DIZ = `${OVERLAYS_BASE}/4`
const OVERLAY_SPROZ = `${OVERLAYS_BASE}/9`
const OVERLAY_NC = `${OVERLAYS_BASE}/8`

const PARCEL_FIELDS = [
  'TAXKEY',
  'PARCEL_TYPE',
  'HOUSE_NR_LO',
  'HOUSE_NR_SFX',
  'SDIR',
  'STREET',
  'STTYPE',
  'UNIT',
  'OWNER_NAME_1',
  'C_A_CLASS',
  'C_A_LAND',
  'C_A_TOTAL',
  'C_A_EXM_LAND',
  'C_A_EXM_TOTAL',
  'YR_ASSMT',
  'LOT_AREA',
  'ZONING',
  'NR_UNITS',
  'YR_BUILT',
  'NR_STORIES',
  'BLDG_AREA',
] as const

/** The parcel layer's own spatial reference: NAD27 / Wisconsin South, US survey
 *  feet. Polygon rings returned in it are already in square feet when
 *  shoelaced — no conversion factor is introduced anywhere in this file. */
const MILWAUKEE_SR = 32054

/** Below this, a `LOT_AREA` is not a development site: 4,610 condominium rows
 *  carry fractional-interest values under 1.0 and 8,044 fee parcels carry null
 *  or zero. Screens the value OUT; never used to compute one. */
const MIN_CREDIBLE_LOT_SQFT = 100

/** Above this, MPROP's `LOT_AREA` is checked against the parcel's own polygon
 *  rather than believed. 71 fee parcels carry impossible values — 722 E Juneau
 *  reports 19.07 BILLION sq ft, roughly seven times the land area of the whole
 *  city, and 1111 N Vel R Phillips reports 13.2 billion.
 *
 *  ⚠️ This constant decides only WHETHER TO MEASURE. It never becomes a
 *  published number: in that branch the reported lot size is the shoelaced
 *  polygon area, so the screen cannot bias the answer, only trigger the check.
 *  5,000,000 sq ft is about 115 acres — comfortably above any real Milwaukee
 *  parcel and four orders of magnitude below the corrupt values. */
const IMPLAUSIBLE_LOT_SQFT = 5_000_000

const numOrNull = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/**
 * Compose the street address from MPROP_full's components. MPROP_lite's
 * pre-assembled `ADDRESS` field is exactly this join (checked against both
 * layers at four addresses: "2318 N SHERMAN BL", "1030 W SCOTT ST",
 * "789 N WATER ST", "311 E CHICAGO ST 100"), so nothing is invented — the
 * component form is used only because _lite lacks the exempt-value columns.
 */
function composeAddress(a: Record<string, unknown>): string {
  const s = (k: string) => (a[k] != null ? String(a[k]).trim() : '')
  const parts = [`${s('HOUSE_NR_LO')}${s('HOUSE_NR_SFX')}`, s('SDIR'), s('STREET'), s('STTYPE'), s('UNIT')]
  const joined = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  return joined && joined !== '0' ? joined : 'Selected location'
}

/** Signed shoelace over ESRI rings. Outer rings are clockwise and holes are
 *  counter-clockwise, so summing SIGNED areas and taking the magnitude at the
 *  end nets holes out correctly. Input must already be in a projected SR whose
 *  unit is feet (here EPSG:32054); the result is square feet with no
 *  conversion factor applied. */
export function ringAreaSqFt(rings: number[][][] | undefined): number | null {
  if (!rings || rings.length === 0) return null
  let total = 0
  for (const ring of rings) {
    if (!ring || ring.length < 4) continue
    let sum = 0
    for (let i = 0; i < ring.length - 1; i++) {
      sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    }
    total += sum / 2
  }
  const area = Math.abs(total)
  return area > 0 ? area : null
}

/**
 * Pick one feature out of what the point query returned.
 *
 * The exact (unbuffered) query returns EVERY polygon containing the click, so a
 * condominium returns its whole stack — 15 rows at 311 E Chicago St, all over
 * one shared 21,651 sq ft ring. Taking `features[0]` makes the same click flap
 * between units run to run, which is the San Diego probe defect exactly.
 *
 * Rule, in order:
 *   1. Prefer a fee parcel (`PARCEL_TYPE` 0 or null) over a condominium unit
 *      (`PARCEL_TYPE` 1). Note `null` is a REAL fee parcel and not a shell —
 *      1,026 rows carry it, including 200 S Rite-Hite Wa, a 128-unit apartment
 *      building assessed at $68.8M. A filter of `PARCEL_TYPE === 0` would have
 *      thrown that away.
 *   2. Among what is left, sort by TAXKEY and take the first. Deterministic and
 *      independent of the server's ordering, so repeated calls agree.
 * Where the stack is condominium units only (the common case — the Third Ward
 * point returns no fee parcel at all), step 2 still yields one stable answer
 * and the caller reads the lot size off the shared polygon, not off the unit.
 */
export function selectParcel(
  features: Array<{ attributes: Record<string, unknown> }> | undefined,
): Record<string, unknown> | null {
  const rows = (features ?? []).map((f) => f.attributes).filter(Boolean)
  if (rows.length === 0) return null
  const fee = rows.filter((r) => Number(r.PARCEL_TYPE) !== 1)
  const pool = fee.length > 0 ? fee : rows
  return [...pool].sort((a, b) => String(a.TAXKEY ?? '').localeCompare(String(b.TAXKEY ?? '')))[0]
}

/** Fetch the parcel polygon in the layer's own projected SR so its area can be
 *  measured. Keyed on TAXKEY rather than on the click point, so it returns the
 *  polygon of the parcel we already selected. Only called when MPROP's own
 *  LOT_AREA cannot be used. */
async function fetchParcelPolygon(taxkey: string, timeoutMs = 4000): Promise<number[][][] | undefined> {
  const u = new URL(PARCELS + '/query')
  u.searchParams.set('where', `TAXKEY='${taxkey.replace(/'/g, "''")}'`)
  u.searchParams.set('outFields', 'TAXKEY')
  u.searchParams.set('returnGeometry', 'true')
  u.searchParams.set('outSR', String(MILWAUKEE_SR))
  u.searchParams.set('resultRecordCount', '1')
  u.searchParams.set('f', 'json')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(u.toString(), { signal: ctrl.signal })
    if (!res.ok) return undefined
    const data = (await res.json()) as {
      error?: unknown
      features?: Array<{ geometry?: { rings?: number[][][] } }>
    }
    if (data && typeof data === 'object' && 'error' in data && data.error) return undefined
    return data.features?.[0]?.geometry?.rings
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Read the assessed value, coalescing the taxable and exempt columns.
 *
 * Wisconsin assesses real property at market: Wis. Stat. s. 70.32(1) —
 * "Real property shall be valued by the assessor ... at the full value which
 * could ordinarily be obtained therefor at private sale." So unlike a
 * fractional-assessment state this figure is a market-basis number.
 *
 * Tax-exempt parcels report '0' in `C_A_*` and carry the assessor's figure in
 * `C_A_EXM_*` instead. Both arrive as STRINGS.
 */
function assessed(a: Record<string, unknown>, taxable: string, exempt: string): number | null {
  return posInt(a[taxable]) ?? posInt(a[exempt])
}

/** Label an overlay hit, deduplicating repeated names — the Reed Street Yards
 *  point returns the DIZ twice, once per Common Council file. */
function overlayNames(fs: { features?: Array<{ attributes: Record<string, unknown> }> } | null, field: string): string[] {
  const seen = new Set<string>()
  for (const f of fs?.features ?? []) {
    const v = f.attributes?.[field]
    if (v != null && String(v).trim()) seen.add(String(v).trim())
  }
  return [...seen]
}

/** First non-empty link across an overlay's features. */
function overlayLink(fs: { features?: Array<{ attributes: Record<string, unknown> }> } | null): string | null {
  for (const f of fs?.features ?? []) {
    const v = f.attributes?.CFN_LINK
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return null
}

/**
 * Build the `article` label.
 *
 * `ParcelInfo['zoning']` has no structured slot for a per-building-type height
 * table, for a stated "no maximum height", or for an overlay that supersedes
 * the base district, and this task may not widen the shared type. So all three
 * ride here as text. They are NOT decoration — each is a figure or a
 * qualification that would otherwise be silently dropped:
 *
 *   · `heightByUse` is the whole rule-6 story. Table 295-605-2 caps a
 *     single- or two-family dwelling in RB1 at 45 ft while the district's
 *     non-residential and multi-family panel says 85 ft; Table 295-805-2 states
 *     "none" for an industrial building in IH and 60 ft for a non-industrial
 *     one. `maxHeightFt` carries the LOWEST of them, so without this line the
 *     other figures would not exist anywhere in the response.
 *   · A stated "none" is an ANSWER (the code imposes no height limit), and with
 *     no `heightUnconstrained` field on ParcelInfo it would otherwise render
 *     identically to a failed lookup — the exact conflation CLAUDE.md rule 5
 *     exists to prevent.
 *   · A DIZ or SPROZ overlay may supersede the base district's height outright,
 *     which makes the published figure a ceiling this site may not have. The
 *     Common Council file is linked from `sources` so the reader can check.
 */
function buildArticle(
  code: string | null,
  zoningType: unknown,
  overlays: { diz: string[]; sproz: string[]; nc: string[] },
): string | null {
  const limits = resolveMilwaukee(code)
  const bits: string[] = []

  const liveName = zoningType != null && String(zoningType).trim() ? String(zoningType).trim() : ''
  const name = liveName || (code ? (MILWAUKEE_DISTRICT_NAMES[code] ?? '') : '')
  if (name) bits.push(name)

  if (limits.planGoverned) {
    bits.push(
      'No by-right dimensional standards in the base code — the adopted plan for this district governs (Milwaukee Code s. 295-907-3-b / s. 295-909-3)',
    )
  }
  if (limits.dataDefect) {
    bits.push(
      "The City's own zoning layer flags this parcel: \"A problem has been identified with the zoning assigned to this parcel.\" No district standards are reported.",
    )
  }

  // Every stated figure, by building type. The headline `maxHeightFt` is the
  // lowest of these; publishing the largest as the parcel's ceiling would
  // assume a program the user has not chosen (CLAUDE.md rule 6).
  for (const rule of limits.heightByUse) {
    const figure = rule.heightUnconstrained
      ? 'the code states NO maximum height (an answer, not a missing lookup)'
      : `${rule.heightFt} ft`
    const qual = rule.qualifier ? ` — ${rule.qualifier}` : ''
    bits.push(`${rule.useLabel}: ${figure} (${rule.source})${qual}`)
  }

  if (limits.floorAreaFormulas && limits.floorAreaFormulas.length > 0) {
    const tiers = limits.floorAreaFormulas
      .map((t) => {
        const cond =
          t.openSpaceCondition === 'atMost40Percent'
            ? 'surface open space 40% or less of the site'
            : t.openSpaceCondition === 'between40And80Percent'
              ? 'surface open space more than 40% and less than 80%'
              : 'surface open space 80% or more'
        return `${cond}: ${t.formula}`
      })
      .join('; ')
    bits.push(
      `Downtown floor area is a FORMULA, not a ratio: Table 295-705-1 states permitted floor area over W (development-site size), X (surface open space), Y (qualifying rooftop open space) and Z (interior atrium volume, in cubic feet), defined in s. 295-705-4 — ${tiers}. These are alternatives selected by the applicant's own site design, so no single floor-area number applies until the building is designed. Left unpriced here rather than collapsed to one figure.`,
    )
  }

  if (overlays.diz.length > 0) {
    bits.push(
      `Development Incentive Zone (${overlays.diz.join(', ')}): under Milwaukee Code s. 295-1007-3-a the zone's performance standards may set building height and bulk and "shall supercede the standards of the underlying district". The figures above are the base district's, not necessarily this site's.`,
    )
  }
  if (overlays.sproz.length > 0) {
    bits.push(
      `Site Plan Review overlay zone (${overlays.sproz.join(', ')}): under Milwaukee Code s. 295-1009-3-a the zone's design standards may set building height and bulk and "shall supercede the standards of the underlying district". The figures above are the base district's, not necessarily this site's.`,
    )
  }
  if (overlays.nc.length > 0) {
    bits.push(
      `Neighborhood Conservation overlay zone (${overlays.nc.join(', ')}): an adopted neighborhood conservation plan and guidelines apply (Milwaukee Code s. 295-1003).`,
    )
  }

  return bits.length > 0 ? bits.join(' · ') : null
}

export async function getMilwaukeeParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const deadline = requestDeadline()
  // REQUIRED reads go through readRequired; OPTIONAL ones keep allSettled. See
  // the contract at the top of ../requiredUpstream.ts. maxAttempts 2, not 3:
  // fetchParcelSnap already retries its exact query internally, so three outer
  // attempts would be up to six queries.
  const [parcelR, zoningR, optional] = await Promise.all([
    readRequired('parcel', (t) => fetchParcelSnap(PARCELS, lat, lng, PARCEL_FIELDS, false, undefined, 30, t), {
      deadline,
      maxAttempts: 2,
      attemptCapMs: 4000,
    }),
    readRequired(
      'zoning',
      (t) => fetchParcelSnap(ZONING, lat, lng, ['Zoning', 'ZoningCategory', 'ZoningType'], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    Promise.allSettled([
      fetchFeatures(HISTORIC, lat, lng, ['NAME']),
      fetchFeatures(OVERLAY_DIZ, lat, lng, ['DIZ_NAME', 'CFN', 'CFN_LINK']),
      fetchFeatures(OVERLAY_SPROZ, lat, lng, ['SPROD_NAME', 'CFN', 'CFN_LINK']),
      fetchFeatures(OVERLAY_NC, lat, lng, ['NAME', 'CFN_APPROVE']),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    ]),
  ])
  const [histR, dizR, sprozR, ncR, floodR] = optional

  // THE STATE SPLIT. A service that did not answer is an error and the only legal
  // handling is to refuse. A service that ANSWERED and found nothing is a
  // different fact and survives past this line, where it becomes the `Unknown`
  // the no-coverage copy is written for.
  if (!parcelR.ok || !zoningR.ok) {
    return upstreamUnavailable('milwaukee', 'Milwaukee', [parcelR, zoningR], t0)
  }

  const parcel = selectParcel(parcelR.value.features)
  warnIfMissing(parcel, ['TAXKEY', 'LOT_AREA', 'C_A_TOTAL', 'C_A_EXM_TOTAL', 'PARCEL_TYPE'], 'milwaukee')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED.
  const zoning = firstAttrs(zoningR.value)
  warnIfMissing(zoning, ['Zoning'], 'milwaukee')
  const hist = histR.status === 'fulfilled' ? histR.value : null
  const dizFs = dizR.status === 'fulfilled' ? dizR.value : null
  const sprozFs = sprozR.status === 'fulfilled' ? sprozR.value : null
  const ncFs = ncR.status === 'fulfilled' ? ncR.value : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // ── Zoning ───────────────────────────────────────────────────────────────
  // Read from the ZONING LAYER, not from MPROP's own `ZONING` column. Both
  // exist and agreed at all six probe points, but they are two copies of one
  // fact maintained by different teams — the zoning layer is the one the
  // Department of City Development publishes as the zoning map, and MPROP's is
  // an assessor-side denormalisation. A disagreement is logged rather than
  // averaged away (CLAUDE.md rule 9).
  const code = zoning?.Zoning != null && String(zoning.Zoning).trim() ? String(zoning.Zoning).trim() : null
  const mpropZone = parcel.ZONING != null ? String(parcel.ZONING).trim() : ''
  if (code && mpropZone && code !== mpropZone) {
    console.log({ event: 'zoning_code_mismatch', city: 'milwaukee', zoningLayer: code, mprop: mpropZone })
  }
  const limits = resolveMilwaukee(code)

  const overlays = {
    diz: overlayNames(dizFs, 'DIZ_NAME'),
    sproz: overlayNames(sprozFs, 'SPROD_NAME'),
    nc: overlayNames(ncFs, 'NAME'),
  }

  // ── Lot area ─────────────────────────────────────────────────────────────
  // MPROP's `LOT_AREA` is square feet (measured against the geometry — see the
  // header). It is used when it is credible AND the row is a fee parcel. It is
  // replaced by the parcel's own shoelaced polygon when:
  //   · the row is a condominium unit, whose LOT_AREA is a per-unit figure and
  //     not the development site (311 E Chicago St: 15 units, LOT_AREA 0-2,255,
  //     one shared 21,651 sq ft ring — the ring is the site);
  //   · LOT_AREA is null, zero or below the credibility floor (8,044 of 146,811
  //     fee parcels, 5.5%, including City Hall); or
  //   · LOT_AREA is impossibly large (71 fee parcels).
  // When neither source works the answer is null — a gap, not a zero.
  const isCondoUnit = Number(parcel.PARCEL_TYPE) === 1
  const rawLot = numOrNull(parcel.LOT_AREA)
  const lotUsable =
    !isCondoUnit && rawLot != null && rawLot >= MIN_CREDIBLE_LOT_SQFT && rawLot <= IMPLAUSIBLE_LOT_SQFT
  let lotSqFt: number | null = lotUsable && rawLot != null ? Math.round(rawLot) : null
  if (lotSqFt == null && parcel.TAXKEY != null) {
    const polygon = await fetchParcelPolygon(String(parcel.TAXKEY))
    const area = ringAreaSqFt(polygon)
    if (area != null && area >= MIN_CREDIBLE_LOT_SQFT) lotSqFt = Math.round(area)
  }

  // ── Existing structure ───────────────────────────────────────────────────
  // OWNER_NAME_1 is read ONLY to derive a government-owned boolean; the name is
  // discarded here and never stored or returned.
  const ownerPublic = isGovernmentOwner(parcel.OWNER_NAME_1 != null ? String(parcel.OWNER_NAME_1) : null)
  const yearBuilt = posInt(parcel.YR_BUILT)
  // NR_STORIES arrives as a STRING and is genuinely fractional ("1.5" is the
  // commonest Milwaukee house). This is the EXISTING building's story count —
  // a fact about what stands here — and is never confused with a zoning limit,
  // because Chapter 295 states no story limit at all (see the zoning module's
  // FACT 2).
  const storiesRaw = numOrNull(parcel.NR_STORIES)
  const assessedYear = posInt(parcel.YR_ASSMT)
  const existingBase = {
    // MPROP's `LAND_USE` / `LAND_USE_GP` are numeric codes whose decode this
    // provider has not sourced, so no land-use label is published rather than a
    // guessed one.
    landUse: null,
    yearBuilt: yearBuilt != null && yearBuilt > 1000 ? yearBuilt : null,
    buildingAreaSqFt: posInt(parcel.BLDG_AREA),
    units: posInt(parcel.NR_UNITS),
    stories: storiesRaw != null && storiesRaw > 0 ? storiesRaw : null,
    assessedValue: assessed(parcel, 'C_A_TOTAL', 'C_A_EXM_TOTAL'),
    assessedValueBasis: `total assessed value, land + improvements, City of Milwaukee assessment year ${assessedYear ?? 'unknown'}${
      posInt(parcel.C_A_TOTAL) == null && posInt(parcel.C_A_EXM_TOTAL) != null
        ? ' (tax-exempt parcel: the figure is the assessor’s exempt valuation, C_A_EXM_TOTAL, because the taxable column reads 0)'
        : ''
    }`,
  }
  const hasAnyExisting = Object.entries(existingBase).some(
    ([k, v]) => k !== 'assessedValueBasis' && k !== 'landUse' && v != null,
  )
  const existing = ownerPublic
    ? { ...existingBase, ownerPublic: true }
    : hasAnyExisting
      ? existingBase
      : undefined

  // ── Sources ──────────────────────────────────────────────────────────────
  const sources: Record<string, string> = {
    parcels: PARCELS,
    zoning: ZONING,
    historic: HISTORIC,
    flood: ENDPOINTS.flood,
  }
  // Link the Common Council file for an overlay that can supersede the base
  // district, so the superseding standards are one click away rather than an
  // abstract warning. Do not attempt to parse it.
  const overlayFile = overlayLink(dizFs) ?? overlayLink(sprozFs)
  if (overlayFile) sources.overlayStandards = overlayFile

  const historicDistrict = overlayNames(hist, 'NAME')[0] ?? null

  const info: ParcelInfo = {
    address: composeAddress(parcel),
    parcelId: String(parcel.TAXKEY ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: code ?? 'Unknown',
      // The most development-consequential overlay present, in the order in
      // which they bind. Historic first: it is a review gate on the building
      // itself, where DIZ/SPROZ/NC alter the standards the building is judged
      // against.
      subdistrict:
        historicDistrict ??
        overlays.diz[0] ??
        overlays.sproz[0] ??
        overlays.nc[0] ??
        (zoning?.ZoningCategory != null && String(zoning.ZoningCategory).trim()
          ? String(zoning.ZoningCategory).trim()
          : null),
      article: buildArticle(code, zoning?.ZoningType, overlays),
      // Feet where Chapter 295 prints feet; null where it prints "none" or
      // where nothing resolved. The two are distinguished in `article` because
      // ParcelInfo has no `heightUnconstrained` field — see the zoning module's
      // FACT 4, and the note in this file's header.
      maxHeightFt: limits.heightFt,
      // Chapter 295 has no floor-area-ratio instrument in its residential,
      // commercial, industrial or institutional district tables (FACT 1); the
      // downtown districts DO regulate floor area, by a formula this module
      // declines to collapse (FACT 1b). Either way there is no ratio to report.
      maxFAR: null,
      allowedUses: usesForZone(code),
      // The KNOWN absence, kept distinct from an unresolved lookup and from the
      // downtown formula case. An unrecognised code, a PD/RED plan district, a
      // Parks parcel and a C9 parcel all leave this off, so a gap can never
      // render as "FAR does not bind here" — and can never fall back to an
      // assumed FAR of 1.0 either.
      ...(limits.farUnconstrained ? { farUnconstrained: true } : {}),
      // `maxStories` is deliberately NEVER set. Chapter 295 regulates height in
      // feet only. Table 295-505-2 does carry a row headed "Max. no. of stories
      // without side or rear setback adjustment" (RS4 3, RT4 4, RM6 8 ...) and
      // it is NOT a height cap — it is the threshold at which the setback
      // standards change. Publishing it here would be a fabricated story limit.
    },
    lot: {
      sizeSqFt: lotSqFt,
      // Flagged so a condominium's shared-site figure is never read as the
      // lot the user could build on alone.
      lotType: isCondoUnit ? 'Condominium unit — lot area is the shared development site' : null,
    },
    overlays: {
      historicDistrict,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      // A failed optional read is NOT "nothing here". Left as a bare null, the
      // hurdle each field triggers silently disappears along with the months it
      // carries — see `lib/unresolvedOverlays.ts` and the "could not be checked"
      // rows in `hurdles.ts`.
      ...unresolvedOverlays({
        historic: historicDistrict == null && readFailed(histR),
        flood: readFailed(floodR),
      }),
    },
    existing,
    // Wisconsin assesses real property at market value: Wis. Stat.
    // s. 70.32(1) — "Real property shall be valued by the assessor ... at the
    // full value which could ordinarily be obtained therefor at private sale."
    // (read 2026-08-08 at docs.legis.wisconsin.gov/document/statutes/70.32).
    // So this is a market-basis figure, not a fractional assessment.
    //
    // Currency: `YR_ASSMT` reads 2026 on every parcel probed, and Milwaukee
    // revalues annually, so this is a current-year assessment. No claim is made
    // here about how it stands against the market — no such measurement has
    // been taken, and a disclaimer naming the wrong direction is worse than
    // none (CLAUDE.md rule 7).
    assessedValue: assessed(parcel, 'C_A_TOTAL', 'C_A_EXM_TOTAL'),
    sources,
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'milwaukee', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
