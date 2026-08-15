// Seattle provider — Seattle GeoData zoning + King County parcel boundaries
// (ADDRESS + SQFTLOT fields). Verified 2026-05-29.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, warnIfMissing, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { resolveSeattle, SEATTLE_INSIDE_CENTER_TYPES, type SeattleCenter } from '../zoning/seattle'
import { recordAddress } from '../address'

const ORG = 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services'
const ZONING = `${ORG}/Current_Land_Use_Zoning_Detail_2/FeatureServer/0`
const PARCELS = `${ORG}/Parcel_Boundary/FeatureServer/0`
// All zoning overlays; we keep only TYPE=HISTORIC (e.g. Pioneer Square, Pike Place).
const HISTORIC = `${ORG}/Zoning_Overlays-Historic-Special_Review_Districts/FeatureServer/23`
// MHA fee area (Low / Medium / High / Downtown-SLU) — drives the affordable-housing
// payment rate, so we surface it for a parcel-aware fee note.
const MHA = `${ORG}/MHA_Fee_Areas_1/FeatureServer/0`
// Regional / urban centre boundaries — SMC Table A for 23.45.510 splits LR3 on
// whether the lot is inside one, and the two MHA figures differ by 28% (1.8 vs
// 2.3). Adopted by Ordinance 127375, effective 2026-01-21.
//
// OPTIONAL, and its failure costs only the LR3-with-MHA base: ../zoning/
// seattle.ts refuses that row without a boundary rather than picking one. Every
// other multifamily row resolves without it.
const CENTERS =
  'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Centers_Boundaries_2044/FeatureServer/0'

function seattleHistoricName(features: Array<{ attributes: Record<string, unknown> }> | undefined): string | null {
  const f = features?.find((x) => String(x.attributes.TYPE ?? '').toUpperCase() === 'HISTORIC')
  if (!f) return null
  const name = String(f.attributes.DESCRIPTION ?? '').trim()
  return name || null
}

const DOWNTOWN = ['DOC', 'DMC', 'DRC', 'DMR', 'DH', 'PMM', 'IDM', 'IDR', 'PSM']
const INDUSTRIAL = ['IB', 'IG', 'IC']

// Seattle zoning code prefix → use vocabulary.
// Seattle encodes the height limit (feet) right in the zone code: NC1-55 → 55,
// DRC 85-170 → 170 (max), SM-U 95-320 → 320, DMC 340/290-440 → 440. Take the
// largest plausible height number in the string as the max. Lowrise/Midrise/
// Highrise tiers without a number get the SMC base-height by tier.
function seattleMaxHeightFt(zone: string | null): number | null {
  if (!zone) return null
  const z = zone.toUpperCase()
  // Industrial "U/##" (e.g. IG1 U/85) means height is UNLIMITED for industrial
  // uses; the number only caps non-industrial. Don't report the number as the
  // max — return null (no by-right cap) rather than a wrongly-low height.
  if (/\bU\s*\//.test(z)) return null
  // Seattle writes the base-zone height as the TRAILING number ("NC3-65",
  // "MIO-105-NC3-65"). Math.max over every number wrongly returned the MIO
  // institutional-overlay height (105) instead of the by-right base (65) on
  // layered zones — overstating the envelope for non-institutional projects.
  const nums = (z.match(/\d{2,3}/g) ?? []).map(Number).filter((n) => n >= 25 && n <= 1000)
  if (nums.length) return nums[nums.length - 1]
  if (/\bLR1\b/.test(z)) return 30
  if (/\bLR2\b/.test(z)) return 40
  if (/\bLR3\b/.test(z)) return 50
  if (/\bMR\b/.test(z)) return 85
  if (/\bHR\b/.test(z)) return 240
  return null
}

function usesForZone(zone: string | null): string[] | null {
  if (!zone) return null
  const z = zone.trim().toUpperCase()
  if (DOWNTOWN.some((p) => z.startsWith(p))) return ['commercial', 'mixed', 'residential', 'institutional']
  if (z.startsWith('SM') || z.startsWith('NC')) return ['commercial', 'mixed', 'residential']
  if (z.startsWith('C1') || z.startsWith('C2') || z.startsWith('C ')) return ['commercial', 'mixed', 'residential']
  if (z.startsWith('MIO')) return ['institutional']
  if (INDUSTRIAL.some((p) => z.startsWith(p))) return ['commercial', 'institutional']
  if (z.startsWith('SF') || z.startsWith('RSL') || z.startsWith('LR') || z.startsWith('MR') || z.startsWith('HR'))
    return ['residential']
  return null
}

export async function getSeattleParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  const deadline = requestDeadline()
  // REQUIRED reads go through readRequired; OPTIONAL ones keep allSettled. See
  // the contract at the top of ../requiredUpstream.ts.
  const [parcelR, zoningR, optional] = await Promise.all([
    // maxAttempts 2, not 3: fetchParcelSnap already retries its exact query
    // internally, so three outer attempts would be up to six queries.
    readRequired(
      'parcel',
      (t) => fetchParcelSnap(PARCELS, lat, lng, ['PIN', 'ADDRESS', 'SQFTLOT', 'PRES_USE_DESC'], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired('zoning', (t) => fetchParcelSnap(ZONING, lat, lng, ['ZONING'], false, undefined, 30, t), {
      deadline,
      maxAttempts: 2,
      attemptCapMs: 4000,
    }),
    Promise.allSettled([
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
      fetchFeatures(HISTORIC, lat, lng, ['OVERLAY', 'DESCRIPTION', 'TYPE']),
      fetchFeatures(MHA, lat, lng, ['FEE_AREA']),
      fetchFeatures(CENTERS, lat, lng, ['PLACE_TYPE_NAME']),
    ]),
  ])
  const [floodR, histR, mhaR, centersR] = optional

  // THE STATE SPLIT — a failed fetch refuses; an empty answer is still an answer.
  if (!parcelR.ok || !zoningR.ok) {
    return upstreamUnavailable('seattle', 'Seattle', [parcelR, zoningR], t0)
  }

  const parcel = firstAttrs(parcelR.value)
  warnIfMissing(parcel, ['PIN', 'SQFTLOT'], 'seattle')
  warnIfMissing(firstAttrs(zoningR.value), ['ZONING'], 'seattle')
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED.
  const zoning = firstAttrs(zoningR.value)
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // Trim FIRST, then fall back — a whitespace-only ADDRESS is truthy but renders
  // a blank headline, so guard on the trimmed value.
  const addressed = recordAddress(parcel.ADDRESS)
  const sqft = Number(parcel.SQFTLOT)
  const zone = zoning?.ZONING ? String(zoning.ZONING) : null

  // THREE STATES, and the middle one is a real answer:
  //   undefined — the read FAILED, so "inside" cannot be ruled out.
  //   'outside'  — the layer ANSWERED and no Regional/Urban Center covers the
  //                point. Note a Neighborhood Center is NOT one of the two the
  //                code names, so it lands here.
  //   'inside'   — a Regional Center or Urban Center covers it.
  const centerType: SeattleCenter =
    centersR.status !== 'fulfilled'
      ? undefined
      : SEATTLE_INSIDE_CENTER_TYPES.includes(
            String(firstAttrs(centersR.value)?.PLACE_TYPE_NAME ?? '').trim().toUpperCase(),
          )
        ? 'inside'
        : 'outside'
  const seaLimits = resolveSeattle(zone, centerType)


  const info: ParcelInfo = {
    ...addressed,
    parcelId: String(parcel.PIN ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: zone ?? 'Unknown',
      subdistrict: null,
      article: null,
      maxHeightFt: seattleMaxHeightFt(zone),
      // SMC 23.47A.013 Table A publishes NC/C FAR as a function of the
      // height-limit suffix, and lib/zoning/seattle.ts already encodes it —
      // resolveZoningLimits layers it in, so the ENVELOPE was always correct.
      // This field was left null anyway, so /api/parcel and the UI reported "no
      // FAR" for a parcel whose floor area had been computed from FAR 4.5.
      // Surfacing the same sourced value keeps the response self-consistent.
      // Returns null outside NC/C and NR (LR/MR/HR and SM have their own
      // tables and are not read yet).
      //
      // NR carries ALTERNATIVES rather than a single ratio: SMC Table A for
      // 23.44.050 keys the FAR to the density of the proposed development, so
      // the least-dense row is the headline and the denser rows are choices the
      // applicant has not made (rule 6). It also carries a 2,500 sq ft
      // small-lot floor from § 23.44.050.B.
      maxFAR: seaLimits.far,
      ...(seaLimits.farAlternatives?.length ? { farAlternatives: [...seaLimits.farAlternatives] } : {}),
      ...(seaLimits.farFloorSqFt != null ? { farFloorSqFt: seaLimits.farFloorSqFt } : {}),
      allowedUses: usesForZone(zone),
    },
    lot: {
      sizeSqFt: Number.isFinite(sqft) && sqft > 0 ? sqft : null,
      lotType: null,
    },
    overlays: {
      historicDistrict: histR.status === 'fulfilled' ? seattleHistoricName(histR.value.features) : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      feeArea: mhaR.status === 'fulfilled' ? (firstAttrs(mhaR.value)?.FEE_AREA ? String(firstAttrs(mhaR.value)!.FEE_AREA).trim() : undefined) : undefined,
      // A failed MHA read is not "no fee area": the rate published for this
      // parcel differs by area ($10.78–$50.46/sq ft residential across the
      // published table), and defaulting silently to the Medium midpoint moved
      // a measured "High Areas" parcel from $45/sq ft to $28/sq ft. Out of the
      // total either way, so the mark exists to stop the LABEL asserting a rate
      // nothing measured — not to change any dollar in `costs`.
      //
      // The other two marks are the opposite shape: their null does not move a
      // number, it removes a hurdle and the months it carries. See
      // `lib/unresolvedOverlays.ts`.
      ...unresolvedOverlays({
        feeArea: readFailed(mhaR),
        historic: readFailed(histR),
        flood: readFailed(floodR),
      }),
    },
    existing: {
      landUse: parcel.PRES_USE_DESC ? String(parcel.PRES_USE_DESC).trim() : null,
    },
    sources: { zoning: ZONING, parcels: PARCELS, flood: ENDPOINTS.flood, historic: HISTORIC },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'seattle', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
