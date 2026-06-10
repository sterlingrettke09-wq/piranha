// Seattle provider — Seattle GeoData zoning + King County parcel boundaries
// (ADDRESS + SQFTLOT fields). Verified 2026-05-29.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'

const ORG = 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services'
const ZONING = `${ORG}/Current_Land_Use_Zoning_Detail_2/FeatureServer/0`
const PARCELS = `${ORG}/Parcel_Boundary/FeatureServer/0`
// All zoning overlays; we keep only TYPE=HISTORIC (e.g. Pioneer Square, Pike Place).
const HISTORIC = `${ORG}/Zoning_Overlays-Historic-Special_Review_Districts/FeatureServer/23`
// MHA fee area (Low / Medium / High / Downtown-SLU) — drives the affordable-housing
// payment rate, so we surface it for a parcel-aware fee note.
const MHA = `${ORG}/MHA_Fee_Areas_1/FeatureServer/0`

function seattleHistoricName(features: Array<{ attributes: Record<string, unknown> }> | undefined): string | null {
  const f = features?.find((x) => String(x.attributes.TYPE ?? '').toUpperCase() === 'HISTORIC')
  if (!f) return null
  const name = String(f.attributes.DESCRIPTION ?? '').trim()
  return name || null
}

const DOWNTOWN = ['DOC', 'DMC', 'DRC', 'DMR', 'DH', 'PMM', 'IDM', 'IDR', 'PSM']
const INDUSTRIAL = ['IB', 'IG', 'IC']

// Seattle zoning code prefix → use vocabulary.
// Seattle encodes the height limit (feet) right in the zone code: NC1-55 → 55,
// DRC 85-170 → 170 (max), SM-U 95-320 → 320, DMC 340/290-440 → 440. Take the
// largest plausible height number in the string as the max. Lowrise/Midrise/
// Highrise tiers without a number get the SMC base-height by tier.
function seattleMaxHeightFt(zone: string | null): number | null {
  if (!zone) return null
  const z = zone.toUpperCase()
  // Industrial "U/##" (e.g. IG1 U/85) means height is UNLIMITED for industrial
  // uses; the number only caps non-industrial. Don't report the number as the
  // max — return null (no by-right cap) rather than a wrongly-low height.
  if (/\bU\s*\//.test(z)) return null
  const nums = (z.match(/\d{2,3}/g) ?? []).map(Number).filter((n) => n >= 25 && n <= 1000)
  if (nums.length) return Math.max(...nums)
  if (/\bLR1\b/.test(z)) return 30
  if (/\bLR2\b/.test(z)) return 40
  if (/\bLR3\b/.test(z)) return 50
  if (/\bMR\b/.test(z)) return 85
  if (/\bHR\b/.test(z)) return 240
  return null
}

function usesForZone(zone: string | null): string[] | null {
  if (!zone) return null
  const z = zone.trim().toUpperCase()
  if (DOWNTOWN.some((p) => z.startsWith(p))) return ['commercial', 'mixed', 'residential', 'institutional']
  if (z.startsWith('SM') || z.startsWith('NC')) return ['commercial', 'mixed', 'residential']
  if (z.startsWith('C1') || z.startsWith('C2') || z.startsWith('C ')) return ['commercial', 'mixed', 'residential']
  if (z.startsWith('MIO')) return ['institutional']
  if (INDUSTRIAL.some((p) => z.startsWith(p))) return ['commercial', 'institutional']
  if (z.startsWith('SF') || z.startsWith('RSL') || z.startsWith('LR') || z.startsWith('MR') || z.startsWith('HR'))
    return ['residential']
  return null
}

export async function getSeattleParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const [zoningR, parcelR, floodR, histR, mhaR] = await Promise.allSettled([
    fetchParcelSnap(ZONING, lat, lng, ['ZONING']),
    fetchParcelSnap(PARCELS, lat, lng, ['PIN', 'ADDRESS', 'SQFTLOT', 'PRES_USE_DESC']),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    fetchFeatures(HISTORIC, lat, lng, ['OVERLAY', 'DESCRIPTION', 'TYPE']),
    fetchFeatures(MHA, lat, lng, ['FEE_AREA']),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'seattle', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['PIN', 'SQFTLOT'], 'seattle')
  warnIfMissing(zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null, ['ZONING'], 'seattle')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // Trim FIRST, then fall back — a whitespace-only ADDRESS is truthy but renders
  // a blank headline, so guard on the trimmed value.
  const address = String(parcel.ADDRESS ?? '').replace(/\s+/g, ' ').trim() || 'Selected location'
  const sqft = Number(parcel.SQFTLOT)
  const zone = zoning?.ZONING ? String(zoning.ZONING) : null

  const info: ParcelInfo = {
    address,
    parcelId: String(parcel.PIN ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: zone ?? 'Unknown',
      subdistrict: null,
      article: null,
      maxHeightFt: seattleMaxHeightFt(zone),
      maxFAR: null,
      allowedUses: usesForZone(zone),
    },
    lot: {
      sizeSqFt: Number.isFinite(sqft) && sqft > 0 ? sqft : null,
      lotType: null,
    },
    overlays: {
      historicDistrict: histR.status === 'fulfilled' ? seattleHistoricName(histR.value.features) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      feeArea: mhaR.status === 'fulfilled' ? (firstAttrs(mhaR.value)?.FEE_AREA ? String(firstAttrs(mhaR.value)!.FEE_AREA).trim() : undefined) : undefined,
    },
    existing: {
      landUse: parcel.PRES_USE_DESC ? String(parcel.PRES_USE_DESC).trim() : null,
    },
    sources: { zoning: ZONING, parcels: PARCELS, flood: ENDPOINTS.flood, historic: HISTORIC },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'seattle', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
