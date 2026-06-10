// Minneapolis provider — Hennepin County parcels (LAND_PROPERTY) + City of
// Minneapolis Primary Zoning + HPC historic districts. Verified live
// 2026-06-01.
//
// GOTCHA: the Hennepin County server does NOT reproject inSR=4326 — it silently
// returns no features for a WGS84 point. We must hand it geometry already in
// UTM zone 15N (EPSG:26915). Zoning + historic are ArcGIS Online layers and
// reproject 4326 normally.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchFeaturesXYSnap, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'
import { lngLatToUtm15 } from '../geo'
import { isGovernmentOwner } from '../../../../src/lib/developability'

const PARCELS = 'https://gis.hennepin.us/arcgis/rest/services/HennepinData/LAND_PROPERTY/MapServer/1'
const ZONING =
  'https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/Planning_Primary_Zoning/FeatureServer/0'
const BUILT_FORM =
  'https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/Planning_Zoning_Built_Form/FeatureServer/0'
const HISTORIC =
  'https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/HPC_Districts/FeatureServer/0'
// City of Minneapolis park boundaries (MPRB). The 2040 zoning blankets parks in
// adjacent residential codes (UN1, etc.), so a park reads as a buildable lot
// unless we check this polygon layer explicitly.
const PARKS = 'https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/Parks/FeatureServer/0'

// Minneapolis separates USE (primary zoning) from FORM. Max height comes from
// the built-form district (Abbrv), per the City's Built Form Districts Handbook
// (Title 20, Tables 540-7 / 540-9). Base (by-right) heights in feet. Core 50 is
// the downtown CBD with no max-feet cap → null.
const MPLS_BUILT_FORM_FT: Record<string, number | null> = {
  BFI1: 28, BFI2: 28, BFI3: 42, BFC3: 42, BFC4: 56, BFC6: 84,
  BFT10: 140, BFT15: 210, BFT20: 280, BFT30A: 420, BFT30B: 420,
  BFPR: 140, BFPA: 35, BFC50: null,
}

// Minneapolis 2024 zoning code (Land_Use_Code) → use vocabulary.
function usesForZone(code: string | null): string[] | null {
  if (!code) return null
  const z = code.trim().toUpperCase()
  if (z.startsWith('UN')) return ['residential']
  if (z.startsWith('RM')) return ['residential', 'mixed', 'institutional']
  if (z.startsWith('CM') || z.startsWith('DT')) return ['commercial', 'mixed', 'residential']
  if (z.startsWith('PR')) return ['commercial', 'institutional']
  // TR = Transportation district (transit / right-of-way), NOT a standard
  // building site — leave uses underivable rather than mislabel it institutional.
  return null
}

export async function getMinneapolisParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const { x, y } = lngLatToUtm15(lng, lat)
  const [parcelR, zoningR, formR, histR, floodR, parkR] = await Promise.allSettled([
    fetchFeaturesXYSnap(PARCELS, x, y, 26915, ['HOUSE_NO', 'STREET_NM', 'MUNIC_NM', 'ZIP_CD', 'PARCEL_AREA', 'PID', 'BUILD_YR', 'BLDG_MV1', 'OWNER_NM']),
    fetchParcelSnap(ZONING, lat, lng, ['Land_Use_Code', 'Land_Use']),
    fetchFeatures(BUILT_FORM, lat, lng, ['Abbrv', 'Built_Form']),
    fetchFeatures(HISTORIC, lat, lng, ['DISTRICT']),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    fetchFeatures(PARKS, lat, lng, ['PARK_NAME1']),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'minneapolis', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['PID', 'PARCEL_AREA'], 'minneapolis')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
  const form = formR.status === 'fulfilled' ? firstAttrs(formR.value) : null
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  const formAbbrv = form?.Abbrv ? String(form.Abbrv).trim().toUpperCase() : null
  const maxHeightFt = formAbbrv && formAbbrv in MPLS_BUILT_FORM_FT ? MPLS_BUILT_FORM_FT[formAbbrv] : null

  const houseNo = parcel.HOUSE_NO != null ? String(parcel.HOUSE_NO).trim() : ''
  const streetNm = parcel.STREET_NM != null ? String(parcel.STREET_NM).replace(/\s+/g, ' ').trim() : ''
  const rawAddress = [houseNo, streetNm].filter(Boolean).join(' ')
  // Hennepin uses placeholder strings (e.g. "ADDRESS PENDING") on some civic /
  // unaddressed parcels — don't surface those as a real address.
  const address = !rawAddress || /pending|unknown|^0\b/i.test(rawAddress) ? 'Selected location' : rawAddress
  const area = Number(parcel.PARCEL_AREA)
  const code = zoning?.Land_Use_Code ? String(zoning.Land_Use_Code) : null

  // Park boundary → mark as public open space so the developability gate blocks
  // it (the zoning layer reports a normal residential code over parkland).
  const park = parkR.status === 'fulfilled' ? firstAttrs(parkR.value) : null
  const parkName = park?.PARK_NAME1 ? String(park.PARK_NAME1).replace(/\s+/g, ' ').trim() : null

  // Existing structure: a building market value (BLDG_MV1 > 0) or a build year
  // means a building stands here. No use label or floor area in this layer.
  const bldgVal = Number(parcel.BLDG_MV1)
  const buildYr = Number(parcel.BUILD_YR)
  // OWNER_NM used only to derive a government-owned boolean (no name stored).
  const ownerPublic = isGovernmentOwner(parcel.OWNER_NM != null ? String(parcel.OWNER_NM) : null)
  const existingBase = parkName
    ? { landUse: `${parkName} (park)` } // "...park" → caught by the public-land gate
    : (Number.isFinite(bldgVal) && bldgVal > 0) || (Number.isFinite(buildYr) && buildYr > 1000)
      ? { yearBuilt: Number.isFinite(buildYr) && buildYr > 1000 ? buildYr : null, numBuildings: 1 }
      : undefined
  const existing = ownerPublic ? { ...(existingBase ?? {}), ownerPublic: true } : existingBase

  const info: ParcelInfo = {
    address,
    parcelId: String(parcel.PID ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: code ?? 'Unknown',
      subdistrict: null,
      article: zoning?.Land_Use ? String(zoning.Land_Use) : null,
      maxHeightFt,
      maxFAR: null,
      allowedUses: usesForZone(code),
    },
    lot: {
      sizeSqFt: Number.isFinite(area) && area > 0 ? Math.round(area) : null,
      lotType: null,
    },
    overlays: {
      historicDistrict: hist?.DISTRICT ? String(hist.DISTRICT) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
    },
    existing,
    sources: { parcels: PARCELS, zoning: ZONING, builtForm: BUILT_FORM, historic: HISTORIC, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'minneapolis', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
