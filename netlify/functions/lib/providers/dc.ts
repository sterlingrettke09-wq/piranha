// Washington, DC provider — DCGIS parcels (Owner/Common Ownership polygons) +
// DC Office of Zoning "Specific Zone" + Historic District. Verified live
// 2026-06-01. All three layers accept inSR=4326 point queries.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, firstAttrs, type ParcelResult } from '../arcgis'

const BASE = 'https://maps2.dcgis.dc.gov/dcgis/rest/services'
const PARCELS = `${BASE}/DCGIS_DATA/Property_and_Land/MapServer/40`
const ZONING = `${BASE}/DCOZ/Zone_Mapservice/MapServer/24`
const HISTORIC = `${BASE}/DCOZ/Zone_Mapservice/MapServer/6`

// Max height (ft) + FAR by zone, from the 2016 Zoning Regulations (Title 11
// DCMR): Subtitle D (R), E (RF), F (RA), G (MU). High-confidence families only;
// Downtown (D) and Neighborhood (NC) zones vary by sub-area/street and are left
// null (honest — no by-right envelope shown). Heights exclude penthouse.
const DC_LIMITS: Record<string, { h: number | null; f: number | null }> = {
  'RF-1': { h: 35, f: null }, 'RF-2': { h: 35, f: null }, 'RF-3': { h: 35, f: null },
  'RF-4': { h: 40, f: 1.8 }, 'RF-5': { h: 50, f: 1.8 },
  'RA-1': { h: 40, f: 0.9 }, 'RA-2': { h: 50, f: 1.8 }, 'RA-3': { h: 60, f: 3.0 },
  'RA-4': { h: 90, f: 3.5 }, 'RA-5': { h: 90, f: 5.0 },
  'MU-1': { h: 65, f: 4.0 }, 'MU-2': { h: 90, f: 6.0 }, 'MU-3': { h: 40, f: 1.0 },
  'MU-4': { h: 50, f: 2.5 }, 'MU-5': { h: 70, f: 3.5 }, 'MU-6': { h: 90, f: 4.0 },
  'MU-7': { h: 65, f: 5.0 }, 'MU-8': { h: 70, f: 6.5 }, 'MU-9': { h: 90, f: 6.0 }, 'MU-10': { h: 90, f: 6.0 },
}
function dcLimits(code: string | null): { h: number | null; f: number | null } {
  if (!code) return { h: null, f: null }
  const base = code.toUpperCase().trim().split('/')[0].trim()
  // Georgetown overlay caps at 35 ft.
  if (/\/GT|GEORGETOWN/i.test(code)) return { h: 35, f: null }
  if (DC_LIMITS[base]) return DC_LIMITS[base]
  // Residential House (R) zones: 40 ft, no FAR (Subtitle D § 303.1).
  if (base.startsWith('R-') || /^R\d/.test(base)) return { h: 40, f: null }
  return { h: null, f: null }
}

// DC zoning code prefix → use vocabulary. Codes follow the 2016 Zoning
// Regulations (e.g. R-, RF-, RA-, MU-, NC-, PDR-, D-, US-, StE-).
function usesForZone(code: string | null): string[] | null {
  if (!code) return null
  const z = code.trim().toUpperCase()
  if (z.startsWith('MU') || z.startsWith('NC') || z.startsWith('D-') || z.startsWith('GA') || z.startsWith('CG'))
    return ['commercial', 'mixed', 'residential']
  if (z.startsWith('PDR')) return ['commercial', 'institutional']
  if (z.startsWith('US') || z.startsWith('STE') || z.startsWith('UNT')) return ['institutional']
  if (z.startsWith('R-') || z.startsWith('RF') || z.startsWith('RA') || z.startsWith('RC'))
    return ['residential']
  return null
}

export async function getDcParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const [parcelR, zoningR, histR, floodR] = await Promise.allSettled([
    fetchFeatures(PARCELS, lat, lng, ['PREMISEADD', 'SSL', 'LANDAREA', 'USECODE']),
    fetchFeatures(ZONING, lat, lng, ['ZONING', 'ZR16', 'Zone_District']),
    fetchFeatures(HISTORIC, lat, lng, ['HistDistrict_NAME']),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'dc', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const parcel = firstAttrs(parcelR.value)
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // PREMISEADD includes city/state/zip; keep just the street portion.
  const rawAddr = parcel.PREMISEADD ? String(parcel.PREMISEADD).trim() : ''
  const address = rawAddr ? rawAddr.split(/\s+WASHINGTON\s+DC/i)[0].trim() : 'Selected location'
  const land = Number(parcel.LANDAREA)
  // The live service returns the field as `Zoning` (not `ZONING`); fall back
  // across casings and to the 2016-code field ZR16.
  const zCode = zoning?.Zoning ?? zoning?.ZONING ?? zoning?.ZR16
  const code = zCode != null && String(zCode).trim() ? String(zCode).trim() : null
  const lim = dcLimits(code)

  const info: ParcelInfo = {
    address: address || 'Selected location',
    parcelId: String(parcel.SSL ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: code ?? 'Unknown',
      subdistrict: null,
      article: zoning?.Zone_District ? String(zoning.Zone_District) : null,
      maxHeightFt: lim.h,
      maxFAR: lim.f,
      allowedUses: usesForZone(code),
    },
    lot: {
      sizeSqFt: Number.isFinite(land) && land > 0 ? Math.round(land) : null,
      lotType: null,
    },
    overlays: {
      historicDistrict: hist?.HistDistrict_NAME ? String(hist.HistDistrict_NAME) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
    },
    sources: { parcels: PARCELS, zoning: ZONING, historic: HISTORIC, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'dc', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
