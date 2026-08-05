// Washington, DC provider — DCGIS parcels (Owner/Common Ownership polygons) +
// DC Office of Zoning "Specific Zone" + Historic District. Verified live
// 2026-06-01. All three layers accept inSR=4326 point queries.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'
import { isGovernmentOwner } from '../../../../src/lib/developability'

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
export function dcLimits(code: string | null): { h: number | null; f: number | null } {
  if (!code) return { h: null, f: null }
  const base = code.toUpperCase().trim().split('/')[0].trim()
  // Georgetown overlay caps at 35 ft.
  if (/\/GT|GEORGETOWN/i.test(code)) return { h: 35, f: null }
  if (DC_LIMITS[base]) return DC_LIMITS[base]
  // Lettered sub-zones (MU-7A, MU-7B, RA-4A…) share their numbered parent's
  // limits closely enough; fall back to the parent rather than returning null.
  const parent = base.replace(/([0-9])[A-Z]+$/, '$1')
  if (parent !== base && DC_LIMITS[parent]) return DC_LIMITS[parent]
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
    fetchParcelSnap(PARCELS, lat, lng, ['PREMISEADD', 'SSL', 'LANDAREA', 'USECODE', 'SALETYPE', 'CLASSTYPE', 'OWNERNAME']),
    fetchParcelSnap(ZONING, lat, lng, ['ZONING', 'ZR16', 'Zone_District']),
    fetchFeatures(HISTORIC, lat, lng, ['HistDistrict_NAME']),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'dc', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['SSL', 'LANDAREA'], 'dc')
  warnIfMissing(zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null, [['Zoning', 'ZONING', 'ZR16']], 'dc')
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

  // Existing structure: SALETYPE "Improved" means a building stands here (vs
  // vacant land). CLASSTYPE's leading digit gives a coarse use (1 residential,
  // 2 commercial, 5 institutional/exempt). No floor area or year in this layer.
  //
  // USECODE is more specific and is the key signal for landmark/special sites:
  // 082=hospital, 083=university, 087/089=stadium/arena/exhibition. These large
  // tax-exempt parcels usually have a null SALETYPE, so we surface their use from
  // USECODE directly (which the "special site" flag then picks up).
  const useCode = parcel.USECODE != null ? String(parcel.USECODE).trim() : ''
  const ssl = parcel.SSL != null ? String(parcel.SSL).trim() : ''
  // Federal / public land that zoning often bleeds ordinary R/C codes over:
  // an SSL beginning "RES" is a federal Reservation (the Mall, traffic circles
  // like Logan Circle, monument grounds); USECODE 086 = federal building (e.g.
  // the Library of Congress), 191 = public reservation. Label these so the
  // developability gate ("federal"/"public land") hard-blocks them.
  const isFederalLand = /^RES\b/i.test(ssl) || useCode === '086' || useCode === '191'
  const USECODE_LANDUSE: Record<string, string> = {
    '082': 'Hospital',
    '083': 'University / college',
    '087': 'Stadium / arena',
    '089': 'Arena / exhibition hall',
  }
  const useCodeLabel = USECODE_LANDUSE[useCode] ?? null
  const saleType = parcel.SALETYPE ? String(parcel.SALETYPE) : ''
  const classDigit = parcel.CLASSTYPE ? String(parcel.CLASSTYPE).trim().charAt(0) : ''
  const dcUse = isFederalLand
    ? 'Federal or other public land'
    : useCodeLabel ?? (({ '1': 'Residential', '2': 'Commercial', '5': 'Institutional' } as Record<string, string>)[classDigit] ?? null)
  // OWNERNAME used only to derive a government-owned boolean (no name stored).
  const ownerPublic = isGovernmentOwner(parcel.OWNERNAME != null ? String(parcel.OWNERNAME) : null)
  const existingBase =
    isFederalLand || /improv/i.test(saleType) || useCodeLabel ? { landUse: dcUse, numBuildings: 1 } : undefined
  const existing = ownerPublic ? { ...(existingBase ?? {}), ownerPublic: true } : existingBase

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
    existing,
    sources: { parcels: PARCELS, zoning: ZONING, historic: HISTORIC, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'dc', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
