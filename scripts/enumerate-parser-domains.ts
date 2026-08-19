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
import { austinResolvedLimits } from '../netlify/functions/lib/providers/austin'
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
      // ⚠️ "SPI ... uncurated" WENT STALE THE MOMENT SPI WAS CURATED. On
      // 2026-08-18 SPI-16, SPI-20 and SPI-21 were encoded — 20 codes — and
      // Atlanta's unhandled count fell 173 → 153 while the GAP total did not
      // move at all, because those codes were already excused by this
      // declaration. So the instrument's own description of the city was false
      // for exactly as long as nobody re-read it, and the sweep total could
      // never have revealed that (rule 26: report the composition, not the
      // bare number). The label now names which chapters are done.
      label:
        'SPI curated for 16/20/21 (20 codes); the remaining SPI chapters plus HC-20 / NC / Poncey-Highland / LD deliberately uncurated, plus four codes Part 16 does not establish at all — see zoning/atlanta.ts',
      // ⚠️ THE FOUR ARE NOT UNCURATED — THEY DO NOT EXIST IN THE CODE. Read and
      // recorded in zoning/atlanta.ts with their acreages: PD-H1 (37.2 ac),
      // MR-4-C (16.1), PD-H2 (10.1), MR-3A-C (3.6). Chapter 35 establishes MR-1,
      // MR-2, MR-3, MR-4A, MR-4B, MR-5A, MR-5B, MR-6 and MR-MU — there is no
      // MR-4 and no MR-3A. Chapter 19 establishes PD-H, PD-MU, PD-OC, PD-BP and
      // PD-CS, with no PD-H1 or PD-H2. The code's own district lists are the
      // positive evidence, which is the slot test applied to a district roster
      // rather than to a table row.
      //
      // They stay UNRESOLVED and specifically not `farUnconstrained`: a code the
      // ordinance never established says nothing about whether a limit applies.
      explains: (v) =>
        /^(SPI-|HC-20|NC-\d|Poncey-Highland|LD )/.test(v.trim()) ||
        ['MR-3A-C', 'MR-4-C', 'PD-H1', 'PD-H2'].includes(v.trim().toUpperCase()),
    },
    // ⚠️ THIS TARGET MEASURES HEIGHT *AND* FAR, and the predicate read only
    // height. Six codes — LW, LW-C, MRC-1, MRC-1-C, MRC-2, MRC-2-C — resolve a
    // cited FAR (§16-33.009(1)(a), §16-34.026(1)(a), §16-34.027(1)(a) with the
    // §16-34.010 Table A sub-caps) and were counted as gaps because their HEIGHT
    // comes back as `heightTiers` rather than a scalar.
    //
    // The tiers are Atlanta's protected-district shape, identical to Denver's CMP
    // buffer: §16-33.010(2) and §16-34.026(2)b state 35 ft within 150 ft of a
    // protected district (R-1…R-5, R-G 1, R-G 2, MR-1, MR-2, PD-H), 52 ft between
    // 150 and 300, 225 ft beyond. providers/atlanta.ts discloses every tier and
    // correctly withholds a scalar, because the binding figure needs a per-parcel
    // distance. So the height half is out of a code-only sweep's reach; the FAR
    // half is a real answer and now counts.
    //
    // ⚠️ NOT the Miami move. Miami's target measures height and stories ONLY, so
    // its `farUnconstrained` answers a question that target does not ask. Here
    // FAR is half of what the target is named for.
    handled: (v) => {
      if (isPlannedDevelopment('atlanta', v)) return true
      const r = resolveAtlanta(v)
      if (r.heightFt != null || r.heightUnconstrained === true) return true
      return r.farNonresidential != null || r.farResidential != null || r.farCombined != null
    },
  },
  {
    city: 'austin', what: 'base zone → height/FAR (§ 25-2-492(D) base table, Subchapter F where it applies)',
    url: 'https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/Current_Zoning_gdb/FeatureServer/0', field: 'BASE_ZONE',
    // ⚠️ REWRITTEN TWICE ON 2026-08-17, and the second time is the instructive one.
    //
    // First pass: the scope read "Subchapter F single-family zones only" while
    // five single-family zones sat unhandled beneath it, so it was converted to a
    // partial scope excusing non-SF zones and SF-4A/4B/5/6 and SF2 were recorded
    // as gaps pending a read of § 25-2.
    //
    // Second pass: § 25-2 had ALREADY been read — value-by-value on 2026-08-05
    // against § 25-2-492(D), with SF-4A at 35 ft (§ 25-2-779(D)(3)) and SF-4B at
    // 2 storeys (§ 25-2-558(G)) encoded and cited. The gap was never in the code;
    // it was that this predicate called `austinSfLimits` alone, which serves
    // SF-1/2/3 and returns null for everything else, while production falls
    // through to the base table. 41 of 44 reported unhandled; 14 actually are.
    //
    // So the excused set is now the module's OWN documented absences, quoted from
    // AUSTIN_LIMITS: "PUD/DR/AV/P vary case-by-case → absent. W/LO and CH are
    // deliberately absent: their table cells are footnote pointers to regulations
    // we have not resolved (CH's height is a function of impervious cover,
    // § 25-2-582(B)), and a gap is the honest state."
    //
    // The other eight — AG, ERC, LA, NBG, SF2, TND, TOD, UNZ — are NOT documented
    // anywhere and count. Excusing them with a families-based regex would repeat
    // the defect this comment is about. AG and LA are named as columns of the
    // § 25-2-492(D) table in AUSTIN_LIMITS' own header and are simply not encoded.
    //
    // ⚠️ SF2 IS 715 LIVE PARCELS AND IS INTERIM SF-2. Measured against the layer:
    // its ZONE_NAME is "Single Family Residence - Standard Lot", identical to
    // SF-2's, and its ZONING_ZTYPE is `I-SF-2` / `I-SF-2-NP` — Austin's interim
    // designation, for which the layer drops the hyphen in BASE_ZONE. Deliberately
    // NOT aliased to SF-2: that the DISTRICT is SF-2 is established, but whether
    // interim status changes the site development regulations is not, and an alias
    // would publish 35 ft on 715 parcels on the strength of a naming pattern
    // (rule 27). It counts as a gap until § 25-2's interim provisions are read.
    partiallyScoped: {
      label: "the module's own documented absences — W/LO and CH are footnote pointers, PUD/DR/AV/P vary case-by-case",
      explains: (v) => ['W/LO', 'CH', 'PUD', 'DR', 'AV', 'P'].includes(v.trim().toUpperCase()),
    },
    // ⚠️ THE COMPOSITION, NOT ONE BRANCH. This called the Subchapter F resolver
    // alone, which returns null for anything outside SF-1/2/3, and read that null
    // as "no answer" — so it reported 41 of 44 codes unhandled while production
    // publishes a height for most of the 37 districts in the § 25-2-492(D) base
    // table. `austinLimits` was module-private, so the real path was unreachable
    // from here; `austinResolvedLimits` is now the single function both the
    // provider and this sweep call. Rule 11.
    handled: (v) => {
      const r = austinResolvedLimits(v, true)
      return r.maxHeightFt != null || r.maxFAR != null || r.maxStories != null || r.farUnconstrained
    },
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
    // ⚠️ `planGoverned` IS AN ANSWER, and this predicate could not see it. The
    // sweep's own header says so — "farUnconstrained / heightUnconstrained /
    // planGoverned are answers under rule 5, not gaps" — and it already credits
    // exactly this for Dallas and Chicago through `isPlannedDevelopment`. Las
    // Vegas and Phoenix establish it PER DISTRICT in their own modules instead,
    // which envelope.ts describes as the intended arrangement, so the registry
    // check misses them entirely.
    //
    // 36 of Las Vegas's 47 — the C-V, P-C, PD, R-PD, T-C and T-D families. Each
    // is cited to its own LVMC subsection with the quoted text: 19.10.020(E)(1),
    // 19.10.030(E)(2), 19.10.040(F), 19.10.050(B)(1), 19.10.060(B)(2). Verified
    // one code at a time — all 36 carry their own source string — rather than by
    // crediting the family.
    //
    // ⚠️ `farUnconstrained` is NOT credited here, and the distinction matters:
    // this target measures HEIGHT and stories, and "Title 19 imposes no FAR"
    // (FACT 1) answers a different question. Crediting it would claim a height we
    // do not have.
    handled: (v) => {
      if (isPlannedDevelopment('lasvegas', v)) return true
      const r = resolveLasVegas(v)
      if (r.planGoverned && (r.planSource ?? '').length > 20) return true
      return r.maxHeightFt != null || r.maxStories != null
    },
  },
  {
    city: 'milwaukee', what: 'zoning code → height/FAR',
    url: 'https://milwaukeemaps.milwaukee.gov/arcgis/rest/services/planning/zoning/MapServer/12', field: 'Zoning',
    // ⚠️ A DATA DEFECT THE CITY DECLARES IS AN ANSWER, and a better one than
    // most. `X` is not a district: the layer's own ZoningType reads "A problem
    // has been identified with the zoning assigned to this parcel. Check with
    // the City of Milwaukee's Department of City Development for details", under
    // ZoningCategory TEMPORARY, across 11 parcels. The module carries it as
    // `dataDefect` and providers/milwaukee.ts quotes that sentence to the user.
    // Counting it as a parse gap says we failed to read something the city has
    // told us is unreadable.
    handled: (v) => {
      const r = resolveMilwaukee(v)
      return (
        r.heightFt != null ||
        r.heightUnconstrained === true ||
        r.planGoverned === true ||
        r.dataDefect === true
      )
    },
    // PK is the other half, and it is READ rather than missed. s. 295-903-3
    // gives the Parks district principal-building standards consisting of
    // setbacks only — no dimensional table, no height paragraph — and
    // zoning/milwaukee.ts states why that is NOT a slot test: the DC and
    // Philadelphia absences worked because a table existed whose row structure
    // lacked the row, so the document's own structure was the evidence. Here
    // there is no table whose emptiness could be evidence, and "the code sets no
    // height in a park" would be a conclusion from a reader not finding
    // something (rule 8). 488 parcels, deliberately unresolved.
    partiallyScoped: {
      label: 'PK (Parks) is read and deliberately unresolved — s. 295-903-3 states setbacks only, with no dimensional table to slot-test',
      explains: (v) => v.trim().toUpperCase() === 'PK',
    },
  },
  {
    city: 'nashville', what: 'zone description → FAR',
    url: 'https://maps.nashville.gov/arcgis/rest/services/Zoning_Landuse/Zoning/MapServer/14', field: 'ZONE_DESC',
    handled: (v) => { if (isPlannedDevelopment('nashville', v)) return true; const r = resolveNashville(v); return r.maxFAR != null || r.farUnconstrained === true },
    // THREE OF THE FOUR ARE READ AND CITED IN zoning/nashville.ts, each carrying
    // the code's own words about where its standards live:
    //   DTC  23 polygons · § 17.12.020 Tables B and C both read "See Chapter
    //        17.37" — the Downtown Code, a separate form-based chapter not read.
    //        Its 17 sub-districts (CORE, SOBRO, EAST BANK, GULCH NORTH/SOUTH …)
    //        arrive in the layer's NAME field, so DTC also needs two fields
    //        jointly (rule 13) — the wide-per-subarea grid that produced DC's
    //        MU-column off-by-one, and the reason Atlanta's SPI stayed uncurated.
    //   MHP   1 polygon  · Table 17.12.020B: "See Ch. 17.16".
    //   Satellite City  5 polygons · not a district at all. These are the
    //        independent municipalities inside Davidson County, which Metro's
    //        Title 17 does not govern; providers/nashville.ts refuses them
    //        upstream as a jurisdiction question.
    //
    // ⚠️ `I` IS NOT DECLARED AND STAYS A GAP. Its single polygon is 138 acres,
    // zoned by Ordinance BL2000-303 in 2000, and `I` is not among the current
    // table's industrial districts (IWD, IR, IG). That points at a legacy code —
    // the Denver former-Chapter-59 shape — but zoning/nashville.ts also quotes
    // "Table C Note 1: the I district becomes 1.50 inside the UZO", which would
    // make it current. Those cannot both be right and the source settles it.
    //
    // THE SOURCE WAS UNREACHABLE ON 2026-08-17, and that is recorded rather than
    // resolved by inference: nashville-tn.elaws.us (the publisher this module
    // cites) timed out on two isolated probes at 45s and 90s; Municode answers
    // 200 with a 6 kB JavaScript shell and no ordinance text; amlegal returns
    // 403. A host that will not answer is not evidence about a district (rule 8),
    // so `I` counts as a gap until § 17.12.020 Table C can be read again.
    partiallyScoped: {
      label: 'DTC and MHP are read and point elsewhere in the code (§ 17.37, Ch. 17.16); Satellite City is another jurisdiction',
      explains: (v) => ['DTC', 'MHP', 'SATELLITE CITY'].includes(v.trim().toUpperCase()),
    },
  },
  {
    city: 'phoenix', what: 'zoning code → height',
    url: 'https://maps.phoenix.gov/pub/rest/services/Public/Zoning/MapServer/0', field: 'ZONING',
    // Same shape as Las Vegas: 16 of Phoenix's 41 are plan-governed and cited —
    // PUD (§671.A, §671.B.2), PCD (§636.D.3, §636.E.1.b) and PAD-2…PAD-15 (§635),
    // the PAD entries generated rather than hand-written so a new PAD number
    // cannot arrive as a silent gap while looking curated. All 16 verified to
    // carry their own source string. `farUnconstrained` is again NOT credited —
    // this target measures height.
    handled: (v) => {
      const r = resolvePhoenix(v)
      if (r.planGoverned && (r.source ?? '').length > 20) return true
      return r.height != null
    },
    // ⚠️ THE 17 DOWNTOWN CODE DISTRICTS ARE MAP-KEYED, not unextractable. The
    // reason on file until 2026-08-17 was that Chapter 12's per-frontage tables
    // "run together when flattened to text" — and that was wrong twice: the
    // tables are real HTML (§ 1209's is 50 rows x 7 addressable columns), and the
    // height was never in them. § 1209 and § 1217 both read "Maximum height: …
    // governed by the height map, Section 1202.B"; § 1217 adds "Maximum density:
    // governed by the density map, Section 1202.C".
    //
    // Fourth instance of the map-keyed class, after Denver's Exhibit 8.1 height
    // areas, Denver's CMP Protected District buffer and San Diego's Figure H.
    // Phoenix publishes no such layer — all 178 services on maps.phoenix.gov
    // were listed and the only match, Public/WalkableUrbanCode, carries
    // APPLICABILITY_AREAS alone.
    //
    // WU is left OUT of this declaration deliberately. It shared the retracted
    // extraction reason, and its Chapter 13 sections have not been read, so it
    // has no established reason of its own yet and must keep counting.
    partiallyScoped: {
      label: 'the 17 Downtown Code districts take their height from the § 1202.B height map, not from any per-district table',
      explains: (v) => /^DTC-/.test(v.trim().toUpperCase()),
    },
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
      label: 'RS/LJSPD-SF lot-area bands and CC/industrial community-plan overrides need parcel facts; Centre City FARs are per-site in Figure H; Gaslamp states an FAR only as a height-bonus cap; three La Jolla sub-areas unresolved',
      // LJSPD-SF resolves — § 1510.0304(i)(1)(A) sends it to Table 131-04J, the
      // same band table as the RS zones — but the band is chosen by LOT AREA, and
      // the sweep has no parcel. Confirmed live: with a 5,000 sf lot it returns
      // 0.60. Declared for the reason already declared for RS, not as a new one.
      explains: (v) => {
        const z = v.trim().toUpperCase()
        if (/^(RS-|I[A-Z]?-\d|IBT-)/.test(z)) return true
        // ⚠️ THE CC COMMERCIAL ZONES ARE ENCODED, and were being counted as gaps
        // for a reason already declared one line above for the industrial zones.
        // CC_FAR carries all 25 with their Table 131-05 figures, and
        // `commercialFar` applies footnote 3 — "Within the Otay Mesa Community
        // Plan area, the maximum floor area ratio is 0.30". That override makes
        // the ratio a joint function of zone AND community plan (rule 13), so
        // `commercialFar` returns UNRESOLVED when the plan is `undefined`, which
        // is exactly what this sweep passes. Measured: all 25 resolve the moment
        // any community plan is supplied.
        //
        // Same declared reason, same shape, previously applied to only one of the
        // two families that have it.
        // CN joins them 2026-08-17, read from Table 131-05C: max FAR 1.0 in all
        // six columns, footnote 3 stating the same 0.30 Otay Mesa override in
        // that table's own words. Identical joint dependency, identical reason.
        if (/^(CC|CN)-\d/.test(z)) return true
        if (z === 'LJSPD-SF') return true
        // ⚠️ CENTRE CITY — READ 2026-08-17, and the answer is that no zone code
        // can carry it. § 156.0309(a): "The minimum and maximum base FARs for
        // each SITE within the Centre City Planned District are illustrated in
        // Figure H". The ratio is per-site and mapped, not stated per district,
        // so CCPD-CORE and its nine siblings are not a lookup this module could
        // ever satisfy — Denver's Exhibit 8.1 height areas exactly. § 156.0309(c)
        // adds one mapped exception, the Ballpark Mixed-Use District at FAR 6.5,
        // which is likewise a Figure B area rather than a zone.
        if (/^CCPD-/.test(z)) return true
        // ⚠️ GASLAMP — the article states an FAR EXACTLY ONCE, and not as a base.
        // § 157.0107(a)(3) lets height rise from 75 ft to 101 ft on parcels
        // ≥20,000 sf or 125 ft on ≥30,000 sf, "subject to the following: (A) The
        // development shall not exceed an FAR of 6.0." That is a cap attached to
        // a height bonus, not a by-right ratio, and no base FAR appears anywhere
        // in the article's 9,471 words.
        //
        // Found only because the search was widened to the abbreviation: a grep
        // for "floor area ratio" returns nothing here. That is the Denver
        // D-C/D-TD near-miss shape — a provision living just outside the phrasing
        // the reader searched for.
        if (z === 'GQPD-GASLAMP-QTR') return true
        // La Jolla sub-areas. § 159.0301(a) creates SIX zones and Table 159-03D
        // states a base FAR for each; 1A, 5A and 6A are sub-areas "included in"
        // their zone, identified for orientation and use reasons. Whether the
        // parent zone's FAR carries into a sub-area is NOT stated in the passages
        // read, so they are held open rather than inherited by assumption.
        return ['LJPD-1A', 'LJPD-5A', 'LJPD-6A'].includes(z)
      },
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
    // A FREE-TEXT TARGET ASKS A DIFFERENT QUESTION from a district table. Not
    // "does the source have a slot" but "does the parser's input domain cover
    // what the field emits" — the LA qualifier shape. All three rejections were
    // checked against the ORDINANCE on 2026-08-17 (Philadelphia Code Title 14 via
    // American Legal, current through May 25 2026, amendments through June 23
    // 2026), which this module had never read: every figure in it came from the
    // city's derived ZoningCodeCharacteristics table.
    //
    //   RMX-1 "150% of District Area (excluding streets)"   8 polygons
    //   RMX-2 "250% of District Area (excluding streets)"  13 polygons
    //     § 14-701(2) Table 14-701-2 states the denominator once, in the row
    //     header — "Maximum Floor Area (% of lot area, except as otherwise
    //     provided)" — and these two cells are the ones providing otherwise, in
    //     the code's own words. The same table's "Min. District Area (acres)" row
    //     reads 2 and 1 for exactly these two columns and is empty for every
    //     other, so the ratio really is measured across a district. A per-parcel
    //     FAR cannot be derived from it.
    //   CMX-1  prose deferring to adjacent residential districts
    //     Table 14-701-3's Floor Area cell for CMX-1 is a bracketed footnote
    //     marker, not a figure — the characteristics table renders that footnote
    //     as the paragraph seen here.
    //
    // ⚠️ NOT the same as the retracted "70% of Lot Area = lot coverage" reading
    // (rule 15). That string IS a FAR and parses to 0.70; these say DISTRICT area.
    partiallyScoped: {
      label: 'RMX-1/RMX-2 state a district-wide denominator (Table 14-701-2, confirmed at the ordinance); CMX-1 is a footnote rendered as prose',
      explains: (v) => /district\s+area|excluding\s+streets|CMX-1 Occupied Area/i.test(v),
    },
  },
  {
    city: 'philadelphia', what: 'free-text MaxHeight',
    url: `${ORG_PHL}/ZoningCodeCharacteristics/FeatureServer/0`, field: 'MaxHeight',
    handled: (v) => parseMaxHeightFt(v) != null,
    // Seven strings, each rejected because the FIGURE is conditional on a fact
    // the field does not carry — not because the parser is narrow:
    //   I-1/I-2/I-3  "60 if abutting a Residential or SP-PO district; otherwise
    //                no limit;"  — depends on the NEIGHBOUR's zoning (rule 13)
    //   I-P          the same sentence WITHOUT the trailing semicolon. Two
    //                distinct values differing only in punctuation; both
    //                rejected, so the artifact costs nothing but it does inflate
    //                the distinct-value count by one.
    //   SP-INS       "N/A or 20 ft. above max. height of adjacent residential
    //                within 50 ft." — also the neighbour's zoning
    //   SP-STA       "38 ft. to 150 ft. depending on use" — a range by use
    //   SP-AIR       "Varies under the Airport Hazard Control Overlay"
    //   CMX-1        prose, see the MaxFAR target above
    //   SP-ENT       "300 feet or 30 stories", 2 polygons. ⚠️ THE ONLY ONE WHOSE
    //                FIGURES ARE UNAMBIGUOUS — 300 and 30 are both stated, and
    //                rule 12 says carry what the code states. It is still
    //                refused, because the CONNECTIVE is not: "or" may mean the
    //                lesser of the two, or the applicant's choice. Publishing
    //                300 assumes the first reading, and 30 storeys at Miami's
    //                14 ft would be 420 — so the assumption is not even reliably
    //                conservative. § 14-406 (SP-ENT) would settle it and has not
    //                been read.
    partiallyScoped: {
      label: 'every string states a figure conditional on a fact the field does not carry — abutting zoning, use, or an overlay; SP-ENT alone is figure-clear but connective-ambiguous',
      // ⚠️ WRITTEN FIRST AS `() => true`, WHICH IS A TARGET-WIDE SCOPE WEARING
      // THE PARTIAL MECHANISM'S NAME. Every one of the seven is enumerated above
      // with its reason, so excusing them all happened to be correct today — and
      // a NEW unparseable string would have been excused silently tomorrow, which
      // is precisely the defect `partiallyScoped` exists to prevent. Matching the
      // known forms instead means an eighth string counts until someone reads it.
      explains: (v) =>
        /^60 if abutting/i.test(v.trim()) ||
        /^N\/A or 20 ft\. above/i.test(v.trim()) ||
        /^300 feet or 30 stories$/i.test(v.trim()) ||
        /^38 ft\. to 150 ft\. depending on use$/i.test(v.trim()) ||
        /Airport Hazard Control Overlay/i.test(v) ||
        /CMX-1 Occupied Area/i.test(v),
    },
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
