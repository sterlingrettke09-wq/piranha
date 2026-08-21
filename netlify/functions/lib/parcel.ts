import {
  isInBbox,
  BOSTON_BBOX,
  NYC_BBOX,
  CHICAGO_BBOX,
  SF_BBOX,
  SEATTLE_BBOX,
  DC_BBOX,
  AUSTIN_BBOX,
  LA_BBOX,
  DENVER_BBOX,
  MINNEAPOLIS_BBOX,
  PHILADELPHIA_BBOX,
  MIAMI_BBOX,
  SAN_DIEGO_BBOX,
  SAN_JOSE_BBOX,
  NASHVILLE_BBOX,
  RALEIGH_BBOX,
  MILWAUKEE_BBOX,
  COLUMBUS_BBOX,
  CHARLOTTE_BBOX,
  ATLANTA_BBOX,
  DALLAS_BBOX,
  LAS_VEGAS_BBOX,
  PHOENIX_BBOX,
  type Bbox,
  type ParcelInfo,
} from '../../../src/types/parcel'
import { ENDPOINTS, FIELDS } from './_endpoints'
import { mapZoningUse } from './zoningUse'
import { isGovernmentOwner } from '../../../src/lib/developability'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from './arcgis'
import { readFailed, unresolvedOverlays } from './unresolvedOverlays'
import { getNycParcelInfo } from './providers/nyc'
import { getChicagoParcelInfo } from './providers/chicago'
import { getSfParcelInfo } from './providers/sf'
import { getSeattleParcelInfo } from './providers/seattle'
import { getDcParcelInfo } from './providers/dc'
import { getAustinParcelInfo } from './providers/austin'
import { getLaParcelInfo } from './providers/la'
import { getDenverParcelInfo } from './providers/denver'
import { getMinneapolisParcelInfo } from './providers/minneapolis'
import { getPhiladelphiaParcelInfo } from './providers/philadelphia'
import { getMiamiParcelInfo } from './providers/miami'
import { getSanDiegoParcelInfo } from './providers/sandiego'
import { getSanJoseParcelInfo } from './providers/sanjose'
import { getNashvilleParcelInfo } from './providers/nashville'
import { getRaleighParcelInfo } from './providers/raleigh'
import { getMilwaukeeParcelInfo } from './providers/milwaukee'
import { getColumbusParcelInfo } from './providers/columbus'
import { getCharlotteParcelInfo } from './providers/charlotte'
import { getAtlantaParcelInfo } from './providers/atlanta'
import { getDallasParcelInfo } from './providers/dallas'
import { getLasVegasParcelInfo } from './providers/lasvegas'
import { getPhoenixParcelInfo } from './providers/phoenix'
import { computeEnvelope } from './envelope'
import { resolveBostonFar } from './zoning/boston'
import { recordAddress } from './address'

export type { ParcelResult }

// ---- Boston provider (BPDA zoning + assessing parcels + historic + FEMA flood) ----
async function getBostonParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const [zoningR, parcelR, historicR, floodR] = await Promise.allSettled([
    fetchParcelSnap(ENDPOINTS.zoning, lat, lng, FIELDS.zoning),
    fetchParcelSnap(ENDPOINTS.parcels, lat, lng, FIELDS.parcels),
    fetchFeatures(ENDPOINTS.historic, lat, lng, FIELDS.historic),
    fetchFeatures(ENDPOINTS.flood, lat, lng, FIELDS.flood),
  ])

  if (zoningR.status === 'rejected' || parcelR.status === 'rejected') {
    console.log({ event: 'parcel.upstream_fail', city: 'boston', durationMs: Date.now() - t0, zoning: zoningR.status, parcel: parcelR.status })
    return { ok: false, code: 'UPSTREAM_ERROR', message: 'A required upstream dataset is unavailable. Try again shortly.', status: 502 }
  }

  const zoning = firstAttrs(zoningR.value)
  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(zoning, ['Name', 'HeightMax', 'FARMax'], 'boston')
  warnIfMissing(parcel, ['PID', 'LAND_SF'], 'boston')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const historic = historicR.status === 'fulfilled' ? firstAttrs(historicR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  const stNum = parcel.ST_NUM != null ? String(parcel.ST_NUM).trim() : ''
  const stName = parcel.ST_NAME != null ? String(parcel.ST_NAME).trim() : ''
  // Was 'Unknown address' here and 'Selected location' in every other city, for
  // the same state. One placeholder now, which also puts an address-less Boston
  // parcel on the same short cache TTL as everyone else's (`cacheControlFor`).
  const addressed = recordAddress([stNum, stName].filter(Boolean).join(' '))
  const landSf = Number(parcel.LAND_SF)

  const posInt = (v: unknown): number | null => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null
  }
  const resU = posInt(parcel.RES_UNITS) ?? 0
  const comU = posInt(parcel.COM_UNITS) ?? 0
  const totalUnits = resU + comU
  const luDesc = parcel.LU_DESC != null ? String(parcel.LU_DESC).trim() : ''
  // OWNER is used ONLY to derive a government-owned boolean; the name is discarded
  // here and never stored or returned (no owner PII leaves the server).
  const ownerPublic = isGovernmentOwner(parcel.OWNER != null ? String(parcel.OWNER) : null)
  // TOTAL_VALUE is the assessor's full total (land + improvement). MA assesses at
  // ~full market value, so this is a usable land-cost proxy (see assessedValueBasis).
  const totalValue = posInt(parcel.TOTAL_VALUE)
  const existing = {
    landUse: luDesc || null,
    yearBuilt: posInt(parcel.YR_BUILT),
    buildingAreaSqFt: posInt(parcel.GROSS_AREA),
    units: totalUnits > 0 ? totalUnits : null,
    numBuildings: posInt(parcel.NUM_BLDGS),
    ...(totalValue != null ? { assessedValue: totalValue, assessedValueBasis: 'total assessed (county)' } : {}),
    ...(ownerPublic ? { ownerPublic: true } : {}),
  }

  const info: ParcelInfo = {
    ...addressed,
    parcelId: String(parcel.PID ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: String(zoning?.Name ?? 'Unknown'),
      subdistrict: zoning?.District ? String(zoning.District) : null,
      article: zoning?.Article ? String(zoning.Article) : null,
      maxHeightFt: typeof zoning?.HeightMax === 'number' ? zoning.HeightMax : null,
      // BPDA publishes no FARMax on the two-numerical-part subdistricts
      // (B-1-55, H-2-55, H-2-D-65, I-2-D-65, L-2-65, M-1-55). Without a
      // provider value, resolveZoningLimits fell through to the per-letter seed
      // constants — which put B-1-55 at FAR 2.0 against the code's 1.0. Art. 3
      // § 3-1 makes the subdistrict number the FAR and Art. 13 Table B states
      // it; read it rather than seeding from the leading letter.
      maxFAR:
        typeof zoning?.FARMax === 'number'
          ? zoning.FARMax
          : resolveBostonFar(String(zoning?.Name ?? '')),
      // The code states a floor count on 624 of 1,649 subdistricts. Carry it
      // rather than dividing HeightMax by a floor-to-floor convention — on the
      // 80 subdistricts publishing both, deriving disagreed with the code 35%
      // of the time (2 or 2.5 stated vs 3 derived at HeightMax 35).
      ...(typeof zoning?.NumFloorsMax === 'number' && zoning.NumFloorsMax > 0
        ? { maxStories: zoning.NumFloorsMax }
        : {}),
      allowedUses: mapZoningUse(typeof zoning?.Use_ === 'string' ? zoning.Use_ : null),
    },
    lot: {
      sizeSqFt: Number.isFinite(landSf) && landSf > 0 ? landSf : null,
      lotType: null,
    },
    overlays: {
      historicDistrict: historic?.HIST_NAME ? String(historic.HIST_NAME) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      // Measured 2026-08-12 at the analyze handler, only this layer faulted, on
      // 26 Exeter St (B-3-65, in the Back Bay Architectural District, restaurant
      // standing): the historic design-review row and the abutter-appeal row
      // both disappeared and the verdict went NEEDS_RELIEF 55 mo → AS_OF_RIGHT
      // 51 mo. See `lib/unresolvedOverlays.ts` for why the emptiness test is
      // half the condition.
      ...unresolvedOverlays({
        historic: !historic?.HIST_NAME && readFailed(historicR),
        flood: !flood?.FLD_ZONE && readFailed(floodR),
      }),
    },
    existing,
    // MA assesses at ~full market value, so this is a usable reference (not a
    // market appraisal). Fractional/frozen-assessment cities omit it.
    assessedValue: totalValue,
    sources: ENDPOINTS,
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'boston', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}

// ---- City registry + dispatcher ----
type Provider = (lat: number, lng: number) => Promise<ParcelResult>
interface CityConfig {
  bbox: Bbox
  label: string
  provider: Provider
}

const CITIES: Record<string, CityConfig> = {
  boston: { bbox: BOSTON_BBOX, label: 'Boston', provider: getBostonParcelInfo },
  nyc: { bbox: NYC_BBOX, label: 'New York City', provider: getNycParcelInfo },
  chicago: { bbox: CHICAGO_BBOX, label: 'Chicago', provider: getChicagoParcelInfo },
  sf: { bbox: SF_BBOX, label: 'San Francisco', provider: getSfParcelInfo },
  seattle: { bbox: SEATTLE_BBOX, label: 'Seattle', provider: getSeattleParcelInfo },
  dc: { bbox: DC_BBOX, label: 'Washington, DC', provider: getDcParcelInfo },
  austin: { bbox: AUSTIN_BBOX, label: 'Austin', provider: getAustinParcelInfo },
  la: { bbox: LA_BBOX, label: 'Los Angeles', provider: getLaParcelInfo },
  denver: { bbox: DENVER_BBOX, label: 'Denver', provider: getDenverParcelInfo },
  minneapolis: { bbox: MINNEAPOLIS_BBOX, label: 'Minneapolis', provider: getMinneapolisParcelInfo },
  philadelphia: { bbox: PHILADELPHIA_BBOX, label: 'Philadelphia', provider: getPhiladelphiaParcelInfo },
  miami: { bbox: MIAMI_BBOX, label: 'Miami', provider: getMiamiParcelInfo },
  sandiego: { bbox: SAN_DIEGO_BBOX, label: 'San Diego', provider: getSanDiegoParcelInfo },
  sanjose: { bbox: SAN_JOSE_BBOX, label: 'San Jose', provider: getSanJoseParcelInfo },
  nashville: { bbox: NASHVILLE_BBOX, label: 'Nashville', provider: getNashvilleParcelInfo },
  raleigh: { bbox: RALEIGH_BBOX, label: 'Raleigh', provider: getRaleighParcelInfo },
  milwaukee: { bbox: MILWAUKEE_BBOX, label: 'Milwaukee', provider: getMilwaukeeParcelInfo },
  columbus: { bbox: COLUMBUS_BBOX, label: 'Columbus', provider: getColumbusParcelInfo },
  charlotte: { bbox: CHARLOTTE_BBOX, label: 'Charlotte', provider: getCharlotteParcelInfo },
  atlanta: { bbox: ATLANTA_BBOX, label: 'Atlanta', provider: getAtlantaParcelInfo },
  dallas: { bbox: DALLAS_BBOX, label: 'Dallas', provider: getDallasParcelInfo },
  lasvegas: { bbox: LAS_VEGAS_BBOX, label: 'Las Vegas', provider: getLasVegasParcelInfo },
  phoenix: { bbox: PHOENIX_BBOX, label: 'Phoenix', provider: getPhoenixParcelInfo },
}

export const LIVE_CITIES = Object.keys(CITIES)

// ---- Degraded-response cache control ----
// Freezing a partial answer into the CDN for 24h turned a transient GIS outage
// into a day of "Unknown district" for everyone who clicked that block (observed
// live in Chicago, 2026-06-10). Partial answers cache for 5 minutes instead, so
// the next visitor retries upstream while healthy answers keep the long TTL.
//
// ⚠️ WHAT REACHES HERE CHANGED. This used to be the whole mitigation for a
// failed zoning fetch, because that failure degraded to `districtCode:
// 'Unknown'` and a short TTL was the best that could be done with it. Required
// reads now refuse instead (lib/requiredUpstream.ts), and a refusal never
// becomes a `ParcelInfo`, so it cannot be cached at any TTL — netlify/functions/
// parcel.ts sends error responses with no Cache-Control header at all.
//
// The 'Unknown' branch below is therefore no longer about outages. It now covers
// the genuine no-coverage answer (a county parcel outside the city's zoning) and
// the geocode fallback, which is still a degraded field: `reverseGeocode`
// returns null on failure and the address becomes 'Selected location'. The short
// TTL is kept for both — a real no-coverage answer is stable, so nothing is lost
// by re-asking, and the geocode case genuinely wants the retry.
export const CACHE_OK = 'public, s-maxage=86400, stale-while-revalidate=604800'
export const CACHE_DEGRADED = 'public, s-maxage=300'

export function cacheControlFor(info: ParcelInfo): string {
  const degraded =
    info.zoning.districtCode === 'Unknown' ||
    info.address === 'Selected location' ||
    // An unresolved overlay is exactly the state this branch was built for, and
    // it is the one that now reaches here most often. A response carrying "the
    // Coastal Zone layer did not respond" is a fact about ONE REQUEST, not about
    // the parcel — freezing it into the CDN for 24 hours would turn a
    // thirty-second outage into a day of reports telling every visitor a check
    // could not be performed, on a layer that came back immediately. Five
    // minutes, and the next visitor re-asks upstream. (Nothing is lost if the
    // outage persists: the next response says the same thing.)
    (info.overlays.unresolved?.length ?? 0) > 0
  return degraded ? CACHE_DEGRADED : CACHE_OK
}

export async function getParcelInfo(city: string, lat: number, lng: number): Promise<ParcelResult> {
  const cfg = CITIES[city]
  // An unknown city must NOT silently fall back to Boston's bbox (that yielded a
  // confusing "outside Boston" error for a city the user never typed).
  if (!cfg) {
    return {
      ok: false,
      code: 'OUT_OF_BBOX',
      message: `We don’t cover “${city}” yet. Pick one of the supported cities.`,
      status: 400,
    }
  }
  // Two different facts, and they used to share one sentence: "lat/lng missing,
  // invalid, or outside {city}." A malformed coordinate is a caller bug; a valid
  // coordinate outside the box is an ANSWER about a place, and it is now the
  // common one — removing the bbox from the address search (SearchBar.tsx) stops
  // Mapbox substituting a nearby address for one outside the city, so a search
  // for a genuinely out-of-area address arrives here at its TRUE coordinate and
  // this string is what the user reads.
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, code: 'OUT_OF_BBOX', message: 'lat/lng missing or invalid.', status: 400 }
  }
  if (!isInBbox(cfg.bbox, lat, lng)) {
    return {
      ok: false,
      code: 'OUT_OF_BBOX',
      message: `That location is outside ${cfg.label}. This tool covers ${cfg.label} only — pick another city from the menu, or search an address inside ${cfg.label}.`,
      status: 400,
    }
  }
  const r = await cfg.provider(lat, lng)
  if (r.ok) r.info.envelope = computeEnvelope(r.info, city)
  return r
}
