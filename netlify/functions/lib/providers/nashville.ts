// Nashville provider — Metro Nashville / Davidson County (maps.nashville.gov).
// Verified live 2026-08-03; all layers accept inSR=4326 point queries.
//
// Nashville is a consolidated city-county, so one parcel layer covers the whole
// jurisdiction and carries assessor attributes directly — including OWNER, which
// drives the government-owned gate.
//
// Known gaps (genuinely absent from Metro's parcel GIS, not a fetch problem —
// the full 57-field list was checked): no year built, no building area, no unit
// count. Lot size is published in ACRES only.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { cityLimitsGate, cityLimitsSource, fetchCityLimits, outsideCity } from '../jurisdiction'
import { recordAddress } from '../address'
import { resolveNashville } from '../zoning/nashville'

const PARCELS = 'https://maps.nashville.gov/arcgis/rest/services/Cadastral/Parcels/MapServer/0'
const ZL = 'https://maps.nashville.gov/arcgis/rest/services/Zoning_Landuse'
const ZONING = `${ZL}/Zoning/MapServer/14`
// One layer covers all 19 overlay types (historic, conservation, UDO, etc.).
const OVERLAYS = `${ZL}/ZoningOverlayDistricts/MapServer/0`

// ── THE JURISDICTION GATE ─────────────────────────────────────────────────
// ⚠️ NASHVILLE HAS NO "CITY LIMITS" TO READ, and the header above is why: the
// consolidated city-county means Metro's boundary IS Davidson County. What the
// header does not say is that seven SATELLITE CITIES sit inside that county and
// kept their own zoning. Measured at the real entry point 2026-08-12: Belle
// Meade and Berry Hill addresses returned ok:true with real lot areas and
// `districtCode: 'Satellite City'` — the label went straight through to the
// report as if it were a zoning district.
//
// The gate is therefore IN-BAND: Metro's own zoning layer labels those polygons
// `ZONE_DESC = 'Satellite City'`, so the refusal reads Metro's vocabulary rather
// than inferring a boundary. It is queried separately from the required zoning
// read on purpose — that read is conditionally required (it falls back to the
// parcel row's denormalised `Zoning`), and a gate must not inherit a fallback.
//
// The layer, the match and the wording live in ../jurisdiction.ts, which records
// that maps.nashville.gov was enumerated for a boundary polygon first and
// publishes none.
const NASHVILLE_GATE = cityLimitsGate('nashville')!

const SQ_FT_PER_ACRE = 43560

const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

// Nashville zoning (Metro Code Title 17): R/RS single-family, RM multifamily,
// MUL/MUG/MUI mixed-use, CS/CL/CA commercial, IWD/IR industrial, OR office,
// AR agricultural, SP Specific Plan (site-specific — standards live in the SP
// ordinance, not the code), DTC downtown.
function usesForZone(zone: string | null): string[] | null {
  if (!zone) return null
  const z = zone.trim().toUpperCase()
  // Specific Plan: the approved plan governs, so the base code says nothing.
  if (/^SP\b/.test(z)) return null
  if (/^DTC|^MU[LGIN]|^ORI|^ON\b/.test(z)) return ['commercial', 'mixed', 'residential']
  if (/^RM|^R\d|^RS\d/.test(z)) return ['residential']
  if (/^C[SLA]\b|^CF\b|^CN\b/.test(z)) return ['commercial', 'mixed', 'residential']
  if (/^I[WRG]|^IN\b/.test(z)) return ['commercial', 'institutional']
  if (/^OR\b|^OL\b|^OG\b/.test(z)) return ['commercial', 'institutional']
  if (/^AR\b|^AG\b/.test(z)) return ['institutional']
  return null
}

export async function getNashvilleParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const deadline = requestDeadline()
  // REQUIRED reads go through readRequired; OPTIONAL ones keep allSettled. See
  // the contract at the top of ../requiredUpstream.ts.
  //
  // ⚠️ NASHVILLE IS THE ONE PROVIDER WHERE A FAILED ZONING FETCH DOES NOT HAVE TO
  // REFUSE, and that is because of the fallback below rather than a judgement
  // about how reliable the layer is. The parcel layer carries a denormalised
  // `Zoning` copy that agreed with the authoritative layer at every verified test
  // point, so a zoning outage has a second source to fall back on. The refusal is
  // therefore CONDITIONAL: it fires only when the fetch failed AND the fallback
  // is empty, which is the one state the fallback cannot cover. Measured by
  // perturbation 2026-08-11: with the copy present a zoning-layer failure still
  // published the district; with the copy dropped it published `Unknown`.
  const [parcelR, zoningR, optional] = await Promise.all([
    // maxAttempts 2: fetchParcelSnap already retries its exact query internally.
    readRequired(
      'parcel',
      (t) =>
        fetchParcelSnap(
          PARCELS,
          lat,
          lng,
          ['APN', 'PropAddr', 'Acres', 'LUCode', 'LUDesc', 'Owner', 'Zoning', 'TotlAppr'],
          false,
          undefined,
          30,
          t,
        ),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired('zoning', (t) => fetchParcelSnap(ZONING, lat, lng, ['ZONE_DESC', 'NAME'], false, undefined, 30, t), {
      deadline,
      maxAttempts: 2,
      attemptCapMs: 4000,
    }),
    Promise.allSettled([
      fetchCityLimits(NASHVILLE_GATE, lat, lng),
      fetchFeatures(OVERLAYS, lat, lng, ['ZONE_DESC', 'NAME']),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    ]),
  ])
  const [gateR, overlayR, floodR] = optional

  // Runs BEFORE the parcel is read and before either refusal below.
  const outside = outsideCity('nashville', gateR, t0)
  if (outside) return outside

  if (!parcelR.ok) {
    return upstreamUnavailable('nashville', 'Nashville', [parcelR], t0)
  }
  const parcel = firstAttrs(parcelR.value)
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  const zoning = zoningR.ok ? firstAttrs(zoningR.value) : null
  // A parcel can sit under SEVERAL of the 19 overlay types at once — downtown
  // Broadway returns Adult Entertainment, Historic Preservation District, AND
  // Urban Zoning Overlay. Taking features[0] picked whichever came back first
  // (verified 2026-08-03: "Adult Entertainment" was winning over the historic
  // district). The TYPE lives in ZONE_DESC; NAME is the district's proper name
  // ("Lockeland Springs - East End"), so the historic test must read ZONE_DESC.
  const overlayFeatures = (overlayR.status === 'fulfilled' ? overlayR.value.features ?? [] : []).map((f) => f.attributes)
  const describe = (a: Record<string, unknown> | undefined) => {
    if (!a) return null
    const desc = a.ZONE_DESC != null ? String(a.ZONE_DESC).trim() : ''
    const name = a.NAME != null ? String(a.NAME).trim() : ''
    return [name, desc].filter(Boolean).join(' — ') || null
  }
  const HISTORIC_TYPE = /histor|conserv|landmark/i
  const historicOverlay = overlayFeatures.find((a) => HISTORIC_TYPE.test(String(a?.ZONE_DESC ?? '')))
  // Prefer a substantive overlay for the subdistrict label over the blanket
  // "Urban Zoning Overlay" that covers most of the urban core.
  const primaryOverlay =
    historicOverlay ?? overlayFeatures.find((a) => !/urban zoning overlay/i.test(String(a?.ZONE_DESC ?? ''))) ?? overlayFeatures[0]
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // Prefer the authoritative zoning layer; the parcel layer carries a
  // denormalized copy that matched it at every verified test point, so it's a
  // sound fallback when the zoning fetch fails.
  const code = zoning?.ZONE_DESC
    ? String(zoning.ZONE_DESC).trim()
    : parcel.Zoning
      ? String(parcel.Zoning).trim()
      : null

  // THE STATE SPLIT, deferred to here because the fallback above is what decides
  // it. `code === null` with the zoning layer ANSWERING is a real fact: no
  // polygon covers this point, and `Unknown` is the right render. `code === null`
  // with the zoning layer having FAILED is not a fact about the parcel at all —
  // both sources are silent for unrelated reasons, and publishing `Unknown` would
  // turn a timeout into "we don't cover this land".
  if (!zoningR.ok && code == null) {
    return upstreamUnavailable('nashville', 'Nashville', [zoningR], t0)
  }

  // Lot size is published in acres only.
  const acres = Number(parcel.Acres)
  const lotSqFt = Number.isFinite(acres) && acres > 0 ? Math.round(acres * SQ_FT_PER_ACRE) : null

  // Owner is used ONLY to derive a government-owned boolean; the name is
  // discarded here and never stored or returned.
  const ownerPublic = isGovernmentOwner(parcel.Owner != null ? String(parcel.Owner) : null)
  const luDesc = parcel.LUDesc != null ? String(parcel.LUDesc).trim() : ''
  const existingBase = { landUse: luDesc || null }
  const existing = ownerPublic ? { ...existingBase, ownerPublic: true } : luDesc ? existingBase : undefined

  // Floor-area rule from the Title 17 Ch. 17.12 district bulk tables.
  const nashLimits = resolveNashville(code)

  const info: ParcelInfo = {
    ...recordAddress(parcel.PropAddr),
    parcelId: String(parcel.APN ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: code ?? 'Unknown',
      subdistrict: describe(primaryOverlay),
      article: zoning?.NAME ? String(zoning.NAME).trim() : null,
      // Nashville publishes neither height nor FAR in GIS — the zoning layer
      // carries only the district code and ordinance reference.
      //
      // ⚠️ SUPERSEDED 2026-08-14 for FAR only. This comment previously said
      // Metro's bulk standards live in Title 17 text and so BOTH figures stay
      // "not in public data". The FAR half no longer holds: § 17.12.020's four
      // district bulk tables have been read and resolve through
      // ../zoning/nashville.ts. HEIGHT is unchanged — Nashville regulates it as
      // a height-at-setback-line plus a control-plane slope, which is not a
      // single ceiling and is not encoded. Still a GAP.
      maxHeightFt: null,
      maxFAR: nashLimits.maxFAR,
      ...(nashLimits.farUnconstrained ? { farUnconstrained: true } : {}),
      allowedUses: usesForZone(code),
    },
    lot: { sizeSqFt: lotSqFt, lotType: null },
    overlays: {
      // Only a genuinely historic/conservation/landmark overlay counts here —
      // the same layer also carries unrelated types (Adult Entertainment, UZO).
      historicDistrict: describe(historicOverlay),
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      // The overlay layer carries the historic types among several unrelated
      // ones, so its failure is the historic read failing. Left as a bare null
      // the historic hurdle and its months silently disappear — see
      // `lib/unresolvedOverlays.ts`.
      ...unresolvedOverlays({
        historic: describe(historicOverlay) == null && readFailed(overlayR),
        flood: readFailed(floodR),
      }),
    },
    existing,
    // Tennessee assesses at a statutory ratio of market value (25% residential,
    // 40% commercial), so the appraised total is a usable reference.
    assessedValue: posInt(parcel.TotlAppr),
    // ⚠️ `cityLimits` here is the SAME URL as `zoning`, and that is correct
    // rather than a copy-paste: Nashville's gate is in-band (Metro labels the
    // satellite cities inside its own zoning layer, `ZONE_DESC = 'Satellite
    // City'` — see jurisdiction.ts). The duplicate is what an honest source
    // list looks like when one layer answers two questions; sourcing the gate
    // to some other layer to avoid the repetition would cite the wrong one.
    sources: { parcels: PARCELS, zoning: ZONING, ...cityLimitsSource('nashville'), overlays: OVERLAYS, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'nashville', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}

/** THE PARCEL LAYER AND THE COLUMN THIS PROVIDER READS ITS ID FROM.
 *
 *  Exported rather than transcribed into a registry. The layer URLs here are
 *  built from per-file base constants, so any second copy would be a hand-typed
 *  duplicate of a fact this file already holds — and this repo has paid for that
 *  three times. The watchlist checker re-finds a stored parcel BY ID, which is a
 *  different query from the point-in-polygon the report uses, and it needs both
 *  halves from the one place that already knows them. */
export const PARCEL_SOURCE = { layer: PARCELS, idField: 'APN' } as const
