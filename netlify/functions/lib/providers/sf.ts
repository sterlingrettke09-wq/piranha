// San Francisco provider — SF Planning zoning + parcels (address fields +
// geometry for lot area). Verified 2026-05-29.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, firstAttrs, firstFeature, type ParcelResult } from '../arcgis'
import { polygonAreaSqFt, reverseGeocode } from '../geo'

const BASE = 'https://sfplanninggis.org/arcgiswa/rest/services/PlanningData/MapServer'
const ZONING = `${BASE}/3`
const PARCELS = `${BASE}/23`
const HISTORIC = `${BASE}/17` // Article 10 Historic Districts (name_1).
const LANDUSE = `${BASE}/35` // Land use (landuse_landuse + landuse_resunits).
const HEIGHT = `${BASE}/5` // Height districts (gen_hght = max height ft).
const CA_ZONE3_FT = 2227 // EPSG:2227 NAD83 California zone 3 (US ft) — for lot area.

// SF land-use code → plain-English existing use.
const SF_LANDUSE: Record<string, string> = {
  RESIDENT: 'Residential building',
  MIXRES: 'Mixed-use building (residential)',
  MIXED: 'Mixed-use building',
  'RETAIL/ENT': 'Retail / commercial building',
  CIE: 'Institutional building',
  MED: 'Medical building',
  MIPS: 'Office building',
  PDR: 'Industrial building (PDR)',
  VISITOR: 'Hotel / visitor building',
  VACANT: 'Vacant land',
  OPENSPACE: 'Open space',
}

// SF zoning "gen" (general use category) → use vocabulary.
function usesForGen(gen: string | null): string[] | null {
  if (!gen) return null
  const g = gen.toLowerCase()
  if (g.includes('mixed')) return ['mixed', 'residential', 'commercial']
  if (g.includes('residential') || g.includes('house')) return ['residential', 'institutional']
  if (g.includes('commercial') || g.includes('downtown') || g.includes('neighborhood'))
    return ['commercial', 'mixed', 'residential']
  if (g.includes('production') || g.includes('industrial') || g.includes('pdr'))
    return ['commercial', 'institutional']
  if (g.includes('public')) return ['institutional']
  return null
}

export async function getSfParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const [zoningR, parcelR, floodR, histR, landR, heightR] = await Promise.allSettled([
    fetchFeatures(ZONING, lat, lng, ['zoning', 'gen', 'districtname']),
    fetchFeatures(PARCELS, lat, lng, ['blklot', 'from_st', 'street', 'st_type'], true, CA_ZONE3_FT),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    fetchFeatures(HISTORIC, lat, lng, ['name_1']),
    fetchFeatures(LANDUSE, lat, lng, ['landuse_landuse', 'landuse_resunits']),
    fetchFeatures(HEIGHT, lat, lng, ['gen_hght']),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'sf', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const pf = firstFeature(parcelR.value)
  if (!pf) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const land = landR.status === 'fulfilled' ? firstAttrs(landR.value) : null
  const height = heightR.status === 'fulfilled' ? firstAttrs(heightR.value) : null
  const maxHeightFt = height?.gen_hght != null && Number(height.gen_hght) > 0 ? Number(height.gen_hght) : null

  const luCode = land?.landuse_landuse ? String(land.landuse_landuse).trim().toUpperCase() : ''
  const luUnits = land?.landuse_resunits != null ? Number(land.landuse_resunits) : 0
  const existingUse = luCode ? (SF_LANDUSE[luCode] ?? null) : null

  const a = pf.attributes
  const stNum = a.from_st != null ? String(a.from_st).trim() : ''
  const street = a.street != null ? String(a.street).trim() : ''
  const stType = a.st_type != null ? String(a.st_type).trim() : ''
  let address = [stNum, street, stType].filter(Boolean).join(' ')
  if (!street) address = (await reverseGeocode(lat, lng)) ?? 'Selected location'

  const zone = zoning?.zoning ? String(zoning.zoning) : null

  const info: ParcelInfo = {
    address,
    parcelId: String(a.blklot ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: zone ?? 'Unknown',
      subdistrict: zoning?.districtname ? String(zoning.districtname) : null,
      article: null,
      maxHeightFt, // from the Height Districts layer (gen_hght)
      maxFAR: null, // SF residential is largely form-based (height/bulk), not FAR
      allowedUses: usesForGen(zoning?.gen != null ? String(zoning.gen) : null),
    },
    lot: {
      sizeSqFt: polygonAreaSqFt(pf.geometry?.rings, 1), // outSR=2227 → US feet.
      lotType: null,
    },
    overlays: {
      historicDistrict: hist?.name_1 ? String(hist.name_1) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
    },
    existing: {
      landUse: existingUse,
      ...(Number.isFinite(luUnits) && luUnits > 0 ? { units: luUnits } : {}),
    },
    sources: { zoning: ZONING, parcels: PARCELS, flood: ENDPOINTS.flood, historic: HISTORIC },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'sf', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
