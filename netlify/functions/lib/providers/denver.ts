// Denver provider — City & County of Denver Zoning service (parcels at /0,
// zoning at /1) + Open Data historic landmark districts. Verified live
// 2026-06-01. All accept inSR=4326 point queries.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { resolveDenver, DENVER_FT_PER_STORY, DENVER_PROTECTED_DISTRICTS, denverProtectedDistrictRule, denverHeightNearProtected } from '../zoning/denver'
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
// FAR comes from that module too. It was hardcoded null here under a claim true
// only of Articles 3-7 — see denverMaxFAR() for what that cost.
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
/** The layer's own marker for a district that is not a current DZC one. Every
 *  Former Chapter 59 district carries it and no DZC district does — measured
 *  2026-08-15 across all 184 distinct ZONE_DISTRICT values: 76 carry '999' and
 *  108 do not, and the split is exactly legacy vs DZC. */
// ⚠️ 999 IS "NO BUILDING FORM", NOT "FORMER CHAPTER 59". Measured against the
// live layer 2026-08-17: ZONE_USE_FORM carries 12 distinct values, and eleven of
// them are the BUILDING FORM abbreviations from DZC Article 2's "Dominant
// Building Form" column — CC, SU, RO, RX, IMX, MHC, MS, MU, TU, MX, RH. Verified
// directly: S-MX-3 → "MX", G-MU-3 → "MU", U-SU-A → "SU", E-TU-B → "TU".
//
// 999 is the sentinel for a district that has no such form, and that set is
// WIDER than former Chapter 59. It also covers, each confirmed against the
// current code (June 25 2010 | Republished February 25 2025):
//   · Downtown  D-AS, D-C, D-CV, D-GT, D-LD, D-TD        Article 8
//   · Campus    CMP-H, CMP-H2, CMP-EI, CMP-EI2, CMP-NWC  Article 9 Div 9.2
//   · Industrial I-A, I-B                                Article 9 Div 9.1
//   · PUD       PUD, PUD-G                               Article 9 Div 9.6
//   · MHC       Manufactured Home Community                Article 9
//   · OpenSpace OS-A, OS-B, OS-C                        Article 9 Div 9.3
//     (the LEGACY open-space district is OS-1, which IS former Chapter 59)
//
// 1,452 of 3,775 polygons (38%) carry 999. Reading all of them as former
// Chapter 59 is an INTERPRETATION, it was recorded as a fix, and it is wrong —
// rule 15's shape, where a well-documented reading is the hardest to overturn.
//
// The outcome does not change today, because none of those current families is
// curated and both paths return unresolved. What changes is that a future
// curation of Campus or Downtown would have been silently suppressed by a flag
// asserting the district predates the 2010 code.
const NO_BUILDING_FORM = '999'

/** Current DZC families that also carry the 999 sentinel. Verified in Articles 8
 *  and 9 of the republished-2025 code, not inferred from the code's shape. */
const CURRENT_NON_FORM_FAMILIES = /^(D-|DIA$|CMP-|PUD(\b|-)|I-A$|I-B$|MHC$|OS-[ABC]$)/

/**
 * ⚠️ THE HYPHEN RULE MISSES 31 OF THE 76 LEGACY DISTRICTS, and the miss is not
 * harmless. `C-MU-20`, `C-MU-30`, `R-MU-20`, `R-MU-30`, `T-MU-30`, `C-CCN-4/5/
 * 7/8/12`, `D-AS-12+`, `D-AS-20+`, `B-8-A`, `R-2-A` and the rest all carry two
 * or more hyphens, so the shape test called them current DZC. For the ones
 * ending in a number the trailing token was then read as a STORY COUNT:
 * measured 2026-08-15, C-MU-30 published 30 stories and 360 feet, and
 * `farUnconstrained: true` on top — a fabricated height derived from a district
 * CLASS number, plus a false claim that no FAR applies to a code this repo
 * elsewhere records as one that "DID impose FAR in some districts".
 *
 * That is the same defect the B-3 note below describes, one heuristic later.
 * The lesson is that a code's SHAPE is a proxy; the layer publishes the fact
 * itself in ZONE_USE_FORM, so read the fact.
 *
 * The shape test is kept as a fallback for a missing field, and the layer's own
 * value wins whenever it is present.
 *
 * ⚠️ MEASURED 2026-08-17 against the live enumeration (184 distinct
 * ZONE_DISTRICT values): the shape test flags 41 of them, and AT LEAST 14 ARE
 * CURRENT DZC DISTRICTS, not former Chapter 59 —
 *
 *   CMP-EI · CMP-EI2 · CMP-H · CMP-H2 · CMP-NWC   Article 9, Division 9.2
 *   D-AS · D-C · D-CV · D-GT · D-LD · D-TD        Article 8
 *   I-A · I-B                                     Article 9, Division 9.1
 *   PUD-G                                         Article 9, Division 9.6
 *
 * each verified in the current code (June 25, 2010 | Republished February 25,
 * 2025). An earlier version of this comment claimed the fallback was right about
 * every district it caught; it is not, and the figure it named was never
 * measured against the layer.
 *
 * ⚠️ NO LONGER LATENT — updated 2026-08-17. This paragraph used to say the cost
 * was hypothetical because none of the fourteen was curated. Twelve of them now
 * are: Article 8's downtown districts and Article 9's I-A/I-B carry real
 * figures, so a parcel misrouted to the legacy path would have a correct entry
 * SUPPRESSED, and `farUnconstrained` — the claim that path is designed to
 * withhold — is exactly what several of them assert.
 *
 * What keeps that from happening is CURRENT_NON_FORM_FAMILIES above, tested
 * FIRST and short-circuiting before either the use-form field or the shape
 * fallback is consulted, so the fourteen never reach this heuristic at all. That
 * is the whole protection, it is one regex, and it is pinned by a test — which
 * is why the regex is written against families verified in the current code
 * rather than against the shape of their names (rule 27).
 */
export function isFormerChapter59(zone?: unknown, description?: unknown, useForm?: unknown): boolean {
  const z0 = String(zone ?? '').trim().toUpperCase()
  // A current district that merely lacks a building form is NOT legacy, however
  // the sentinel reads.
  if (CURRENT_NON_FORM_FAMILIES.test(z0)) return false
  if (useForm != null && String(useForm).trim() === NO_BUILDING_FORM) return true
  if (/former chapter 59/i.test(String(description ?? ''))) return true
  const z = String(zone ?? '').trim().toUpperCase()
  if (!z) return false
  // Two or more hyphens ⇒ a current DZC context-and-form code.
  if ((z.match(/-/g) ?? []).length >= 2) return false
  // Single-letter class + trailing token ⇒ legacy (B-3, O-1, R-2, R-X, PUD-4).
  return /^[A-Z]{1,3}-[0-9A-Z]+$/.test(z)
}

/**
 * Is any Protected District within the given distance of this parcel?
 *
 * THREE-STATE, and the third state is the point:
 *   true  — the layer answered and at least one Protected District polygon is
 *           within `withinFt` of the parcel.
 *   false — the layer answered and none is.
 *   null  — the query FAILED, or the parcel geometry was unavailable.
 *
 * ⚠️ A FAILED QUERY MUST NEVER RETURN false. The two answers produce different
 * heights — CMP-H is 75 ft inside the buffer and 200 ft outside — so collapsing
 * an unknown into "no protected district nearby" publishes the taller figure on
 * a parcel that may be capped at a third of it. That is the exact shape of the
 * defect this file already documents for `farUnconstrained`: an unknown wearing
 * the appearance of an established absence.
 *
 * Measured from the PARCEL GEOMETRY, not the query point. DZC Article 13
 * § 13.1-13.B caps "all portions of a Structure … within 175 feet of a Protected
 * District", so a point test on a large campus lot would miss a boundary the
 * rule reaches — under-detection, which is the flattering direction.
 *
 * MODULE-PRIVATE ON PURPOSE. It was exported briefly to verify both directions
 * against live parcels, and that is the only thing it was ever needed for from
 * outside. Every test of this behaviour goes through `getDenverParcelInfo` — a
 * reachable helper invites a test that calls it directly, which is precisely how
 * `CMP-NWC-R resolves to 40 ft` stayed green while no parcel could obtain it.
 */
async function protectedDistrictWithin(
  parcelGeometry: unknown,
  /** The FEATURE SET's spatial reference — the geometry object does not carry
   *  one. Denver returns Web Mercator (wkid 102100) unless outSR is requested,
   *  and declaring 4326 against those coordinates makes the query fail. It
   *  failed CLOSED, returning null rather than false, so no height was published
   *  off a broken query — but the answer was unobtainable until this was passed. */
  inSR: number | null | undefined,
  withinFt: number,
  timeoutMs?: number,
): Promise<boolean | null> {
  if (parcelGeometry == null || inSR == null) return null
  const codes = [...DENVER_PROTECTED_DISTRICTS].map((c) => `'${c.replace(/'/g, "''")}'`).join(',')
  const base = ZONING.endsWith('/') ? ZONING.slice(0, -1) : ZONING
  const u = new URL(base + '/query')
  u.searchParams.set('geometry', JSON.stringify(parcelGeometry))
  u.searchParams.set('geometryType', 'esriGeometryPolygon')
  u.searchParams.set('inSR', String(inSR))
  u.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
  u.searchParams.set('distance', String(withinFt))
  u.searchParams.set('units', 'esriSRUnit_Foot')
  u.searchParams.set('where', `ZONE_DISTRICT IN (${codes})`)
  u.searchParams.set('returnCountOnly', 'true')
  u.searchParams.set('f', 'json')
  try {
    const res = await fetch(u.toString(), {
      signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return null
    const j = (await res.json()) as { count?: number; error?: unknown }
    if (j.error || typeof j.count !== 'number') return null
    return j.count > 0
  } catch {
    return null
  }
}

function denverMaxHeightFt(
  zone: string | null,
  heightStories: unknown,
  description?: unknown,
  useForm?: unknown,
): number | null {
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
  const fromCode = resolveDenver(zone, { formerChapter59: isFormerChapter59(zone, description, useForm) })
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
function denverMaxStories(
  zone: string | null,
  heightStories: unknown,
  description?: unknown,
  useForm?: unknown,
): number | null {
  const s = Number(heightStories)
  if (Number.isFinite(s) && s > 0) return s
  return resolveDenver(zone, { formerChapter59: isFormerChapter59(zone, description, useForm) }).stories ?? null
}

/**
 * The FAR the DZC states for this district, where it states one.
 *
 * ⚠️ THIS WAS HARDCODED `null` UNTIL 2026-08-17, on a claim that read as settled:
 * "Denver's form-based code has no FAR". True of Articles 3-7, which was the
 * whole curated table when the line was written, and false the moment anything
 * outside them was encoded. `I-A` and `I-B` have carried FAR 2.0 in the zoning
 * module since Article 9 was read, and every live industrial parcel published
 * nothing — the module resolved a figure the provider then discarded.
 *
 * The Article 8 downtown work made it four more: D-C and D-TD at 10.0
 * (§ 8.3.1.4.D.1), D-GT at 8.0 (§ 8.6.3), D-AS at 4.0 (§ 8.7.1.3.D.1).
 *
 * Rule 11 in its quietest form. Nothing failed, no null was suspicious, and the
 * module's own tests were green throughout because they asserted the resolver's
 * return value — which was correct. The defect lived entirely in the caller.
 */
function denverMaxFAR(zone: string | null, description?: unknown, useForm?: unknown): number | null {
  return resolveDenver(zone, { formerChapter59: isFormerChapter59(zone, description, useForm) }).far
}

// Whether the DZC imposes NO FAR on this district (a known absence) as opposed
// to us simply not resolving one. Both previously surfaced as `maxFAR: null`,
// which made defaultSpec fall back to an unsourced FAR-1.0 assumption on every
// Denver parcel. Former-Chapter-59 and unrecognised codes stay unresolved.
function denverFarUnconstrained(zone: string | null, description?: unknown, useForm?: unknown): boolean {
  return resolveDenver(zone, { formerChapter59: isFormerChapter59(zone, description, useForm) }).farUnconstrained === true
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
          // GEOMETRY, for the Protected District buffer. DZC § 13.1-13.B caps
          // "all portions of a Structure … within 175 feet", so the distance is
          // measured from the PARCEL — a point test would miss a boundary the
          // rule reaches, which is the flattering direction.
          true,
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
          ['ZONE_DISTRICT', 'ZONE_DESCRIPTION', 'OVERLAY_DISTRICT', 'HEIGHT_STORIES', 'ZONE_USE_FORM'],
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
  let maxHeightFt = denverMaxHeightFt(code, zoning?.HEIGHT_STORIES, zoning?.ZONE_DESCRIPTION, zoning?.ZONE_USE_FORM)

  // ── PROTECTED DISTRICT BUFFER ─────────────────────────────────────────────
  //
  // A handful of districts publish a general maximum AND a lower cap within a
  // stated distance of a Protected District (CMP-H: 200 ft, but 75 ft within
  // 125 ft). Until that distance is known the height is not determinable, which
  // is why those districts resolved to nothing before this.
  //
  // The query runs ONLY for districts that carry such a rule — one extra request
  // on a small minority of Denver parcels, none on the rest.
  const bufferRule = denverProtectedDistrictRule(code)
  // The QUERY is gated on the rule — no rule, no reason to spend a request.
  const near = bufferRule
    ? await protectedDistrictWithin(
        (parcelR.value.features?.[0] as { geometry?: unknown } | undefined)?.geometry,
        (parcelR.value as { spatialReference?: { wkid?: number } }).spatialReference?.wkid,
        bufferRule.withinFt,
        4000,
      )
    : null
  // ⚠️ THE RESOLVER IS NOT GATED ON IT, and that distinction is the bug this
  // shape had. CMP-NWC-R is 40 ft flat — the only campus district with no
  // reduction — so its height does not depend on the distance at all. Running
  // the resolver only inside `if (bufferRule)` withheld a figure the code states
  // unconditionally, and the unit test asserting 40 ft passed the whole time
  // because it called this helper directly, which nothing on this path did
  // (rule 11: the test measured the layer, not the pipeline).
  //
  // ⚠️ `true` COLLAPSES TO `null` ON PURPOSE — it is not a missing case.
  // § 13.1-13.B caps "all portions of a Structure … within" the buffer, so on a
  // parcel that only partly overlaps it the limit VARIES ACROSS THE SITE and a
  // single maxHeightFt cannot express that. Publishing the reduced cap would
  // understate the far side; publishing the general one would overstate the near
  // side. Only the clean case — the whole parcel outside the buffer — yields a
  // figure this field can honestly carry, so a known-near parcel is routed to
  // the same refusal as an unresolved one.
  const resolved = denverHeightNearProtected(code, near === false ? false : null)
  if (resolved?.heightFt != null) maxHeightFt = resolved.heightFt

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
      maxFAR: denverMaxFAR(code, zoning?.ZONE_DESCRIPTION, zoning?.ZONE_USE_FORM),
      allowedUses: usesForZone(code),
      ...(denverFarUnconstrained(code, zoning?.ZONE_DESCRIPTION, zoning?.ZONE_USE_FORM) ? { farUnconstrained: true } : {}),
      // OS-A's form standards are set by City Council / the Manager of Parks
      // (DZC § 9.3.3.1), not published in a table — an answer, not a gap.
      ...(resolveDenver(code, {
        formerChapter59: isFormerChapter59(code, zoning?.ZONE_DESCRIPTION, zoning?.ZONE_USE_FORM),
      }).planGoverned
        ? { planGoverned: true }
        : {}),
      ...(denverMaxStories(code, zoning?.HEIGHT_STORIES, zoning?.ZONE_DESCRIPTION, zoning?.ZONE_USE_FORM) != null
        ? { maxStories: denverMaxStories(code, zoning?.HEIGHT_STORIES, zoning?.ZONE_DESCRIPTION, zoning?.ZONE_USE_FORM) }
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

/** THE PARCEL LAYER AND THE COLUMN THIS PROVIDER READS ITS ID FROM.
 *
 *  Exported rather than transcribed into a registry. The layer URLs here are
 *  built from per-file base constants, so any second copy would be a hand-typed
 *  duplicate of a fact this file already holds — and this repo has paid for that
 *  three times. The watchlist checker re-finds a stored parcel BY ID, which is a
 *  different query from the point-in-polygon the report uses, and it needs both
 *  halves from the one place that already knows them. */
export const PARCEL_SOURCE = { layer: PARCELS, idField: 'SCHEDNUM' } as const
