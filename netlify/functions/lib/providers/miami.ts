// Miami provider — Miami-Dade County parcels (MD_LandInformation) + City of
// Miami "Miami 21" zoning, historic preservation, and archaeological layers.
// Verified live 2026-08-03; all layers accept inSR=4326 point queries.
//
// ⚠️ HOSTNAME: the City of Miami GIS is `gis.miami.gov`. Public documentation and
// ArcGIS Hub widely cite `gis.miamigov.com`, which resolves but whose TCP
// connections time out — using it produces a city that silently fails 100% on
// zoning and historic. Verified 2026-08-03: .gov = HTTP 200, .com = timeout.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, firstFeature, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { polygonAreaSqFt } from '../geo'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { cityLimitsGate, cityLimitsSource, fetchCityLimits, outsideCity } from '../jurisdiction'
import { resolveMiami, miamiUsesForZone } from '../zoning/miami'
import { recordAddress } from '../address'

// Countywide parcel layer (native SR 2236 — Florida East, US survey feet).
const PARCELS = 'https://gisweb.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer/26'
const FL_EAST_FT = 2236
const CITY = 'https://gis.miami.gov/gis/rest/services/Zoning'
// Miami 21 Primary Zoning — covers the CITY of Miami only (zero features in
// Miami Beach, Hialeah, etc.).
//
// ⚠️ THAT EMPTINESS IS NOT A JURISDICTION GATE, and a claim here said it was
// until 2026-08-12. An empty zoning answer renders as a GAP, and a gap still
// publishes: Coral Gables, Hialeah and West Miami addresses inside MIAMI_BBOX
// all returned ok:true with a real lot area, which is all the cost engine needs
// — $17.3M for a Coral Gables parcel. The gate is the boundary polygon below.
const ZONING = `${CITY}/ZoningMiami21/MapServer/5`
const HISTORIC = `${CITY}/HEP/MapServer/4`
// Archaeological Conservation Areas are a genuine Miami permitting trigger.
const ARCHAEOLOGICAL = `${CITY}/HEP/MapServer/3`

// ── THE JURISDICTION GATE ─────────────────────────────────────────────────
// Miami-Dade's parcel layer is county-wide and answers for every municipality in
// it. This is what refuses those points, measured at the real entry point
// 2026-08-12 — see the note on ZONING above for what used to be relied on
// instead, and what it published.
//
// The layer, the match and the refusal wording live in ../jurisdiction.ts,
// which carries one entry for every live city and records how each was
// established. It degrades OPEN on a failed fetch and reads the EXACT point,
// never a buffered snap.
const MIAMI_GATE = cityLimitsGate('miami')!


const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

export async function getMiamiParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const deadline = requestDeadline()
  // REQUIRED reads go through readRequired; OPTIONAL ones keep allSettled. See
  // the contract at the top of ../requiredUpstream.ts.
  //
  // ⚠️ A FAILED ZONING FETCH AND AN EMPTY ONE ARE DIFFERENT FACTS, and they were
  // once the same value here: a timeout published Miami Beach's answer for a
  // downtown Miami lot. The zoning read is REQUIRED for that reason alone —
  // NOT, as a claim here previously had it, because its emptiness gates the
  // city. It does not; the boundary polygon does (see MIAMI_GATE above).
  const [parcelR, zoningR, optional] = await Promise.all([
    // Geometry in Florida East feet so lot size can be derived when the assessor
    // record is a condo "REFERENCE FOLIO" placeholder (see below).
    // maxAttempts 2: fetchParcelSnap already retries its exact query internally.
    readRequired(
      'parcel',
      (t) =>
        fetchParcelSnap(
          PARCELS,
          lat,
          lng,
          [
            'FOLIO',
            'TRUE_SITE_ADDR',
            'TRUE_OWNER1',
            'LOT_SIZE',
            'YEAR_BUILT',
            'UNIT_COUNT',
            'FLOOR_COUNT',
            'BUILDING_ACTUAL_AREA',
            'DOR_DESC',
            'TOTAL_VAL_CUR',
          ],
          true,
          FL_EAST_FT,
          30,
          t,
        ),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired(
      'zoning',
      (t) =>
        fetchParcelSnap(
          ZONING,
          lat,
          lng,
          ['M21_ZONE', 'Transect', 'Transect_Desc', 'Bldg_Height', 'FLR'],
          false,
          undefined,
          30,
          t,
        ),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    Promise.allSettled([
      fetchCityLimits(MIAMI_GATE, lat, lng),
      fetchFeatures(HISTORIC, lat, lng, ['HD_NAME']),
      fetchFeatures(ARCHAEOLOGICAL, lat, lng, ['AZ_NAME']),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    ]),
  ])
  const [gateR, histR, archR, floodR] = optional

  // Runs BEFORE the parcel is read and BEFORE the state split below.
  const outside = outsideCity('miami', gateR, t0)
  if (outside) return outside

  // THE STATE SPLIT — a failed fetch refuses; an empty answer is still an answer.
  if (!parcelR.ok || !zoningR.ok) {
    return upstreamUnavailable('miami', 'Miami', [parcelR, zoningR], t0)
  }
  const parcelFeat = firstFeature(parcelR.value)
  const parcel = parcelFeat?.attributes ?? null
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED, so a null here means the
  // point is outside the City of Miami.
  const zoning = firstAttrs(zoningR.value)
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const arch = archR.status === 'fulfilled' ? firstAttrs(archR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // `historicDistrict` is fed by TWO optional layers, so a null here is only an
  // ANSWER when BOTH answered — the joint-dependency shape of CLAUDE.md rule 13.
  // Miami is the one city that reads the field NEGATIVELY (hurdles.ts publishes
  // "No tenant relocation or replacement-housing requirement" and a note stating
  // the parcel is not in a designated district), so an unmarked null there is a
  // stated ABSENCE manufactured from a timeout — measured 2026-08-12 at the
  // analyze handler, HISTORIC faulted, both rows published unchanged.
  const historicName = hist?.HD_NAME
    ? String(hist.HD_NAME).trim()
    : arch?.AZ_NAME
      ? `${String(arch.AZ_NAME).trim()} (archaeological conservation area)`
      : null
  const historicUnresolved =
    historicName == null && (histR.status !== 'fulfilled' || archR.status !== 'fulfilled')

  // ⚠️ Condo "REFERENCE FOLIO" parents: clicking a condo tower returns the land
  // record with TRUE_OWNER1 "REFERENCE ONLY", LOT_SIZE 0, YEAR_BUILT 0 and
  // UNIT_COUNT 0 — the real data lives on the per-unit folios. Without this
  // guard the tool reports a 0 sq ft lot on Miami's densest sites.
  const dorDesc = parcel.DOR_DESC != null ? String(parcel.DOR_DESC).trim() : ''
  const isReferenceFolio = /reference\s+folio/i.test(dorDesc)

  const recordedLot = posInt(parcel.LOT_SIZE)
  const lotSqFt = recordedLot ?? polygonAreaSqFt(parcelFeat?.geometry?.rings)

  const zone = zoning?.M21_ZONE ? String(zoning.M21_ZONE).trim() : null
  const limits = resolveMiami(zone, zoning?.Bldg_Height != null ? String(zoning.Bldg_Height) : null)

  // TRUE_OWNER1 is used ONLY to derive a government-owned boolean. Florida
  // publishes full individual owner names, so the name is discarded here and
  // never stored or returned.
  const ownerPublic = isReferenceFolio
    ? false
    : isGovernmentOwner(parcel.TRUE_OWNER1 != null ? String(parcel.TRUE_OWNER1) : null)

  const existingBase = isReferenceFolio
    ? { landUse: 'Condominium (per-unit records)' }
    : {
        landUse: dorDesc || null,
        yearBuilt: posInt(parcel.YEAR_BUILT),
        buildingAreaSqFt: posInt(parcel.BUILDING_ACTUAL_AREA),
        units: posInt(parcel.UNIT_COUNT),
        stories: posInt(parcel.FLOOR_COUNT),
      }
  const hasExisting = Object.values(existingBase).some((v) => v != null)
  const existing = ownerPublic
    ? { ...existingBase, ownerPublic: true }
    : hasExisting
      ? existingBase
      : undefined

  const addr = parcel.TRUE_SITE_ADDR != null ? String(parcel.TRUE_SITE_ADDR).replace(/\s+/g, ' ').trim() : ''

  const info: ParcelInfo = {
    ...recordAddress(addr),
    parcelId: String(parcel.FOLIO ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: zone ?? 'Unknown',
      subdistrict: zoning?.Transect ? String(zoning.Transect).trim() : null,
      article: zoning?.Transect_Desc ? String(zoning.Transect_Desc).trim() : null,
      maxHeightFt: limits.heightFt,
      maxFAR: limits.maxFAR,
      // Miami 21 states "d. Floor Lot Ratio (FLR) N/A" for T3/T4/T5 and D1/D2/
      // D3 (Article 5 Illustrations 5.3-5.5, 5.9-5.10). A known absence, not a
      // lookup we failed — the module carried that finding in a comment for
      // months without a way to publish it.
      ...(limits.farUnconstrained ? { farUnconstrained: true } : {}),
      // The code states stories exactly; passing it through stops the
      // envelope re-deriving a story count from feet with a different constant.
      ...(limits.stories != null ? { maxStories: limits.stories } : {}),
      allowedUses: miamiUsesForZone(zone),
    },
    lot: { sizeSqFt: lotSqFt, lotType: null },
    overlays: {
      historicDistrict: historicName,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      ...unresolvedOverlays({ historic: historicUnresolved, flood: readFailed(floodR) }),
    },
    existing,
    // Miami-Dade assesses at market value; reference folios carry no value.
    assessedValue: isReferenceFolio ? null : posInt(parcel.TOTAL_VAL_CUR),
    sources: { parcels: PARCELS, zoning: ZONING, ...cityLimitsSource('miami'), historic: HISTORIC, archaeological: ARCHAEOLOGICAL, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'miami', durationMs: Date.now() - t0, parcelId: info.parcelId })
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
export const PARCEL_SOURCE = { layer: PARCELS, idField: 'FOLIO' } as const
