// Denver provider — City & County of Denver Zoning service (parcels at /0,
// zoning at /1) + Open Data historic landmark districts. Verified live
// 2026-06-01. All accept inSR=4326 point queries.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { resolveDenver, DENVER_FT_PER_STORY } from '../zoning/denver'

const PARCELS = 'https://denvergov.org/maps/data/Zoning/MapServer/0'
const ZONING = 'https://denvergov.org/maps/data/Zoning/MapServer/1'
const HISTORIC =
  'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_HIST_LANDMARKDISTRICT_A/FeatureServer/68'
// Denver Expanding Housing Affordability (EHA) market area — "High" vs "Typical".
// Only the commercial linkage fee varies by area; lets us price it exactly.
const EHA = 'https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/EHA_WebService/FeatureServer/5'

// Denver max height (ft). The live HEIGHT_STORIES field carries max stories
// directly and always wins when present (≥12 ft/story). When it's absent, the
// curated table in netlify/functions/lib/zoning/denver.ts (WO-8.8) derives the
// height from the code's trailing stories token — with the "Former Chapter 59"
// guard preserved so a legacy class-code number isn't misread as stories.
// maxFAR stays null (Denver's form-based code has no FAR — see that module).
function isFormerChapter59(description?: unknown): boolean {
  return /former chapter 59/i.test(String(description ?? ''))
}

function denverMaxHeightFt(zone: string | null, heightStories: unknown, description?: unknown): number | null {
  const stories = Number(heightStories)
  if (Number.isFinite(stories) && stories > 0) return Math.round(stories * DENVER_FT_PER_STORY)
  // Legacy "Former Chapter 59" zones (B-3, O-1, R-X…) put a district CLASS in the
  // trailing number, NOT a story count — don't fabricate a height from it.
  return resolveDenver(zone, { formerChapter59: isFormerChapter59(description) }).heightFt
}

// Whether the DZC imposes NO FAR on this district (a known absence) as opposed
// to us simply not resolving one. Both previously surfaced as `maxFAR: null`,
// which made defaultSpec fall back to an unsourced FAR-1.0 assumption on every
// Denver parcel. Former-Chapter-59 and unrecognised codes stay unresolved.
function denverFarUnconstrained(zone: string | null, description?: unknown): boolean {
  return resolveDenver(zone, { formerChapter59: isFormerChapter59(description) }).farUnconstrained === true
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
  // Legacy "Former Chapter 59" districts (pre-2010 recode): R-* residential,
  // B-*/O-* business/office, before the form-based codes above. Without this they
  // fell through to null → an INDETERMINATE verdict on plainly residential land.
  if (/^R-MU/.test(z)) return ['mixed', 'residential', 'commercial']
  if (/^R-/.test(z) || /^R\d/.test(z)) return ['residential']
  if (/^B-/.test(z) || /^O-/.test(z)) return ['commercial', 'mixed', 'residential']
  return null
}

export async function getDenverParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const [parcelR, zoningR, histR, floodR, ehaR] = await Promise.allSettled([
    fetchParcelSnap(PARCELS, lat, lng, [
      'SITUS_ADDRESS_LINE1',
      'LAND_AREA',
      'SCHEDNUM',
      'D_CLASS_CN',
      'APPRAISED_IMP_VALUE',
      'COM_ORIG_YEAR_BUILT',
      'RES_ORIG_YEAR_BUILT',
      'OWNER_NAME',
    ]),
    fetchParcelSnap(ZONING, lat, lng, ['ZONE_DISTRICT', 'ZONE_DESCRIPTION', 'OVERLAY_DISTRICT', 'HEIGHT_STORIES']),
    fetchFeatures(HISTORIC, lat, lng, ['DIST_NAME']),
    fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    fetchFeatures(EHA, lat, lng, ['MarketArea']),
  ])

  if (parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'denver', durationMs: Date.now() - t0 })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['SCHEDNUM', 'LAND_AREA'], 'denver')
  warnIfMissing(zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null, ['ZONE_DISTRICT', 'HEIGHT_STORIES'], 'denver')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null
  const eha = ehaR.status === 'fulfilled' ? firstAttrs(ehaR.value) : null
  const feeArea = eha?.MarketArea ? String(eha.MarketArea).trim() : undefined

  const address = parcel.SITUS_ADDRESS_LINE1 ? String(parcel.SITUS_ADDRESS_LINE1).replace(/\s+/g, ' ').trim() : 'Selected location'
  const land = Number(parcel.LAND_AREA)
  const code = zoning?.ZONE_DISTRICT ? String(zoning.ZONE_DISTRICT) : null
  const maxHeightFt = denverMaxHeightFt(code, zoning?.HEIGHT_STORIES, zoning?.ZONE_DESCRIPTION)

  // Existing structure: improvement (building) value > 0 means a building stands
  // here. D_CLASS_CN is a human-readable use; COM/RES_ORIG_YEAR_BUILT the year.
  const impVal = Number(parcel.APPRAISED_IMP_VALUE)
  const yr = Number(parcel.COM_ORIG_YEAR_BUILT) || Number(parcel.RES_ORIG_YEAR_BUILT)
  const lu = parcel.D_CLASS_CN ? String(parcel.D_CLASS_CN).trim() : ''
  // OWNER_NAME used only to derive a government-owned boolean (no name stored).
  const ownerPublic = isGovernmentOwner(parcel.OWNER_NAME != null ? String(parcel.OWNER_NAME) : null)
  // APPRAISED_IMP_VALUE is the IMPROVEMENT (building) value only — NOT land +
  // building — so we label it 'improvement only' and never present it as a total
  // (assessedValueBasis). Coarse land-cost proxy only; never feeds the cost math.
  const existingBase =
    Number.isFinite(impVal) && impVal > 0
      ? {
          landUse: lu ? lu.charAt(0) + lu.slice(1).toLowerCase() : null,
          yearBuilt: Number.isFinite(yr) && yr > 1000 ? yr : null,
          numBuildings: 1,
          assessedValue: Math.round(impVal),
          assessedValueBasis: 'improvement only',
        }
      : undefined
  const existing = ownerPublic ? { ...(existingBase ?? {}), ownerPublic: true } : existingBase

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
      ...(denverFarUnconstrained(code, zoning?.ZONE_DESCRIPTION) ? { farUnconstrained: true } : {}),
    },
    lot: {
      sizeSqFt: Number.isFinite(land) && land > 0 ? Math.round(land) : null,
      lotType: null,
    },
    overlays: {
      historicDistrict: hist?.DIST_NAME ? String(hist.DIST_NAME) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      feeArea,
    },
    existing,
    sources: { parcels: PARCELS, zoning: ZONING, historic: HISTORIC, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'denver', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
