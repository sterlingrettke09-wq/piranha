// Seattle provider — Seattle GeoData zoning + King County parcel boundaries
// (ADDRESS + SQFTLOT fields). Verified 2026-05-29.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, firstAttrs, type ParcelResult } from '../arcgis'

const ORG = 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services'
const ZONING = `${ORG}/Current_Land_Use_Zoning_Detail_2/FeatureServer/0`
const PARCELS = `${ORG}/Parcel_Boundary/FeatureServer/0`
// All zoning overlays; we keep only TYPE=HISTORIC (e.g. Pioneer Square, Pike Place).
const HISTORIC = `${ORG}/Zoning_Overlays-Historic-Special_Review_Districts/FeatureServer/23`

function seattleHistoricName(features: Array<{ attributes: Record<string, unknown> }> | undefined): string | null {
  const f = features?.find((x) => String(x.attributes.TYPE ?? '').toUpperCase() === 'HISTORIC')
  if (!f) return null
  const name = String(f.attributes.DESCRIPTION ?? '').trim()
  return name || null
}

const DOWNTOWN = ['DOC', 'DMC', 'DRC', 'DMR', 'DH', 'PMM', 'IDM', 'IDR', 'PSM']
const INDUSTRIAL = ['IB', 'IG', 'IC']

// Seattle zoning code prefix → use vocabulary.
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
  const [zoningR, parcelR, floodR, histR] = await Promise.allSettled([
    fetchFeatures(ZONING, lat, lng, ['ZONING']),
    fetchFeatures(PARCELS, lat, lng, ['PIN', 'ADDRESS', 'SQFTLOT']),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    fetchFeatures(HISTORIC, lat, lng, ['OVERLAY', 'DESCRIPTION', 'TYPE']),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'seattle', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const parcel = firstAttrs(parcelR.value)
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  const address = parcel.ADDRESS ? String(parcel.ADDRESS).replace(/\s+/g, ' ').trim() : 'Selected location'
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
      maxHeightFt: null,
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
    },
    sources: { zoning: ZONING, parcels: PARCELS, flood: ENDPOINTS.flood, historic: HISTORIC },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'seattle', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
