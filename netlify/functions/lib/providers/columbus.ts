// Columbus provider — City of Columbus ArcGIS (maps2.columbus.gov) + FEMA NFHL.
//
// Verified live 2026-08-08. Every endpoint below was point-queried at real
// Columbus addresses before this file was written, and the load-bearing results
// were re-probed in isolation (CLAUDE.md rule 10). All layers accept inSR=4326
// point queries; the service is ArcGIS 11.5.
//
// Modelled on denver.ts, which is the closest existing shape: ONE MapServer
// carrying parcels and zoning as sibling layers, plus a handful of optional
// overlay layers. Columbus differs from Denver in four ways, and each one is a
// class of error rather than a preference:
//
//   1. TWO ZONING CODES ARE LIVE AT ONCE. Title 33 governs ~91% of mapped
//      polygons and Title 34 (the 2024 "Zone In" code) the rest, and which one
//      applies is resolvable ONLY from a second field — see
//      `zoning/columbus.ts` FACT 0. The provider therefore reads
//      GENERAL_ZONING_CATEGORY alongside CLASSIFICATION and never keys on the
//      district string.
//   2. THE PARCEL LAYER IS COUNTY-WIDE; THE ZONING LAYER STOPS AT THE CITY
//      LINE. A Dublin or Grove City address returns a real parcel, a real
//      address, a real lot size and a real assessed value with a null district
//      — an answer-shaped result for land this tool does not cover. Measured
//      2026-08-08: an ungated county sample returned a parcel at 60 of 60
//      points and zoning at 34. The Corporate Boundary layer (/21, a single
//      polygon named COLUMBUS) is fetched as a GATE, and a point outside it is
//      refused with OUT_OF_BBOX rather than answered.
//   3. LOT AREA HAS A DECOY FIELD. See `lotSqFtFromAcres` below.
//   4. STACKED CONDOMINIUM PARCELS SHARE ONE FOOTPRINT, so a point query can
//      return a dozen features with identical geometry. See `pickParcel`.
//
// ── LOT AREA ────────────────────────────────────────────────────────────────
// `ACRES` ("GIS Calculated Acres") × 43,560, and nothing else. Verified against
// the geometry rather than the field name (CLAUDE.md rule 9): 25 parcels were
// fetched with returnGeometry in EPSG:4326 and their rings integrated on the
// sphere; `ACRES × 43560` reproduced the measured area with a ratio of 1.0012
// on 25 of 25, and the 0.12% offset is constant across all 25 — i.e. it is the
// spherical approximation in the check, not scatter in the data.
//
// ⚠️ `STATEDAREA` IS NOT A LOT AREA AND ITS ALIAS ("Legal Acres") LIES. Measured
// over 10,000 sampled Franklin County parcels on 2026-08-08: 7,746 hold SQUARE
// FEET, 177 hold ACRES, 1 holds neither, 2,076 are null. Same column, two
// units, no discriminator field. 846 S High St reads STATEDAREA 11561 against
// ACRES 0.2654 (= 11,561 sf); the Easton mall parcel reads STATEDAREA 61.71
// against ACRES 60.99. A provider reading it publishes a 43,560× error on
// roughly 2% of parcels and looks perfectly plausible on the rest.
// `lotSqFtFromAcres` is the only lot-area path in this file, so `STATEDAREA`
// cannot be reached — a structure rather than a comment (rule 14).
//
// ── ASSESSED VALUE — WHAT THE *VALUEBASE COLUMNS ACTUALLY HOLD ──────────────
// Not what their names suggest, and the difference was only visible from
// OUTSIDE the system (rule 9). The Franklin County Auditor prints appraised
// value as a four-row block — Base, TIF, Exempt, Total. The GIS columns are
// named `LNDVALUEBASE` / `BLDVALUEBASE` / `TOTVALUEBASE`, and they carry the
// **Total** row, not the Base row. Checked against the Auditor's own records
// (reached via each parcel's `HYPERLINK` field), two parcels, both confirming:
//
//   846 S High St (010-043106) — Auditor 2025 Appraised Value
//     Base   134,800 / 285,200 / 420,000
//     TIF     96,300 / 113,200 / 209,500
//     Total  231,100 / 398,400 / 629,500   ← GIS returns exactly this row
//
//   148 Dakota Ave (010-009995)
//     Base    18,500 /  39,500 /  58,000
//     Exempt       0 / 340,900 / 340,900
//     Total   18,500 / 380,400 / 398,900   ← GIS returns exactly this row
//
// A parcel with no TIF and no exemption has Base == Total, so a single
// convenient sample "validates" the wrong reading. Both of the above carry an
// adjustment, which is what made the two readings separable.
//
// The figure is the Auditor's APPRAISED (market) value, not Ohio's 35% taxable
// value: 629,500 × 0.35 = 220,325 against the Auditor's printed taxable total
// of 220,330. So it is a legitimate land-cost proxy, and it includes the
// abated/exempt portion of the appraisal (85% of the Dakota Ave total).
//
// Vintage: the records are labelled "2025 Auditor's Appraised Value", and the
// Auditor's page currently advertises tentative 2026 values, i.e. a revaluation
// is in progress. This deliberately does NOT say which way the figure is stale:
// no measurement of Columbus market movement since the 2025 appraisal has been
// made here, and a disclaimer naming the wrong direction is worse than none
// (CLAUDE.md rule 7).
//
// ── ONE MORE OPERATIONAL FACT, OBSERVED RATHER THAN ASSUMED ────────────────
// The parcel layer is REPLACED wholesale, not updated in place: every row
// carries the same `SHP_UPLD_DATE`, and during the reload the layer serves a
// partial extract. Watched live on 2026-08-08 — the feature count climbed
// 443,428 → 571,300 → 688,183 over several minutes while queries against known
// parcels returned nothing. Nothing here needs fixing; it is why a miss must
// surface as NO_PARCEL and never as a substantive answer with null fields.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type FeatureSet, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { cityLimitsGate, cityLimitsSource, fetchCityLimits, outsideCity } from '../jurisdiction'
import { resolveColumbus, usesForZone, COLUMBUS_TITLE33_NAMES } from '../zoning/columbus'
import { recordAddress } from '../address'

const SERVICE = 'https://maps2.columbus.gov/arcgis/rest/services/Applications/Zoning/MapServer'
// Franklin County Auditor parcel fabric republished by the City. County-wide.
const PARCELS = `${SERVICE}/5`
// "Base Zoning", 18,804 polygons. Preferred over the sibling "All Base Zoning"
// (/31) and its open-data twin (Schemas/BuildingZoning/MapServer/4), which carry
// the same data plus 68 extra rows: across 56 in-city sample points the two
// agreed 55 times and disagreed once, where the superset returned an
// overlapping polygon (LARLD/H-60 against this layer's LC2/H-35). /20 returned
// exactly one polygon at all 56 points.
const ZONING = `${SERVICE}/20`
// Single polygon, CITY_NAME = 'COLUMBUS'. The jurisdiction gate — its URL, its
// match and its refusal wording live in ../jurisdiction.ts, one entry per live
// city, because this gate existed in four providers and was missing from eight
// that were measured publishing their neighbours' land.
const COLUMBUS_GATE = cityLimitsGate('columbus')!
// Layer ids read from the service's own layer index 2026-08-08, not guessed
// (CLAUDE.md rule 8): 14 Historic & Design Review Areas, 15 Commercial
// Overlays, 16 Planning Overlays, 21 Corporate Boundary.
const HISTORIC_AND_DESIGN = `${SERVICE}/14`
const COMMERCIAL_OVERLAYS = `${SERVICE}/15`
const PLANNING_OVERLAYS = `${SERVICE}/16`

const SQ_FT_PER_ACRE = 43560

const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/**
 * THE ONLY LOT-AREA PATH IN THIS FILE. Takes acres, returns square feet.
 *
 * It takes `acres` rather than the whole attribute record on purpose: there is
 * no way to call it with `STATEDAREA` and have the result be silently plausible,
 * because `STATEDAREA` is square feet on ~78% of parcels and passing those
 * through here yields a 43,560× number that no lot check would survive. The
 * decoy is unreachable by construction rather than by convention (rule 14).
 */
function lotSqFtFromAcres(acres: unknown): number | null {
  const a = Number(acres)
  if (!Number.isFinite(a) || a <= 0) return null
  return Math.round(a * SQ_FT_PER_ACRE)
}

/**
 * Pick ONE parcel deterministically from a point query that matched several.
 *
 * Columbus condominiums are platted as stacked parcels sharing a single
 * footprint: 12 features, identical geometry, identical ACRES, different
 * PARCELID and address. `nearestFeatureSet()` in arcgis.ts cannot break that
 * tie — every candidate's centroid is the same point — and the ArcGIS server
 * does not promise an order. Observed directly on 2026-08-08 at 39.919036,
 * -82.874822: four isolated probes 400 ms apart all led with 010-350320, and
 * after the layer was republished the same twelve features came back led by
 * 010-350327. Taking features[0] makes the same click return a different parcel
 * id and a different address depending on when it was asked, which is the San
 * Diego probe defect with a different cause.
 *
 * Sorting on PARCELID is arbitrary as a choice of unit, but it is REPRODUCIBLE,
 * and the figures the feasibility engine actually consumes — lot area and
 * zoning — are identical across the stack, so the choice changes no number.
 */
function pickParcel(fs: FeatureSet | null | undefined): Record<string, unknown> | null {
  const feats = fs?.features ?? []
  if (feats.length === 0) return null
  if (feats.length === 1) return feats[0].attributes
  const sorted = [...feats].sort((a, b) =>
    String(a.attributes?.PARCELID ?? '').localeCompare(String(b.attributes?.PARCELID ?? '')),
  )
  return sorted[0].attributes
}

/** All attribute records a layer returned, not just the first. Layer 14 can
 *  return a Design Review Area AND a listed property at the same point (the
 *  Statehouse does), and taking features[0] there publishes the design-review
 *  area as a historic district. */
function allAttrs(fs: FeatureSet | null | undefined): Array<Record<string, unknown>> {
  return (fs?.features ?? []).map((f) => f.attributes)
}

const str = (v: unknown): string => (v == null ? '' : String(v).trim())

/**
 * Historic designation from layer 14, which mixes three TYPEs: 'Historic
 * District' (18), 'Individual Listing' (66) and 'Design Review Area' (3).
 *
 * Only the first two may populate `overlays.historicDistrict`, because
 * downstream code treats that field as a preservation-review trigger. The three
 * Design Review Areas are the Downtown Commission, the East Franklinton Review
 * Board and the University Impact District Review Board — real review bodies
 * with real consequences, and none of them a historic designation. Calling the
 * Downtown District "historic" because a commission reviews it there would be
 * false, and it would be false on the most prominent parcels in the city.
 */
function historicFrom(rows: Array<Record<string, unknown>>): string | null {
  const district = rows.find((r) => str(r.TYPE) === 'Historic District')
  if (district) {
    const name = str(district.DISTRICT_NAME)
    const body = str(district.REVIEW_BODY)
    return [name, body].filter(Boolean).join(' — ') || null
  }
  const listing = rows.find((r) => str(r.TYPE) === 'Individual Listing')
  if (listing) {
    const name = str(listing.PROPERTY_NAME)
    // 'N/A' is the layer's own filler on district rows; on listings it carries
    // the property name.
    const clean = name && name.toUpperCase() !== 'N/A' ? name : ''
    return clean ? `${clean} (individually listed)` : 'Individually listed historic property'
  }
  return null
}

/** Design review areas, which are NOT historic but DO gate a permit. */
function designReviewFrom(rows: Array<Record<string, unknown>>): string | null {
  const dr = rows.find((r) => str(r.TYPE) === 'Design Review Area')
  if (!dr) return null
  const body = str(dr.REVIEW_BODY)
  const name = str(dr.DISTRICT_NAME)
  return body ? `${body}${name && name !== body ? ` (${name})` : ''}` : name || null
}

/**
 * TRUE where the parcel sits inside the University District Zoning Overlay.
 *
 * The Planning Overlays layer publishes six University polygons —
 * `University`, `University/Impact`, `University/Impact/FAR1`,
 * `University/Impact/FAR2`, `University/NC`, `University/RC` — and C.C. Ch.
 * 3325 imposes a real floor-area ratio across them. Any of them is enough to
 * withhold the `farUnconstrained` claim; see the zoning module's FACT 2.
 */
function inUniversityOverlay(rows: Array<Record<string, unknown>>): boolean {
  return rows.some((r) => /^University\b/i.test(str(r.OVERLAY_NAME)))
}

/**
 * Build the `article` label: the district's plain-language name, plus every
 * qualification that stops the published figures being read as an
 * unconditional by-right ceiling.
 *
 * ParcelInfo has no structured field for these and this task may not widen the
 * shared type, so they ride here as text. They are not decoration:
 *
 *   · `siteSpecific` covers 2,435 polygons (13% of the city) — the limited
 *     overlays and planned districts, where C.C. 3370.03 lets a
 *     council-approved development plan stipulate standards MORE stringent than
 *     the Zoning Code's. The base height is then a ceiling the site may not
 *     have, and the establishing ordinance is linked from `sources` so a reader
 *     can go and check.
 *   · The Title 34 bonus is named rather than hidden. Rule 6 cuts both ways:
 *     never publish the bonus as the ceiling, and never leave a reader thinking
 *     the by-right figure is the only figure in the district.
 *   · A height GAP says WHY it is a gap. "No limit available" and "the map
 *     assigns a symbol the code does not establish" are different statements
 *     and must not render the same (rule 5).
 */
function buildArticle(
  limits: ReturnType<typeof resolveColumbus>,
  classification: string | null,
  caseNumber: unknown,
  designReview: string | null,
  commercialOverlay: string | null,
  university: boolean,
): string | null {
  const bits: string[] = []
  const name = limits.districtName ?? (classification ? COLUMBUS_TITLE33_NAMES[classification.toUpperCase()] : undefined)
  if (name) bits.push(name)
  bits.push(
    limits.code === 'title-34'
      ? 'Governed by the 2024 Zoning Code (C.C. Title 34)'
      : limits.code === 'title-33'
        ? 'Governed by the legacy Zoning Code (C.C. Title 33) — this parcel has not been rezoned under the Zone In initiative (C.C. 3304.01)'
        : 'Zoning code not determined',
  )
  for (const alt of limits.alternatives ?? []) {
    const h = [alt.stories != null ? `${alt.stories} stories` : null, alt.heightFt != null ? `${alt.heightFt} ft` : null]
      .filter(Boolean)
      .join(' / ')
    bits.push(`${alt.label}: ${h} — earned, not by-right (${alt.source})`)
  }
  if (limits.siteSpecific) {
    const c = str(caseNumber) ? ` (case ${str(caseNumber)})` : ''
    bits.push(
      `Site-specific zoning${c}: a council-approved development plan governs alongside the base district and may limit height, units or use BELOW the figures shown. The figures shown are the base district's, not this site's.`,
    )
  }
  if (limits.heightGap) bits.push(`No height limit published for this parcel — ${limits.heightGap}`)
  if (limits.farGap) bits.push(`Floor-area ratio unresolved — ${limits.farGap}`)
  if (university) {
    bits.push(
      'Inside the University District Zoning Overlay (C.C. Ch. 3325), which adds a design review board and floor-area standards; C.C. 3304.03(H) applies it to 2024 Zoning Code parcels too',
    )
  }
  if (designReview) bits.push(`Design review: ${designReview}`)
  if (commercialOverlay) bits.push(`Commercial overlay: ${commercialOverlay}`)
  return bits.length > 0 ? bits.join(' · ') : null
}

export async function getColumbusParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
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
      'PARCELID',
      'SITEADDRESS',
      // ACRES only. STATEDAREA is deliberately NOT requested — see the header.
      'ACRES',
      'CLASSDSCRP',
      'OWNERNME1',
      'RESYRBLT',
      'BLDGAREA',
      'FLOORCOUNT',
      'LNDVALUEBASE',
      'BLDVALUEBASE',
      'TOTVALUEBASE',
      'COUNTY',
    ], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired(
      'zoning',
      (t) => fetchParcelSnap(ZONING, lat, lng, [
      'CLASSIFICATION',
      // The code discriminator. Without it the provider cannot tell Title 34's
      // UCR from Title 33's UCRPD (CLAUDE.md rule 13).
      'GENERAL_ZONING_CATEGORY',
      'HEIGHT_DISTRICT',
      'ORD_NO',
      'CASE_NUMBER',
      'WEB_LINK',
    ], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    Promise.allSettled([
      fetchCityLimits(COLUMBUS_GATE, lat, lng),
      fetchFeatures(HISTORIC_AND_DESIGN, lat, lng, ['TYPE', 'REVIEW_BODY', 'DISTRICT_NAME', 'PROPERTY_NAME']),
      fetchFeatures(PLANNING_OVERLAYS, lat, lng, ['OVERLAY_NAME']),
      fetchFeatures(COMMERCIAL_OVERLAYS, lat, lng, ['OVRLY_NAME']),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    ]),
  ])
  const [cityR, histR, planR, commR, floodR] = optional

  // ── Jurisdiction gate ────────────────────────────────────────────────────
  // Run BEFORE the parcel is read, because the county parcel layer will happily
  // answer for Dublin, Grove City, Upper Arlington, Westerville and Gahanna.
  // The gate degrades OPEN on a fetch failure — refusing a real Columbus
  // address because an optional layer timed out would be worse than the thing
  // it prevents — and the zoning miss then surfaces as a gap on its own.
  const outside = outsideCity('columbus', cityR, t0)
  if (outside) return outside

  // THE STATE SPLIT, and it sits AFTER the gate on purpose. The city-boundary
  // layer answers independently of the zoning layer, so when it says the point
  // is outside the city that is a complete answer and the more useful one — no
  // reason to trade it for "we couldn't reach the service" just because zoning
  // also timed out. Past this line, "the service did not answer" refuses and
  // "the service answered and found nothing" becomes the `Unknown` the
  // no-coverage copy is written for.
  if (!parcelR.ok || !zoningR.ok) {
    return upstreamUnavailable('columbus', 'Columbus', [parcelR, zoningR], t0)
  }

  const parcel = pickParcel(parcelR.value)
  warnIfMissing(parcel, ['PARCELID', 'SITEADDRESS', 'ACRES', 'TOTVALUEBASE'], 'columbus')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED.
  const zoning = firstAttrs(zoningR.value)
  warnIfMissing(zoning, ['CLASSIFICATION', 'GENERAL_ZONING_CATEGORY', 'HEIGHT_DISTRICT'], 'columbus')
  const histRows = histR.status === 'fulfilled' ? allAttrs(histR.value) : []
  const planRows = planR.status === 'fulfilled' ? allAttrs(planR.value) : []
  const commRows = commR.status === 'fulfilled' ? allAttrs(commR.value) : []
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  const classification = zoning?.CLASSIFICATION ? str(zoning.CLASSIFICATION) : null
  const category = zoning?.GENERAL_ZONING_CATEGORY ? str(zoning.GENERAL_ZONING_CATEGORY) : null
  const university = inUniversityOverlay(planRows)

  const limits = resolveColumbus({
    classification,
    generalZoningCategory: category,
    heightDistrict: zoning?.HEIGHT_DISTRICT != null ? String(zoning.HEIGHT_DISTRICT) : null,
    inUniversityOverlay: university,
  })

  const historicDistrict = historicFrom(histRows)
  const designReview = designReviewFrom(histRows)
  const commercialOverlay = commRows.length > 0 ? str(commRows[0].OVRLY_NAME) || null : null
  const planningOverlay = planRows.length > 0 ? str(planRows[0].OVERLAY_NAME) || null : null

  // ── Existing structure ───────────────────────────────────────────────────
  // OWNERNME1 is read ONLY to derive a government-owned boolean; the name is
  // discarded here and never stored or returned.
  const ownerPublic = isGovernmentOwner(parcel.OWNERNME1 != null ? String(parcel.OWNERNME1) : null)
  const landUse = str(parcel.CLASSDSCRP)
  const yearBuilt = posInt(parcel.RESYRBLT)
  const existingBase = {
    landUse: landUse || null,
    // RESYRBLT is the RESIDENTIAL year built and is null on commercial-class
    // records (846 S High St carries a 1920 build date on the Auditor's own
    // page and null here). Absent is absent; nothing is substituted.
    yearBuilt: yearBuilt != null && yearBuilt > 1000 ? yearBuilt : null,
    buildingAreaSqFt: posInt(parcel.BLDGAREA),
    stories: posInt(parcel.FLOORCOUNT),
    // BLDVALUEBASE is the improvement (building) half of the Auditor's TOTAL
    // appraised value — LNDVALUEBASE is the other half — so it is labelled and
    // must never be presented as a total. See the header for what "BASE" means
    // in these column names, which is not what it looks like.
    assessedValue: posInt(parcel.BLDVALUEBASE),
    assessedValueBasis:
      'improvement (building) portion of the Franklin County Auditor’s total appraised value, tax year 2025',
  }
  const hasAnyExisting = Object.entries(existingBase).some(
    ([k, v]) => k !== 'assessedValueBasis' && v != null,
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
    ...cityLimitsSource('columbus'),
    historic: HISTORIC_AND_DESIGN,
    flood: ENDPOINTS.flood,
  }
  // The ordinance that placed this zoning, where the layer links it. On a
  // site-specific district that ordinance IS the governing document, so it is
  // one click away rather than an abstract warning. Never parsed.
  const webLink = str(zoning?.WEB_LINK)
  if (webLink) sources.zoningOrdinance = webLink

  const info: ParcelInfo = {
    ...recordAddress(parcel.SITEADDRESS),
    parcelId: String(parcel.PARCELID ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: classification ?? 'Unknown',
      subdistrict: historicDistrict ?? designReview ?? planningOverlay ?? commercialOverlay,
      article: buildArticle(limits, classification, zoning?.CASE_NUMBER, designReview, commercialOverlay, university),
      // Feet where the code states feet, null where it does not. Never derived
      // from a story count — see the zoning module's FACT 3.
      maxHeightFt: limits.heightFt,
      // Neither code publishes a floor-area ratio. Where one DOES apply (the
      // University District overlay) the value is not resolvable from mapped
      // data, and that renders as a gap below rather than as a number.
      maxFAR: null,
      allowedUses: usesForZone(category),
      // The KNOWN absence, kept strictly distinct from an unresolved lookup: an
      // unrecognised district, a site-specific ordinance district, or a parcel
      // inside the University District overlay leaves this off entirely, so a
      // gap can never render as "FAR does not bind here" — and can never fall
      // back to an assumed FAR of 1.0 either.
      ...(limits.farUnconstrained ? { farUnconstrained: true } : {}),
      // Stories stay stories (CLAUDE.md rule 12). Title 34 states a story count
      // AND a feet figure on separate rows, so both are carried unconverted.
      // Title 33 states no story count anywhere, so this stays absent there —
      // an absence, not an invitation to divide.
      ...(limits.stories != null ? { maxStories: limits.stories } : {}),
    },
    lot: { sizeSqFt: lotSqFtFromAcres(parcel.ACRES), lotType: null },
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
    // Ohio appraises real property at market value and taxes 35% of it
    // (verified against the Auditor's own printed figures: 629,500 appraised →
    // 220,330 taxable, and 629,500 × 0.35 = 220,325). The number carried here
    // is the APPRAISED side — a market-basis figure, not the fractional
    // assessment. See the header for the column-name trap and the vintage note.
    assessedValue: posInt(parcel.TOTVALUEBASE),
    sources,
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'columbus', durationMs: Date.now() - t0, parcelId: info.parcelId })
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
export const PARCEL_SOURCE = { layer: PARCELS, idField: 'PARCELID' } as const
