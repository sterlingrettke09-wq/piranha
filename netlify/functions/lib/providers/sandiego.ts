// San Diego provider — SANDAG regional parcels + City of San Diego DSD zoning,
// historic resources, coastal overlays, and city-owned real property. Verified
// live 2026-08-03; all layers accept inSR=4326 point queries.
//
// ⚠️ NO OWNER NAME. Unlike every other city, San Diego publishes no owner field:
// the SANDAG parcel layer carries only an `ownerocc` occupancy FLAG, and the
// county's own parcel service requires a token. The government-owner gate
// therefore cannot work here. Instead we query the City Owned Real Property
// layer, which catches CITY land (parks, yards, civic buildings) — but NOT
// county, state, federal, port, or school-district land, so the curated civic
// hard-block list in src/lib/siteFlags.ts carries more weight in San Diego.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, firstFeature, type ParcelResult } from '../arcgis'
import { polygonAreaSqFt } from '../geo'

const PARCELS = 'https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0'
// California State Plane Zone 6 (EPSG:2230), US survey feet — the parcel layer's
// native SR, so geometry comes back already in feet for the area calculation.
const CA_ZONE6_FT = 2230
const DSD = 'https://webmaps.sandiego.gov/arcgis/rest/services/DSD'
const ZONING = `${DSD}/Zoning_Base/MapServer/0`
const HISTORIC = 'https://webmaps.sandiego.gov/arcgis/rest/services/Planning/Historic_Preservation_Resources/MapServer/2'
// Proposition D coastal height limit overlay (CHLOZ) — a real 30 ft cap.
const COASTAL_HEIGHT = `${DSD}/Zoning_Overlay/MapServer/1`
// City-owned real property — the only public ownership signal available.
const CITY_LAND = `${DSD}/Regulatory/MapServer/3`
// Statewide CA Coastal Zone (shared with the LA provider); confirmed to cover
// San Diego — a Coastal Development Permit is a real added approval.
const COASTAL_ZONE =
  'https://services9.arcgis.com/wwVnNW92ZHUIr0V0/arcgis/rest/services/Coastal_Zone_Polygon/FeatureServer/0'

/** SDMC §132.0505(a) (Chapter 13, 7-2024 printing): "Notwithstanding any section
 *  to the contrary, no building or addition to a building shall be constructed
 *  with a height in excess of thirty feet within the Coastal Zone of the City of
 *  San Diego." Codification of Proposition D (effective 12-7-1972); amended by
 *  Prop L (1988), Prop D (1998), Prop C (2000), Measure E (2020), O-21508 (2022)
 *  and O-21811 (eff. 7-11-2024) — every amendment carved out a geographic
 *  EXCEPTION area, none moved the thirty-foot figure.
 *
 *  Verified 2026-08-05 against docs.sandiego.gov/municode/municodechapter13/
 *  ch13art02division05.pdf. The figure is carried in FEET, as the code states it.
 *
 *  Which parcels are inside the overlay is NOT re-derived here: §132.0502(a)
 *  delegates the boundary to "Map No. C-380, filed in the office of the City
 *  Clerk", and the CHLOZ layer queried below is the City's own mapping of it.
 *  The §132.0505(b)(1)-(b)(4) exception areas are therefore honoured only to the
 *  extent that layer honours them — spot-probed 2026-08-05: downtown south of
 *  Laurel St (b)(1) and San Ysidro (b)(3) correctly return NO feature. */
export const COASTAL_HEIGHT_LIMIT_FT = 30

const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

// San Diego zone names (Land Development Code): RS/RM/RX residential,
// CC/CN/CV/CO/CR commercial, IL/IH/IP/IS industrial, OC/OP/OF open space,
// AG agricultural, plus planned districts (CCPD-*, GQPD-*, and other *PD-*).
export function usesForZone(zone: string | null): string[] | null {
  if (!zone) return null
  const z = zone.trim().toUpperCase()
  if (/^R[SMX]-/.test(z)) return ['residential']
  if (/^RT-/.test(z)) return ['residential']
  if (/^C[CNVOR]-/.test(z)) return ['commercial', 'mixed', 'residential']
  if (/^I[LHPS]-/.test(z)) return ['commercial', 'institutional']
  if (/^O[CPF]-/.test(z) || z.startsWith('OP-')) return ['institutional']
  if (/^AG-/.test(z) || z.startsWith('AR-')) return ['institutional']
  // Planned districts (downtown CCPD, Gaslamp GQPD, etc.) mix uses; their limits
  // come from a community plan rather than the base code.
  if (/PD-/.test(z)) return ['commercial', 'mixed', 'residential']
  return null
}

export async function getSanDiegoParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  // webmaps.sandiego.gov is a single-IP self-hosted ArcGIS Server that
  // intermittently aborts (verified 2026-08-03: ~1 in 3 calls timed out, both
  // serially and under load). Two mitigations, and they pull against each other:
  //   • Reliability: every webmaps layer uses the RETRYING snap fetcher, so a
  //     single abort doesn't blank the field.
  //   • Latency: they all run in ONE parallel batch. An earlier two-batch version
  //     was reliable but ran 10-12s end-to-end, over Netlify's 10s function kill —
  //     parallel keeps the total at the slowest single chain (~8s budget) instead
  //     of the sum.
  const [parcelR, zoningR, histR, chlozR, cityLandR, coastalR, floodR] = await Promise.allSettled([
    fetchParcelSnap(
      PARCELS,
      lat,
      lng,
      ['apn', 'situs_address', 'situs_street', 'situs_suffix', 'situs_zip', 'usable_sq_feet', 'asr_landuse', 'unitqty', 'total_lvg_area', 'asr_total'],
      true,
      CA_ZONE6_FT,
    ),
    fetchParcelSnap(ZONING, lat, lng, ['ZONE_NAME']),
    fetchFeatures(HISTORIC, lat, lng, ['NAME', 'TYPE']),
    fetchParcelSnap(COASTAL_HEIGHT, lat, lng, ['ZONENAME']),
    fetchParcelSnap(CITY_LAND, lat, lng, ['COM_NAME', 'DES_USE', 'MG_DEPT']),
    fetchFeatures(COASTAL_ZONE, lat, lng, ['FID']),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'sandiego', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }
  const parcelFeat = firstFeature(parcelR.value)
  const parcel = parcelFeat?.attributes ?? null
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const chloz = chlozR.status === 'fulfilled' ? firstAttrs(chlozR.value) : null
  const cityLand = cityLandR.status === 'fulfilled' ? firstAttrs(cityLandR.value) : null
  const inCoastal = coastalR.status === 'fulfilled' ? (coastalR.value.features?.length ?? 0) > 0 : false
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // `usable_sq_feet` is a zero-padded STRING and is sometimes all blanks;
  // `acreage` is null on most urban parcels. Geometry (already in CA Zone 6
  // feet) is the reliable lot size, with the recorded value preferred when real.
  const recorded = posInt(String(parcel.usable_sq_feet ?? '').trim())
  const lotSqFt = recorded ?? polygonAreaSqFt(parcelFeat?.geometry?.rings)

  const num = parcel.situs_address != null ? Number(parcel.situs_address) : 0
  const street = [parcel.situs_street, parcel.situs_suffix]
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter(Boolean)
    .join(' ')
  // situs_address is 0 when the street number is missing.
  const address = [num > 0 ? String(num) : '', street].filter(Boolean).join(' ').trim()

  const zone = zoning?.ZONE_NAME ? String(zoning.ZONE_NAME).trim() : null
  // The §132.0505 30 ft coastal cap is the one numeric height San Diego
  // publishes spatially. Base-zone heights/FARs live in Land Development Code
  // tables keyed on the zone-name suffix and are NOT in the GIS, so they stay
  // null ("not in public data") rather than being guessed. That null is a GAP
  // (missing lookup), not an answer — with one documented exception below.
  //
  // Two things checked 2026-08-05 against Chapter 13 Article 1 (3-2026 printing):
  //
  //  1. The 30 ft cap never OVERSTATES a base zone, because no Chapter 13 base
  //     zone caps structure height below 30 ft. Lowest figure in each division:
  //     Div 3 open space 30 ft; Div 4 residential 30 ft (RS-1-1…1-7 "24/30" is
  //     24 ft at the setback rising to 30 ft overall per §131.0444(c) and
  //     Diagram 131-04L — 30 is the ceiling, not the pair's larger alternative);
  //     Div 5 commercial 30 ft. So min(base, coastal) is 30 wherever CHLOZ hits.
  //
  //  2. INDUSTRIAL IS A KNOWN ABSENCE, NOT A GAP, and we currently render it as
  //     a gap. §131.0644 "Maximum Structure Height in Industrial Zones": "There
  //     are no height limits for structures in the industrial zones except as
  //     limited by the regulations in Chapter 13, Article 2 (Overlay Zones)."
  //     The section EXISTS and affirmatively states no limit, which is the
  //     rule-5 test for an absence. Reporting it as such needs a height analogue
  //     of `zoning.farUnconstrained` in src/types/parcel.ts, so it is recorded
  //     here rather than fixed — do not let this comment read as if it shipped.
  const inCoastalHeight = chloz?.ZONENAME != null && /chloz/i.test(String(chloz.ZONENAME))

  // City-owned land is the only ownership signal available here.
  const ownerPublic = cityLand?.COM_NAME != null || cityLand?.DES_USE != null
  const cityLandName = cityLand?.COM_NAME ? String(cityLand.COM_NAME).trim() : null

  const existingBase = {
    landUse: cityLandName ? `${cityLandName} (city-owned)` : parcel.asr_landuse != null ? `Assessor use code ${parcel.asr_landuse}` : null,
    buildingAreaSqFt: posInt(parcel.total_lvg_area),
    units: posInt(parcel.unitqty),
  }
  const hasExisting = Object.values(existingBase).some((v) => v != null)
  const existing = ownerPublic
    ? { ...existingBase, ownerPublic: true }
    : hasExisting
      ? existingBase
      : undefined

  const info: ParcelInfo = {
    address: address || 'Selected location',
    parcelId: String(parcel.apn ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: zone ?? 'Unknown',
      subdistrict: null,
      article: null,
      maxHeightFt: inCoastalHeight ? COASTAL_HEIGHT_LIMIT_FT : null,
      maxFAR: null,
      allowedUses: usesForZone(zone),
    },
    lot: { sizeSqFt: lotSqFt, lotType: null },
    overlays: {
      historicDistrict: hist?.NAME ? String(hist.NAME).trim() : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      coastalZone: inCoastal || undefined,
    },
    existing,
    // California assesses at Prop-13 acquisition value, which drifts far from
    // market — deliberately omitted rather than shown as a land-cost proxy.
    sources: { parcels: PARCELS, zoning: ZONING, historic: HISTORIC, coastalHeight: COASTAL_HEIGHT, cityLand: CITY_LAND, coastalZone: COASTAL_ZONE, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'sandiego', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
