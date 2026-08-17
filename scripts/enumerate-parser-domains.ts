// Enumerate the REAL value space of every field a parser consumes, and report
// the values that parser does not handle.
//
// WHY THIS EXISTS
// The LA defect (2026-08-04) was a parser whose input domain was narrower than
// the source's actual output: the qualifier strip knew [Q]/(Q)/[T]/(T), and LA
// also publishes (F) and (WC). 14 of 2,128 distinct strings mis-parsed, and both
// failure modes OVERSTATED the envelope.
//
// That class is invisible to everything else we have:
//   · no null is produced — the parser returns a confident number
//   · no test fails — the tests exercise the forms we thought of
//   · no schema violation — the value is a legal string for that field
//
// Q1 ("does the source publish what we derive?") and Q2 ("joint dependency?")
// both ask what the source PUBLISHES. This asks what the source actually
// EMITS, and those differ whenever a schema is more permissive than its
// documentation — which is always.
//
// Unlike the other sweep questions this one is mechanically runnable and
// re-runnable when a city republishes. Run it with:
//   npx vite-node scripts/enumerate-parser-domains.ts
//
// ⚠️ 2026-08-05: the first version of this script read `.maxFAR` / `.maxHeightFt`
// off resolvers that return `{ far, heightFt }`. Every value came back
// `undefined`, so Chicago reported 1,528 unhandled classes and NYC 203 — both
// entirely false, and both reported as findings before being caught. That is
// CLAUDE.md rule 11 (measure the pipeline, not your probe) committed by the very
// script written to enforce it. `scripts/` is now inside the typecheck so a
// nonexistent property is a build error rather than a silent `undefined`.

import { resolveDenver } from '../netlify/functions/lib/zoning/denver'
import { resolveMiami } from '../netlify/functions/lib/zoning/miami'
import { resolveSeattle } from '../netlify/functions/lib/zoning/seattle'
import { resolveMinneapolisFar } from '../netlify/functions/lib/zoning/minneapolis'
import { resolveChicago } from '../netlify/functions/lib/zoning/chicago'
import { resolveSfFar } from '../netlify/functions/lib/zoning/sf'
import { resolveNyc } from '../netlify/functions/lib/zoning/nyc'
import { parseMaxFAR, parseMaxHeightFt } from '../netlify/functions/lib/zoning/philadelphia'
import { parseSanJoseHeightFt } from '../netlify/functions/lib/providers/sanjose'
import { resolveAtlanta } from '../netlify/functions/lib/zoning/atlanta'
import { resolveCharlotte } from '../netlify/functions/lib/zoning/charlotte'
import { resolveColumbus } from '../netlify/functions/lib/zoning/columbus'
import { resolveDallas } from '../netlify/functions/lib/zoning/dallas'
import { resolveLasVegas } from '../netlify/functions/lib/zoning/lasvegas'
import { resolveMilwaukee } from '../netlify/functions/lib/zoning/milwaukee'
import { resolveNashville } from '../netlify/functions/lib/zoning/nashville'
import { resolvePhoenix } from '../netlify/functions/lib/zoning/phoenix'
import { resolveRaleigh } from '../netlify/functions/lib/zoning/raleigh'
import { resolveSanDiego } from '../netlify/functions/lib/zoning/sandiego'
import { austinSfLimits } from '../netlify/functions/lib/providers/austin'
import { laLimits } from '../netlify/functions/lib/providers/la'
import { isPlannedDevelopment } from '../netlify/functions/lib/zoning/plannedDevelopment'
import { isFormerChapter59 } from '../netlify/functions/lib/providers/denver'
import { readEnumeration } from './enumerate-zones'
import { dcLimits } from '../netlify/functions/lib/providers/dc'

interface Target {
  city: string
  /** Human label for what is being parsed. */
  what: string
  /** ArcGIS layer/table to enumerate. */
  url: string
  field: string
  /** True when the parser is EXPECTED to reject some values (e.g. a FAR module
   *  scoped to one zone family). Those are reported separately from surprises.
   *
   *  ⚠️ ALL-OR-NOTHING, and that is a trap worth naming. Setting this removes
   *  EVERY unhandled value on the target from the total, so a scope that
   *  genuinely explains a handful of codes silently excuses the rest. It did
   *  exactly that here: a note added to Denver to declare the nine CMP campus
   *  districts took all 58 of its unhandled codes out of the total, dropping it
   *  753 → 695 with no code change and no visible cause.
   *
   *  Use it ONLY where the parser's whole domain is narrower than the field, and
   *  verify that rather than asserting it. Auditing all six coarse declarations
   *  on 2026-08-17 found three accurate and three not: seattle (NC/C only),
   *  chicago (residential only) and nyc (PLUTO supplies FAR numerically) each
   *  account for every unhandled value on their target, while atlanta left 10,
   *  austin 5 and sandiego 139 excused by sentences that do not describe them.
   *  Those three are now `partiallyScoped`, which raised the total 729 → 883.
   *
   *  An earlier version of this note offered Austin as the example of a
   *  legitimately target-wide scope. It is not one: its scope reads
   *  "single-family zones only" and five single-family zones were unhandled, so
   *  the sentence could not excuse them. For a scope covering PART of a target,
   *  use `partiallyScoped` below, which keeps the remainder counted. */
  scopedTo?: string
  /** A scope covering SOME of a target's values. Returns a reason when this
   *  specific value is out of scope, null when it is a genuine gap. Only the
   *  values it names drop out of the total — the rest keep counting, which is
   *  the difference between declaring a scope and erasing a target. */
  partiallyScoped?: { label: string; explains: (v: string) => boolean }
  /** Returns true when the parser produced a usable answer for this value. */
  handled: (v: string) => boolean
}

const ORG_PHL = 'https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services'

export const TARGETS: Target[] = [
  // ── THE THIRTEEN CITIES THAT WERE NEVER IN THIS SWEEP (added 2026-08-17) ──
  //
  // Layers and fields taken from scripts/zoneRegistry.ts, every one CONFIRMED
  // against the live layer's own metadata by `enumerate-zones.ts --verify-fields`.
  // Seven of the 22 registry entries were wrong on first write (case mismatches,
  // fields read out of the wrong array) and none was findable by proofreading —
  // so these are the verified forms, not the ones I typed.
  //
  // ⚠️ EVERY `handled` PREDICATE READS A DIFFERENT FIELD NAME, and that is the
  // rule 11 trap this script is itself in the ledger for: the first version read
  // `.maxFAR` off resolvers returning `{ far, heightFt }` and reported Chicago
  // 1,528 unhandled when Chicago resolves 63. phoenix returns `height`, lasvegas
  // `maxHeightFt`, nashville `maxFAR`, atlanta `heightFt`. `scripts/` is inside
  // the typecheck, so a nonexistent property is now a build error rather than a
  // silent `undefined`.
  //
  // ⚠️ AN ORDINANCE-GOVERNED CODE IS ANSWERED, NOT UNHANDLED. The first run of
  // these targets reported 2,294 surprises — Dallas alone 1,031 of 1,077 (95.7%)
  // for a module with 151 sourced values and per-value citations. Sampling
  // showed 1,000 of those were `PD ###`, and LA's were `(Q)C2-2D` D-limitation
  // codes routed to planned-development earlier the same day. Both are ANSWERS
  // ("the limit is in that ordinance"), and counting them as gaps was the
  // rule 16 shape exactly: a result surprising in the direction that implies
  // work. Reconciled against the known-good BEFORE the number was reported.
  //
  // HANDLED MEANS "PRODUCED AN ANSWER", INCLUDING AN ESTABLISHED ABSENCE.
  // `farUnconstrained` / `heightUnconstrained` / `planGoverned` are answers under
  // rule 5, not gaps — counting them as unhandled would report a city as broken
  // for correctly saying "no limit applies here".
  {
    city: 'atlanta', what: 'zone class → height/FAR',
    url: 'https://gis.atlantaga.gov/dpcd/rest/services/LandUsePlanning/LandUsePlanning/MapServer/0', field: 'ZONECLASS',
    // zoning/atlanta.ts records this gap by family and by ACREAGE — "SPI 6,566
    // ac · HC-20 884 ac · NC 298 ac · Poncey-Highland 184 ac · LD 38 ac" — and
    // states why: "The SPI chapters were deliberately NOT curated here rather
    // than curated quickly", because each publishes a per-subarea grid that runs
    // together when flattened, the shape that produced DC's MU column off-by-one.
    // A documented refusal to curate is not a parse surprise.
    // PARTIAL, converted 2026-08-17. The stated scope names five families and
    // accounts for 169 of the 179 unhandled values — the other TEN are outside
    // every family it names and were being excused by a declaration that does
    // not mention them. LW/LW-C (Live-Work), MRC-1/-2 and their -C conditional
    // variants, MR-3A-C and MR-4-C (conditional forms of curated districts), and
    // PD-H1/PD-H2 are real gaps.
    partiallyScoped: {
      label: 'SPI / HC-20 / NC / Poncey-Highland / LD deliberately uncurated — see zoning/atlanta.ts',
      explains: (v) => /^(SPI-|HC-20|NC-\d|Poncey-Highland|LD )/.test(v.trim()),
    },
    handled: (v) => { if (isPlannedDevelopment('atlanta', v)) return true; const r = resolveAtlanta(v); return r.heightFt != null || r.heightUnconstrained === true },
  },
  {
    city: 'austin', what: 'base zone → Subchapter F limits',
    url: 'https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/Current_Zoning_gdb/FeatureServer/0', field: 'BASE_ZONE',
    // PARTIAL, converted 2026-08-17. A scope reading "single-family zones only"
    // cannot excuse a SINGLE-FAMILY zone, and five of the 41 unhandled values are
    // exactly that: SF-4A, SF-4B, SF-5, SF-6 and SF2. Whether Subchapter F
    // reaches them is an open question against § 25-2 Subchapter F and is NOT
    // assumed here either way — they count as gaps until someone reads it, which
    // is the state a declaration should leave an unread question in.
    partiallyScoped: {
      label: 'non-single-family zones are outside Subchapter F',
      explains: (v) => !/^SF/i.test(v.trim()),
    },
    handled: (v) => austinSfLimits(v, true) != null,
  },
  {
    city: 'charlotte', what: 'zone description → height',
    url: 'https://gis.charlottenc.gov/arcgis/rest/services/PLN/Zoning/MapServer/0', field: 'ZoneDes',
    // `basis: 'site-plan'` IS AN ANSWER. Charlotte's (CD)/SPA/EX districts are
    // conditional or legacy: UDO Sec. 1.4.C leaves them governed by the
    // ordinances in force when approved plus their approved conditional-zoning
    // site plan, and the provider already emits that sentence. Counting them as
    // unhandled reported 114 of 218 — the Dallas shape, where a whole family is
    // out of scope by design rather than broken.
    handled: (v) => {
      const r = resolveCharlotte(v)
      return (
        r.basis === 'site-plan' ||
        r.residentialFt != null ||
        r.nonresidentialFt != null ||
        r.heightUnconstrained === true
      )
    },
  },
  {
    city: 'columbus', what: 'classification → height/FAR',
    url: 'https://maps2.columbus.gov/arcgis/rest/services/Applications/Zoning/MapServer/20', field: 'CLASSIFICATION',
    handled: (v) => { if (isPlannedDevelopment('columbus', v)) return true; const r = resolveColumbus({ classification: v, generalZoningCategory: v, heightDistrict: null }); return r.heightFt != null || r.farUnconstrained === true },
  },
  {
    city: 'dallas', what: 'long zone district → height/FAR',
    url: 'https://gis.dallascityhall.com/arcgis/rest/services/sdc_public/Zoning/MapServer/15', field: 'LONG_ZONE_DIST',
    handled: (v) => { if (isPlannedDevelopment('dallas', v)) return true; const r = resolveDallas(v); return r.heightFt != null || r.heightUnconstrained === true },
  },
  {
    city: 'la', what: 'ZONE_CMPLT → height/FAR/stories',
    url: 'https://maps.lacity.org/arcgis/rest/services/Mapping/NavigateLA/MapServer/71', field: 'ZONE_CMPLT',
    handled: (v) => { if (isPlannedDevelopment('la', v)) return true; const r = laLimits(v); return r.h != null || r.f != null || r.s != null },
  },
  {
    city: 'lasvegas', what: 'zone code → height/stories',
    url: 'https://mapdata.lasvegasnevada.gov/clvgis/rest/services/DevelopmentServices/Zoning/MapServer/0', field: 'ZONE',
    handled: (v) => { if (isPlannedDevelopment('lasvegas', v)) return true; const r = resolveLasVegas(v); return r.maxHeightFt != null || r.maxStories != null },
  },
  {
    city: 'milwaukee', what: 'zoning code → height/FAR',
    url: 'https://milwaukeemaps.milwaukee.gov/arcgis/rest/services/planning/zoning/MapServer/12', field: 'Zoning',
    handled: (v) => { const r = resolveMilwaukee(v); return r.heightFt != null || r.heightUnconstrained === true || r.planGoverned === true },
  },
  {
    city: 'nashville', what: 'zone description → FAR',
    url: 'https://maps.nashville.gov/arcgis/rest/services/Zoning_Landuse/Zoning/MapServer/14', field: 'ZONE_DESC',
    handled: (v) => { if (isPlannedDevelopment('nashville', v)) return true; const r = resolveNashville(v); return r.maxFAR != null || r.farUnconstrained === true },
  },
  {
    city: 'phoenix', what: 'zoning code → height',
    url: 'https://maps.phoenix.gov/pub/rest/services/Public/Zoning/MapServer/0', field: 'ZONING',
    handled: (v) => resolvePhoenix(v).height != null,
  },
  {
    city: 'raleigh', what: 'zoning string → height/stories',
    url: 'https://maps.raleighnc.gov/arcgis/rest/services/Planning/Zoning/MapServer/0', field: 'ZONING',
    handled: (v) => { const r = resolveRaleigh(v); return r.heightFt != null || r.stories != null || r.farUnconstrained === true },
  },
  {
    city: 'sandiego', what: 'zone name → FAR',
    url: 'https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0', field: 'ZONE_NAME',
    // Lot size and community plan are PARCEL facts, absent here. San Diego's RS
    // FAR is a lot-area band and its industrial FAR needs the community plan, so
    // passing null is honest: this measures the code-only domain, not the
    // resolver's full capability.
    // ⚠️ PARTIAL, converted 2026-08-17, and the worst offender by a wide margin.
    // The stated scope names RS lot-area bands and industrial community-plan
    // rules — which accounts for SIXTEEN of the 155 unhandled values. The other
    // 139 were excused by a sentence that does not describe them.
    //
    // Reconciled before the total was moved (rule 25), then READ 2026-08-17 and
    // the reconciliation was itself corrected. The 139 split as:
    //   · 83 Chapter 15 PLANNED DISTRICTS across 10 articles — the largest block
    //     in the city. See SAN_DIEGO_PLANNED_DISTRICTS in zoning/sandiego.ts for
    //     the article map and the two corrections the reading produced.
    //   · 56 commercial, office and mixed-use base zones — CC, CN, CO, CP, CR,
    //     CV, EMX, RMX, OC, OF, OP, OR, plus UNZONED. Plain gaps.
    //
    // ⚠️ TWO CLAIMS WRITTEN HERE WERE DISPROVEN BY READING THE SOURCE, and both
    // were stated with hedges that made them feel safe.
    //   1. This note said the PD-suffixed codes were VERY LIKELY the
    //      planned-development answer shape — a limit existing in its own
    //      ordinance. They are not. Chapter 15's articles publish Property
    //      Development Regulations as tables in the code, for named zones; all
    //      ten carry height and floor-area provisions. They are curatable gaps,
    //      and enrolling them as answers would have asserted "go read another
    //      document" about figures already inside a chapter we read for this
    //      city. "Very likely" is still a direction earned without a measurement
    //      (rule 1).
    //   2. It counted 68 and put Old Town's fifteen OT* codes in the plain-gap
    //      bucket, on the strength of their names lacking "PD". Old Town is
    //      Article 16 of this same chapter and every one of its fifteen codes is
    //      named in it. That is rule 27, and the count was 83.
    partiallyScoped: {
      label: 'RS lot-area bands and industrial community-plan rules need parcel facts',
      explains: (v) => /^(RS-|I[A-Z]?-\d|IBT-)/.test(v.trim()),
    },
    handled: (v) => { const r = resolveSanDiego(v, null); return r.maxFAR != null || r.farUnconstrained === true },
  },

  {
    city: 'denver', what: 'zone string → FAR/height/stories',
    url: 'https://denvergov.org/maps/data/Zoning/MapServer/1', field: 'ZONE_DISTRICT',
    // ⚠️ PASS THE LEGACY FLAG, AS THE PROVIDER DOES. Calling the resolver with
    // the zone alone and no options let the stories parse read former Chapter 59
    // CLASS codes as storey
    // counts — R-2 came back "2 storeys", B-3 "3", OS-1 "1" — so the sweep
    // counted them HANDLED while production correctly refuses them. The module
    // warns about exactly this ("Former Chapter 59 trailing numbers are class
    // codes, not story counts") and the protection lives entirely in the flag
    // the caller supplies. Measuring the resolver without it measured a layer,
    // not the pipeline (rule 11).
    //
    // The bare call is DESCRIBED rather than quoted above, because the guard in
    // sweepLayerDrift.test.ts scans this file for it — reproducing the faulty
    // call inside its own correction is rule 21's shape.
    // ⚠️ CODE-ONLY, AND THE CMP FAMILY IS WHY. Nine campus districts publish a
    // height CONDITIONED ON DISTANCE — CMP-H is 200 ft generally and 75 ft
    // within 125 ft of a Protected District — so a height exists for them on a
    // real parcel and cannot exist for a bare string. The provider resolves it
    // with a live buffer query; the sweep has no parcel to query from, so it
    // counts them unhandled.
    //
    // That is the SAFE direction, and it is declared rather than left silent:
    // Denver's unhandled figure UNDERSTATES what production resolves, and the
    // opposite arrangement — crediting a height the sweep cannot actually
    // establish — is the exact defect the legacy flag above was added to fix.
    // Read the number as "codes with no answer from the string alone".
    // PARTIAL, not target-wide. The nine CMP campus districts publish heights
    // conditioned on a per-parcel distance, so no answer exists for a bare
    // string. The other 46 unhandled codes are real gaps and keep counting — a
    // target-wide `scopedTo` here removed all 58 from the total at once.
    partiallyScoped: {
      label: 'CMP campus heights are conditioned on a per-parcel distance the sweep cannot measure',
      explains: (v) => /^CMP-/.test(v.trim().toUpperCase()),
    },
    // ⚠️ A FAR IS AN ANSWER TOO. Testing heightFt alone counted I-A and I-B as
    // gaps while the module resolves both at FAR 2.0, and OS-A while it is
    // flagged plan-governed. Denver is height-governed so height is the usual
    // carrier, but "this district resolved nothing" was false for three codes
    // that had resolved something — the sweep's own rule-5 distinction, applied
    // to the sweep.
    handled: (v) => {
      if (isPlannedDevelopment('denver', v)) return true
      const r = resolveDenver(v, { formerChapter59: isFormerChapter59(v) })
      return r.heightFt != null || r.far != null || r.planGoverned === true
    },
  },
  {
    city: 'miami', what: 'transect code → height/stories',
    url: 'https://gis.miami.gov/gis/rest/services/Zoning/ZoningMiami21/MapServer/5', field: 'M21_ZONE',
    handled: (v) => resolveMiami(v, null).heightFt != null,
  },
  {
    city: 'seattle', what: 'zone string → NC/C FAR',
    url: 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0',
    field: 'ZONING', scopedTo: 'NC/C only (SMC 23.47A.013)',
    handled: (v) => resolveSeattle(v).far != null,
  },
  {
    city: 'minneapolis', what: 'built-form code → FAR',
    url: 'https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/Planning_Zoning_Built_Form/FeatureServer/0',
    field: 'Abbrv', scopedTo: 'Interior 1/2/3 only',
    handled: (v) => resolveMinneapolisFar(v, 'UN1').maxFAR != null,
  },
  {
    city: 'chicago', what: 'zone class → residential base FAR',
    url: 'https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/Zoning_update/MapServer/15',
    field: 'ZONE_CLASS', scopedTo: 'residential districts only',
    handled: (v) => resolveChicago(v).far != null,
  },
  {
    city: 'dc', what: 'ZR16 district → FAR (2016 Zoning Regulations, Title 11 DCMR)',
    url: 'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCOZ/Zone_Mapservice/MapServer/24',
    field: 'ZR16', scopedTo: 'curated R/RF/RA/MU families; D and NC vary by sub-area',
    handled: (v) => dcLimits(v).f != null,
  },
  {
    city: 'sf', what: 'zoning code → §124 FAR',
    url: 'https://sfplanninggis.org/arcgiswa/rest/services/PlanningData/MapServer/3', field: 'zoning',
    handled: (v) => { const r = resolveSfFar(v); return r.maxFAR != null || r.residentialExempt },
  },
  {
    city: 'nyc', what: 'zoning district → limits',
    url: 'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0',
    field: 'ZoneDist1', scopedTo: 'PLUTO supplies FAR numerically; this is the curated table',
    handled: (v) => resolveNyc(v).far != null || resolveNyc(v).heightFt != null,
  },
  {
    city: 'philadelphia', what: 'free-text MaxFAR',
    url: `${ORG_PHL}/ZoningCodeCharacteristics/FeatureServer/0`, field: 'MaxFAR',
    handled: (v) => parseMaxFAR(v) != null,
  },
  {
    city: 'philadelphia', what: 'free-text MaxHeight',
    url: `${ORG_PHL}/ZoningCodeCharacteristics/FeatureServer/0`, field: 'MaxHeight',
    handled: (v) => parseMaxHeightFt(v) != null,
  },
  {
    city: 'sanjose', what: 'free-text HEIGHTLIMIT',
    // ⚠️ CORRECTED 2026-08-17. This pointed at PLN_Zoning_Height_Limit/MapServer/0,
    // which now returns 404 "Service not found" — and the sweep reported San Jose
    // UNREACHABLE for it. The PROVIDER never read that service: it reads
    // ${PLN}/84 "Specific Height Restriction", which is live. So the failure was
    // this file's stale declaration, not the city. Verified end-to-end: a live
    // downtown parcel returns districtCode DC and the layer answers at that point.
    url: 'https://geo.sanjoseca.gov/server/rest/services/PLN/PLN_Geocortex_Public_PRD/MapServer/84',
    field: 'HEIGHTLIMIT',
    handled: (v) => parseSanJoseHeightFt(v) != null,
  },
]

/**
 * The unhandled values for a city, using THE SWEEP'S OWN predicate over the
 * committed enumeration.
 *
 * ⚠️ EXISTS BECAUSE HAND-WRITTEN PROBES KEPT BEING WRONG. Three times in one
 * session a throwaway probe reimplemented a target's `handled` test and got it
 * wrong in a way that produced a confident answer: one read `.far` off a
 * resolver returning `.maxFAR` — the exact defect this script is in the ledger
 * for — and one fed Land_Use_Code values to a function that takes built-form
 * codes. Both were caught only by disbelieving a result that contradicted the
 * sweep, which works only while there IS a sweep to contradict.
 *
 * So: call the entry point, never an approximation of it. If a question cannot
 * be answered through this helper, that is a missing capability on the sweep
 * rather than a reason to write a probe.
 */
export function unhandledFor(city: string): Array<{ field: string; codes: string[] }> {
  const out: Array<{ field: string; codes: string[] }> = []
  for (const t of TARGETS.filter((x) => x.city === city)) {
    const e = readEnumeration(city)
    if (!e || e.field !== t.field) continue
    out.push({ field: t.field, codes: e.codes.filter((c) => !t.handled(c)) })
  }
  return out
}

async function distinctValues(url: string, field: string): Promise<string[] | null> {
  const qs = new URLSearchParams({
    where: '1=1', outFields: field, returnDistinctValues: 'true',
    returnGeometry: 'false', f: 'json',
  })
  try {
    const res = await fetch(`${url}/query?${qs}`)
    const d = (await res.json()) as { features?: { attributes: Record<string, unknown> }[]; error?: unknown }
    if (d.error || !d.features) return null
    const out = new Set<string>()
    for (const f of d.features) {
      const v = f.attributes[field]
      if (v != null && String(v).trim() !== '') out.add(String(v).trim())
    }
    return [...out].sort()
  } catch {
    return null
  }
}

;(async () => {
  let surprises = 0
  let unreachable = 0
  for (const t of TARGETS) {
    const vals = await distinctValues(t.url, t.field)
    if (vals == null) {
      console.log(`\n${t.city}/${t.field}  — LAYER UNREACHABLE (not a pass; re-run)`)
      unreachable++
      continue
    }
    const unhandled = vals.filter((v) => !t.handled(v))
    const pct = vals.length ? (100 * unhandled.length) / vals.length : 0
    console.log(`\n${t.city}/${t.field} — ${t.what}`)
    console.log(`  ${vals.length} distinct values · ${unhandled.length} unhandled (${pct.toFixed(1)}%)${t.scopedTo ? `  [scoped: ${t.scopedTo}]` : ''}`)
    if (unhandled.length) {
      console.log(`  unhandled: ${unhandled.slice(0, 24).join(' · ')}${unhandled.length > 24 ? ` …+${unhandled.length - 24}` : ''}`)
      if (!t.scopedTo) {
        // A PARTIAL scope subtracts only the values it names, and SAYS how many
        // — the composition, never a quietly smaller number (rule 26). A whole
        // target vanishing from the total is what the coarse flag above did.
        const ps = t.partiallyScoped
        const excused = ps ? unhandled.filter((v) => ps.explains(v)) : []
        if (ps) {
          console.log(
            `  of which ${excused.length} are declared out of scope (${ps.label}); ${unhandled.length - excused.length} count as gaps`,
          )
          // rule 20: a partial scope that stops matching would silently return
          // the target to its full count, which reads as a regression that never
          // happened. An empty exclusion means the predicate broke or the field
          // changed — either way it is not something to pass over in silence.
          if (excused.length === 0) {
            console.log(`  ⚠️ that partial scope matched NOTHING — the predicate or the field has drifted`)
            process.exitCode = 1
          }
        }
        surprises += unhandled.length - excused.length
      }
    }
  }
  console.log(`\n${'='.repeat(70)}`)
  // ⚠️ A TOTAL OVER A PARTIAL SET READS AS COMPLETE. Charlotte hit a transient
  // UNREACHABLE on one run and was silently dropped, so the total printed 715
  // instead of 751 — and the next run, with Charlotte back and Denver 16 codes
  // BETTER, printed 735. The number appeared to go UP after a fix. Nothing was
  // wrong except that a partial total wore the same format as a full one.
  //
  // Refuse to print it rather than footnote it: a figure that is only sometimes
  // the whole thing is worse than no figure, because the reader cannot tell
  // which run they are looking at (rule 20 — an empty or partial result and a
  // clean one must not render the same).
  if (unreachable > 0) {
    console.log(
      `NO TOTAL — ${unreachable} target(s) were unreachable this run, so any sum would be over a PARTIAL set.`,
    )
    console.log(`Re-probe those in isolation (rule 10) and re-run; transients have twice looked like findings.`)
    process.exitCode = 1
  } else {
    // ⚠️ NOT A DEFECT COUNT. It counts values the sweep cannot presently EXPLAIN,
  // which is a different quantity. This total has moved 2,294 → 1,009 → 1,010 →
  // 717 → 734 → 753 and NOT ONE movement was a code change — every one corrected
  // how the sweep counts. Until a parser fix moves it, the number measures the
  // instrument's correctness rather than the system's (rule 26).
  console.log(`UNEXPLAINED values (NOT a defect count — rule 26): ${surprises}`)
  console.log(`Reconcile the largest contributor against a known-good before acting on it.`)
  }
  console.log('Scoped parsers are EXPECTED to reject out-of-scope values — those')
  console.log('are gaps the null inventory already discloses, not parse failures.')
})()
