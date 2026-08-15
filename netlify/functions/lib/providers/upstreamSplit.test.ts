// The transport-failure state split, asserted across EVERY live provider at once.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS FILE IS ONE TEST OVER 23 PROVIDERS RATHER THAN 23 TESTS
//
// The defect it guards is not a property of any one city. It is a property of an
// idiom — `zoningR.status === 'fulfilled' ? firstAttrs(zoningR.value) : null` —
// that was copied into 21 of 23 providers, mapping "the service did not answer"
// and "the service answered and nothing is here" onto the same `null`, which
// becomes `districtCode: 'Unknown'`, which `assessDevelopability` renders as
// *no_coverage* ("may sit in a neighboring city…") while analyze.ts zeroes cost,
// timeline and hurdles. A per-city test can be written and then not written for
// the next city; a table that must equal `LIVE_CITIES` cannot.
//
// It also exercises the REAL entry point, `getParcelInfo(city, lat, lng)`
// (CLAUDE.md rule 11). Calling a provider's inner helper would measure the layer
// rather than the pipeline.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY IT CANNOT PASS BY FINDING NOTHING (CLAUDE.md rule 20)
//
// Three things are pinned, and each closes a way this could go quietly green:
//
//   1. `CASES` must cover exactly `LIVE_CITIES`. Add a city and this file fails
//      until someone states what its zoning failure does.
//   2. Every perturbation asserts `hits > 0` — the routing substring really
//      matched a request. A renamed upstream URL turns the probe into a no-op,
//      and without this it would pass while testing nothing.
//   3. The CONTROL run must publish a substantive districtCode. If the harness
//      stops producing a valid parcel, the whole file goes red rather than
//      "nothing to report".
//
// ─────────────────────────────────────────────────────────────────────────────
// HOW THE HARNESS ANSWERS
//
// `synth` builds a feature from the query's OWN `outFields`, so it does not
// encode any city's schema and cannot drift away from one. Anything a provider
// asks for, it gets. A handful of fields need a specific value to get past a
// documented guard (Philadelphia's `status`, Las Vegas's jurisdiction NAME) and
// those are named individually below.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THE SECOND HALF OF THIS FILE ADDS, AND WHY IT HAD TO BE ADDED
//
// Everything above concerns REQUIRED reads. The `Case` fields were
// `onZoningFail` / `onZoningEmpty` / `alsoRequired` — three slots, all of which
// ask the same question: *does this failure REFUSE?* There was no slot for the
// other question, *what does an OPTIONAL layer's failure PUBLISH?*, so the whole
// class was invisible here: a sweep found Denver billing a fee area nothing had
// measured, Miami manufacturing an absence out of a timeout, and Boston's
// verdict moving NEEDS_RELIEF → AS_OF_RIGHT because a historic layer was down.
// Not one of those was a failing test. A field that does not exist cannot be
// wrong, and cannot be checked either.
//
// `optional` is that slot. Every optional read every live provider issues is
// listed with what its failure publishes, drawn from the categories the sweep
// used, and each declaration is CHECKED by perturbation at the two payloads a
// user can actually receive — never asserted in a comment:
//
//   disclosed-gap   the report distinguishes the failure from an answer (right)
//   fallback        a second source covers the same fact
//   gate-open       a jurisdiction gate that deliberately fails OPEN
//   placeholder     the failure publishes a fixed value that claims nothing
//   false-absence   DEFECT — an absence manufactured from a failed read
//   false-value     DEFECT — a value published from a failed read
//   silent-removal  DEFECT — a requirement or a limit disappears, undisclosed
//
// The three defect categories are pinned by exact membership in `KNOWN_OPEN`
// below. They are RECORDED, not endorsed: each entry carries what was measured,
// and closing one turns this file red until its declaration is updated — which
// is the point of writing them down rather than leaving them unmodelled.
//
// WHY THE OPTIONAL HALF CANNOT PASS BY FINDING NOTHING EITHER (rule 20). Six
// things, and the first is the one the old table could not have:
//
//   1. The inventory is not asserted against itself. Each provider is RUN, every
//      request it issues is recorded, and the declared set is compared to the
//      observed set IN BOTH DIRECTIONS — so a provider that starts reading a
//      layer nobody declared goes red, and so does a declaration whose layer is
//      no longer read.
//   2. Each substring must match exactly ONE of the provider's layers, or the
//      perturbation is not about the layer it names.
//   3. Every perturbation asserts `hits > 0` on both the empty and the failed
//      run, so a renamed URL fails loudly instead of testing nothing.
//   4. Every layer's failure must CHANGE something. A probe that fed a layer a
//      value its consumer cannot use would otherwise report every such layer as
//      harmless — which is exactly what three of them looked like until their
//      gates were opened (see `activate`).
//   5. The control run must publish a substantive report — developable, with
//      hurdles, months and a total. On a civic-blocked parcel all of those are
//      zero and every comparison below is trivially equal.
//   6. The defect inventory is pinned by exact membership, so it cannot drift in
//      either direction without an edit somebody reads.
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { getParcelInfo, LIVE_CITIES } from '../parcel'
import { GATED_CITIES } from '../jurisdiction'
import { handler as analyzeHandler } from '../../analyze'
import { invokeHandler } from '../testing/invokeHandler'
import { probe, publishProbe, synth, type Injection, type ProbeOptions, type PublishRun } from './__fixtures__/upstreamProbe'
import type { UnresolvedOverlay } from '../../../../src/types/parcel'

/** What a failed ZONING fetch must do, per city. */
type Outcome =
  | 'refuse' // the ported state split: UPSTREAM_ERROR
  | 'fallback' // Nashville only — a second source covers it; see the case note

/** What a failed OPTIONAL fetch PUBLISHES. See the header for the vocabulary. */
interface OptionalBase {
  /** Human name, and the identity used by `KNOWN_OPEN` as `<city>.<label>`. */
  label: string
  /** URL substring identifying this read. Asserted to route at least one
   *  request AND to match exactly one of the provider's layers — a substring
   *  that matches two layers faults both, and then the perturbation is not
   *  measuring the layer it names. */
  substr: string
  /** One line: what the read feeds, and what its failure does with it. */
  why: string
  /** Attribute values that make this layer's CONSUMER live.
   *
   *  ⚠️ THE RULE-20 HAZARD SPECIFIC TO THIS TABLE. `synth` answers every field
   *  with 'X1', and a consumer gated on a VALUE — San Diego's `/chloz/i` height
   *  overlay, Austin's Subchapter F zone list, Phoenix's numeric assessor
   *  columns — does nothing with that. All three read as "this failure publishes
   *  nothing" until the gate is opened, at which point they publish a lost 30 ft
   *  height cap, a lost FAR, and a $15,660 swing in a construction total. An
   *  `inert` verdict obtained by feeding a layer a value nothing can use is the
   *  check passing by finding nothing. There is deliberately no `inert`
   *  category: every layer here publishes something. */
  activate?: readonly Injection[]
  /** Layers that must answer EMPTY for this one's contribution to be visible —
   *  a higher-precedence sibling in a `??` chain (Raleigh's and Atlanta's
   *  subdistrict) or the other half of a jointly-fed field (Miami's two historic
   *  layers, CLAUDE.md rule 13). Without this a probe measures the sibling. */
  mask?: readonly string[]
}

type OptionalLayer = OptionalBase &
  (
    | {
        publishes: 'disclosed-gap'
        /** How the report says the check did not run: an `overlays.unresolved`
         *  key, or a field that carries a stated ANSWER when the layer answered
         *  and nothing at all when it did not. */
        discloses: { unresolved: UnresolvedOverlay } | { gapField: string; answeredValue: unknown }
      }
    | { publishes: 'fallback'; secondSource: string }
    | { publishes: 'gate-open' }
    | { publishes: 'placeholder'; placeholder: { path: string; value: string } }
    | { publishes: 'false-absence'; loses: { field: string } }
    | { publishes: 'false-value'; loses: { field: string }; movesCostTotal: true }
    | { publishes: 'silent-removal'; loses: { hurdle: string } | { field: string } }
  )

interface Case {
  city: string
  lat: number
  lng: number
  /** URL substring identifying the zoning read. Pinned; see guarantee 2 above. */
  zoning: string
  onZoningFail: Outcome
  /** What an EMPTY (but successful) zoning answer must still produce. */
  onZoningEmpty: 'unknown' | 'fallback' | 'no-parcel'
  /** Extra REQUIRED reads this provider has beyond zoning. Every one is faulted
   *  and must refuse. Complete: the inventory test below fails if this provider
   *  issues a request no entry here or in `optional` accounts for. */
  alsoRequired?: Array<{ label: string; substr: string }>
  /** Every OPTIONAL read, and what its failure publishes. */
  optional: OptionalLayer[]
  /** Where to run the PUBLISHED-surface probe, when the standard probe point is
   *  a curated civic site. `assessCivicHardBlock` zeroes cost, timeline and
   *  hurdles for City Hall, so the report there is identical whatever fails —
   *  every optional layer would read as publishing nothing (rule 20 again).
   *  Defaults to `lat`/`lng`; the control assertion below is what enforces it. */
  publishAt?: [number, number]
  /** Layers that answer only for PUBLIC parcels — Minneapolis's park polygons,
   *  San Diego's city-land layer. The harness answers every layer with a
   *  feature, so an ORDINARY PRIVATE parcel has to say which layers answer
   *  empty, or the hard block fires and zeroes the report. Same device as
   *  hardBlockInputs.test.ts's `publicOnlyLayers`. */
  publicOnly?: readonly string[]
  note?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Layers every provider reads, named once.

/** FEMA's National Flood Hazard Layer — one service for all 23 cities. */
const FEMA = 'hazards.fema.gov'
/** The statewide CA Coastal Zone polygon, shared by the two CA providers. */
const COASTAL = 'Coastal_Zone_Polygon'
/** Mapbox reverse geocode, for the providers whose parcel layer carries no
 *  street address. Note the env stub in `beforeAll`: without a token
 *  `reverseGeocode` returns before fetching, and these three entries would go
 *  quietly untested wherever `.env` is absent — CI, most obviously. */
const MAPBOX = 'api.mapbox.com'

const flood = (): OptionalLayer => ({
  label: 'flood',
  substr: FEMA,
  publishes: 'disclosed-gap',
  discloses: { unresolved: 'flood' },
  why: 'hurdles.ts reads floodZone as a boolean, so a null drops the flood requirement; a failed read is marked instead',
})

const historic = (substr: string, extra: Partial<OptionalBase> = {}): OptionalLayer => ({
  label: 'historic',
  substr,
  publishes: 'disclosed-gap',
  discloses: { unresolved: 'historic' },
  why: 'hurdles.ts and feasibility.ts read historicDistrict as a boolean; a failed read publishes a "could not be checked" row instead of dropping design review',
  ...extra,
})

const coastal = (): OptionalLayer => ({
  label: 'coastal',
  substr: COASTAL,
  publishes: 'disclosed-gap',
  discloses: { unresolved: 'coastal' },
  why: 'the Coastal Development Permit is serial and adds 9 months in full, so a null removes them in full; a failed read is marked',
})

const geocodedAddress = (): OptionalLayer => ({
  label: 'address geocode',
  substr: MAPBOX,
  publishes: 'placeholder',
  placeholder: { path: 'address', value: 'Selected location' },
  why: 'a failed reverse geocode publishes the same neutral placeholder an empty answer does — it invents no address, and cacheControlFor already treats that string as a degraded response',
})

const CASES: Case[] = [
  // Boston and NYC never had the defect: Boston already refused on a rejected
  // zoning fetch, and NYC reads its district off the same PLUTO fetch that is
  // already required (so an empty PLUTO answer is NO_PARCEL, not a zoning gap).
  {
    city: 'boston',
    lat: 42.3601,
    lng: -71.0589,
    // The standard probe point is City Hall, which the curated civic hard block
    // zeroes; the published-surface probe runs a few blocks away.
    publishAt: [42.3721, -71.0469],
    zoning: 'Zoning_Subdistricts_Urban_20240719',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'parcel', substr: 'Parcels_24_detailed' }],
    optional: [historic('Historic_Districts_BLC'), flood()],
  },
  {
    city: 'nyc',
    lat: 40.7549,
    lng: -73.9857,
    zoning: 'MAPPLUTO',
    onZoningFail: 'refuse',
    onZoningEmpty: 'no-parcel',
    optional: [historic('v_GFT_Historic_Districts'), flood()],
  },

  {
    city: 'chicago',
    lat: 41.8855,
    lng: -87.6248,
    zoning: 'Zoning_update/MapServer/15',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'parcel', substr: 'parcelHistorical' }],
    optional: [
      {
        label: 'jurisdiction gate',
        substr: 'operational/MapServer/119',
        publishes: 'gate-open',
        why: 'the Oak Park / Cicero gate: an empty answer is OUT_OF_BBOX, a failed one deliberately opens (see ../jurisdiction.ts)',
      },historic('Zoning_update/MapServer/6'), geocodedAddress(), flood()],
  },
  {
    city: 'sf',
    lat: 37.7749,
    lng: -122.4194,
    // '/3/query', not '/3': the bare form is also a substring of layer 35, so it
    // faulted the land-use layer at the same time and the perturbation was no
    // longer about the layer it named.
    zoning: 'PlanningData/MapServer/3/query',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [
      { label: 'parcel', substr: 'PlanningData/MapServer/23' },
      { label: 'height districts', substr: 'PlanningData/MapServer/5' },
      { label: 'land use', substr: 'PlanningData/MapServer/35' },
    ],
    optional: [historic('PlanningData/MapServer/17'), flood()],
  },
  {
    city: 'seattle',
    lat: 47.608,
    lng: -122.3331,
    zoning: 'Current_Land_Use_Zoning_Detail_2',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'parcel', substr: 'Parcel_Boundary' }],
    optional: [
      historic('Zoning_Overlays-Historic-Special_Review_Districts'),
      {
        label: 'MHA fee area',
        substr: 'MHA_Fee_Areas_1',
        publishes: 'disclosed-gap',
        discloses: { unresolved: 'feeArea' },
        why: 'the MHA rate is published per area ($10.78–$50.46/sf); a failed read moved a live line from ~$45/sf to ~$28/sf before it was marked',
      },
      {
        label: 'regional/urban centre boundary',
        substr: 'Centers_Boundaries_2044',
        // With the boundary resolved an LR3 (M) lot carries a stated 1.8 or
        // 2.3; without it the field is absent and the verdict is withheld.
        // Nothing false is published either way.
        publishes: 'disclosed-gap',
        discloses: { gapField: 'zoning.maxFAR', answeredValue: 1.8 },
        why: 'Table A for 23.45.510 splits LR3 on whether the lot is inside a regional or urban centre — MHA 1.8 outside vs 2.3 inside — so a failed read leaves that row unresolved rather than picking one (rule 13)',
        // The probe parcel is downtown; only an LR3 lot WITH an MHA suffix
        // depends on the boundary, so activate one. An empty centres answer is
        // a real 'outside', which is why the answered value is 1.8.
        activate: [{ substr: 'Current_Land_Use_Zoning_Detail_2', attrs: { ZONING: 'LR3 (M)' } }],
      },
      flood(),
    ],
  },
  {
    city: 'dc',
    lat: 38.8951,
    lng: -77.0364,
    zoning: 'Zone_Mapservice/MapServer/24',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'parcel', substr: 'Property_and_Land/MapServer/40' }],
    optional: [historic('Zone_Mapservice/MapServer/6'), flood()],
  },
  {
    city: 'austin',
    lat: 30.2672,
    lng: -97.7431,
    zoning: 'Current_Zoning_gdb',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'parcel', substr: 'EXTERNAL_tcad_parcel' }],
    optional: [
      {
        label: 'jurisdiction gate',
        substr: 'BOUNDARIES_jurisdictions',
        publishes: 'gate-open',
        why: 'the West Lake Hills / Rollingwood gate: an empty answer is OUT_OF_BBOX, a failed one deliberately opens (see ../jurisdiction.ts)',
      },
      {
        label: 'subchapter F',
        substr: 'PLANNINGCADASTRE_residential_design_standards',
        publishes: 'disclosed-gap',
        // Measured on an SF-3 parcel. INSIDE Subchapter F: 32 ft, FAR 0.40,
        // the HOME alternatives. OUTSIDE it (an empty answer): 35 ft and
        // `farUnconstrained: true` — a KNOWN ABSENCE, the code imposes no FAR
        // here. FAULTED: no FAR and no flag, which is the GAP. Those last two
        // both carry `maxFAR: null` and are the exact pair CLAUDE.md rule 5
        // says must never render the same; the flag is what separates them, so
        // the flag is what this asserts.
        discloses: { gapField: 'zoning.farUnconstrained', answeredValue: true },
        why: 'Subchapter F applicability; a failed read leaves the FAR unresolved instead of reporting the known absence that an empty answer reports',
        activate: [{ substr: 'Current_Zoning_gdb', attrs: { BASE_ZONE: 'SF-3' } }],
      },
      geocodedAddress(),
      flood(),
    ],
  },
  {
    city: 'la',
    lat: 34.0522,
    lng: -118.2437,
    zoning: 'NavigateLA/MapServer/71',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'parcel', substr: 'LACounty_Parcel' }],
    optional: [
      {
        label: 'jurisdiction gate',
        substr: 'NavigateLA/MapServer/410',
        publishes: 'gate-open',
        why: 'the West Hollywood / Beverly Hills gate: an empty answer is OUT_OF_BBOX, a failed one deliberately opens (see ../jurisdiction.ts)',
      },historic('NavigateLA/MapServer/75'), coastal(), flood()],
  },
  {
    city: 'denver',
    lat: 39.7392,
    lng: -104.9903,
    publishAt: [39.7512, -104.9783],
    zoning: 'Zoning/MapServer/1',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'parcel', substr: 'Zoning/MapServer/0' }],
    optional: [
      historic('ODC_HIST_LANDMARKDISTRICT_A'),
      {
        label: 'EHA market area',
        substr: 'EHA_WebService',
        publishes: 'disclosed-gap',
        discloses: { unresolved: 'feeArea' },
        why: 'the commercial affordable-housing rate is High $9.21/sf or Typical $6.14/sf; a failed read silently billed Typical and moved $307,000 out of a total before it was marked',
      },
      flood(),
    ],
  },
  {
    city: 'minneapolis',
    lat: 44.9778,
    lng: -93.265,
    publishAt: [44.9898, -93.253],
    publicOnly: ['Parks/FeatureServer'],
    zoning: 'Planning_Primary_Zoning',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    // Rule 13: height AND FAR need the built-form row together with the primary
    // zoning column, so neither layer alone answers.
    alsoRequired: [
      { label: 'parcel', substr: 'LAND_PROPERTY' },
      { label: 'built form', substr: 'Planning_Zoning_Built_Form' },
      { label: 'parks', substr: 'Parks/FeatureServer' },
    ],
    optional: [historic('HPC_Districts'), flood()],
  },
  {
    city: 'philadelphia',
    lat: 39.9526,
    lng: -75.1635,
    publishAt: [39.9646, -75.1515],
    zoning: 'Zoning_BaseDistricts',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [
      { label: 'parcel', substr: 'DOR_Parcel' },
      // The only source of Philadelphia's max height and max FAR.
      { label: 'zoning-code characteristics', substr: 'ZoningCodeCharacteristics' },
      { label: 'OPA assessor join', substr: 'OPA_PROPERTIES_PUBLIC' },
    ],
    optional: [historic('HistoricDistricts_Local'), flood()],
  },
  {
    city: 'miami',
    lat: 25.7743,
    lng: -80.1918,
    zoning: 'ZoningMiami21',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    note: 'the zoning layer IS the jurisdiction gate here — county parcels, city zoning',
    alsoRequired: [{ label: 'parcel', substr: 'MD_LandInformation/MapServer/26' }],
    // TWO layers feed one field, so a null is an answer only when both answered
    // (CLAUDE.md rule 13) — each is faulted with the other masked, or the
    // sibling's answer resolves the field and the probe measures nothing.
    optional: [
      {
        label: 'jurisdiction gate',
        substr: 'BaseLayers/MapServer/9',
        publishes: 'gate-open',
        why: 'the Coral Gables / Hialeah gate: an empty answer is OUT_OF_BBOX, a failed one deliberately opens (see ../jurisdiction.ts)',
      },
      historic('HEP/MapServer/4', { label: 'historic district', mask: ['HEP/MapServer/3'] }),
      historic('HEP/MapServer/3', { label: 'archaeological zone', mask: ['HEP/MapServer/4'] }),
      flood(),
    ],
  },
  {
    city: 'sandiego',
    lat: 32.7157,
    lng: -117.1611,
    publishAt: [32.7037, -117.1491],
    publicOnly: ['Regulatory/MapServer/3'],
    zoning: 'Zoning_Base',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [
      { label: 'parcel', substr: 'Hosted/Parcels' },
      { label: 'city land', substr: 'Regulatory/MapServer/3' },
    ],
    optional: [
      {
        label: 'jurisdiction gate',
        substr: 'DoIT_Public/MapServer/7',
        publishes: 'gate-open',
        why: 'the Coronado / National City gate: an empty answer is OUT_OF_BBOX, a failed one deliberately opens (see ../jurisdiction.ts)',
      },
      historic('Historic_Preservation_Resources'),
      {
        label: 'coastal height overlay',
        substr: 'Zoning_Overlay/MapServer/1',
        publishes: 'silent-removal',
        loses: { field: 'zoning.maxHeightFt' },
        // Measured with ZONENAME='CHLOZ': control 30, faulted null. The 30 ft
        // coastal height limit is the only height this provider publishes, and
        // its disappearance reads exactly like a parcel with no mapped limit.
        why: 'a failed read drops the 30 ft CHLOZ height limit to null, which reads as "no height limit resolved" rather than "not checked"',
        activate: [{ substr: 'Zoning_Overlay/MapServer/1', attrs: { ZONENAME: 'CHLOZ' } }],
      },
      coastal(),
      flood(),
      {
        label: 'community plan area',
        substr: 'CMTY_PLAN_SD',
        // A DISCLOSED gap, not a silent removal: with the plan area resolved
        // the field carries a stated 2.0, and without it the field is simply
        // absent and the pipeline withholds the verdict. The reader is told the
        // floor area is an assumption rather than shown a number.
        publishes: 'disclosed-gap',
        discloses: { gapField: 'zoning.maxFAR', answeredValue: 2 },
        // The Division 6 industrial FAR is a JOINT function of zone and
        // community plan (rule 13). Table 131-06C states 2.0; footnote 11 makes
        // it 0.50 in Otay Mesa. Without the plan area we cannot rule Otay Mesa
        // out, so ../zoning/sandiego.ts REFUSES rather than publishing the base
        // figure — a failed read costs the FAR, which is the correct direction:
        // defaulting to 2.0 would overstate an Otay Mesa parcel fourfold.
        why: 'a failed read leaves the industrial FAR unresolved, because the base 2.0 cannot be published without ruling out the Otay Mesa 0.50 override',
        // The probe parcel is downtown, where the community plan changes
        // nothing — the FAR only depends on it in a Division 6 industrial zone.
        // So activate one: an IH-2-1 parcel in North Park resolves to the base
        // 2.0, and faulting the plan layer takes it to null.
        activate: [
          { substr: 'Zoning_Base', attrs: { ZONE_NAME: 'IH-2-1' } },
          { substr: 'CMTY_PLAN_SD', attrs: { cpname: 'NORTH PARK' } },
        ],
      },
    ],
  },
  {
    city: 'sanjose',
    lat: 37.3382,
    lng: -121.8863,
    publishAt: [37.3502, -121.8743],
    zoning: 'MapServer/128',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [
      { label: 'parcel', substr: 'MapServer/49' },
      { label: 'height district', substr: 'MapServer/84' },
    ],
    optional: [
      historic('MapServer/34'),
      {
        label: 'general plan',
        substr: 'MapServer/26',
        publishes: 'false-absence',
        loses: { field: 'zoning.article' },
        why: 'the General Plan land-use designation is published as zoning.article; a failed read publishes no designation, which reads as a parcel that has none',
        activate: [{ substr: 'MapServer/26', attrs: { '*': 'GENERAL-PLAN-PROBE' } }],
      },
      geocodedAddress(),
      flood(),
    ],
  },
  {
    city: 'nashville',
    lat: 36.1627,
    lng: -86.7816,
    zoning: 'Zoning/MapServer/14',
    // THE ONE EXCEPTION, and it is earned rather than assumed: the parcel layer
    // carries a denormalised `Zoning` copy that agreed with the authoritative
    // layer at every verified test point. A zoning outage therefore has a second
    // source. The refusal is conditional on that source ALSO being empty, which
    // the dedicated test below covers.
    onZoningFail: 'fallback',
    onZoningEmpty: 'fallback',
    alsoRequired: [{ label: 'parcel', substr: 'Cadastral/Parcels' }],
    optional: [
      {
        label: 'zoning',
        substr: 'Zoning/MapServer/14',
        publishes: 'fallback',
        secondSource: "the parcel layer's denormalised `Zoning` column",
        why: 'the authoritative zoning layer; a failure falls back to the parcel layer’s copy of the same fact rather than publishing Unknown. It is ALSO Nashville’s jurisdiction gate (Metro labels satellite-city polygons in ZONE_DESC), and a failed or empty read opens that gate rather than closing it — see `emptyMeans` in ../jurisdiction.ts',
      },
      historic('ZoningOverlayDistricts/MapServer/0'),
      flood(),
    ],
  },
  {
    city: 'raleigh',
    lat: 35.7813,
    lng: -78.6423,
    zoning: 'Planning/Zoning/MapServer/0',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'parcel', substr: 'Property/Property/MapServer/0' }],
    optional: [
      {
        label: 'jurisdiction gate',
        substr: 'Planning/Jurisdictions/MapServer/1',
        publishes: 'gate-open',
        why: 'the Cary / Garner gate, on PLANNING jurisdiction rather than corporate limits because Raleigh zones its ETJ: an empty answer is OUT_OF_BBOX, a failed one deliberately opens',
      },
      historic('Planning/Overlays/MapServer/7', { label: 'historic -HOD-G', mask: ['Planning/Overlays/MapServer/8'] }),
      historic('Planning/Overlays/MapServer/8', { label: 'historic -HOD-S', mask: ['Planning/Overlays/MapServer/7'] }),
      {
        label: 'NCOD overlay',
        substr: 'Planning/Overlays/MapServer/9',
        publishes: 'false-absence',
        loses: { field: 'zoning.subdistrict' },
        why: 'the Neighborhood Conservation overlay is published as the subdistrict when no historic district applies; a failed read publishes none, which reads as a parcel with no overlay',
        // subdistrict is `historic ?? ncod ?? tod`: with the siblings answering,
        // this layer's contribution never reaches the field and the probe would
        // be measuring the sibling.
        mask: ['Planning/Overlays/MapServer/7', 'Planning/Overlays/MapServer/8', 'Planning/Overlays/MapServer/10'],
      },
      {
        label: 'TOD overlay',
        substr: 'Planning/Overlays/MapServer/10',
        publishes: 'false-absence',
        loses: { field: 'zoning.subdistrict' },
        why: 'the Transit Overlay District, same field and same failure as the NCOD read above',
        mask: ['Planning/Overlays/MapServer/7', 'Planning/Overlays/MapServer/8', 'Planning/Overlays/MapServer/9'],
      },
      flood(),
    ],
  },
  {
    city: 'milwaukee',
    lat: 43.0396,
    lng: -87.9204,
    zoning: 'planning/zoning/MapServer/12',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'parcel', substr: 'parcels_mprop' }],
    optional: [
      historic('special_districts/MapServer/17'),
      {
        label: 'DIZ overlay',
        substr: 'planning/zoning/MapServer/4',
        publishes: 'silent-removal',
        loses: { hurdle: 'Development Incentive Zone' },
        why: 'a failed read removes the Development Incentive Zone hurdle — no permit until the development plan is approved — and nothing says a check did not run',
      },
      {
        label: 'SPROZ overlay',
        substr: 'planning/zoning/MapServer/9',
        publishes: 'silent-removal',
        loses: { hurdle: 'Site Plan Review overlay' },
        why: 'a failed read removes the Site Plan Review hurdle (City Plan Commission approval), undisclosed',
      },
      {
        label: 'NC overlay',
        substr: 'planning/zoning/MapServer/8',
        publishes: 'silent-removal',
        loses: { hurdle: 'Neighborhood Conservation overlay' },
        why: 'a failed read removes the Neighborhood Conservation hurdle (an adopted plan and guidelines control), undisclosed',
      },
      flood(),
    ],
  },
  {
    city: 'columbus',
    lat: 39.9644,
    lng: -83.0014,
    zoning: 'MapServer/20',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'parcel', substr: 'Applications/Zoning/MapServer/5' }],
    optional: [
      {
        label: 'city boundary gate',
        substr: 'MapServer/21',
        publishes: 'gate-open',
        why: 'the jurisdiction gate: an empty answer is OUT_OF_BBOX, a failed one deliberately opens (see the GATES block)',
      },
      historic('Applications/Zoning/MapServer/14'),
      {
        label: 'planning overlays',
        substr: 'Applications/Zoning/MapServer/16',
        publishes: 'false-absence',
        loses: { field: 'zoning.subdistrict' },
        why: 'the planning-overlay name is one of the clauses in the published subdistrict; a failed read drops the clause, which reads as a parcel the overlay does not cover',
        activate: [{ substr: 'Applications/Zoning/MapServer/16', attrs: { '*': 'PLANNING-OVERLAY-PROBE' } }],
      },
      {
        label: 'commercial overlays',
        substr: 'Applications/Zoning/MapServer/15',
        publishes: 'false-absence',
        // `zoning.article`, not the subdistrict: the commercial overlay is last
        // in `historic ?? designReview ?? planning ?? commercial`, so the
        // planning overlay above already occupies that field. The article is
        // where this layer's clause is actually published.
        loses: { field: 'zoning.article' },
        why: 'the "Commercial overlay: <name>" clause of the published article simply stops being written; a failed read reads as a parcel no commercial overlay covers',
        activate: [{ substr: 'Applications/Zoning/MapServer/15', attrs: { '*': 'COMMERCIAL-OVERLAY-PROBE' } }],
      },
      flood(),
    ],
  },
  {
    city: 'charlotte',
    lat: 35.2246,
    lng: -80.8443,
    zoning: 'PLN/Zoning/MapServer/0',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'parcel', substr: 'Accela/Accela/MapServer/16' }],
    optional: [
      {
        label: 'jurisdiction gate',
        substr: 'SphereofInfluence',
        publishes: 'gate-open',
        why: 'the Matthews / Mint Hill gate, on the county\'s Sphere of Influence because Charlotte zones its ETJ: an empty answer is OUT_OF_BBOX, a failed one deliberately opens',
      },historic('Accela/Accela/MapServer/12'), flood()],
  },
  {
    city: 'atlanta',
    lat: 33.7583,
    lng: -84.3898,
    zoning: 'LandUsePlanning/MapServer/0',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'parcel', substr: 'TaxParcel/MapServer/0' }],
    optional: [
      {
        label: 'zoning overlay',
        substr: 'LandUsePlanning/MapServer/1',
        publishes: 'false-absence',
        loses: { field: 'zoning.subdistrict' },
        why: 'the overlay label is published as the subdistrict; a failed read falls through to the base zoning code, so the overlay reads as absent',
        // `historic ?? overlayLabel ?? ZONINGCODE`: the historic sibling has to
        // be masked for this layer to reach the field at all, and the label has
        // to be distinctive or the fall-through to ZONINGCODE returns the same
        // 'X1' and the failure looks like no change.
        mask: ['LandUsePlanning/MapServer/6'],
        activate: [{ substr: 'LandUsePlanning/MapServer/1', attrs: { LABEL: 'OVERLAY-PROBE', ZONECLASS: 'OVERLAY-PROBE' } }],
      },
      historic('LandUsePlanning/MapServer/6'),
      flood(),
    ],
  },
  {
    city: 'dallas',
    lat: 32.779,
    lng: -96.8017,
    zoning: 'sdc_public/Zoning/MapServer/15',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'parcel', substr: 'DallasTaxParcels' }],
    optional: [
      {
        label: 'city limits gate',
        substr: 'CityLimits',
        publishes: 'gate-open',
        why: 'the Highland Park / University Park gate: an empty answer is OUT_OF_BBOX, a failed one deliberately opens (see the GATES block)',
      },
      {
        label: 'PD subdistricts',
        substr: 'sdc_public/Zoning/MapServer/9',
        publishes: 'false-absence',
        loses: { field: 'zoning.subdistrict' },
        why: 'the planned-development subdistrict is published as the subdistrict; a failed read publishes none, which reads as a parcel outside any PD subdistrict',
        activate: [{ substr: 'sdc_public/Zoning/MapServer/9', attrs: { '*': 'PD-SUBDISTRICT-PROBE' } }],
      },
      historic('sdc_public/Zoning/MapServer/2'),
      {
        label: 'specific use permits',
        substr: 'sdc_public/Zoning/MapServer/4',
        publishes: 'silent-removal',
        loses: { hurdle: 'specific use permit is recorded here' },
        why: 'a failed read removes the SUP hurdle — changing the use is a council action — and nothing says a check did not run',
      },
      flood(),
    ],
  },
  {
    city: 'lasvegas',
    lat: 36.1729,
    lng: -115.1541,
    zoning: 'DevelopmentServices/Zoning/MapServer/0',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'parcel', substr: 'Parcel_Info/MapServer/0' }],
    optional: [
      {
        label: 'jurisdiction gate',
        substr: 'Jurisdictions',
        publishes: 'gate-open',
        why: 'the Clark County / Henderson gate: an empty answer is OUT_OF_BBOX, a failed one deliberately opens (see the GATES block)',
      },
      flood(),
    ],
    // Las Vegas queries NO historic layer: no City service publishes the HD-O
    // boundary (19 service folders enumerated twice), so `historicDistrict` is
    // null unconditionally and there is no read here to fail. Recorded as an
    // answer, not an omission — uncheckedOverlays.test.ts pins it by name.
  },
  {
    city: 'phoenix',
    lat: 33.4934,
    lng: -112.0844,
    zoning: 'Zoning/MapServer/0',
    onZoningFail: 'refuse',
    onZoningEmpty: 'unknown',
    alsoRequired: [{ label: 'parcel', substr: 'COUNTY_PARCELS/MapServer/3' }],
    optional: [
      {
        label: 'city boundary gate',
        substr: 'CityBoundary',
        publishes: 'gate-open',
        why: 'the Scottsdale gate: an empty answer is OUT_OF_BBOX, a failed one deliberately opens (see the GATES block)',
      },
      {
        label: 'zoning overlays',
        substr: 'ZoningOverlays/MapServer/0',
        publishes: 'silent-removal',
        loses: { hurdle: 'An overlay is mapped here' },
        why: 'a failed read removes the row saying an overlay is mapped whose standards this tool does not resolve — the one place the report warns the base district may not bind',
      },
      historic('HistoricProperties/MapServer/0'),
      {
        label: 'assessor supplement',
        substr: 'COUNTY_PARCELS/MapServer/4',
        publishes: 'false-value',
        loses: { field: 'existing.yearBuilt' },
        movesCostTotal: true,
        // Measured with the assessor columns populated (1962 / 1,800 sf / 1
        // storey / FCV $500,000): the faulted run publishes none of them AND
        // costs.total moves, because the demolition term is sized from the
        // recorded building area.
        why: 'year built, building area, storeys and assessed value all come from this second hop; a failed read publishes a parcel with no recorded building and a construction total that has silently lost its demolition term',
        activate: [
          {
            substr: 'COUNTY_PARCELS/MapServer/4',
            attrs: { CONST_YEAR: 1962, LIVING_SPACE: 1800, NUMBER_STORIES: 1, FCV_CUR: 500000, LPV_CUR: 400000, TAX_YR_CUR: 2025 },
          },
        ],
      },
      flood(),
    ],
  },
]

/** The jurisdiction gates, which answer independently of zoning and must keep
 *  producing their own copy — the Dallas / Highland Park path.
 *
 *  DERIVED from the `gate-open` declarations above rather than hand-listed, and
 *  then reconciled against `GATED_CITIES` in ../jurisdiction.ts by the test
 *  below. Hand-listing it was one more place the set of gated cities could be
 *  stated, and this file's whole argument is that a set stated twice drifts:
 *  when this table held four cities, eight others were publishing their
 *  neighbours' land and nothing here could see it. */
const GATES = CASES.flatMap((c) =>
  (c.optional ?? [])
    .filter((l) => l.publishes === 'gate-open')
    .map((l) => ({ city: c.city, substr: l.substr })),
)

/** Nashville is gated and is NOT in `GATES`, because its gate is not a separate
 *  read: Metro's own zoning layer labels satellite-city polygons, so the gate
 *  and the required zoning read are the same request and the perturbations
 *  below (empty the gate, fault the gate) are already the zoning perturbations.
 *  Named here rather than filtered silently — an unexplained exclusion is how a
 *  city drops out of a coverage set. */
const GATE_IN_BAND = ['nashville']

/** One shared harness with hardBlockInputs.test.ts — see
 *  ./__fixtures__/upstreamProbe.ts for why it lives in one place. */
const run = (c: Pick<Case, 'city' | 'lat' | 'lng'>, opts: ProbeOptions = {}) => probe(getParcelInfo, c, opts)

describe('required-upstream state split, across every live provider', () => {
  afterEach(() => vi.restoreAllMocks())

  it('covers exactly the cities the dispatcher serves', () => {
    expect(CASES.map((c) => c.city).sort()).toEqual([...LIVE_CITIES].sort())
    expect(CASES.length).toBeGreaterThan(0)
  })

  it.each(CASES)('$city: a healthy run publishes a real district', async (c) => {
    const r = await run(c)
    expect(r.ok).toBe(true)
    // Not 'Unknown' — otherwise every perturbation below would be comparing
    // one gap against another and could not tell them apart.
    expect(r.district).toBe('X1')
  })

  it.each(CASES)('$city: a FAILED zoning fetch does not become a coverage claim', async (c) => {
    const r = await run(c, { fail: c.zoning })
    // Guarantee 2: the substring really routed. A stale URL would make this
    // whole assertion vacuous, so it fails loudly instead.
    expect(r.hits).toBeGreaterThan(0)
    if (c.onZoningFail === 'fallback') {
      // Nashville: the parcel layer's copy answers, so this is a real district
      // and not a manufactured 'Unknown'.
      expect(r.ok).toBe(true)
      expect(r.district).toBe('X1')
      return
    }
    expect(r.ok).toBe(false)
    expect(r.code).toBe('UPSTREAM_ERROR')
    // The copy must attribute the failure to the SERVICE and must not restate
    // the claim it replaces (CLAUDE.md rule 21).
    expect(r.message).not.toMatch(/coverage|neighbou?ring city|unincorporated|undevelopable/i)
  })

  it.each(CASES)('$city: an EMPTY zoning answer is still an ANSWER', async (c) => {
    // This is the half that must NOT change. A parcel genuinely outside the
    // city's zoning — Huntersville, Henderson, Manhattan Beach, Scottsdale —
    // has to keep getting the no-coverage copy, which is correct and useful.
    const r = await run(c, { empty: c.zoning })
    expect(r.hits).toBeGreaterThan(0)
    if (c.onZoningEmpty === 'no-parcel') {
      expect(r.ok).toBe(false)
      expect(r.code).toBe('NO_PARCEL')
      return
    }
    expect(r.ok).toBe(true)
    expect(r.district).toBe(c.onZoningEmpty === 'fallback' ? 'X1' : 'Unknown')
  })

  const EXTRA = CASES.flatMap((c) => (c.alsoRequired ?? []).map((r) => ({ ...c, layer: r })))
  it.each(EXTRA)('$city: a failed $layer.label read refuses too', async (c) => {
    const r = await run(c, { fail: c.layer.substr })
    expect(r.hits).toBeGreaterThan(0)
    expect(r.ok).toBe(false)
    expect(r.code).toBe('UPSTREAM_ERROR')
  })

  it.each(GATES)('$city: the jurisdiction gate still answers, zoning up or down', async (g) => {
    const c = CASES.find((x) => x.city === g.city)!
    // Outside the city: the gate layer ANSWERS with zero features.
    const outside = await run(c, { empty: g.substr })
    expect(outside.hits).toBeGreaterThan(0)
    expect(outside.ok).toBe(false)
    expect(outside.code).toBe('OUT_OF_BBOX')

    // Still OUT_OF_BBOX with the zoning layer down as well. The gate is checked
    // FIRST precisely so a complete answer is not traded for "we couldn't reach
    // the service" — this is the Dallas / Highland Park path.
    const both = await run(c, { fail: c.zoning, empty: g.substr })
    expect(both.ok).toBe(false)
    expect(both.code).toBe('OUT_OF_BBOX')
  })

  it.each(GATES)('$city: the jurisdiction gate still fails OPEN when it errors', async (g) => {
    // Deliberate, and unchanged by this work: refusing a real in-city address
    // because a boundary layer timed out is worse than the thing the gate
    // prevents. A failed gate is not a finding about the parcel.
    const c = CASES.find((x) => x.city === g.city)!
    const r = await run(c, { fail: g.substr })
    expect(r.hits).toBeGreaterThan(0)
    expect(r.ok).toBe(true)
  })

  it('nashville refuses when the zoning fetch failed AND the fallback is empty', async () => {
    const c = CASES.find((x) => x.city === 'nashville')!
    let hits = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes(c.zoning)) {
        hits++
        throw new Error('probe: transport failure')
      }
      const body = synth(url) as { features: Array<{ attributes: Record<string, unknown> }> }
      // Drop the parcel layer's denormalised copy — the one state the fallback
      // cannot cover, and the only one where 'Unknown' would be manufactured.
      if (url.includes('Cadastral/Parcels')) delete body.features[0].attributes.Zoning
      return new Response(JSON.stringify(body), { status: 200 })
    }) as typeof fetch)
    const res = await getParcelInfo('nashville', c.lat, c.lng)
    expect(hits).toBeGreaterThan(0)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE OPTIONAL HALF: what a failed optional read PUBLISHES.
//
// Three runs per layer, at both published entry points:
//
//   control  every layer answers, this one with a value its consumer can use
//   empty    this layer answers with zero features            — an ANSWER
//   fail     this layer throws                                — a GAP
//
// and the decision is one comparison: **is `fail` distinguishable from
// `empty`?** If it is, the report can tell a gap from an answer and the layer
// is `disclosed-gap`. If it is not, the failure has been published AS an answer,
// and what the answer says — a missing hurdle, a missing limit, a moved total —
// is the category. That is CLAUDE.md rule 5's split, asked of the payload
// rather than of the provider, which is the only place it can be seen: the
// Miami defect that started this was a faulted run that came back BYTE
// IDENTICAL to its control, and identity is not visible from inside a provider.

/** Layers whose failure is published as an answer. RECORDED, NOT ENDORSED.
 *
 *  Every entry is a live defect of the class this file guards, measured at the
 *  entry points below and left open deliberately — the fixes are per-city
 *  product decisions (disclose the gap? refuse the parcel?) and are not
 *  something an instrument should make on the way past.
 *
 *  What catches a NEW defect is the LAYER'S OWN declaration, not this list: a
 *  provider that stops marking a gap fails the assertion naming that mark, in
 *  the entry that names that layer. What this list adds is the second half —
 *  the INVENTORY of accepted defects cannot move without someone saying so:
 *
 *    · closing one turns this red until its declaration is changed to
 *      `disclosed-gap`, so a fix cannot land while the table still describes
 *      the parcel data as unreliable in a way it no longer is;
 *    · adding one is a deliberate edit, in a list a reviewer reads.
 *
 *  Do not add a row here to make a failing test pass. Adding a row is a claim
 *  that a published falsehood is known and accepted. */
const KNOWN_OPEN = [
  'sandiego.coastal height overlay',
  'sanjose.general plan',
  'raleigh.NCOD overlay',
  'raleigh.TOD overlay',
  'milwaukee.DIZ overlay',
  'milwaukee.SPROZ overlay',
  'milwaukee.NC overlay',
  'columbus.planning overlays',
  'columbus.commercial overlays',
  'atlanta.zoning overlay',
  'dallas.PD subdistricts',
  'dallas.specific use permits',
  'phoenix.zoning overlays',
  'phoenix.assessor supplement',
] as const

const DEFECT_CATEGORIES = ['false-absence', 'false-value', 'silent-removal'] as const
const isDefect = (l: OptionalLayer): boolean =>
  (DEFECT_CATEGORIES as readonly string[]).includes(l.publishes)

/** The project the published-surface probe prices. One spec, deliberately: the
 *  parcel payload does not depend on it at all, and the report assertions below
 *  are about rows and totals that this spec produces in every city (asserted by
 *  the control test, which requires hurdles and months to be non-trivial). */
const PROJECT = { use: 'residential', gfa: '60000', units: '60', projectType: 'new', funding: 'private' }

// A fresh client IP per call. analyze.ts rate-limits at 20/min per IP and this
// block makes several hundred calls; sharing an IP would turn the table into
// RATE_LIMITED non-answers — a run that measures nothing and says so nowhere.
let callN = 0
const analyze = (qs: Record<string, string>) => {
  const n = callN++
  return invokeHandler(analyzeHandler, {
    queryStringParameters: qs,
    headers: { 'x-forwarded-for': `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}` },
  })
}

const publishAt = (c: Case): { city: string; lat: number; lng: number } => ({
  city: c.city,
  lat: c.publishAt?.[0] ?? c.lat,
  lng: c.publishAt?.[1] ?? c.lng,
})

const publish = (c: Case, opts: ProbeOptions = {}) =>
  publishProbe({ getParcelInfo, analyze }, publishAt(c), PROJECT, opts)

/** The three runs one layer needs, with its siblings and public-only layers
 *  held in the state an ordinary private parcel puts them in. */
const threeRuns = async (c: Case, l: OptionalLayer) => {
  const held = [...(c.publicOnly ?? []), ...(l.mask ?? [])]
  const shared = { inject: l.activate, pin: l.substr }
  return {
    // No `pin` on the control: nothing is perturbed there, so its hit count
    // would only repeat what the two perturbed runs already assert.
    control: await publish(c, { inject: l.activate, empty: held }),
    empty: await publish(c, { ...shared, empty: [l.substr, ...held] }),
    fail: await publish(c, { ...shared, fail: l.substr, empty: held }),
  }
}

const at = (o: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((v, k) => (v == null ? undefined : (v as Record<string, unknown>)[k]), o)

interface Hurdle {
  label: string
  status: string
  note?: string
}
const hurdlesOf = (r: PublishRun): Hurdle[] => (r.report.hurdles as Hurdle[] | undefined) ?? []
const unresolvedOf = (r: PublishRun): readonly string[] =>
  ((r.parcel.overlays as { unresolved?: readonly string[] } | undefined)?.unresolved ?? [])
const uncheckedOf = (r: PublishRun): string[] =>
  hurdlesOf(r)
    .filter((h) => h.status === 'unchecked')
    .map((h) => h.label)
const totalOf = (r: PublishRun): unknown => at(r.report, 'costs.total')
/** Label OR note: some rows carry the requirement in the sentence under the
 *  heading, and a hurdle that survives with its substance removed is not the
 *  hurdle. */
const hasHurdle = (r: PublishRun, needle: string): boolean =>
  hurdlesOf(r).some((h) => `${h.label} ${h.note ?? ''}`.includes(needle))

/** Everything the report says about a check NOT having run. A defect entry is
 *  one where this is identical on the failed run and the answered run. */
const gapMarkers = (r: PublishRun): string =>
  JSON.stringify({ unresolved: [...unresolvedOf(r)].sort(), unchecked: uncheckedOf(r).sort() })

const LAYERS = CASES.flatMap((c) => c.optional.map((layer) => ({ c, layer, id: `${c.city}.${layer.label}` })))

describe('what every OPTIONAL layer’s failure publishes', () => {
  beforeAll(() => {
    // `reverseGeocode` returns before fetching when no token is set, so the
    // three address entries would silently never be probed anywhere `.env` is
    // absent — CI. The inventory test below would then fail rather than pass
    // quietly, which is the right direction, but pinning the token here is what
    // makes the inventory the SAME inventory in every environment.
    vi.stubEnv('MAPBOX_TOKEN', 'probe-token')
  })
  afterAll(() => vi.unstubAllEnvs())
  afterEach(() => vi.restoreAllMocks())

  // ── Rule 20, the version that matters here ────────────────────────────────
  // A table of optional layers is worth nothing if a provider can read a layer
  // that is not in it. So the inventory is not asserted against itself: the
  // provider is RUN, every request it makes is recorded, and the two sets are
  // compared in both directions. Add a layer to a provider and this fails until
  // someone states what its failure publishes; stop reading one and it fails
  // too, rather than leaving a declaration that quietly tests nothing.
  //
  // This is the runtime analogue of hardBlockInputs.test.ts's compile-time
  // `Exclude<>` pair, for a set the type system cannot see.
  it.each(CASES)('$city: every read it issues is declared, and every declaration routes', async (c) => {
    const urls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL) => {
      const url = String(input)
      urls.push(url)
      return new Response(JSON.stringify(synth(url)), { status: 200 })
    }) as typeof fetch)
    const res = await getParcelInfo(c.city, c.lat, c.lng)
    expect(res.ok).toBe(true)

    const declared = [
      c.zoning,
      ...(c.alsoRequired ?? []).map((r) => r.substr),
      ...c.optional.map((l) => l.substr),
    ]
    const seen = [...new Set(urls.map((u) => u.split('?')[0]))]
    expect(seen.length).toBeGreaterThan(0)

    // Direction 1: nothing this provider reads is undeclared.
    expect(seen.filter((u) => !declared.some((d) => u.includes(d)))).toEqual([])
    // Direction 2: nothing declared has stopped being read. A renamed upstream
    // URL turns every perturbation below into a no-op (CLAUDE.md rule 11).
    expect(declared.filter((d) => !seen.some((u) => u.includes(d)))).toEqual([])
    // …and each substring names ONE layer. 'PlanningData/MapServer/3' also
    // matched layer 35, so faulting "the zoning layer" faulted the land-use
    // layer too and the perturbation was not about the layer it named.
    for (const d of declared) expect([d, seen.filter((u) => u.includes(d)).length]).toEqual([d, 1])
  })

  it('declares at least one optional layer for every city, and the ids are unique', () => {
    expect(LAYERS.length).toBeGreaterThanOrEqual(CASES.length)
    for (const c of CASES) expect([c.city, c.optional.length > 0]).toEqual([c.city, true])
    expect(new Set(LAYERS.map((l) => l.id)).size).toBe(LAYERS.length)
  })

  it('pins the layers whose failure is published as an answer', () => {
    expect(LAYERS.filter((l) => isDefect(l.layer)).map((l) => l.id)).toEqual([...KNOWN_OPEN])
    // Non-empty, so the membership assertion cannot be satisfied by a table
    // that has quietly stopped classifying anything (CLAUDE.md rule 20).
    expect(KNOWN_OPEN.length).toBeGreaterThan(0)
  })

  it('keeps the gate declarations and the GATES table saying the same thing', () => {
    const fromOptional = LAYERS.filter((l) => l.layer.publishes === 'gate-open').map((l) => `${l.c.city}.${l.layer.substr}`)
    expect(fromOptional.sort()).toEqual(GATES.map((g) => `${g.city}.${g.substr}`).sort())
  })

  // Rule 20, and the specific way this file could have gone quietly green: the
  // registry could gain a gate that no provider actually issues, or a provider
  // could stop issuing one, and every perturbation here would still pass while
  // covering one city fewer. The two sets are pinned to each other.
  it('covers exactly the cities ../jurisdiction.ts says are gated', () => {
    const perturbed = [...new Set([...GATES.map((g) => g.city), ...GATE_IN_BAND])].sort()
    expect(perturbed).toEqual([...GATED_CITIES].sort())
    expect(perturbed.length).toBeGreaterThan(0)
  })

  it('states why for every declared layer', () => {
    for (const { id, layer } of LAYERS) expect([id, layer.why.length > 40]).toEqual([id, true])
  })

  // ── The control, and why it is a rule-20 guard rather than a smoke test ────
  // Every perturbation below reads a difference between two published payloads.
  // A parcel the civic hard block stops publishes no hurdles, no months and no
  // costs AT ALL, so every one of those differences is zero and every layer
  // reads as harmless. Boston's, Denver's, Minneapolis's, Philadelphia's, San
  // Diego's and San Jose's standard probe points are City Hall; `publishAt`
  // moves them, and this is what holds the move in place.
  it.each(CASES)('$city: the control run publishes a substantive report', async (c) => {
    const r = await publish(c, { empty: c.publicOnly ?? [] })
    expect(r.report.developable).toBe(true)
    expect(at(r.parcel, 'zoning.districtCode')).toBe('X1')
    expect(hurdlesOf(r).length).toBeGreaterThan(0)
    expect(Number(at(r.report, 'timeline.months'))).toBeGreaterThan(0)
    expect(Number(totalOf(r))).toBeGreaterThan(0)
  })

  // ── The perturbation ──────────────────────────────────────────────────────
  it.each(LAYERS)('$id: its failure publishes what it declares', async ({ c, layer }) => {
    const { control, empty, fail } = await threeRuns(c, layer)

    // The substring really routed a request in both perturbed runs. A renamed
    // upstream URL turns a probe into a no-op that passes by testing nothing —
    // the failure that makes an instrument worthless (CLAUDE.md rule 11).
    expect(empty.hits).toBeGreaterThan(0)
    expect(fail.hits).toBeGreaterThan(0)

    // The failure actually moved something. A layer whose consumer stays dead —
    // because the harness fed it a value nothing can use — makes every
    // comparison below vacuous, and reads as "this failure is harmless".
    //
    // The gates are the one exception, and it is the declaration itself: a gate
    // that fails OPEN is SUPPOSED to publish exactly what the control publishes.
    // What proves that layer live is its empty run, which must still be
    // OUT_OF_BBOX — asserted in the gate arm below.
    if (layer.publishes !== 'gate-open') {
      expect([layer.label, control.raw === fail.raw]).toEqual([layer.label, false])
    }

    const distinguished = fail.raw !== empty.raw
    switch (layer.publishes) {
      case 'disclosed-gap': {
        if ('unresolved' in layer.discloses) {
          const key = layer.discloses.unresolved
          // The specific mark first, so a provider that stops marking reports
          // WHICH disclosure went missing rather than the generic fact that a
          // failure became indistinguishable from an answer.
          expect(unresolvedOf(fail)).toContain(key)
          // Both directions: an ANSWER must not be marked, or the disclosure
          // becomes wallpaper on every parcel in the city.
          expect(unresolvedOf(empty)).not.toContain(key)
          expect(unresolvedOf(control)).not.toContain(key)
        } else {
          const path = layer.discloses.gapField
          // An ANSWER states something; a GAP states nothing. Both directions,
          // because a field that is empty either way discloses nothing at all.
          expect(at(empty.parcel, path)).toEqual(layer.discloses.answeredValue)
          expect(at(fail.parcel, path) ?? null).toBeNull()
        }
        // …and the two payloads really are different documents. A mark that is
        // set and then dropped downstream would satisfy the assertions above
        // while publishing the same report either way.
        expect(distinguished).toBe(true)
        return
      }
      case 'fallback': {
        // A second source carries the same fact, so the run still publishes a
        // real district rather than the manufactured 'Unknown'.
        expect(fail.report.developable).toBe(true)
        expect(at(fail.parcel, 'zoning.districtCode')).toBe('X1')
        expect(layer.secondSource.length).toBeGreaterThan(10)
        return
      }
      case 'gate-open': {
        // Deliberate and unchanged: an empty gate is OUT_OF_BBOX, a failed gate
        // is not a finding about the parcel.
        expect(fail.parcel.error).toBeUndefined()
        expect(empty.parcel.error).toBe('OUT_OF_BBOX')
        return
      }
      case 'placeholder': {
        expect(distinguished).toBe(false)
        // The value published on failure is the pinned non-claim, and it is the
        // same one an empty answer produces — no address is invented.
        expect(at(fail.parcel, layer.placeholder.path)).toBe(layer.placeholder.value)
        expect(at(empty.parcel, layer.placeholder.path)).toBe(layer.placeholder.value)
        expect(at(control.parcel, layer.placeholder.path)).not.toBe(layer.placeholder.value)
        return
      }
      default: {
        // ── The recorded defects ──────────────────────────────────────────
        // The signature is the failure being INDISTINGUISHABLE from an answer,
        // and nothing in the report saying a check did not run.
        expect(distinguished).toBe(false)
        expect(gapMarkers(fail)).toBe(gapMarkers(empty))
        if ('hurdle' in layer.loses) {
          expect(hasHurdle(control, layer.loses.hurdle)).toBe(true)
          expect(hasHurdle(fail, layer.loses.hurdle)).toBe(false)
        } else {
          const path = layer.loses.field
          expect(at(control.parcel, path)).not.toEqual(at(fail.parcel, path))
          expect(at(fail.parcel, path)).toEqual(at(empty.parcel, path))
        }
        if (layer.publishes === 'false-value') {
          // A number inside the published total moved on a transport failure.
          expect(totalOf(fail)).not.toEqual(totalOf(control))
        }
      }
    }
  })
})
