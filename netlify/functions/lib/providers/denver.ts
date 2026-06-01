// Denver provider — City & County of Denver Zoning service (parcels at /0,
// zoning at /1) + Open Data historic landmark districts. Verified live
// 2026-06-01. All accept inSR=4326 point queries.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, firstAttrs, type ParcelResult } from '../arcgis'

const PARCELS = 'https://denvergov.org/maps/data/Zoning/MapServer/0'
const ZONING = 'https://denvergov.org/maps/data/Zoning/MapServer/1'
const HISTORIC =
  'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_HIST_LANDMARKDISTRICT_A/FeatureServer/68'

// Denver max height (ft). The form-based code's trailing NUMBER is max stories
// (e.g. "-3", "-5"); the live HEIGHT_STORIES field carries it directly. Letter
// suffixes (SU/TU single & two-unit) are 2.5 stories / 30 ft. Denver assumes
// ~12 ft/story. maxFAR is null (form-based code, no FAR). Source: Denver Zoning
// Code Art. 3/4/5 building-form height tables.
const DENVER_FT_PER_STORY = 12
function denverMaxHeightFt(zone: string | null, heightStories: unknown): number | null {
  const stories = Number(heightStories)
  if (Number.isFinite(stories) && stories > 0) return Math.round(stories * DENVER_FT_PER_STORY)
  if (!zone) return null
  const z = zone.toUpperCase().trim()
  // Trailing numeric token = stories (e.g. G-MU-3, C-MX-5, U-RH-2.5).
  const m = z.match(/-(\d+(?:\.\d+)?)$/)
  if (m) {
    const n = Number(m[1])
    if (n >= 1 && n <= 60) return Math.round(n * DENVER_FT_PER_STORY)
  }
  // Single/two-unit (letter suffix) districts cap at ~2.5 stories / 30 ft.
  if (/-(SU|TU)-/.test(z) || /-RH-/.test(z)) return 30
  return null
}

// Denver code (ZONE_DISTRICT, e.g. "U-SU-A", "G-MU-3", "C-MX-5", "D-C") →
// use vocabulary. The middle token carries the use family: SU/TU/RH/MU/RX...
function usesForZone(code: string | null): string[] | null {
  if (!code) return null
  const z = code.trim().toUpperCase()
  if (z.includes('-MX') || z.includes('-MS') || z.includes('-CC') || z.includes('-RX') || z.startsWith('D-'))
    return ['commercial', 'mixed', 'residential']
  if (z.includes('-MU')) return ['mixed', 'residential', 'commercial']
  if (z.includes('-SU') || z.includes('-TU') || z.includes('-RH') || z.includes('-MH') || z.includes('-RO'))
    return ['residential']
  if (z.startsWith('I-') || z.includes('-IMX') || z.includes('-IA') || z.includes('-IB')) return ['commercial', 'institutional']
  if (z.startsWith('OS') || z.startsWith('CMP')) return ['institutional']
  return null
}

export async function getDenverParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const [parcelR, zoningR, histR, floodR] = await Promise.allSettled([
    fetchFeatures(PARCELS, lat, lng, ['SITUS_ADDRESS_LINE1', 'LAND_AREA', 'SCHEDNUM']),
    fetchFeatures(ZONING, lat, lng, ['ZONE_DISTRICT', 'ZONE_DESCRIPTION', 'OVERLAY_DISTRICT', 'HEIGHT_STORIES']),
    fetchFeatures(HISTORIC, lat, lng, ['DIST_NAME']),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'denver', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const parcel = firstAttrs(parcelR.value)
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  const address = parcel.SITUS_ADDRESS_LINE1 ? String(parcel.SITUS_ADDRESS_LINE1).replace(/\s+/g, ' ').trim() : 'Selected location'
  const land = Number(parcel.LAND_AREA)
  const code = zoning?.ZONE_DISTRICT ? String(zoning.ZONE_DISTRICT) : null
  const maxHeightFt = denverMaxHeightFt(code, zoning?.HEIGHT_STORIES)

  const info: ParcelInfo = {
    address: address || 'Selected location',
    parcelId: String(parcel.SCHEDNUM ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: code ?? 'Unknown',
      subdistrict: zoning?.OVERLAY_DISTRICT ? String(zoning.OVERLAY_DISTRICT) : null,
      article: zoning?.ZONE_DESCRIPTION ? String(zoning.ZONE_DESCRIPTION) : null,
      maxHeightFt,
      maxFAR: null,
      allowedUses: usesForZone(code),
    },
    lot: {
      sizeSqFt: Number.isFinite(land) && land > 0 ? Math.round(land) : null,
      lotType: null,
    },
    overlays: {
      historicDistrict: hist?.DIST_NAME ? String(hist.DIST_NAME) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
    },
    sources: { parcels: PARCELS, zoning: ZONING, historic: HISTORIC, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'denver', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
