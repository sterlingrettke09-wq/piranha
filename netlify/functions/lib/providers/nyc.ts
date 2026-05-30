// New York City parcel provider — backed by NYC DCP's MapPLUTO, a single
// tax-lot layer (~856k lots) carrying zoning district, per-use FAR, lot area,
// and address. Verified 2026-05-29.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, firstAttrs, type ParcelResult } from '../arcgis'

const MAPPLUTO =
  'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0'
const FIELDS = ['BBL', 'Address', 'ZoneDist1', 'ResidFAR', 'CommFAR', 'FacilFAR', 'LotArea']
// LPC-designated historic districts (locally landmarked — these trigger LPC review).
const HISTORIC =
  'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/v_GFT_Historic_Districts/FeatureServer/0'

// Pull the LPC district name from a "LP-00489-Greenwich Village Historic District" id.
function lpcDistrictName(features: Array<{ attributes: Record<string, unknown> }> | undefined): string | null {
  const f = features?.find((x) => x.attributes.variable_type === 'nyc_historic_districts')
  if (!f) return null
  const id = String(f.attributes.variable_id ?? '').trim()
  const name = id.replace(/^LP-?\d+\s*-\s*/i, '').trim()
  return name || null
}

const num = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

// NYC zoning district prefix → our use vocabulary.
function usesForDistrict(zone: string | null): string[] | null {
  if (!zone) return null
  const c = zone.trim().toUpperCase()[0]
  if (c === 'R') return ['residential', 'institutional']
  if (c === 'C') return ['commercial', 'mixed', 'residential', 'institutional']
  if (c === 'M') return ['commercial', 'institutional']
  return null
}

export async function getNycParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const [plutoR, floodR, histR] = await Promise.allSettled([
    fetchFeatures(MAPPLUTO, lat, lng, FIELDS),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    fetchFeatures(HISTORIC, lat, lng, ['variable_id', 'variable_type']),
  ])

  if (plutoR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'nyc', durationMs: Date.now() - t0 })
    return {
      ok: false,
      code: 'UPSTREAM_ERROR',
      message: 'A required upstream dataset is unavailable. Try again shortly.',
      status: 502,
    }
  }

  const lot = firstAttrs(plutoR.value)
  if (!lot) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  const resid = num(lot.ResidFAR)
  const comm = num(lot.CommFAR)
  const facil = num(lot.FacilFAR)
  const farByUse: NonNullable<ParcelInfo['zoning']['farByUse']> = {}
  if (resid != null) farByUse.residential = resid
  if (comm != null) farByUse.commercial = comm
  if (facil != null) farByUse.institutional = facil
  const mixed = Math.max(resid ?? 0, comm ?? 0)
  if (mixed > 0) farByUse.mixed = mixed
  const maxFAR = Math.max(resid ?? 0, comm ?? 0, facil ?? 0) || null

  const zone = lot.ZoneDist1 != null ? String(lot.ZoneDist1) : null

  const info: ParcelInfo = {
    address: lot.Address ? String(lot.Address) : 'Unknown address',
    parcelId: String(lot.BBL ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: zone ?? 'Unknown',
      subdistrict: null,
      article: null,
      maxHeightFt: null, // NYC encodes height via sky-exposure/height-factor, not in PLUTO.
      maxFAR,
      allowedUses: usesForDistrict(zone),
      farByUse: Object.keys(farByUse).length > 0 ? farByUse : undefined,
    },
    lot: {
      sizeSqFt: num(lot.LotArea),
      lotType: null,
    },
    overlays: {
      historicDistrict: histR.status === 'fulfilled' ? lpcDistrictName(histR.value.features) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
    },
    sources: { zoning: MAPPLUTO, parcels: MAPPLUTO, flood: ENDPOINTS.flood, historic: HISTORIC },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'nyc', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
