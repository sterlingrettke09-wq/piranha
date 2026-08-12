// San Jose provider — City of San Jose Planning (PLN_Geocortex_Public_PRD).
// Verified live 2026-08-03; all layers accept inSR=4326 point queries.
//
// ⚠️ THINNEST PARCEL DATA IN THE PORTFOLIO. San Jose's parcel layer carries only
// APN / PARCELID / LOTNUM — no address, lot area, land use, year built, unit
// count, or owner. Santa Clara County's assessor data is not publicly reachable:
// webgis.sccgov.org times out, www.sccgov.org returns a Cloudflare 403, the
// county AGOL layers return zero features downtown, and the county publishes
// parcels as an ANNUAL SHAPEFILE rather than a service (all verified 2026-08-03).
//
// Consequences, and how they're handled:
//   • Address  → Mapbox reverse geocode (same fallback the Austin provider uses).
//   • Lot size → computed from parcel geometry in CA State Plane Zone 3 feet.
//   • Existing structure → genuinely unavailable; reported as absent, not zero.
//   • Owner    → unavailable, so the government-owner gate CANNOT work here. San
//     Jose leans entirely on the curated civic hard-block list in siteFlags.ts.
import type { ParcelInfo } from '../../../../src/types/parcel'
import { ENDPOINTS } from '../../_endpoints'
import { fetchFeatures, fetchParcelSnap, firstAttrs, firstFeature, type ParcelResult } from '../arcgis'
import { readFailed, unresolvedOverlays } from '../unresolvedOverlays'
import { polygonAreaSqFt, reverseGeocode } from '../geo'
import { readRequired, requestDeadline, upstreamUnavailable } from '../requiredUpstream'
import { geocodedAddress } from '../address'

const PLN = 'https://geo.sanjoseca.gov/server/rest/services/PLN/PLN_Geocortex_Public_PRD/MapServer'
const PARCELS = `${PLN}/49`
const ZONING = `${PLN}/128`
// Height limits are published per-area but as FREE TEXT (e.g. "Determined by
// FAA" near the airport), so the value must be parsed, never trusted as numeric.
// Layer 84 is named "Specific Height Restriction" and is the GIS rendering of
// SJMC Chapter 20.85, SPECIFIC HEIGHT RESTRICTIONS — which is the right layer
// to prefer, because Table 20-100 Note 1 says the Chapter 20.85 figure "shall
// govern and control over the provisions of this section".
//
// What this means for a parcel OUTSIDE every Chapter 20.85 polygon: maxHeightFt
// is null, and that is a GAP, not an absence of limit. Title 20 states base
// district heights in feet — Table 20-100 (§ 20.40.200): CO 35, CP 50, CN 50,
// CG 65, PQP 65; Table 20-136 (§ 20.55.100): MUC 85 ft., UR 135 ft., TR 270 ft.
// (UVC and UV read "Refer to Approved Urban Village Plan"). They are not
// carried yet because most of those cells are qualified by "or as established
// in approved Urban Village Plan" / the Chapter 20.65 Part 5 overlay, neither
// of which the parcel layer resolves — a joint dependency, not a lookup.
// Note the units: the code states FEET throughout. Never convert to stories.
const HEIGHT = `${PLN}/84`
const HISTORIC = `${PLN}/34`
const GENERAL_PLAN = `${PLN}/26`
// California State Plane Zone 3 (EPSG:2227), US survey feet — the layer's native
// SR, so polygon area comes back directly in square feet.
const CA_ZONE3_FT = 2227

/**
 * San Jose publishes HEIGHTLIMIT as text. Downtown and airport-influence areas
 * carry prose ("Determined by FAA", "Defined by Airspace Req") rather than a
 * number — those must resolve to null so the tool says "not in public data"
 * instead of inventing a limit.
 */
export function parseSanJoseHeightFt(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const s = String(raw).replace(/\s+/g, ' ').trim()
  if (!s) return null
  // Any prose qualifier means the number (if present) isn't a flat limit.
  if (/determined|defined|airspace|faa|varies|see |per /i.test(s)) return null
  const m = /^(\d+(?:\.\d+)?)\s*(?:ft\.?|feet|')?$/i.exec(s)
  if (!m) return null
  const ft = Number(m[1])
  return Number.isFinite(ft) && ft > 0 && ft <= 1000 ? ft : null
}

// Exact base-district use lists read off Title 20's own use tables.
//
// Source: San José Municipal Code Title 20, Municode, jobId 498279 —
// "Codified through Ordinance No. 31330, enacted June 16, 2026. (Supp. No. 5,
// Update 3)". Each entry below is a cell in a published use table, not an
// inference from the district's name. Every table cited carries the same rule
// that makes a "-" an ANSWER rather than a gap: "Land uses not listed on
// Table 20-90 are not permitted" (§ 20.40.100) and the identical sentence for
// Table 20-110 in Chapter 20.50 — the row exists, and the cell says no.
//
// Checked against the live domain of ZONING values on PLN layer 128 (62 codes,
// enumerated from the layer's own renderer 2026-08-05), not against a guess at
// which codes exist.
const SJ_DISTRICT_USES: Record<string, string[]> = {
  // Table 20-90 (§ 20.40.100/.105), columns CO | CP | CN | CG | PQP. The CO
  // column reads "-" on EVERY dwelling row: "Mixed use residential/commercial
  // outside Neighborhood Business District Overlay" -, the same row "within"
  // the overlay -, "Live/work uses" -, "Single room occupancy, living unit" -,
  // "Permanent supportive housing" -. CO permits only group-living services
  // ("Residential service facility" P, "Residential care facility for seven or
  // more persons" C), which are not dwelling development.
  // WAS ['commercial','mixed','residential'] — that fed envelope.ts's
  // allowsResidential gate, so a Commercial Office parcel returned a dwelling
  // unit count and feasibility.ts scored a residential project AS_OF_RIGHT in
  // a district whose use table forbids it.
  CO: ['commercial'],

  // Table 20-110 (Chapter 20.50, Industrial Zoning Districts), columns
  // CIC | TEC | IP | LI | HI. Under the "Residential" heading the CIC column
  // carries only "Emergency residential shelter" (C / P) and "Hotel supportive
  // housing" C — there is no one-family, two-family, multiple-dwelling or
  // mixed-use-residential row permitted in CIC at all.
  // WAS ['commercial','mixed','residential'] via the shared /^CIC/ branch.
  CIC: ['commercial', 'institutional'],
  // Same table, TEC column: "Hotel supportive housing" C is its only entry
  // under Residential. TEC is an INDUSTRIAL district (§ 20.50.010, "TEC
  // Transit Employment Center"), so it belongs with IP/LI/HI, not with the
  // residential fallback a null produced downstream (defaultSpec's pickUse
  // returns 'residential' for an empty use list).
  TEC: ['commercial', 'institutional'],

  // § 20.55.203 use table, columns UVC | UV | MUC | MUN | UR | TR.
  // UVC reads "-" on "One-family dwelling", "Two-family dwelling", "Multiple
  // dwelling" AND "Mixed use development" — the only Urban Village / Mixed Use
  // district with no residential entitlement.
  UVC: ['commercial'],
  // UV and MUC: "Multiple dwelling" P and "Mixed use development" P, but
  // "One-family dwelling" and "Two-family dwelling" both "-".
  UV: ['commercial', 'mixed', 'residential'],
  MUC: ['commercial', 'mixed', 'residential'],
  // MUN, UR and TR: "One-family dwelling" P, "Two-family dwelling" P,
  // "Multiple dwelling" P, "Mixed use development" P. That P on the detached
  // rows is what separates these three from UV/MUC above, and it is why
  // 'residential' leads the list.
  MUN: ['residential', 'mixed', 'commercial'],
  UR: ['residential', 'mixed', 'commercial'],
  TR: ['residential', 'mixed', 'commercial'],
}

// San Jose zoning codes (Title 20): R-1/R-2/R-M residential, CN/CP/CG/CO
// commercial, IP/LI/HI industrial, A(PD) planned development, OS open space.
export function sanJoseUsesForZone(zone: string | null | undefined): string[] | null {
  if (!zone) return null
  const z = String(zone).trim().toUpperCase()
  if (/^OS|^A-?PD.*OPEN|^PQP/.test(z)) return ['institutional']
  // Planned Development: uses are set by the approved PD permit, not the code.
  // Deliberately still ahead of the exact-code table — CO(PD)/CIC(PD)/UV(PD)
  // are governed by their permit, not by the base district's use table.
  if (/\(PD\)|^A\(PD\)|^PD/.test(z)) return ['commercial', 'mixed', 'residential']
  // Exact base-district codes verified against Title 20's use tables. Must run
  // before the prefix regexes below, which would otherwise swallow CO and CIC
  // into the generic commercial branch.
  const exact = SJ_DISTRICT_USES[z]
  if (exact) return exact
  if (/^R-?M|^R-?1|^R-?2|^R-?3|^RM/.test(z)) return ['residential']
  // CN, CP, CG confirmed against Table 20-90: "Mixed use residential/commercial
  // outside Neighborhood Business District Overlay" reads C/S (CP), C (CN) and
  // CGP (CG) — listed with a permission symbol, so mixed/residential stand.
  // DC and DC-NT1 confirmed against the § 20.70.100 table: "Residential,
  // multiple dwelling" reads PGP in both columns.
  if (/^C[NPGO]|^CIC|^DC/.test(z)) return ['commercial', 'mixed', 'residential']
  // IP, LI, HI confirmed against Table 20-110: no dwelling row is permitted in
  // any of the three; HI adds only "Living quarters, custodian, caretakers" C.
  if (/^IP|^LI|^HI|^I-/.test(z)) return ['commercial', 'institutional']
  if (/^A$|^AG/.test(z)) return ['institutional']
  // Still deliberately unresolved (a GAP, not an answer): MS-C and MS-G. The
  // § 20.75.200 table splits MS-G into "Ground Floor Commercial Frontage" and
  // "Residential Street Frontage" sub-columns, so a cell cannot be assigned to
  // a district without resolving that frontage — which the parcel layer does
  // not carry. TERO is an overlay, not a base district, and WATER is not a
  // district at all.
  return null
}

export async function getSanJoseParcelInfo(lat: number, lng: number): Promise<ParcelResult> {
  const t0 = Date.now()
  // reverseGeocode runs inside the fan-out so its latency overlaps the upstream
  // fetches rather than adding to them (same reasoning as the Austin provider).
  const deadline = requestDeadline()
  // REQUIRED reads go through readRequired; OPTIONAL ones keep allSettled. See
  // the contract at the top of ../requiredUpstream.ts.
  //
  // ⚠️ THE HEIGHT LAYER IS ALSO REQUIRED. San Jose maps height in a SEPARATE
  // layer from the base district, and it is the only height this provider
  // publishes (maxFAR is deliberately null here — see the note below). With the
  // height layer in the optional group a transport failure turned a mapped
  // "65 feet" into `maxHeightFt: null`, which feasibility.ts renders as "No
  // district height limit is available in public data" — false about a parcel
  // the city does map. Measured by perturbation 2026-08-11: control h=65,
  // height-layer-fail h=null, everything else unchanged.
  const [parcelR, zoningR, heightR, optional] = await Promise.all([
    // maxAttempts 2: fetchParcelSnap already retries its exact query internally.
    readRequired(
      'parcel',
      (t) => fetchParcelSnap(PARCELS, lat, lng, ['APN', 'PARCELID', 'LOTNUM'], true, CA_ZONE3_FT, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired(
      'zoning',
      (t) =>
        fetchParcelSnap(ZONING, lat, lng, ['ZONING', 'ZONINGABBREV', 'PDUSE', 'PDDENSITY'], false, undefined, 30, t),
      { deadline, maxAttempts: 2, attemptCapMs: 4000 },
    ),
    readRequired(
      'height district',
      (t) => fetchFeatures(HEIGHT, lat, lng, ['HEIGHTLIMIT', 'DESCRIPTION'], false, undefined, t),
      { deadline, maxAttempts: 3, attemptCapMs: 3000 },
    ),
    Promise.allSettled([
      fetchFeatures(HISTORIC, lat, lng, ['NAME', 'AREATYPE']),
      fetchFeatures(GENERAL_PLAN, lat, lng, ['GPDESIGNATION']),
      fetchFeatures(ENDPOINTS.flood, lat, lng, ['FLD_ZONE']),
      reverseGeocode(lat, lng),
    ]),
  ])
  const [histR, gpR, floodR, geocodeR] = optional

  // THE STATE SPLIT — a failed fetch refuses; an empty answer is still an answer.
  if (!parcelR.ok || !zoningR.ok || !heightR.ok) {
    return upstreamUnavailable('sanjose', 'San Jose', [parcelR, zoningR, heightR], t0)
  }
  const parcelFeat = firstFeature(parcelR.value)
  const parcel = parcelFeat?.attributes ?? null
  if (!parcel) {
    return { ok: false, code: 'NO_PARCEL', message: 'No parcel found at this location.', status: 404 }
  }

  // Reached only when the zoning and height services ANSWERED.
  const zoning = firstAttrs(zoningR.value)
  const height = firstAttrs(heightR.value)
  const hist = histR.status === 'fulfilled' ? firstAttrs(histR.value) : null
  const gp = gpR.status === 'fulfilled' ? firstAttrs(gpR.value) : null
  const flood = floodR.status === 'fulfilled' ? firstAttrs(floodR.value) : null
  const geocoded = geocodeR.status === 'fulfilled' ? geocodeR.value : null

  const zone = zoning?.ZONING ? String(zoning.ZONING).trim() : null
  const abbrev = zoning?.ZONINGABBREV ? String(zoning.ZONINGABBREV).trim() : null

  const info: ParcelInfo = {
    // No address in the parcel layer at all — Mapbox is the only source.
    ...geocodedAddress(geocoded),
    parcelId: String(parcel.APN ?? parcel.PARCELID ?? ''),
    coordinates: [lng, lat],
    zoning: {
      districtCode: abbrev ?? zone ?? 'Unknown',
      subdistrict: zoning?.PDUSE ? String(zoning.PDUSE).trim() : null,
      // The General Plan designation is the closest thing to a plain-English
      // descriptor San Jose exposes for the parcel.
      article: gp?.GPDESIGNATION ? String(gp.GPDESIGNATION).trim() : zone,
      maxHeightFt: parseSanJoseHeightFt(height?.HEIGHTLIMIT as string | null | undefined),
      // No FAR anywhere in San Jose's public GIS. PDDENSITY is units/acre on
      // planned-development zones, which is a density, not a floor-area ratio.
      //
      // This null is a GAP, not "the code imposes no FAR" — Title 20 does
      // publish FARs, and the reason we do not carry them is specific rather
      // than "we couldn't find any". § 20.55.040 and Table 20-136
      // (§ 20.55.100) state a maximum FAR for five districts — UVC Max. 8.0,
      // UV Max. 10.0, MUC 0.25—4.5, UR 1.0—4.0, TR 2.0—12.0 — and Table 20-137
      // (§ 20.55.104) gives MUN 0.25—2.0.
      //
      // They are NOT published here because each is conditional on a program
      // the user has not chosen (rule 6). § 20.55.040.B applies those figures
      // to "development projects that are 100% Commercial"; § 20.55.040.C
      // applies a separate mixed-use set; and § 20.55.040.D says "For projects
      // that are 100% Residential the standard for du/ac shall apply" — i.e.
      // no FAR governs a residential project at all, du/ac does. Attaching a
      // single maxFAR to the parcel would pick one program's ceiling and let
      // it flow into unit counts and fees. MUC is the sharpest case: FAR 4.5
      // against a residential cap of "Max. 50" du/ac plus the table's own
      // condition that residential in MUC "must be one-hundred percent
      // affordable deed-restricted housing".
      //
      // Resolving this properly needs the chosen program as an input, not a
      // district lookup. Until then a null that defaultSpec labels as an
      // assumption beats a number that looks code-derived.
      maxFAR: null,
      allowedUses: sanJoseUsesForZone(abbrev ?? zone),
    },
    lot: { sizeSqFt: polygonAreaSqFt(parcelFeat?.geometry?.rings), lotType: null },
    overlays: {
      historicDistrict: hist?.NAME ? String(hist.NAME).trim() : null,
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
    // Deliberately omitted: Santa Clara County's assessor attributes aren't
    // publicly reachable, so year built / units / building area / owner are
    // genuinely unknown here. Reporting nothing is correct; reporting zeros
    // would read as "vacant lot" on a developed parcel.
    existing: undefined,
    sources: { parcels: PARCELS, zoning: ZONING, height: HEIGHT, historic: HISTORIC, generalPlan: GENERAL_PLAN, flood: ENDPOINTS.flood },
    fetchedAt: new Date().toISOString(),
  }

  console.log({ event: 'parcel.ok', city: 'sanjose', durationMs: Date.now() - t0, parcelId: info.parcelId })
  return { ok: true, info }
}
