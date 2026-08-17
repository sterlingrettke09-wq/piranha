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
import { dcLimits } from '../netlify/functions/lib/providers/dc'

interface Target {
  city: string
  /** Human label for what is being parsed. */
  what: string
  /** ArcGIS layer/table to enumerate. */
  url: string
  field: string
  /** True when the parser is EXPECTED to reject some values (e.g. a FAR module
   *  scoped to one zone family). Those are reported separately from surprises. */
  scopedTo?: string
  /** Returns true when the parser produced a usable answer for this value. */
  handled: (v: string) => boolean
}

const ORG_PHL = 'https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services'

const TARGETS: Target[] = [
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
    handled: (v) => { if (isPlannedDevelopment('atlanta', v)) return true; const r = resolveAtlanta(v); return r.heightFt != null || r.heightUnconstrained === true },
  },
  {
    city: 'austin', what: 'base zone → Subchapter F limits',
    url: 'https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/Current_Zoning_gdb/FeatureServer/0', field: 'BASE_ZONE',
    scopedTo: 'Subchapter F single-family zones only',
    handled: (v) => austinSfLimits(v, true) != null,
  },
  {
    city: 'charlotte', what: 'zone description → height',
    url: 'https://gis.charlottenc.gov/arcgis/rest/services/PLN/Zoning/MapServer/0', field: 'ZoneDes',
    handled: (v) => { const r = resolveCharlotte(v); return r.residentialFt != null || r.nonresidentialFt != null || r.heightUnconstrained === true },
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
    scopedTo: 'code-only; RS lot-area bands and industrial community-plan rules need parcel facts',
    handled: (v) => { const r = resolveSanDiego(v, null); return r.maxFAR != null || r.farUnconstrained === true },
  },

  {
    city: 'denver', what: 'zone string → FAR/height/stories',
    url: 'https://denvergov.org/maps/data/Zoning/MapServer/1', field: 'ZONE_DISTRICT',
    handled: (v) => resolveDenver(v).heightFt != null,
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
  for (const t of TARGETS) {
    const vals = await distinctValues(t.url, t.field)
    if (vals == null) {
      console.log(`\n${t.city}/${t.field}  — LAYER UNREACHABLE (not a pass; re-run)`)
      continue
    }
    const unhandled = vals.filter((v) => !t.handled(v))
    const pct = vals.length ? (100 * unhandled.length) / vals.length : 0
    console.log(`\n${t.city}/${t.field} — ${t.what}`)
    console.log(`  ${vals.length} distinct values · ${unhandled.length} unhandled (${pct.toFixed(1)}%)${t.scopedTo ? `  [scoped: ${t.scopedTo}]` : ''}`)
    if (unhandled.length) {
      console.log(`  unhandled: ${unhandled.slice(0, 24).join(' · ')}${unhandled.length > 24 ? ` …+${unhandled.length - 24}` : ''}`)
      if (!t.scopedTo) surprises += unhandled.length
    }
  }
  console.log(`\n${'='.repeat(70)}`)
  console.log(`UNSCOPED unhandled values (genuine surprises): ${surprises}`)
  console.log('Scoped parsers are EXPECTED to reject out-of-scope values — those')
  console.log('are gaps the null inventory already discloses, not parse failures.')
})()
