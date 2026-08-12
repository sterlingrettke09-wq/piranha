// Denver provider — City & County of Denver Zoning service (parcels at /0,
// zoning at /1) + Open Data historic landmark districts. Verified live
// 2026-06-01. All accept inSR=4326 point queries.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { resolveDenver, DENVER_FT_PER_STORY } from '../zoning/denver'
import { recordAddress } from '../address'

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
// A current DZC code always carries a neighborhood-context prefix AND a form
// segment — `C-MX-5`, `G-MU-3`, `U-SU-A`, `S-MX-3`, `E-TU-B`, `I-MX-3` — so it
// has at least two hyphens. Former Chapter 59 legacy codes are a bare letter
// class plus a number: `B-3`, `O-1`, `R-2`, `R-X`.
//
// ⚠️ This used to be detected ONLY by the phrase "former chapter 59" appearing
// in ZONE_DESCRIPTION. Where the layer described a legacy parcel as plain
// "Business", the guard silently missed and the trailing token — a district
// CLASS number — was read as a story count and multiplied into a height: B-3
// published 36 ft (3 × 12) for a district whose "3" means nothing of the kind.
// A test asserted that behaviour and named it in its own title ("still derives a
// height from the trailing token"), so the fabrication was pinned in place.
//
// The shape of the code is intrinsic; a description string is an annotation that
// may or may not be filled in. Detect on the shape, and treat the description as
// a secondary confirmation only.
function isFormerChapter59(zone?: unknown, description?: unknown): boolean {
  if (/former chapter 59/i.test(String(description ?? ''))) return true
  const z = String(zone ?? '').trim().toUpperCase()
  if (!z) return false
  // Two or more hyphens ⇒ a current DZC context-and-form code.
  if ((z.match(/-/g) ?? []).length >= 2) return false
  // Single-letter class + trailing token ⇒ legacy (B-3, O-1, R-2, R-X, PUD-4).
  return /^[A-Z]{1,3}-[0-9A-Z]+$/.test(z)
}

function denverMaxHeightFt(zone: string | null, heightStories: unknown, description?: unknown): number | null {
  // ⚠️ ORDER IS THE WHOLE POINT. This used to derive `stories × 12` from the live
  // HEIGHT_STORIES field FIRST and only consult the curated table when the field
  // was absent — so a C-MX-5 parcel published 60 ft while the DZC prints 70 ft,
  // and correcting the table alone changed nothing for real parcels. The table's
  // own tests passed throughout, because they called resolveDenver directly
  // instead of the pipeline (rule 11, inside the fix for a rule-12 defect).
  //
  // A figure READ FROM THE CODE outranks one manufactured from a story count via
  // an unsourced ft/story constant. Only where the DZC's printed feet have not
  // been read (`derived-estimate` — Articles 3–6, whose districts print different
  // feet per building form) does the live story count still drive an estimate.
  const fromCode = resolveDenver(zone, { formerChapter59: isFormerChapter59(zone, description) })
  if (fromCode.heightBasis === 'code-stated' && fromCode.heightFt != null) return fromCode.heightFt

  const stories = Number(heightStories)
  if (Number.isFinite(stories) && stories > 0) return Math.round(stories * DENVER_FT_PER_STORY)
  // Legacy "Former Chapter 59" zones (B-3, O-1, R-X…) put a district CLASS in the
  // trailing number, NOT a story count — don't fabricate a height from it.
  return fromCode.heightFt
}

// Story count the code states. Denver encodes it as the trailing token and the
// live layer carries it in HEIGHT_STORIES — the provider already HAS this number
// and was throwing it away by converting to feet, after which the envelope
// divided by a different constant and drifted (C-MX-12 published 13 stories).
function denverMaxStories(zone: string | null, heightStories: unknown, description?: unknown): number | null {
  const s = Number(heightStories)
  if (Number.isFinite(s) && s > 0) return s
  return resolveDenver(zone, { formerChapter59: isFormerChapter59(zone, description) }).stories ?? null
}

// Whether the DZC imposes NO FAR on this district (a known absence) as opposed
// to us simply not resolving one. Both previously surfaced as `maxFAR: null`,
// which made defaultSpec fall back to an unsourced FAR-1.0 assumption on every
// Denver parcel. Former-Chapter-59 and unrecognised codes stay unresolved.
function denverFarUnconstrained(zone: string | null, description?: unknown): boolean {
  return resolveDenver(zone, { formerChapter59: isFormerChapter59(zone, description) }).farUnconstrained === true
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
  const deadline = requestDeadline()
  // REQUIRED reads go through readRequired; OPTIONAL ones keep allSettled. See
  // the contract at the top of ../requiredUpstream.ts.
  const [parcelR, zoningR, optional] = await Promise.all([
    // maxAttempts 2, not 3: fetchParcelSnap already retries its exact query
    // internally, so three outer attempts would be up to six queries.
    readRequired(
      'parcel',
      (t) =>
        fetchParcelSnap(
          PARCELS,
          lat,
          lng,
          [
            'SITUS_ADDRESS_LINE1',
            'LAND_AREA',
            'SCHEDNUM',
            'D_CLASS_CN',
            'APPRAISED_IMP_VALUE',
            'COM_ORIG_YEAR_BUILT',
            'RES_ORIG_YEAR_BUILT',
            'OWNER_NAME',
          ],
          false,
          undefined,
          30,
          t,
        ),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired(
      'zoning',
      (t) =>
        fetchParcelSnap(
          ZONING,
          lat,
          lng,
          ['ZONE_DISTRICT', 'ZONE_DESCRIPTION', 'OVERLAY_DISTRICT', 'HEIGHT_STORIES'],
          false,
          undefined,
          30,
          t,
        ),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    Promise.allSettled([
      fetchFeatures(HISTORIC, lat, lng, ['DIST_NAME']),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
      fetchFeatures(EHA, lat, lng, ['MarketArea']),
    ]),
  ])
  const [histR, floodR, ehaR] = optional

  // THE STATE SPLIT — a failed fetch refuses; an empty answer is still an answer.
  if (!parcelR.ok || !zoningR.ok) {
    return upstreamUnavailable('denver', 'Denver', [parcelR, zoningR], t0)
  }

  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['SCHEDNUM', 'LAND_AREA'], 'denver')
  warnIfMissing(firstAttrs(zoningR.value), ['ZONE_DISTRICT', 'HEIGHT_STORIES'], 'denver')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED.
  const zoning = firstAttrs(zoningR.value)
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null
  const eha = ehaR.status === 'fulfilled' ? firstAttrs(ehaR.value) : null
  const feeArea = eha?.MarketArea ? String(eha.MarketArea).trim() : undefined
  // The EHA read is OPTIONAL — a market-area outage should not refuse a Denver
  // parcel whose zoning, envelope and timeline all resolved, and residential
  // parcels never consult it. But its absence is priced: `estimates.ts` charged
  // the Typical rate whenever `feeArea` was undefined, so a timeout removed
  // $307,000 from a published total (measured 2026-08-12, 100,000 sf D-C at
  // Union Station: $921,000 → $614,000). Mark the GAP so the fee can be left
  // unpriced and disclosed instead of guessed — CLAUDE.md rule 5's corollary,
  // handled by recording the failure rather than by refusing the response.
  const feeAreaUnresolved = ehaR.status !== 'fulfilled'

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
    ...recordAddress(address),
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
      ...(denverMaxStories(code, zoning?.HEIGHT_STORIES, zoning?.ZONE_DESCRIPTION) != null
        ? { maxStories: denverMaxStories(code, zoning?.HEIGHT_STORIES, zoning?.ZONE_DESCRIPTION) }
        : {}),
    },
    lot: {
      sizeSqFt: Number.isFinite(land) && land > 0 ? Math.round(land) : null,
      lotType: null,
    },
    overlays: {
      historicDistrict: hist?.DIST_NAME ? String(hist.DIST_NAME) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      feeArea,
      // Three marks, one call — the fee-area gap above plus the two overlays
      // whose null makes a hurdle (and its months) disappear rather than a
      // dollar figure move. See `lib/unresolvedOverlays.ts`.
      ...unresolvedOverlays({
        feeArea: feeAreaUnresolved,
        historic: !hist?.DIST_NAME && readFailed(histR),
        flood: readFailed(floodR),
      }),
    },
    existing,
    sources: { parcels: PARCELS, zoning: ZONING, historic: HISTORIC, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'denver', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
