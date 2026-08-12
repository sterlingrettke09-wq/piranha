// San Francisco provider — SF Planning zoning + parcels (address fields +
// geometry for lot area). Verified 2026-05-29.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, firstFeature, warnIfMissing, type ParcelResult } from '../arcgis'
import { polygonAreaSqFt, reverseGeocode } from '../geo'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { resolveSfFar } from '../zoning/sf'

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
  const deadline = requestDeadline()
  // REQUIRED reads go through readRequired; OPTIONAL ones keep allSettled. See
  // the contract at the top of ../requiredUpstream.ts.
  const [parcelR, zoningR, heightR, optional] = await Promise.all([
    // maxAttempts 2, not 3: fetchParcelSnap already retries its exact query
    // internally, so three outer attempts would be up to six queries.
    readRequired(
      'parcel',
      (t) => fetchParcelSnap(PARCELS, lat, lng, ['blklot', 'from_st', 'street', 'st_type'], true, CA_ZONE3_FT, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired(
      'zoning',
      (t) => fetchParcelSnap(ZONING, lat, lng, ['zoning', 'gen', 'districtname'], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    // ⚠️ THE HEIGHT DISTRICT IS A SEPARATE MAPPED LAYER, AND IT IS REQUIRED.
    // `gen_hght` is the only source of SF's maxHeightFt; when this fetch failed
    // the field went null, which feasibility.ts renders as "No district height
    // limit is available in public data" — false about a parcel SF does map.
    // Measured by perturbation 2026-08-11: control h=65, layer-fail h=null.
    readRequired('height district', (t) => fetchParcelSnap(HEIGHT, lat, lng, ['gen_hght'], false, undefined, 30, t), {
      deadline,
      maxAttempts: 2,
      attemptCapMs: 4000,
    }),
    Promise.allSettled([
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
      fetchFeatures(HISTORIC, lat, lng, ['name_1']),
      fetchFeatures(LANDUSE, lat, lng, ['landuse_landuse', 'landuse_resunits']),
    ]),
  ])
  const [floodR, histR, landR] = optional

  // THE STATE SPLIT. A service that did not answer is an error and the only
  // legal handling is to refuse; a service that answered and found nothing is a
  // different fact and survives past this line.
  if (!parcelR.ok || !zoningR.ok || !heightR.ok) {
    return upstreamUnavailable('sf', 'San Francisco', [parcelR, zoningR, heightR], t0)
  }

  const pf = firstFeature(parcelR.value)
  warnIfMissing(pf?.attributes ?? null, ['blklot'], 'sf')
  if (!pf) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED.
  const zoning = firstAttrs(zoningR.value)
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const land = landR.status === 'fulfilled' ? firstAttrs(landR.value) : null
  const height = firstAttrs(heightR.value)
  // gen_hght encodes non-numeric height districts as repdigit sentinels, NOT as
  // a single 9999 "no limit" value. Distinct-value query against layer 5 on
  // 2026-08-05 returned exactly nine, each with a self-describing `height`
  // label: 1111 USCG/Caltrans · 2222 "None Stated" · 3333 Job Corps · 4444
  // "Special Height District" · 5555 CP · 6666 HP · 7777 HP-RA · 8888 MB-RA ·
  // 9999 OS (Open Space — an unmapped height district, not "unlimited").
  //
  // The bound is `<= 1000`, not `< 1000`: the same query showed the real height
  // ladder runs 25…1000, and gen_hght=1000 is ONE polygon whose `height` reads
  // "1000-S-2" — a genuine 1,000 ft height district (numeral prefix and numeric
  // field agree). The old `< 1000` discarded it, publishing a data GAP where the
  // map states an answer. Every sentinel is >= 1111, so nothing is admitted here.
  const ghRaw = Number(height?.gen_hght)
  const maxHeightFt = Number.isFinite(ghRaw) && ghRaw > 0 && ghRaw <= 1000 ? ghRaw : null

  const luCode = land?.landuse_landuse ? String(land.landuse_landuse).trim().toUpperCase() : ''
  const luUnits = land?.landuse_resunits != null ? Number(land.landuse_resunits) : 0
  const existingUse = luCode ? (SF_LANDUSE[luCode] ?? null) : null

  const a = pf.attributes
  const stNumRaw = a.from_st != null ? String(a.from_st).trim() : ''
  const stNum = stNumRaw === '0' ? '' : stNumRaw
  const streetRaw = a.street != null ? String(a.street).trim() : ''
  const street = /^unknown$/i.test(streetRaw) ? '' : streetRaw
  const stType = a.st_type != null ? String(a.st_type).trim() : ''
  let address = [stNum, street, stType].filter(Boolean).join(' ')
  if (!street) address = (await reverseGeocode(lat, lng)) ?? 'Selected location'

  const zone = zoning?.zoning ? String(zoning.zoning) : null
  const far = resolveSfFar(zone)

  const info: ParcelInfo = {
    address,
    parcelId: String(a.blklot ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: zone ?? 'Unknown',
      subdistrict: zoning?.districtname ? String(zoning.districtname) : null,
      article: null,
      maxHeightFt, // from the Height Districts layer (gen_hght)
      // SF Planning Code §124 (supplement 2026 S-96, read 2026-08-04). The old
      // comment here — "SF residential is largely form-based, not FAR" — was
      // right in substance but unsourced, and left maxFAR null WITHOUT the
      // unconstrained flag, so a residential parcel read as a data gap rather
      // than the answer §124(b) actually gives.
      maxFAR: far.maxFAR,
      ...(far.residentialExempt ? { farUnconstrained: true } : {}),
      // The exemption is per-USE: the same RH-1 lot has no residential FAR but
      // a 1.8 non-residential one. Recording it keeps a commercial project on
      // that parcel from inheriting the residential answer.
      ...(far.residentialExempt && far.nonResidentialFAR != null
        ? { farByUse: { commercial: far.nonResidentialFAR } }
        : {}),
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
