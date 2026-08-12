// Atlanta provider — City of Atlanta ArcGIS (gis.atlantaga.gov/dpcd) + FEMA NFHL.
//
// Verified live 2026-08-08. Every endpoint below was point-queried at real
// Atlanta addresses before this file was written, and the load-bearing results
// were re-probed three times in isolation (CLAUDE.md rule 10) and came back
// identical on every pass — parcel id, SHAPE.AREA to 12 significant figures, and
// zoning district, at three points spanning Old Fourth Ward, Virginia-Highland
// and Kirkwood. All layers accept inSR=4326 point queries.
//
// Modelled on philadelphia.ts for the lot-area treatment and on raleigh.ts for
// the article/qualification handling. Atlanta is SIMPLER than Philadelphia in
// one respect and harder in two:
//
//   1. NO SECOND-HOP JOIN. Philadelphia has to join OPA on `pin` because its
//      parcel geometry layer carries no attributes. Atlanta's TaxParcel layer
//      carries address, owner, land class, unit count AND the Fulton County
//      appraisal in one row, so both required fetches are point queries.
//
//   2. THE LOT AREA IS AN ATTRIBUTE, AND IT IS ALREADY SQUARE FEET — measured,
//      not inferred from the field name (which is the Miami `FLR` trap). The
//      layer's native spatial reference is wkid 6447 (NAD83(2011) / Georgia West,
//      US survey feet; the service reports it as 103028/latestWkid 6447), and
//      requesting geometry with outSR=6447 and shoelacing the returned rings
//      reproduces `SHAPE.AREA` exactly on 4 of 4 sampled parcels spanning three
//      orders of magnitude:
//
//          675 Ponce De Leon Ave NE   561,670.27 shoelace  vs  561,670.265245609
//          1019 Virginia Ave NE         3,418.14           vs    3,418.13965123133
//          152 Howard Street NE        12,534.44           vs   12,534.437546033101
//          680 Lee St SW              568,858.27           vs  568,858.2655191061
//
//      ratio 1.000000 on all four. `SHAPE.AREA` is also invariant to the query's
//      outSR (checked at 4326 / 3857 / 6447 — same value), so it is a stored
//      geodatabase area in the native SR and not a reprojected one. Nothing is
//      converted here, so no conversion can drift.
//
//   3. THE ZONING LAYER PUBLISHES A `HEIGHT` FIELD AND IT IS A DECOY. Measured:
//      `where=HEIGHT>0` returns 0 of 2,979 polygons, and BASEELEV is likewise 0
//      everywhere. Neither is read. Every height in the output comes from the
//      curated Part 16 table in ../zoning/atlanta.ts.
//
//   4. ASSESSED VALUE IS ABSENT FOR THE ENTIRE DEKALB SIDE OF THE CITY, and that
//      is a clean geographic hole rather than sparsity — see the note at the
//      `assessedValue` site below. It must render as "not published here", never
//      as zero and never as a citywide caveat.
//
// Jurisdiction note, and it is the OPPOSITE of Raleigh's: here the ZONING layer
// is the city's own (2,979 polygons, 95,538 acres) and the PARCEL layer is
// likewise city-scoped — 171,077 of its 171,156 rows carry SITECITY='ATLANTA'.
// The two cover the same ground. A point outside both simply returns no parcel.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { atlantaSmallLotFar, parseAtlantaZone, resolveAtlanta, usesForZone } from '../zoning/atlanta'
import { recordAddress } from '../address'

// "Tax Parcels 2025" — Fulton and DeKalb county parcels as republished by the
// City of Atlanta Department of City Planning.
const PARCELS = 'https://gis.atlantaga.gov/dpcd/rest/services/AdministrativeArea/TaxParcel/MapServer/0'
const LANDUSE_BASE = 'https://gis.atlantaga.gov/dpcd/rest/services/LandUsePlanning/LandUsePlanning/MapServer'
// Layer ids read from the service's own layer index 2026-08-08, not guessed
// (CLAUDE.md rule 8): 0 Zoning District · 1 Zoning Overlay · 2 Inclusionary
// Zoning · 4 BeltLine TCU Corridor · 5 Building Moratorium · 6 Historic District.
const ZONING = `${LANDUSE_BASE}/0`
const OVERLAY = `${LANDUSE_BASE}/1`
const HISTORIC = `${LANDUSE_BASE}/6`

// The field name really does contain a dot. It is the geodatabase's qualified
// SHAPE.AREA column, and ArcGIS returns it under that exact key.
const SHAPE_AREA = 'SHAPE.AREA'

const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/** The layer pads empty strings with a single space rather than nulling them
 *  (BUILDING, UNIT, SPI, SUBAREA and TSA all arrive as `" "`), and SITEADDRESS
 *  carries trailing runs of spaces on the DeKalb rows ("152 HOWARD STREET NE    ").
 *  Collapse and trim, and treat whitespace-only as absent. */
const clean = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).replace(/\s+/g, ' ').trim()
  return s === '' ? null : s
}

/** Trim ONLY — never collapse internal whitespace. Fulton's parcel numbers use
 *  internal double spaces as part of the identifier ("14 0107  LL0020",
 *  "14 0128  LL0264"), and `clean()`'s whitespace collapse would silently mint
 *  an id that matches nothing upstream. The two functions look
 *  interchangeable and are not: one is for display text, one is for a key. */
const cleanId = (v: unknown): string | null => {
  if (v == null) return null
  const s = String(v).replace(/^\s+|\s+$/g, '')
  return s === '' ? null : s
}

/**
 * Build the `article` label: the district's name from the chapter heading, plus
 * every qualification without which the published figures would read as an
 * unconditional by-right ceiling.
 *
 * These are NOT decoration, and three of them exist because `ParcelInfo` has no
 * structured field for them (this task may not widen the shared type):
 *
 *   · "The code imposes no maximum height here" is an ANSWER (zoning/atlanta.ts
 *     FACT 3) and there is no `heightUnconstrained` flag to carry it. Without
 *     this sentence, `maxHeightFt: null` renders as "no district height limit is
 *     available in public data" — the tool disclaiming knowledge it demonstrably
 *     has, which is exactly the failure Raleigh's DX-7 hit.
 *   · A height stated as distance tiers (FACT 4) is neither an answer nor an
 *     absence, and the tiers themselves are the honest output.
 *   · A "-C" conditional suffix sits on 960 of 2,979 mapped polygons and 8.5% of
 *     city acreage. §16-02.003(2) puts the conditions in a council ordinance
 *     held by the Clerk of Council, which is in no dataset — so the base figure
 *     is a ceiling the site may not actually have, and saying so is the only
 *     honest render available.
 *   · FAR denominators differ limb by limb (FACT 2) and the engine multiplies
 *     one lot area by whichever ratio it picks, so which denominator the code
 *     names has to be stated where the reader sees the number.
 */
function buildArticle(code: string | null, lotSqFt: number | null): string | null {
  const parts = parseAtlantaZone(code)
  const limits = resolveAtlanta(code)
  const bits: string[] = []

  if (limits.name) bits.push(limits.name)

  if (limits.heightUnconstrained) {
    bits.push(
      `The zoning code imposes NO maximum building height in this district — that is what the code says, not a gap in our data (${limits.heightSource}). Height near a boundary with a protected residential district is still limited by that district's transitional height plane.`,
    )
  }
  if (limits.heightTiers) {
    const tiers = limits.heightTiers.map((t) => `${t.heightFt} ft ${t.label}`).join('; ')
    bits.push(
      `Maximum height here is stated as tiers keyed to distance from the nearest protected residential district (${tiers}; ${limits.heightSource}). Resolving which tier applies needs a distance measurement this tool has not made, so no single height is published.`,
    )
  }
  if (limits.planGoverned) {
    bits.push(
      'Planned Development district: the intensity (a Table I sector) and the height come from the council ordinance that approved the plan, not from a district table, and that ordinance is not published as data. The figures shown are therefore incomplete, not absent.',
    )
  }

  // The lot-size-conditional branch, when this parcel's own area triggers it.
  // Without this sentence the published ratio (0.5018 on a 7,473 sq ft R-4A lot)
  // looks like a district figure that has been silently rounded, when it is
  // actually the code's "lesser of" arithmetic on THIS lot.
  const small = atlantaSmallLotFar(limits.smallLot, lotSqFt)
  if (small && limits.smallLot) {
    bits.push(
      `This lot is under the district minimum of ${limits.smallLot.minLotSqFt.toLocaleString('en-US')} sq ft, so the code caps floor area at the LESSER of ${limits.smallLot.maxFloorAreaSqFt.toLocaleString('en-US')} sq ft or FAR ${limits.smallLot.far} (${limits.smallLot.source}). On this lot that works out to an effective FAR of ${small.far.toFixed(3)} — the district's headline ratio is not what binds here.`,
    )
  }

  // Denominators, in the code's own words. Only stated for the limbs that exist,
  // and collapsed when the chapter itself states one ratio for everything.
  const nonres = limits.farNonresidential
  const resid = limits.farResidential
  const comb = limits.farCombined
  const oneRatio =
    nonres != null && resid != null && comb != null && nonres.far === resid.far && nonres.far === comb.far
  if (!small && oneRatio) {
    bits.push(
      `The code states one floor-area ratio for all uses here: ${nonres.far} × ${nonres.basis} lot area (${nonres.source}).`,
    )
  } else if (!small) {
    const denom: string[] = []
    if (nonres) denom.push(`nonresidential ${nonres.far} × ${nonres.basis} lot area`)
    if (resid) denom.push(`residential ${resid.far} × ${resid.basis} lot area`)
    if (comb && comb.far !== resid?.far) denom.push(`combined ${comb.far} × ${comb.basis} lot area`)
    if (denom.length > 0) {
      bits.push(
        `Floor-area ratios are stated per use and are alternatives, not a range: ${denom.join('; ')}. "Gross" lot area is defined at §16-28.010(1) as the lot plus up to 50 ft of adjoining street and open space, so it is larger than the parcel measured here; a gross-denominated ratio applied to this parcel understates what the code allows.`,
      )
    }
  }

  for (const alt of limits.farAlternatives ?? []) {
    bits.push(`${alt.label} option: FAR ${alt.far} × ${alt.basis} lot area (${alt.source})`)
  }

  if (parts.conditional) {
    bits.push(
      'Conditional zoning ("-C"): §16-02.003(2) puts site-specific conditions in a council ordinance obtainable from the Clerk of Council. Those conditions can limit height, density or use BELOW the base district and are published in no dataset. The figures shown are the base district\'s, not this site\'s.',
    )
  }

  if (limits.source) bits.push(`Source: City of Atlanta Code of Ordinances, Part 16 — ${limits.source}`)

  return bits.length > 0 ? bits.join(' · ') : null
}

export async function getAtlantaParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
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
      SHAPE_AREA,
      'OWNERNME1',
      'CLASSDSCRP',
      'LIVUNITS',
      'TOT_APPR',
      'LANDAPPR',
      'TAXYEAR',
      'NEIGHBORHOOD',
      'NPU',
    ], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired(
      'zoning',
      (t) =>
        fetchParcelSnap(
          ZONING,
          lat,
          lng,
          ['ZONECLASS', 'ZONINGCODE', 'ZONEDESC', 'SPI', 'SUBAREA', 'STATUS'],
          false,
          undefined,
          30,
          t,
        ),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    Promise.allSettled([
      fetchFeatures(OVERLAY, lat, lng, ['ZONECLASS', 'LABEL']),
      fetchFeatures(HISTORIC, lat, lng, ['DIST_1', 'DIST_2']),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    ]),
  ])
  const [overlayR, histR, floodR] = optional

  // THE STATE SPLIT. A service that did not answer is an error and the only legal
  // handling is to refuse. A service that ANSWERED and found nothing is a
  // different fact and survives past this line, where it becomes the `Unknown`
  // the no-coverage copy is written for.
  if (!parcelR.ok || !zoningR.ok) {
    return upstreamUnavailable('atlanta', 'Atlanta', [parcelR, zoningR], t0)
  }

  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['PARCELID', 'SITEADDRESS', SHAPE_AREA, 'TOT_APPR'], 'atlanta')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED.
  const zoning = firstAttrs(zoningR.value)
  warnIfMissing(zoning, ['ZONECLASS'], 'atlanta')
  const overlay = overlayR.status === 'fulfilled' ? firstAttrs(overlayR.value) : null
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // ── Zoning ───────────────────────────────────────────────────────────────
  // ZONECLASS is the district code; the layer also carries a `ZONING` duplicate
  // of it and a plain-English `ZONINGCODE` family label ("Special Public
  // Interest", "Single Family Residential"). Only ZONECLASS is read as the code.
  //
  // STATUS is 'Current' on all 2,979 polygons (measured with returnDistinctValues
  // 2026-08-08 — it is the only value the field takes), so it is fetched as a
  // drift canary rather than used as a filter.
  //
  // ⚠️ SUNSET is deliberately NOT filtered on, and that is a decision rather than
  // an oversight: 38 of the 2,979 polygons (1,721 acres) carry a SUNSET
  // timestamp already in the past while STATUS reads 'Current', and one of them
  // is the 700-acre R-4A polygon covering Kirkwood — a district Kirkwood
  // manifestly still has. Treating SUNSET as a validity flag would delete real
  // zoning from real neighbourhoods. It is noise in this dataset.
  const code = clean(zoning?.ZONECLASS)
  const limits = resolveAtlanta(code)

  // ── Lot area ─────────────────────────────────────────────────────────────
  // SHAPE.AREA is the polygon area in EPSG:6447 US survey feet — i.e. already
  // square feet (measured against the geometry; see the header). There is no
  // fallback, because there is no second area column on this layer: the DeKalb
  // rows carry no acreage field either. A missing SHAPE.AREA is a null lot, not
  // an estimated one.
  const shapeArea = Number(parcel[SHAPE_AREA])
  const lotSqFt = Number.isFinite(shapeArea) && shapeArea > 0 ? Math.round(shapeArea) : null

  // ── FAR ──────────────────────────────────────────────────────────────────
  // Per-use, never collapsed (CLAUDE.md rule 6 / zoning FACT 1). `maxFAR` is set
  // ONLY where the chapter states one ratio for all uses — the R districts,
  // I-1, I-2 and I-MIX, where the three limbs are the same number by
  // construction. Everywhere else the limbs differ and the district has no
  // single "the FAR", so `maxFAR` stays null and `farByUse` carries the answer.
  const nonres = limits.farNonresidential?.far ?? null
  const resid = limits.farResidential?.far ?? null
  const combined = limits.farCombined?.far ?? null
  const singleRatio = nonres != null && nonres === resid && nonres === combined

  // The lot-size-conditional branch R-4A / R-4B / R-5 carry. This is resolved
  // from the parcel's OWN measured area — the code's condition is "a lot which
  // does not meet the minimum lot area requirement" — and it is a "lesser of a
  // fixed square footage or a higher ratio" cap, so the higher ratio in it does
  // NOT mean more floor area. Publishing R-4A as 0.65 would overstate every
  // substandard lot above 5,769 sq ft.
  const smallLot = atlantaSmallLotFar(limits.smallLot, lotSqFt)

  const farByUse: NonNullable<ParcelInfo['zoning']['farByUse']> = {}
  if (smallLot) {
    // The branch replaces the district ratio for every use, because the
    // districts that have it are single-family/two-family districts whose FAR is
    // one number for all uses to begin with.
    farByUse.residential = smallLot.far
    farByUse.commercial = smallLot.far
    farByUse.mixed = smallLot.far
  } else {
    if (resid != null) farByUse.residential = resid
    if (nonres != null) farByUse.commercial = nonres
    if (combined != null) farByUse.mixed = combined
  }
  const hasFarByUse = Object.keys(farByUse).length > 0

  const maxFAR = smallLot ? smallLot.far : singleRatio ? nonres : null

  // ── Overlays ─────────────────────────────────────────────────────────────
  // The Historic District layer is the only one allowed to populate
  // `historicDistrict`, because downstream code treats that field as a
  // preservation-review trigger. The Zoning Overlay layer returns BeltLine and
  // the HC-20x overlay footprints at the same points and CAN return several
  // features for one click (measured: a point in Inman Park returns both
  // "Beltline" and "HC20LSA1 - Inman Park SA 1"), so it feeds `subdistrict`
  // only, and only when no historic district is present.
  const historicDistrict = hist
    ? [clean(hist.DIST_1), clean(hist.DIST_2)].filter(Boolean).join(' — ') || null
    : null
  const overlayLabel = overlay ? (clean(overlay.LABEL) ?? clean(overlay.ZONECLASS)) : null
  const subdistrict = historicDistrict ?? overlayLabel ?? clean(zoning?.ZONINGCODE)

  // ── Existing structure ───────────────────────────────────────────────────
  // OWNERNME1 is read ONLY to derive a government-owned boolean; the name is
  // discarded here and never stored or returned.
  const ownerPublic = isGovernmentOwner(clean(parcel.OWNERNME1))
  // ⚠️ The DeKalb-side hole again: LIVUNITS is an integer on the Fulton rows and
  // arrives NULL on the DeKalb rows, so a null unit count here means "the county
  // does not publish it", not "vacant". posInt() maps both null and 0 to null,
  // which is the conservative reading — a 0 would flow into the no-net-loss
  // check as "nothing to lose".
  const existingBase = {
    landUse: clean(parcel.CLASSDSCRP),
    units: posInt(parcel.LIVUNITS),
    // The county's APPRAISED market value, land + improvements. Labelled
    // because Georgia's *assessed* value is 40% of this and the two are both on
    // the row — presenting the wrong one would understate by 2.5x.
    assessedValue: posInt(parcel.TOT_APPR),
    assessedValueBasis:
      'Fulton County appraised market value (land + improvements), tax year 2025 — NOT the Georgia 40% assessed value',
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
    zoning: ZONING,
    overlays: OVERLAY,
    historic: HISTORIC,
    flood: ENDPOINTS.flood,
  }
  // The layer hands out a per-district deep link into the published code. Link
  // it so the citation in `article` is one click from the text it cites.
  const zoneDesc = clean(zoning?.ZONEDESC)
  if (zoneDesc && /^https?:\/\//i.test(zoneDesc)) sources.zoningCode = zoneDesc

  const info: ParcelInfo = {
    ...recordAddress(clean(parcel.SITEADDRESS)),
    parcelId: cleanId(parcel.PARCELID) ?? '',
    coordinates: [lng, lat],
    zoning: {
      districtCode: code ?? 'Unknown',
      subdistrict,
      article: buildArticle(code, lotSqFt),
      // Feet where Part 16 prints feet, null where it does not. NEVER derived
      // from a story count — this provider has no story input and the zoning
      // module has no story field (zoning/atlanta.ts FACT 5).
      maxHeightFt: limits.heightFt,
      maxFAR,
      allowedUses: usesForZone(code),
      ...(hasFarByUse ? { farByUse } : {}),
      // R-5's "if the floor area ratio does not allow at least 1,800 square
      // feet, a dwelling … of such size may be built" — a greater-of floor under
      // the cap, which is exactly what farFloorSqFt means.
      ...(smallLot?.floorSqFt != null ? { farFloorSqFt: smallLot.floorSqFt } : {}),
      // The KNOWN absence, kept distinct from an unresolved lookup: only FCR-3
      // (no FAR item anywhere in ch. 6C) and MR-MU (the FAR slot is filled with
      // a 12-units-per-building cap) set this. An unrecognised code leaves it
      // off entirely, so a gap can never render as "FAR does not bind here" and
      // can never fall back to an assumed FAR of 1.0.
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
    // ⚠️ NULL FOR EVERY DEKALB-SIDE PARCEL, and that is a stated gap rather than
    // sparsity. Measured 2026-08-08 against the live layer: of 171,077 rows with
    // SITECITY='ATLANTA', 14,170 have TOT_APPR null (and the identical 14,170
    // have LANDAPPR null); 13,092 of those carry the DeKalb land-lot prefix
    // '15 ', and that is 13,092 of 13,092 — i.e. 100% of the city's DeKalb side
    // (Kirkwood, East Atlanta, Edgewood, East Lake), confirmed at two live
    // points. Only 1,078 nulls (0.6%) are on the Fulton side.
    //
    // TOT_APPR is the county's APPRAISED market value, so it is a market-basis
    // figure rather than a fractional assessment — verified arithmetically
    // rather than from memory of Georgia law: over 500 sampled rows,
    // LANDASSESS / LANDAPPR has a median of exactly 0.400 and is 0.400 on 498 of
    // them, so the appraisal is the 100% figure and CNTASSDVAL is the 40% one.
    // TAXYEAR reads 2025 on every row sampled.
    //
    // No claim is made here about which way this lags the market. None has been
    // measured, and a disclaimer naming the wrong direction is worse than none
    // (CLAUDE.md rule 7).
    assessedValue: posInt(parcel.TOT_APPR),
    sources,
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'atlanta', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
