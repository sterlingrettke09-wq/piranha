// Chicago provider — city zoning (ZONE_CLASS) + Cook County parcel geometry
// (lot area) + Mapbox reverse-geocoded address. Verified 2026-05-29.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, firstFeature, warnIfMissing, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { polygonAreaSqFt, reverseGeocode } from '../geo'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { cityLimitsGate, cityLimitsSource, fetchCityLimits, outsideCity } from '../jurisdiction'
import { CHICAGO_BASE_FAR } from '../zoning/chicago'
import { geocodedAddress } from '../address'
import { parcelVintageFor } from './parcelVintage'

const ZONING =
  'https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/Zoning_update/MapServer/15'
// ⚠️ THE PARCEL LAYER IS RESOLVED, NOT TYPED. Cook County publishes the fabric as
// one layer per tax year — twenty-six of them, 2000 through 2025 — so a hardcoded
// `/2025` here was not a risk but a scheduled break: the day `Parcel 2026` is
// published, every Chicago answer keeps reading the previous year and nothing
// says so. `parcelVintage.ts` reads the service's own layer list and the year it
// resolved travels on the answer, so a watchlist row records what it was read
// from. See that file for why this did NOT move to `parcel_current_beta`.
const HISTORIC =
  'https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/Zoning_update/MapServer/6' // Historic Districts (NAME).

// ── THE JURISDICTION GATE ─────────────────────────────────────────────────
// The parcel layer is the COOK COUNTY fabric; the zoning layer is the CITY's.
// Measured 2026-08-12 at the real entry point: Oak Park and Cicero addresses
// inside CHICAGO_BBOX both returned ok:true with a real lot area (115,510 and
// 327,433 sq ft) and `districtCode: 'Unknown'`.
//
// The layer, the match and the refusal wording live in ../jurisdiction.ts,
// which carries one entry for every live city and records how each was
// established. It degrades OPEN on a failed fetch and reads the EXACT point,
// never a buffered snap.
const CHICAGO_GATE = cityLimitsGate('chicago')!


// Cook County assessor class → existing use (1xx vacant, 2xx residential,
// 3xx apartments, 4xx institutional, 5xx+ commercial/industrial).
function chicagoExistingUse(cls: unknown): string | null {
  const c = String(cls ?? '').trim()
  if (!c) return null
  switch (c[0]) {
    case '1':
      return 'Vacant land'
    case '2':
      return 'Residential building'
    case '3':
      return 'Apartment building'
    case '4':
      return 'Institutional building'
    case '5':
    case '6':
    case '7':
    case '8':
      return 'Commercial / industrial building'
    default:
      return null
  }
}

// Chicago base FAR by residential district class. The table now lives in
// netlify/functions/lib/zoning/chicago.ts (WO-8.8 depth program) alongside the
// B/C/D/M suffix tables; we import it here so the provider still surfaces the
// residential base FAR at parcel-resolve time. B/C/D/M FARs are filled in
// downstream by resolveZoningLimits via resolveChicago().
function chicagoBaseFAR(zone: string | null): number | null {
  if (!zone) return null
  return CHICAGO_BASE_FAR[zone.trim().toUpperCase()] ?? null
}

// Chicago zoning class prefix → use vocabulary.
function usesForZone(zone: string | null): string[] | null {
  if (!zone) return null
  const c = zone.trim().toUpperCase()[0]
  if (c === 'R') return ['residential', 'institutional']
  if (c === 'B' || c === 'C') return ['commercial', 'mixed', 'residential']
  if (c === 'D') return ['commercial', 'mixed', 'residential', 'institutional']
  if (c === 'M') return ['commercial', 'institutional']
  return null // PD (planned development), POS (open space), etc. — indeterminate.
}

export async function getChicagoParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  // No per-call timeout overrides: the snap helpers enforce a shared budget
  // (exact + retry + buffered) so a slow Chicago layer can't push the function
  // past Netlify's 10s ceiling, which the old 9s overrides did. The required
  // reads now share ONE deadline across the request as well.
  const deadline = requestDeadline()
  // Resolved before the reads because it decides which layer they hit. Memoised
  // per warm instance, so this is one extra request per instance, not per parcel.
  const vintage = await parcelVintageFor('chicago')
  const PARCELS = vintage.layerUrl ?? ''
  // REQUIRED reads go through readRequired; OPTIONAL ones keep allSettled, so
  // the two categories look different in the source. Read the contract at the
  // top of ../requiredUpstream.ts before moving a fetch between them.
  const [parcelR, zoningR, optional] = await Promise.all([
    // maxAttempts 2, not 3: fetchParcelSnap already retries its exact query
    // internally, so three outer attempts would be up to six queries.
    readRequired(
      'parcel',
      (t) => fetchParcelSnap(PARCELS, lat, lng, ['PIN10', 'AssessorBLDGclass'], true, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired('zoning', (t) => fetchParcelSnap(ZONING, lat, lng, ['ZONE_CLASS'], false, undefined, 30, t), {
      deadline,
      maxAttempts: 2,
      attemptCapMs: 4000,
    }),
    Promise.allSettled([
      fetchCityLimits(CHICAGO_GATE, lat, lng),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
      reverseGeocode(lat, lng),
      fetchFeatures(HISTORIC, lat, lng, ['NAME']),
    ]),
  ])
  const [gateR, floodR, addrR, histR] = optional

  // Runs BEFORE the parcel is read and BEFORE the state split below.
  const outside = outsideCity('chicago', gateR, t0)
  if (outside) return outside

  // THE STATE SPLIT. "The service did not answer" is an error and the only legal
  // handling is to refuse. "The service answered and found nothing" survives past
  // this line as the `Unknown` the no-coverage copy is for.
  if (!parcelR.ok || !zoningR.ok) {
    return upstreamUnavailable('chicago', 'Chicago', [parcelR, zoningR], t0)
  }

  const pf = firstFeature(parcelR.value)
  warnIfMissing(pf?.attributes ?? null, ['PIN10'], 'chicago')
  if (!pf) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED, so a null here means one
  // thing: no polygon covers this point.
  const zoning = firstAttrs(zoningR.value)
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null
  const addressed = geocodedAddress(addrR.status === 'fulfilled' ? addrR.value : null)
  const zone = zoning?.ZONE_CLASS ? String(zoning.ZONE_CLASS) : null
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null

  const info: ParcelInfo = {
    ...addressed,
    parcelId: String(pf.attributes.PIN10 ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: zone ?? 'Unknown',
      subdistrict: null,
      article: null,
      maxHeightFt: null,
      maxFAR: chicagoBaseFAR(zone), // residential base FAR; null for B/C/D/M (varies by suffix)
      allowedUses: usesForZone(zone),
    },
    lot: {
      sizeSqFt: polygonAreaSqFt(pf.geometry?.rings, 1), // Cook County SR is US feet.
      lotType: null,
    },
    overlays: {
      historicDistrict: hist?.NAME ? String(hist.NAME) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      // A failed optional read is NOT "nothing here". Left as a bare null, the
      // hurdle each field triggers silently disappears along with the months it
      // carries — see `lib/unresolvedOverlays.ts` and the "could not be checked"
      // rows in `hurdles.ts`.
      ...unresolvedOverlays({
        historic: !hist?.NAME && readFailed(histR),
        flood: readFailed(floodR),
      }),
    },
    existing: { landUse: chicagoExistingUse(pf.attributes.AssessorBLDGclass) },
    parcelVintage: vintage,
    sources: { zoning: ZONING, parcels: PARCELS, ...cityLimitsSource('chicago'), flood: ENDPOINTS.flood, historic: HISTORIC },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'chicago', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}

/** ⚠️ CHICAGO'S PARCEL LAYER IS NOT A CONSTANT, so this one is a function.
 *
 *  Cook County publishes the fabric as one layer per tax year and the layer is
 *  resolved per request (see `parcelVintage.ts`), so a checker re-finding a
 *  stored parcel must resolve it too rather than reading a URL that would be
 *  frozen the day 2026 publishes. The vintage it resolves is also what the
 *  checker compares BEFORE it compares any field.
 *
 *  `PIN10` is the ten-digit land-parcel id. Not `PARID`, which is the fourteen-
 *  digit PIN on Cook County's other two parcel services — those identify condo
 *  units as well as land, and switching to them would change what a watched
 *  "parcel" is. */
export const PARCEL_SOURCE = {
  idField: 'PIN10',
  resolveLayer: async () => (await parcelVintageFor('chicago')),
} as const
