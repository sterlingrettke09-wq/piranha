// San Diego provider — SANDAG regional parcels + City of San Diego DSD zoning,
// historic resources, coastal overlays, and city-owned real property. Verified
// live 2026-08-03; all layers accept inSR=4326 point queries.
//
// ⚠️ NO OWNER NAME. Unlike every other city, San Diego publishes no owner field:
// the SANDAG parcel layer carries only an `ownerocc` occupancy FLAG, and the
// county's own parcel service requires a token. The government-owner gate
// therefore cannot work here. Instead we query the City Owned Real Property
// layer, which catches CITY land (parks, yards, civic buildings) — but NOT
// county, state, federal, port, or school-district land, so the curated civic
// hard-block list in src/lib/siteFlags.ts carries more weight in San Diego.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, firstFeature, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { polygonAreaSqFt } from '../geo'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { cityLimitsGate, cityLimitsSource, fetchCityLimits, outsideCity } from '../jurisdiction'
import { recordAddress } from '../address'
import { resolveSanDiego } from '../zoning/sandiego'

const PARCELS = 'https://geo.sandag.org/server/rest/services/Hosted/Parcels/FeatureServer/0'
// California State Plane Zone 6 (EPSG:2230), US survey feet — the parcel layer's
// native SR, so geometry comes back already in feet for the area calculation.
const CA_ZONE6_FT = 2230
const DSD = 'https://webmaps.sandiego.gov/arcgis/rest/services/DSD'
const ZONING = `${DSD}/Zoning_Base/MapServer/0`
const HISTORIC = 'https://webmaps.sandiego.gov/arcgis/rest/services/Planning/Historic_Preservation_Resources/MapServer/2'

// ── THE JURISDICTION GATE ─────────────────────────────────────────────────
// The parcel layer is SANDAG's REGIONAL fabric; the zoning layer is the City's.
// An empty zoning answer is a true fact about the point and is not sufficient to
// refuse on, because a fact rendered as a gap still publishes a costed report:
// measured at the real entry point 2026-08-12, Coronado, National City and La
// Mesa addresses inside SAN_DIEGO_BBOX all returned ok:true with a real lot area
// and 'Unknown'.
//
// The layer, the match and the refusal wording live in ../jurisdiction.ts,
// which carries one entry for every live city and records how each was
// established. It degrades OPEN on a failed fetch and reads the EXACT point,
// never a buffered snap.
const SAN_DIEGO_GATE = cityLimitsGate('sandiego')!

// Proposition D coastal height limit overlay (CHLOZ) — a real 30 ft cap.
const COASTAL_HEIGHT = `${DSD}/Zoning_Overlay/MapServer/1`
// City-owned real property — the only public ownership signal available.
const CITY_LAND = `${DSD}/Regulatory/MapServer/3`
// Statewide CA Coastal Zone (shared with the LA provider); confirmed to cover
// San Diego — a Coastal Development Permit is a real added approval.
const COASTAL_ZONE =
  'https://services9.arcgis.com/wwVnNW92ZHUIr0V0/arcgis/rest/services/Coastal_Zone_Polygon/FeatureServer/0'

/** SDMC §132.0505(a) (Chapter 13, 7-2024 printing): "Notwithstanding any section
 *  to the contrary, no building or addition to a building shall be constructed
 *  with a height in excess of thirty feet within the Coastal Zone of the City of
 *  San Diego." Codification of Proposition D (effective 12-7-1972); amended by
 *  Prop L (1988), Prop D (1998), Prop C (2000), Measure E (2020), O-21508 (2022)
 *  and O-21811 (eff. 7-11-2024) — every amendment carved out a geographic
 *  EXCEPTION area, none moved the thirty-foot figure.
 *
 *  Verified 2026-08-05 against docs.sandiego.gov/municode/municodechapter13/
 *  ch13art02division05.pdf. The figure is carried in FEET, as the code states it.
 *
 *  Which parcels are inside the overlay is NOT re-derived here: §132.0502(a)
 *  delegates the boundary to "Map No. C-380, filed in the office of the City
 *  Clerk", and the CHLOZ layer queried below is the City's own mapping of it.
 *  The §132.0505(b)(1)-(b)(4) exception areas are therefore honoured only to the
 *  extent that layer honours them — spot-probed 2026-08-05: downtown south of
 *  Laurel St (b)(1) and San Ysidro (b)(3) correctly return NO feature. */
export const COASTAL_HEIGHT_LIMIT_FT = 30

const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

// San Diego zone names (Land Development Code): RS/RM/RX residential,
// CC/CN/CV/CO/CR commercial, IL/IH/IP/IS industrial, OC/OP/OF open space,
// AG agricultural, plus planned districts (CCPD-*, GQPD-*, and other *PD-*).
export function usesForZone(zone: string | null): string[] | null {
  if (!zone) return null
  const z = zone.trim().toUpperCase()
  if (/^R[SMX]-/.test(z)) return ['residential']
  if (/^RT-/.test(z)) return ['residential']
  if (/^C[CNVOR]-/.test(z)) return ['commercial', 'mixed', 'residential']
  if (/^I[LHPS]-/.test(z)) return ['commercial', 'institutional']
  if (/^O[CPF]-/.test(z) || z.startsWith('OP-')) return ['institutional']
  if (/^AG-/.test(z) || z.startsWith('AR-')) return ['institutional']
  // Planned districts (downtown CCPD, Gaslamp GQPD, etc.) mix uses; their limits
  // come from a community plan rather than the base code.
  if (/PD-/.test(z)) return ['commercial', 'mixed', 'residential']
  return null
}

export async function getSanDiegoParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  // webmaps.sandiego.gov is a single-IP self-hosted ArcGIS Server that
  // intermittently aborts (verified 2026-08-03: ~1 in 3 calls timed out, both
  // serially and under load). Two mitigations, and they pull against each other:
  //   • Reliability: every webmaps layer uses the RETRYING snap fetcher, so a
  //     single abort doesn't blank the field.
  //   • Latency: they all run in ONE parallel batch. An earlier two-batch version
  //     was reliable but ran 10-12s end-to-end, over Netlify's 10s function kill —
  //     parallel keeps the total at the slowest single chain (~8s budget) instead
  //     of the sum.
  const deadline = requestDeadline()
  // REQUIRED reads go through readRequired; OPTIONAL ones keep allSettled. See
  // the contract at the top of ../requiredUpstream.ts. The parcel layer is
  // SANDAG's (regional) and the zoning layer is the City's, so an EMPTY zoning
  // answer is a real out-of-city fact — only a failed FETCH refuses here.
  // ⚠️ It is the boundary polygon (SAN_DIEGO_GATE) that refuses an out-of-city
  // point, not this emptiness; a comment here once implied the latter was
  // enough, and it published three neighbouring cities.
  const [parcelR, zoningR, cityLandR, optional] = await Promise.all([
    // maxAttempts 2: fetchParcelSnap already retries its exact query internally.
    readRequired(
      'parcel',
      (t) =>
        fetchParcelSnap(
          PARCELS,
          lat,
          lng,
          ['apn', 'situs_address', 'situs_street', 'situs_suffix', 'situs_zip', 'usable_sq_feet', 'asr_landuse', 'unitqty', 'total_lvg_area', 'asr_total'],
          true,
          CA_ZONE6_FT,
          30,
          t,
        ),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired('zoning', (t) => fetchParcelSnap(ZONING, lat, lng, ['ZONE_NAME'], false, undefined, 30, t), {
      deadline,
      maxAttempts: 2,
      attemptCapMs: 4000,
    }),
    // ⚠️ CITY-OWNED LAND IS REQUIRED, because it is this city's ONLY input to a
    // hard block. `ownerPublic` stops the analysis in `assessDevelopability`,
    // and San Diego derives it from nothing else — there is no owner name on any
    // layer we can reach (see the header). Read as optional, a timeout on this
    // one layer silently erased the government-ownership finding and published a
    // priced development scenario for a civic site, with nothing in the output
    // saying the check had not run. The invariant: ANY INPUT TO A HARD BLOCK
    // MUST COME FROM A READ THAT CAN REFUSE (../requiredUpstream.ts; inventory
    // pinned in ./hardBlockInputs.test.ts).
    //
    // Note what is NOT claimed: this layer still covers CITY land only, so a
    // successful empty answer remains a weak negative — county, state, federal,
    // port and school-district land are invisible to it, which is why the
    // curated civic list in src/lib/siteFlags.ts carries more weight here. An
    // incomplete signal is still a signal; a signal that did not run is not.
    readRequired(
      'city-owned land',
      (t) => fetchParcelSnap(CITY_LAND, lat, lng, ['COM_NAME', 'DES_USE', 'MG_DEPT'], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    Promise.allSettled([
      fetchCityLimits(SAN_DIEGO_GATE, lat, lng),
      fetchFeatures(HISTORIC, lat, lng, ['NAME', 'TYPE']),
      fetchParcelSnap(COASTAL_HEIGHT, lat, lng, ['ZONENAME']),
      fetchFeatures(COASTAL_ZONE, lat, lng, ['FID']),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
    ]),
  ])
  const [gateR, histR, chlozR, coastalR, floodR] = optional

  // Runs BEFORE the parcel is read and BEFORE the state split below.
  const outside = outsideCity('sandiego', gateR, t0)
  if (outside) return outside

  // THE STATE SPLIT — a failed fetch refuses; an empty answer is still an answer.
  if (!parcelR.ok || !zoningR.ok || !cityLandR.ok) {
    return upstreamUnavailable('sandiego', 'San Diego', [parcelR, zoningR, cityLandR], t0)
  }
  const parcelFeat = firstFeature(parcelR.value)
  const parcel = parcelFeat?.attributes ?? null
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning service ANSWERED.
  const zoning = firstAttrs(zoningR.value)
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const chloz = chlozR.status === 'fulfilled' ? firstAttrs(chlozR.value) : null
  // Reached only when the city-land service ANSWERED. A null here means "no
  // city-owned polygon covers this point", which is a finding; it is no longer
  // reachable from a fetch that failed.
  const cityLand = firstAttrs(cityLandR.value)
  const inCoastal = coastalR.status === 'fulfilled' ? (coastalR.value.features?.length ?? 0) > 0 : false
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null

  // `usable_sq_feet` is a zero-padded STRING and is sometimes all blanks;
  // `acreage` is null on most urban parcels. Geometry (already in CA Zone 6
  // feet) is the reliable lot size, with the recorded value preferred when real.
  const recorded = posInt(String(parcel.usable_sq_feet ?? '').trim())
  const lotSqFt = recorded ?? polygonAreaSqFt(parcelFeat?.geometry?.rings)

  const num = parcel.situs_address != null ? Number(parcel.situs_address) : 0
  const street = [parcel.situs_street, parcel.situs_suffix]
    .map((v) => (v == null ? '' : String(v).trim()))
    .filter(Boolean)
    .join(' ')
  // situs_address is 0 when the street number is missing.
  const address = [num > 0 ? String(num) : '', street].filter(Boolean).join(' ').trim()

  const zone = zoning?.ZONE_NAME ? String(zoning.ZONE_NAME).trim() : null
  // The §132.0505 30 ft coastal cap is the one numeric height San Diego
  // publishes spatially. Base-zone heights and FARs are not in the GIS at all —
  // they live in Land Development Code tables keyed on the zone-name suffix.
  //
  // ⚠️ SUPERSEDED 2026-08-13 for FAR, and only for FAR. This comment previously
  // asserted that both figures stay null because neither is in public data. The
  // FAR half is no longer true: Chapter 13 Art. 1 Div. 4 has been read and the
  // 33 residential base zones now resolve through ../zoning/sandiego.ts. HEIGHT
  // is unchanged — still null, still a GAP. Commercial, industrial and
  // planned-district FARs are also unchanged, because those divisions have not
  // been read (rule 23).
  //
  // Two things checked 2026-08-05 against Chapter 13 Article 1 (3-2026 printing):
  //
  //  1. The 30 ft cap never OVERSTATES a base zone, because no Chapter 13 base
  //     zone caps structure height below 30 ft. Lowest figure in each division:
  //     Div 3 open space 30 ft; Div 4 residential 30 ft (RS-1-1…1-7 "24/30" is
  //     24 ft at the setback rising to 30 ft overall per §131.0444(c) and
  //     Diagram 131-04L — 30 is the ceiling, not the pair's larger alternative);
  //     Div 5 commercial 30 ft. So min(base, coastal) is 30 wherever CHLOZ hits.
  //
  //  2. INDUSTRIAL IS A KNOWN ABSENCE, NOT A GAP, and we currently render it as
  //     a gap. §131.0644 "Maximum Structure Height in Industrial Zones": "There
  //     are no height limits for structures in the industrial zones except as
  //     limited by the regulations in Chapter 13, Article 2 (Overlay Zones)."
  //     The section EXISTS and affirmatively states no limit, which is the
  //     rule-5 test for an absence. Reporting it as such needs a height analogue
  //     of `zoning.farUnconstrained` in src/types/parcel.ts, so it is recorded
  //     here rather than fixed — do not let this comment read as if it shipped.
  const inCoastalHeight = chloz?.ZONENAME != null && /chloz/i.test(String(chloz.ZONENAME))

  // Residential base-zone FAR, from the Chapter 13 Art. 1 Div. 4 tables. Passed
  // the lot size because six RS zones state their ratio as a function of it.
  const sdLimits = resolveSanDiego(zone, lotSqFt)

  // City-owned land is the only ownership signal available here.
  const ownerPublic = cityLand?.COM_NAME != null || cityLand?.DES_USE != null
  const cityLandName = cityLand?.COM_NAME ? String(cityLand.COM_NAME).trim() : null

  const existingBase = {
    landUse: cityLandName ? `${cityLandName} (city-owned)` : parcel.asr_landuse != null ? `Assessor use code ${parcel.asr_landuse}` : null,
    buildingAreaSqFt: posInt(parcel.total_lvg_area),
    units: posInt(parcel.unitqty),
  }
  const hasExisting = Object.values(existingBase).some((v) => v != null)
  const existing = ownerPublic
    ? { ...existingBase, ownerPublic: true }
    : hasExisting
      ? existingBase
      : undefined

  const info: ParcelInfo = {
    ...recordAddress(address),
    parcelId: String(parcel.apn ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: zone ?? 'Unknown',
      subdistrict: null,
      article: null,
      maxHeightFt: inCoastalHeight ? COASTAL_HEIGHT_LIMIT_FT : null,
      // Division 4 residential base zones resolve from ../zoning/sandiego.ts.
      // Everything else — commercial, industrial, planned districts — is
      // OUT OF THE SCOPE THAT WAS READ and stays null, i.e. a gap (rule 23).
      // RS-1-2…RS-1-7 need the lot size: their FAR is a function of it
      // (Table 131-04J), and the resolver refuses rather than pick a band.
      maxFAR: sdLimits.maxFAR,
      ...(sdLimits.farAlternatives.length > 0 ? { farAlternatives: [...sdLimits.farAlternatives] } : {}),
      allowedUses: usesForZone(zone),
    },
    lot: { sizeSqFt: lotSqFt, lotType: null },
    overlays: {
      historicDistrict: hist?.NAME ? String(hist.NAME).trim() : null,
      floodZone: flood?.FLD_ZONE ? String(flood.FLD_ZONE) : null,
      coastalZone: inCoastal || undefined,
      // `coastal` reaches more here than the permit itself: `hurdles.ts` also
      // moves the inclusionary threshold 5 → 10 units and drops the Mello Act
      // replacement row on a null. See `lib/unresolvedOverlays.ts`.
      ...unresolvedOverlays({
        coastal: !inCoastal && readFailed(coastalR),
        historic: !hist?.NAME && readFailed(histR),
        flood: readFailed(floodR),
      }),
    },
    existing,
    // California assesses at Prop-13 acquisition value, which drifts far from
    // market — deliberately omitted rather than shown as a land-cost proxy.
    sources: { parcels: PARCELS, zoning: ZONING, ...cityLimitsSource('sandiego'), historic: HISTORIC, coastalHeight: COASTAL_HEIGHT, cityLand: CITY_LAND, coastalZone: COASTAL_ZONE, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'sandiego', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
