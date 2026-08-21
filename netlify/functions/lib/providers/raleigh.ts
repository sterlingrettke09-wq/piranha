// Raleigh provider — City of Raleigh ArcGIS (maps.raleighnc.gov) + FEMA NFHL.
//
// Verified live 2026-08-07. Every endpoint below was point-queried at real
// Raleigh addresses before this file was written, and the load-bearing results
// were re-probed three times in isolation (CLAUDE.md rule 10) and came back
// byte-identical. All layers accept inSR=4326 point queries.
//
// Modelled on nashville.ts, which is the closest existing shape: one parcel
// layer carrying assessor attributes AND owner, one separate zoning layer, and
// optional overlay layers. Raleigh differs from Nashville in three ways worth
// naming, because each removes a class of error rather than adding one:
//
//   1. LOT AREA ARRIVES IN SQUARE FEET, so there is no unit conversion at all.
//      Nashville publishes acres and this provider's ancestor multiplied by
//      43,560. Verified rather than assumed: the parcel layer's spatial
//      reference is EPSG:2264 (NAD83 / North Carolina State Plane, US survey
//      feet), and shoelacing the returned polygon rings in that projection
//      reproduces `Shape_Area` to 4 decimal places on 25 of 25 sampled parcels
//      (median ratio 1.00000), while agreeing with the independent DEED_ACRES
//      column to a median of 0.996 after the deed's 2-dp rounding. Shape_Area
//      IS square feet, measured against the geometry, not inferred from a name.
//      DEED_ACRES is the weaker source — it rounds a 5,225 sf lot to "0.12" —
//      so it is used only as a fallback.
//   2. HEIGHT IS PUBLISHED NUMERICALLY for mixed-use districts, in STORIES.
//      The provider never converts it (CLAUDE.md rule 12); see the zoning
//      module's FACT 2 for the arithmetic proof that no ft/story constant can
//      reproduce Raleigh's own table.
//   3. OVERLAYS ARE 12 SEPARATE LAYERS, one per overlay type, rather than
//      Nashville's single multi-type layer — so Nashville's dedup logic does
//      not port. Four of the twelve matter here and are fetched in parallel.
//
// Jurisdiction note: the parcel service is Wake County property republished by
// the City, so it also covers Cary, Apex, Garner and the rest of the county. The
// zoning layer does NOT — it stops at Raleigh's planning jurisdiction. A click
// outside it returns a parcel with no zoning, which surfaces as districtCode
// 'Unknown' with null limits.
//
// ⚠️ THAT RENDER IS NOT SUFFICIENT, and a claim here called it correct until
// 2026-08-12. It is correct about the ZONING and it still publishes: the row
// carries a real address and a real lot area, and a lot area is all the cost
// engine needs. Cary, Garner and Wake Forest addresses inside RALEIGH_BBOX all
// returned ok:true, at 798,621 / 309,715 / 87,267 sq ft. An out-of-jurisdiction
// point is now REFUSED by the boundary gate below; the 'Unknown' render remains
// for in-jurisdiction land the zoning layer does not cover, and is still pinned
// by a test so it cannot quietly become a fabricated answer.
//
// ⚠️ THAT IS THE **EMPTY-ANSWER** CASE ONLY. A zoning fetch that FAILS is a
// different state and refuses with UPSTREAM_ERROR; the two used to produce the
// identical 'Unknown'. See ../requiredUpstream.ts.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { cityLimitsGate, cityLimitsSource, fetchCityLimits, outsideCity } from '../jurisdiction'
import {
  parseRaleighZone,
  resolveRaleigh,
  usesForZone,
  RALEIGH_DISTRICT_NAMES,
  RALEIGH_FRONTAGE_NAMES,
} from '../zoning/raleigh'
import { recordAddress } from '../address'

// Wake County property, republished by the City. Polygon layer.
const PARCELS = 'https://maps.raleighnc.gov/arcgis/rest/services/Property/Property/MapServer/0'
// Layer 0 of a 14-layer county-wide service — layers 1-13 are the other Wake
// municipalities, so index 0 is the City of Raleigh's own zoning.
const ZONING = 'https://maps.raleighnc.gov/arcgis/rest/services/Planning/Zoning/MapServer/0'
const OVERLAYS_BASE = 'https://maps.raleighnc.gov/arcgis/rest/services/Planning/Overlays/MapServer'
// The four overlay layers that bear on feasibility. Layer ids verified against
// the service's own layer index 2026-08-07 (not guessed — CLAUDE.md rule 8):
//   7 General Historic (-HOD-G)      8 Streetside Historic (-HOD-S)
//   9 Neighborhood Conservation      10 Transit Overlay (-TOD)
// All four share one schema: OVERLAY / OLAY_DECODE / OLAY_NAME / ZONE_CASE.
// The other eight (airport, metro park, three watershed, two highway corridor,
// residential parking) are not fetched.

// ── THE JURISDICTION GATE ─────────────────────────────────────────────────
// The Wake County parcel fabric answers for Cary, Apex, Garner and the rest of
// the county; see the jurisdiction note in the header for what was relied on
// before this gate existed and what it published.
//
// ⚠️ The gate is Planning Jurisdictions, NOT Corporate Limits — Raleigh zones
// inside its ETJ, and the corporate-limits layer under-covers it by 9 of 40
// sampled points. See ../jurisdiction.ts.
//
// The layer, the match and the refusal wording live in ../jurisdiction.ts,
// which carries one entry for every live city and records how each was
// established. It degrades OPEN on a failed fetch and reads the EXACT point,
// never a buffered snap.
const RALEIGH_GATE = cityLimitsGate('raleigh')!
const OVERLAY_HISTORIC_GENERAL = `${OVERLAYS_BASE}/7`
const OVERLAY_HISTORIC_STREETSIDE = `${OVERLAYS_BASE}/8`
const OVERLAY_NCOD = `${OVERLAYS_BASE}/9`
const OVERLAY_TOD = `${OVERLAYS_BASE}/10`

const OVERLAY_FIELDS = ['OVERLAY', 'OLAY_DECODE', 'OLAY_NAME'] as const
const SQ_FT_PER_ACRE = 43560

const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/** Label an overlay hit as "Name — Type", or just the type where the layer
 *  carries no name (the -TOD polygons have OLAY_NAME null). */
function describeOverlay(a: Record<string, unknown> | null | undefined): string | null {
  if (!a) return null
  const name = a.OLAY_NAME != null ? String(a.OLAY_NAME).trim() : ''
  const desc = a.OLAY_DECODE != null ? String(a.OLAY_DECODE).trim() : ''
  return [name, desc].filter(Boolean).join(' — ') || null
}

/**
 * Build the `article` label: the district's plain-language name, its frontage,
 * and — critically — every qualification that stops the published height from
 * being read as an unconditional by-right ceiling.
 *
 * ParcelInfo has no structured field for a conditional-use notice or for
 * per-building-type height alternatives, and this task may not widen the shared
 * type, so they ride here as text. They are NOT decoration:
 *
 *   · "-CU" is on 1,386 of 3,580 mapped polygons. A recorded ordinance can cap
 *     height, units or use BELOW the base district, which makes the base figure
 *     a ceiling the site may not actually have. The ordinance PDF is linked
 *     from `sources.zoningConditions` so a reader can go and check.
 *   · The R-6/R-10 alternatives exist because Article 2.2 states height per
 *     BUILDING TYPE. Naming them here is what stops a reader inferring that
 *     the 40 ft headline is the only figure in the district (CLAUDE.md rule 6
 *     cuts both ways: don't publish the max as a ceiling, and don't hide that
 *     other programs exist).
 */
function buildArticle(
  code: string | null,
  zoneTypeDecode: unknown,
  frontageDecode: unknown,
  zoneCase: unknown,
): string | null {
  const parts = parseRaleighZone(code)
  const limits = resolveRaleigh(code)
  const bits: string[] = []

  // Prefer the live layer's own decode; fall back to the curated name.
  const name = zoneTypeDecode != null && String(zoneTypeDecode).trim()
    ? String(zoneTypeDecode).trim()
    : parts.base
      ? RALEIGH_DISTRICT_NAMES[parts.base]
      : ''
  if (name) bits.push(name)

  const frontage = frontageDecode != null && String(frontageDecode).trim()
    ? String(frontageDecode).trim()
    : parts.frontage
      ? RALEIGH_FRONTAGE_NAMES[parts.frontage]
      : ''
  if (frontage) bits.push(`${frontage} frontage`)

  if (limits.masterPlanGoverned) {
    bits.push('No by-right dimensional standards — the approved Planned Development master plan governs (UDO Sec. 4.7.2)')
  }
  if (limits.masterPlanMayModify) {
    bits.push('An approved Campus Master Plan may modify these standards (UDO Sec. 4.6.2)')
  }
  for (const alt of limits.alternatives ?? []) {
    const h = [alt.heightFt != null ? `${alt.heightFt} ft` : null, alt.stories != null ? `${alt.stories} stories` : null]
      .filter(Boolean)
      .join(' / ')
    bits.push(`${alt.label} option: ${h} (${alt.source})`)
  }
  if (parts.conditional) {
    const c = zoneCase != null && String(zoneCase).trim() ? ` (case ${String(zoneCase).trim()})` : ''
    bits.push(
      `Conditional-use district${c}: recorded zoning conditions apply and may limit height, units or use BELOW the base district. The figures shown are the base district's, not this site's.`,
    )
  }
  return bits.length > 0 ? bits.join(' · ') : null
}

export async function getRaleighParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
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
      'PIN_NUM',
      'SITE_ADDRESS',
      'Shape_Area',
      'DEED_ACRES',
      'OWNER',
      'TOTAL_VALUE_ASSD',
      'BLDG_VAL',
      'LAND_CLASS_DECODE',
      'YEAR_BUILT',
      'HEATEDAREA',
      'TOTUNITS',
      'TOTSTRUCTS',
      'PLANNING_JURISDICTION',
    ], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired(
      'zoning',
      (t) => fetchParcelSnap(ZONING, lat, lng, [
      'ZONING',
      'ZONE_TYPE',
      'ZONE_TYPE_DECODE',
      'HEIGHT',
      'FRONTAGE_DECODE',
      'CONDITIONAL',
      'COND_LINK',
      'ZONE_CASE',
    ], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    Promise.allSettled([
      fetchCityLimits(RALEIGH_GATE, lat, lng),
      fetchFeatures(OVERLAY_HISTORIC_GENERAL, lat, lng, OVERLAY_FIELDS),
      fetchFeatures(OVERLAY_HISTORIC_STREETSIDE, lat, lng, OVERLAY_FIELDS),
      fetchFeatures(OVERLAY_NCOD, lat, lng, OVERLAY_FIELDS),
      fetchFeatures(OVERLAY_TOD, lat, lng, OVERLAY_FIELDS),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    ]),
  ])
  const [gateR, hodGR, hodSR, ncodR, todR, floodR] = optional

  // Runs BEFORE the parcel is read and BEFORE the state split below.
  const outside = outsideCity('raleigh', gateR, t0)
  if (outside) return outside

  // THE STATE SPLIT. A service that did not answer is an error and the only legal
  // handling is to refuse. A service that ANSWERED and found nothing is a
  // different fact and survives past this line, where it becomes the `Unknown`
  // the no-coverage copy is written for.
  if (!parcelR.ok || !zoningR.ok) {
    return upstreamUnavailable('raleigh', 'Raleigh', [parcelR, zoningR], t0)
  }

  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['PIN_NUM', 'SITE_ADDRESS', 'Shape_Area', 'TOTAL_VALUE_ASSD'], 'raleigh')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED.
  const zoning = firstAttrs(zoningR.value)
  warnIfMissing(zoning, ['ZONING', 'HEIGHT'], 'raleigh')
  const hodG = hodGR.status === 'fulfilled' ? firstAttrs(hodGR.value) : null
  const hodS = hodSR.status === 'fulfilled' ? firstAttrs(hodSR.value) : null
  const ncod = ncodR.status === 'fulfilled' ? firstAttrs(ncodR.value) : null
  const tod = todR.status === 'fulfilled' ? firstAttrs(todR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  const code = zoning?.ZONING ? String(zoning.ZONING).trim() : null
  const limits = resolveRaleigh(code)

  // ── Cross-check the code against the live layer (CLAUDE.md rule 9) ────────
  // The UDO's height designation and the layer's HEIGHT field are two
  // independent statements of the same fact, so they can disagree — and a
  // disagreement means the vocabulary has moved under us (a new designation, a
  // re-published layer) rather than that one of them is "close enough". We keep
  // the CODE's figure, because that is the instrument that binds, and log the
  // divergence so it is visible instead of silently averaged away.
  const liveStories = Number(zoning?.HEIGHT)
  if (Number.isFinite(liveStories) && liveStories > 0 && limits.stories != null && liveStories !== limits.stories) {
    console.log({
      event: 'zoning_height_mismatch',
      city: 'raleigh',
      code,
      liveStories,
      codeStories: limits.stories,
    })
  }

  // ── Lot area ─────────────────────────────────────────────────────────────
  // Shape_Area is the polygon area in EPSG:2264 US survey feet — i.e. already
  // square feet (measured; see the header). DEED_ACRES is the 2-dp fallback.
  const shapeArea = Number(parcel.Shape_Area)
  const deedAcres = Number(parcel.DEED_ACRES)
  const lotSqFt =
    Number.isFinite(shapeArea) && shapeArea > 0
      ? Math.round(shapeArea)
      : Number.isFinite(deedAcres) && deedAcres > 0
        ? Math.round(deedAcres * SQ_FT_PER_ACRE)
        : null

  // ── Overlays ─────────────────────────────────────────────────────────────
  // Only the two genuinely historic layers may populate `historicDistrict`.
  // NCOD (neighborhood conservation) and TOD (transit) are real overlays with
  // real consequences, but calling either "historic" would be false, and
  // downstream code treats historicDistrict as a preservation-review trigger.
  const historicDistrict = describeOverlay(hodG) ?? describeOverlay(hodS)
  // Subdistrict prefers the most development-consequential overlay present.
  const subdistrict = historicDistrict ?? describeOverlay(ncod) ?? describeOverlay(tod)

  // ── Existing structure ───────────────────────────────────────────────────
  // OWNER is read ONLY to derive a government-owned boolean; the name is
  // discarded here and never stored or returned.
  const ownerPublic = isGovernmentOwner(parcel.OWNER != null ? String(parcel.OWNER) : null)
  const landUse = parcel.LAND_CLASS_DECODE != null ? String(parcel.LAND_CLASS_DECODE).trim() : ''
  const yearBuilt = posInt(parcel.YEAR_BUILT)
  const existingBase = {
    landUse: landUse || null,
    yearBuilt: yearBuilt != null && yearBuilt > 1000 ? yearBuilt : null,
    // Wake County publishes HEATED area, which excludes unheated garages,
    // porches and unfinished basements — so it UNDERSTATES gross floor area.
    // It is the only building-size figure the assessor carries. Descriptive
    // only; nothing in the envelope or cost math reads it.
    buildingAreaSqFt: posInt(parcel.HEATEDAREA),
    units: posInt(parcel.TOTUNITS),
    numBuildings: posInt(parcel.TOTSTRUCTS),
    // BLDG_VAL is the building (improvement) value alone — LAND_VAL is the
    // other half — so it is labelled and must never be presented as a total.
    assessedValue: posInt(parcel.BLDG_VAL),
    assessedValueBasis: 'improvement (building) value only — Wake County',
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
    ...cityLimitsSource('raleigh'),
    historic: OVERLAY_HISTORIC_GENERAL,
    flood: ENDPOINTS.flood,
  }
  // Link the signed ordinance on a conditional-use parcel so the recorded
  // conditions are one click away rather than an abstract warning. Do not
  // attempt to parse it.
  const condLink = zoning?.COND_LINK != null ? String(zoning.COND_LINK).trim() : ''
  if (condLink) sources.zoningConditions = condLink

  const info: ParcelInfo = {
    ...recordAddress(parcel.SITE_ADDRESS),
    parcelId: String(parcel.PIN_NUM ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: code ?? 'Unknown',
      subdistrict,
      article: buildArticle(code, zoning?.ZONE_TYPE_DECODE, zoning?.FRONTAGE_DECODE, zoning?.ZONE_CASE),
      // Feet where the UDO prints feet, null where it does not. Never derived
      // from the story count — see the zoning module's FACT 2.
      maxHeightFt: limits.heightFt,
      // The UDO contains no floor-area-ratio instrument at all (FACT 1).
      maxFAR: null,
      allowedUses: usesForZone(code),
      // The KNOWN absence, kept distinct from an unresolved lookup: an
      // unrecognised code leaves this off entirely, so a gap can never render
      // as "FAR does not bind here" — and can never fall back to an assumed
      // FAR of 1.0 either.
      ...(limits.farUnconstrained ? { farUnconstrained: true } : {}),
      // Stories stay stories (CLAUDE.md rule 12). Raleigh states the mixed-use
      // limit in stories, and for -7 and above stories are the ONLY figure the
      // code gives, so this is what binds those districts.
      ...(limits.stories != null ? { maxStories: limits.stories } : {}),
    },
    lot: { sizeSqFt: lotSqFt, lotType: null },
    overlays: {
      historicDistrict,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      // `historicDistrict` is fed by BOTH historic overlay layers (-HOD-G and
      // -HOD-S), so a null is an answer only when both answered — either one
      // failing while the field is empty is a gap (CLAUDE.md rule 13). See
      // `lib/unresolvedOverlays.ts`.
      ...unresolvedOverlays({
        historic: historicDistrict == null && (readFailed(hodGR) || readFailed(hodSR)),
        flood: readFailed(floodR),
      }),
    },
    existing,
    // North Carolina requires counties to appraise real property at fair market
    // value (Wake County, 17 Mar 2025: "The state of North Carolina requires
    // counties to update property values to fair market value at least once
    // every eight years"), so unlike a fractional-assessment state this figure
    // is a market-basis number.
    //
    // ⚠️ It is FROZEN, not stale-in-a-known-direction. Wake's most recent
    // revaluation took effect January 1, 2024 and the next takes effect
    // January 1, 2027 (the Board of Commissioners shortened the cycle on
    // 17 Mar 2025). Between those dates the assessment does not move with the
    // market at all. This deliberately does NOT tell a reader which way to
    // correct: no measurement of Raleigh's market since Jan 2024 has been made
    // here, and a disclaimer naming the wrong direction is worse than none
    // (CLAUDE.md rule 7).
    assessedValue: posInt(parcel.TOTAL_VALUE_ASSD),
    sources,
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'raleigh', durationMs: Date.now() - t0, parcelId: info.parcelId })
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
export const PARCEL_SOURCE = { layer: PARCELS, idField: 'PIN_NUM' } as const
