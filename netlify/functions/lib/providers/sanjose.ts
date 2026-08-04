// San Jose provider — City of San Jose Planning (PLN_Geocortex_Public_PRD).
// Verified live 2026-08-03; all layers accept inSR=4326 point queries.
//
// ⚠️ THINNEST PARCEL DATA IN THE PORTFOLIO. San Jose's parcel layer carries only
// APN / PARCELID / LOTNUM — no address, lot area, land use, year built, unit
// count, or owner. Santa Clara County's assessor data is not publicly reachable:
// webgis.sccgov.org times out, www.sccgov.org returns a Cloudflare 403, the
// county AGOL layers return zero features downtown, and the county publishes
// parcels as an ANNUAL SHAPEFILE rather than a service (all verified 2026-08-03).
//
// Consequences, and how they're handled:
//   • Address  → Mapbox reverse geocode (same fallback the Austin provider uses).
//   • Lot size → computed from parcel geometry in CA State Plane Zone 3 feet.
//   • Existing structure → genuinely unavailable; reported as absent, not zero.
//   • Owner    → unavailable, so the government-owner gate CANNOT work here. San
//     Jose leans entirely on the curated civic hard-block list in siteFlags.ts.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, firstFeature, type ParcelResult } from '../arcgis'
import { polygonAreaSqFt, reverseGeocode } from '../geo'

const PLN = 'https://geo.sanjoseca.gov/server/rest/services/PLN/PLN_Geocortex_Public_PRD/MapServer'
const PARCELS = `${PLN}/49`
const ZONING = `${PLN}/128`
// Height limits are published per-area but as FREE TEXT (e.g. "Determined by
// FAA" near the airport), so the value must be parsed, never trusted as numeric.
const HEIGHT = `${PLN}/84`
const HISTORIC = `${PLN}/34`
const GENERAL_PLAN = `${PLN}/26`
// California State Plane Zone 3 (EPSG:2227), US survey feet — the layer's native
// SR, so polygon area comes back directly in square feet.
const CA_ZONE3_FT = 2227

/**
 * San Jose publishes HEIGHTLIMIT as text. Downtown and airport-influence areas
 * carry prose ("Determined by FAA", "Defined by Airspace Req") rather than a
 * number — those must resolve to null so the tool says "not in public data"
 * instead of inventing a limit.
 */
export function parseSanJoseHeightFt(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const s = String(raw).replace(/\s+/g, ' ').trim()
  if (!s) return null
  // Any prose qualifier means the number (if present) isn't a flat limit.
  if (/determined|defined|airspace|faa|varies|see |per /i.test(s)) return null
  const m = /^(\d+(?:\.\d+)?)\s*(?:ft\.?|feet|')?$/i.exec(s)
  if (!m) return null
  const ft = Number(m[1])
  return Number.isFinite(ft) && ft > 0 && ft <= 1000 ? ft : null
}

// San Jose zoning codes (Title 20): R-1/R-2/R-M residential, CN/CP/CG/CO
// commercial, IP/LI/HI industrial, A(PD) planned development, OS open space.
export function sanJoseUsesForZone(zone: string | null | undefined): string[] | null {
  if (!zone) return null
  const z = String(zone).trim().toUpperCase()
  if (/^OS|^A-?PD.*OPEN|^PQP/.test(z)) return ['institutional']
  // Planned Development: uses are set by the approved PD permit, not the code.
  if (/\(PD\)|^A\(PD\)|^PD/.test(z)) return ['commercial', 'mixed', 'residential']
  if (/^R-?M|^R-?1|^R-?2|^R-?3|^RM/.test(z)) return ['residential']
  if (/^C[NPGO]|^CIC|^DC/.test(z)) return ['commercial', 'mixed', 'residential']
  if (/^IP|^LI|^HI|^I-/.test(z)) return ['commercial', 'institutional']
  if (/^A$|^AG/.test(z)) return ['institutional']
  return null
}

export async function getSanJoseParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  // reverseGeocode runs inside the fan-out so its latency overlaps the upstream
  // fetches rather than adding to them (same reasoning as the Austin provider).
  const [parcelR, zoningR, heightR, histR, gpR, floodR, geocodeR] = await Promise.allSettled([
    fetchParcelSnap(PARCELS, lat, lng, ['APN', 'PARCELID', 'LOTNUM'], true, CA_ZONE3_FT),
    fetchParcelSnap(ZONING, lat, lng, ['ZONING', 'ZONINGABBREV', 'PDUSE', 'PDDENSITY']),
    fetchFeatures(HEIGHT, lat, lng, ['HEIGHTLIMIT', 'DESCRIPTION']),
    fetchFeatures(HISTORIC, lat, lng, ['NAME', 'AREATYPE']),
    fetchFeatures(GENERAL_PLAN, lat, lng, ['GPDESIGNATION']),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    reverseGeocode(lat, lng),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'sanjose', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }
  const parcelFeat = firstFeature(parcelR.value)
  const parcel = parcelFeat?.attributes ?? null
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
  const height = heightR.status === 'fulfilled' ? firstAttrs(heightR.value) : null
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const gp = gpR.status === 'fulfilled' ? firstAttrs(gpR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null
  const geocoded = geocodeR.status === 'fulfilled' ? geocodeR.value : null

  const zone = zoning?.ZONING ? String(zoning.ZONING).trim() : null
  const abbrev = zoning?.ZONINGABBREV ? String(zoning.ZONINGABBREV).trim() : null

  const info: ParcelInfo = {
    // No address in the parcel layer at all — Mapbox is the only source.
    address: geocoded ?? 'Selected location',
    parcelId: String(parcel.APN ?? parcel.PARCELID ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: abbrev ?? zone ?? 'Unknown',
      subdistrict: zoning?.PDUSE ? String(zoning.PDUSE).trim() : null,
      // The General Plan designation is the closest thing to a plain-English
      // descriptor San Jose exposes for the parcel.
      article: gp?.GPDESIGNATION ? String(gp.GPDESIGNATION).trim() : zone,
      maxHeightFt: parseSanJoseHeightFt(height?.HEIGHTLIMIT as string | null | undefined),
      // No FAR anywhere in San Jose's public GIS. PDDENSITY is units/acre on
      // planned-development zones, which is a density, not a floor-area ratio.
      maxFAR: null,
      allowedUses: sanJoseUsesForZone(abbrev ?? zone),
    },
    lot: { sizeSqFt: polygonAreaSqFt(parcelFeat?.geometry?.rings), lotType: null },
    overlays: {
      historicDistrict: hist?.NAME ? String(hist.NAME).trim() : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
    },
    // Deliberately omitted: Santa Clara County's assessor attributes aren't
    // publicly reachable, so year built / units / building area / owner are
    // genuinely unknown here. Reporting nothing is correct; reporting zeros
    // would read as "vacant lot" on a developed parcel.
    existing: undefined,
    sources: { parcels: PARCELS, zoning: ZONING, height: HEIGHT, historic: HISTORIC, generalPlan: GENERAL_PLAN, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'sanjose', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
