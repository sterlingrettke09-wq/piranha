// Washington, DC provider — DCGIS parcels (Owner/Common Ownership polygons) +
// DC Office of Zoning "Specific Zone" + Historic District. Verified live
// 2026-06-01. All three layers accept inSR=4326 point queries.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { isGovernmentOwner } from '../../../../src/lib/developability'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { recordAddress } from '../address'

const BASE = 'https://maps2.dcgis.dc.gov/dcgis/rest/services'
const PARCELS = `${BASE}/DCGIS_DATA/Property_and_Land/MapServer/40`
const ZONING = `${BASE}/DCOZ/Zone_Mapservice/MapServer/24`
const HISTORIC = `${BASE}/DCOZ/Zone_Mapservice/MapServer/6`

// Max height (ft) + FAR by zone, from the 2016 Zoning Regulations (Title 11
// DCMR): Subtitle D (R), E (RF), F (RA), G (MU). High-confidence families only;
// Downtown (D) and Neighborhood (NC) zones vary by sub-area/street and are left
// null (honest — no by-right envelope shown). Heights exclude penthouse.
//
// ⚠️ `f: null` USED TO MEAN TWO DIFFERENT THINGS HERE, which is rule 5's exact
// failure. RF-1 has no FAR because the code imposes none (an ANSWER); D-4 has no
// FAR because it varies by sub-area and we have not resolved it (a GAP). Both
// rendered identically, so DC never got the `farUnconstrained` separation that
// SF §124(b) and Denver's form-based DZC already had.
//
// `noFar` now marks the verified stated absences. It is set ONLY where the
// primary source was read — not on the strength of this comment, which is the
// trap rule 15 describes. Verified 2026-08-05 against the DC Office of Zoning
// PDFs of Title 11:
//
//   Subtitle D ch. 3 (R-1-A, R-1-B, R-2, R-3): sections run 300–310 with NO FAR
//     section. § 303.1 verbatim: "The maximum permitted building height, not
//     including the penthouse, in the R-1-A, R-1-B, R-2, and R-3 zones shall not
//     exceed forty feet (40 ft.) and the number of stories shall not exceed
//     three (3) stories."  Controlled by lot dimensions (§ 302), height (§ 303)
//     and lot occupancy (§ 304).
//   Subtitle E ch. 3/4/5 (RF-1, RF-2, RF-3): each runs 300/400/500–308/408/508
//     with NO FAR section; the parallel slot is "MAXIMUM NUMBER OF DWELLING
//     UNITS". RF-1 § 303.1 = 35 ft and 3 stories; § 302.1 = 2 units; § 304.1 =
//     60% lot occupancy.
//   Subtitle E ch. 6 (RF-4, RF-5) DOES have § 602 "FAR AND MAXIMUM NUMBER OF
//     DWELLING UNITS". § 602.1 verbatim: "The maximum permitted floor area ratio
//     (FAR) for all buildings and structures in the RF-4 and RF-5 zones shall be
//     1.8."  § 603.1 RF-4 = 40 ft / 3 stories; § 603.2 RF-5 = 50 ft / 4 stories
//     for row dwellings and flats (40 ft / 3 stories for detached).
//
// The structural tell is that the FAR section EXISTS exactly where FAR applies.
//
// NOT verified tonight: the RA (Subtitle F) and MU (Subtitle G) numbers below.
// They already carry a FAR so the three-state split does not touch them, but
// they remain a table whose provenance is a comment.
//
// `s` carries a story count the code STATES, so the envelope never divides feet
// by an 11 ft/story constant the code does not use (rule 12).
interface DcLimit {
  h: number | null
  f: number | null
  /** The code affirmatively imposes NO floor-area ratio here — an ANSWER, not a
   *  missing lookup. Absent means unknown, which stays a gap and fails closed. */
  noFar?: true
  /** Story count as STATED by the code, where it states one. */
  s?: number
  /** Section the absence or figure was read from. */
  cite?: string
}
const DC_LIMITS: Record<string, DcLimit> = {
  'RF-1': { h: 35, f: null, noFar: true, s: 3, cite: '11 DCMR Subtitle E § 303.1 (no FAR section in ch. 3)' },
  'RF-2': { h: 35, f: null, noFar: true, cite: '11 DCMR Subtitle E ch. 4 (no FAR section)' },
  'RF-3': { h: 35, f: null, noFar: true, cite: '11 DCMR Subtitle E ch. 5 (no FAR section)' },
  'RF-4': { h: 40, f: 1.8, s: 3, cite: '11 DCMR Subtitle E §§ 602.1, 603.1' },
  'RF-5': { h: 50, f: 1.8, s: 4, cite: '11 DCMR Subtitle E §§ 602.1, 603.2(b)' },
  // RA — Subtitle F Table § 302.1 (FAR) and Table § 303.1 (height/stories).
  // All five confirmed 2026-08-05 against the published PDF; every figure below
  // already matched. RA-5 also reads "6.0 for an apartment house or hotel" — the
  // base 5.0 is kept because the larger number assumes a program the user has
  // not chosen (rule 6); it is recorded as an alternative, not raised.
  'RA-1': { h: 40, f: 0.9, s: 3, cite: '11 DCMR Subtitle F §§ 302.1, 303.1' },
  'RA-2': { h: 50, f: 1.8, cite: '11 DCMR Subtitle F §§ 302.1, 303.1' },
  'RA-3': { h: 60, f: 3.0, cite: '11 DCMR Subtitle F §§ 302.1, 303.1' },
  'RA-4': { h: 90, f: 3.5, cite: '11 DCMR Subtitle F §§ 302.1, 303.1' },
  'RA-5': { h: 90, f: 5.0, cite: '11 DCMR Subtitle F §§ 302.1, 303.1 (6.0 for an apartment house or hotel)' },

  // MU — Subtitle G Table § 302.1 (MU-1/2), Table § 402.1 (MU-3…10) and the
  // matching height tables.
  //
  // ⚠️ FOUR OF THESE WERE WRONG, and the shape says how: our MU-6/7/8 each held
  // the code's MU-7/8/9 figure — an off-by-one transcription slip down the FAR
  // column. MU-7 published 5.0 against a code figure of 4.0 and MU-8 published
  // 6.5 against 5.0, both OVERSTATING buildable area by 25–30% and flowing
  // straight into cost, unit counts and impact fees. MU-6 and MU-9 understated.
  // Caught only by reading Subtitle G; the table was internally plausible,
  // type-checked and covered by tests that asserted it equalled itself.
  //
  // MU-5 was wrong differently: the code splits MU-5-A (65 ft) and MU-5-B
  // (75 ft), which share FAR 3.5 but NOT height. A single `MU-5` at 70 ft
  // matched neither, and the lettered-parent fallback would have kept hiding it.
  // Both spellings are keyed — the code writes MU-5-A, the GIS writes MU-5A.
  //
  // The `(IZ)` rows in both tables are Inclusionary Zoning BONUS tiers (MU-1
  // 4.0 → 4.8, MU-7 4.0 → 4.8, MU-10 90 ft → 100 ft). They are earned by
  // committing to affordable units, so the base is the by-right figure and the
  // bonus is not carried (rule 6). Their existence does confirm that
  // `IZ_Designation` — published per polygon, still unfetched — is a real joint
  // dependency for anyone who later models the bonus.
  'MU-1': { h: 65, f: 4.0, cite: '11 DCMR Subtitle G §§ 302.1, 303.1' },
  'MU-2': { h: 90, f: 6.0, cite: '11 DCMR Subtitle G §§ 302.1, 303.1' },
  'MU-3': { h: 40, f: 1.0, s: 3, cite: '11 DCMR Subtitle G §§ 402.1, 403.1' },
  'MU-4': { h: 50, f: 2.5, cite: '11 DCMR Subtitle G §§ 402.1, 403.1' },
  'MU-5-A': { h: 65, f: 3.5, cite: '11 DCMR Subtitle G §§ 402.1, 403.1' },
  'MU-5A': { h: 65, f: 3.5, cite: '11 DCMR Subtitle G §§ 402.1, 403.1' },
  'MU-5-B': { h: 75, f: 3.5, cite: '11 DCMR Subtitle G §§ 402.1, 403.1' },
  'MU-5B': { h: 75, f: 3.5, cite: '11 DCMR Subtitle G §§ 402.1, 403.1' },
  'MU-6': { h: 90, f: 6.0, cite: '11 DCMR Subtitle G §§ 402.1, 403.1' },
  'MU-7': { h: 65, f: 4.0, cite: '11 DCMR Subtitle G §§ 402.1, 403.1' },
  'MU-8': { h: 70, f: 5.0, cite: '11 DCMR Subtitle G §§ 402.1, 403.1' },
  'MU-9': { h: 90, f: 6.5, cite: '11 DCMR Subtitle G §§ 402.1, 403.1' },
  'MU-10': { h: 90, f: 6.0, cite: '11 DCMR Subtitle G §§ 402.1, 403.1' },
}
export function dcLimits(code: string | null): DcLimit {
  if (!code) return { h: null, f: null }
  const base = code.toUpperCase().trim().split('/')[0].trim()
  // An overlay suffix (`R-1A/FH`, `RF-1/CAP`, `R-3/NO`…) means the parcel is in
  // a base zone PLUS an overlay in Subtitle C/W that we have not read. The base
  // zone's verified "no FAR" is a fact about the base zone only; whether an
  // overlay can impose a floor-area limit where the base imposes none is
  // unresolved, so `noFar` is withheld and the parcel falls to a gap. Dropping
  // a verdict is the safe direction; asserting one across an unread overlay is
  // not. Heights and FARs still resolve from the base.
  const hasOverlay = code.includes('/')
  const strip = (l: DcLimit): DcLimit => (hasOverlay && l.noFar ? { ...l, noFar: undefined } : l)
  // Georgetown overlay caps at 35 ft. The FAR under it is NOT resolved — this is
  // a height override, so it must not inherit a `noFar` from the base zone.
  if (/\/GT|GEORGETOWN/i.test(code)) return { h: 35, f: null }
  if (DC_LIMITS[base]) return strip(DC_LIMITS[base])
  // Lettered sub-zones (MU-7A, MU-7B, RA-4A…) share their numbered parent's
  // limits closely enough; fall back to the parent rather than returning null.
  const parent = base.replace(/([0-9])[A-Z]+$/, '$1')
  if (parent !== base && DC_LIMITS[parent]) return strip(DC_LIMITS[parent])
  // Residential House (R) zones — Subtitle D ch. 3 has no FAR section at all;
  // § 303.1 states 40 ft AND three stories for R-1-A/R-1-B/R-2/R-3. Note the
  // code hyphenates as `R-1-A` while the GIS publishes `R-1A`; the prefix test
  // covers both. Verified against the Subtitle D PDF, not inferred.
  if (base.startsWith('R-') || /^R\d/.test(base)) {
    return strip({ h: 40, f: null, noFar: true, s: 3, cite: '11 DCMR Subtitle D § 303.1 (no FAR section in ch. 3)' })
  }
  return { h: null, f: null }
}

// DC zoning code prefix → use vocabulary. Codes follow the 2016 Zoning
// Regulations (e.g. R-, RF-, RA-, MU-, NC-, PDR-, D-, US-, StE-).
function usesForZone(code: string | null): string[] | null {
  if (!code) return null
  const z = code.trim().toUpperCase()
  if (z.startsWith('MU') || z.startsWith('NC') || z.startsWith('D-') || z.startsWith('GA') || z.startsWith('CG'))
    return ['commercial', 'mixed', 'residential']
  if (z.startsWith('PDR')) return ['commercial', 'institutional']
  if (z.startsWith('US') || z.startsWith('STE') || z.startsWith('UNT')) return ['institutional']
  if (z.startsWith('R-') || z.startsWith('RF') || z.startsWith('RA') || z.startsWith('RC'))
    return ['residential']
  return null
}

export async function getDcParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
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
          ['PREMISEADD', 'SSL', 'LANDAREA', 'USECODE', 'SALETYPE', 'CLASSTYPE', 'OWNERNAME'],
          false,
          undefined,
          30,
          t,
        ),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired(
      'zoning',
      (t) => fetchParcelSnap(ZONING, lat, lng, ['ZONING', 'ZR16', 'Zone_District'], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    Promise.allSettled([
      fetchFeatures(HISTORIC, lat, lng, ['HistDistrict_NAME']),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    ]),
  ])
  const [histR, floodR] = optional

  // THE STATE SPLIT — a failed fetch refuses; an empty answer is still an answer.
  if (!parcelR.ok || !zoningR.ok) {
    return upstreamUnavailable('dc', 'Washington, DC', [parcelR, zoningR], t0)
  }

  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['SSL', 'LANDAREA'], 'dc')
  warnIfMissing(firstAttrs(zoningR.value), [['Zoning', 'ZONING', 'ZR16']], 'dc')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED.
  const zoning = firstAttrs(zoningR.value)
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // PREMISEADD includes city/state/zip; keep just the street portion.
  const rawAddr = parcel.PREMISEADD ? String(parcel.PREMISEADD).trim() : ''
  const address = rawAddr ? rawAddr.split(/\s+WASHINGTON\s+DC/i)[0].trim() : 'Selected location'
  const land = Number(parcel.LANDAREA)
  // The live service returns the field as `Zoning` (not `ZONING`); fall back
  // across casings and to the 2016-code field ZR16.
  const zCode = zoning?.Zoning ?? zoning?.ZONING ?? zoning?.ZR16
  const code = zCode != null && String(zCode).trim() ? String(zCode).trim() : null
  // `Zoning` and `ZR16` agree on 974 of 977 polygons (measured live 2026-08-05).
  // On the three that disagree the two columns name DIFFERENT zones — one pair
  // is MU-2 vs MU-3A, which is FAR 6.0 against 1.0. Nothing in the layer says
  // which column is authoritative, so picking either publishes a confident
  // number on a 6× ambiguity. Fail closed instead: keep the district label for
  // display, withhold the envelope, and let the gap disclose itself.
  const zr16 = zoning?.ZR16 != null ? String(zoning.ZR16).trim() : ''
  const ambiguousDistrict = code != null && zr16 !== '' && zr16.toUpperCase() !== code.toUpperCase()
  const lim = ambiguousDistrict ? { h: null, f: null } : dcLimits(code)

  // Existing structure: SALETYPE "Improved" means a building stands here (vs
  // vacant land). CLASSTYPE's leading digit gives a coarse use (1 residential,
  // 2 commercial, 5 institutional/exempt). No floor area or year in this layer.
  //
  // USECODE is more specific and is the key signal for landmark/special sites:
  // 082=hospital, 083=university, 087/089=stadium/arena/exhibition. These large
  // tax-exempt parcels usually have a null SALETYPE, so we surface their use from
  // USECODE directly (which the "special site" flag then picks up).
  const useCode = parcel.USECODE != null ? String(parcel.USECODE).trim() : ''
  const ssl = parcel.SSL != null ? String(parcel.SSL).trim() : ''
  // Federal / public land that zoning often bleeds ordinary R/C codes over:
  // an SSL beginning "RES" is a federal Reservation (the Mall, traffic circles
  // like Logan Circle, monument grounds); USECODE 086 = federal building (e.g.
  // the Library of Congress), 191 = public reservation. Label these so the
  // developability gate ("federal"/"public land") hard-blocks them.
  const isFederalLand = /^RES\b/i.test(ssl) || useCode === '086' || useCode === '191'
  const USECODE_LANDUSE: Record<string, string> = {
    '082': 'Hospital',
    '083': 'University / college',
    '087': 'Stadium / arena',
    '089': 'Arena / exhibition hall',
  }
  const useCodeLabel = USECODE_LANDUSE[useCode] ?? null
  const saleType = parcel.SALETYPE ? String(parcel.SALETYPE) : ''
  const classDigit = parcel.CLASSTYPE ? String(parcel.CLASSTYPE).trim().charAt(0) : ''
  const dcUse = isFederalLand
    ? 'Federal or other public land'
    : useCodeLabel ?? (({ '1': 'Residential', '2': 'Commercial', '5': 'Institutional' } as Record<string, string>)[classDigit] ?? null)
  // OWNERNAME used only to derive a government-owned boolean (no name stored).
  const ownerPublic = isGovernmentOwner(parcel.OWNERNAME != null ? String(parcel.OWNERNAME) : null)
  const existingBase =
    isFederalLand || /improv/i.test(saleType) || useCodeLabel ? { landUse: dcUse, numBuildings: 1 } : undefined
  const existing = ownerPublic ? { ...(existingBase ?? {}), ownerPublic: true } : existingBase

  const info: ParcelInfo = {
    ...recordAddress(address),
    parcelId: String(parcel.SSL ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: code ?? 'Unknown',
      subdistrict: null,
      article: zoning?.Zone_District ? String(zoning.Zone_District) : null,
      maxHeightFt: lim.h,
      maxFAR: lim.f,
      // A verified stated absence, not a failed lookup — keeps the verdict from
      // being withheld on districts whose code affirmatively imposes no FAR.
      ...(lim.noFar ? { farUnconstrained: true } : {}),
      // Carry the code's OWN story count where it states one, so the envelope
      // does not divide feet by an ft/story constant the code never used.
      ...(lim.s != null ? { maxStories: lim.s } : {}),
      allowedUses: usesForZone(code),
    },
    lot: {
      sizeSqFt: Number.isFinite(land) && land > 0 ? Math.round(land) : null,
      lotType: null,
    },
    overlays: {
      historicDistrict: hist?.HistDistrict_NAME ? String(hist.HistDistrict_NAME) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      // A failed optional read is NOT "nothing here". Left as a bare null, the
      // hurdle each field triggers silently disappears along with the months it
      // carries — see `lib/unresolvedOverlays.ts` and the "could not be checked"
      // rows in `hurdles.ts`.
      ...unresolvedOverlays({
        historic: !hist?.HistDistrict_NAME && readFailed(histR),
        flood: readFailed(floodR),
      }),
    },
    existing,
    sources: { parcels: PARCELS, zoning: ZONING, historic: HISTORIC, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'dc', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
