// Philadelphia provider — City of Philadelphia ArcGIS Online (DOR parcels + OPA
// assessor + zoning base districts + the ZoningCodeCharacteristics table) and the
// Philadelphia Register historic districts. Verified live 2026-08-03; all layers
// accept inSR=4326 point queries.
//
// Philadelphia is the ONLY city in the portfolio besides Boston that publishes both
// max height and max FAR. They arrive as free text and are parsed conservatively —
// see netlify/functions/lib/zoning/philadelphia.ts.
//
// Two-step parcel read: DOR_Parcel carries the geometry and `pin` but NO lot area;
// the OPA assessor layer carries lot area / year built / owner / stories and is
// joined on `pin`. A distance query against OPA returns nothing, so the join is
// required rather than optional.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import {
  fetchFeatures,
  fetchParcelSnap,
  fetchWhere,
  firstAttrs,
  firstFeature,
  sqlQuote,
  type ParcelResult,
} from '../arcgis'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { polygonAreaSqFt } from '../geo'
import { parseMaxHeightFt, parseMaxFAR, phlFarUnconstrained } from '../zoning/philadelphia'

// Pennsylvania State Plane South (EPSG:2272), units = US survey feet. Parcel
// geometry is requested in this SR so a shoelace area is already in square feet.
// DOR's own Shape__Area is Web Mercator and runs ~1.7x high at this latitude.
const PA_SOUTH_FT = 2272
// Below this, an OPA "lot area" is a placeholder rather than a real lot: condo
// unit accounts (parcel_number 888*) report 0 or 1 sq ft because the land belongs
// to the whole building, not the unit. Philadelphia's smallest genuine rowhouse
// lots are ~350-500 sq ft, so 100 is a safe floor.
const MIN_CREDIBLE_LOT_SQFT = 100

const ORG = 'https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services'
// Parcel polygons (geometry + pin). `status=1` filters inactive and stacked
// air-rights records; we read the field and drop non-active rows below.
const PARCELS = `${ORG}/DOR_Parcel/FeatureServer/0`
// Office of Property Assessment — the attribute half of the parcel.
const OPA = `${ORG}/OPA_PROPERTIES_PUBLIC/FeatureServer/0`
const ZONING = `${ORG}/Zoning_BaseDistricts/FeatureServer/0`
// Non-spatial table: one row per zoning district with MaxHeight / MaxFAR as text.
const ZONING_CHARS = `${ORG}/ZoningCodeCharacteristics/FeatureServer/0`
const HISTORIC = `${ORG}/HistoricDistricts_Local/FeatureServer/0`

// Philadelphia base district → use vocabulary (Zoning Code Title 14).
//   RSD/RSA/RTA/RM = residential, RMX = residential-mixed, CMX = commercial-mixed,
//   CA = auto-oriented commercial, I*/IRMX/ICMX = industrial, SP-* = special purpose.
function usesForZone(code: string | null): string[] | null {
  if (!code) return null
  const z = code.trim().toUpperCase()
  if (/^RMX/.test(z)) return ['mixed', 'residential', 'commercial']
  if (/^(RSD|RSA|RTA|RM)/.test(z)) return ['residential']
  if (/^CMX/.test(z)) return ['commercial', 'mixed', 'residential']
  if (/^CA-/.test(z)) return ['commercial']
  if (/^(IRMX|ICMX)/.test(z)) return ['commercial', 'mixed', 'residential']
  if (/^I-/.test(z)) return ['commercial', 'institutional']
  // SP-INS (institutional), SP-STA (stadium), SP-ENT (entertainment), SP-PO
  // (parks/open space), SP-AIR (airport). Deliberately narrow — SP-PO is public
  // open space and the developability gate treats it accordingly.
  if (/^SP-/.test(z)) return ['institutional']
  return null
}

const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/** "1500 MARKET ST # 12FL" → "1500 MARKET ST" (unit suffixes aren't the site). */
function cleanAddress(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).replace(/\s+/g, ' ').trim()
  if (!s) return null
  return s.split('#')[0].trim() || null
}

export async function getPhiladelphiaParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const [parcelR, zoningR, histR, floodR] = await Promise.allSettled([
    // Geometry in PA State Plane feet so we can derive lot size when the assessor
    // record is missing or degenerate (condo units, air-rights parcels).
    fetchParcelSnap(PARCELS, lat, lng, ['pin', 'addr_std', 'status'], true, PA_SOUTH_FT),
    fetchParcelSnap(ZONING, lat, lng, ['long_code', 'code']),
    fetchFeatures(HISTORIC, lat, lng, ['name']),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'philadelphia', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }
  const parcelFeat = firstFeature(parcelR.value)
  const parcel = parcelFeat?.attributes ?? null
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }
  // Inactive / superseded parcel records carry a non-1 status.
  const status = parcel.status == null ? 1 : Number(parcel.status)
  if (Number.isFinite(status) && status !== 1) {
    return { ok: false, code: 'NO_PARCEL', message: 'No active parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  const pin = parcel.pin != null ? String(parcel.pin).trim() : ''
  const code = zoning?.long_code ? String(zoning.long_code).trim() : null

  // Second hop: OPA attributes by pin, and the dimensional limits by district.
  // Both are optional enrichment — a failure degrades a field, not the response.
  const [opaR, charsR] = await Promise.allSettled([
    pin
      ? fetchWhere(OPA, `pin = ${sqlQuote(pin)}`, [
          'total_area',
          'year_built',
          'owner_1',
          'number_stories',
          'category_code_description',
          'market_value',
          'total_livable_area',
        ])
      : Promise.resolve({ features: [] }),
    code
      ? fetchWhere(ZONING_CHARS, `ZoningDist = ${sqlQuote(code)}`, ['ZoningDist', 'MaxHeight', 'MaxFAR'])
      : Promise.resolve({ features: [] }),
  ])
  const opa = opaR.status === 'fulfilled' ? firstAttrs(opaR.value) : null
  const chars = charsR.status === 'fulfilled' ? firstAttrs(charsR.value) : null

  // Lot size: prefer the assessor's recorded area, but reject the degenerate
  // values condo-unit accounts carry (0 or 1 sq ft — the land belongs to the
  // building, not the unit) and fall back to the parcel polygon, which is already
  // in square feet because we asked for PA State Plane. Never use DOR's own
  // Shape__Area: it is Web Mercator and runs ~1.7x high at this latitude.
  const opaArea = posInt(opa?.total_area)
  const lotSqFt =
    opaArea != null && opaArea >= MIN_CREDIBLE_LOT_SQFT
      ? opaArea
      : polygonAreaSqFt(parcelFeat?.geometry?.rings)

  // owner_1 is used ONLY to derive a government-owned boolean; the name is
  // discarded here and never stored or returned.
  const ownerPublic = isGovernmentOwner(opa?.owner_1 != null ? String(opa.owner_1) : null)
  const landUse = opa?.category_code_description ? String(opa.category_code_description).trim() : null
  const existingBase = {
    landUse: landUse || null,
    yearBuilt: posInt(opa?.year_built),
    buildingAreaSqFt: posInt(opa?.total_livable_area),
    stories: posInt(opa?.number_stories),
  }
  const hasExisting = Object.values(existingBase).some((v) => v != null)
  const existing = ownerPublic
    ? { ...existingBase, ownerPublic: true }
    : hasExisting
      ? existingBase
      : undefined

  const info: ParcelInfo = {
    address: cleanAddress(parcel.addr_std) ?? 'Selected location',
    parcelId: pin,
    coordinates: [lng, lat],
    zoning: {
      districtCode: code ?? 'Unknown',
      subdistrict: null,
      article: null,
      maxHeightFt: parseMaxHeightFt(chars?.MaxHeight as string | null | undefined),
      maxFAR: parseMaxFAR(chars?.MaxFAR as string | null | undefined),
      // A blank MaxFAR is TWO states. For the residential districts whose
      // dimensional table has no FAR row at all, it is a stated absence (see
      // PHL_NO_FAR_DISTRICTS); everywhere else it is an unresolved lookup and
      // must keep failing closed.
      ...(phlFarUnconstrained(code) ? { farUnconstrained: true } : {}),
      allowedUses: usesForZone(code),
    },
    lot: { sizeSqFt: lotSqFt, lotType: null },
    overlays: {
      historicDistrict: hist?.name ? String(hist.name).trim() : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
    },
    existing,
    // Philadelphia assesses at market value, so this is a usable reference.
    assessedValue: posInt(opa?.market_value),
    sources: { parcels: PARCELS, assessor: OPA, zoning: ZONING, zoningLimits: ZONING_CHARS, historic: HISTORIC, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'philadelphia', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
