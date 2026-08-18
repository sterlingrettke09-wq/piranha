# Verification Ledger — monetary & regulatory figures

Re-verification sprint, fetch date **2026-06-10**. Each figure: value in code →
current verified value → primary source → status. Status keys: VERIFIED (code
already correct), CORRECTED (changed), UNVERIFIABLE-LABELED (can't confirm from a
fetched primary source; left as a labeled estimate).

Rule applied: a number was changed ONLY where a current primary source (official
fee schedule / municipal code) was actually fetched. Where a source was JS-gated
or IP-blocked from the verification environment, the figure was left unchanged and
the attempt recorded.

## Impact / linkage fees (src/config/estimates.ts → impactFee)

| Figure | In code (was) | Verified current | Source (fetched 2026-06-10) | Status | Notes |
|---|---|---|---|---|---|
| Boston linkage, other-commercial ≥50k sf | $23.09/sf | $23.09/sf | BPDA 2023 linkage ordinance, corroborated across multiple outlets quoting the BPDA schedule (boston.gov / bostonplans.org pages are JS-rendered shells; rate not in raw HTML) | VERIFIED | Lab rate is $30.78/sf (not modeled — we only bill "other commercial"). Threshold 50k sf confirmed. |
| LA AHLF residential (6+ units) | $15/sf (flat) | Medium tier **$12.90/sf** | LA City Planning, "AHLF Updated Fee Schedule Effective July 1, 2025" PDF (planning.lacity.gov, odocument 02d304e1…) | CORRECTED | Full tier table Low/Med/Med-High/High = $10.32 / $12.90 / $15.47 / $23.20. Code now bills the published MEDIUM rate and labels the flattening; old $15 was ≈ Medium-High, unlabeled. |
| LA AHLF nonresidential ≥15k sf | $5/sf (flat) | Medium tier **$5.16/sf** | same PDF | CORRECTED | Nonres tiers $3.86 / $5.16 / n-a / $6.44. Code now bills published MEDIUM rate. 15k-sf exemption confirmed. |
| Denver residential ≤9 units (≤1,600 sf/unit) | $5/sf | $5.00/sf (eff. 7/1/2025) | denvergov.org "Linkage Fee – Starting July 1, 2022" current fee schedule | VERIFIED | Exact. (7/1/2026 column will be $5.12.) |
| Denver commercial — typical market area | $6/sf | $6.00/sf (eff. 7/1/2025) | same | VERIFIED | Exact. (7/1/2026 → $6.14.) |
| Denver commercial — high market area | $9/sf | $9.00/sf (eff. 7/1/2025) | same | VERIFIED | Exact. (7/1/2026 → $9.21.) |
| Seattle MHA map (informational, midpoints) — Low r16/c11, Med r28/c15, High r45/c19, Dtwn r32/c22 | unchanged | within published ranges | SDCI "Adjusted Payment Calculation Amounts for Ch. 23.58B/23.58C" PDF, 3/1/2026 column | VERIFIED | MHA-R by area/M-M1-M2 (2026): Low $10.78–19.26, Med $20.41–34.28, High $31.97–50.46 (High M1 = $45.83 ≈ code's 45). MHA-C: Low $7.87–14.17, Med $11.02–19.68, High $12.59–22.83. Code values are labeled representative midpoints, applied:false. Effective-date comment (3/1/2026) already current. |
| SF Jobs-Housing Linkage office ≥50k gsf | $85.90/gsf | $85.90/gsf | SF Planning Citywide Development Impact Fee Register, eff. 1/1/2026 (Table 413.5A, sfplanning.org Impact_Fee_Schedule.pdf) | VERIFIED | Exact. PRJ-after-1/1/2021 tier (current for new projects). |
| SF Jobs-Housing Linkage office 25–50k gsf | $77.30/gsf | $77.30/gsf (office <50k) | same | VERIFIED | Exact. Lab $47.35/gsf (lower, as code notes). Informational only (applied:false). |

## Boston ZBA decision-code semantics (relief-odds, reliefStats.json)

| Item | In code | Verified | Source | Status |
|---|---|---|---|---|
| granted = AppProv + Approved; denied = DeniedPrej + Denied; exclude withdrawn/deferred/blank | as stated | confirmed | data.boston.gov CKAN "Zoning Board of Appeal Tracker", `decision` field distinct values (datastore SQL): AppProv 8217, Approved 4674, DeniedPrej 827, Denied 568, Withdrawn/Withdraw 423, None 1364, Void 8, blank 56 | VERIFIED | AppProv = "Approved with Provisos" (a grant); DeniedPrej = "Denied with Prejudice" (a denial). Classification is correct. Dataset notes confirm `result`/`decision` is the final ZBA vote. |

## Construction cost (RSMeans-derived)

| Figure | In code | Status | Notes |
|---|---|---|---|
| costPerSqFtByUse ($340 res / $390 comm / $365 mixed / $450 inst) | unchanged | UNVERIFIABLE-LABELED | RSMeans building models are license-gated; not fetchable. Comments accurately label them "RSMeans 2026 … national avg" estimates and flag the one-bucket institutional/hospital limitation. Labeling confirmed honest. |
| cityCostIndex (RSMeans City Cost Index, 2021 location factors) | unchanged | UNVERIFIABLE-LABELED | Same — paywalled. Comment correctly states "RSMeans City Cost Index, 2021 location factors" and explains the hard-cost-not-land framing. Labeling confirmed honest. |

## Zoning-parser spot checks (read-only; no code change — both confirmed correct)

| Parser | Rule | Source | Status |
|---|---|---|---|
| Seattle NC/C height (seattle.ts seattleMaxHeightFt — trailing numeric suffix) | NC/C zones carry height as a numeric suffix (e.g. NC3-65 → 65 ft) | SMC 23.47A.012: "height limit for structures in NC zones or C zones is 30, 40, 65, 85, 125, or 160 feet, as designated on the Official Land Use Map" (seattle-wa.elaws.us; corroborated via search) | VERIFIED | All designators are 2-3 digits in the parser's 25–1000 range; trailing-number rule sound (incl. MHA-added 55/75). |
| LA Height-District FAR + height caps (la.ts LA_HD / laLimits) | HD1 3:1 (1.5:1 comm/ind), HD2 6:1, HD3 10:1, HD4 13:1; 1L=75ft, 1VL=45ft, 1XL=30ft | LAMC §12.21.1, per LA City Planning "Generalized Summary of Zoning Regulations" Appendix 2.3, Table 2 – Height Districts (planning.lacity.gov) | VERIFIED | FAR table and height-suffix caps match the official table exactly, including the C/M Height-District-1 → 1.5:1 override. |

## Could-not-re-verify (attempts logged)

- **Boston primary page**: boston.gov & bostonplans.org linkage pages return JS app
  shells (no rate in raw HTML); curl could not render. Rate corroborated via
  multiple independent outlets quoting the 2023 BPDA ordinance; value matches code,
  left unchanged.
- **clkrep.lacity.org / clerk PDFs**: unreachable from the verification environment
  (connection failed). Not needed — the LA Planning fee-schedule PDF on
  planning.lacity.gov was fetched directly and is authoritative.
- **General web search engines** (DuckDuckGo HTML, Bing) rate-limited (HTTP 202)
  from the workspace IP; used the WebSearch tool + direct official-PDF fetches
  instead.

## Net changes this sprint

- ESTIMATES_VERSION 3 → 4 (LA constants changed; cache-buster bumped).
- LA AHLF: residential $15 → $12.90, nonresidential $5 → $5.16 (published Medium
  tier, eff. 7/1/2025), with the flattening now stated honestly in the label and
  source comment.
- cost.test.ts LA expectations updated to the new rates.
- All other figures VERIFIED unchanged or UNVERIFIABLE-LABELED (RSMeans).

## V2 additions (2026-06-10)

| Claim | Source | Status |
| --- | --- | --- |
| Boston Article 80 Small Project Review triggers at 20,000–50,000 sf **or 15+ dwelling units**; Large at 50,000+ sf; review now run by the Planning Department (BPDA functions transferred July 2024) | bostonplans.org/projects/development-review/small-projects + /large-projects (fetched 2026-06-10) | VERIFIED — unit trigger added to hurdles.ts |
| Seattle design review suspended/voluntary per CB 121048 (passed 2025-09-26), pending permanent HB 1293 rules expected 2026 | seattle.gov/sdci/codes/changes-to-code/2025-design-review-program-changes (fetched 2026-06-10) | VERIFIED — added as status:'info' hurdle, no months |
| Example demo parcels (10 cities) resolve to real addresses + districts | Live /api/parcel probes, one per city (2026-06-10) | VERIFIED — coords + labels in src/config/exampleParcels.ts |
| Chicago prod returned districtCode "Unknown" at multiple points while the city's ArcGIS answered correctly direct | Live probes of thepiranhaproject.com + gisapps.chicago.gov (2026-06-10) | DIAGNOSED as CDN-cached degraded responses → cacheControlFor() now caps degraded TTL at 300s |

## July 2026 fee-rollover re-verification (2026-07-07)

| Claim | Source | Status |
| --- | --- | --- |
| Denver EHA schedule effective 7/1/2026 (annual CPI-U, ~+2.4%): ≤9-unit residential ≤1,600 sf/unit $5.12/sf; commercial Typical $6.14 / High $9.21 | denvergov.org CPD "EHA Ordinance and Affordable Housing Fee" (fetched 2026-07-07) | STALE → FIXED — estimates.ts updated $5.00/$6.00/$9.00 → $5.12/$6.14/$9.21; cost.test.ts expectations updated |
| LA AHLF: LAMC §19.18 mandates a 7/1 CPI bump, but NO 2026 schedule is published — the May 29, 2025 Director's memo (Medium res $12.90, nonres $5.16) remains the latest official rates | planning.lacity.gov AHLF memo (downloaded 2026-07-07); Drupal search + URL probes found no 2026 memo | VERIFIED current-as-published — WATCH note added to source comment; re-check planning.lacity.gov |
| Boston linkage $23.09/sf other-commercial (lab $30.78) still current; no FY2027 adjustment announced | bostonplans.org/projects/standards/linkage (fetched 2026-07-07) | VERIFIED unchanged |
| Seattle MHA rates: SDCI "Adjusted Payment Calculation Amounts" latest column runs 3/1/2026–2/28/2027 — the schedule in use | seattle.gov SDCI MHA_rates.pdf (fetched 2026-07-07) | VERIFIED unchanged |
| SF Jobs-Housing Linkage: Impact Fee Register (rates eff. 1/1/2026, v. 11/25/2025) Table 413.5A — office ≥50k gsf $85.90, <50k $77.30, lab $47.35 | sfplanning.org Impact_Fee_Schedule.pdf (fetched 2026-07-07) | VERIFIED unchanged |

Net changes: ESTIMATES_VERSION 6 → 7 (Denver rates changed; cache-buster bumped).

## Cost-model defects found during the city expansion (2026-08-03)

| Claim | Source | Status |
| --- | --- | --- |
| `buildingTier()` (single/multi/apartment) is computed and consulted ONLY by timeline.ts; cost.ts never reads it, so a detached house and a 200-unit tower share one $/sf | Code read of `netlify/functions/lib/cost.ts` (hard = gfa × costPerSqFtByUse[use] × cityIdx × heightCostFactor × scope) | CONFIRMED — unfixed. Direction known (detached SF biased HIGH, since the constant is sourced-as mid-rise multifamily); magnitude NOT established |
| `PARKING_RULES` reaches hurdles/redTapeIndex/realityCheck/SiteFacts but never cost.ts — parking is classified and never priced | grep of consumers; `cost.ts` has no parking term | CONFIRMED — unfixed. Same defect shape as tier |
| No sitework/excavation term exists anywhere in the cost engine | `total = hard + soft + permit + demolition + impact`; zero matches for sitework/excavation | CONFIRMED — unfixed. Biases LOW on infill, 0 to -15%, magnitude depends on the $/sf composition |
| Soft-cost double-count with RSMeans-embedded A&E | Premise from Gordian Square Foot Estimating Manual (25% GC + 7% A&E); constants came from rsmeans.com/resources/cost-to-build-an-office, which was fetched and carries NO methodology note | UNQUANTIFIED, bounded 0-7%. NOT established — do not cut softCostPct in isolation |
| `costPerSqFtByUse.commercial` $390 is the arithmetic midpoint of RSMeans' published $208-574 range (2.76x spread) for 5-10 story office | rsmeans.com/resources/cost-to-build-an-office (fetched 2026-08-03) | CONFIRMED — the base constant's precision is far below the errors being chased around it |
| Whether the $208-574 range is national or spans cities (i.e. whether applying CCI double-counts geography) | Source page has no methodology note | UNRESOLVED |
| `heightCostFactor` is flat 1.0 up to 4 stories, so it cannot distinguish stick-frame Type V from a 4-story podium — the real cost discontinuity is construction TYPE, not story count | Code read of `heightFactorTiers` | CONFIRMED — unfixed; wrong axis |

Net: no constant was changed. Sequence agreed — source per-tier constants FIRST, then wire tier and rework the height axis on construction type.

### RSMeans licensing — cleared 2026-08-03

| Claim | Source | Status |
| --- | --- | --- |
| Gordian/RSMeans user agreement restricts using RSMeans Data "as a component of or as a basis for any material or product offered for sale, license or distribution," and grants use "solely for Customer's internal business purposes" | RSMeansOnlineUserAgreement.pdf §209-212, §642-648 (extracted 2026-08-03) | ACCURATE AS QUOTED — but resolved, see below |
| Use of RSMeans-derived constants in this product is cleared | Owner consultation with counsel AND directly with RSMeans, 2026-08-03 | CLEARED — the earlier "do not obtain a trial or licence" recommendation is RETRACTED and must not be re-derived from the clause text alone |
| Clearance scope | As understood 2026-08-03 | A future Data Online subscription is a separate instrument; this clearance does not automatically extend to it |

### RSMeans free-document findings (2026-08-03) — step 1 partial, no account required

| Claim | Source | Status |
| --- | --- | --- |
| RSMeans applies a **Project Size Modifier**: Size Factor = project area ÷ typical size for the building type; Size Factor < 0.50 → cost multiplier **1.1**, > 3.5 → **0.90** | [2024 Square Foot Project Size Modifiers PDF](https://www.rsmeans.com/media/wysiwyg/quarterly_updates/2024-Square-Foot-Project-Size-Modifiers.pdf) (fetched, extracted) | VERIFIED — **missing entirely from our cost model** (defect 5) |
| Typical project sizes: Multi-Family Housing 53,600 sf · Office 21,000 sf · Schools 69,900 sf · Retail 22,000 sf · Mixed Use 29,800 sf | same | VERIFIED |
| **Median Total Project Costs**: Multi-Family Housing $258 · Office $263 · Schools $279 · Mixed Use $415 · Retail $210 · Warehouses $155 · Hospitals $465 | same | VERIFIED AS QUOTED — materially BELOW our constants (residential 340, commercial 390). **NOT directly substitutable**: this table is "Total Project Costs" (reported actuals), whose composition may differ from the Square Foot models our constants claim to come from. Composition question still open. |
| The size-modifier worked example states results are "based on national average costs" | same | Supports (does not prove) that the SF base is national and CCI applies on top — Q2 still needs the two-run test |
| The tier axis exists as **distinct RSMeans models**: M.010 Apartment 1-3 Story, M.020 Apartment 4-7 Story, M.030 Apartment 8-24 Story | [2020 Square Foot Costs TOC](https://www.rsmeans.com/media/wysiwyg/2020-SQFT-TOC.pdf) | VERIFIED — confirms cost varies BETWEEN models, not continuously within one (capture-sheet item E) |
| **Residential Models are a separate section with Building Classes** (quality tiers), distinct from the commercial model set | same TOC | VERIFIED — confirms capture-sheet A1; the detached tier and quality-class axis both exist |

Still requires the estimator (account): fee percentages, what each fee computes on, before/after, assembly breakdown, additives list, and the SF-vs-national ratio.

### RSMeans public model pages — A and B measured, C blocked (2026-08-03)

Route: `rsmeans.com/model-pages/<slug>`, free, no account. All figures "National, US".

| Claim | Source | Status |
| --- | --- | --- |
| **Apartment 4-7 Story**: bare $145.01 → contractor 25% $36.25 → architectural 7% $12.69 → **total $193.94** | [model page](https://www.rsmeans.com/model-pages/apartment-4-7-story) | VERIFIED |
| **Apartment 1-3 Story**: bare $146.52 → 25% $36.63 → 7% $12.82 → **total $195.97** | [model page](https://www.rsmeans.com/model-pages/apartment-1-3-story) | VERIFIED |
| **Office 5-10 Story**: bare $159.35 → 25% $39.84 → 6% $11.95 → **total $211.14** | [model page](https://www.rsmeans.com/model-pages/office-5-10-story) | VERIFIED |
| **Hospital 4-8 Story**: bare $217.13 → 25% → 9% → total $295.85 | [model page](https://www.rsmeans.com/model-pages/hospital-4-8-story) | VERIFIED |
| ~~Fees apply **IN PARALLEL on the bare subtotal**, not compounded~~ | ~~Arithmetic: 146.52 + 36.63 + 12.82 = 195.97~~ | ⚠️ **RETRACTED 2026-08-04 — THIS LINE WAS WRONG.** See the correction row below and the B entry dated 2026-08-04. |
| Fees **COMPOUND**: `total = bare × (1 + contractor) × (1 + architectural)` | Perturbation test on the live estimator (2026-08-04), plus the four rows above | **CORRECTED.** For commercial that IS the 33.75% case (1.25 × 1.07), not 32%. **The four model rows above already contained the proof and it was misread:** on Apartment 4-7, the architectural addend $12.69 = 7% of the contractor-inclusive $181.26, NOT 7% of bare $145.01 (which would be $10.15). Same on all four — Apt 1-3 $12.82 = 7% × 183.15; Office $11.95 = 6% × 199.19; Hospital 295.85 = 217.13 × 1.25 × 1.09. Parallel application would have given Apt 4-7 a total of $191.41 against the published $193.94. **`a + b + c = total` is consistent with both structures and discriminates neither** — the sum was treated as evidence when it carried none. |
| **Architectural fee varies by building type**: 6% office · 7% apartment · 9% hospital | four model pages | VERIFIED — there is no single "7%"; the inherited Penn State figure is the apartment value |
| ~~**Our constants are ~2.3× a sourced national figure.**~~ residential 340 vs 145.01 = ~~+134.5%~~; commercial 390 vs 159.35 = ~~+144.7%~~ | model pages + this file's own comment | ⚠️ **RE-SIZED 2026-08-04.** The finding stands in direction; the magnitude was computed against the wrong basis. See correction row. |
| **Our constants are ~1.9× the correct like-for-like figure.** Against `bare × 1.25` (the mapping decided 2026-08-04 — GC O&P belongs in `hard`, A&E does not): residential **340 vs 181.26 = +87.6%**; commercial **390 vs 199.19 = +95.8%** | model pages, mapping decision 2026-08-04 | **CORRECTED — this is the headline finding.** The earlier +134.5% compared our constants against BARE, stranding contractor O&P in no term at all. The engine is `total = hard + soft + permit + demolition + impact` and the soft comment defines soft as "A&E, permitting consultants, legal, developer OH" — so A&E is in `soft` and must be out of `hard`, while GC O&P has no other home and must be in `hard`. That makes `bare × 1.25` the only value consistent with the engine's own decomposition: $143.98-style bare figures strand O&P, fee-inclusive totals double-count A&E. **The substitution caveat still applies — this sizes the error, it does not supply the replacement.** |
| Four constants show no common derivation method — spread −12% to +48% against medians, one inverting | 2024 Size Modifier medians vs `costPerSqFtByUse` | VERIFIED — a composition difference would give a consistent offset; this does not. The constants were selected, not derived |
| **No sitework/site-preparation line** in the model breakdown; model states "no basement included" | hospital-4-8-story page | VERIFIED — affirmative evidence for defect 3, not inference |
| **Union vs open shop** is a real dimension: Apartment 1-3 union bare $146.52 vs open shop $131.58 = **1.114** | model pages | VERIFIED — unmodelled. May underlie the CCI installation column; if a city-selected model also sets labor basis, CCI on top could double-count |
| Cost varies **between** models (story bands are model boundaries: apartment 1-3 / 4-7 / 8-24; office 1 / 2-4 / 5-10 / 11-20), not continuously within one | [model index](https://www.rsmeans.com/model-pages) | VERIFIED — settles capture item E. Rebuild axis is construction type; story count becomes a classifier input |
| `institutional` maps to "Civic, educational, healthcare" (wizard label) but the code comment says "schools/civic; healthcare is materially higher" | `StepUse.tsx` vs `estimates.ts` | **INCONSISTENCY — genuine bug.** The bucket spans Schools $279 → Hospitals $465 → Student Union $660. The earlier "+61% vs schools" was a mis-mapping, not an error in the constant |

**RETRACTION — tier premium direction.** This ledger previously recorded that
small-scale infill is biased HIGH because a mid-rise constant is applied to
stick-frame construction. **That direction is retracted.** Apartment 1-3 Story
($195.97) costs *more* than Apartment 4-7 Story ($193.94) — economy of scale
roughly cancels the construction-type premium. **The defect stands** (cost.ts
still ignores tier); **the direction does not.** For DETACHED housing it remains
open — separate data set, own fee page, no transfer assumed.

**PATTERN TO WATCH — fourth occurrence this thread.** Plausible mechanism →
correct-sounding direction → no measurement → survives several rounds → dies on
contact with a source. Instances: (1) "$340/$390 double-count soft costs at 25%";
(2) "the two errors roughly cancel"; (3) "detached is biased high"; (4) "the
triplex needs a size modifier". Expect this when sourcing the remaining
constants — a mechanism that sounds airtight is not a measurement.

**STILL BLOCKED — needs the estimator (account required, owner to run):**
- **C — geography.** Model pages are static "National, US" with no location
  control and no city URL variant. The CCI double-count question is untested.
  Run the city variant **at the same labor basis** as the national run.
- **Residential fee treatment.** No detached/residential model page exists on the
  public route (verified against the full model index — the only "house" matches
  are courthouse / funeral-home / fraternity-sorority-house). The Residential data
  set has its own Architect/Designer Fees page (TOC p.62); its structure is unverified.
- **A1 — detached tier constant.** Same reason.

**PATTERN — fifth variant, and the hardest to catch.** The four instances above
were premises inherited from *documents*. The tier-premium claim was not: it came
from an interlocutor reasoning aloud from construction type (Type V vs Type III,
no elevator, no rated corridors), and was accepted because the mechanism sounded
sound. It survived several rounds and multiple file edits before a measurement
killed it.

This variant recurs specifically in collaborative work, and neither party has a
reliable detector for it — a confident, mechanically-plausible assertion from a
trusted counterpart reads exactly like a sourced finding. The mitigation is the
same as everywhere else in this thread and applies symmetrically: **direction is
not evidence.** A claim with no measurement is logged as an OPEN QUESTION, not a
finding — including when it comes from the person reviewing the work.

**CAVEAT ON THE +134.5% — do not convert it into a substitution.** That figure
compares our constant against ONE model, ONE configuration, at national average.
It is strong evidence that 340 is badly wrong and weak evidence about what the
correct value is. The replacement constants must come from the estimator's model
set matched to our own tier definitions, at a geography basis resolved by C — not
from lifting $145.01 across. This is recorded in the `estimates.ts` DEFECTS block
as well as here, because the code comment is what gets read at tuning time.

**PATTERN — the asymmetry, and the stronger rule it implies.** The mitigation
recorded above ("log it as an open question") was written symmetric. It is not
symmetric in practice, and the difference matters:

The assistant's reasoning is checked continuously — 570 tests, a type checker,
and sources that can be re-fetched and re-read. The reviewer's reasoning is
checked only when the assistant pushes back, or when a document happens to land
on it. Here that took four rounds, and it was *fast* only because the estimator
model pages surfaced. On a claim where no document is coming, an incorrect
mechanism argued aloud could survive indefinitely.

**So the operative rule is stronger than "log as an open question": a mechanism
argued aloud earns NO DIRECTION in the ledger until something measures it.** Not
a weaker direction. Not a hedged one. None. Writing "biased high (magnitude
unknown)" is what let the tier-premium claim into two files and propagate to a
third entry; "direction unmeasured" would have kept it out entirely.

---

## 2026-08-03 — C RESOLVED BY MEASUREMENT. The CCI multiply is structurally
## sound and numerically wrong for housing.

Run on RSMeans Data Online (trial account, owner-operated). Model: **Apartment,
1-3 Story with Brick Veneer / Reinforced Concrete**; 22,500 sf, 3 stories,
10.00 ft story height, no basement, **Standard Union**, Release **Year 2018**.
All 15 cities swept on that one model with every other input held fixed.

**On the release.** The Release control offers a group labelled "Current
Quarter" containing exactly one member: "Year 2018". Verified identical across
three cost-data sets (Commercial New Construction, Residential New
Construction, Facilities Maintenance) and against the Square Foot Estimator's
own release `<select>`, which has n=1. On this account **Current Quarter IS
Year 2018** — the sweep below is the current-quarter data, not a stale
alternative to it. Additional quarters are a subscription entitlement.
An earlier claim in this thread that Search Data "offers Current Quarter" as a
selectable newer release was wrong: that was a collapsible group header read as
an option. Corrected here.

### The sweep — national average $192.57/SF

| City | RSMeans ZIP group | $/SF | ratio | our CCI | offset |
|---|---|---|---|---|---|
| New York | 100-102 | 273.77 | 1.422 | 1.32 | +7.70% |
| San Francisco | 940-941 | 257.12 | 1.335 | 1.30 | +2.71% |
| San Jose | 951 | 245.66 | 1.276 | 1.27 | +0.45% |
| Chicago | 606-608 | 242.47 | 1.259 | 1.20 | +4.93% |
| Boston | 020-022, 024 | 229.52 | 1.192 | 1.14 | +4.55% |
| Philadelphia | 190-191 | 227.52 | 1.181 | 1.16 | +1.85% |
| Los Angeles | 900-902 | 223.39 | 1.160 | 1.12 | +3.58% |
| San Diego | 919-921 | 214.83 | 1.116 | 1.09 | +2.35% |
| Minneapolis | 553-555 | 206.75 | 1.074 | 1.07 | +0.34% |
| Seattle | 980-981, 987 | 202.24 | 1.050 | 1.07 | −1.85% |
| Washington DC | 200-205 | 178.92 | 0.929 | 0.95 | −2.20% |
| Denver | 800-802 | 167.66 | 0.871 | 0.91 | −4.33% |
| Nashville | 370-372 | 160.11 | 0.831 | 0.89 | −6.58% |
| Miami | 330-332, 340 | 152.40 | 0.791 | 0.85 | −6.89% |
| Austin | 786-787 | 151.17 | 0.785 | 0.83 | −5.42% |

**What passed.** Location applies on top of a national base — the ratio tracks
the CCI in direction and rough magnitude at all 15 cities. The multiply
structure in `cost.ts` is NOT broken and is NOT a partial application. The
original worry (double-count / partial application) is dead.

**What failed.** The offsets are not noise and not a rounding miss. They **trend**
with the index level — high-cost cities read *above* our CCI, low-cost cities
read *below* — spanning +7.70% (NYC) to −6.89% (Miami), a 14.6-point band.

**"Trend", not "monotonic" — the distinction is load-bearing.** The column has
real inversions: San Jose 1.27 → +0.45% sits below Chicago 1.20 → +4.93%;
Boston 1.14 → +4.55% exceeds Philadelphia 1.16 → +1.85%; Miami 0.85 → −6.89%
is further off than Austin 0.83 → −5.42%. If the offsets *were* monotonic in
the index, a single rescaling transform (a corrective exponent) would fix them.
With scatter this size the residual is **per-city**, so the only repair that
works is a per-family index table. An earlier draft of this entry said
"monotonic" and would have invited the wrong fix.

**A retracted argument — do not reuse it.** This entry originally justified
excluding vintage as follows: *"ratios are dimensionless (city ÷ national on
the same release), so vintage escalation cancels out entirely."* **That is
wrong.** Vintage cancels *within* the sweep — city A against city B at one
release. It does not cancel in the comparison actually being made, which is
2018-release city factors against **2021**-vintage CCI values. That comparison
spans three years of relative drift, and the 14.6-point band could in principle
be drift rather than mix. The ratio construction rules out nothing here.

What actually rules drift out is the **office control** in the next section:
office matches our CCI to 0.3% *at the same 2018 release*. Three years of drift
large enough to open a 14.6-point band would have displaced office too. It
didn't. The conclusion survives — but the office run is doing the work that was
mistakenly attributed to the ratio construction, and the bad version of the
argument would license the same move in a case where no control exists.

### The decisive test — same release, second model family

Vintage was eliminated by construction, not by argument: a second model run at
the **same** release, wall type, and labor basis. Office, 5-10 Story;
national average **$204.53/SF**.

| | Apartment 1-3 | Office 5-10 | our CCI |
|---|---|---|---|
| New York | 1.422 | 1.319 | 1.32 |
| Austin | 0.785 | 0.832 | 0.83 |
| **spread (NYC ÷ Austin)** | **1.811** | **1.585** | **1.590** |

Two model families, identical geography inputs, identical vintage, and the
city factors differ by 10.2 points in NYC and 4.7 in Austin. **Mix is the
dominant cause — strong, not proven.**

Residual caveat, logged deliberately: office matching our CCI to 0.3% could
also be two effects offsetting (drift in one direction, mix in the other,
netting near zero). That is unlikely but not excluded by anything measured
here. Confidence: moderate-high that mix dominates. This is a finding, not a
proof, and it does not license a numerical substitution on its own.

**NYC carries a known alternative explanation — flagged, then checked.** NYC is
the largest offset (+7.70%, nearly triple the next city) and sits exactly where
this thread previously found a geography-definition ambiguity: RSMeans' CCI
entry "New York 100-102" is Manhattan ZIPs, while an estimator's "New York"
could resolve to a metro aggregate or a different borough weighting. If the two
"New York"s were different geographies, the offset would be a definition
mismatch masquerading as mix — and it is the strongest-looking data point in
the table. See the geography-resolution check below before citing it.

The third column is the finding that matters for this codebase: our composite
CCI's geographic spread (1.590) matches the **office** model's (1.585) to 0.3%,
and under-disperses the **apartment** model's (1.811) by 14%. `cityCostIndex`
is applied identically to every entry in `costPerSqFtByUse`, so the tool
currently prices housing geography on what is effectively a commercial mix —
and housing is the dominant use case.

**Resolved BY EVIDENCE:** the multiply is valid; a single composite factor per
city is the wrong instrument; the correct factor is model-family-specific.
**NOT resolved:** what the replacement values should be. The sweep above is one
model at one configuration — per the +134.5% caveat, it is strong evidence the
current column is wrong and weak evidence about the right column. Nothing in
`estimates.ts` was changed on the strength of it.

### Geography-resolution check — NYC confound ruled out

Listed every New York State entry the estimator offers:

> ALBANY (120-122) · BINGHAMTON (137-139) · **BRONX (104)** · **BROOKLYN (112)** ·
> BUFFALO (140-142) · ELMIRA (148-149) · **FAR ROCKAWAY (116)** · **FLUSHING (113)** ·
> GLENS FALLS (128) · HICKSVILLE (115,117,118) · **JAMAICA (114)** · JAMESTOWN (147) ·
> KINGSTON (124) · **LONG ISLAND CITY (111)** · MONTICELLO (127) · MOUNT VERNON (105) ·
> NEW ROCHELLE (108) · **NEW YORK (100-102)** · NIAGARA FALLS (143) · PLATTSBURGH (129) ·
> POUGHKEEPSIE (125-126) · **QUEENS (110)** · RIVERHEAD (119) · ROCHESTER (144-146) ·
> SCHENECTADY (123) · **STATEN ISLAND (103)** · SUFFERN (109) · SYRACUSE (130-132) ·
> UTICA (133-135) · WATERTOWN (136) · WHITE PLAINS (106) · YONKERS (107)

Every borough is a separate entry with its own ZIP group. "NEW YORK (100-102)"
is Manhattan only — same definition and same label as the CCI row that
`estimates.ts` cites for `nyc: 1.32` (100-102 = 132.2). The `estimates.ts`
comment already names Brooklyn 112 = 133.1 and Queens 110 = 131.8 as distinct
rows, i.e. the two sources share one taxonomy. **No metro aggregation and no
borough reweighting. The +7.70% offset is mix, not a definition mismatch.**

Worth repeating for any city where the estimator offers several nearby entries;
NY was the case with both the largest offset and the highest prior risk.

### RELEASE = 2018: a downgrade to this account's value, not an erratum

Filed initially as a correction. It is materially more than that.

1. **Any $/sf constant sourced from this account is 2018 vintage.** Closing the
   drift problem was one of the reasons to run the trial; that reason is gone.
   2018 is eight years stale and **older than the 2021 CCI table already
   treated here as the weak link**. If a level is sourced from this account it
   must carry the release in the type — not a comment — and vintage stays OPEN.
2. **The trial's remaining value is structure, not levels.** Fee treatment,
   model boundaries, assembly composition, and the family dispersion
   differential are structural properties that do not decay. Use it for those.
   Do not let a 2018 level become a 2026 constant by quiet promotion.

**Candidate synthesis for the CCI problem, logged as DERIVED not sourced:**
take the *shape* from the 2018 sweep (the apartment-vs-office dispersion ratio)
and apply it to the 2021 levels already held. Family dispersion reflects labor
share and should be far more stable across vintages than absolute index levels,
so this yields a per-family index without importing 2018 levels. Confidence:
moderate. It is a defensible construction, not a measurement, and anything
built this way must be labelled derived at the point of use. Decision deferred
until B and A1 are read.

### Incidental, captured in the same sitting

- **A1 is accessible.** `optionBuildingCategory` = Commercial New Construction /
  Commercial Renovation / **Residential New Construction**. The residential
  data set is reachable on this account. (`buildingQualityType` within
  Commercial is Commercial / Institutional / Industrial — no residential there;
  it lives one level up, which is why earlier probing missed it.)
- **Labor Type and Location are independent controls** in the estimate header.
  The coupling question is answered: they are not coupled. Whole sweep ran at
  Standard Union.
- **Boston's RSMeans group is "020-022, 024".** The `estimates.ts` comment cites
  024 alone — inside the group, so narrow but not wrong.
- Division 1 carries **ARCHITECTURAL FEES** and **CONSTRUCTION MANAGEMENT FEES**
  as line items priced per Project. Not yet read; relevant to B and to soft costs.

**Pattern note — no new instance.** C was called ambiguous in advance and the
capture sheet pre-committed to treating a near-miss as a mix mismatch rather
than a rounding pass. It came back near-miss and was a mix mismatch. Writing the
interpretation down *before* the number arrived is what kept +2.87% from being
eyeballed into a pass, and is worth repeating for A and B.

---

## 2026-08-04 — B RESOLVED BY MEASUREMENT. Fees COMPOUND, and the residential
## family is not the commercial one. Both halves correct earlier entries.

### B1. What the fees compute on — measured, not inferred

The capture sheet named this "the line that matters most" and said to read it off
rather than infer it. Read off, by perturbation, on the residential model
(Average 2 Story, Brick Veneer - Wood Frame, 2,000 sf living area, national
average, Release Year 2018):

| Contractor | Architectural | Total building cost | $/SF |
|---|---|---|---|
| 15.00% | 0 | $220,262.07 | 110.13 |
| 15.00% | 10.00% | **$242,288.28** | 121.14 |
| 0 | 0 | **$191,532.24** | **95.77** |

Predictions computed *before* the second run:
- compounding → 220,262.07 × 1.10 = **242,288.28**
- parallel on bare → 191,532.23 × 1.25 = 239,415.29

The measurement returned 242,288.28, exact to the cent. The both-zero run
returned 191,532.24 against a predicted 191,532.23 (one cent, rounding).

> **`total = bare × (1 + contractorFee) × (1 + architecturalFee)`**

**THIS CORRECTS AN EARLIER FINDING IN THIS THREAD.** B was previously recorded
as resolved for commercial with fees applying "in parallel on the bare
subtotal", from the public model page decomposition 146.52 + 36.63 + 12.82 =
195.97. That reading was wrong. The same figures are exactly sequential:
146.52 × 1.25 = 183.15, × 1.07 = 195.97. Parallel application would have given
193.41. The three addends summing to the total is consistent with BOTH
structures and therefore discriminates neither — the decomposition was
over-read. The perturbation test discriminates; the addition never could.

Consequence, and it is the case the capture sheet explicitly flagged: for
commercial, 25% + 7% is **not** 32%. It is 1.25 × 1.07 = **1.3375 → 33.75%**.

### B2. The two families carry different fee treatment — confirmed

Read directly off the estimator's own default fields, both families:

| | Commercial (Apartment 1-3) | Residential (Average 2 Story) |
|---|---|---|
| `ContractorFees` | **25.00%** | **15.00%** |
| `ArchitecturalFees` | **7.00%** | **0** |
| `UserFees` | 0 | 0 |
| Labor basis | Standard Union | **Residential** (RES wage rate) |
| Priced per | gross floor area | **living area** |
| Geometry input | exterior wall system | **perimeter (L.F.)** |
| Total fee load | **×1.3375** | **×1.15** |

**The per-family fee lookup is now required by measurement, not designed for a
hypothesis.** A single fee rule across families would misprice by 18.75
percentage points and would silently attribute a design fee to detached housing
that RSMeans ships at zero.

Residential architectural fees are not a per-type default at all. They are a
**range** published as Division 1 line items — minimum **4.90%**, maximum
**16.00%** (plus alteration adders: +50% for work to $500k, +25% over $500k) —
and the estimator ships the field at 0, leaving the choice to the estimator's
user. Commercial, by contrast, pre-populates a type-specific point value.

### B3. Construction Management — a separate family, and the tool must choose

CM fees exist in the residential set as their own Division 1 line family,
scaled by project value rather than by building type:

| Construction management fees | Rate |
|---|---|
| for work to $100,000 | 10.00% |
| for work to $250,000 | 9.00% |
| for work to $1,000,000 | 6.00% |

**Additive or alternative: the estimator does not decide.** Its fee fields are
contractor / architectural / user only — there is no CM field. So CM is not
applied by default and is not modelled as an addition to the architectural fee.
Anyone wanting CM-at-risk must enter it in User Fees, which means **our tool has
to state which delivery method it assumes.** Design-bid-build (architectural
fee, GC markup) and CM-at-risk (CM fee on project value) are different stacks,
and the current model implicitly assumes the former by having no CM concept.
Logged as an OPEN DECISION, not a defect, pending a product call.

### B4. What this does to A1 — the gate held

The prediction that B gates A1 was correct and the failure mode was exactly the
one named: a residential "bare" figure is not bare in the same sense as a
commercial one.

- Commercial Apartment 1-3, national, 2018: **$192.57/SF is fee-INCLUSIVE at
  33.75%.** Bare = 192.57 / 1.3375 = **$143.98/SF** of gross floor area.
- Residential Average 2 Story, national, 2018: **$110.13/SF is fee-inclusive at
  15% with NO design fee.** Bare = **$95.77/SF** of living area.

Pulling A1 before B would have compared a 33.75%-loaded GFA number against a
15%-loaded living-area number and filed the difference as a tier effect. The
whole 15-city sweep in the previous entry is fee-inclusive at 33.75% and must
be normalised before any level is lifted from it. (Ratios in that entry are
unaffected — a constant multiplier cancels.)

**Still open, and it decides how A1 gets filed:** what `costPerSqFtByUse` is
meant to represent. `cost.ts` computes `hard` and adds soft/permit/demolition/
impact separately, which implies the constants are hard cost — GC O&P included,
design fee excluded. That maps to bare × 1.25 = **$179.97/SF** for the
apartment model, and to neither $143.98 nor $192.57. Do not lift any of the
three until that mapping is decided explicitly.

**Vintage stamp applies to every level above: Release Year 2018.**

---

## 2026-08-04 — Mapping decided, denominator resolved, and a THIRD family
## divergence found. A1 is still not safe to pull.

### The mapping — `costPerSqFtByUse` is `bare × 1.25`

DECIDED (product call, reasoning recorded so it survives without the thread):

`cost.ts` computes `total = hard + soft + permit + demolition + impact`, and the
soft-cost comment defines soft as "A&E, permitting consultants, legal, developer
OH". **A&E is explicitly in `soft`, so the architectural fee must be OUT of
`hard` or it is counted twice** — that is the double-count this thread has been
circling from the start, and this is where it resolves. Contractor O&P has no
home in any other term, so it must be IN `hard`.

- `$143.98` (bare) would strand GC O&P in no term at all.
- `$192.57` (fee-inclusive) would double-count A&E against `soft`.
- **`bare × 1.25 = $179.97/SF` is the only value consistent with the engine's
  own decomposition.**

**Normalization is part of the capture from now on, and it differs by family:**

| Family | From estimator total | To `hard` basis |
|---|---|---|
| Commercial | ÷ 1.3375 | × 1.25 |
| Residential | ÷ 1.15 | × 1.25 |

Do not do this arithmetic in your head at tuning time. It is written here
because that is when it will otherwise be got wrong.

### Denominator — RESOLVED in code. `gfa` is GROSS.

Traced the derivation rather than assuming:

- `envelope.ts`: `maxFloorAreaSqFt = Math.round(far * lot)`. FAR is a
  gross-floor-area measure in zoning code, so the envelope is gross.
- `defaultSpec.ts`: `gfa = quantizeGfa(env.maxFloorAreaSqFt * 0.85)`, fallback
  `parcel.lot.sizeSqFt * 1.0` (a 1.0-FAR equivalent). Still gross.
- `estimates.ts`: `avgUnitGrossSqFt = 1300`, whose own comment grosses up from a
  ~1,000 sf NET unit at ~75% efficiency. The codebase already reasons in gross
  and already carries a net-to-gross factor.

**Consequence — the mismatch is scoped to A1 and only A1.** The existing
constants derive from commercial models priced per gross floor area, so their
basis MATCHES `gfa`. The detached residential constant is priced per **living
area**, so it does NOT. Living area excludes garage, unfinished basement and
mechanical space (the model carries Basement as a separate parameter, i.e.
outside the priced area), and typically stairwells and wall thickness.

**The gross-to-living ratio was NOT measured and is NOT estimated here.** The
estimator publishes only living area for this family, so the ratio is not
obtainable from this source. Per the standing rule, no direction and no
magnitude is recorded. A1 cannot produce a usable constant until this is
sourced elsewhere or the tool decides to price detached housing on a living-area
input instead of `gfa`.

### THIRD family divergence — wage basis is STRUCTURALLY LOCKED

Checked because the fee and denominator mismatches suggested a pattern. It is a
pattern:

| | Commercial | Residential |
|---|---|---|
| `sqftLaborId` options | Standard Union, Open Shop | **Residential — ONE option** |

The residential family **cannot be run at Standard Union.** The labor basis is
not a shared axis the two families happen to be set differently on; it is
locked per family and not selectable.

**This damages the candidate per-family index construction.** The 15-city
dispersion measured in the previous entry came from Apartment 1-3 at *Standard
Union*. It is a union-market dispersion. Applying it to a detached constant
priced at the *Residential* wage rate mixes two labor markets, and this source
offers no way to size that error — the control run that would settle it cannot
be constructed. The shape-from-2018 / levels-from-2021 proposal must carry this
caveat explicitly; it is a second unquantified gap stacked on the first.

**Three instances now: fee treatment, denominator, wage basis.** Every one is
two conventions sharing one column in `costPerSqFtByUse`. Assume more exist and
check before pulling, not after.

### CLOSED — Construction Management (product decision)

The tool assumes **design-bid-build by omission** and that assumption is KEPT.
Rationale: a CM axis requires a delivery-method question users cannot answer at
the stage this tool serves, and the 6–10% CM scaling is smaller than the
uncertainty already in the base rate. To be **disclosed on the Methodology page
as a stated assumption, not modelled as a variable.** Logged closed.

### Soft-cost defect (defect 3) — CLOSED WITH A NUMBER. The number is ZERO.

The defect was: `costPerSqFtByUse` may already embed contractor O&P and A&E, in
which case `softCostPct = 0.25` (documented as "A&E, permitting consultants,
legal, developer OH") double-counts A&E. It has been carried as a bounded but
unquantified 0–7% for several rounds.

**Under the mapping decided today it closes at exactly zero overlap, by
construction:**

- `hard = bare × 1.25` — bare construction plus GC overhead & profit. Contains
  **no** design fee.
- `soft = 0.25 × hard` — A&E, permitting consultants, legal, developer OH.
- The architectural fee appears in `soft` and nowhere else. **No overlap.**

That is what makes the mapping the right one rather than merely a defensible
one: it is the choice that makes the two terms disjoint.

**⚠️ NON-DISCRIMINATING — do not cite this as support for 0.25.** It was
tempting to note that RSMeans' 7% architectural fee inside our 25% soft bucket
leaves ~18 points for permitting consultants, legal and developer OH, and call
that a passing cross-check. **It is not a test.** Almost any soft-cost figure
between roughly 15% and 40% would leave a "plausible" remainder for three
unpriced categories. A check that cannot reject has no power to confirm, and
this one cannot reject. It is recorded here ONLY so that it is not
re-discovered later and mistaken for evidence. **`softCostPct = 0.25` remains
sourced exactly as it was — an industry-standard 20–30% mid-range pick — and is
NOT corroborated by anything in this thread.**

**Scope limit, stated precisely.** The zero applies to the CORRECTED structure —
i.e. once `costPerSqFtByUse` is actually set to `bare × 1.25`. For the constants
in the code TODAY (340/390/365/450), the overlap remains **unknown**, because
those constants have no known derivation and therefore no known composition.
This is not a hedge: an unsourced constant cannot be decomposed, and claiming a
figure for its A&E content would be exactly the mechanism-without-measurement
error this ledger keeps recording.

`estimates.ts` DEFECTS block intentionally NOT edited yet — it describes the
code's current state, and the constants have not moved. It gets updated in the
same commit that moves them, not before.

---

## READING RULE — sums don't discriminate, ratios do

Logged separately from the pattern line because it is a different failure and
will recur independently.

The "fees apply in parallel" error was **not** caused by missing data. The
discriminating evidence was already in this ledger, in the row that stated the
wrong conclusion. Apartment 4-7 was recorded as
`bare $145.01 → contractor 25% $36.25 → architectural 7% $12.69 → total $193.94`.
That `$12.69` is 7% of **$181.26** (the contractor-inclusive subtotal), not 7%
of **$145.01** (bare, which would be $10.15). The refutation was one division
away and sat unexamined for rounds.

What went wrong is a specific reading habit: **`a + b + c = total` was treated
as evidence of parallel application.** It is not evidence of anything. A
sequential structure also produces addends that sum to the total — that is what
addends do. The sum is consistent with every structure and therefore
discriminates none of them.

> **Rule: when checking how a total is composed, never verify by addition.
> Verify by taking the RATIO of each addend to its candidate base.** The sum
> tests arithmetic; only the ratio tests structure.

This is distinct from the mechanism-without-measurement pattern. There, no
measurement existed. Here the measurement existed, was recorded, and was
misread — which is harder to catch, because the entry looked sourced and
carried a VERIFIED status.

Corollary applied 2026-08-04: the perturbation test that settled B did work
precisely because it was designed to discriminate — two structures, two
different predicted numbers, computed before the run. Prefer that shape.

### DEFECT 6 (new) — the 0.75 net-to-gross factor is PICKED, in the main path

`estimates.ts:596-600`:

```
// Gross residential area per dwelling unit (incl. circulation/common area) —
// used to estimate how many units a buildable envelope implies. The median
// multifamily NET unit is ~1,000 sf (Statista 2023); at ~75% net-to-gross
// efficiency that grosses up to ~1,300 sf/unit.
export const avgUnitGrossSqFt = 1300
```

**The 1,000 sf net figure is sourced (Statista 2023). The 0.75 is not.** It is
asserted as "~75% net-to-gross efficiency" with no citation, and 1300 is simply
`1000 / 0.75 = 1333` rounded. The sourced half lends the unsourced half an
appearance of provenance it does not have — the same shape as the `costPerSqFtByUse`
comments that read as attributed but were selected.

**This is not a side path.** `avgUnitGrossSqFt` drives:
- `envelope.ts` → `maxUnits`
- `defaultSpec.ts` → `units` on every auto-generated spec
- and `units` feeds `impactFee(...)` and the unit-triggered hurdles (e.g. Boston
  Article 80 Small Project Review at 15+ dwelling units).

So a picked efficiency factor propagates into fee dollars and into whether a
regulatory hurdle fires at all.

Recorded as OPEN. No direction, no magnitude — real net-to-gross efficiency
varies with building form (double-loaded corridor vs point access block vs
walk-up) and 0.75 may well be reasonable. That is exactly why it needs a source
rather than a defence.

Noted for the record: this was found because the denominator work sent us to
read that comment closely. It had been sitting in the main path unexamined.

---

## 2026-08-04 — AUSTIN C. Legal standing confirmed, and a live defect found in
## shipped Austin output.

### Legal standing — CONFIRMED IN EFFECT, no injunction

Checked because the task said "confirm legal standing" and Austin's land
development code has a history of being invalidated on protest-rights grounds
(the 14th Court of Appeals upheld invalidation of two Council LDC votes in 2022).

City of Austin Development Services, "HOME Amendments" (fetched 2026-08-04):
- **Phase 1** adopted 2023-12-07 (Ord. 20231207-001); applications from 2024-02-05
- **Phase 2** adopted 2024-05-16; citywide applications from 2024-11-16
- Site Plan Lite & Infill Plat adopted 2025-03-06; applications from 2025-06-16

Both phases are in effect. No suspension, injunction, or adverse ruling appears
on the City's own status page. Recorded as VERIFIED-IN-EFFECT as of 2026-08-04.
Re-check before relying on it — this is the kind of fact that changes by
litigation, not by schedule.

### The rules — sourced from the Phase 1 ordinance summary

AIA Austin, "HOME Initiative Phase I Ordinance Summary + FAQ" (summarising
Ord. 20231207-001), read directly:

**Subchapter F is ENTIRELY WAIVED** for any site using the Duplex, Two-Unit
Residential, or Three-Unit Residential Use — verbatim: *"No tent, no additional
documentation and review time, no extra Gross Floor Area definition, no
exemption calculations, no sidewalk articulation."*

It is replaced, **only inside the Subchapter F boundary**, by a FAR gradient.
Outside that boundary there is *no* FAR restriction and the 2–3 units are still
allowed. FAR maxima are **the greater of the ratio or the floor value**:

| | Two units | Three units |
|---|---|---|
| **Total** | **0.55 or 3,200 SF** | **0.65 or 4,350 SF** |
| Any single new unit | 0.4 or 2,300 SF | 0.4 or 2,300 SF |
| Any two new units | — | 0.55 or 3,200 SF |

Gross Floor Area here is the base LDC definition **minus the parking/loading
exclusions** — garages COUNT toward FAR; unenclosed porches do not.

**Single-family is untouched.** Verbatim FAQ: *"What changes do I need to make
if I'm designing or building a single-family home under Subchapter F? Nothing
at all. Proceed as before."* Subchapter F's own cap is **0.40 FAR** (confirmed
by the ordinance summary's reference to "the area above Subchapter F's 0.40
FAR"), plus the sloped tent envelope from 15 ft at the side setback. The City's
HOME page states Subchapter F's **32 ft** height restriction still applies to
single-family use, against the 35 ft base-zone height.

### The boundary IS published and point-queryable — verified live

`services.arcgis.com/0L95CJ0VTaxqcmED/.../PLANNINGCADASTRE_residential_design_standards/FeatureServer/0`
(duplicate of the older `McMansion` layer — identical SHAPE_AREA
2,057,091,911.87; prefer the named one).

Returns `ZONING_OVERLAY_NAME: 'RESIDENTIAL DESIGN STANDARDS'`,
`SOURCE_DOCUMENT: 'LDC/25-2-Subchapter F'`, `ZONING_STATUS: 'APPROVED'`.

Discrimination verified across five points — this is a real boundary, not a
citywide blanket:

| Point | Inside |
|---|---|
| Hyde Park (30.3070, -97.7300) | 1 |
| Downtown (30.2672, -97.7431) | 1 |
| Far north (30.4400, -97.6800) | 0 |
| Far southwest (30.2200, -97.8800) | 0 |
| Northeast edge (30.3500, -97.6400) | 0 |

### THE DEFECT — Austin SF parcels currently assume FAR 1.0

`austin.ts` has `'SF-1'|'SF-2'|'SF-3': { h: 35, f: null }`. `f: null` →
`envelope.ts` returns `maxFloorAreaSqFt: null` → `defaultSpec.ts` falls through
to `parcel.lot.sizeSqFt * 1.0`, **a 1.0-FAR assumption**, on Austin's most
common residential zones.

Real by-right limits inside the Subchapter F boundary are 0.40 (single-family)
to 0.65 (three units). The error runs BOTH ways because of the floor value:

| Lot | We report today | Actual 3-unit by-right | Error |
|---|---|---|---|
| 7,000 sf | 7,000 sf | max(0.65×7000, 4350) = **4,550** | **+54% overstated** |
| 3,000 sf | 3,000 sf | max(0.65×3000, 4350) = **4,350** | −31% understated |

The existing provider comment says the 2019 zoning snapshot means "limits may
understate today's buildable envelope". For units and lot size that is right.
**For floor area it is backwards** — we overstate on any lot above ~6,700 sf.

### Encoding note — `max(ratio × lot, floorSqFt)` is not expressible today

`envelope.ts` computes `maxFloorAreaSqFt = Math.round(far * lot)`. There is no
floor-allowance concept. Two ways to carry it:

1. Austin supplies an *effective* FAR — `max(0.65, 4350/lot)` — since
   `lot × max(0.65, 4350/lot) ≡ max(0.65×lot, 4350)` exactly. No shared-code
   change, but `zoning.maxFAR` would then display a derived number (1.45 on a
   3,000 sf lot) that appears nowhere in the LDC. **Rejected — that is a
   computed value wearing the label of a code citation.**
2. Add an optional floor-area allowance to the zoning limits and apply
   `Math.max(far * lot, floor)`. Shared change, small, and "greater of ratio or
   floor value" is a genuine and reusable LDC construct. **Chosen.**

**Headline regime decision:** the envelope reports the **3-unit by-right
maximum** (0.65 / 4,350), not the single-family 0.40. Rationale: `envelope.ts`'s
own docstring states its purpose is "what does this parcel allow?" — and under
HOME, three units are allowed by right on SF-1/2/3. Reporting 0.40 would
describe one program choice, not the parcel's allowance.

### CORRECTION to the encoding decision above — the 3-unit ruling was WRONG

The entry above chose to report the 3-unit by-right maximum, reasoning from
`envelope.ts`'s "what does this parcel allow?" docstring. **That was wrong on
two counts and is superseded by what was built.**

**1. It collapsed a conditional established one paragraph earlier.** The FAR
gradient applies ONLY inside the Subchapter F boundary. Outside it there is no
FAR limit at all. Encoding `max(0.65 × lot, 4350)` citywide would have imposed a
cap the LDC does not impose — on every Austin parcel outside the boundary — and
it would have read as a citation.

**2. It made the envelope conditional on a program the user has not chosen.**
0.40 (single-family) and 0.65 (three units) are ALTERNATIVES, not a floor and a
ceiling. Reporting only the largest assumes a three-unit build, and that flows
into `maxUnits`, impact fees and the unit-triggered hurdles. On the 7,000 sf
Hyde Park lot it would claim 4,550 sf where single-family allows 2,800 — trading
a 54% overstatement for a 63% one for anyone not building three units.

### BUILT (2026-08-04) — all 582 tests pass, build and lint clean

- `parcel.ts`: `zoning.farFloorSqFt` (the "greater of ratio or floor value"
  allowance) and `zoning.farUnconstrained` (a KNOWN absence of FAR).
  `envelope.farBasis` gains `'unconstrained'`; `envelope.floorAreaFromAllowance`
  records when the floor governed.
- `envelope.ts`: applies `max(far × lot, farFloorSqFt)`. An allowance is a floor
  under a cap, **never a cap of its own** — it cannot manufacture a limit on an
  unconstrained parcel. Test asserts exactly that.
- `austin.ts`: fetches the Subchapter F boundary in the existing fan-out and
  resolves SF-1/2/3 in two branches. **Inside → single-family base case (0.40 /
  32 ft). Outside → `farUnconstrained`, no number.** A FAILED boundary fetch is
  NOT treated as "outside" — that would report "no FAR limit" on the strength of
  a network error; it falls back to base-zone limits with FAR unresolved.
- `ParcelPanelContent.tsx`: renders the unconstrained case explicitly ("No
  floor-area ratio limit applies here — size is governed by height, setbacks and
  lot coverage instead") rather than showing nothing, because silence reads as
  missing data and invites the reader to assume a cap.
- Stale-data comment in `austin.ts` corrected: it said limits "may understate",
  which is right for units and lot size and **backwards for floor area**.

**STILL OPEN — product ruling requested.** The headline inside the boundary is
the single-family base case. `AUSTIN_HOME_FAR` carries the sourced 2-unit
(0.55 / 3,200) and 3-unit (0.65 / 4,350) gradients ready to use. Whether the
envelope should show the base case, the chosen-program alternative, or the full
set of alternatives is a product decision and is NOT resolved by a docstring.

**DEFECT 7 (new, global — found while fixing Austin).** `defaultSpec.ts` falls
back to `parcel.lot.sizeSqFt * 1.0` whenever the envelope yields no floor area.
That is an unsourced FAR-1.0 assumption and it is **not Austin-specific** — it
fires for every city on every parcel with unresolved or unconstrained FAR. Austin
merely made it visible. Recorded OPEN; no direction or magnitude claimed.

---

## 2026-08-04 — FETCHED-BUT-UNREAD AUDIT. Negative result, and the reason matters.

Run because the same failure had recurred four times (Boston City Hall OWNER,
tier, parking, Minneapolis Built Form FAR): the provider holds the data and the
engine ignores it. Mechanical sweep of every field named in a `fetchFeatures` /
`fetchParcelSnap` / `fetchWhere` call against every reference elsewhere in the
same provider.

**6 hits across 14 providers. On inspection, ZERO are defects.**

| Provider | Unread field | Verdict |
|---|---|---|
| miami | `FLR` | **Correct.** Not a numeric floor-lot ratio — a letter suffix (A/B/blank) selecting a Miami 21 Article 4 row, redundant with `M21_ZONE` (T6-24**A** vs T6-24**B**). Verified against the live layer: 36 distinct zones, FLR ∈ {A, B, blank}. The module comment already said so. |
| seattle | `OVERLAY` | **Correct for FAR.** Checked whether it identifies the Station Area Overlay (which would select SMC 23.47A.013 Table B, higher FAR than the Table A we use). It does not: `SA` appears only on Industrial/Maritime zones (UI, MML), and NC/C parcels carry only MP/NG/PN/RG/SG/SS. Table A stands, as the module documents. |
| sandiego | `asr_total` | **Correct omission.** California is a Prop 13 frozen-assessment state, so an assessor total is not a market proxy. `assessedValue` is documented for full-market states only. Fetching it is mild waste; not surfacing it is right. |
| sanjose | `AREATYPE`, `DESCRIPTION` | Benign — auxiliary descriptors on the historic/height layers. |
| nashville | `LUCode` | Benign — redundant with `LUDesc`, which is read. |
| la | `FID` | Benign — ArcGIS internal. |

### Why the audit missed the thing it was built to find

Minneapolis Built Form is the motivating case, and **this sweep would not have
caught it.** The provider fetches `Abbrv` and *does* read it — for HEIGHT. What
it never does is read it for FAR.

So the real defect class is not *fetched but unread*. It is:

> **fetched, and read for one purpose, while a second purpose that the same
> field answers goes to null.**

That is invisible to a presence/absence sweep, because the field is present in
both the fetch and the body. Detecting it needs the inverse question — for each
NULL the engine emits, does any already-fetched field bear on it? — which is a
per-field, per-consumer check, not a grep.

Recording the negative result and the refinement together, because "the audit
came back clean" on its own would be misleading: the audit came back clean AND
its premise was too narrow to cover the four known instances.

---

## 2026-08-04 — A FALSE PROVENANCE CLAIM WAS SHIPPING. Corrected in text.

Found while cherry-picking a disclosure. Two user-facing strings attributed the
cost base rates to RSMeans:

- `COST_DATA_VINTAGE = 'RSMeans 2026 base rates · 2021 city cost indices'`
- Methodology page: "Base rate by use (U.S. national average, **RSMeans 2026**)"

`costPerSqFtByUse` has **no verified derivation**. The "RSMeans 2026" comment on
it was an unsupported attribution, and it had been promoted into a user-facing
provenance claim. The city-index half of that string is genuinely sourced
(verified figure-by-figure against the free 2021 CCI for all 15 cities); the
base-rate half was not.

> **A number that is merely plausible must not be published wearing a source's
> name.** This is rule 3 (a citation on one input launders the derivation) at
> its worst: the composite string carried one true half and one false half, and
> the true half made the whole thing read as sourced.

Corrected to state that base rates are internal estimates of unverified
provenance, that city indices are the RSMeans 2021 CCI, and that independent
industry figures for market-grade buildings run higher.

### Also disclosed: sitework

The cost model has no sitework term at all. Previously undisclosed, so the total
**read as a complete construction cost**. That is the one failure mode worse
than a wrong number — every other known gap is either labelled (the FAR
fallback) or does not move the total. Now named explicitly, including that it
can be a significant share of a real budget.

### The sentence that must survive verbatim

> **The old constants sit nearer typical-market than my correction did, but that
> is coincidence, not evidence.**

An unsourced number landing closer to reality than a sourced one is a fact about
luck, not about method. The temptation to read it as vindication for leaving
`340` alone is real and must be refused: it is an unsourced number that happens
to be less wrong today, with no reason to expect that holds.

### Verification of the cherry-pick itself

Disclosure-only was **verified, not asserted** — the failure mode being guarded
against is a "text-only" change quietly dragging a constant with it:

- diff vs the merge commit: 3 files, all text (`analyze.ts`, `estimates.ts`
  string + comment, `Methodology.tsx` paragraph)
- `cost.ts`, `assumptions.ts`, `envelope.ts`, `defaultSpec.ts`: **zero diff**
- no numeric constant changed anywhere in `estimates.ts`
- hard-cost formula: **byte-identical to `origin/main`**

Caveat stated rather than hidden: `cost.ts` as a whole DOES differ from
`origin/main` — Philadelphia's 1% Development Impact Tax, which arrived with the
city-expansion commit and belongs to the `impact` line, not the hard-cost line.

---

## STANDING RULE — only outside measurement finds real defects

This session's complete record of what actually caught something:

| Instrument | Defect found |
|---|---|
| External cost benchmark (Cumming) | `CONTRACTOR_OH_P.residential` applied to multifamily — 8.7% understatement; and a fully traceable chain that had moved *further* from reality than the untraceable constant it replaced |
| Live GIS distinct-value query | Minneapolis publishes UN1-3/CM1-4/DT1-2/PR1-2/RM1-3/TR1, not the R1-R6 of Municode Ch. 546 — encoding the researched chapter would have matched **zero** parcels |
| Live field-value query | Miami `FLR` is a letter suffix (A/B/blank), not a floor-lot ratio |
| "Is this text true in its NEW home?" | a disclaimer accurate on the cost branch and false on `main` — and beneath it, `COST_DATA_VINTAGE`, a live user-facing provenance claim that was half false |

**Found by internal verification: nothing.** 651 tests green throughout, type
checker clean, linter clean. Each of these errors was internally consistent on
both sides of a boundary — a name that matched, a field that existed, a sentence
that had once been true.

> **Rule: internal checks verify that the code does what you said. Only an
> outside measurement checks whether what you said is true. External validation
> is required before any level change or provenance claim ships.**

Two corollaries earned the hard way this session:

1. **Traceability is not accuracy.** A chain of individually sourced steps is
   validated only by its output against a number obtained outside the chain.
2. **Disclosure copy is code.** It makes claims; claims can be wrong in a new
   context even when they were right in the old one. Never move explanatory text
   between contexts without re-checking it against where it lands.

---

## 2026-08-04 — MIAMI: a wrong number, shipped, reading as computed.

Taken first over Minneapolis on the correct criterion: **Minneapolis emits a
labelled gap; Miami emitted an authoritative-looking number that was wrong.**
Same category as the sitework omission and the false RSMeans string — the user
forms a belief the figure does not support.

### What was wrong — two defects, the second worse

**1. The constant was borrowed from another city.** `MIAMI_FT_PER_STORY = 12`,
whose own comment read *"the same mid-range convention the Denver module uses
for its story-based code."* An unsourced constant lifted from a different
jurisdiction's module and applied to Miami parcels. Miami 21 Article 1 states
it outright:

> "A Story is a Habitable level within a Building of a maximum **fourteen (14)
> feet** in Height from finished floor to finished floor."
> "Building Height is the vertical extent of a Building measured in **Stories**."

**2. The round-trip published a wrong story count.** Far worse, because it
contradicts the code directly:

```
T6-80  → 80 stories (code)
       × 12 ft/story  (miami.ts, unsourced)   = 960 ft
       ÷ 11 ft/story  (envelope, FT_PER_STORY) =  87 stories   ← PUBLISHED
```

**The tool told users an 80-story district allowed 87 stories.** Two conversions
through two different unsourced constants, neither cancelling. No null, no test
failure, no type error — the archetype of *read, mapped, and wrong*.

### Fix

- `MIAMI_MAX_FT_PER_STORY = 14`, sourced to Article 1 and labelled as the
  code's **maximum**, so a height in feet is an implied ceiling rather than a
  published limit.
- `zoning.maxStories` added: a provider can state the story count the code
  states, and `computeEnvelope` uses it directly instead of re-deriving.
- Live re-probe: T6-80-O now reports **80 stories** (was 87) and 1,120 ft
  (80 × 14, code-implied ceiling).

Miami's FAR remains `published-not-fetched` — Article 4 Table 2 is a separate
document, still unread. That is a gap and is recorded as one.

### The instrument that found it

Not a test. The **null inventory** — running the real pipeline against a real
parcel per city and reading the output. 960 ft was flagged because it was the
largest number the tool emits anywhere, and pulling that thread found an
unsourced constant and a contradicted story count underneath it.

### Also caught this session, before either became a finding

- **A single probe is not evidence.** Chicago returned `districtCode: Unknown`
  once under concurrent batch load; three isolated re-probes all return `B3-2`.
  Reporting the first result would have raised a live-regression alarm on a
  shipped city that was working correctly.
- **Measure the pipeline, not your probe.** The first null-inventory attempt
  called `resolveZoningLimits` with `maxFAR: null`, bypassing every
  provider-side resolver (`resolveSfFar`, `austinSfLimits`, `laLimits`, PLUTO
  `farByUse`, `resolveMiami`, `parseMaxFAR`) and reported "11/65 resolved". The
  real figure is 7 of 15 cities emitting a genuine answer. Third instance of
  measuring the instrument instead of the system.

Both promoted to CLAUDE.md as rules 10 and 11; the unit round-trip as rule 12.

---

## 2026-08-04 — THE ft/story SWEEP. Miami was not the only one.

Run because Miami proved the class and `FT_PER_STORY = 11` sits in the envelope,
applied to every city. Three constants were live, none agreeing:

| Constant | Value | Provenance |
|---|---|---|
| `FT_PER_STORY` (envelope, all cities) | **11** | "CRE floor-to-floor design standards (AdventuresinCRE)" — a design convention, not a code |
| `DENVER_FT_PER_STORY` | **12** | its own comment: "the code does not fix a single ft/story, so this is a labeled estimate" |
| `MIAMI_MAX_FT_PER_STORY` | **14** | Miami 21 Article 1 — the only one with a code citation, added today |

**Only two cities convert stories → feet.** Every other city states height in
feet directly (from GIS or from a code table), so the shared 11 is used only to
derive a story count for display, never to produce a height.

### Second instance found — Denver

Same round-trip as Miami, smaller magnitude and therefore harder to notice:

| Zone | Code says | Published |
|---|---|---|
| C-MX-5 | 5 | 5 ✓ |
| C-MX-8 | 8 | 8 ✓ |
| **C-MX-12** | **12** | **13** ⚠ |
| **C-MX-16** | **16** | **17** ⚠ |
| **C-MX-20** | **20** | **21** ⚠ |

Correct below 12 stories purely because `floor(n × 12 / 11)` happens to round
back. The error appears exactly where the buildings are tallest — the same
scaling property as Miami, which is why neither was visible in ordinary use.

### The fix, and the regression inside the fix

First pass patched the two pattern-matching branches of `resolveDenver` and
**left the curated `DENVER_LIMITS` table alone**. C-MX-16 and C-MX-20 (trailing
token) came right; **C-MX-12 stayed at 13**, because it is an exact-match entry
written by hand as `{ ...FORM_BASED, heightFt: ft(12) }` — which silently drops
the story count.

Caught only by re-running the check through `computeEnvelope` rather than
re-reading the diff. **A partial fix to a class of error looks exactly like a
complete one from the code.**

Restructured so the shape cannot recur: every entry now goes through a single
`storeys(n)` helper that emits height AND stories together. 26 entries
converted; no hand-written `{ heightFt: ... }` remains. Two tests enforce it —
every curated entry carries a story count, and stories × constant equals the
stored height.

### Verdicts on the other two flags from the null inventory

**Seattle `NR` — NOT a defect.** Seattle publishes exactly one NR string
(`'NR'`, no suffix). `seattleMaxHeightFt` finds no 2–3 digit token and returns
`null`; `resolveSeattle('NR')` returns `{far: null, heightFt: null}`. It fails
to **nothing**, not to garbage — the safe direction. NR is 9.3% of zoning
polygons (land-area share NOT measured — the layer exposes no area field, and no
direction is claimed for how count relates to area). Classified
`published-not-fetched`: SMC 23.44 sets NR standards.

**San Jose `PQP` — NOT a defect. My flag was wrong on both counts.**
- The civic hard block DOES fire: `assessCivicHardBlock({city:'sanjose', …})`
  returns `{label: 'San Jose City Hall'}`.
- `PQP` is in `siteFlags.ts` `DISTRICT_RULES` as a **soft advisory**, deliberately
  not in `developability.ts` as a hard block — PQP covers schools, libraries,
  parks and utilities, and hard-blocking all of it would violate the standing
  convention against broadening a block-regex without proving it cannot catch a
  legitimate private parcel.

So `PQP` does **not** scope a larger read-mapped-and-wrong sweep. Negative
result, recorded so it is not re-investigated.

---

## 2026-08-04 — MINNEAPOLIS: the `fetched-not-mapped` instance, partly closed.

The null inventory's only `fetched-not-mapped` entry. The provider fetched the
Built Form overlay, read it for HEIGHT, and never read it for FAR.

### Source

City of Minneapolis **Built Form Districts Handbook** (Oct 2023), Interior 1 / 2
/ 3 district pages, read from the primary PDF. The handbook reproduces Table
540-2. Text extraction did not linearise the multi-column tables — the pages
were read as images instead.

### The shape nobody would guess

**FAR = f(built form overlay × use × PRIMARY zoning district).** The handbook's
"UN, RM" column keys on the *primary* zoning code, not the overlay, so **both
layers are required to resolve one number**. That is why the resolver takes two
arguments and why a single-layer lookup could never have worked.

| Built form | 1-3 unit dwellings | Other uses |
|---|---|---|
| Interior 1 | **0.5** | UN/RM 0.5 · others 1.4. **4+ units not allowed** |
| Interior 2 | **0.5** | UN/RM 0.8 · others 1.4 |
| Interior 3 | **SF 0.5 · 2-fam 0.6 · 3-fam 0.7** | 4+ units UN/RM 1.4 · others 1.6 · cluster 0.7 |

Interior 3 is the only Interior district that gives two- and three-unit
dwellings **more** floor area than a single-family house as-of-right — which is
precisely the reform this tool exists to make visible. It is encoded as
`farAlternatives`, so the headline stays the single-family base case and the
alternatives sit beneath it (the Austin pattern, reused unchanged).

### Verified live

A real BFI3 + UN2 parcel now returns **3,002 sq ft** as a single-family house,
with alternatives of two-family 3,602 · three-family 4,202 · cluster 4,202 ·
**4+ units 8,404**. Same lot, 2.8× the floor area under a different program.

### Scope limit, stated rather than papered over

Only Interior 1/2/3 are encoded — 3 of 14 built form districts. Corridor
(BFC3/4/6), Core 50, Transit (BFT10/15/20/30A/30B), Production and Parks publish
a **Base FAR plus an earned premium system** (2-3 premiums at 0.3 / 0.4 / 0.65 /
0.75 / 0.8 / 1.0 depending on district). Those base figures did not linearise and
are NOT guessed: those districts return null and stay `published-not-fetched`.
Premiums are earned rather than by-right, so when they are read they belong in
`farAlternatives`, never in the headline.

A test asserts every unread district returns null, and a second asserts the
superseded Chapter 546 codes (R1/R2B/R4/R6) resolve to nothing — so the trap
that would have matched zero parcels cannot be re-entered silently.

---

## 2026-08-04 — DEFECT 6, and the ft/story constant: checked for DELETION first.

Twice this session the right answer was to stop making a claim rather than
justify it (the Miami and Denver round-trips). So before hunting a defensible
efficiency ratio, both constants were checked for whether they need to exist.

**Both do. Neither is display-only.** Traced, not assumed:

`ftPerStory` / `FT_PER_STORY = 11`
- `defaultSpec.stories` → `cost.ts` → `heightCostFactor(stories)`. The tier step
  at 4→5 stories is **12%**, so the constant can move published cost.
- `feasibility.ts:102` converts stories→height for the height check, which
  decides **AS_OF_RIGHT vs NEEDS_RELIEF**.
- Display (Map, ParcelPanel, Compare).

`avgUnitGrossSqFt = 1300`
- `defaultSpec.units` → `impactFee(...)` → **FEE DOLLARS**
- `envelope.maxUnits` → published unit count
- `analyze.ts` demolition sq ft (units × this) → **demolition cost**
- `feasibility.ts:151` effective existing units → **housing/affordability checks**
- `narrative.ts` existing floor area

### So the fix is exposure, not deletion — and not a fake citation either

**`estimates.ts` comments corrected.** The `avgUnitGrossSqFt` comment previously
read as sourced because the ~1,000 sf net unit cites Statista. It now states
plainly that **the ~75% efficiency is asserted with no source**, and that 1300 is
just `1000 / 0.75` rounded — rule 3, named in place rather than left to be
rediscovered. `FT_PER_STORY` is now labelled a **design convention, not a zoning
code**, with its two substantive consumers listed.

**Both surfaced in the assumptions panel**, with the weak half named in the
user-facing text rather than buried in a comment. A user who gets a unit count
can now see the number that produced it and that half of it is assumed.

**`envelope.storiesBasis: 'stated' | 'derived'`** added. A story count the code
states and one obtained by dividing a published height by an unsourced
convention render identically; only one is a fact about the code. Miami and
Denver now report `stated`; cities publishing only feet report `derived`. A test
asserts a stated count is never overridden by a derivable height — the exact bug
that produced 87 and 13.

### Defect 6 status

**OPEN, but no longer laundering.** The constant remains unsourced; what changed
is that it no longer *reads* as sourced, and its influence on fee dollars is
disclosed where the fees are shown. Closing it needs either a sourced
net-to-gross efficiency or a per-city density the zoning publishes — San Jose's
`PDDENSITY` (units/acre) is the one candidate seen so far, and is per-city, not
a global substitute.

---

## 2026-08-04 — RULE 13 SWEEP, run against the RESOLVED cities first. Boston fails.

Run on the correct asymmetry: **a joint dependency in a city that looks resolved
is worse than a gap in one that doesn't.** A gap emits a null and tells the user
nothing is known. A field resolved from one of two required inputs emits a
confident number, produces no null, fails no test, and looks like a working city.

So the five cities emitting real FAR answers were audited before any backlog
city: **Boston, NYC, Austin, LA, Philadelphia.** Question asked of each: does the
published rule key on anything beyond the single field the provider reads?

### Boston — TWO findings, one of them a shipped wrong number

The zoning layer publishes 19 fields the provider never requested. Two matter:

**1. `NumFloorsMax` — the code's OWN story count, unread.** Populated on **624 of
1,649** subdistricts. The envelope was instead dividing `HeightMax` by the 11 ft
convention.

Measured across the 80 distinct subdistricts publishing BOTH: **28 disagree
(35%).** The pattern is systematic, not marginal — at `HeightMax` 35 the code
says **2 or 2.5 stories** and we published **3**.

Verified live before and after on a real `1F-5000` parcel:
`height=35, stated=2.5 → envelope 2.5 (stated)`. Before the fix: **3**.

Third instance of rule 12 (Miami 87-vs-80, Denver 13-vs-12, Boston 3-vs-2.5),
and the first found in a city already marked RESOLVED.

**2. `DwellingUnitsPerAreaMax` — a published DENSITY field. Checked as a possible
substitute for `avgUnitGrossSqFt` (defect 6) and it is NOT one: populated on
**0 of 1,649** subdistricts.** Empty. Recorded so the lead is not re-chased —
the field exists in the schema and carries no data.

Also unread and NOT claimed as defects: `ConditionNum` / `ConditionTxt` /
`Restrictions` (descriptive text — the example parcel reads "Row House Building
or Town House Building"), setbacks, `DwellingUnitsFactor`, `AmendmentNum`.
Whether any modifies FAR is unestablished; no direction claimed.

### The sweep's own justification, confirmed

Boston sat in the null inventory as `RESOLVED far=2` — correctly, for FAR. Its
story count was wrong on roughly a third of the subdistricts that publish one,
and nothing in 683 tests, the type checker, the linter, or the null inventory
had an opinion. **The inventory measures whether a field resolved, not whether
it resolved from all the inputs the rule requires.** Rule 13's sweep is the only
instrument that asks the second question.

NYC, Austin, LA and Philadelphia remain to be audited against the same question.

### Rule 13 sweep — NYC audited. Three negatives, one minor.

Three questions, cheapest first, per the sharpened rule: **if the source states
it, read it — deriving a stated value is always wrong, even when the derivation
is sound.**

**Q1 — does PLUTO publish a value we derive?** NYC publishes no permitted height
and no permitted story maximum, so there is nothing derived to displace. The
fields that *look* substitutable (`NumFloors`, `BldgArea`, `UnitsTotal`) are the
**existing built** values, and the provider already maps them to `existing.*`,
not to permitted limits. **That is the confusion this check was designed to
find, and it is not present.** Negative.

**Q2 — joint dependency?** 103 fields; 20 unfetched and plausibly FAR-relevant.
Two checked:
- **`ManuFAR` — NEGATIVE.** Measured: M1-4 has `CommFAR 2 / ManuFAR 2`; M1-5 has
  `5 / 5`. `CommFAR` already carries the manufacturing figure. Lead closed.
- **`SplitZone` / `ZoneDist2-4` — MINOR, open.** 19,979 lots of 856,614 (2.3%)
  are split-zoned and we report only `ZoneDist1` as the district. Sampled split
  lots carry a single PLUTO `ResidFAR` and both districts agreed in every sample
  (C2-8/C4-6 → 10; C6-4/C6-2A → 10), so the **FAR is not wrong — the district
  LABEL is incomplete**. A disclosure gap, materially less severe than Boston's
  wrong story count. Logged, not fixed.

**Q3 — field semantics.** `num()` rejects zero (`n > 0`), so PLUTO's
`ResidFAR: 0` on manufacturing districts becomes null rather than a 0-sq-ft
envelope. Verified live: an M2-1 lot returns `farByUse {commercial: 2, mixed: 2}`
with no residential entry and `maxUnits: null`. Negative.

### The sharpened rule, and why it outranks rule 13's own question

Four instances of *the source states it, we derived it* — Miami, Denver, Boston,
and (as a near-miss) the envelope's own story derivation. **One** instance of a
true joint dependency (Minneapolis). The cheap question has a 4:1 hit rate over
the expensive one, so it should be asked first every time:

> **Does the source publish the value we compute?**

Recorded because the ordering is not obvious — joint dependency is the more
interesting failure, so it is the one you reach for first.

**⚠️ CAVEAT — the tally is CONFOUNDED BY SEARCH ORDER.** Q1 was asked first in
every city, so it got first crack at each codebase; any defect findable by
either question scores as a Q1 hit. **This is evidence about which question to
ask FIRST, not about which failure mode is more common.** Do not restate it as a
base rate.

### Sweep status

| City | Q1 published-but-derived | Q2 joint dependency | Q3 semantics |
|---|---|---|---|
| boston | **DEFECT — `NumFloorsMax`, fixed** | not audited | not audited |
| nyc | negative | minor (`SplitZone`, 2.3%) | negative |
| austin | known two-branch, built for | known, built for | not audited |
| **la** | **NOT AUDITED** | **NOT AUDITED** | **NOT AUDITED** |
| **philadelphia** | **NOT AUDITED** | **NOT AUDITED** | **NOT AUDITED** |

LA and Philadelphia remain. Recorded explicitly so the sweep is not read as
complete.

### Rule 13 sweep COMPLETE — LA defect found, Philadelphia clean.

**LA — DEFECT, in the zone-string parser.**

LA already parses the composite string correctly in principle (strip qualifier →
split base zone / height district → apply the C/M Height-District-1 override).
The bug was in the strip:

```
/^[[(]?[QT][\])]?-?/i      // knew [Q] (Q) [T] (T) — and nothing else
```

LA also publishes `(F)` and `(WC)` qualifiers. Measured live: **14 of 2,128
distinct `ZONE_CMPLT` strings (0.7%)** carry an unhandled prefix. **Both failure
modes overstate:**

| Zone string | Base parsed as | Result | Should be |
|---|---|---|---|
| `(F)CM-1-CUGU` | `(F)CM` | FAR **3.0** — C/M override never fired | **1.5** (LAMC §12.21.1-A.1) |
| `(F)RE11-1` | `(F)RE11` | FAR **3.0** — base-controlled R test never fired | **null** (no FAR asserted) |

Fixed to accept any bracketed qualifier, with the bare `Q`/`T` branch preserved
so unbracketed forms behave as before. Tests pin every observed prefix form and
assert an unqualified string is left untouched.

**This is a THIRD failure shape**, distinct from the two the sweep was built for:
not *published-but-derived*, not *joint dependency*, but **a parser whose input
domain was narrower than the source's actual output**. Q1 and Q2 would both have
missed it; it surfaced only from reading live distinct values of the field the
parser consumes. Add to the sweep: **enumerate the real value space of any field
you parse, rather than the forms you expect.**

**Philadelphia — CLEAN on all three questions.**

- **Q1.** `ZoningCodeCharacteristics` publishes `MaxHeight` and `MaxFAR`; both
  are fetched. Unfetched `MinLotArea` / `MinPercent` are not FAR inputs. Nothing
  derived that the source states.
- **Q2.** `long_code` vs `code` differ only by hyphenation (`CMX3` / `CMX-3`) —
  37 distinct pairs, all cosmetic. Not overlays, no joint dependency.
- **Q3.** The free-text `MaxFAR` parser was already built and tested against the
  published percentage form.

Two staleness fields go unread and are logged rather than fixed: **`pending`
is `'Yes'` on 7 of 29,205 polygons** (a pending rezoning bill), and
`sunset_date` is populated on exactly **1**. Neither changes a FAR we publish
today; both would let the tool say "a rezoning is pending here", which is
product surface, not a defect.

### Final sweep table

| City | Q1 published-but-derived | Q2 joint dependency | Q3 semantics / parse |
|---|---|---|---|
| boston | **DEFECT — `NumFloorsMax`, fixed** | not audited | not audited |
| nyc | negative | minor — `SplitZone` 2.3%, label only | negative |
| austin | known two-branch, built for | known, built for | not audited |
| la | negative | negative (already parsed) | **DEFECT — `(F)`/`(WC)` prefixes, fixed** |
| philadelphia | negative | negative | negative |

**Two defects across five cities, in different shapes, neither caught by 683
tests.** The prediction of "at least one more" held; the shape it took did not
match either question the sweep was designed around.

---

## 2026-08-05 — THE ENUMERATION CHECK. Philadelphia was not clean after all.

Built as `scripts/enumerate-parser-domains.ts` — mechanically runnable and
re-runnable when a city republishes. For every string parser: pull the LIVE
distinct values of the field it consumes, run the parser over all of them, and
report the values it does not handle.

**This is the only question that asks what the source EMITS rather than what it
publishes**, and those differ whenever a schema is more permissive than its
documentation.

### Result

Most unhandled values are **correctly-disclosed gaps** where the parser returns
null by design, already recorded in the null inventory: Seattle's downtown
(DMC/DOC/DH — outside NC/C), Minneapolis Corridor/Transit/Core/Production,
Chicago's B/C/D/M, Miami's T4/T5/D1-3/CI/CS (that module explicitly documents
returning null there), Denver's Former-Chapter-59 and Downtown families, SF's
special-use districts (PDR/SALI/Mission Bay/Park Merced).

**One genuine surprise: Philadelphia's free-text `MaxFAR` parser — 6 of 9
published values unhandled, three of them wrongly.**

### The defect

`OTHER_DENOMINATOR` rejected `of lot area`, on the stated reasoning that it was
"a percentage measured against something other than lot floor area."

**It is not. That IS the FAR expression.** Philadelphia's Zoning Quick Guide
(PCPC, February 2026) labels the RM district diagrams literally
**"FAR = 70% of Lot Area"**, **"= 150% of Lot Area"**, **"= 350% of Lot Area"**,
under a row headed *"Max. Height / FAR (Floor Area Ratio)"*. Floor area as a
percentage of lot area is the definition of a floor-area ratio.

So the published FAR for **RM-2 (0.70), RM-3 (1.50) and RM-4 (3.50)** — the
higher-density residential districts — was being discarded and sent to
`defaultSpec`'s FAR-1.0 fallback. **RM-2 was published at an assumed 1.0 against
a code figure of 0.70: a 43% overstatement, in the direction that flatters the
site.** Fourth defect class to run that way.

`district area` / `excluding streets` stay rejected and are genuinely different
— RMX-1/2 measure across a whole district, which cannot be applied to one
parcel. `lot coverage` stays rejected: footprint, not floor area.

### FOUR EXISTING TESTS ENCODED THE DEFECT

`philadelphia.test.ts` asserted `parseMaxFAR('70% of Lot Area')` returns null,
with the comment *"70% of Lot Area is lot coverage, not floor-area ratio."* The
three district-level tests asserted `null` FAR for RM-2/3/4.

**The test suite was pinning the wrong assumption in place.** Nothing about
having tests protected this — the tests were the thing making it durable.
Corrected against the primary source, with the correction noted inline so the
next reader sees why the assertion flipped.

### A search summary contradicted the source, and was wrong

A web search reported RM-2/3/4 at 120% / 225% / 525%. The GIS says 70 / 150 /
350. The primary guide resolves it: **those are base + Mixed Income Housing
low-income bonus** (+50 / +75 / +175, printed on the same page). The summary
reported bonused figures as base. Checked rather than trusted — the discipline
that has now caught a bad secondary source four separate times this session.

### Stopping condition — RESET

Philadelphia had been recorded clean on all three sweep questions. The
enumeration check found a shipped wrong number in it. **The "two consecutive
clean cities" counter therefore resets**, and — more importantly — *clean on
Q1/Q2/Q3 does not imply clean*. The three-question audit and the enumeration
check are independent instruments.

---

## 2026-08-05 — FAIL-CLOSED AUDIT. The permissive default was structural.

Run because five defect classes this session all ran in the same direction:
FAR-1.0 fallback · Miami/Denver/Boston story derivation · LA's unparsed
qualifiers · Philadelphia's rejected FAR strings. **Five instances, one
direction, no coincidence.**

### The cause, in one function

`defaultSpec.ts` collapsed the two states the envelope had carefully separated:

```
farBasis 'unconstrained'  (the code SAYS no FAR — SF §124(b), Denver DZC)
farBasis  null            (we could not resolve one)
        ↓ both yield maxFloorAreaSqFt: null
        ↓ both fell to lot × 1.0
        ↓ both reported 'assumed-far-1.0'
```

**Rule 5's distinction was built one layer up and thrown away here.** That is
the structural reason "we didn't find a constraint" kept becoming
"unconstrained": nothing downstream could tell the two apart.

### Fixed (technical, unambiguous)

`gfaBasis` now has three states: `envelope` · **`assumed-unconstrained`** ·
`assumed-far-1.0`. The middle one means the code affirmatively imposes no FAR
and lot area is a placeholder under a *stated absence*; the last means we could
not resolve one at all — a guess made in ignorance, and the state that should
fail closed. The assumptions panel gives them different user-facing text.

A test that I wrote two turns ago asserted the collapse was correct
("a genuinely farUnconstrained district STILL gets assumed-far-1.0"). It has
been corrected with a note. **Rule 15 caught inside the same session that
produced rule 15.**

### MEASURED IMPACT — and this is a PRODUCT decision, not a technical one

Strict fail-closed (block wherever FAR is *unresolved*, allow where the code
says *unconstrained*), measured live against one real parcel per city:

| Outcome | Cities |
|---|---|
| **Keeps an estimate** (7) | boston · nyc · chicago · austin · la (envelope) · **sf · denver** (unconstrained → placeholder) |
| **Would be BLOCKED** (8) | seattle · dc · minneapolis · philadelphia · miami · sandiego · sanjose · nashville |

**More than half the cities would stop producing an estimate.** That is the
honest posture and a materially worse-looking product, exactly as predicted.

Two corrections the run produced as a side effect: **Chicago's `B3-2` DOES
resolve** (`farBasis: district`) — the null inventory entry was too pessimistic
— and **San Diego returns a real district** (`CCPD-ER`) with a better probe
coordinate than the city landmark.

### NOT DECIDED — brought to the user deliberately

Whether to actually block is a product judgment about what the tool claims, not
a technical question, and it is being brought rather than resolved here. The
last time a product decision was settled by reading a docstring (the Austin
3-unit headline) it was wrong, and the failure was not the answer — it was
deciding alone that the question was technical.

Options, with the trade stated:
- **(a) Full fail-closed.** 8 cities stop estimating. Most honest; halves
  apparent coverage.
- **(b) Keep estimating, escalate the disclosure** from the assumptions panel to
  the result headline. Coverage unchanged; the guess stops being quiet.
- **(c) Split by consequence.** Block where the assumption drives a *verdict*
  (feasibility AS_OF_RIGHT vs NEEDS_RELIEF); keep where it only drives a cost
  estimate. More surgical, more code.

The separation shipped here is a prerequisite for all three and is correct under
any of them.

### Ruling (c) IMPLEMENTED — the boundary is "does it claim what the code permits?"

Option (a) rejected on the user's reasoning, recorded because it is the better
argument: blocking eight cities would be **honest about FAR and dishonest about
everything else**. Seattle, DC, Philadelphia and the rest still have real cost
indices, real timelines, real hurdle logic, real parcel data. Suppressing
validated work to purify an unvalidated input is the mirror of the permissive
bias, not the fix for it.

| Output | Claims what the code permits? | Treatment |
|---|---|---|
| AS_OF_RIGHT / NEEDS_RELIEF verdict | **yes** — and it is the output users act on | **blocked** → INDETERMINATE, with a check explaining why |
| Size-triggered **required** hurdles | **yes** — asserts a rule APPLIES | **downgraded** to `info`, note names the uncertainty |
| Already-`likely`/`info` hurdles | no — their own text hedges | untouched |
| Cost + timeline | no — claims what building that much would cost | **kept**, disclosed |

Boston's Article 80 15-unit trigger firing off `lot × 1.0 ÷ 1300` is two
assumptions producing a legal claim. It is downgraded rather than deleted: the
rule may well apply, and saying so while naming the uncertainty beats silence.

**`assumed-unconstrained` passes everything.** SF and Denver keep their verdicts
and their required hurdles, because the code affirmatively imposes no FAR — the
placeholder sits under a stated absence, not under ignorance.

### Verified live, all 15 cities

8 cities on `assumed-far-1.0` now return **INDETERMINATE** instead of a verdict;
**SF (NEEDS_RELIEF) and Denver (AS_OF_RIGHT) keep theirs**; all 15 still produce
cost and timeline. 9 tests pin the boundary in both directions — including that
an envelope-derived size and a stated absence both keep `required` status, so
the downgrade cannot silently over-apply.

### Rule 15, demonstrated on its author

Worth recording plainly: the test corrected by this audit was written **two
turns earlier, by me, in the session that produced rule 15** — green, with
documented reasoning, asserting that the two unknowns were the same. Philadelphia's
four tests were the same shape from an earlier session.

**Knowing about the failure mode does not prevent it.** Rule 15 is not about
carelessness; it is about what a test *is*. An assertion that something is
absent, unparseable, or inapplicable encodes an interpretation, and the better
the reasoning is written down, the more it costs to overturn.

---

## 2026-08-05 — RULE 11, COMMITTED BY THE SCRIPT WRITTEN TO ENFORCE RULE 11

`scripts/enumerate-parser-domains.ts` exists to catch parsers whose input domain
is narrower than the source's real output — the LA qualifier defect class. It did
this:

```ts
handled: (v) => resolveChicago(v).maxFAR != null   // DistrictLimits is { far, heightFt }
handled: (v) => resolveNyc(v).maxFAR != null       // there is no maxFAR property
```

`.maxFAR` is `undefined` on every input, so **every value scored unhandled**. The
script reported **Chicago 1,528 unhandled (100%)** and **NYC 203 unhandled
(100%)**, and both were carried into a report as findings before anyone ran a
resolver by hand.

The instrument was broken in the exact way the instrument was built to detect.

### What Chicago actually is

| | count | |
|---|---|---|
| resolves | **63** | the full by-right ladder — B, C, DC/DR/DS/DX, M, RM, RS, RT |
| PD / PMD | 1,457 | site-specific planned developments — **no by-right FAR exists** |
| POS-1/2/3, T | 4 | parks, open space, transportation — likewise |
| **real defect** | **3** | `RM4.5`, `RM4-.5`, `RM5.5` |

The last row is a genuine find and is the class the script was for. Chicago's GIS
spells one district three ways: `RM-4.5` (470 parcels) resolved, `RM4.5` (8) and
`RM4-.5` (1) did not — and **the ordinance itself writes it unhyphenated**
(`§17-2-0304-A FAR table (RM4.5 = 1.70)`, quoted in our own source comment), so
neither spelling is the typo. Fixed by a hyphen-stripped index consulted for the
residential lookup only; the hyphen is semantic in B/C/D/M, where `B3-2` splits
on it. 14 parcels, but it failed CLOSED (null → INDETERMINATE), not open.

### Why nothing caught it

`tsconfig.app.json` includes `src`; `tsconfig.node.json` includes `vite.config.ts`.
**`scripts/` and `netlify/` were typechecked only incidentally, through imports.**
A standalone script could read any property name it liked and get `undefined`.

Structural fix, not a comment (rule 14): `tsconfig.scripts.json` now covers both
directories, wired into the project references. Verified by reintroducing the
exact bug —

```
scripts/enumerate-parser-domains.ts(85,39):
  error TS2339: Property 'maxFAR' does not exist on type 'DistrictLimits'.
```

That error would have fired the moment the line was written.

### The cost of a wrong instrument is not the wrong number

The backlog in `NULL-INVENTORY.md` listed **"chicago (B/C/D/M classes) — research
+ a table"** as `published-not-fetched`. B/C/D/M were already resolving. A
measurement error had bought research that was not needed, and it would have been
paid for in a later session by someone trusting the doc. **A broken instrument
misdirects work long after it stops being run.**

### Also caught, and NOT resolved

- **An unstable probe reads as an upstream defect.** Philadelphia's inventory
  coordinate `39.97, -75.17` returned `NO_PARCEL` on two of three *isolated*
  re-probes and a valid RSA-5 parcel on the third — it sat off a parcel edge. Now
  derived from a `DOR_Parcel` centroid. Rule 10 in the other direction: a single
  success is not evidence either.
- **Philadelphia's 20 blank MaxFAR districts — OPEN.** 13 of 36 districts publish
  a numeric FAR, 3 publish prose with a different denominator (`RMX-1/2`: "150% /
  250% of District Area (excluding streets)" is not a FAR), and 20 publish
  nothing — every RSA/RSD rowhouse district plus `RM-1`, while `RM-2/3/4` carry
  0.7/1.5/3.5. Whether that is a stated absence (occupied-area control, cf. the
  table's `MinPercent`) or an unfilled column decides whether those parcels get a
  verdict. **Not resolvable from the table**, and inferring it from the shape of
  the data is the mechanism-without-a-measurement rule 1 forbids. Needs §14-701.

---

## 2026-08-05 — DC, all four sweep questions. One negative, one real gap, one open.

### Q2 (rule 13 / the Minneapolis hazard): NEGATIVE — and it was worth checking

DC's zoning was comprehensively rewritten in 2016 and the district names changed,
which is exactly the shape of the Minneapolis Chapter 546 trap. The `Specific
Zone` layer carries **both** vocabularies as separate columns — `ZR58` (1958
regulations) and `ZR16` (2016) — plus `Zoning`, `Zone_District`, `ZR16_Original`
and `Zoning_Status`. The provider reads `Zoning ?? ZONING ?? ZR16`.

Measured across all 977 polygons: **`Zoning` === `ZR16` on 974**, and differs from
`ZR58` on 850 (87%). The provider is reading the 2016 vocabulary. **No defect.**

The 3 disagreements are recorded, not resolved: `MU-10`/`ZR16 null`,
`MU-5B`/`PDR-1` (different zone families), `MU-2`/`MU-3A` (FAR 6.0 vs 1.0). 0.3%
of polygons, and which column is authoritative is not answerable from the layer.

### Q1: DC publishes no FAR numerically — but it publishes a SOURCE

`Zone_Description` is prose ("Permits moderate density mixed use development").
There is no FAR field, so the curated table is the right shape. What the layer
*does* carry is `Zoning_Web_URL` — an authoritative per-district DCOZ handbook
link (`handbook.dcoz.dc.gov/pages/residential-flat-rf-zones#RF-1`) sitting in a
layer we already fetch. That is a per-district citation for numbers currently
carrying only a Subtitle reference in a code comment.

### Q3: coverage is 44 of 171, not "DC has no FAR"

| | count | |
|---|---|---|
| FAR resolved | 44 | RF-4/5, RA-1…5, MU-1…10 and overlay variants |
| height only, no FAR | 21 | R-1A/R-1B/R-2/R-3, RF-1/2/3 + overlays |
| neither | 106 | ARTS, BF, CG, D-*, HE, **MU-11…14**, NHR, NMU, PDR, StE, W … |

`MU-11`–`MU-14` are live districts absent from a table that stops at MU-10, and
the lettered-parent fallback (`MU-7A` → `MU-7`) does not reach them.

### Q4: `f: null` means two different things in one table — NOT FIXED

```ts
'RF-1': { h: 35, f: null },   // Subtitle D § 303.1 — the code imposes no FAR
'D-4' : (absent)              // "vary by sub-area/street and are left null"
```

The first is a stated ABSENCE, the second is a GAP, and DC renders them
identically — the exact rule-5 distinction that `farBasis: 'unconstrained'` was
built for on SF and Denver, never applied here.

**Deliberately not fixed.** Flipping 21 districts to `unconstrained` converts
INDETERMINATE verdicts into AS_OF_RIGHT — the tool asserting legal permission —
on the strength of a citation in one of our own code comments. Rule 15 is
specifically about trusting a well-written internal rationale: the comment cites
Subtitle D § 303.1, and checking whether that section says what the comment says
it says is the whole job. The handbook URL above is where that check starts.

### Found on the way: hurdle coverage is asymmetric and undisclosed

Only **6 of 15 cities** carry city-specific regulatory hurdles — boston, chicago,
la, nyc, seattle, sf. DC, austin, denver, minneapolis, philadelphia, miami,
sandiego, sanjose and nashville get the generic set only. Measured through
`assessHurdles`, the spread is 2–7 hurdles per city.

None of the five standing disclaimers says the hurdle list may be incomplete, or
that coverage varies by city. **The hurdle list is the "Regulation" half of this
tool's thesis**, and Compare puts cities side by side — so a city we have not
encoded reads as a city with fewer requirements. That is a coverage artifact
presented as a finding about the world.

Concretely, DC's `IZ_Designation` (inclusionary zoning) is published per polygon
— 43 of 977 carry `IZ+` or `IZ+ Exempt` — and the provider does not fetch it,
while Boston's IDP, NYC's MIH and SF's inclusionary requirement are all encoded.

Whether to add a completeness disclaimer, and how far to close the coverage gap,
is a PRODUCT decision and goes to the user rather than into an unattended fix.

---

## 2026-08-05 — DC's three-state split, verified against Title 11 itself

The earlier entry recorded DC's `f: null` conflation and declined to fix it,
reasoning that flipping districts to `unconstrained` would assert legal
permission on the strength of our own code comment. Half right: the hesitation
was correct, the conclusion was not. **The fix is making the states
distinguishable, which does not require deciding any particular district.**
Classifying is a separate step, and it needs a source.

So both were done, in that order.

### The source

`Zoning_Web_URL` — an authoritative per-district DCOZ handbook link, already in
the layer the provider fetches — led to the DC Office of Zoning's published PDFs
of Title 11. The handbook pages are JS-rendered and returned nothing; the
Subtitle PDFs are the primary text.

Note the near-miss: an automated read of the Subtitle E PDF reported "no FAR
limits are stated for RF-1, RF-2, or RF-3" **while also reporting that it could
not extract the text**. That is a failed instrument producing the answer we were
hoping for — rule 16 exactly, and it would have been accepted as confirmation if
the same conclusion had not then been reached from the document itself.

### What the code actually says

The structural tell is that **the FAR section exists exactly where FAR applies**:

| | sections | FAR section? |
|---|---|---|
| Subtitle D ch. 3 — R-1-A, R-1-B, R-2, R-3 | 300–310 | **none** |
| Subtitle E ch. 3/4/5 — RF-1, RF-2, RF-3 | 300/400/500–308/408/508 | **none** — the parallel slot is "MAXIMUM NUMBER OF DWELLING UNITS" |
| Subtitle E ch. 6 — RF-4, RF-5 | 600–608 | **§ 602 "FAR AND MAXIMUM NUMBER OF DWELLING UNITS"** |

> **Subtitle D § 303.1** — "The maximum permitted building height, not including
> the penthouse, in the R-1-A, R-1-B, R-2, and R-3 zones shall not exceed forty
> feet (40 ft.) and the number of stories shall not exceed three (3) stories."

> **Subtitle E § 602.1** — "The maximum permitted floor area ratio (FAR) for all
> buildings and structures in the RF-4 and RF-5 zones shall be 1.8."

§ 602.1 confirms the existing table's 1.8 for RF-4/RF-5 to the digit. Both
sections also state STORY COUNTS the table was discarding — 3 for R zones and
RF-4, 4 for RF-5 — now carried directly rather than derived by dividing feet by
an 11 ft/story constant the code never uses (rule 12).

### Where it stopped, and why that is the finding

The split classified **5 of 171** live districts as verified stated absences —
not the 21 the first pass implied. Two mechanisms removed the difference:

- The **Georgetown** override returns a height cap and must not inherit a
  no-FAR claim from its base zone.
- **Overlay suffixes** (`R-1A/FH`, `RF-1/CAP`, `R-3/NO`) are a base zone plus a
  Subtitle C/W overlay we have not read. The base zone's verified absence is a
  fact about the base zone; whether an overlay can impose a floor-area limit
  where the base imposes none is unresolved. Withheld — 12 districts that a
  looser reading would have converted to AS_OF_RIGHT.

**44 publish a FAR · 5 verified unconstrained · 122 remain gaps.** The RA
(Subtitle F) and MU (Subtitle G) figures were NOT verified tonight; they carry a
FAR already, so the split does not touch them, but their provenance is still a
comment.

## Hurdle coverage: disclosed, not closed

Compare rendered "Approvals to clear" as a bare count. Six of fifteen cities have
city-specific mandates encoded, so an unencoded city read as a less-regulated
city — **absence of a finding rendering as a finding of absence**, fifth instance
tonight and the worst placed, because Compare exists to be read across cities.

Shipped: the count is marked as a floor for unencoded cities, and a standing
disclaimer says coverage varies. `CITIES_WITH_SPECIFIC_HURDLES` is checked
against the `city === '…'` branches in `hurdles.ts` by a test — verified by
adding a fake branch and watching it fail, because a coverage claim guarded by an
unverified test is the thing this ledger keeps catching.

Encoding the nine remaining cities is a project, not cleanup, and is NOT started.
DC is the cheapest first move: `IZ_Designation` is published per polygon (43 of
977), it sits in a layer already fetched, and the inclusionary hurdle shape
exists for Boston, NYC and SF — `fetched-not-mapped`, same as Minneapolis.

### The three ambiguous polygons — failed closed

`Zoning` and `ZR16` disagree on 3 of 977 polygons, and where they disagree they
name different zones: `MU-2` vs `MU-3A` is FAR 6.0 against 1.0. The provider
preferred `Zoning` and published a confident envelope on a 6× ambiguity that
nothing in the layer resolves. It now keeps the district label for display and
withholds the envelope — including the no-FAR claim, so a disagreement cannot
manufacture a stated absence either.

0.3% of polygons, and the cheapest possible fix: the provider already fetched
both columns and was reading one.

---

## 2026-08-05 — Philadelphia §14-701, and a retraction that outlived its retraction

Ten of Philadelphia's twenty blank-`MaxFAR` districts are now verified stated
absences, against the Zoning Code Base Districts Quick Guide (Dept. of Planning
and Development, February 2026).

Same structural tell as DC — **the FAR row exists exactly where FAR applies**:

- **Table 14-701-1** (Lower Density: RSD, RSA, RTA) has **no FAR row at all**.
  Rows are lot width, lot area, Max. Occupied Area, setbacks, yards, Max. Height,
  Building Types. Density is occupied area (30–80%) plus a 38 ft cap.
- **Table 14-701-2** (Higher Density: RM) has a combined row headed **"Max.
  Height / FAR (Floor Area Ratio)"**. For **RM-1** that cell holds `38 ft. [5]`
  — a height and nothing else — while RM-2/3/4 hold `70% / 150% / 350% of Lot
  Area`. RM-1 is governed by occupied area plus a dwelling-unit-density rule
  (360 sq ft of lot per unit to 1,440 sq ft, 480 beyond).

RSD-1/2/3, RSA-1…5, RTA-1/2 and RM-1 now carry `farUnconstrained`. **RSA-5 is
the most common district in Philadelphia**, and it was withholding a verdict it
never needed to withhold. The other ten blanks — CMX-2, CMX-2.5, CA-1, CA-2,
I-P, SP-* — stay GAPS: those pages were not read, and an absence is only an
answer once someone has looked.

### The corrected reading, confirmed from outside

The Quick Guide diagrams label the RM cells literally `FAR = 70% of Lot Area`,
`= 150% of Lot Area`, `= 350% of Lot Area`. The rule-15 correction — that
`"70% of Lot Area"` IS the FAR expression, not lot coverage — is right, and is
now confirmed against the source rather than argued. RMX's `"% of District Area
(excluding streets)"` is genuinely a different denominator (master-plan
districts) and stays rejected.

### A retracted claim survived three lines above its own retraction

The module header still read `percentages against a different denominator ("70%
of Lot Area" = lot coverage, not FAR)` — the exact claim the parser below had
already retracted at length, sitting in the file's opening summary. Anyone
reading the header to learn what the module does would have re-learned the false
version.

Rule 9's corollary says disclosure copy is code. This adds the failure mode:
**a correction applied at the point of the defect does not propagate to the
summary that describes it**, and summaries are what get read first. Fixing the
line is trivial; noticing it required reading the file for a different reason
entirely.

---

## 2026-08-05 — DC's RA/MU provenance: FOUR WRONG FARs, TWO OVERSTATING

Ranked top of the backlog on the grounds that these numbers are *published*
rather than withheld. That ranking paid immediately.

**RA (Subtitle F) — all five confirmed.** Table § 302.1 gives RA-1…5 as
0.9 / 1.8 / 3.0 / 3.5 / 5.0 and Table § 303.1 gives 40 / 50 / 60 / 90 / 90 ft.
Every figure already matched. RA-5 also reads "6.0 for an apartment house or
hotel"; the base 5.0 is kept, because the larger number assumes a program the
user has not chosen (rule 6).

**MU (Subtitle G) — four of ten were wrong.**

| district | published | code § 402.1 | direction |
|---|---|---|---|
| MU-6 | 4.0 | **6.0** | understated |
| MU-7 | 5.0 | **4.0** | **overstated 25%** |
| MU-8 | 6.5 | **5.0** | **overstated 30%** |
| MU-9 | 6.0 | **6.5** | understated |

The shape names the cause: **our MU-6/7/8 each held the code's MU-7/8/9 figure**
— one row's slip down the FAR column, propagated into every cost, unit count and
impact fee those districts produced. MU-5 was wrong differently: the code splits
MU-5-A (65 ft) and MU-5-B (75 ft), sharing FAR 3.5 but not height, and a single
`MU-5` at 70 ft matched neither while the lettered-parent fallback kept it
hidden. A bare `MU-5` now fails closed.

### What could not have caught this

The table was internally consistent, typechecked, and covered by tests — one of
which **asserted `MU-7 → maxFAR 5.0` in its own title**. Correcting the provider
required arguing against a green test that named the wrong number. Rule 15, and
the fourth time internal verification has actively defended a defect rather than
merely missing it.

Nothing here was discoverable from inside. It took reading Subtitle G.

### The IZ joint dependency, now measured rather than argued

Both FAR tables carry explicit `(IZ)` rows — MU-1 4.0 → 4.8, MU-7 4.0 → 4.8,
MU-10 90 ft → 100 ft. These are Inclusionary Zoning bonus tiers earned by
committing affordable units, so the base remains the by-right figure and the
bonus is NOT carried. But it settles the open rule-13 question: `IZ_Designation`,
published per polygon and still unfetched, is a genuine joint dependency for
anyone modelling the bonus.

### Still open

MU zones run to **MU-29** (Dupont 15–22, Capitol 23–26, Naval Observatory 27,
Fort Totten 28–29) and RA to **RA-10**. The curated table covers MU-1…10 and
RA-1…5; the rest resolve to nothing, which is a correct gap and a bigger one
than "MU-11…14" implied.

---

## 2026-08-05 — Six cities verified against primary code, in parallel

Two workflows: extract+refute across six curated tables, then one builder per
city. 32 agents. Every discrepancy was found by one agent reading the code and
independently confirmed by a second that re-read the source and tried to refute
it. **19 confirmed, 0 refuted, 0 unreadable sources, 96 districts checked and
found correct.**

### What was wrong

| city | defect | direction |
|---|---|---|
| **denver** | 5 Art. 7 heights DERIVED as stories×12 (60/96/144) where the DZC prints 70/110/150 | understated |
| **chicago** | RS-1/2/3, RT-3.5, RT-4 heights null where §17-2-0311-A publishes 30/30/30/35/38 ft | permissive |
| **nyc** | **carrying a REPEALED edition** — ZR 23-662 was struck by City of Yes (12/5/2024) and heights moved to ZR 23-432; 9 values stale | understated |
| **seattle** | FAR 3.0 vs 3.25 on unsuffixed 40-ft zones; and `isNcOrC()` missed P-designated zones — **357 of 1,183 polygons** | mixed |
| **miami** | T6 Floor Lot Ratios unresolved; 12 districts now sourced from Art. 4 Table 2 | gap |
| **minneapolis** | BFI2 cluster FAR 0.8/1.4 vs Table 540-3's 0.5 | overstated |

### Three findings worth more than the numbers

**NYC was not a transcription error — it was a repealed code.** The uniform +5 ft
that looked like base-vs-building height was City of Yes moving Quality Housing
heights out of a section whose URL now 404s. The file cited 23-662 throughout.
Nothing internal could detect that a citation had been repealed.

**Minneapolis's SOURCE was wrong.** The module cited the Built Form Handbook,
whose Interior 2 page has its columns TRANSPOSED against the ordinance (both
Interior 1 and 3 agree; only Interior 2 does not). Two independent ordinance PDFs
agree with each other. A correctly-transcribed number from a defective secondary
source — which is why the rule is *primary* source.

**Seattle's null was defended by a written rationale that was checkable and
false.** The comment said MHA status "cannot be read from the bare code (the
provider strips the suffix)". Both real entry points pass the RAW string, and a
live distinct-value query returns both `NC2-40 (M)` and `NC2-40`. Rule 15 again.

### The fix that fixed nothing — caught by the checker

Denver's corrected table **did not reach production**.
`providers/denver.ts` derived `stories × 12` from the live `HEIGHT_STORIES` field
*before* consulting the table, and the provider takes precedence in
`zoningLimits.ts`. A real C-MX-5 parcel kept publishing 60 ft. The builder's new
tests were green because they called `resolveDenver` directly.

**Rule 11, committed inside the fix for a rule-12 defect.** Order now inverted: a
figure read from the code outranks one manufactured from a story count.

And the test defending it named the defect in its own title —
`derives height from HEIGHT_STORIES × 12`. Third instance tonight of a green test
actively protecting a wrong number. That is now the single most reliable
signature of a real defect in this repo: **a test whose title asserts a
derivation rather than a source.**

### Deliberately not changed

Denver Articles 3–6 (18 entries) print different feet per building form
(G-MU-3 is 40 ft as Apartment, 35 ft as Town House), so choosing one is a rule-6
call — routed through `storiesOnlyFeetUnverified()` and flagged
`heightBasis: 'derived-estimate'` so the gap is greppable. Chicago RM-4.5/5/5.5
vary by lot frontage we do not have; RM-6/6.5 say "None" (an absence, not a gap).
Miami's Public Benefit bonuses, Denver's height incentives, Seattle's MHA rows,
NYC's affordable-housing heights and Minneapolis's cluster program are all
alternatives, not ceilings — none adopted.

---

## 2026-08-05 — The defect signature, run as a grep. It hit.

The Denver provider bug produced a reusable signature: **a test whose title
asserts a DERIVATION rather than a source.** Grepping test titles for
derives/computes/calculates/estimates/infers across the repo returned ~24 hits,
most of them legitimate (geometric area, `hard = gfa × rate`, the `storiesBasis`
labelling that exists precisely to mark a derivation).

One was the real thing:

```
it('Former-Chapter-59 code WITHOUT the description still derives a height from
    the trailing token', …)
    expect(res.info.zoning.maxHeightFt).toBe(36)
```

`B-3` is a former Chapter 59 code whose **3 is a district CLASS, not a story
count**. The provider's own comment said so — "don't fabricate a height from it"
— but the guard fired only when `ZONE_DESCRIPTION` contained the literal phrase
"former chapter 59". Where the layer described the parcel as plain "Business",
the guard missed and 3 × 12 published **36 ft** out of a number that means
nothing of the kind. The test pinned it and named it.

**Measured against the live layer: 23 of Denver's 184 distinct zone codes carry
a numeric trailing token** — B-1…B-8, H-2, I-0/1/2, MS-1/2/3, O-1/2, OS-1, P-1,
R-0…R-5 — every one of them a legacy class exposed to this. Protection depended
on a free-text annotation being filled in.

The guard is now structural: a current DZC code carries context AND form
(`C-MX-5`, `G-MU-3`) so it has two or more hyphens; a bare letter class plus a
token is legacy. The shape of a code is intrinsic; a description is an
annotation that may or may not be present. Modern codes the shape test also
catches (`D-C`, `CMP-H`, `OS-A/B/C`, `I-A/B`) have non-numeric tails and could
never have fabricated a height.

**The grep took five minutes and found a live fabrication across 23 districts.**
Run it before each parallel round, not after.

### Still open from this round

- **A citation can be REPEALED.** NYC cited ZR 23-662 throughout; City of Yes
  struck it on 2024-12-05 and the URL now 404s. This is neither unsourced nor
  mis-transcribed — it is correctly sourced to something that no longer exists.
  Proposed guard: a cited URL returning 404 should FAIL A TEST, not rot quietly.
  Cheapest available new check; not yet built.
- **Zero refuted out of nineteen.** Either the extractors were disciplined or the
  refuters lacked teeth. One data point. If the next round is also 0, check the
  refuter role rather than concluding extraction is perfect.

---

## 2026-08-05 — Citation decay, made mechanical

`scripts/check-citations.ts` fetches every URL the repo cites **in a comment**
and exits non-zero on a 4xx/5xx. A citation is a claim about the current state of
an external document, and it rots silently — a third failure mode alongside
*unsourced* and *mis-transcribed*: **correctly sourced to something that no
longer exists.**

**It fired on its first run**, on the case it was built for: `nyc.ts:11` still
carried the repealed `zr.planning.nyc.gov/.../23-662` link. The builder had
corrected every section reference and left the URL in the module header — the
same shape as rule 17, a retraction that didn't reach one more place.

### Two design points, both learned the hard way tonight

**Unreachable ≠ dead.** A network error reports as UNREACHABLE and does NOT fail.
An offline machine must not be indistinguishable from a repealed statute — rule
5, a failed fetch is never a substantive answer.

**A deliberately recorded dead link is not a defect.** `nyc.ts` keeps the 404 URL
*as evidence of the repeal*. Those carry an explicit `[known-dead]` marker on the
URL's own line, never inferred from nearby prose like "returns 404" — guessing
would let a genuinely rotted link hide behind a word. And a `[known-dead]` URL
that RESOLVES again also fails: the record has gone stale.

### What it cannot do, stated so the green result is not over-read

It catches **repealed** and **moved**. It does not catch **amended in place** —
the URL still returns 200 while the text underneath changes, which is the more
common case and still needs someone reading the source. A pass means the
documents we cite still exist, never that the numbers we cite are current.

### Recorded for the next parallel round

**A refuter reading the same source as the extractor is a second reading, not an
adversarial one.** It catches transcription and is blind to source defects.
Minneapolis's transposed handbook columns were caught by two independent
ordinance PDFs agreeing *against* a third document — cross-source disagreement,
not scrutiny of any single source. Give the refuter a different source than the
extractor used, by construction.

**And the checker must never repair what it finds.** A checker that fixes becomes
a builder with extra context and inherits the same blind spot. Report-only is
what makes the separation real — it is why Denver's do-nothing fix was caught.

---

## 2026-08-05 — Permit timing: four cities cannot be measured, and that is the finding

Filing→issuance is now measured from the city's own open data for **11 of 15
cities**. In **Boston, DC, Minneapolis and San Jose it is not measurable at all** —
those four publish only issue-side dates. That is a fact about municipal data
transparency, not a defect in this pipeline.

What makes it a result rather than a shrug: **four independent agents each found
the tempting substitute and rejected it with a measurement.**

| city | substitute available | why it was refused |
|---|---|---|
| dc | `CREATED_DATE` | identical ETL stamp on every 2022 row; moves each refresh |
| dc | `LASTMODIFIEDDATE` | post-dates issuance — wrong sign |
| minneapolis | `completeDate` | falls AFTER `issueDate` in **409 of 409** sampled records |
| sanjose | `FINALDATE` | final inspection — same trap |
| boston | none | only `issued_date`/`expiration_date`; confirmed 3 independent ways |

Every one of those would have produced a plausible number in the right units.
Absence was established by asking whether the schema has a SLOT for an
application date — not whether a row was blank.

**The filters are already written** for DC, Minneapolis and San Jose
(`PERMIT_SUBTYPE_NAME = 'NEW BUILDING'`, `workType = 'New'`,
`WORKDESCRIPTION = 'New Construction'`). If a city adds the field, this is a
config change, not research. Recorded in NULL-INVENTORY.md as `not-published` so
nobody redoes it.

### Third instance of the same asymmetry, fixed the same way

Four cities with no measured timing beside eleven that have one reads, in Compare,
as those four being *faster* rather than *unmeasured*. Same shape as the hurdle
count and the cost basis. `CITIES_WITH_MEASURED_PERMITS` now drives an `est`
marker, and a test reads `permitStats.json` and asserts the list matches it
exactly — verified by adding a fake twelfth city and watching it fail.

### Not yet done: the eleven successes have NOT had this scrutiny

The four failures were interrogated *because* they failed. A city that HAS an
application-date field could still have one meaning pre-application meeting,
counter intake, or resubmission-after-rejection — each of which shortens the
interval, i.e. **fails in the flattering direction**. Chicago's 1.0-month and
Nashville's 1.1-month medians for ground-up new construction are exactly that
shape. An adversarial audit of all eleven is running; until it returns, those
figures are corroborated by nothing but their own extraction.

Two latent bugs found in our own committed scripts and NOT yet fixed:
`scripts/permits/boston.mjs` filters `worktype='ERECT'` alone, and 54% of that
slice is Certificates of Occupancy — it never emitted a wrong number only because
the missing date halted it first. `scripts/permits/nyc.mjs` admits plumbing and
equipment sub-permits and slices by issuance year rather than filing year.

---

## 2026-08-05 — The eleven measured permit timings audited. THREE WITHDRAWN.

The four failures were interrogated because they failed; the eleven successes had
never been. An adversarial audit — one agent per city, told to default to
distrust — returned **2 SOUND, 8 CONTAMINATED_SAMPLE, 1 WRONG_DATE_FIELD**.

**Withdrawn immediately** (removed from `permitStats.json`; tests now assert the
absence so the stale scripts cannot reinstate them):

- **San Diego 10.2 mo — WRONG DATE FIELD.** The start stamp is documented as when
  a permit is *"added to the Permit System"*, never earlier than intake (median
  +14 d, p90 +181 d), and **8.93% of rows are create==issue on projects filed a
  median 928 days earlier.** The UI called it "Median filing→permit". It was not.
- **Chicago 1.0 mo.** `APPLICATION_START_DATE` is documented as *"Date when City
  began reviewing permit application"* — not filing. Worse, 46% of the sample is a
  2022-23 cohort where 51.6% / 31.2% of records are stamped applied==issued, a
  backfill artifact that roughly HALVED the median. Spot-check: a $19.7M 6-storey
  73-unit senior apartment shows application_start == issue on one day, with Plan
  Commission approval independently reported five months earlier. Clean 2024-25
  cohorts give **1.71 mo**, not 1.0.
- **LA 6.0 / 13.0.** The date field is fine — the ESTIMATOR is not. 45.4% of the
  cohort carries no issue date at extract. Only 64.1% of the matured 2022 cohort
  carries one, so an 80th percentile **does not exist**. A caveat cannot repair an
  undefined statistic. *(Phrasing corrected 2026-08-08 — state the share, not the
  fate; the shares and the withdrawal are unchanged.)*
  > ✅ **Source established 2026-08-09 — see "LA's 45.4% was real, and the
  > re-probe that 'disproved' it read the wrong feed".** Both shares reconstruct
  > to the decimal against LADBS's **submitted** feed `gwh9-jnip` (45.36% /
  > 64.11%), not the issued feed `pi9x-tg5x`. **This entry stands as written.** An
  > intervening 2026-08-09 note recording it as irreproducible is itself
  > withdrawn.

### The dominant failure was not the date field

Only one city had the trap we went looking for. The systematic problem is
**right-censoring**: the median is computed over permits that ISSUED, and a large
share never do. Every instance biases the figure LOW — the flattering direction.

- **NYC** — 8.3 mo published; 45% of initial New Building filings since 2022 never
  issued. Kaplan-Meier over all 8,039 gives **15.9 months**.
  > ⚠️ **WITHDRAWN 2026-08-09 — see "NYC withdrawn: the disqualifier was in the
  > file, and the query was blindfolded" at the end of this ledger.** The finding
  > above is correct and was acted on three days late. Two phrasing corrections:
  > 45% is the share with **no issue date at extract**, not a share that "never
  > issued" (state the share, not the fate); and NYC's `filing_status` *does*
  > record some fate — 57 of the 378 non-issued rows are `Filing Withdrawn`.
  > Neither changes the conclusion. **15.9 was not adopted as a replacement.**
- **Austin** — and a second, separate defect: `work_class='New'` is **not new
  buildings**. 23% is swimming pools and spas; 32% is "Structures Other Than
  Bldg". Class medians span 6×: single-family 1.64 mo, 5+ family apartments
  **9.82 mo**, parking garage 11.93. **A user testing a multifamily parcel is
  shown 2.2 months against a measured 9.8.**
- **Denver, Seattle, SF, Nashville, Philadelphia, Miami** — all censored low to
  varying degrees; all keep their figures pending a restated basis.

### What this says about the method

The audit existed only because the failures were scrutinised and the successes
were not. That asymmetry is the general lesson: **a result that succeeds gets less
scrutiny than one that fails, and success in the flattering direction is exactly
where scrutiny is most needed.** Eight of eleven "successful" measurements were
wrong or overstated, and none would have been caught by re-reading our own code.

---

## 2026-08-05 — Filter enumeration: 8 of 9 sampling filters are defective

Applied the parser-domain enumeration to the SAMPLING FILTERS. The question is not
whether a filter looks reasonable; it is what the filter actually admits.

| city | verdict | what it admits that is not a new building |
|---|---|---|
| philadelphia | **CLEAN** | 1.7%; misses ~0.1% |
| seattle | BOTH | 3.5% contamination; DADUs filed under both "New" and "Addition" |
| miami | CONTAMINATED | 8.7% — trellises, pergolas, "NEW PARK ONLY" |
| sf | CONTAMINATED | 9.0% sheds/accessory + 18.1% duplication |
| nashville | BOTH | **25.1%**; misses `CACH` commercial shell |
| denver | BOTH | clean on type, but misses COMMERCIAL PHASED CONSTRUCTION |
| **austin** | BOTH | **37.0%** — 3,599 pools/spas, decks, retaining walls, EV chargers, event tents |
| **boston** | BOTH | **58.0%** — 854 Certificates of Occupancy (53.2%) |
| **nyc** (script) | BOTH | **63.9%** — foundation/earthwork 41.2%, plumbing 19.9% |

### The contamination biases DOWN, again

Nashville's contaminated slice: median 0.99 mo against 1.12 overall. Miami's:
5.9 mo against 12.6 for real buildings. Third distinct mechanism in a row —
after the wrong date field and right-censoring — and all three run the same way.
Rule 18 predicted this: the errors that survive are the ones producing plausible
output, and a too-fast permit time reads as a fast city rather than a bad sample.

### Too narrow is the harder half, and it is where the real projects are

Austin excludes `work_class='Shell'`: 202 records, **median 11.1 months, p80
17.4** — new shell buildings for multifamily, offices, hotels, parking garages.
1.7% of the corrected count and the entire upper tail. Meanwhile Austin's
admitted set is 49% single-family houses at 1.64 mo. **Multifamily measured alone
is 10.0 months against a published headline of 2.2** — the class the tool exists
to answer for, wrong by 4.5×.

Denver misses COMMERCIAL PHASED CONSTRUCTION (22 rows absent entirely); Nashville
misses `CACH` commercial shell; Boston's `worktype` misses 10 of 684.

### NYC: the script does not reproduce its own committed number

The script's filter is 63.9% sub-permits. The COMMITTED filter is not. The shipped
8.3-month figure came from a corrected query the script does not contain, so
anyone re-running `scripts/permits/nyc.mjs` gets a different number with no way to
know which is right. **A committed figure whose generator disagrees with it is
worse than an unsourced one** — it carries the appearance of reproducibility.

### Order for the next pass, and why

**Filters → censoring → restated bases.** A censoring correction applied to a
contaminated population produces a rigorously computed number for the wrong
thing. Austin corrected for censoring but still 37% swimming pools would be
precisely wrong.

Censoring ruling already made: Kaplan-Meier where the cohort supports it,
median-of-issued explicitly labelled a FLOOR where it does not, withdrawn where
neither means anything — never a bare median. **Publish the issuance rate
regardless**: it is the one number censoring cannot bias, and "60% of filings here
ever issue" is arguably more useful than any median. *(⚠️ Phrasing retracted
2026-08-08 — that specimen copy string is exactly what must NOT ship. Write "60%
of filings here have an issue date"; state the share, not the fate. The
recommendation to publish the rate stands.)* KM's assumption that
censoring is independent of time-to-event is a stated limitation, not an
assumption to wave through: long-pending applications are plausibly unlike ones
that resolve.

### Position of the eight surviving figures, stated plainly

Every one except Philadelphia is computed over a population now KNOWN to be
contaminated. They have not been withdrawn only because recomputation is the next
pass rather than a judgement call — but until that pass lands, **only
Philadelphia's 3.0 months rests on a filter that was checked and held.**

### Two checks the next pass must run, and one claim narrowed

**1. "All three mechanisms bias down" is an observation, not a law — and I stated
it as one.** Every contamination *measured* biased the published figure down
(Nashville 0.99 vs 1.12, Miami 5.9 vs 12.6), and every *exclusion* found so far
also biased down, because the excluded records were slow (Austin's `Shell` at
11.1 mo, Nashville's `CACH` commercial shell). But an exclusion that drops records
which issued FAST biases the published figure **up**, and nothing has checked for
that direction. Some of the seven may be OVERSTATED rather than understated.

The live candidate is **Seattle**: SDCI files a detached accessory dwelling under
either "New" or "Addition", so some DADUs are excluded — and a backyard cottage is
plausibly a fast permit. If so Seattle's 6.2 months is too HIGH, not too low, and
correcting it in the assumed direction would make it worse.

**Per exclusion, measure the duration of the excluded set before assuming which
way it moves the number.** Austin's audit did exactly this (excluded `Shell` =
11.1 mo median, stated explicitly); the other cities' exclusions were counted but
not timed.

**2. SF's 18.1% duplication needs its cause identified before its fix.** Genuine
duplicate permits on one project and a join producing extra rows are different
defects with different corrections — dedupe by project key versus fix the query.
The audit reported the rate, not the mechanism. Austin flagged the same shape from
the other side: `masterpermitnum` exists precisely because large projects split
across many permits (twelve "Parking Garage - Module C/E/F/G…" rows for one
garage), so **n over-counts projects in at least two cities** and the correction is
a dedupe, not a filter change.

### Next pass, ordered

1. **`nyc.mjs`** — the script's filter is 63.9% sub-permits; the committed figure
   came from a different query. Make one match the other. Not both.
2. **Austin** — add `Shell`, drop non-building `permit_class` values, and
   recompute BY PERMIT CLASS rather than in aggregate. A single median over a
   population that is 49% single-family and 3% multifamily answers no question
   anyone asked.
3. The remaining six filters, timing each excluded set.
4. Censoring (KM where supported, floor-labelled median otherwise, issuance rate
   always).
5. Restated bases.

#### Sharpened, 2026-08-05 — two corrections to the notes above

**The exclusion CRITERION determines the sign, and it is usually project size.**
Small projects permit faster. So an exclusion that drops small projects biases the
published figure UP; one that drops large projects biases it DOWN. Seattle's DADU
case is the concrete instance (SDCI files detached accessory dwellings under both
"New" and "Addition", so the exclusion is non-random with respect to duration) —
but the exposure belongs to **any city whose exclusion criterion correlates with
project size**, which is most of them. Do not carry a single expected direction
into the next pass; derive it per city from what the criterion selects on.

**Duplication does not merely inflate `n` — it re-weights the distribution, and in
the OPPOSITE direction from contamination.** The note above said n over-counts
projects. That understates it. If the duplicated rows share a project key, a
project filing twelve permits contributes **twelve observations to the median**,
not one. Large projects file more permits (Austin: one parking garage as twelve
"Module C/E/F/G…" rows), so duplication over-weights SLOW projects and biases the
median UP — while the contamination in those same cities biases it down. Two
mechanisms, opposite signs, same figure. Neither can be corrected by assuming the
other's direction.

So the first question for SF's 18.1% is not how to fix it but **what it is**:
check whether the duplicated rows share a project key. Genuine duplicate permits,
a multi-permit project, and a join fanning out rows are three different defects
with three different corrections, and only the middle one requires re-weighting
the distribution rather than deduping it.

---

## 2026-08-06 — `nyc.mjs` now reproduces its own committed figure

First item of the next pass, done. The script pulled the LEGACY BIS feed
(`ipu4-2q9a`, `job_type='NB'`, sliced by ISSUANCE year) while the committed
figure came from DOB NOW. **The generator contradicted its own output** — anyone
re-running it got a different number with no way to know which was right.

Repointed to `w9ak-ipjd` (DOB NOW: Build – Job Application Filings) with the
audited query. Three things the old one got wrong:

- **63.9% contamination.** `job_type='NB'` alone admitted foundation/earthwork
  (41.2%), plumbing (19.9%) and equipment/fence sub-permits filed under the same
  job. The fix is `job_filing_number LIKE '%-I1'` — of 19,319 permitted NB
  filings only 4,394 are INITIAL; the other 14,029 are `-S*` subsequent
  per-work-type filings. Cross-checked: all 4,394 carry
  `general_construction_work_type_='YES'`, and that independent discriminator
  yields the identical 8.3 / 17.0.
- **A winding-down feed.** BIS NB seq-01 rows fall 670 (2022) → 41 (2026).
- **A lexicographic date compare.** BIS `filing_date`/`issuance_date` are TEXT in
  MM/DD/YYYY, so `>= '2022-01-01'` silently compared as strings — the gotcha the
  file itself documented and worked around by slicing on issuance year, which is
  the wrong leg. DOB NOW's columns are real timestamps, so one server-side `>=`
  is correct and the year-widening logic is gone.

Verified by running it: **median 8.3, p80 17.0, n 4,403** — reproduces the
committed 8.3 / 17.0 exactly, n grown from 4,394 by two days of new filings.

> ⚠️ **THE FIGURE THIS ENTRY LANDED WAS WITHDRAWN 2026-08-09.** Do not read
> "reproduces its own committed figure" as "is correct": the reproduction was
> real and the number was still ~2x below the file's own Kaplan-Meier estimate,
> because `pull()` ended `AND first_permit_date IS NOT NULL` and so reproduced a
> median conditional on issuance. **Reproducibility is not validity** — it says a
> generator and an artifact agree, not that either is true of the world. Note
> also that the counts in this entry (19,319 permitted NB filings, 4,394 `-I1`,
> 14,029 `-S*`) no longer reproduce at all against the same resource id; see the
> instrument note in the 2026-08-09 entry.

The right-censoring limitation is written into the script's header rather than
left implicit: 45% of initial NB filings since 2022 never issued, permitted share
falls 1461/1960 (2022) → 764/1764 (2025), and Kaplan-Meier over all 8,039 gives
~15.9 months against the 8.3 published. That correction is the censoring pass,
deliberately after the remaining filters.

**Next: Austin by permit class.** Add `Shell`, drop the non-building
`permit_class` values, and stop publishing one median over a population that is
49% single-family and 3% multifamily.

---

## 2026-08-06 — Austin: filter corrected, and the median split by tier

Second item of the pass. Two defects in one filter, plus the structural problem
underneath both.

**Too broad — 37% was not a building.** `work_class='New'` says the WORK is new;
it says nothing about whether the thing is a building. That is carried by
`permit_class`, which the filter ignored. Excluded now: 3,599 swimming pools and
spas, plus decks, patio covers, retaining walls, dumpster enclosures, EV
chargers, telecom towers, boat docks and SXSW/ACL event tents.

It survived because the contamination's median (2.4 mo) sits close to the clean
set's (2.1) — **it barely moved the headline while silently redefining what the
headline was about.**

The gate is an ALLOWLIST of Census building-use codes, not a denylist: an Austin
category nobody has seen is excluded rather than admitted, so a new class cannot
quietly re-contaminate the figure.

**Too narrow — `work_class='Shell'` was excluded.** 202 records at median 11.1 mo
/ p80 17.4: the largest multifamily, office, hotel and parking-garage projects in
the city, i.e. exactly the cohort a feasibility tool is consulted about. 1.7% of
the corrected count and the entire upper tail.

**The structural problem: one median over that population answers no question.**

| tier | median | p80 | n |
|---|---|---|---|
| single | 1.6 mo | 4.0 | 8,835 |
| multi | 2.9 mo | 6.8 | 1,208 |
| **apartment** | **8.6 mo** | **16.2** | 1,491 |
| *aggregate* | *2.1 mo* | *6.1* | *11,534* |

77% of the population is single-family houses, so the aggregate IS the
single-family number wearing a city-wide label. **Someone testing a multifamily
parcel was being shown 2.1 months against a measured 8.6.**

`measuredFor(city, tier)` now prefers the tier-specific figure, falling back to
the aggregate only where no breakdown exists — the aggregate is the weaker
number, not the default. Tiers under n=30 are omitted rather than published thin.
The corrected `n` is 11,534, matching the audit's independent prediction exactly.

> ⚠️ **Superseded 2026-08-09 — read the two sentences above together and they
> describe a fail-open.** "Omitted rather than published thin" and "falls back to
> the aggregate" compose into: *a tier suppressed for a thin sample is served the
> city aggregate.* Denver's `multi` was suppressed, so a duplex query got
> Denver's 4.5-month aggregate — a population of 3,505 single-family rows, 628
> apartment rows, the untiered residential rows and the commercial layer, fewer
> than 30 of which are 2–4 unit buildings. The suppression left no trace in
> `permitStats.json`, so nothing could distinguish it from NYC/Philadelphia,
> where no breakdown was ever computed and the aggregate genuinely covers every
> tier. `tierBreakdown` now records which of the two it is, `measuredFor` fails
> closed on the first, and a test requires every city × tier to be measured,
> aggregate-covered, or explicitly marked suppressed.

**Not fixed here, and still open for Austin:** the sample is right-censored
(issued permits only; complete cohorts move the p80 from 6.3 to 7.1–8.2), and
`masterpermitnum` shows one parking garage filing as twelve "Module C/E/F/G…"
rows, so `n` over-counts PROJECTS and large projects are over-weighted in the
distribution. Those are the censoring and duplication passes.

**Next: the remaining six filters, each excluded set TIMED**, since the sign of an
exclusion is set by what its criterion selects on.

---

## 2026-08-06 — The remaining six filters. The direction is NOT uniform.

Six agents, one per city, each required to report the **n AND median duration** of
every set it added or removed. That requirement is the whole finding.

| city | was | now | direction | what moved it |
|---|---|---|---|---|
| denver | 4.4 | 4.5 | too low | +51 commercial PHASED CONSTRUCTION (median 6.0 vs 4.5 retained) |
| miami | 12.1 | **12.6** | too low | −94 non-buildings (median 5.9 vs 12.6) |
| nashville | 1.1 | 1.2 | too low | −2,504 accessory (median 1.0), +CACH commercial shell |
| sf | 11.8 | **12.5** | too low | −32 address fan-out (9.1) and −13 accessory (7.7), both faster |
| **seattle** | **6.2** | **5.8** | **TOO HIGH** | +714 detached ADUs (median 2.8 vs 6.3 retained) |
| boston | — | — | **not computable** | filter fixed; no application date exists |

**Seattle is the one that matters.** Every correction before it ran the same way,
and the temptation was to treat "contamination biases down" as a property of the
mechanism. It is not. SDCI files a new backyard cottage under either "New" or
"Addition", so 714 genuine ground-up ADUs at median 2.8 months were excluded —
fast records, whose absence held the published figure UP. Seattle also decomposed
cleanly, one change at a time: STFI removal +0.1, DADU addition −0.5.

**The sign is set by what the criterion selects on, and only timing reveals it.**
A count cannot. Five of six moved up, one moved down, and nothing but measurement
distinguished them.

### SF's duplication was a fan-out, not a multi-permit project

The 18.1% was diagnosed before being fixed, as required: it is an ADDRESS FAN-OUT
— one permit joined to many address rows — not one project filing many permits.
So the correction is a **dedupe, not a re-weighting**. Removed rows ran 9.1 months
against 11.8 retained, so the dedupe alone moved 11.5 → 11.8, and the accessory
removal took it to 12.5. Both mechanisms pushed the same way here; they need not.

### Boston refused to derive a sign, correctly

The filter is fixed — `permittypedescr='Erect/New Construction'` replaces
`worktype='ERECT'`, dropping 855 Certificates of Occupancy (99% of which sit on a
property ALREADY in the sample, issued a median 23.7 months later) and 67
foundation permits. But Boston publishes no application date, so the agent
measured the excluded sets' **lifecycle position** rather than their duration and
declined to convert that into a direction: a CO's own review time is unmeasured,
and claiming the figure "would have been too high" would be a mechanism argued
aloud (rule 1). The halt is now structural — `applicationDateField()` throws
before any data pull — rather than incidental, which is how the old version came
to be accidentally safe.

### Per-tier breakdowns now on five cities

austin, denver, miami, nashville, seattle, sf. The spreads justify the split:
Austin apartment 8.6 against a 2.1 aggregate; Miami apartment 20.2 against 12.6;
Seattle apartment 10.4 against 5.8. SF inverts — apartment 10.5 is FASTER than
single-family 13.1 — which is measured, not assumed, and worth understanding
before it is explained.

**Still open:** right-censoring on every one of these (all are issued-permits-only
samples, so all are floors), Nashville's per-unit child permits (24.9% of rows
cite a master), and Austin's `masterpermitnum` module-splitting.

---

## 2026-08-06 — Censoring, per tier. KM is UNDEFINED for half these cities.

Eight agents, each required to declare its maturity rule before computing, run on
the post-filter population, and publish the issuance rate regardless.

### The structural finding: selection on the outcome is not censoring

**Four cities publish ISSUED-ONLY feeds** — Austin, Denver, Miami, and
Philadelphia for new construction specifically. A filing that dies in plan review
never becomes a row. Austin: `issue_date IS NULL` returns **0 of 18,241** in-scope
rows and 0 dataset-wide.

So the issuance rate is **not computable**, and KM is not merely hard — **its
required input is absent.** There are no censored observations, so there is no
risk set to decrement and no survival curve to build.

Austin's agent drew the distinction that matters: this is not administrative
censoring (a random cut at extract date, which KM handles) but **selection on the
outcome** — the event determines membership, under which KM is undefined. Naming
that is what stopped a plausible KM number being produced for four cities.

The same feed shape also creates **right-TRUNCATION**, distinct from censoring:
Austin's apartment median by application year runs 11.1 (2022) → 9.7 → 6.2 → 4.8
→ 1.6 (2026). A recent filing enters the sample ONLY if it issued fast.

### SF WITHDRAWN — the statistic does not exist

> ⚠️ **Phrasing superseded 2026-08-08** — see "Two measured issuance rates, and
> exactly how far the comparison carries". "Ever issue" is unsupported: what is
> measured is the share carrying an issue date at extract. **State the share, not
> the fate.** The withdrawal itself stands — a median past the last observation is
> undefined under either reading. Figures below are unchanged and correct.

**37.7% of SF new-construction filings carry an issue date at extract.** Matured
2022 cohort: single 32.4%, multi 23.4%, apartment 44.4%. When most of the cohort
has no issue date, the unconditional median time-to-issuance **does not exist**,
and a floor label does not rescue it — it makes an absent number look cautious.
LA was withdrawn at 64.1%; SF is far below that. *(LA's 64.1% sourced 2026-08-09
to LADBS's submitted feed `gwh9-jnip` — 3,901/6,085 = 64.11%. Unchanged.)*

### Where KM IS computable

| city | tier | published | KM | issuance |
|---|---|---|---|---|
| nyc | single | — | **12.6** | 69.1% |
| nyc | multi | — | 11.9 | 73.3% |
| nyc | apartment | — | **23.7** | 64.8% |
| nashville | single | 1.1 | 1.2 | 89.4% |
| nashville | multi | 2.2 | **5.3** | 61.8% |

NYC's aggregate 8.3 becomes 12.6–23.7 by tier. **Nashville's multi is 2.4× its
published figure**, and its p80 must be WITHDRAWN outright — the curve bottoms at
S=0.382, so an 80th percentile does not exist.

Note Nashville also **superseded its own committed limitation**: the script's
header says the issuance rate is not computable. It is. A stated limitation is a
claim, and claims go stale.

### My Seattle fix introduced a denominator defect, and the audit caught it

The ADU arm I shipped today gates on `dwellingunittype LIKE '%Accessory Dwelling
Detached%'` — and that field is **NULL for 100% of non-issued filings (0 of
1,612)**. So the arm selects only issued permits by construction, and the
currently published single tier has no denominator at all. Interim: publish 7.0
(New arm only, fully observable) rather than 5.6 until the arm is re-specified on
a criterion populated at filing time.

Fixing contamination created a censoring defect. The passes are ordered for a
reason, and the ordering does not make them independent.

### Floors, where KM is undefined

Austin single 1.7 (was 1.6), multi **3.8** (was 2.9), apartment **9.8** (was 8.6).
Miami single **13.1** (was 11.3), multi **14.1** (was 11.0), apartment **23.5**
(was 20.2). Denver single/apartment 6.0; multi withdrawn (n=18). Philadelphia
2.9, with 69.8% as a *context* figure from all work types — not the
new-construction rate, which the city does not publish.

**Not yet applied.** SF is withdrawn and Seattle's defect is recorded; the seven
restatements are the next pass.

#### CORRECTION, same day — "floor" is the wrong label for the four issued-only cities

The entry above recommends FLOOR-LABELLED MEDIANS for Austin, Denver, Miami and
Philadelphia. That label is wrong, and the distinction is not cosmetic.

**A floor label claims: the true value is higher and we are understating it.** It
implies a knowable number we have bounded from below.

**What these four actually publish is a CONDITIONAL median: time-to-issuance
GIVEN issuance.** That is a well-defined statistic on a well-defined
subpopulation. It is not an approximation of the unconditional median — it is a
different quantity, and the tool currently claims to publish the other one.

So the label must state the CONDITION, not hedge the magnitude:
> "Median time from application to permit **among applications that resulted in a
> permit.** This city publishes only issued permits, so the share of applications
> that never issue is unknown."

Contrast with **SF, withdrawn**: there the unconditional median genuinely does not
exist, because most filings never issue. Conditional-and-labelled is publishable;
undefined is not. Two different situations that a "floor" label would have
rendered identically — rule 5's shape again, in the disclosure copy.

**And restricting to older cohorts does not convert one into the other.** It
reduces right-truncation (Austin apartment by filing year: 11.1 → 9.7 → 6.2 → 4.8
→ 1.6, which is not projects getting faster but recent filings entering only if
they issued fast). It does NOT remove selection: a 2019 cohort still contains only
permits that eventually issued. Older cohorts buy a better conditional median, not
an unconditional one.

**Open:** does the same filing-year gradient appear in Denver, Miami and
Philadelphia? If so the older-cohort restriction applies to all four. Austin is
the only one measured so far.

---

## 2026-08-06 — The gradient is in all four, and Seattle's arm is fixed

### Right-truncation confirmed in Denver, Miami, Philadelphia

| city | gradient | published | after cohort cutoff |
|---|---|---|---|
| denver | YES_STRONG | 4.4 pooled · single 5.4 · apt 5.3 | **5.1 · 6.0 · 5.9** |
| miami | YES_STRONG | single 11.3 · multi 11.0 · apt 20.2 | **13.3 · 14.0 · 23.2** |
| philadelphia | YES_WEAK | 2.9 | — |

**Every published figure in these cities is biased SHORT**, and the older-cohort
restriction applies to all four, as predicted.

**Denver settled artifact-vs-speed-up by measurement, not argument** — the check I
was most worried an agent would skip. Two matched-window tests: the conditional
median given D ≤ 6 months is FLAT across cohorts (1.9 / 2.3 / 2.2 / 1.9), and at
equal cohort AGE the 2026 cohort is the **slowest** in every tier. So there is no
real speed-up to erase. It also found the mechanism directly: the max observed
duration falls 49.7 → 41.9 → 26.2 → 18.4 → 6.3 months by filing year, and the
24-months-and-over band holds 102 / 191 / 3 / 0 / 0. A 2025 filing cannot be
observed taking 20 months — the row does not exist yet.

Denver's cutoff also survives its own sensitivity check: the looser cutoff moves
nothing beyond 0.1 months, which is the test against having picked a pleasing one.

Miami's decline is monotone WITHIN each tier, so it is not composition. Its
apartment n collapses 70 → 73 → 24 → 19 → 3 because a tier with a 23.8-month
median filed in 2024 has ~24 months of window and most of that cohort simply has
not issued yet.

### Philadelphia may not belong with the other three

It is the ONE city where the never-issued denominator is **directly observable** —
the eCLIPSE layer carries a STATUS field, so pending applications are counted
rather than inferred. That makes an issuance rate, and possibly KM, actually
available. It should be re-examined out of the issued-only group.

### Seattle's arm re-specified — the tier has a denominator again

The defect I introduced today is fixed, and the fix was verified the right way
round. `description` is **100% non-null (2001/2001) on non-issued filings**, at
every pre-issuance status including the earliest. Gate: match DADU / detached
accessory dwelling, exclude AADU / attached.

The old `dwellingunittype` gate was **0 of 2001** on non-issued and 7.1% on
issued — and `standardplan` and `zoning` show the identical 0%/7.1% split, which
identifies a fill-at-issuance cluster rather than a coincidence.

Recovery: **1,146 filings (1,008 issued) at median 3.0 months and an 88.0%
issuance rate**, against the old gate's 714 whose issuance rate was 100% *by
construction*. Scored against `dwellingunittype` as ground truth: precision 96.1%,
recall 93.7% — and perturbation shows the trade is not load-bearing, moving the
arm 3.1 → 3.0.

Seattle now publishes **5.7 / p80 10.0 / n 4,996**, tiers single 5.0, multi 6.3,
apartment 10.4 — with a real denominator (74.1% overall issuance).

### Still queued

Six restatements (austin, denver, miami, nashville, nyc, philadelphia), four of
them as CONDITIONAL medians with the condition in the label. Nashville's p80 to be
withdrawn. Philadelphia to be re-examined for KM.

---

## 2026-08-06 — Fill-at-issuance is a SCHEMA PROPERTY, and it is in Philadelphia too

Seattle's defect generalised into a test: for every field a filter gates on,
compare its non-null rate on PENDING filings against ISSUED ones. A field
populated only at resolution selects issued permits by construction — and it is
**invisible to anyone querying only issued permits**, which is how it survived.

| city | verdict |
|---|---|
| nyc | **CLEAN** — every gate >= 97.9% populated on pending |
| nashville | **CLEAN** — 100% on both sides, value domain checked too |
| **philadelphia** | **FILL_AT_ISSUANCE DEFECT** |

### Philadelphia: the denominator was 98.7% destroyed

Philadelphia has a real pending population — 9,887 non-issued RP-/CP- filings
applied 2022+. The current classifying gate admits 29,004 issued and **only 126
non-issued, wrongly excluding 9,761 of 9,887 (98.7%)**. The resulting issuance
rate is **99.6%** — a Seattle-shaped artifact, in the one city this ledger had
called "checked and holding" two passes ago.

`STATUS` itself is clean: 100% non-null on non-issued records, no gradient, and
the pending queue is live (pending counts by filing year 0/0/0/32/349/2,028, so
old cohorts fully resolve). Layer-wide STATUS nulls are all legacy HANSEN rows;
zero of 653,123 ECLIPSE rows are null. **The defect is in the cohort gate, not the
status field** — which is why testing only the obvious field would have missed it.

Two fields DO carry the Seattle property — `LATESTREVIEWDUEDATE` and
`LATESTREVIEWCOMPLETEDDATE`, 54% on pending against 100% on issued — and the
script's header cites one of them as a validation. A check performed on a
fill-at-issuance field validates nothing about the pending population.

### Neither KM nor a full competing-risks model is available here

`EXPIRED` is 22.6% of rows and genuinely ambiguous between "abandoned" and
"issued then lapsed". More decisively: **the competing-risk event TIME is
unpublished**, so a cumulative-incidence function cannot be fitted either. Naming
the right estimator does not make its inputs exist.

### The generalisation

NYC found the same competing-risk distinction independently: 272 in-window pending
filings are "Filing Withdrawn" — not censored survivors — and `filing_status` is
100% non-null on pending, so the separation is available there.

Nashville turned up something else: its pending population lives in a **sibling
layer** (Building_Permit_Applications, 5,886 rows, all unissued, identical
21-field schema). The script queries only the issued layer. **An issuance rate is
computable for Nashville by joining the two** — currently unexploited.

**Philadelphia's 3.0 months is now the weakest figure on the board, not the
strongest.** Its filter needs re-gating on a filing-time field before any issuance
rate is computed from it.

---

## 2026-08-06 — THE FAIL-CLOSED FEATURE WAS DEAD IN PRODUCTION

Found while measuring something else: how often `softenSizeDependent()` downgrades
a hurdle. The answer was **never**, and the reason invalidates a feature shipped
and pushed earlier in this same session.

`buildDefaultSpec` sets `gfaBasis` client-side. **`toQuery()` in
`src/hooks/useAnalysis.ts` never serialized it.** `/api/analyze` reconstructs
`project` from query params alone, so `project.gfaBasis` was `undefined` on every
real request and all three consumers returned at their first line:

- `feasibility.ts` — the INDETERMINATE withholding never fired
- `hurdles.ts` — no size-triggered hurdle was ever downgraded
- `assumptions.ts` — the "ASSUMED, not a code limit" disclosure never rendered

Measured at the HTTP entry point, before the fix:

```
minneapolis  gfaBasis=assumed-far-1.0  in-process: INDETERMINATE  via handler: AS_OF_RIGHT
nashville    gfaBasis=assumed-far-1.0  in-process: INDETERMINATE  via handler: AS_OF_RIGHT
```

**Minneapolis and Nashville were publishing AS_OF_RIGHT off a `lot × 1.0`
placeholder** — the exact claim the guard was built to prevent — while
`docs/NULL-INVENTORY.md` described the withholding as shipped behaviour. That
document was wrong for a day.

### Why it survived a fail-closed audit, tests, and a review

Rule 11, at the worst possible place. `failClosed.test.ts` calls
`assessFeasibility` and `assessHurdles` directly. Every test passed, the feature
was correct, and the wire between the client and the function had a missing field.
**The guard was verified; the path to the guard was not.**

Rule 18 hid it further: three of the five fallback cities (Seattle, San Diego,
San Jose) DO return INDETERMINATE — from unrelated causes — so a spot check of the
group looks right. The two that were wrong were the two nobody looked at.

### The fix, and why it is server-side

`gfaBasis` is now DERIVED in `analyze.ts` from the parcel envelope, not read from
a query param. It records where the parcel's size LIMIT came from, so a caller
cannot omit it, and a user who edits `gfa` upward on a parcel whose FAR never
resolved still gets the verdict withheld. The client's value is now redundant
rather than load-bearing.

Verified through the REAL handler, not the functions:

```
minneapolis  INDETERMINATE  floorAreaBasis PRESENT
nashville    INDETERMINATE  floorAreaBasis PRESENT
chicago  B3-2  NEEDS_RELIEF  "Derived from the published zoning limit"
boston   MFR/LS PROHIBITED   "Derived from the published zoning limit"
```

### Also found in the same measurement

- **San Diego's inventory coordinate returns a DIFFERENT PARCEL on nearly every
  call** — parcelIds 5861800900 / 4174800800, lot sizes 97,106 / 39,615 / 21,389 /
  8,500 sq ft over four calls. Same defect class as the old Philadelphia point.
- **San Diego and San Jose both probe NON-DEVELOPABLE parcels** (Horton Plaza;
  a PQP public/quasi-public lot). `analyze.ts` zeroes hurdles for those, so
  neither city's new hurdle encoding is exercised by the inventory at all.
- **Minneapolis has the largest hidden exposure**: 6 of its 10 encoded hurdles are
  size-triggered, and its FAR needs a two-layer join (rule 13) so it falls back
  citywide. Now that the guard works, most of Minneapolis's regulatory encoding
  will correctly demote to `info` — the fix is resolving Corridor/Transit FAR, not
  changing the hurdles.
- **Null `addsMonths` confirmed as ABSENCE, not skip**, for denver, miami and
  sandiego, each with the researcher's stated reason (Denver publishes durations
  in days; Miami's only figures are decision shot-clocks and a demolition-deferral
  CEILING). Nashville does publish one and it IS encoded. The "five cities" premise
  was wrong — LA has no city branch at all.

### Where the hurdle encoding actually landed — `45dcc58`

That commit's message describes 29 lines of `analyze.ts` (the `gfaBasis`
production fix). It also contains **~2,400 lines of hurdle encoding and backfill**
— nine city branches, their tests, and the untruncated proposals doc — swept in by
a `git add -A`. The content is correct and tested; the message is not where a
reader would find it. Recorded here rather than rewriting a pushed commit.

### The truncation over-fired systematically, and the mechanism predicts it

A truncated conjunctive condition ALWAYS over-fires: the slice keeps the first
clause and drops the `AND`. My `[:90]` cut landed exactly where qualifiers live,
so every affected rule came out BROADER than the code. Ten contradictions were
found and **all ten ran the same direction** — asserting a mandate on projects the
code exempts:

- **Philadelphia Project Information Form** — widest. Gated on `gfa > 2500` alone,
  but § 18-502(2) is conjunctive: over 2,500 sq ft AND (Council ordinance OR ZBA
  variance OR Civic Design Review criteria). As encoded it asserted `required` on
  essentially every as-of-right Philadelphia project over 2,500 sq ft.
- **DC Green Building Act** — `gfa >= 50000` with no use test, on a source that
  explicitly warns the rule "is often misquoted as applying to all large
  buildings." The encoding reproduced the known misquote.
- **San Diego Mobility Choices** — pushed on every project with a "confirm whether
  yours falls inside the exception" hedge, against a hard numeric exemption:
  residential of four or fewer units, exempt outright.

**The ten are not a sample — they are the ones that CONTRADICTED the fragment.** A
rule whose source merely NARROWS what the fragment said produces no contradiction
and no flag, while still over-firing. Any rule with a qualifier after character 90
is a candidate. That sweep is the open item.

---

## 2026-08-06 — The conjunctive sweep: the ten were not the population

Swept all 105 encoded hurdle gates against their restored source, asking a
different question from the one that found the ten: **not "does the source
contradict the encoding" but "does the source contain a conjunction, exception or
use restriction the gate does not implement".** A rule that merely NARROWS what
the truncated fragment said contradicts nothing, raises no flag, and still
over-fires.

**19 more over-firing gates found. 7 under-firing. 64 of 105 already clean.**

Nearly twice as many again as the contradictions, and every one the predicted
shape: the fragment kept the first clause and dropped a conjunct.

| | gate as written | source qualifier dropped |
|---|---|---|
| **DC Green Area Ratio** | every new building | § 601.2 applies to "all zones EXCEPT the R and RF zones" — DC's rowhouse and detached zones, most of its zoned land |
| **Miami historic demolition delay** | every teardown | § 23-6.2(b)(4)b.4 needs a CONTRIBUTING structure, i.e. a designated district — and `parcel.overlays.historicDistrict` was already in use three lines away |
| **San Diego ESL permit** | **100% of San Diego projects** | Table 143-01A row 3 is the "multiple dwelling unit development" row; other types sit on rows nobody read |

San Diego's is the cleanest illustration: an unconditional `hurdles.push(...)`
handing a Process Three hearing claim to every single-dwelling, commercial and
institutional project, off one unread table row.

### Under-firing was reported and deliberately NOT fixed

Seven gates are NARROWER than their source. **None were widened.** Widening a gate
asserts that a rule applies, and each of these needs an input or a reading we do
not have — San Diego's Process Four historical-resource permit is the worst, since
a user is never told the rule exists at all. Reported for research, not closed by
guesswork.

Two Philadelphia under-fires are the same truncation pointing the other way: the
fragment kept Case 1 of a two-case table and dropped Case 2.

### The citation checker can no longer pass on an empty set

Measured coverage: **3 checkable URLs repo-wide against 418 section citations, and
46 of 48 citing files contain nothing the tool can test.** `hurdles.ts` (191
citations, 0 URLs) was the worst but not the exception — it was the rule.

The tool now reports three per-file states — `checked` / `unchecked` / `silent`,
with `silent` (no citations at all) deliberately distinct from `unchecked` (an
absence is not a gap) — and **`PASS` is unreachable while any file is
`unchecked`.** The tree currently prints:

> `PARTIAL — every cited URL resolves, but 46 files cite sources this tool cannot
> fetch and it verified none of them. This is NOT a pass. Do not read it as one.`

Mutation-verified: removing the `unchecked` state fails 5 tests; forcing `PASS`
fails 2. And the checker does **not** exempt itself from its own coverage rule —
it appears in its own unchecked list, which is the whole argument.

### One agent claim that was false, checked rather than relayed

The instrument agent reported that `vite-node` is not installed and the documented
command silently no-ops. Running it directly disproves that — it has been the
entry point for every script all session and it produces the PARTIAL verdict
above. Reported here because a plausible-sounding tooling claim from an agent is
exactly the kind of thing that gets relayed unverified.

### Probe coordinates: San Diego and San Jose were measuring a blocked parcel

Both replaced 2026-08-06. Each failed differently, and neither was the
Philadelphia failure the file's own comment describes.

- **San Diego [32.7157, -117.1611]** — Horton Plaza, city-owned, sitting on
  OVERLAPPING ownership polygons. Every one of them contains the point, so the
  exact-match query returns several, `nearestFeatureSet()` cannot discriminate
  between features that all contain it, and the server's ordering decides. Four
  calls returned parcelIds 5861800900 and 4174800800 at lot sizes 97,106 / 39,615
  / 21,389 / 8,500 sq ft. **Philadelphia's old point was OFF any parcel; this one
  was ON too many** — opposite defects with the same symptom.
- **San Jose [37.3382, -121.8863]** — a PQP public/quasi-public lot.

Both were non-developable, so `analyze.ts` zeroes hurdles for them. **Neither
city's regulatory encoding was exercised by this inventory at all** — those two
rows measured a blocked parcel, not the city, while reading as ordinary results.

Replacements are ordinary residential parcels — `RS-1-7` (7,958 sq ft) and
`R-1-8` (5,018 sq ft) — each verified STABLE over four isolated re-probes, same
parcelId and lot size every time. Both still report GAP, which is now a real
finding about those cities' FAR resolution rather than an artifact of probing land
nobody can build on.

**Not fixed:** the underlying non-determinism when a point falls inside several
overlapping parcels. `fetchParcelSnap`'s buffered path already picks the nearest
deterministically; the exact path has no tiebreak because "nearest" is undefined
when every candidate contains the point. Changing it touches all fifteen cities
and needs its own verification pass.

### The rate, and what the sweep did NOT establish

**29 of 96 encoded gates were corrected — a 30% error rate on the encoding
process under truncation.** Recorded as the number because it calibrates how much
scrutiny the next batch encoding needs: this was not a subset going wrong, it was
the process being broadly unreliable when its input was clipped.

Two things the sweep did not establish, stated rather than implied:

**1. The under-fire count is a FLOOR, not a total.** Seven were found (4 + 2 + 1),
so the answer is not zero and not untested. But the search vocabulary given to the
agents was narrowing-oriented — `and`, `only if`, `except`, `unless`, `provided
that`. A source BROADER than the gate reads as `or`, `including`, `any`, and those
terms were never specified. The seven surfaced anyway; more may exist.

**2. "66 unchanged" would have been wrong, and the arithmetic does not close.**
Explicitly reported clean: 20 + 22 + 22 = **64**. Against 19 over-firing and 7
under-firing, that accounts for 90 of the 105 items the agents said they covered —
while the nine branches actually contain 96 gates. The discrepancy is items
counted that are not branch gates (parking rendered from `PARKING_RULES`, historic
from `HISTORIC_BODY`). **So ~15 are unaccounted for, not verified correct.** A
clean count that does not reconcile with the file is not evidence of coverage.

### Probe stability is now checked on every run

`stability()` calls each probe three times and compares parcelId and lot size. An
unstable probe now prints a warning and stamps the inventory row **"PROBE UNSTABLE
— this row is not reproducible"** rather than reading as an ordinary result.

The underlying defect is live in all fifteen cities: a point inside overlapping
parcel polygons returns an arbitrary one, because every candidate contains it and
`nearestFeatureSet()` has no tiebreak. **A single call always looks fine** — rule
18's shape exactly — so the only detection is calling repeatedly and comparing.
This inventory already hits every city, which makes it the cheapest place to run
that check. All fifteen probes are currently stable.

---

## 2026-08-06 — Fixing the denominator found 29 unreached gates, not ~15

The previous sweep's counts did not reconcile: 64 clean + 19 over + 7 under = 90,
against 105 claimed covered, against **96 gates actually present** in the nine
city branches. Three numbers that should agree and didn't.

**The fix was to change the unit.** The sweep counted *rendered* hurdles — which
include parking emitted from `PARKING_RULES` and historic from `HISTORIC_BODY`,
neither of which is a branch gate. Enumerating `label:` declarations inside each
`city === '…'` block, then matching each against everything the agents wrote,
gives the real figure: **96 gates, 67 mentioned by some report, 29 never
mentioned at all.** Nearly a third, not ~15.

A coverage claim that does not reconcile with the file is not coverage. The
enumeration is checkable against `hurdles.ts`; the agents' counts were only
checkable against each other.

### What the 29 contained

**8 more over-firing** (5 fixed, 3 flagged where tightening needs a field we lack)
and **12 more under-firing**.

- **DC Stormwater Retention Volume** — gate read `lotSqFt >= 5000`. 21 DCMR § 599
  triggers on "activity that DISTURBS five thousand square feet or greater of land
  area". Lot area substituted for disturbed area, with **no activity limb at
  all**: a `change_of_use` project on any 6,000 sq ft DC lot was told it owed a
  retention volume.
- **San Jose TDM** — `units >= 26` applied to commercial projects, but
  § 20.90.900.B.2's exemptions are written entirely in HOME END USES, so 26 is a
  residential threshold. `units` is independent of `use` in `AnalysisInput`, so
  this was reachable, not theoretical.

### A distinct defect class: the condition is right, the copy over-claims

Batch 2 found **none of its 11 gates had an over-broad condition** — every
over-fire was a dropped qualifier in the DISCLOSURE COPY. Miami's Downtown DRI
fee note omitted the source's opening exception ("Except as may be provided
section 13-58…"). Per rule 9's corollary, disclosure copy is code: a note that
states a rule applies makes the same claim the condition would, and is read by
more people.

### The broadening vocabulary confirmed 7 was a floor

12 under-fires found here against 7 in the whole previous sweep, once `or`,
`including`, `any`, `at least one of` were specified alongside the narrowing
terms. **None were widened** — widening asserts a rule applies. Austin's parkland
dedication cannot reach its hotel/motel limb because `Use` has no hotel member;
San Jose's TDM misses the 16-unit single-family-detached limb; Minneapolis's TDM
implements only the Table 555-10 rows and not the director's discretionary power.

### Not finished

**Batch 3 returned PARTIAL.** Some San Diego / San Jose / Nashville gates in the
29 were not reached. The unreached-of-the-unreached is the remaining gap, and it
should be enumerated the same way rather than estimated.

---

## 2026-08-06 — Unit gates decided per source, and an unsourced hurdle surfaced

Nine unguarded `units >=` gates, decided individually rather than blanket-guarded
— adding a guard the source does not call for is an UNDER-fire, the worse
direction.

**Guarded** (source threshold written in dwelling/rooming units): Minneapolis
Site plan review (Table 550-1: "four or more new or additional DWELLING UNITS OR
ROOMING UNITS"), Minneapolis TDM (Table 555-10, the residential row — the direct
analogue of San Jose's), Minneapolis No Net Loss (UHP § III(A)(1)(viii) modifies
an IZ requirement that only attaches to residential), and Seattle's SEPA unit
limb — its floor-area limb left unguarded, correctly.

**Already guarded by ENCLOSURE**: Philadelphia /MIN, San Jose green building,
Nashville inclusionary and three nested Minneapolis selectors all sit inside an
outer `if (isResidential)`. **A line-level grep reported all seven as unguarded —
false positives, because the grep cannot see nesting.** The instrument was
narrower than the structure it measured; the agents' per-gate reads were right and
the grep was not.

### The finding: an unsourced hurdle in a city nobody researched

**SF's "Subsidy strings" hurdle has NO source and NO citation** — not in
`HURDLE-PROPOSALS.md`, and `grep -rn "Subsidy strings"` returns nothing anywhere
in the repo. It carries a live `gfa >= 50000 || units >= 25` threshold that
cannot be traced to anything.

It is not truncated, not over-broad, not mis-transcribed. It is **unsourced**, and
it surfaced only because a use-guard decision required reading its source and
there was none to read.

**The six original cities — boston, chicago, la, nyc, seattle, sf — were never
part of the hurdle research.** Their hurdles predate this session, and none has
been audited against a source the way the nine just were. Every finding tonight
about truncation, over-firing and disclosure copy concerns the NINE. The six are
unexamined, and at least one of them carries a threshold with no provenance at
all.

---

## 2026-08-07 — Raleigh as a pipeline test: adding a city is repeatable, but not self-contained

Raleigh was added end to end as a deliberate test of whether adding a city is a
**procedure** rather than a one-off research effort. It shipped green — `tsc -b`
clean, lint clean, 60 test files / 1401 tests (from 1393), four real parcels
verified through the `/api/analyze` handler, and a null-inventory row reading
`UNCONSTRAINED (an answer)`. The procedure it produced is now
`docs/ADDING-A-CITY.md`.

The result is that the process **is** repeatable. What follows is what it cost,
because a run that only recorded the green result would be the same shape as
every defect this ledger tracks.

### The scout's summary was wrong four times, and it was the load-bearing claim that was wrong

Provider work was fed by a scouting pass. Reading the official consolidated UDO
(`udo.raleighnc.gov/udo-book/print-all-chapters`, reached from the site's own
print index, not a guessed path) contradicted it on four points:

1. **"The UDO sets no feet-per-story cap for mixed-use districts."** False. Sec.
   3.3.1 states verbatim that the designation "establishes the maximum height in
   stories and feet", worked example and all, and Sec. 3.3.2 row A2 tabulates
   50'/68'/80' for `-3/-4/-5`. Trusting the summary would have shipped
   `maxHeightFt: null` on **every `-3/-4/-5` parcel — a fabricated gap over the
   majority of Raleigh's mixed-use land.**
2. Townhouse height in R-6 and R-10 is 45', not 40'; civic in R-10 is 45'.
3. The Frequent Transit Development Option does not raise height (its own rows
   E1–E3 restate Article 2.2's figures) — it relaxes lot area and density.
4. The `-TOD` mixed-use height increase is an **earned** bonus conditioned on
   deed-restricted affordability, not an available one.

All four are rule 18: plausible summaries, wrong in the direction that looks like
an answer. **A scout's summary is an input to be checked, never a source** — and
note that the most damaging error was in the claim the whole module rested on,
not in a marginal one.

One thing went the other way, usefully: Raleigh's own Sec. 3.3.2 table
**disproves** the existence of a ft/story constant — 50/3, 68/4, 80/5 imply
16.67, 17.00 and 16.00 — so the Miami-21 round-trip is now blocked here by a test
asserting no constant in 10–18 reproduces all three rows. A source document
carrying its own disproof is the cheapest structure available (rule 14); look for
one in every new city.

### The provider stage was self-contained. The wiring stage was not, and that is the finding

The provider stage created five Raleigh-only files (zoning module + 96 tests,
provider + 22 tests, fixtures) and reported, accurately, that **nothing shared
was touched**. That report was true and still incomplete, because the defect it
was hiding is only visible at the real handler.

Raleigh is the first city whose code states a **story count and no feet** for a
whole band of districts (`-7` and above). Run through `/api/analyze` as written,
`DX-7-SH` and `DX-40-SH` printed *"No district height limit is available in
public data"* and reported `envelopeKnown: false` — **the tool disclaiming
knowledge it demonstrably had**, over districts whose limit the ordinance states
outright.

`netlify/functions/lib/feasibility.ts` gained three branches and six tests:
stories compared against stories directly (never via feet), a separate
`INDETERMINATE` for *the limit is known, just in another unit* with copy that
says so, and `statedStories` counting toward `envelopeKnown`. The middle branch
is **rule 5 one notch finer** — an absence and a gap must not render alike, and
neither may a published limit we declined to convert.

The generalisation for the next city: a required change to shared logic is not
scope creep. A *city-specific branch* in shared logic is the thing to avoid.
Splitting the work into a provider stage and a wiring stage is right, but the
provider stage's "all green, nothing shared touched" must not be read as "the
city is done".

### An honest gap broke a green test that assumed completeness

Raleigh has **no `lifecycleMonths` row**, deliberately. What was available was an
argument — Southern metro, no state environmental-review statute, fast Census SOC
durations, therefore "about Nashville's 16/25/40" — which is a mechanism argued
aloud, and rule 1 gives it no direction at all. Nashville's own row is a peer-set
calibration, so copying it sideways would have made Raleigh's number a derivative
of a derivative wearing Boston's font.

That omission **failed a passing test**: `redTapeIndex.test.ts` asserted
`ranked.toHaveLength(CITIES.length)`. The two ways to restore green were to
invent a duration (rule 1) or to drop Raleigh from the table quietly (an absence
rendering as a finding) — both failures already in this ledger. The invariant was
reformulated instead: **every city is either RANKED or DISCLOSED and never
both**, cross-checked against `lifecycleMonths` in both directions, with a
companion test proving the unranked list is derived from the constants rather
than typed.

Worth stating as an expectation rather than an incident: **adding an honest gap
will break a test that assumed completeness, and the fix is to reformulate the
invariant, not to fill the gap.**

### What the existing guards caught, unprompted

- **Probe stability** (added 2026-08-06 after San Diego) did its job before
  adoption rather than after: 810 Daniels St was verified over two independent
  runs of four isolated `getParcelInfo` calls, all eight returning parcelId
  1704142690 and lot 9,433 sq ft. The probe was picked from a parcel *query*
  filtered for a developable single-unit lot in Raleigh's own jurisdiction, and
  from the polygon centroid rather than an address pin.
- **Rule 16 reconciliation** on the cost index: the RSMeans pull that produced
  Raleigh 84.4 (ZIP group 275-276) reproduced Nashville 89.0, Austin 82.9 and
  Miami 85.1 — already-committed values — before the new row was trusted.
- **Rule 2 on the handler output**: 9,500 sf × $340 × 0.84 = $2,713,200, exactly
  the returned hard cost, confirming the city index *flows through* rather than
  merely being displayed. A sum would not have discriminated that.
- The `parkingRules` coverage test and the `PROHIBITED` verdict on `DX-40-SH`
  (~306 existing homes vs. 102 proposed, generic no-net-loss) both resolved to
  data on inspection, not to defects.

### What Raleigh is still NOT claiming

No city-specific hurdles (`CITIES_WITH_SPECIFIC_HURDLES` unchanged — the four
verified parcels show 3 generic hurdles, and `analyze.ts`'s disclaimer names
Raleigh as the current exception), no measured permit timing, no lifecycle
duration, and no client-side zoning overlay — `maps.raleighnc.gov` is absent from
the `netlify.toml` CSP `connect-src`, which is recorded as a **CSP gap and
explicitly not a CORS finding**, since no cross-origin probe was run. Denver's
adjacent entry records an actual CORS probe; the two reasons must not be copied
onto each other.

## 2026-08-08 — A truncated handoff is silent AND total, and it happened twice

Four research agents read four cities' codes and returned parking, hurdles and
permit-feed findings. The orchestrating script passed them on as
`JSON.stringify(r).slice(0, 4500)`.

Each city's blob runs 46,000–54,000 characters. The 4,500-char slice landed
partway through `parking`, the first key. **The `hurdles` field — 140,418
characters across the four cities, every category the phase existed to produce —
arrived as nothing at all.** Not degraded, not partial: absent, with no marker
distinguishing "this city has no inclusionary requirement" from "the research
never got here."

### The two properties that make this worse than ordinary data loss

**It is silent at the boundary that matters.** The sender's log says four
research agents completed successfully, and they had. The receiver sees a
well-formed object with a `parking` key. Neither side can see the deletion; only
the receiver noticing that a field it was promised is missing catches it, and
that depends on the receiver having been told what to expect.

**It is total rather than proportional.** A slice on a serialised object does not
lose the tail of each field evenly — it loses every field after the cut
completely. The intuition "I'll cap it, I'll lose some detail" is wrong about
what actually happens: you lose whole categories, chosen by key order.

### It happened twice in one session

The first was `HURDLE-PROPOSALS.md`, sliced `[:48]/[:90]/[:70]` — 109 rows, 55
losing a digit, ~90% of the research discarded. That one was caught by the user
asking the scope question ("check every row's source length against the slice, not
just the ones the agents noticed"). This one was caught by the receiving agent
reporting that its input arrived truncated — which it only did because it had been
told what the input should contain.

Two instances, same mechanism, same session. Not an incident.

### What the receiving agent did right, and why it mattered

It applied the parking research, added the four cities to
`CITIES_WITH_SPECIFIC_HURDLES` because a drift guard would otherwise fail against
branches that exist — and then **recorded the shortfall above the constant in
`cities.ts` rather than letting it pass**. That constant is what `Compare.tsx`
reads to decide whether to mark a hurdle count as a floor. Adding a city to it is
the claim that the city's specific mandates are encoded. For the length of one
workflow that claim was overstated, and the only thing standing between that and a
user reading "4 approvals" as complete was an agent writing down that its input
looked wrong.

It also refused to encode Charlotte's North Carolina statewide parking preemption
from the fragment "Session La…" — no session law number, no effective date, no
operative text. Rule 1, correctly applied to a fact that was probably true: a
mechanism argued aloud earns no direction until something measures it, and
"probably true and important" is exactly when the temptation to hedge is strongest.

### The rule

**Never slice a handoff between agents. Write it to a file and pass the path.**
A cap is a silent, total, key-order-dependent deletion, and the sender cannot see
it. Where a receiver must be given content inline, tell it what fields to expect
so that a missing one is reportable rather than invisible — that is the only thing
that caught this.

---

## 2026-08-08 — Two measured issuance rates, and exactly how far the comparison carries

Raleigh's ArcGIS feed carries NON-ISSUED rows, so its issuance rate is measured
rather than characterised: **7,878 of 8,685 applications filed 2022-01-01 onward
have an issue date — 90.7%**, by filing cohort 97.3% (2022) / 97.4% / 95.1% /
91.6% / 58.6% (2026), the last being immaturity rather than collapse. That makes
Raleigh the **second city after NYC** where the rate is a measurement, and the
first opportunity this project has had to compare the rate between two cities
rather than assert it about one.

Against SF's 37.7%, that is a real finding about those two cities. What follows
is how far it carries, because two numbers in the same units are exactly the
shape rule 18 warns about, and the interesting work was establishing what the
denominators actually contain rather than dividing.

### Both instruments reconcile against the known-good first (rule 16)

Re-queried independently before anything was compared. Raleigh's layer returns
8,685 in-window rows under the `workclass` filter alone and 7,878 with a non-null
`issueddate` — **90.71%, reproducing the committed figure exactly.**

SF reproduces too, and its small drift is itself informative. The live Socrata
pull today gives 145 issued of 392 filings = 37.0%, against 37.7% recorded
2026-08-06. The **numerator is unchanged at 145**, and 145/384 = 37.76% — so the
denominator grew by roughly eight new filings in two days, none of them issued
yet. That is the arithmetic of a live feed, not a contradiction, and the recorded
figure stands.

### Where the two rates ARE the same measurement

Same window (filed/applied 2022-01-01 onward). Same operational definition: a
non-null issue date at extract, over a denominator of applications. And — the
part that had to be checked rather than assumed — **both denominators are built
on filters populated at FILING time.**

Raleigh's rate is deliberately computed before the `proposeduse` building gate,
because that field is assigned *during review*: blank on 26.8% of not-yet-issued
rows and populated on 100.0% of issued ones. Computing after the gate would drop
mostly-unissued rows from the denominator and report ~93.5% instead of 90.7% —
the instrument measuring itself.

SF's figure was computed on its post-filter population, so the same defect had to
be ruled out there, and it is absent: `proposed_use` is null on **5 of 247**
non-issued SF rows (2.0%) against 6 of 145 issued. SF's use field is a filing-time
field. Both rates are therefore clean of the selection-on-the-outcome that
disqualified Austin, Denver, Miami and Philadelphia entirely.

### The composition objection, and why it fails

The obvious deflation is that Raleigh's row is not the project. It isn't: **4,077
of the 8,685 window rows are townhouse per-unit child permits**, and they issue at
94.1%, against 92.2% for `New Residential Dwelling`, 70.8% for the
non-residential `New Building` class and 66.7% for `Shell Building`. A denominator
that is 47% near-certain-to-issue children of already-approved developments, set
against SF's one-row-per-permit sample, is a mix artifact waiting to be found.

So stratify, and the gap survives:

| class, filed 2022→ | Raleigh | SF |
|---|---|---|
| detached single-family | **3,006 / 3,195 = 94.1%** | **54 / 130 = 41.5%** |
| five-or-more-family / apartments | 262 / 335 = 78.2% | 37 / 102 = 36.3% |

Like for like, on the class where a permit means one building in both cities, the
gap is 2.3×. It narrows toward the apartment end in both cities and never closes.
**That is the finding, and stratification is what turned it from two headline
numbers into one.**

### What the comparison will NOT carry: the complement

The rates are computed identically. Their complements are not the same object,
and this is the qualification that matters.

SF's 247 non-issued rows carry a status the city has recorded: 173 `filed`, 36
`approved`, **21 `withdrawn`**, 16 `reinstated`, 1 `cancelled`. Raleigh's 807
non-issued rows: 336 `In Review`, 203 `Ready for Issuance`, 187
`Submitted - Online`, 38 `Review Expired`, 20 `Submitted`, 19 `On Hold`, and four
singletons. **Not one Withdrawn, Denied or Cancelled — and no such value exists
anywhere in the layer's `statuscurrent` vocabulary**, 17 distinct values over
183,456 rows. `voiddate` is populated on 5,621 rows dataset-wide and on exactly
**one** row inside the window.

A Raleigh application that dies therefore either never becomes a row or is
indistinguishable from one still in review. SF's 63% contains applications the
city has marked dead; Raleigh's 9.3% contains none, by construction of the feed.

The operational consequence is a wording rule, and this repo has already written
the wrong version in three places: **"90.7% ever issue" and "37.7% ever issue" are
both unsupported.** What is measured is the share carrying an issue date at
extract. Neither feed says a pending application will never issue — SF's 173 rows
sitting at `filed`, some of them four years on, are not marked dead either. Rule 5
running the other way: a *not-yet* and a *never* must not render the same, and
here neither city's data distinguishes them. State the share; do not state the
fate.

### Cohort maturity runs in OPPOSITE directions, and that widens the gap

Raleigh falls with recency — 97.3 / 97.4 / 95.1 / 91.6 / 58.6 — the ordinary
immaturity shape, where the newest cohort has not had time to issue.

SF **rises** with recency: 66/197 = 33.5% (2022), 29/75 = 38.7%, 13/26 = 50.0%,
32/58 = 55.2%, then 5/36 = 13.9% for the part-year 2026. **SF's oldest cohort is
its worst**, which is not what censoring produces; it is what a backlog of old
filings that never issued produces.

So the two pooled figures are wrong in opposite directions, and correcting both
for maturity moves them further apart, not closer: the matured 2022-cohort
comparison is **97.3% against 33.5%**. The headline pair understates the gap.

### Why this matters beyond the two cities

Every other city's permit median here is conditional on issuance — a statistic
about survivors — and the issuance rate is the only thing that converts a
conditional median into a bound on the unconditional one. Two measured rates that
differ this much, and that keep differing after stratification, say the correction
is **not a constant and cannot be borrowed between cities**. That is the same
refusal that stopped Nashville's lifecycle row being copied sideways to Raleigh:
a peer-set argument is a mechanism, and a mechanism earns no direction (rule 1).
Two measured rates are the beginning of knowing the size of the correction, and
they are also proof that a third city's rate cannot be inferred from them.

### My own probe failed once, in the house style

`proposeduse = 'RESIDENTIAL TOWNHOUSE'` returned **0 rows**, and the available
reading was "that class isn't in the window." It is 3,964 rows. The stored values
carry a leading tab or space; `scripts/permits/raleigh.mjs` has a `norm()` helper
for exactly this and my ad-hoc query did not use it. Rule 11 for one round —
measuring the query rather than the data — and what closed it in seconds was rule
16, because 0 contradicted a committed known-good count of 3,803.

---

## 2026-08-08 — A dead writer leaves a tree that typechecks

The agent integrating four cities' hurdle research died — `Connection closed
mid-response` — after writing **3,514 lines** and **before running the suite**.

What it left behind: `tsc -b` clean, every branch syntactically complete and
well-formed, **two failing tests**, and a comment in `src/config/cities.ts` that
its own work had just made false.

### The sharp point

Nothing about a crash announces itself in the artifact. A finished tree and an
abandoned one are the same tree until something executes it — the type checker
passes on both, and **the diff of an interrupted edit is a well-formed diff.**
Reading the change cannot distinguish the two states; only running the suite can.

This is rule 9 relocated from the code to the process. Every check that has found
a real defect here compared the system to something outside it, and a writer
inspecting its own output is inside it. Here one agent held both roles, so the
only evidence that the work was complete was the work itself.

### The retraction that reached one file and not the other

The agent correctly wrote the corrected claims into `hurdles.ts`. It never reached
`cities.ts`, where the note above `CITIES_WITH_SPECIFIC_HURDLES` still said the
four cities were encoded for **parking only** — true when it was written, during
the truncated-handoff interval recorded above, and false the moment the hurdle
branches landed. `Compare.tsx` reads that constant to decide whether a hurdle
count renders as a floor.

Rule 17, third instance: a claim lives in more than one place, and the summary at
the top of a file is where a reader lands. Note the direction reversed between the
two failures and both were wrong — first the *list* over-claimed against
parking-only branches, then the *comment* under-claimed against complete ones.
**A note that describes coverage has to be re-read every time coverage moves**,
and it is not the kind of thing a test can hold, because it is prose about scope.

What caught it was somebody re-reading the file. Not `tsc`, which was clean; not
the diff, which was well-formed; not the suite, which fails on the tests and says
nothing about a comment.

### The rule

**The agent that writes a change must not be the agent that verifies it, and
verification means running the suite, not reading the diff.** The corollary is
what makes it non-negotiable for long single-agent edits: a writer that dies
silently is the *expected* failure at 3,514 lines, not the exception — so the
danger is not the crash, it is that nothing in the pipeline distinguishes a crash
from completion when the checker is the same process that did the writing.

Recorded green after the fixes: 68 test files / 1,862 tests, up from 60 / 1,401 at
Raleigh.

## 2026-08-09 — A survivor rate published at the top of its own bound, and LA's 45.4% was real all along

Two provenance corrections, opposite in shape. One published figure was unsound
and had to be restated. One retraction was itself wrong and had to be un-retracted.

### SF's relief rate was a filing cohort scored over its survivors

`scripts/relief/sf.mjs` framed its cohort on `open_date` — variance records
**filed** since 2022 — and then computed `granted ÷ decided` over the members
that had reached an outcome. Records still pending were not excluded by a
documented decision; they were dropped by the `record_status IN (granted, denied)`
filter and never appeared in the denominator.

Measured live, VAR records with `open_date >= 2022-01-01`:

| | n |
|---|---|
| decided (293 `Closed - Approved` + 7 `Closed - Disapproved`) | 300 |
| still undecided (Under Review 26, Pending Review 17, Submitted 15, Accepted 11, On Hold 9, Open 3, Action Pending 2) | **83** |
| cohort | 383 |

**21.7% of the cohort had no outcome and was invisible to the published rate.**
The cohort supports only a bound — 293/383 = **76.5%** if every pending case is
denied, 376/383 = **98.2%** if every one is granted — and the figure on the site,
**97.6%, sat at the very top of it.** A number that can only be wrong in one
direction is not a measurement.

Boston was clean the whole time for a structural reason, not a lucky one: it
frames on `final_decision_date`, so a cohort of "appeals decided in the window"
**cannot contain a pending member**. Exclusion by construction, not by censoring.

### The fix required a field the previous author had concluded did not exist

The script's own comment asserted SF "publishes `open_date` (application date),
not a separate decision date". The dataset has seventeen columns and **two** are
dates: `open_date` and **`close_date`**. The absence had been established by
probing `$limit=1` — and **Socrata omits null fields per row**, so a sample row is
not a schema. Rule 8, exactly: a 404 on a guessed path proves the guess wrong, not
the resource absent, and a field missing from one row proves nothing at all. The
rebuilt script reads `/api/views/<4x4>.json` instead.

`close_date` is **not** a decision date and the vintage string does not call it
one — the publisher defines it as *"Date the record was closed."* It is used for
cohort **membership** only. What licenses that is measured, not nominal:

- populated on **100%** of terminal records (7,534/7,536 all-time; the two
  exceptions opened 2015 and 2017), and
- populated on **0%** of every in-progress status — Under Review 0/33, On Hold
  0/18, Pending Review 0/18, Submitted 0/15, Open 0/3, Action Pending 0/2.

So "closed in window" *is* "resolved", and all 628 in-window rows carry a terminal
status. **Restated: 97.3% (n=406, 395 granted / 11 denied)**, replacing 97.6%
(n=289). The rendered line moves 98% → 97%.

Three checks ran before adopting the frame, and the third is the one that mattered:
per-year rates are stable (95.6–99.1%); window-start sensitivity is mild
(since-2021 95.49% → since-2024 97.07%); and **closure lag does not differ by
outcome** — approved p50 269d vs disapproved p50 274d — so the new frame does not
select on the result it is measuring. The restated 97.29% also lands inside the old
frame's [76.5%, 98.2%] bound: two independent framings agree.

The gate is `refuseUnlessCohortIsResolved()`, with a **fail-closed vocabulary** —
any status in the window not on the TERMINAL list halts the run, so a new
disposition code cannot be silently ignored. Threshold zero, which is not a
tolerance but the claim itself. Verified by deleting `Closed - Withdrawn` from
TERMINAL and watching it refuse on 152 rows and write nothing (rule 14: the caught
error is now an impossible state, not a comment).

### LA's 45.4% was real, and the re-probe that "disproved" it read the wrong feed

The 2026-08-05 audit recorded *"45.4% of the cohort carries no issue date at
extract; only 64.1% of the matured 2022 cohort carries one"*. A 2026-08-09 re-probe
against `pi9x-tg5x` returned **100.00%** and the claim was recorded across
`la.mjs` and `scripts/permits/README.md` as *not reproducing*.

**That note was the error.** `pi9x-tg5x` is titled *"Building Permits **Issued**
from 2020 to Present"*. Asking an issued-only feed how many applications never
issued measures the query, not the city — **rule 11, and committed by the pass
written to enforce rule 11.**

LADBS publishes a companion feed, found by reading the portal's catalogue rather
than guessing ids: **`gwh9-jnip`, "Building Permits SUBMITTED from 2020 to
Present"**. All three recorded figures reconstruct to the decimal (two isolated
passes, rule 10):

| recorded | measured on `gwh9-jnip` |
|---|---|
| 45.4% carry no issue date | **45.36%** (11,810 / 26,035) |
| only 54.6% observed | **54.64%** |
| 64.1% of the matured 2022 cohort | **64.11%** (3,901 / 6,085) |

The denominator is genuine. The no-issue rows carry a real pre-issuance
`status_desc` vocabulary — Quality Review Completed 5,592, Verifications in
Progress 2,902, PC Info Complete 1,215, Corrections Issued 698 — the very values
correctly reported as absent from `pi9x-tg5x`. The feeds join cleanly both ways:
**0 of 12** sampled never-issued permits appear in `pi9x-tg5x`; **12 of 12**
sampled issued permits appear in `gwh9-jnip` with `issue_date` set. `gwh9-jnip` is
the application population, `pi9x-tg5x` its issued subset.

**This makes LA's withdrawal stronger.** The reason is not "no denominator exists"
— the denominator exists and it *disqualifies* the figure. At 54.64% observed the
quantile-existence rule identifies p50 and not p80, and the withdrawn pair was
median 6.0 / **p80 13.0**.

The 2026-08-08 "state the SHARE, not the FATE" retraction was re-checked against
the better feed and **holds**: `gwh9-jnip`'s no-issue domain is entirely
in-progress states, with no Withdrawn, Denied or Expired value anywhere.

### The rule

**A measurement that fails to reproduce indicts the instrument before it indicts
the record.** Rule 16 said a result contradicting a known-good is the instrument's
problem; this is the same asymmetry for a *negative* result. "The earlier figure
does not reproduce" felt like the careful, humble finding — it withdraws a claim
rather than asserting one — and that is exactly why it got less scrutiny than a
surprising positive would have. It shipped into four files on one probe of one
feed, and the honest-sounding phrasing "does not reproduce against the current
feed" was doing the damage, because **"the current feed" silently assumed the feed
we happened to read was the feed the claim was about.**

Before recording a non-reproduction, enumerate the sources that could have
produced the original. Here it took one catalogue query and the first candidate
matched three figures to the decimal.

Corollary for retraction hygiene (rule 17): **a retraction can itself need
retracting, and it propagates just as widely.** The false "does not reproduce"
note had already reached two files and was queued for four more as a deliberate
propagation decision. What stopped it was checking the claim against the world
before spreading it — not after.

---

## 2026-08-09 — NYC withdrawn: the disqualifier was in the file, and the query was blindfolded

**Shipped:** `nyc.newConstruction` = **8.3 mo / p80 17.0 / n=4,403**, from
2026-08-06 to 2026-08-09. Three days, in `permitStats.json`, on the result page's
"Measured permit time" card and in the Red Tape Index's NYC story ("New York City
issues a new-construction permit in about 8 months"), and as an unmarked figure in
Compare's Timeline row.

**Withdrawn** 2026-08-09: removed from `permitStats.json` and from
`CITIES_WITH_MEASURED_PERMITS`, with a structural refusal gate added to
`scripts/permits/nyc.mjs`.

### Why

8.3 is a **conditional median** — time to issuance GIVEN issuance. 45% of initial
New Building filings since 2022 carried no issue date at extract; the permitted
share fell by cohort (1461/1960 in 2022 → 764/1764 in 2025); Kaplan-Meier over all
8,039 filings gave **~15.9 months**. The published figure was roughly **2x below
the file's own estimate of the thing it claimed to measure**.

The only place the condition could have been stated is the artifact's `vintage`
string, and `src/lib/realityCheck.ts` renders `medianMonths`, `p80Months` and `n`
— never `vintage`. So the caveat had no surface. Milwaukee's residential pair is
sound and is withheld for exactly this reason; **being a large city is not an
exemption**, and "NYC is too important to omit" is an argument about consequences,
not about whether the number is true.

### The two mechanisms, both mechanical

**1. The query was blindfolded.** `pull()` ended
`AND first_permit_date IS NOT NULL`. A query that selects on the outcome cannot
measure how often the outcome occurs, so `main()` reproduced 8.3 faithfully and
had no access to the 45% — which was **written in the same file, four paragraphs
above the query**. This is rule 11 again, and note the shape it took: not a wrong
number, but a *correct* number computed over a population the code could not see
the boundary of. The predicate is now gone; the denominator comes back from the
server, which is the only thing that makes a gate possible.

**2. A recorded limitation does not restrain a published number.** The header
paragraph was titled "KNOWN LIMITATION, not fixed here" and ended "correcting that
is a separate pass". Everything in it was true and it stopped nothing. Rule 14
says convert a caught error into an impossible state rather than a comment; this
is the counter-example that shows what the comment version actually buys, which is
nothing. `refuseUnlessQuantilesAreObserved()` now sits upstream of every write
path, mirroring `sf.mjs` and `la.mjs`.

### What the gate measures, and which limb binds

Recomputed from the live feed on every run, through the script's own filters
(`job_type = 'New Building'`, `job_filing_number LIKE '%-I1'`, filed since 2022):

|  | measured 2026-08-09 |
|---|---|
| cohort | 1,040 filings |
| carrying an issue date | 662 = **63.65%** |
| p50 (`medianMonths`) | identified (needs > 50%) |
| p80 (`p80Months`) | **NOT identified** (needs > 80%) |

By filing year: 2022 **71.4%** (272/381), 2023 63.4% (206/325), 2024 57.0%
(162/284), 2025 46.8% (22/47). **Even the matured 2022 cohort fails p80**, so
narrowing the window does not rescue it.

This is **LA's shape, not SF's**: SF fails at p50 and has no median at all; NYC's
median exists and its p80 does not. The script publishes both, so it writes
nothing. Both extracts fail the same limb — 55% observed on 2026-08-06 and 63.65%
today — so the gate would have refused on either.

> ⚠️ **A passing p50 is not a good p50.** Identification is an existence
> condition. NYC's median clears the gate and is still ~2x below Kaplan-Meier over
> the same filings. The halt message says so explicitly, because the tempting next
> move is "the median passed, publish the median alone".

### Withdrawing is not publishing 15.9

The KM figure is **not a corrected version of the same measurement**. It rests on
an assumption about what the non-issued filings eventually do, and nothing here
has adopted that assumption — adopting one is a product decision for a person, of
exactly the kind this ledger says not to automate. Removing a wrong number is
finished work on its own. The failure mode to avoid is treating a withdrawal as
incomplete until a replacement exists, which is the pressure that produced 8.3.

### A retraction found while withdrawing (rule 17)

`nyc.mjs` asserted that the feed "does not distinguish a not-yet from a never".
True of SF's and LA's feeds; **false here**. It was copied in rather than checked
against NYC — disclosure copy is code, and this is the third instance of a claim
that is true in one file and false in the branch it lands in.

`filing_status` over the 378 in-window `-I1` rows with no issue date: Objections
155, Approved 151, **Filing Withdrawn 57**, Plan Examiner Review 7, On Hold –
Administrative Action 6, QA Failed 1, OnHold-NoGoodCheck 1. So 57 *are* terminal.
The withdrawal is unaffected — dropping them gives 662/983 = **67.3%**, still
failing p80 — but "state the SHARE, not the FATE" is a rule against asserting a
fate you cannot see, not a licence to assert that no feed records one. Corrected
in `nyc.mjs`, `README.md` and `cities.ts`.

The same pass fixed a live user-facing instance: Compare's Timeline tooltip read
*"This city publishes no permit application date."* True of Boston, DC,
Minneapolis, San Jose and Columbus. **False of NYC, SF, LA, Chicago, Atlanta,
Milwaukee and Charlotte** — every city withdrawn on a finding or refused by a
pipeline. One string cannot carry six reasons, so it no longer names a cause.

### An unresolved instrument question, recorded and NOT resolved

The committed n=4,403 **no longer reproduces from the feed under any framing
tried**. Measured 2026-08-09:

| recorded 2026-08-06 | measured 2026-08-09 |
|---|---|
| 19,319 permitted NB filings | **5,469** |
| 4,394 `-I1` | **914** |
| 14,029 `-S*` | **4,224** |

Resource id, dataset name, column set and `rowsUpdatedAt` are all current and
unchanged; the whole `New Building` population in `w9ak-ipjd` is now 13,353 rows,
roughly 3.5x smaller than the record. Running the script's exact query and
arithmetic over what the feed returns today gives **median 12.0 / p80 22.4 /
n=662**, not 8.3 / 17.0 / n=4,403.

**Cause not diagnosed, deliberately.** Rule 16 says a measurement contradicting a
known-good indicts the instrument first, and the reconciliation was run — count
and row-fetch endpoints agree, the suffix histogram sums to the count, two
isolated passes match (rule 10) — but that only establishes the probe is
self-consistent, not what happened to the feed. It is recorded here because a
future reader hitting the smaller cohort must not read it as contradicting the
shares above, and because it is a reason to distrust the 2026-08-06 extract and
**never** a reason to publish today's pair, which fails the same gate.

### Verification

- Gate fires on the live feed and **writes nothing**: `permitStats.json` is
  byte-identical by sha256 before and after `node scripts/permits/nyc.mjs`, which
  exits 1.
- Gate is **load-bearing**, not decorative: deleting the p80 limb from
  `PUBLISHED_QUANTILES` in a sandboxed copy makes the same run write
  `12.0 / 22.4 / n=662`. The refusal is the only thing stopping a write.
- `timeline.test.ts` asserts NYC resolves to no measurement and carries no
  "withheld for this size" record; the existing artifact↔list equality test is
  what would have caught a half-done withdrawal.
- NYC is deliberately **not** added to the `boston/dc/minneapolis/sanjose`
  no-application-date group — rule 5: those cannot be measured, NYC was measured
  and retracted, and the two must not render the same.

### The rule

**A limitation recorded next to a number does not restrain the number.** The
disqualifier was in the file, in capitals, above the query. It was written by
someone who understood it, and it was correct. What was missing was not knowledge
— it was a code path that could fail. Rule 14's "convert a caught error into an
impossible state, not a comment" has been stated as a preference; this is the
measurement of what the comment version costs: three days of a 2x error, served as
a measurement, on the largest city in the product.

Corollary, sharpening rule 18: **the strongest predictor that a wrong number will
ship is that it was produced by a query which cannot see its own denominator.**
Every city withdrawn so far — San Diego, Chicago, LA, SF, now NYC — had a `WHERE`
clause or a feed that selected on the outcome. The audit question is not "does
this number look right" but **"can this query compute the share of the cohort it
did not select?"** If it cannot, no result it produces can be checked.

---

## 2026-08-09 — Seattle withdrawn: the guard built to stop city 24 caught city 5

**Shipped:** `seattle.newConstruction` = **5.7 mo / p80 10.0 / n=4,996**, plus a
full `byTier` block (single 5.0/8.5, multi 6.3/10.3, apartment 10.4/18.5), from
2026-08-06 to 2026-08-09. Three days, in `permitStats.json`, on the result page's
"Measured permit time" card, in the Red Tape Index's Seattle story and as an
unmarked figure in Compare's Timeline row.

**Withdrawn** 2026-08-09, hours after NYC: removed from `permitStats.json` and
from `CITIES_WITH_MEASURED_PERMITS`, with the same structural refusal gate
(`refuseUnlessQuantilesAreObserved()`) added to `scripts/permits/seattle.mjs`.

### How it was found — nobody was auditing Seattle

The outcome-selection guard (`scripts/permits/outcome-selection.ts`, built
2026-08-09) exists to stop city 24 inheriting the issued-only predicate when a
new script is cloned from the nearest old one. Its registry refuses to exempt a
known carrier without a **measured** share attached — a `known-defect` entry must
state the size of the selection, not just its existence. Measuring Seattle's was
therefore the *price of exempting it*, and the measurement disqualified the
figure:

|  | measured 2026-08-09 (server-side, script's own cohort filter, both arms) |
|---|---|
| in-window applications | 6,980 |
| with the `issueddate IS NOT NULL` limb | 5,215 |
| hidden by the predicate | **1,765 = 25.29%** |
| observed share | **74.71%** |
| p50 (`medianMonths`) | identified (74.71 > 50) |
| p80 (`p80Months`) | **NOT identified** (74.71 < 80) |

The client-side gates (STFI, exact DADU) take the published n from 5,215 to
4,996; re-measured 2026-08-10 through the fixed pipeline the client-side cohort
is 6,760 with 5,009 observed = **74.10%**, same limb failing. This is LA's and
NYC's shape, not SF's: the median exists, the published p80 does not — it lands
inside the unobserved quarter, past the last observation. The script publishes
both, so it writes nothing.

**The guard was built for a hypothetical future defect and its first catch was
city 5 of the product** — a figure that had been live for three days. The
mechanism generalises: an exemption that must carry a measurement cannot be a
mute button, because writing it forces the check the exemption would otherwise
suppress.

### The disqualifier was in the file — again, and closer than NYC's

`seattle.mjs`'s own RESULTS block recorded, on 2026-08-06:

    aggregate      6746 filings, 4996 issued (74.1%)   median 5.7 mo   p80 10.0

The 74.1% and the p80 it unidentifies are **on the same line**. NYC's
disqualifier sat four paragraphs above its query; Seattle's sat in the same row
of the same table, written by the same pass that shipped the number. A recorded
limitation does not restrain a published figure (NYC's rule, second measurement),
and proximity does not help — what was missing was a code path that could fail,
not information. `pull()` carried `AND issueddate IS NOT NULL`, so `main()`
reproduced 5.7 faithfully and could not see the denominator its own header had
already stated (rule 11).

### The median is not republished alone — the Milwaukee reason

5.7 at 74.71% observed is a **conditional median** — time to issuance GIVEN
issuance — and the only field that can state the condition is `vintage`, which no
UI surface renders (`src/lib/realityCheck.ts` renders `medianMonths`, `p80Months`
and `n`; Compare reads `hasMeasuredPermitTiming`). A conditional figure whose
condition no surface shows is exactly why Milwaukee's cleanly measured
residential pair is withheld; Seattle's higher observed share changes the size of
the caveat, not its visibility. Republishing the median alone requires deciding
where the condition is SHOWN, which is a product decision for a person.

### Two things specific to Seattle, recorded so the next reader does not undo them

**The two arms do not average.** The pull is a union of a 'New' arm and a
detached-ADU arm, with observed shares ~17 points apart (measured 2026-08-10:
New 4,000/5,613 = 71.26%; DADU 1,009/1,147 = 87.97%). The gate refuses on the
pooled share — the published figure pools them — but reports each arm
separately, because the arm that dominates the union (~83% 'New') carries the
LOWER share, and a pooled 74% must not be read as if the DADU arm's 88% rescued
anything. Both arms' shares are measurable at all only because both gates are
filing-time (`permittypedesc`; `description`, populated on 2001/2001 non-issued
filings — the (A2) fix). The pre-(A2) ADU gate on `dwellingunittype` was null
for 100% of non-issued filings — an arm selected issued-only BY CONSTRUCTION has
no denominator and cannot even state its own condition.

**The tiers are further away than the aggregate, not closer.** The withdrawn
artifact carried byTier p50/p80s. Per-tier observed shares are only **bounded**
on this dataset (`housingunitsadded` is 58.2% populated on non-issued rows, so
720 non-issued filings assign to no tier): single 71.1–88.4%, multi 59.9–80.8%,
apartment 29.6–59.6%. No tier's lower bound clears 80, and apartment's interval
straddles 50 — whether an apartment-tier *median* even exists is indeterminate.
Clearing the aggregate gate would not license a byTier block; each tier's
lower-bound share has to clear each published quantile first.

### Verification

- Gate fires on the live feed and **writes nothing**: `permitStats.json`
  byte-identical by sha256
  (`96f220bca66bbc841b39635835daf4c1062aff4c8641513a0a4d924c6c0d4420`) before
  and after `node scripts/permits/seattle.mjs`, which exits 1.
- Gate is **load-bearing**, not decorative: deleting the p80 limb from
  `PUBLISHED_QUANTILES` in a sandboxed copy makes the same run write
  `5.7 / 10 / n=5,009` — reproducing the withdrawn pair almost exactly, which
  also confirms the withdrawn figure was precisely what the blindfolded query
  computes. The refusal is the only thing stopping a write.
- The stale-exemption rule closed the loop: with the predicate removed,
  `seattle.mjs`'s registry entry became stale by the registry's own test, so the
  exemption was deleted in the same change — a licence cannot outlive what it
  licensed.
- `timeline.test.ts` asserts Seattle resolves to no measurement and no
  withheld-tier record; the artifact↔list equality test guards the half-done
  withdrawal; Seattle is asserted unmeasured **by withdrawal**, not grouped with
  the no-application-date cities (rule 5).

### The rule

**A guard pays for itself on the cities you already trust, not the one you built
it for.** Every prior catch here required someone to point an audit at a city;
this one fell out of the guard's demand that an exemption carry a measurement.
The general form: when a check must be *fed evidence* to be silenced, silencing
it does the audit. Registries of exceptions should be designed so that writing
the exception is more work than fixing the defect — or at least the same work,
as here, where measuring the share WAS the audit that killed the figure.

And note the tally as of this entry: every city withdrawn so far — San Diego,
Chicago, LA, SF, NYC, now Seattle — had a `WHERE` clause or a feed that selected
on the outcome it published (the NYC entry's corollary, now six for six).
Outcome selection has a 100% hit rate on wrong-or-unidentified published
numbers. No unexempted `IS NOT NULL` carrier is left in `scripts/permits/`, and
the guard exists so there
never is one.

## 2026-08-10 — Relief odds double from two cities to four, and the caveat moves into the rendered line

`reliefStats.json` gains NYC (98.1% granted, n=210) and DC (97.4%, n=617). Both
are level changes, so this entry records the external validation that preceded
shipping, per the standing rule.

### NYC — the gate was nearly decided by a regex

BSA Applications Status (Socrata `yvxd-uipr`), framed on the ACTION date, which
is Boston's structure and the only auditable one here: the feed has no pending
value at all — an unresolved case is an absent row — so a filing denominator
cannot be counted. The tell, verified live: 31 of 36 cases filed in 2025 already
show Granted, implausible for a board with a 12–24-month cycle.

The published rate is the whole BZ track, labelled "variance and special-permit
applications". The narrower claim was refused for a reason worth keeping: strict
§ 72-21 variances are n=93 against the MIN_N=100 publication gate, and widening
the citation regex to include compound cites reaches exactly 102 — a pass by
two, decided by string matching. A publication gate cleared by a regex choice is
rule 15 wearing a different hat, so the honest options were the labelled whole
track or nothing. The window end is not a constant either: it is measured each
run as min(date) over rows still carrying the transient `Decision` status, so a
partially-coded session can never be scored.

Reconciliation: the survey's independent probe counted 209/4 unwindowed; the
published cohort is 206/4 with 3 granted rows on the excluded tail sessions.
The two agree exactly once the window rule is applied.

### DC — rows are not cases, and the caveat had nowhere to render

DCGIS BZA layer, `CASE_TYPE='BZA'` (ZC is 79k of the 105k rows and must be
excluded). The layer's 2,003 rows since 2022 collapse to 1,121 distinct cases —
publishing the row rate would double-count multi-row cases — and the published
figure is computed over 688 MATURED cases (filed ≥ 2 years before the run).
`DATEFILED` is the layer's only date, so the frame is a filing cohort — the
shape that had SF's rate retracted — but here it is disclosed, mitigated and
gated rather than hidden: residual unresolved is 1.5% against a 5% ceiling
(SF's hidden censoring was 21.7%), and the adversarial floor (96 · granted-if-
every-pending-denies = 95.9%) is written into the vintage on every run. The
script halts if any case carries conflicting ACTION_TAKEN values (measured: 0).

### The finding that applies to both: a label is load-bearing

The RealityCheck card hardcoded "variance requests" — true for Boston and SF,
false for BOTH new cities, whose rates mix variances with special permits and
special exceptions. Disclosure copy is code (rule 9 corollary), and a caveat in
a JSON string nobody renders is the exact defect that had five permit figures
withdrawn. The artifact now carries a `label` the card renders verbatim, and a
test fails the suite if NYC's or DC's entry ever drops it. The composition
caveat is in the user-facing sentence, not in a comment.

### Gates, verified with teeth

Both scripts refuse on recomputed conditions, exit 1, artifact byte-identical:
DC run with MATURITY_YEARS=0 refuses at 8.9% residual; NYC with `Dismissed`
removed from the status vocabulary fail-closed halts on the unrecognised value.
Both re-runs are idempotent.

Not done here, recorded: Milwaukee, Columbus, Charlotte and Atlanta have never
been relief-SURVEYED — their matrix cells read `not-built`, which is a statement
that nobody has looked, not that the data is absent. The survey is queued.

---

## 2026-08-10 — A status column that is a workflow state, and an absence that had to be corroborated

The four never-surveyed relief cities from the previous entry were surveyed
against the live endpoints. Nothing shipped — `reliefStats.json` is unchanged and
this is not a level change — but two of the four produced findings that outlive
the cities that produced them, and both are the same failure wearing opposite
clothes: a field that would have yielded a perfectly plausible grant rate and
never a null.

### Atlanta: a case-management `Status` column is a WORKFLOW state, not an outcome

Recorded regardless of whether Atlanta is ever built. This is the most portable
thing the survey produced.

Atlanta's BZA records live in Accela Citizen Access, and the search-result list
carries a `Status` column whose values read exactly like adjudications —
`Approved`, `Denied`, `App with Conditions`, `Denied w/o Prejudice`,
`App in Part/Den in Part`, `Withdrawn`. It is also cheap: one request per ten
records, no per-case fetch. It is wrong on two independent counts, neither of
them visible from the column itself.

**It is stale.** Cross-tabulated against the per-record "Public Hearing" workflow
task over 41 fully probed 2024 variances, **8 records whose list `Status` reads
"In Progress" carry a hearing task marked `Approved`**, and a ninth
`Approved with Conditions`. The list stops being maintained at the
results-letter/close step and nothing backfills it — the 2022 cohort still shows
23 of 130 (18%) as "In Progress" four years on. It also disagrees outright, not
merely lags: V-23-034 lists `Denied` while its hearing task reads
`Denied Without Prejudice`, and V-24-017 lists `Invoiced` while it was `Approved`
on 03/19/2024.

**It is a filing frame.** Over the full 2022–2025 enumeration (612 records)
`In Progress` is **251 rows — 41% of the column**. Scoring granted ÷ decided
across it is SF's retracted structure exactly, except SF's hidden censoring was
21.7% and this is nearly double.

So the column is **censored AND filing-framed simultaneously**, and what it
returns is a number in the right units and the right range, from a field named
`Status`, on the city's own system of record. That is rule 18 in pure form: the
dangerous output is the one that looks like an answer, and this field has no
failure mode that produces a null.

The mechanism is why this is here rather than in a city note. **On a
case-management system, a record-level status answers "where does this case sit
in our process?" — it is a workflow state, not an adjudicated outcome.** The two
are written by different steps, the list view is denormalised from the workflow,
and so they diverge *silently* the moment maintenance stops at close. The
adjudication, where it exists at all, sits one layer deeper on the task that made
it (`Public Hearing … Marked as <STATUS> on <MM/DD/YYYY>`) and carries its own
date, which the list column does not. Milwaukee is the identical architecture
with the trap defused: its list `Status` reads Complete/In Process/Void for
everything, so nobody could mistake it for an outcome. Atlanta's is the same
field populated with adjudication vocabulary. **Outcome words in a status column
are not evidence that the column records outcomes** — and the vocabulary is
precisely what makes the wrong field the tempting one.

### Columbus: an absence, and the corroboration is what makes it an answer

`BZA_STATUS` on the live BZA Zoning Variances layer holds exactly two values over
3,084 rows spanning 2004–2026: `PASSED` 2,982 and `PROPOSED` 102. Both sibling
layers agree independently — Council Zoning Variances `CV_STATUS` 2,008/100,
Graphics Code Variances `GC_STATUS` 765/35. **5,992 rows, three layers, two
states, and not one value in any of them that could express a refusal.** The
search was an enumeration rather than a hunt: all 65 datasets in the portal's
DCAT catalogue, and the whole 18-layer `BuildingZoning` and 34-layer
`Development` MapServers read from the service index rather than guessed at
(rule 8). Proposed → passed is a *publication-pipeline* state; the schema has no
outcome field besides this one, and no case or decision date at all.

**That much would still only establish that we could not find denials.** What
makes it an ANSWER is the sequence evidence. `CASE_NO` is issued sequentially as
`BZAyy-NNN`, and the layer is missing 8–32% of every year's numbers — BZA24 holds
152 of the 178 issued, BZA25 158 of 172, BZA22 152 of 180, BZA19 104 of 153.
Cases that never result in a mapped variance never enter the layer. **Denials are
not denied rows; they are absent rows.** Composed with the two-value domain, that
is the disqualifier: a grant rate computed here would be **100% by
construction** — not biased by an unknown magnitude, but 100% whatever the board
actually did, in the right units, with n in the thousands. Atlanta's trap
approached from the other side.

Independently disqualifying, so the verdict does not rest on the status field
alone: **there is no time axis either.** `CREATED_DATE` is a GIS record-creation
stamp, not a case or decision date — it puts 384 rows in 2009 and 539 in 2020
against a real caseload of ~130–180 cases/year, i.e. it records bulk loads.
`LAST_EDIT_DATE` differs from it on 3,008 of 3,084 rows, median lag 56 days and
maximum 6,181 — an edit history. Even if an outcome field appeared tomorrow there
would be nothing to frame a cohort on. Columbus's real outcomes sit per case
behind `WEB_LINK` → Accela, which is Chicago's posture: a per-case scrape, not a
dataset.

### Milwaukee and Atlanta are feasible only by scraping, and that dependency was declined

Both cities' outcomes are reachable, by the same mechanism on the same
third-party host (`aca-prod.accela.com`; agency `MILWAUKEE`/module `Development`
and `ATLANTA_GA`/`Planning`). A per-record workflow task carries both the ruling
and the date it was made, so a Boston-shaped decision-date frame exists in each
and unheard cases drop out by construction. Roughly 1.5–2 days of work per city,
and ~2 hours of wall clock per run behind HTTP 429, which appears after about
40–60 request pairs.

**The owner declined that dependency class, and the reason belongs in the
record.** Every other source in this project is an official API or an open-data
feed. A scraped ASP.NET Citizen Access portal — viewstate, mandatory
`Referer`/`Origin` CSRF headers, a session-bound page method, control-id-dependent
parsing — differs in kind rather than degree, because a markup change breaks it
**silently**: the scrape goes on returning well-formed rows, just fewer or
different ones. A dependency that can begin returning wrong data without ever
erroring is worse than a gap, and this gap is currently honest. It is rule 5 one
level up: a failed fetch must never quietly become a substantive answer, and here
the failure would not even present as a fetch failure.

If it is revisited, the condition is structural and not advisory — a check that
**fails loudly on markup drift**: record counts reconciled against the record-
number sequence, the outcome task asserted present, a fail-closed status
vocabulary that halts on any unseen value, and a hand-count of one hearing's
dispositions against the boards' own published minutes as the external check
(rule 9, the only outside measurement available on these numbers). A comment
saying to watch for drift is exactly what rule 14 rejects.

Their coverage cells stay `not-built`, which is accurate: nobody built them. That
is a different statement from Columbus's, and the two must not render alike.

### What this leaves

Charlotte surveyed **feasible** and is queued rather than published: the UDO
Board of Adjustment track on the city's ArcGIS `ZoningVarianceAppeal` layer,
92.4% over 157 decided cases 2022–2026, framed on the written-decision date that

> ⚠️ **SUPERSEDED the same day — the survey's figures did not survive the build.**
> Published as **92.3% over n=155**, not 92.4%/157: the two compound dispositions
> (`Granted (3)`, `Granted-Appeal Pending`) are excluded, and that exclusion is
> what produces the [90.7%, 92.6%] bound quoted below. The survey's pooled-track
> comparison (~96.9%) also failed to reproduce; the measured figure is 96.4%. See
> "The threshold came from the failure's shape, not from the peer city".
> Everything else in this paragraph stands, including the frame and the leakage
> gate.

The rest of the survey's account, unchanged: framed on the written-decision date that
external validation against the Board's own signed minutes established is *not*
the hearing date (UDO 37.8.A.15 — the letter lags the vote by 9–20 days and once
by ~3 months), and shipping only behind a leakage gate, because reading those
minutes also turned up a whole Board session whose letter dates were never
entered. Columbus is a **verified no** with a reason string ready for the
coverage matrix; applying it is a separate change, as this one touches only the
ledger and `scripts/relief/README.md`, where all four per-city verdicts now live.

### The rule

**A status field is a claim about a PROCESS; only a decision field is a claim
about an OUTCOME — and the two findings above are that sentence read from
opposite ends.** Atlanta's column answers "where is this case in our workflow?"
in outcome vocabulary; Columbus's answers "did this variance get mapped?" in a
two-state pipeline vocabulary. Neither is an adjudication, and both yield a
plausible rate rather than a null. Before scoring any status field, ask what STEP
writes it and what would make it change: if the answer is "an office process
advanced" rather than "a body ruled", it is not an outcome no matter what its
values spell.

Corollary, and the reason neither finding could have come from reading the
schema: **enumerating a field's values is never enough to score it.** Atlanta
needed a cross-tabulation against a second field to reveal that the column was
stale; Columbus needed the case-number sequence to reveal that denials were
missing rows rather than missing values. Rule 9 holds inside a single feed — in
both cities the check that discriminated compared the field against something
outside it.

## 2026-08-10 — The threshold came from the failure's shape, not from the peer city

Charlotte's relief odds shipped at 92.3% (143/12), n=155. Three things about how
it was built are worth more than the number.

### The builder measured instead of inheriting

The brief handed the build agent the survey's figures: 92.4% over 157 cases, and
a pooled-track comparison of ~96.9%. It reproduced neither exactly and said so:
n=155 rather than 157, because the two compound dispositions `Granted (3)` and
`Granted-Appeal Pending` are excluded — and that exclusion is precisely what
produces the [90.7%, 92.6%] bound. The staff track's 99.2% reproduced; the pooled
96.9% did not, measuring 96.4%.

Its own sentence is the point: *"I report what I measured; the brief's 99.2% for
the staff track reproduces, the pooled figure does not."*

That is the builder/checker separation happening **inside a single agent**, and
it is not the default. The path of least resistance for any builder handed a
number is to transcribe it — the brief is upstream, it looks authoritative, and
a matching figure never gets questioned. Two of this session's live defects
reached production exactly that way: a claim in a header copied into a second
file, and a survey's summary trusted over the artifact. **A brief is an input to
be measured, not an authority to be satisfied**, and briefs should say so
explicitly, because agents will otherwise resolve a discrepancy in the brief's
favour and never report it.

### The threshold was derived, not copied

DC's residual gate ships at a 5% ceiling. The obvious move — and the one that
would have passed review unremarked — was to reuse 5% for Charlotte. It ships at
**4%**, and the reason is structural rather than aesthetic.

Charlotte's leakage is **directional**. The February 25 2025 session's three cases
sit in the feed marked `Granted` with a NULL `Decision_Date`; every case the date
frame drops is a *grant*, so the residual can bias the published rate in exactly
one direction. DC's residual is a mix of pending and closed cases with no
established skew, so a 5% ceiling there is a symmetric tolerance. A directional
residual of the same size is a worse defect than a symmetric one, and it compounds
in a known direction as more sessions go undated.

So the ceiling was set to fire on the **second** occurrence of the defect rather
than the tenth. 4% is not "a bit tighter than DC" — it is the number at which one
more missed session trips the gate.

The general form: **a threshold copied from a peer city inherits that city's
error structure along with its number.** Two gates can carry the same tolerance
and mean different things, and which one is right depends on whether the thing
being tolerated is symmetric. Ask what shape the residual has before choosing its
size.

### The drift guard closed the loop, and neither agent could ship alone

The build agent finished with one test failing that it deliberately did not fix:
`coverage.ts` still assigned Charlotte's relief cell
`RELIEF_NEVER_SURVEYED_AUG8` — "Never surveyed … A gap, not an answer" — which
had become false in both halves the moment the artifact gained a `charlotte` key.
It flagged the failure and left the file alone; the matrix agent deleted the
entry.

This is the invariant from `coverage.ts` doing the work it was written for: every
(city, dimension) must be derived-present or carry exactly one reason, never both.
**Landing the data made the stale reason a test failure rather than a stale
comment.** The builder could not ship without the matrix owner, and the matrix
owner could not have known to look without the builder's failure. Compare the
2026-08-08 integrator, which wrote a retraction into `hurdles.ts` and died before
the same retraction reached `cities.ts` — nothing failed, and the false comment
survived until a human re-read it.

A comment documents a decision. A structure makes the contradiction unshippable.

## 2026-08-10 — The record gets an anchor

Three times in one day a ledger entry went stale within hours of being written.
The last: a survey entry quoting Charlotte's relief rate and sample size, both
superseded by the build's figures the same afternoon (see the annotated entry
above; the figures are deliberately not restated here — quoting a superseded
tuple in live prose is precisely what this guard exists to stop). Each was caught because a human happened
to be re-reading nearby. That is not a mechanism.

The supersede-pointer convention is sound and was never the problem. The problem
is that it only fires on a re-read, and nobody re-reads 4,000 lines. Compare
`coverage.ts`, where a stale reason is a test failure because it is checked
against an artifact — ledger prose had no such anchor.

`src/config/ledgerFigures.test.ts` gives it one: for every city currently in
`reliefStats.json` or `permitStats.json`, any figure quoted **as current** must
match the artifact.

### The engineering was the discrimination, not the comparison

A ledger is SUPPOSED to contain stale figures — dated history is its function.
"NYC published 8.3 / p80 17.0 / n=4,403 and we withdrew it" is correct and must
never fail. So the guard cannot ask "does any number disagree"; it must separate a
figure asserted as current from one recorded as past. Four decisions do that, and
the second does most of the work:

1. **Scope by artifact membership, per dimension.** A city absent from the
   artifact is history by construction. NYC is the case that forces *per
   dimension*: it is live in relief and withdrawn in permits.
2. **Only a published-figure TUPLE counts as a citation** — a rate or median
   bound to its sample size, within 60 characters, no sentence break between.
   The ledger is full of loose numbers about live cities (proposals, comparisons,
   not-yet-applied KM figures); requiring the `n` excluded every one of them
   **without a single exemption**. That is what made the guard viable.
3. **Attribution is section-scoped** — the last city named at or before the
   figure since the nearest heading.
4. **History is marked by the ledger's OWN conventions**, not a new one: an
   adjacent `⚠️ SUPERSEDED/WITHDRAWN` blockquote, being that blockquote,
   strikethrough, or an in-block restatement — and the restatement escape
   additionally requires the block to carry a citation that MATCHES the artifact,
   so it cannot be used as a blanket pass.

### It passes clean, which is the part that decided it

Zero exemptions, zero suppressions, no edit to the ledger required. The
instruction was explicit that a pile of hand-written exemptions would be evidence
the discrimination did not work and grounds to abandon it — a guard that cries
wolf gets deleted, and a deleted guard protects nothing.

Eleven citations found: eight current (all matching), three correctly classified
as history. Verified not to fire on NYC's and Seattle's withdrawn permit figures,
LA's, Chicago's, San Diego's, or SF's pre-restatement 97.6%.

The hardest case is worth recording because it is the incident that prompted this:
L4177 quotes the survey's superseded rate and sample size with no marker at all. It does not
fire, because section-scoped attribution finds no city in its heading — and that
is substantively right, since the sentence quotes *a brief*, not the artifact.

### Known coverage gap, stated rather than papered over

Boston relief and five of six permit cities have **no published-figure citation
anywhere in the ledger** — every stored `n` was grepped; the prose never states
them with a sample size. They are unguarded until someone quotes them properly.
That is a gap in what the ledger says, not a defect in the guard.

### The guard guards itself

Rule 11 applies to instruments, so the test pins the exact citation inventory and
the three history classifications with the signal that produced each. A regex that
silently stops matching, or a history rule that widens to "everything", goes RED
rather than green — the failure mode that makes a checking tool worthless.

Corollary worth carrying: **the plausible result sails through, and a brief
supplies the plausibility.** An agent handed a number has no incentive to measure
it — matching reads as success, contradicting reads as error, and the asymmetry
runs toward transcription. This is rule 18 one layer over, and the same asymmetry
is why a stale ledger figure survives: it agrees with what the reader already
believes.

### It fired on this entry, within minutes, and one hit was a real weakness

Writing the paragraphs above tripped the guard twice — the first thing it caught
was prose *about* stale figures. That is the intended discipline: a superseded
tuple quoted in live prose is indistinguishable, to any reader or any scanner,
from a current claim. The fix was to name the figures' existence without restating
them, which is what the surrounding text now does.

The second hit is a genuine limitation and is recorded rather than smoothed over.
The same quoted tuple was attributed to **San Francisco**, because SF was the last
city named earlier in that section — the figure belongs to Charlotte. **Attribution
is positional, so a paragraph discussing several cities can bind a figure to the
wrong one.** It fails in the safe direction (a spurious mismatch, never a silent
pass) and it did not require an exemption here, but it means the guard is not
trustworthy as an *attribution* mechanism — only as a contradiction detector. A
future entry that legitimately compares two live cities' figures side by side will
hit this, and the fix at that point is per-figure attribution, not a suppression.

Recorded now because the alternative is discovering it later and reading it as the
guard being wrong. It is right about the contradiction and unreliable about whose
contradiction it is.

## 2026-08-10 — Every live figure now appears in the record, with its sample size

The drift guard shipped with an honest hole: it can only check figures the ledger
actually quotes, and six of the eleven live published figures appeared nowhere in
it with a sample size. Boston's relief rate and five of six permit medians were
running on the site with no entry a reader could check them against.

That is not a guard defect. It is the ledger being incomplete on exactly the
numbers it exists to track — and it is worth noticing that the omission was
invisible until something tried to read the record mechanically. A human auditing
the site against this file would have found nothing to audit.

Quoting each once, properly, closes it: every published number is now under the
guard, and the ledger's coverage matches the artifact's.

### Boston — zoning relief

**92.7% granted, n=3,820 decided cases**, 2022–2026 (3,542 granted / 278 denied).
`data.boston.gov` Zoning Board of Appeal Tracker, framed on the DECISION date —
`final_decision_date >= 2022-01-01` — so a pending case has no decision date and
is excluded by construction rather than by censoring. This is the structure every
later relief city was measured against, and the one SF had to be restated onto.
Withdrawn and deferred are excluded; `AppProv`/`Approved` count as granted.

### The five uncited permit medians

All are filing→issuance for ground-up new construction, all conditional on
issuance, all floors unless stated otherwise. Tiered in the table form the Austin
entry established, because that is the form the drift guard reads — prose tier
lists are compared against the aggregate and fail.

**Denver.** The `multi` tier is suppressed below the n=30 publication floor, and
`measuredFor` returns undefined for it rather than the aggregate — the fail-closed
case that prompted `tierBreakdown`.

| tier | median | p80 | n |
|---|---|---|---|
| single | 5.4 mo | 12.2 | 3,505 |
| apartment | 5.3 mo | 10.8 | 628 |
| *aggregate* | *4.5 mo* | *11.1* | *6,922* |

**Miami.** The widest apartment-to-single spread in the set, and the only city
whose aggregate sits between two tiers rather than near the largest.

| tier | median | p80 | n |
|---|---|---|---|
| single | 11.3 mo | 17.9 | 511 |
| multi | 11.0 mo | 18.7 | 291 |
| apartment | 20.2 mo | 28.4 | 189 |
| *aggregate* | *12.6 mo* | *21.4* | *991* |

**Nashville.** Window starts 2023-08-01, not 2022 — the only city on a short
window, because the feed's earlier records carry different application-date
semantics. The 2.7× single-to-apartment spread is why the aggregate alone would
mislead a multifamily user.

| tier | median | p80 | n |
|---|---|---|---|
| single | 1.1 mo | 2.4 | 5,431 |
| multi | 2.2 mo | 4.5 | 452 |
| apartment | 3.0 mo | 7.0 | 570 |
| *aggregate* | *1.2 mo* | *2.8* | *7,796* |

**Philadelphia.** No tier breakdown: the feed supports no size split, so
`tierBreakdown.attempted` is false and the aggregate is the answer for every tier
rather than a fallback hiding a suppression. Tabulated anyway, with one row —
written as prose it was invisible to the guard, which reads permit figures only
from tables.

| tier | median | p80 | n |
|---|---|---|---|
| *aggregate* | *3.0 mo* | *6.3* | *3,766* |

**Raleigh.** The one figure in the set that is **not a floor** — its feed carries
non-issued rows, so the 90.7% issuance rate is measured rather than assumed. 3,803
townhouse per-unit child permits sit in the aggregate and in no tier, a known and
disclosed gap.

| tier | median | p80 | n |
|---|---|---|---|
| single | 1.4 mo | 2.7 | 3,005 |
| multi | 3.5 mo | 7.1 | 166 |
| apartment | 4.5 mo | 8.3 | 501 |
| *aggregate* | *1.8 mo* | *3.2* | *7,475* |

### What this does not fix

Citing a figure is not verifying it. These six are now checkable against the
artifact and will fail the suite if either drifts — but the guard compares the
ledger to `permitStats.json`, and both being wrong together is exactly the class
of error internal verification cannot catch (rule 9).

### And the citation form itself is now load-bearing

Writing these as prose (`Tiers: single 5.4 / 12.2 / n=3,505`) failed: the guard
read each tier figure as a claim about the city's aggregate and reported eleven
contradictions. The table form the Austin entry happened to use is the form the
parser understands, so it became the convention by accident rather than by design.
That is worth stating plainly — **a record whose correctness depends on its
formatting has a trap in it**, and the next person to add a city will write prose
and hit the same wall. The honest options are to document the form (done here) or
to teach the parser prose tiers; the cheap one was taken, and the cost is a
constraint nobody would guess.

## 2026-08-10 — A measured lifecycle for the remaining 8 is not buildable, and that closes the decision

The open question was build-vs-gap: eight cities carry no `lifecycleMonths` row,
and three candidate legs were proposed to compose one. The answer is **NOT
BUILDABLE**, and it is settled by measurement rather than by preference — the
survey went looking for the source at the level the claim is published at, and
it is not there.

### The decisive result is a reconciliation, not an argument

The legs can be argued about forever. What ended it was composing them against
cities that already carry **both** a hand-calibrated `lifecycleMonths` row and a
measured filing→issuance leg, and checking whether the composition lands where
the shipped constant already sits.

It overshoots. Denver composes to 15.9 months against a published 15, Miami to
20.4 against 18 — for two of the four cities that can be checked, the three
measurable legs consume the entire published lifecycle **with no room left for a
design phase at all**. For the other two the residual runs the other way, and it
is large: the unmeasurable front and back ends are roughly a quarter to a third
of the published single-family number. Legs A (design / pre-application) and E
(completion → move-in) have no candidate source anywhere in the survey, and the
reconciliation says that is where a third of the answer lives.

So the composition does not reconcile with the 15 rows already shipped. Putting
leg-composed numbers for 8 cities into the same column as 15 hand-calibrated ones
would put two mutually inconsistent methods in one field, and
`computeRedTapeIndex` ranks across that field.

There is a second disqualifier of the same kind: `permitStats.json` publishes
**medians**, Census SOC publishes **means**. A median added to two means is
neither statistic, the skew bias differs by leg, and neither source publishes the
other's form. Rule 3 in its purest shape — a composite whose citation sits on one
component.

### Leg B — filing→issuance — closes at 1 of 8, permanently

Raleigh is the only city with a measured, published filing→issuance leg. The
other seven are closed by facts about the jurisdiction or the feed, not by
insufficient probing: Charlotte publishes no building-permit dataset at all
(established by enumerating the portal's own 300-dataset catalogue, a verified
absence rather than a guessed 404), Phoenix publishes no per-permit dataset,
Columbus and Las Vegas have **no intake-date slot**, Atlanta has an application
date and no issue date. Two more — Milwaukee and Dallas — are *held*, not absent:
the repo holds computed figures and refuses to publish them, Milwaukee because
5+-unit multifamily files as commercial against a free-text use field that
`refuseUnlessEnumerable()` rejects, Dallas because its only both-dates feed is a
terminal snapshot of a retired system that can identify a median but never a p80
and **cannot mature**. Neither refusal is closable by re-probing. This leg is
finished at one.

### The "encoded review clocks" leg is not a leg

Across the five in-scope cities that have a hurdles branch, **85 researched rows
carry zero `addsMonths`**. The other three cities have no branch at all. That is
not an oversight — each branch carries an argued, written refusal, five of them,
and they all say the same thing: every duration these cities publish is a *shot
clock on the city*, an *appeal or filing window*, or a *deferral ceiling*. None
is a duration of work. Publishing a ceiling as an expectation is rule 6 in the
time dimension.

The structural point is stronger than the count. `timeline.ts` computes the
baseline and `analyze.ts` adds discretionary hurdle months **separately, so they
are not double-counted**. Hurdle months are by construction the thing added *to*
a lifecycle; they cannot also be a component of one. The only `addsMonths` any of
these cities can reach are shared conditional adders — historic design review,
replacing existing housing, public funding — every one of which fires on top of a
baseline that this exercise was trying to produce.

### Census SOC is real, federal, and region-only — which is exactly the problem

The Length-of-Time series exist and were read in full, not guessed: average
authorization→start and average start→completion, from the Survey of Construction.
They are published for the United States and the four Census Regions. **That is
the entire geography** — there is no state, division, metro or city panel, and
the slot test passes positively rather than by failure to find one: SOC samples
roughly 900 permit-issuing offices at about 1 in 50 and states that estimates are
produced at the national level and by region. A city figure does not exist and
cannot be derived, because the sample does not contain enough of any one city to
make one.

Four of the eight in-scope cities sit in the South and would receive an
**identical** construction leg. A leg that cannot distinguish Raleigh from Dallas
carries zero city-discriminating information — which is the entire content of a
*city-specific* lifecycle, and the thing the index ranks on. Applying a
South-region duration to Atlanta is rule 4 with a federal citation on it: six
months from now it is indistinguishable from a measured Atlanta figure.

Three further defects, any one of which would be disqualifying on its own:

- **The tiers do not map.** SOC has no 5+ column — only 2–4, 5–9, 10–19, 20+.
  Producing an apartment figure means combining three columns with weights Census
  does not publish (an invented conversion, rule 4); using "Total 2 or more"
  instead silently imports 2–4-unit buildings into the apartment tier.
- **The single-family column requires choosing a program the user has not
  chosen.** SOC splits 1-unit by purpose of construction and the columns differ
  by about three months. That is rule 6.
- **The multifamily cells are unusable exactly where they are needed.** The
  Midwest 2–4-unit start-to-completion cell — the `multi` tier for Milwaukee and
  Columbus — carries a relative standard error of 57. The Midwest 5–9-unit
  authorization-to-start cell carries 212, and the same panel contains a
  published *negative* duration. The noise is not hypothetical.

SOC is admissible only as an explicitly-labelled regional context line. It is not
a component of a city-specific published number.

### Even the one good leg measures a different unit of analysis

Raleigh has a real city-specific leg and still does not get there. Its own
extraction artifact records **"THE ROW IS NOT THE PROJECT"**: 51% of the sample
is per-unit townhome child permits, and a further slice of the apartment tier is
per-building children of a larger development. The measured leg is a
**permit-level median**; a lifecycle is a **project-level duration**. Composing
it with two regional averages would give Raleigh a number that is one part
city-measured-at-the-wrong-grain and two parts 16-state average.

### The consequence, stated plainly

The eight cities keep an honest gap, and the gap note stands unchanged. Its
sentence — *"Removing this gap needs a real source, not a session"* — was an
assertion when it was written and is now a measurement. **This is a settled
answer, not an open decision**, and it is recorded here so it is not reopened as
though nobody had looked. Rule 5 applies to the backlog as much as to the
renderer: a closed question and an unexamined one must not look the same.

## 2026-08-10 — The 2026-08-06 batch reproduces, which bounds the NYC problem to one resource

NYC's permit figure did not reproduce and was withdrawn. The open worry was
contagion: fifteen committed figures across four cities share its extraction
date, and "same run date, same doubt" is a plausible hypothesis that no amount of
re-reading the scripts could settle.

**All 15 reproduce.** So do the two nearest-neighbour extracts on either side.
Every difference observed is a feed that **grew** — a few days of accretion, with
medians and p80s landing on the same value or one rounding step away. **No feed
shrank, no resource was re-keyed, and no filter changed semantics.** The
hypothesis is disconfirmed for this date by direct measurement rather than argued
away.

That relocates the NYC problem: **it is resource-scoped, not date-scoped.** Its
shrink re-probes today at exactly the figure recorded when it was withdrawn —
stable and real — and no other city's feed shows the shape. Sharing a run date
with it is not a risk factor.

### The method is why the answer is trustworthy

Rule 11. Hand-rewriting each city's query would have measured the reader's
understanding of the script, not the pipeline the figure came out of. Instead
every script was **copied byte-identically into a mirrored scratchpad tree**, with
SHA-256 compared against the repo original before running. Each script resolves
its output path relative to its own module URL, so running from the mirror sends
the write outside the repo while the query, the paging, the gates and the
arithmetic all execute unmodified. The real entry point ran; only the destination
moved.

The two Nashville variants are the exception and are labelled as such — each a
one-line diff from the verified copy, existing only to separate "the guard fired"
from "the number moved."

### Nashville failed CLOSED, which is the guard working

Run unmodified, Nashville refuses to publish. Its feed is a rolling ~3-year
window whose left edge has slid five days past the committed start date, and the
script detects that and stops rather than quietly publishing a differently-framed
figure. Run in both frames — the committed one and the one a legitimate re-run
would use today — the published pair is the same. The figure is invariant to the
shift, and the only structural change anywhere in the cohort announced itself
instead of hiding.

### One comment made the whole question decidable in a single request

Distinguishing "the feed grew" from "the feed shrank" needs a row count from
*before*. Nashville's script records one in a comment, at extraction time. One
`returnCountOnly` request against that number settled the grew-vs-shrank call for
the city whose guard had just fired — the layer is at steady state, a rounding
error off its recorded size, against NYC's several-fold move.

**No other script records a feed row count at extraction time.** A single comment
is what made this answerable in one pass; without it the call would have rested
on inference from the figures themselves, which is the thing under suspicion. A
committed row-count-at-extraction beside every figure would have answered this
entire question **without re-running anything**. It is a one-line practice with
an outsized payoff, and it is worth adopting everywhere.

### A rule 10 case that sharpens rule 10

Philadelphia's first two passes both died on the ArcGIS paging step with an
`Invalid query parameters` 400; the third succeeded and produced a clean
reproduction. Recorded on the first result, that would have gone down as a
Philadelphia endpoint regression. Note the shape carefully, because it is not
"re-probe until it agrees": here the *majority* of passes failed. The rule is
that a single failure is not evidence, and that **a success proves the query is
valid** — the asymmetry is in what each outcome can establish, not in a vote.

## 2026-08-10 — Two instrument failures, caught by their own authors, in one session

Worth recording together because they are the same failure wearing different
clothes, and neither was catchable downstream — both produced well-formed output
of exactly the expected shape.

The first: counting `addsMonths` per city returned a clean **zero rows, zero
`addsMonths`, for every city** — including cities that plainly have both. The
cause is that zsh does not word-split unquoted parameter expansions, so the
range variables were empty and `awk` read whole files with no range. A shell
measured nothing and reported a tidy zero. The real counts came from Node.

The second: a comparison run after a `cd` resolved *both* sides — "committed" and
"today" — to the same scratchpad file, so Nashville appeared to match itself
perfectly. Re-run with absolute paths on both sides, the real comparison
followed.

### The rule: rule 18, pointed inward

**A measurement that agrees with what you already believe gets less scrutiny than
one that surprises you.** Rule 18 says a plausible answer draws less scrutiny than
a gap; this is the same asymmetry applied to your own instrument. The zero
flattered the conclusion its author was already reaching — that this leg does not
exist — and a confirming measurement is exactly the one nobody re-runs. The
perfect self-match flattered the reproduction it was meant to test.

**The tell in both cases was a result that was too clean.** An exact zero across
five cities that differ in every other respect, and a perfect match across four
days of feed accretion in a feed known to grow. Cleanliness is not an alarm the
way a suspicious number is — which is why it has to be checked without waiting to
feel suspicious.

Both were caught and reported by their authors. That is the part to keep: rule 9
says external comparison finds the defects, and the closest thing to an external
check on your own instrument is asking what result the instrument would produce
if it were doing nothing at all. In both cases, the answer was *the result it
produced.*

### A closed gap, recorded so it is not read as drift

Denver's suppressed `multi` tier count was committed as unknown, because the
original run logged it to the console and wrote nothing to the artifact —
recovering it required re-running the extraction. Today's read-only re-run
emitted it: **18**, below the 30-row publication floor, so the suppression
decision was correct and the artifact is right as it stands. Nothing was edited.
This is a gap closing, not a figure drifting.

## 2026-08-10 — Two defects that had each been fixed three times without being named

Building the deliberate-absence guard surfaced two patterns that were already
solved, repeatedly, in isolated places. Neither was written down, so each fix was
rediscovered rather than applied. Both are now standing rules.

### The empty-set pass, third instance

The guard as first written asserted that no city named as absent appears on the
list it sits above. Correct — and it would have gone green the moment the notes
stopped naming anyone, including because somebody deleted them. A guard whose
subject can vanish reports the vanishing as success.

That is the third instance of one shape:

| instrument | how it passed on nothing |
|---|---|
| `check-citations` | printed PASS over zero checkable URLs |
| the FAR extractor | reported "no FAR stated" for districts it had failed to read |
| the absence guard | would go green if the notes named no city at all |

Each was fixed the same way and none of the fixes knew about the others:
`check-citations` cannot print PASS while any file is unchecked; the extractor
learned to distinguish a stated absence from a failed read (which became rule 5);
the absence guard now fails if neither note names a city, with a message telling
the reader to delete the block deliberately rather than leave something that can
only pass.

**Green means "nothing to report" and the reader hears "nothing wrong."** It is
rule 5 inside the instrument — an empty result and a clean result must not render
the same. Now rule 20, with the fix stated so the fourth instance is prevented
rather than rediscovered: assert the input set is non-empty and pin its size or
membership. Pinning also catches the opposite failure, a regex that silently
stops matching, which is the one that makes a checking tool worthless.

### A retraction that quotes itself, second instance in a day

Writing the ledger entry about stale ledger figures tripped the ledger figure
guard, because the entry quoted the superseded tuple verbatim. Hours later,
correcting the `cities.ts` note about stale notes tripped the absence guard, for
the same reason: the correction restated the retracted sentence in live prose.

Both times the correction was true, adjacent to the claim, and clearly framed.
Both times it read to the scanner — and would read to most humans, who see the
sentence before the frame — as a live assertion of the thing being retracted.

So rule 17 was not sufficient as written. Propagating a retraction to every site
does not help if the retraction reproduces the claim at each site. **Describe the
retracted claim; do not restate it.** Now rule 21.

Worth noting what caught both: the guards, on their own authors, within minutes.
Neither was found by review.

### The over-broad first version, and why it mattered

The absence guard's first version matched city slugs across the whole note and
reported five hits where one was real — the four false positives were cities named
in the *withdrawal* paragraphs, which are absent and investigated. Scoped to the
`⚠️` block making the claim, it reports exactly `dallas`.

Recorded because the failure mode is not "slightly noisy": a guard that flags true
negatives is read as broken and then ignored, which is strictly worse than not
having it. The same reasoning set the ship-or-abandon criterion for the ledger
guard — zero exemptions on the current file, or narrow it.

## 2026-08-10 — Two suppressions on one file, and a probe that destroyed what it measured

### Fixing the visible defect would have shipped the file as resolved

`netlify/functions/lib/envelope.test.ts` imported `ParcelInfo` from a path two
directories up where every sibling uses three. Because it is an `import type`,
esbuild erases it and vitest never complains, so the type resolved to `any` and
every fixture annotation in the tests covering the FAR/height→envelope module —
upstream of the verdict, the cost and the unit count — was vacuous.

That is the defect a diff shows. Fixing it alone would have changed nothing,
because the same file also carried five casts: an `as ParcelInfo` on the factory's
return and four `as never` on the zoning fixtures. **Either suppression alone
leaves the fixtures unchecked, and repairing the obvious one makes the file look
fixed.** Same shape as the Denver table entry that survived a fix correcting both
pattern branches: the repair was real, and the thing being repaired was not the
only thing wrong.

Measured, in three states, by injecting a wrong field name and asking what
TypeScript says:

| state | wrong field name caught? |
|---|---|
| broken import + casts | no — nothing to check against |
| import fixed, casts present | only against the local helper's inline shape, never `ParcelInfo` |
| import fixed, casts removed | **yes — TS2561** |

**The check is the deliverable, not the fix.** Compiling clean under a restored
boundary proves the file has no errors; it does not prove the file has any
constraints. When the 63 excluded test files come under a checker, each one needs
the injection, not just a green build — a file can compile perfectly and assert
nothing, for exactly these two reasons.

### The probe destroyed the work it was measuring

The first probe config was written to `/tmp`, so it could not resolve
`@types/node` and returned a single unrelated error. Both the clean run and the
injected-typo run produced that same error, which "proved" nothing — measuring the
probe, not the file, for the fifth time in this ledger.

The recoverable part was the config. The unrecoverable part was reverting the
injected typo with `git checkout -- <file>`, which also discarded an agent's
**uncommitted** fix to that file. Nothing warned; the working tree simply lost it.
It was reconstructible only because the agent had described its edits in a report.

**The rule: the working tree is shared state, and `git checkout` is a destructive
write to it.** Never revert a file another agent is or was editing, and check
`git status` for uncommitted work before any checkout, stash or reset. When a
probe needs to mutate a file, restore it by inverting the exact mutation — not by
reverting to HEAD, which throws away everything else in the file that is not yet
committed. The blast radius of `checkout -- <file>` is the whole file, not the
change you made.

Corollary for probes generally: put a scratch tsconfig **inside the repo** so it
inherits module resolution, and delete it afterwards. A probe that cannot resolve
the project's own types is not a weaker measurement, it is a different one.

## 2026-08-10 — 1,922 fixture paths, and the number that was nearly written down

`tsconfig.scripts.json` covered `scripts` and `netlify` but carried
`exclude: ["**/*.test.ts"]`, so 63 test files — 79% of the repo's tests — were
typechecked by nothing. Closing that exclusion, and fixing
`tsconfig.node.json` to include `*.config.ts` by GLOB rather than by a second
filename (include-by-name is what produced the original gap), brought them under
the checker.

The sweep reported **63/63 files reject an injected wrong field name**. That was
true, and it is the wrong number.

### Why the file-level number is nearly meaningless

Three separate weaknesses, each found only by asking a harder question:

**Nineteen of the 63 files have no object fixture at all.** They are scalar
parsers — `parseMaxFAR`, `resolveMinneapolisFar`, `mapZoningUse`. There is no
field name in them to misspell, so "rejects an injection" is *vacuously* true.
That is rule 20 turned on the sweep's own denominator: a check passing over an
empty set, reported as a pass.

**A file is not a unit of coverage.** `envelope.test.ts` was hand-injected
earlier the same evening, correctly, and passed — its `info()` factory rejected a
misspelling. The file was still inert in a second place: an un-annotated `const
base` spread into the call, so the whole `storiesBasis` block accepted anything.
That block is the rule-12 regression suite pinning the Miami 87-stories defect.
**One factory proved; the file assumed.** The injection has to hit every distinct
fixture path, not the first one that rejects.

**So the honest measurement is per PATH:**

| | paths | reject | inert |
|---|---|---|---|
| before | 1,919 | 1,764 | **155** |
| after | 1,922 | 1,872 | **50** |

Counted separately, because they are library and boundary limits rather than
suppressions anyone chose: 58 vitest matcher literals and 131 untyped-JSON paths.

### Where the inert paths were, which is the part that matters

Ranked by what they guarded, not by count. **`hurdles.test.ts` held 41** — every
one inside a city hurdle regression suite: DC historic demolition, DC stormwater,
San Diego coastal replacement and Process Four, San José Ellis Act, Nashville
sidewalk exaction, Columbus parkland, Atlanta's pre-1965 forfeiture, Dallas urban
forest, Las Vegas DINA. Those suites pin the gates that took 29 over-firing
corrections, and four of the cities sit in `CITIES_WITH_SPECIFIC_HURDLES`, which
`Compare.tsx` reads to decide whether a hurdle count renders as a floor.

`laZone.test.ts` was worse in kind: it re-declared LA's qualifier regex locally
under a comment instructing the reader to keep the copy in sync by hand — rule 14
(enforcement by comment) and rule 15 (a written rationale defending a wrong
premise) in one artifact. The premise was already false: `stripLaQualifier` is
exported and a sibling test imports it. That file pins the `(F)`-prefix defect
that published FAR 3.0 against a code-stated 1.5, and every assertion in it could
have kept passing while the real function drifted.

### Two mechanisms, both of the "looks checked" family

**A function-valued mock is unchecked even against a tightened union.** Its return
type is inferred, and an inferred object reaches the target by structural
assignability, which performs no excess-property check. Proven with a four-case
probe: a direct payload errors, `() => ({…})` is silent, an annotated
`(): RoutePayload =>` errors again.

**`Record<string, unknown>` override helpers compile to silent no-ops.**
`denverZoning({ HEIGHT_STORIESX: null })` type-checked, quietly changed nothing,
and left the base value asserted — so the test reads as pinning a variant while
testing the default. Seven helpers had this.

### `toEqual` is a wide, permanent hole

`vitest`'s matchers are generically typed, so the EXPECTED literal is never
checked against the actual's type: `toEqual({ tierZz, n, minPublishableN })`
compiles. This is the most-used assertion in the repo — 58 paths — and unlike
everything else here it is not fixable by tightening anything on our side. Worth
stating plainly so nobody reads "1,872 of 1,922 reject" as "assertions are
type-safe." They are not; the FIXTURES are.

### What was refused

~44 of the 50 remaining inert paths are the ArcGIS `attributes: Record<string,
unknown>` boundary — upstream city field names (`SITUS_ADDRESS_LINE1`, `TAXKEY`,
`PIN_NUM`) that no type in this repo enumerates. Writing one would assert a schema
nobody measured: internally consistent, unverifiable, and precisely the shape
rule 9 says only an outside measurement catches. Those close with a live field
query per city. Backlog, not sweep.

## 2026-08-11 — A failed fetch published as a geographic claim, and a rate that was the weather

575 real parcels, 25 per city, sampled from each city's own layer rather than
hand-picked, pushed through the composition `analyze.ts` performs. **Zero
exceptions.** Not on a null lot, a 207-million-sq-ft park, a 2 sq ft sliver or 84
`Unknown` district codes. No NaN, no division by zero, no zero-cost or zero-month
timeline on a non-prohibited verdict.

Every defect it found produced a plausible output instead.

### The defect: a transport failure rendered as a fact about the world

`providers/phoenix.ts` put the zoning read in the same `Promise.allSettled` as
the cosmetic layers and collapsed it with
`zoningR.status === 'fulfilled' ? firstAttrs(…) : null` — two facts, one `null`.
That produced `districtCode: 'Unknown'`, which `assessDevelopability` turns into
`no_coverage`, which tells the user the parcel *may sit in a neighbouring city or
unincorporated area we do not cover*, and `analyze.ts` then zeroes cost, timeline
and hurdles behind it.

The parcel was fully covered. Next click, full report. **A failed fetch had become
a geographic assertion** — rule 5 at the transport layer, and worse than a wrong
sentence about a real rule, because the claim is about the world rather than the
code.

### The root cause was a budget mismatch, not latency

Zoning had a flat 6,000 ms budget with **zero retries**. The parcel snap it must
agree with had 8,000 ms **and** an internal retry. Under load the parcel resolves
and the zoning does not, which produces "a real parcel in an unknown district"
**by construction** rather than by chance.

That is a greppable shape and it generalises: **wherever two calls must agree,
their budgets must agree.** A pair with mismatched timeouts does not fail
together, it fails into a state where one half is trusted and the other is
missing — and a missing half is exactly what a careless ternary turns into a
substantive answer.

Latency had a separate structural cause. `fetchParcelSnap`'s 8,000 ms plus a
serial 6,000 ms assessor hop made **14 seconds arithmetically reachable** past
Netlify's 10 s kill, and three *cosmetic* layers were awaited with the same weight
as required ones — a 6 s hang on FEMA cost six seconds for a field the UI omits.
Now bounded to 9.2 s with **no query changed**, verified by a same-moment A/B
against the pre-change provider: 26 of 26 byte-identical `ParcelInfo`.

### Rule 10 applied to a measurement that SUCCEEDED

The smoke run measured a 19% failure rate and an 8,710 ms p90. Re-probed before
the fix: **81 of 81 isolated calls resolved, median 277 ms.** Every layer fast,
32 simultaneous queries showing no degradation.

The rate was **the service's health on one day**, not a property of the code. The
defect is permanent; its frequency was weather.

Rule 10 says re-probe before recording a FAILURE. This is the same rule pointing
the other way, and it is the harder half: **nobody re-checks a number that
explained something.** The 19% was about to be written here as a standing rate,
and it would have been wrong in a way no later reader could catch — a plausible
figure, sourced to a real measurement, describing a condition that had passed.

It also removed the option of a before/after, since the failure could not be
reproduced by waiting. The substitute was **perturbation** (rule 2): fault the
zoning URL and compare. Three injections, three clean results — and the one that
matters is the 200-with-an-error-body, because that is the shape that looks like
a valid empty answer rather than a failure.

### The instrument had been discarding its own evidence

`null-inventory.ts` retried up to 3× on `districtCode: 'Unknown'`, returned the
first clean result, and **counted nothing**. At a 19% per-call rate, three tries
resolve cleanly on ~99% of runs. Its `stability()` check could not see it either:
it keyed on `parcelId`/`lot.sizeSqFt`, and a Phoenix failure returns the RIGHT
parcel with an unknown district — stable on the axis being sampled.

So the one artifact used to judge fitness reported 23 clean cities while one of
them failed one request in five. The retry was the only place a failure was ever
observed and the observation was thrown away — the same shape as the feed row
counts, where the instrument held the answer and did not record it.

### Three things the fix did that are worth copying

**The failure is a value, not a rejection.** `readRequired` never rejects, because
a rejected promise is precisely what the `allSettled` idiom turns into `null` in
one careless ternary. The union has no `.value` on the failure arm, so the
compiler forces the decision (rule 14).

**Both arms are pinned.** A transport failure refuses AND an empty zoning answer
still yields `Unknown`. Pinning only the failure arm would let a fix that refuses
on every empty result pass — and that would break the out-of-city gate, turning a
correct "not in this city" into an error.

**The copy rejected its own first draft.** It read *"it does not mean the site is
outside our coverage…"* — a denial that restates the false claim. The guard built
for rule 21 caught it. Third instance in two days of a correction tripping the
guard that motivated it.

### Two decisions recorded rather than taken

**The city-boundary gate still degrades OPEN** — a failed boundary read lets a
point through rather than refusing. Same rule-5 shape one level down, and it is
what Dallas's Highland Park refusal depends on, so it needs its own pass rather
than a reflex.

**Philadelphia's `MIN_CREDIBLE_LOT_SQFT` cannot be ported**, which was the
obvious fix for a 2 sq ft Las Vegas lot publishing `AS_OF_RIGHT` and $482,996.
That constant rejects an OPA *placeholder* — condo unit accounts (`888*`) report
0 or 1 sq ft because the land belongs to the building — and 100 was chosen to sit
below the smallest genuine rowhouse lot. It is a data-quirk filter, not a
developability threshold, and its rationale is false everywhere else. Las Vegas's
2 sq ft is real geometry, correctly read.

The decision taken instead: **disclose, do not refuse.** The answer is
arithmetically right and a threshold would need a defence nobody can give, so the
lot size is surfaced where the user sees it before the cost. The tool answers what
was asked and makes the absurdity visible rather than deciding where absurdity
begins.

## 2026-08-11 — A default that did not fit, and a verdict about our own placeholder

Found by the 575-parcel live smoke run, by a check that fires on every answered
parcel rather than on anything that looked wrong: `GFA_OVER_ENVELOPE`, four hits.

`buildDefaultSpec` bounded its proposed floor area into a `[1000, 200000]` band
with `Math.max` / `Math.min`. On a parcel whose by-right envelope is smaller than
1,000 sq ft, `Math.max` **raised the proposal through the envelope it had just
been derived from** — and everything downstream then graded that proposal against
the code and reported the excess as the city's restriction.

| city | district | lot | envelope | proposed | published before |
|---|---|--:|--:|--:|---|
| atlanta | RG-2 | 870 | 303 | 1,000 | PROHIBITED |
| atlanta | C-1 | 1,030 | 717 | 1,000 | PROHIBITED |
| boston | 2F-5000 | 775 | 388 | 1,000 | PROHIBITED |
| chicago | RS-3 | 1,062 | 956 | 1,000 | NEEDS_RELIEF · $514,780 · 22 months |

Chicago is the one that matters. Nothing on that report is flagged, hedged or
withheld: a relief path, a construction cost and a schedule, all describing a
building this parcel's own envelope forbids, all published because the tool's
minimum program was 4.6% larger than the envelope. The three PROHIBITED rows are
the same defect wearing a safer face — the parcel is not prohibited, the default
spec is.

### Rule 18, exactly

Every one of these produced output. A number in the right units, a verdict from
the normal vocabulary, a timeline in a plausible band — nothing about the report
invites suspicion, and the four were sitting inside the same run whose null rows
got interrogated. This is why the smoke script's suspicion checks run
unconditionally: the comparison `gfa > maxFloorAreaSqFt` is trivial and nobody
would ever have thought to make it while reading a report that looked fine.

### The fix: the floor becomes a precondition

The envelope is the constraint, so it bounds the proposal. Two changes, both
inside `src/lib/defaultSpec.ts`, and **no new constant** — `GFA_MIN` keeps its
value and changes role:

- Where an envelope resolved, it is passed to `quantizeGfa` as a ceiling and wins
  over the band. This also closes a second, narrower path: rounding to the
  nearest 500 can cross an envelope that sits just under a multiple of 500 (an
  envelope of 1,480 takes 0.85 → 1,258 → 1,500), with the floor playing no part.
  A fix aimed only at the floor would have left that live, and it is invisible in
  the sample — 0 of 110 envelope-basis parcels hit it.
- Where the envelope cannot hold even `GFA_MIN`, **no spec is offered at all**.
  The panel falls back to its existing "Start full analysis" CTA and the user
  states the size, so the verdict is about their number. Shrinking the default to
  fit was the alternative and was rejected: at 303 sq ft the unit count is
  `Math.max(1, …)` inventing a dwelling that does not fit, and the $/sf model is
  outside anything it was built for. Two fabrications stacked to avoid one
  refusal.

### What the floor was protecting, checked rather than assumed

The `assumed-far-1.0` / `assumed-unconstrained` path has **no envelope to clamp
against**, and it is the majority path in several cities. It is deliberately
untouched: `lot × 1.0` is a labelled placeholder, and capping it by lot area
would convert an assumption into a limit the code never stated (rule 4). The
ceiling argument is `null` on that branch for exactly that reason. Measured: all
15 control parcels — five with small-but-sufficient envelopes, five with no
envelope, three on the ceiling, two ordinary — returned identical verdict, cost
and timeline before and after.

### The ceiling is a different question, and it stays

Stated because "fix both clamps" was the obvious move and the data says they are
not the same defect. Of the 149 parcels sitting on the 200,000 ceiling, **zero
proposed more floor area than their envelope allowed**; on the 31 with a resolved
envelope, the envelope exceeded 200,000 in every case. The ceiling only ever
proposes LESS than the code permits — the opposite direction from the floor — so
it cannot produce a verdict the code forbids. Removing it is not obviously better
either: NYC's sampled R4 parcel carries a 12.25M sq ft envelope, and an uncapped
default would publish a ~10M sq ft, ~8,000-unit program nobody asked for.

What the ceiling *does* do is choose the program on a large lot, and on four
sampled parcels that program came in under the existing housing and scored
PROHIBITED on no-net-loss. That verdict is true of the program proposed. It is
recorded here as an open question about defaults on large lots, not fixed under
cover of this one.

### Verified at the real entry point

`scripts/verify-clamp.ts` runs `getParcelInfo` → `buildDefaultSpec` → the actual
`netlify/functions/analyze.ts` handler with the query string the parcel panel
builds — the verdict, cost and timeline it prints are the ones the API returns,
not a re-implementation (rule 11). Each parcel is probed twice in isolation and a
row that disagrees with itself is marked rather than reported (rule 10); none
did. Before: 4 rows over their envelope, 15 controls. After: 4 declines, 15
controls unchanged to the dollar and the month.

One thing the harness had to do to measure the system rather than itself: pass a
distinct `x-forwarded-for` per call. The handler's 20-per-minute per-IP limit is
correct production behaviour for one visitor, and the first run returned
`RATE_LIMITED` for every row after the twentieth — a clean-looking table of
non-answers.

The invariant is now a swept test, not a comment (rule 14): every envelope from
1 to 6,000 sq ft is built and asserted `gfa <= envelope`, with both outcome
counts pinned — 999 declines, 5,001 proposals — so a sweep that quietly stopped
covering anything goes red instead of green (rule 20).

### One more instrument that could not tell two states apart

`scripts/null-inventory.ts` mapped a null spec onto `GAP — verdict withheld`,
which reads as "no FAR resolvable" — our data missing something. A decline is the
opposite: the parcel resolved fine and we chose not to propose. It now prints as
its own outcome, and the four summary buckets are asserted to partition the rows
so a future basis cannot vanish from the headline while the table still lists it.

## 2026-08-12 — Two optional layers whose failure was published as a finding

The required reads refuse now (`upstreamSplit.test.ts`, and the entry above it).
The OPTIONAL ones kept the old idiom — `status === 'fulfilled' ? … : null` —
which is harmless where an overlay's absence renders as nothing, and is the same
defect one field over where its absence renders as a **claim**. Two did. Both
were found by a sweep of the class, not by a failing test, and neither was
visible to any instrument in the repo: on both sides of the boundary the code was
internally consistent (rule 9).

### The measurement, at the real entry point

`scripts/verify-failed-fetch-claims.ts` drives the actual
`netlify/functions/analyze.ts` handler against live upstreams with exactly one
layer faulted per run — `globalThis.fetch` throws for URLs containing one
substring and is otherwise untouched — so the diff against the control run is the
layer and not the harness (rule 11). Two isolated probes per row; none disagreed
with itself (rule 10). Every control row is byte-identical before and after.

| row | before | after |
|---|---|---|
| Denver D-C, Union Station, 100,000 sq ft commercial, control | impact $921,000 · total $45,638,500 | unchanged |
| …only the EHA market-area layer faulted | impact **$614,000** · total $45,331,500 · no note | impact $0 · total $44,717,500 · **note naming both rates** |
| Denver I-MX-5 RiNo (a Typical-area parcel), EHA faulted | impact $614,000 — right by luck | impact $0 · same note |
| Miami T4-L Coral Way, 2-unit rental teardown, control | two rows incl. the no-relocation absence | unchanged |
| …only the HISTORIC layer faulted | **identical to the control** | one row: designation could not be checked |
| Seattle Capitol Hill, control | MHA line "roughly $45/sq ft" | unchanged |
| …only the MHA layer faulted | MHA line "roughly $28/sq ft" | the published spread, and why |

### S2 — Denver: a transport failure moved $307,000 out of a total

`estimates.ts` chose the commercial affordable-housing rate by testing the market
area for `'High'` and taking the Typical rate otherwise, then labelled the fee
with the area name or the word Typical when none had arrived. So an EHA outage
billed the Typical rate on a High-area parcel, `applied: true`, silently, and the
label asserted a market area that nothing had measured — rule 4 (an invented
number) and rule 7 (and it tells the reader which way it resolved) in one line.

**The fix could not live in `estimates.ts`.** There, a missing area has two
causes — the layer answered and the parcel is not High, or the layer did not
answer — and they are indistinguishable at that layer. The state is split in the
provider (`overlays.unresolved`) and carried to the fee as a three-state
`FeeAreaRead`. Rule 5, one level down.

**DISCLOSE, not refuse.** The honest output for an unresolvable rate is
"unpriced, disclosed" (rule 4), which is exactly what the same `switch` case
already does when the unit count is unknown. Refusing the whole parcel was
rejected: the EHA read feeds one fee on commercial projects only, residential
Denver parcels never consult it, and `requiredUpstream.ts`'s own contract makes a
read required when *a caller would otherwise publish its absence as a fact* — the
gap is now publishable as a gap, so it is not required. The cost of the choice is
stated rather than hidden: the total is $614,000 lighter and says so, instead of
being $307,000 lighter and silent.

Measured while fixing, because the empty case had to be classified too: distinct
values on the live EHA layer are exactly {High, Typical}, both polygons cover the
city (five in-city probes each returned one; two out-of-city probes returned
none). So "answered, nothing here" keeps the Typical rate it has always had, and
only the label stops attributing that word to the layer.

### S3 — Miami: an ABSENCE published from a timeout

`hurdles.ts` emits *"No tenant relocation or replacement-housing requirement"* on
a rental teardown, framed as the opposite of the rule in most cities we cover —
and the neighbouring row's note stated the parcel was not in a designated
historic district. Both are findings about the parcel derived from
`historicDistrict` being null, and Miami is the only city that reads that field
inversely. With the HISTORIC layer faulted, the response was **identical to the
control**. An absence is the strongest claim shape in this repo and it was being
manufactured from a network error.

Two details the fix turned on. First, Miami's `historicDistrict` is fed by TWO
layers — the historic district and the archaeological zone — so a null is an
answer only when both answered; marking the gap on either failure alone would be
wrong in the direction that flatters (rule 13). Second, deleting the rows was not
an option: a demolition path with no historic row reads as clear. The unknown
gets a row of its own that says what turns on it, and the 45-day archaeological
arm — which does not depend on any district — is stated there rather than lost.

**DISCLOSE, not refuse**, and here the case is stronger: the historic layer is
optional in all 23 providers and feeds informational rows everywhere else, so a
502 for the whole parcel would trade a large availability loss for a claim we can
simply decline to make.

### S5 — Seattle was milder than S2, and not harmless

`applied: false` keeps every MHA branch out of the total, and the label already
omitted the area name when it had none, so the sweep's reading was right about
the total. The **rate** was still a per-parcel claim: on a parcel the control run
resolved to "High Areas", faulting the layer moved the published line from
"roughly $45/sq ft" to "roughly $28/sq ft" — a 38% drop with nothing marking it.
A number is not less of an assertion for sitting outside the total. It now prints
the published spread across areas, taken from the source the midpoints come from
rather than from the spread of our own four numbers, which would understate what
is unknown. The parcels that are genuinely in no MHA fee area are untouched —
that default is a separate, pre-existing question and is left as found.

### Structure, not a comment (rules 14 and 20)

`overlays.unresolved` is a closed union, so a typo is a compile error, and
`ImpactFee` is a union in which an applied fee cannot carry an unknown rate — a
caller reaching for the number to bill it has already had to narrow on `applied`.
`CostOpts` takes the parcel's overlays rather than a bare fee-area string, so the
lookup cannot arrive with its resolution state dropped; that change alone made
the compiler point at every call site.

Three guards, each written so it cannot pass by finding nothing:
`providers/failedFetchClaims.test.ts` pins the provider↔field pairs by exact
membership, asserts `hits > 0` on every perturbation (a renamed upstream URL
turns a probe into a no-op that passes by testing nothing), and asserts BOTH
directions — the healthy run must NOT mark the layer, so "mark everything" is not
a way to pass. `cost.test.ts` pins all three fee-area states, so a fix that made
everything unpriced would fail. And a sweep over every city with specific hurdles
asserts that no city states the parcel is outside a historic district when the
read is unresolved, with a control asserting that Miami still states it when the
read succeeded — if that control list ever empties, the regex has gone stale and
the sweep is passing over nothing.

### What is still open, and deliberately not closed here

The sweep's S1 (a failed optional read erasing the government-owner hard block in
Philadelphia and San Diego) and S4 (a failed overlay silently removing required
hurdles and months) are untouched. S1 in particular needs a product decision
about whether an assessor-join outage should refuse a whole parcel, and that is
not a decision a fix should make on the way past.

> **Superseded in part, same day.** S4 was closed by the entry below —
> "A timeout that made a parcel more buildable". S1 is still open as written.

## 2026-08-12 — A timeout that made a parcel more buildable

The entry above fixed the optional reads whose failure published a false
**claim**. This is the other half of the same class, and it is the half that is
harder to see, because the failure publishes **nothing**: `hurdles.ts` tests
three overlay fields as booleans — `historicDistrict`, `coastalZone`,
`floodZone` — and on a null the hurdle they trigger simply does not appear. The
months it carries leave the timeline with it. There is no wrong sentence to find
in the output; there is a right sentence missing, and a report missing a
requirement is indistinguishable from a report for a parcel that has none
(rule 18, at its sharpest).

### The measurement

`scripts/verify-unchecked-overlays.ts` drives the actual
`netlify/functions/analyze.ts` handler against live upstreams with exactly one
layer faulted per run, each row run twice in isolation (rule 10; no row
disagreed with itself), with a distinct `x-forwarded-for` per call so the
handler's 20/min limit does not turn the table into `RATE_LIMITED` non-answers.

| row | verdict | months | hurdles |
|---|---|--:|--:|
| LA · 1126 Abbot Kinney Blvd (C2-1-O-CA, live `coastalZone: true`) — control | AS_OF_RIGHT | 57 | 3 |
| LA · same parcel, COASTAL faulted | AS_OF_RIGHT | **48** | **2** |
| Boston · 26 Exeter St (Back Bay Architectural District, restaurant standing) — control | NEEDS_RELIEF | 55 | 6 |
| Boston · same parcel, HISTORIC faulted | **AS_OF_RIGHT** | **51** | **4** |

The LA row loses the Coastal Development Permit and exactly its nine months: the
permit is `serial: true`, so unlike the nested entitlement hurdles its months add
in full — and leave in full. The Boston row is worse than a lost row. A transport
failure moved the parcel from "needs city permission" to "you can likely build
this", because `feasibility.ts` is the only place that raises a teardown to
NEEDS_RELIEF on historic grounds and it read the same `X | null` as a boolean.
**A timeout upgraded the parcel's legal standing, on the loudest line of the
page.**

### DISCLOSE, not refuse — and why that is not the soft option

Making these layers required would be 23 cities × 2 layers of new refusal surface
for fields that are frequently and legitimately absent: most parcels are not
historic and not coastal. A tool that 502s because it could not confirm a parcel
is **not** historic is worse than one that says so. So the analysis proceeds and
the gap gets a row of its own — `status: 'unchecked'`, a fourth status that is
deliberately not on the required/likely/info severity ramp, because it is a claim
about the REPORT rather than about the parcel.

Two decisions inside that, both of which could have gone the flattering way:

**The months are named, never added.** An `unchecked` row carries
`excludedMonths`, which nothing sums into `timeline.months`. Adding them would
manufacture time for a requirement that probably does not apply (rule 1);
dropping them would leave a bare number with no indication of which way it is
wrong, which is rule 7's failure. So the figure renders as a floor — "48+ mos ·
at least — up to 9 more if the unchecked approvals apply" — and the flood row,
whose hurdle carries no months, deliberately carries none and leaves the
timeline unmarked. Over-marking misdescribes what is unknown just as surely.

**An unchecked row is not an approval, so it is not counted as one.** Both
surfaces that publish a hurdle count would otherwise have made an outage read as
*more* approvals than a healthy run — the original defect with its sign flipped.
`src/lib/uncheckedHurdles.ts` holds that rule once for `KeyMetrics` and
`Compare`, rather than as two inline filters that can disagree about what a
parcel needs (rule 9's boundary problem, between two files that look
independent). Verified rendered, not merely returned: the result page shows
`2+ · at least — 1 check unavailable` and a "Not checked" row carrying the note,
`Compare` shows `48 mo`/`2+` with an `unchecked` marker, and the healthy run
renders byte-for-byte what it did before.

**The verdict.** `assessFeasibility` now pushes an INDETERMINATE historic check
on a teardown whose designation could not be read, and downgrades an otherwise
AS_OF_RIGHT verdict to INDETERMINATE — the same move, for the same reason, as
the existing rule for a tall proposal with no published height limit. It is
INDETERMINATE and never NEEDS_RELIEF: a timeout may not manufacture a legal claim
in either direction. Scoped so it cannot become a blanket refusal — teardowns
only, failed read only (an empty answer resolves the question and leaves the
verdict alone), and only where the verdict would otherwise be as-of-right.

### Scope, and the two cities that mark nothing

`historic` and `flood` are now marked by every provider that reads those layers
(22 of 23 for historic; all 23 for flood), and `coastal` by both CA providers —
because unlike `feeArea`, these three consumers are city-agnostic. Two cities
mark no historic gap and both are recorded as answers rather than omissions:
**Las Vegas** issues no historic request at all, because no City layer publishes
the HD-O boundary (a documented refusal), and **Austin** issues none either —
which is a real coverage gap, since `HISTORIC_BODY.austin` describes a
Certificate of Appropriateness that can never fire. That gap is named here and
left as a gap. Marking it would report a transport failure that did not happen,
on every Austin parcel.

Still open from the same sweep: S1 (a failed optional read erasing the
government-owner hard block in Philadelphia and San Diego), and the city-specific
overlay layers in Dallas, Raleigh, Milwaukee, Columbus and Phoenix, whose failure
removes city-specific hurdles by the same mechanism but through per-city fields
rather than the three shared ones.

### Structure, not a comment (rules 14 and 20)

`UnresolvedOverlay` is a closed union, so a typo is a compile error.
`lib/unresolvedOverlays.ts` is the single construction site for the mark, so
`grep unresolvedOverlays netlify/functions/lib/providers` is a complete inventory
of who marks what, and the emptiness half of the condition (`field == null &&
readFailed(r)`) is written down once instead of 23 times — both halves matter,
in opposite directions: without the first, a provider whose field is fed by two
layers reports a gap while holding a good answer from the sibling (rule 13);
without the second, every parcel in the city is marked and the disclosure becomes
wallpaper. `HurdleStatus` gaining a member made the UI's status record stop
compiling until the new state was given a rendering.

`providers/uncheckedOverlays.test.ts` (127 cases) cannot pass by finding nothing:
`CASES` is pinned to `LIVE_CITIES` by exact membership in both directions; every
perturbation asserts `hits > 0`, which is what pins the layer URLs — a renamed
upstream turns a probe into a no-op that passes by testing nothing (rule 11);
every case asserts both directions, so "mark everything always" cannot pass; and
the two cities with no historic read are asserted to acquire no historic mark
under an unrelated failure, with their reasons required as data. Both directions
of the instrument were checked by reintroducing the defect: reverting one
provider's mark turns it red, and mistyping one layer substring turns it red
rather than silently green.

One further consequence, caught while wiring this up rather than by a test: an
unresolved overlay now marks the response DEGRADED for `cacheControlFor`. A row
saying "the Coastal Zone layer did not respond" is a fact about one request, and
at the 24-hour CDN TTL a thirty-second outage would have told every visitor for a
day that a check could not be performed, on a layer that recovered immediately —
the Chicago cache-poisoning incident of 2026-06-10, one field over.

## 2026-08-12 — The front door: a bbox that substituted, and eight cities publishing their neighbours

Two defects in the address-search path, found by a 230-round-trip measurement of
the search → parcel loop (`scratchpad/frontdoor/REPORT.md`). They look like one
defect and are not: one is a geocoder that answers a different question than the
one asked, the other is a parcel layer answering for land the tool does not
cover. Fixing either alone leaves the other publishing.

### Defect 1 — Mapbox's `bbox` SUBSTITUTES rather than filters

`SearchBar` scoped the Search Box widget to the searched city's bounding box, in
the belief that this restricted results to that city. It does not restrict them.
Given an address outside the box, the API returns **a different address inside
it**, with nothing in the response marking the swap. Measured, same query with
and without the parameter:

| query | with bbox | without bbox |
|---|---|---|
| `3600 S Las Vegas Blvd` (the Bellagio, unincorporated Paradise) | 36.169232,-115.140758 — 6 km north, downtown | 36.112548,-115.175987 — the Bellagio |
| `25 Dorrance St, Providence RI` in Boston | 25 Dorrance Street, **Charlestown MA** | 25 Dorrance Street, Providence RI |
| `202 C St, San Diego CA` in LA | 202 Avenue C, **Redondo Beach** | 202 C Street, San Diego |

The Bellagio row published **AS_OF_RIGHT, T6-UC, 225,750 sf, $100.8M** — a full
costed report for a parcel six kilometres from the address that was typed. Its
address line read "Selected location", because the parcel it landed on carries
no address, so **nothing on screen contradicted the query.** The Bellagio's true
coordinate is refused correctly on three isolated probes; the tool never saw it.

No jurisdiction gate can catch this one: the substituted point is legitimately
inside the City of Las Vegas. The fix is to stop asking the geocoder a question
whose answer is a rectangle. `proximity` alone does the ranking, and for in-city
queries the top hit is byte-identical with and without the bbox (Boston City
Hall, 200 N Spring St LA, 2000 S Las Vegas Blvd) — the change costs nothing on
the path users actually take, and the suggestion list now contains what was
typed. Scoping moved downstream, where a real boundary exists.

### Defect 2 — eight cities served their neighbours' parcels

A city's parcel layer is usually county-wide while its zoning layer stops at the
city line, so a click next door returns a real address, a real lot area and
`districtCode: 'Unknown'`. That render was believed sufficient. Driving
`getParcelInfo` at real neighbour addresses (isolated re-probes, stable):

| city | published for | verdict |
|---|---|---|
| la | West Hollywood, Beverly Hills, Culver City, Santa Monica | $98.5M, $18.0M |
| charlotte | Matthews, Mint Hill, Pineville | $25.3M |
| miami | Coral Gables, Hialeah, West Miami | $17.3M |
| chicago | Oak Park, Cicero | 115,510 / 327,433 sf |
| austin | West Lake Hills, Rollingwood, Sunset Valley | — |
| sandiego | Coronado, National City, La Mesa | — |
| raleigh | Cary, Garner, Wake Forest | — |
| nashville | Belle Meade, Berry Hill (satellite cities) | `districtCode: 'Satellite City'` |

Four cities (dallas, columbus, lasvegas, phoenix) already had gates, hand-written
into their own providers — which is why eight others did not. `lib/jurisdiction.ts`
is now one registry that must cover exactly `LIVE_CITIES`: each city is a
verified boundary layer or a stated reason it has none.

**A city with no boundary layer is not given one by inference.** Eleven entries
are `kind: 'none'`, each naming what was enumerated and what refuses today
(NO_PARCEL from a city-scoped parcel layer, or the bbox). Approximating a
boundary from the bbox would be defect 1 again, one layer down.

### What the cross-tab caught that the neighbour list could not

Each new gate was cross-tabulated against its own city's zoning layer over 40
random in-bbox parcel points — the Dallas method — because "the gate refuses the
three towns I already knew about" tests the cases already in hand. Two gates were
wrong and would have shipped:

- **Austin.** `JURISDICTION_TYPE = 'FULL'` is the obvious gate and refuses land
  Austin zones: four sampled points sit in `LTD` (limited-purpose) polygons where
  the city's own zoning layer returns RR, LA, PUD, LA. The gate accepts FULL or
  LTD, and not the ETJ rings.
- **Raleigh.** The layer named "Corporate Limits" disagreed with Raleigh's zoning
  at **9 of 40** points — Raleigh zones inside its ETJ. `Planning Jurisdictions`
  matches. The same shape appeared in Charlotte, where the county's
  `Jurisdictions` layer disagreed 9 times (8 of them `name: 'Mecklenburg'`, where
  Charlotte's UDO applies); `SphereofInfluence` is the layer that matches, and its
  one remaining disagreement is a point the county's own boundary layer places
  outside Mecklenburg entirely, where Charlotte's zoning layer overreaches.

Neither error was reachable by reading the layer names, and neither would have
failed a test written from the neighbour list.

### A gate that would have published a false claim, caught by an existing test

Nashville has no city limits to read — the consolidated county IS the boundary —
so its gate is in-band: Metro's zoning layer labels satellite-city polygons
`ZONE_DESC = 'Satellite City'`. Written with the same polarity as every other
gate (no rows ⇒ outside), it refused with *"you are in a satellite city"* for any
Metro point with no zoning polygon — a river, a right-of-way. That is rule 5
**inside the gate**: an absence rendered as an answer. `upstreamSplit.test.ts`
found it by emptying that layer, which it already did for a different reason.

`emptyMeans: 'outside' | 'inside'` is now a required field on every gate, so the
question a boundary layer's shape answers has to be answered explicitly, and the
quantifier over a non-empty result follows from it rather than being chosen.

### Defect 3 — the geocode hop had one render for four states

`SearchBar` wired only `onRetrieve`. Zero results, a rejected fetch, an HTTP 500
and a request that never settled were **pixel-identical** — to each other and to
a search that had not happened: no dropdown, `aria-expanded=false`, no message,
not even "we couldn't find that address". The 500 additionally threw an unhandled
promise rejection. Downstream the distinction already held correctly; the gap was
entirely at the hop.

Verified by perturbation in the running app (patching `fetch` before the search
bundle loads — `search-js-core` captures `globalThis.fetch` at module load, so a
later patch intercepts nothing). Five distinct renders now, where there was one.
The library's floating rejection is suppressed **by instance identity** — only an
error this component already surfaced — so an unrelated rejection elsewhere on
the page is still reported; checked both ways.

### Why the instruments are pinned to each other

`upstreamSplit.test.ts` held a hand-written list of four gated cities. A set
stated twice drifts, and this is what that drift cost: while that list said four,
eight cities were publishing their neighbours' land and nothing in the suite
could see it. The list is now DERIVED from the per-city `gate-open` declarations
and reconciled against `GATED_CITIES`, so a registry gate no provider issues — or
a provider that stops issuing one — goes red instead of covering one city fewer.

The probe fixture reads each gate's `insideSample` from the registry rather than
copying its magic value, and `jurisdiction.test.ts` asserts every sample
satisfies its own gate's predicate: a changed predicate cannot leave a stale
literal behind, silently making every gated provider refuse every mocked request.

### One transient, re-probed before it was recorded

The final sweep showed Nashville publishing both satellite-city addresses again,
with `parcel.jurisdiction_unread` at exactly 6004 ms — the gate's fetch timeout,
i.e. the gate degrading open as designed. In isolation it refused **8 of 8** at
84–236 ms, and 20 back-to-back runs gave 20 correct refusals, zero unread gates,
median 199 ms. The sweep had just walked twenty-eight upstreams in sequence; the
failure was the weather (rule 10). The one thing worth checking rather than
waving away was self-inflicted: Nashville's in-band gate issues a SECOND query to
the same layer the required zoning read uses, and that load test is what says the
extra query costs nothing measurable.

Two more instrument failures worth recording, both mine, both caught by
reconciling against a known-good result before believing the aggregate (rule 16).
The first cross-tab reported Miami and Charlotte with **zero** rows in all four
cells — n=40 counted, nothing tabulated — because the zoning field names were
guessed (`ZONE`, `ZONING`) and every query returned `error 400`. The second
inserted seven gate declarations into the wrong cases, because the insertion
looked for a multi-line `optional: [` and Chicago's is a single line: Seattle,
Denver and Atlanta acquired gates for layers they never query. Both were loud
rather than plausible, which is the only reason they were cheap.

## 2026-08-12 — The front door, and a before-number that measured the harness

The address-search path had never been exercised at volume. A round-trip
measurement — take a parcel's own address from the city's layer, geocode it, ask
whether the coordinate returns to that parcel — found the parcel layer is the
source, Mapbox is the instrument, and disagreement is measurable rather than
inferred.

### The two defects were not one defect

**Cross-jurisdiction.** The Mapbox bbox SUBSTITUTES rather than filters: searching
"3600 S Las Vegas Blvd" — the Bellagio, outside city limits and correctly refused
at its true coordinate — returned a point 6 km north and published AS_OF_RIGHT,
T6-UC, 225,750 sf, $100.8M with the address line reading "Selected location".
Probing all 23 cities found **eight** publishing a neighbour's parcel, not the
three the first pass reported.

**Within-city.** A jurisdiction gate stops none of that second class, because the
point IS in the city. A US Census cross-check found that in 17 of 27 wrong cases
the two geocoders agree within 50 m — the PARCEL LAYER'S OWN ADDRESS is attached
to the wrong geometry. DC's `5739 BLAINE ST NE` returns two parcels 2 km apart.

Scoping them as one fix would have shipped a gate, closed the visible half, and
left 17% of within-city searches landing on the wrong parcel while looking solved.

### The Las Vegas result was the harness — eighth instance

The first run reported Las Vegas at 0 of 13 and a mechanism to go with it: small
lots, geocode error, points landing in blank-address common-area parcels. The
mechanism was plausible, specific, and wrong.

The harness fed Mapbox each parcel's STORED address string. Las Vegas is the only
one of 23 cities that zero-pads its house numbers, and Mapbox resolves
`002750 FAISS DR` as a distinct address from `2750 Faiss Dr`. Asking the same 25
parcels the way a person would, changing nothing else: **0/13 -> 12/13.**

**So the before-number and the after-number are not measuring the same thing.**
The 34-of-200 baseline was inflated by a defect in the instrument, at least for
Las Vegas, and any comparison across the two runs carries that. The honest
statement is that 21-of-230 is the measured rate under a correct harness and the
old 34 is not its predecessor.

Worth noting what caught it: the brief said to verify the reading before building
on it. A fix built on the reported mechanism would have added a blank-address
branch nobody needed and left the real cause — a query form no user types —
untouched and unmeasured.

### The gates disagreed with their own cities, and only one check saw it

Two of twelve gates were wrong and would have shipped:

 · Austin's obvious `JURISDICTION_TYPE = 'FULL'` REFUSES land Austin zones —
   4 sampled points sit in `LTD` polygons carrying real districts.
 · Raleigh's "Corporate Limits" layer disagreed with Raleigh's own zoning at
   **9 of 40** points, because NC cities zone their extraterritorial
   jurisdiction. Charlotte's county layer, the same, 9 times.

Neither was catchable from the neighbour list, which only tests cases already in
hand — it confirms the gate refuses Highland Park, which was never in doubt. What
found them was cross-tabulating each gate against its own city's ZONING layer over
40 random in-bbox points. **The gate and the zoning are two sources that must
agree, and disagreement is measurable** — rule 13's joint dependency pointed at a
boundary rather than a field.

A third gate had inverted polarity: Nashville's is in-band (Metro labels satellite
cities in `ZONE_DESC`), so written with the standard polarity it refused with
"you are in a satellite city" for any Metro point with no zoning polygon. An
EXISTING test caught that one — the third defect tests have caught here, against
at least four they have defended.

### Comparing Mapbox with itself

Austin, Chicago and San Jose always reverse-geocode their displayed address, SF
per-parcel. Comparing the user's typed text against those compares Mapbox with
Mapbox (rule 11). Live, Chicago answers a search for `201 E Randolph St` with a
panel reading `11 N Michigan Avenue` — and that reads as CONFIRMATION. The address
and its provenance are now one value (`addressBasis`, required), so the two cannot
disagree.

### The decision, and why it was not a threshold

A null parcel address is an UNKNOWN, not a mismatch. Treating a data absence as
contradictory data would have refused every blank-address record and broken a
city's search to look rigorous. Warn, never refuse: the errors are asymmetric — a
false warning costs a glance, a false refusal costs the answer to someone who
typed a correct address, invisibly. Normalisation rules were written and
unit-tested BEFORE any measurement, explicitly not tuned against the sample, which
is what makes the resulting rate a measurement rather than a fit.

## 2026-08-12 — A harness that verified an unnamed subset, and why rule 21 keeps losing

### The isolation worktree ran without environment variables all session

Every commit this week was verified by applying its patch to a detached worktree
and running the suite there. That harness linked `node_modules` and nothing else,
so the worktree had no `.env`.

It surfaced only when the address-provenance work landed: austin, chicago and
sanjose reverse-geocode their displayed address, so without a token they publish
`addressBasis: 'none'` instead of `'geocode'`, and six tests failed on an
environment difference rather than a defect.

**Record this as a property of the harness, not a bug that was fixed.** Nothing
before today depended on an environment variable, so every prior isolation check
was green — but each was verifying a SUBSET of behaviour that neither the harness
nor its author could name. A green isolation run meant "this builds and passes
under whatever conditions the worktree happens to provide," and nobody had
enumerated those conditions. That it never mattered is luck, not design.

The general form: **a verification environment differs from the real one in ways
that are invisible until something depends on them.** The fix is not only to link
`.env` — it is to know what the harness provides and what it silently withholds,
because the answer determines what a pass means.

### Rule 21 is the most-violated rule here, and the violator is always the author of the retraction

Four instances in one day, each caught by the guard the correction existed to
satisfy: a ledger entry about stale ledger figures quoting the superseded tuple;
a `cities.ts` note about stale notes restating the retracted sentence; and twice
more today in retraction comments written while fixing the coverage claim.

The pattern is specific enough to name a cause. **Quoting feels like precision.**
Reproducing the false sentence reads as scrupulous — showing the work rather than
paraphrasing away the evidence — and that instinct is correct nearly everywhere.
It fails here because the artifact being edited is also the corpus someone will
scan, so a verbatim quote is indistinguishable from a live claim to any reader
who meets the sentence before the frame around it.

Precision about a retracted claim means being exact about WHAT IT ASSERTED, not
exact in its words. The rule now says so, because four repetitions by four
different authors is a design problem rather than four lapses.

### The Denver Protected District buffer: two reads that had to agree, and a green test guarding a figure no parcel could obtain

Nine Denver campus districts publish a height conditioned on DISTANCE — CMP-H is
200 ft generally and 75 ft within 125 ft of a Protected District (DZC
§ 13.1-13.B). None of them resolved to anything, because the distance is a fact
about where the parcel sits and nothing we fetched carried it. Closing that meant
a second live query, buffered off the parcel geometry, against a set of 39
Protected District codes enumerated from both the current DZC and the frozen
former Chapter 59.

**The spatial reference lives on the FeatureSet, not on the geometry.** Denver
returns Web Mercator (wkid 102100) unless `outSR` is asked for; the first wiring
declared `inSR=4326` against those coordinates and every buffer query failed.
Worth recording is how it failed: `protectedDistrictWithin` is three-state, and a
failed query returns `null`, never `false`. Both live parcels came back with no
height rather than the taller figure. **The guard did the only job it exists for
— an unresolved distance never became "no Protected District nearby"** — and the
answer was simply unobtainable until the SR was threaded through.

Verified afterwards in both directions on live parcels through `getParcelInfo`,
which is the only place the disagreement would have shown: CMP-H outside its
buffer publishes 200 ft, CMP-EI inside its 175 ft buffer publishes nothing. The
inside case is deliberate and is not a missing branch. § 13.1-13.B caps "all
portions of a Structure … within" the buffer, so on a partly-overlapping parcel
the limit VARIES ACROSS THE SITE; 75 would understate the far side and 200 the
near side, and `maxHeightFt` can carry one number. A known-near parcel is routed
to the same refusal as an unresolved one.

**Then the instructive part.** `CMP-NWC-R` is the one campus district with no
reduction — 40 ft flat, whatever is next door — and it was excluded from the
buffer rule for that reason. A unit test pinned the positive half: the resolver
returns 40 ft at all three states of the distance flag. It passed, and it had
been passing the whole time, while **no live parcel in that district could obtain
40 ft from anywhere.** The provider ran the resolver only inside
`if (bufferRule)`, so a district with no rule was never resolved at all.

That is rule 11 for the fifth time, in its cheapest disguise. The test called the
resolver directly; nothing on the parcel path did. It reads as coverage of the
behaviour and is coverage of a function — and it was written *in the same hour*
as the rule-11 fixes to three probes, by someone who had just been bitten by it.
Both halves of the assertion were correct in isolation; only the caller was
missing, which is exactly the shape that survives review.

Two things changed as a result, and only the second is a fix:

1. `protectedDistrictWithin` is **module-private again**. It was exported to run
   the live both-directions check and nothing outside ever needed it. A reachable
   helper invites a test that bypasses the pipeline, which is the mechanism above.
2. Every test of this behaviour now goes through `getDenverParcelInfo`, including
   the CMP-NWC-R case — which additionally asserts **no buffer query is issued**,
   so the district cannot start silently spending a request it has no use for.

The sweep still counts all nine campus districts unhandled and now says why:
`scopedTo: code-only`. Proximity is a per-parcel fact and the sweep has no
parcel, so Denver's 58 UNDERSTATES what production resolves. That is the safe
direction, and it is declared rather than left silent — the opposite arrangement,
crediting a height the sweep cannot establish, is the defect the legacy
`formerChapter59` flag was added to fix.

### The act of declaring a scope erased forty-six real gaps

One commit after the Denver buffer work, the sweep total fell 753 → 695 with no
code change. The cause was the declaration added in that commit: `scopedTo` is
**all-or-nothing**, so a note explaining Denver's nine CMP campus districts
removed all fifty-eight of its unhandled codes from the total.

Worth being precise about what went wrong, because the intent was correct. Rule
26 says report the composition and say whether the system changed or the counting
did; the note existed to satisfy exactly that, and the mechanism it reached for
could not express "part of this target". The remaining forty-six — twenty-four
former Chapter 59, twelve downtown, and ten others — are genuine gaps and were
silently excused alongside the nine that were not.

**A falling total is the one to distrust, and this is the reason.** The drop was
produced by an act that feels like honesty. Nothing about adding a scope note
resembles hiding something, which is why it needs a mechanism that cannot do it
by accident rather than a reader who remembers to check.

`partiallyScoped` now subtracts only the values its predicate names and prints
the split — `55 unhandled · 9 declared out of scope · 46 count as gaps`. It also
FAILS when the predicate matches nothing, because a scope that quietly stops
matching returns the target to its full count and reads as a regression that
never happened (rule 20). The nine CMP codes are pinned by membership, not by
count.

The same reconciliation surfaced a second miscount in the opposite direction.
Denver's `handled` predicate tested `heightFt != null` alone, so `I-A` and `I-B`
were counted as gaps while the module resolves both at FAR 2.0, and `OS-A` while
it is flagged plan-governed. Denver is height-governed, which is precisely why
the narrow test looked right — the sweep was applying to itself the error rule 5
exists to prevent, rendering a resolved answer as a missing one.

Both corrections reconcile exactly: 753 − 3 answers wrongly counted as gaps − 9
genuinely out of scope = **741**. Neither is a parser fix, so the system has not
moved; the counting has, twice, in opposite directions.

### Article 8 Downtown: twelve districts read, and a FAR the provider had been discarding

Denver's twelve downtown codes were the family left uncurated when Chapter 59 was
stopped, on a stated rationale: each district carries several building forms with
different heights, the wide-grid shape that produced DC's MU-column off-by-one.
Reading Article 8 (republished February 25, 2025) settled it in both directions —
for D-AS-12+/20+ the GENERAL and POINT TOWER tables print the SAME pair, so there
was no grid to flatten, and where the concern was real it was real about exactly
one district.

**The naming trap held.** D-AS-12+ is EIGHT storeys at 110 ft and D-AS-20+ is
TWELVE at 150 ft. Denver's own convention makes 12 and 20 the intuitive readings
— C-MX-5 really is five storeys — so this is rule 27's collision-by-construction
rather than bad luck, and both are pinned.

**The slot test worked at the level of a table heading.** Article 8 heads a
building-form table "HEIGHT AND FLOOR AREA" where a ratio applies and "HEIGHT"
where none does. That is the document distinguishing the two states itself, and
it is what makes D-CPV-C the one district in its family that is FAR-*unresolved*
rather than FAR-*unconstrained*: it has a STANDARD TOWER form its siblings lack,
headed "HEIGHT & FLOOR AREA RATIO", carrying 20.0. A ratio exists there in one
form, nothing we read says which form a project will use, so the positive claim
that no FAR applies would be false.

Two districts refuse a height and it is not a gap. § 8.3.1.4.B.2 leaves D-C and
D-TD unlimited "except in the following height areas as shown on Exhibit 8.1" —
200 ft and 400 ft areas plus a sunlight preservation area. Denver's zoning
service publishes four layers and none carries that exhibit, nor does
OVERLAY_DISTRICT, whose 45 live values are use/design/conservation overlays. "No
height limit" would be wrong by 2x inside Height Area 1, in the flattering
direction, so the height is withheld while the FAR — the binding by-right figure
— resolves. D-LD and DIA refuse everything and name where to look instead
(§ 8.4.1.3.B sends D-LD to DRMC Chapter 30; § 9.5.2.1 gives DIA to the Manager of
Aviation).

**Then the find that had nothing to do with downtown.** `maxFAR` was hardcoded
`null` in `providers/denver.ts` beneath a comment reading that Denver's
form-based code has no FAR. That was true of Articles 3-7 — the entire curated
table when the line was written — and false from the moment Article 9 was read.
`I-A` and `I-B` have resolved FAR 2.0 in the zoning module since then, and **every
live industrial parcel published nothing.**

Nothing failed. No null looked suspicious, because null is the correct answer for
most Denver districts and this one was indistinguishable from the rest (rule 18
inverted — a plausible ABSENCE gets no more scrutiny than a plausible answer).
The zoning module's tests were green throughout and were right: they asserted the
resolver's return value, and the resolver was correct. The loss was entirely in
the caller, which is rule 11 at its quietest — no probe, no sweep, no wrong
number, just a figure computed and dropped one call frame later. It surfaced only
because a live parcel was checked end-to-end after the curation, and the number
that should have appeared did not.

Denver now resolves 141 of 184 live codes. Of the remaining 43: nine CMP campus
districts declared out of scope, twenty-four former Chapter 59 still deliberately
uncurated, ten others. The sweep total moved 741 → 729, and this is the first
movement tonight that a code change produced.

### The guard was fixed in the instrument and left broken in production

Denver's former Chapter 59 district codes carry a CLASS number, not a storey
count: `R-2` is the second business class, `B-3` the third, `C-MU-20` the
twentieth. Reading those trailing numbers as storeys and multiplying was the
defect that produced this session's earlier sweep correction, and it was fixed
there — `resolveDenver` refuses them when handed `{ formerChapter59: true }`, and
`providers/denver.ts` derives that flag from `ZONE_USE_FORM` and
`ZONE_DESCRIPTION`, fields only the provider can see.

`resolveZoningLimits` called the same resolver a **second time**, with the
district code alone and therefore no flag, as a fallback for anything the
provider left null. Measured live through `getParcelInfo` + `computeEnvelope` on
real parcels:

| district | provider | published envelope |
|---|---|---|
| R-2 | withheld | 24 ft / 2 storeys |
| B-3 | withheld | 36 ft / 3 storeys |
| C-MU-20 | withheld | **240 ft / 21 storeys** |

with `farUnconstrained: true` alongside — asserting no FAR applies to districts
this repo elsewhere records as ones that DID impose it. C-MU-20 also shows the
round-trip compounding: 20 class → 240 ft at 12 ft/storey → 21 storeys at 11.

**Every component was correct.** The provider refuses correctly and its tests
prove it. The resolver refuses correctly when told. The curated figures are right.
The defect existed only in a second caller that could not know what the first one
knew, and `maxHeightFt: null` arriving at that caller is the NORMAL case for most
Denver districts — so nothing looked wrong. That is rule 5 one layer down: null
meant "known to be unobtainable" and was read as "nothing known yet."

Three things worth keeping from how it was found. It was **not** found by looking
for it: the search was for the Denver FAR-dropped-in-the-caller shape in other
cities, and this turned up while reading the file that would have answered that
question. The cross-city audit itself came back clean — five providers hardcode
`maxFAR: null` and their Limits types carry no FAR field at all, and Chicago's
hardcoded `maxHeightFt: null` is by design, since §17-3-0408-A's flat 38 ft
arrives through this very fallback. And the fix is structural rather than
another argument: Denver's entry now resolves nothing, so the city has **one**
caller of its table instead of two.

**A guard that lives in an argument is only as strong as the callers who pass
it.** The sweep and production were two callers of one resolver; the sweep was
audited and corrected, and the audit stopped at the instrument. When a fix
consists of passing a flag, the question is not "did I pass it here" but "who
else calls this, and can they know what to pass?" — and where the answer is no,
the fix is to remove the caller, not to document the requirement.

### An audit's scope is itself a claim, and both of tonight's audits were narrower than they read

Two follow-ups to the `resolveZoningLimits` defect, and they are the same lesson
twice.

**"I checked all callers" meant "all callers in the instrument."** The parser-domain
sweep and production were two callers of `resolveDenver`. The audit that caught
the missing `formerChapter59` flag enumerated the sweep's call sites and stopped,
so the identical bare call in `resolveZoningLimits` survived being looked for. The
durable fix is not a better audit: `denverResolverWiring.test.ts` now asserts
Denver's table has exactly ONE production caller, pinned by filename, and that
that caller passes the flag. Verified by reintroducing the second caller and
watching it go red. A third caller would otherwise arrive the way the second did —
someone needing a Denver figure, reaching for the resolver, with no way to know an
argument carries the correctness.

**And the coarse-scope audit had the same shape.** `partiallyScoped` fixed the
MECHANISM after a Denver scope note erased 46 gaps, but the six declarations
already in the file were never re-examined. Auditing all six: three are accurate
and three were doing exactly what the Denver note had done.

| target | unhandled | the scope actually names | excused with no basis |
|---|---|---|---|
| seattle (NC/C only) | 105 | 105 | — |
| chicago (residential only) | 1,462 | 1,462 | — |
| nyc (PLUTO supplies FAR) | 168 | 168 | — |
| atlanta | 179 | 169 | **10** |
| austin | 41 | 36 | **5** |
| sandiego | 155 | 16 | **139** |

Austin is the sharpest: its scope reads "Subchapter F single-family zones only"
while five SINGLE-FAMILY zones sat unhandled beneath it — SF-4A, SF-4B, SF-5,
SF-6, SF2. A sentence cannot excuse the very thing it names. Whether § 25-2
Subchapter F reaches those four is unread, and is deliberately not assumed either
way; they count as gaps until someone looks, which is where a declaration should
leave an open question rather than closing it by omission.

San Diego was reconciled before the total moved (rule 25). Of its 139, sixty-eight
are Planned District Ordinances — CCPD, CSPD, CUPD, CVPD, GQPD, LJPD, LJSPD,
MBPD, MPD — which are very likely the planned-development answer shape and for
which `isPlannedDevelopment` currently returns false on all sixty-eight. That is
identified work with a known shape, not a conclusion: writing it in as an answer
would be a mechanism argued aloud earning a direction (rule 1). The other
seventy-one are plain gaps in the commercial, office, mixed-use and Old Town
families.

The total moved **729 → 883**, and the rise is the whole point. Every scope now
prints its split, and each of the six is pinned by BOTH numbers — what it names
and what it leaves — so a predicate cannot widen and quietly resume excusing the
remainder. A note in the `scopedTo` doc offering Austin as the model of a
legitimate target-wide scope has been corrected; it was the counter-example.

### Fixing the mechanism is not auditing its existing users

Twice in one evening a fix landed where the defect was noticed rather than
everywhere it lived, and the second time was in the correction to the first.

`resolveZoningLimits` published fabricated Denver heights because it was a second
caller of a resolver whose guard lives in an argument. The audit that had found
that guard missing enumerated the SWEEP's call sites — its scope was itself a
claim, and "I checked every caller" meant "every caller in the instrument."

Then `partiallyScoped` was written because a coarse `scopedTo` had erased 46 real
gaps. The mechanism was corrected and **the six declarations already using the
broken mechanism were not re-examined.** Three of them were doing exactly what the
note that motivated the fix had done, and the largest was excusing 139 of 155
values under a sentence describing 16.

The distinction worth holding: correcting a mechanism and auditing its existing
users are two pieces of work, and finishing the first feels like finishing both.
It reads as done because the thing that produced the defect can no longer produce
it — while every artifact built with the old mechanism still carries it.

### The total has been wrong in the reassuring direction more often than the alarming one

The parser-domain total has moved 2,294 → 1,009 → 1,010 → 717 → 734 → 753 → 741 →
729 → 883. Only one of those movements was a code change (741 → 729, the Article 8
curation). The rest are corrections to how the sweep counts, and they divide
cleanly by direction:

- **Reductions were reconciliation.** Planned-development codes are answers, not
  gaps (Dallas 1,031 → 31); Atlanta's SPI exclusion was documented; Charlotte's
  site-plan basis was already a reason code. Each removed something that had been
  miscounted as broken.
- **Rises were things that had stopped being counted at all.** San Jose was being
  skipped; nineteen Denver legacy codes were credited with storey counts the code
  never states; three coarse scopes were excusing 154 values they never named.

Four rises now, and every one of them honest. The pattern that matters is the
asymmetry: a falling total looks like progress and needs the most scrutiny, while
a rising one is nearly always the instrument admitting it had been generous. Rule
26 says to report the composition and say whether the system changed or the
counting did — and after nine movements, the counting has changed eight times.

### San Diego's planned districts: read before enrolling, and the reading said don't

The 68 codes flagged as likely plan-governed were read against Chapter 15 of the
Municipal Code before anything was enrolled. Both halves of the triage were wrong.

**They are not plan-governed.** The hypothesis was the Denver-PUD / Dallas-PD
shape — a limit existing in an ordinance outside any district table, where the
honest output is `planGoverned`. But San Diego's "planned-district ordinances"
ARE Chapter 15 of this Municipal Code: each article publishes Property
Development Regulations as tables, in the code, for named zones, and all ten
carry height and floor-area provisions (Centre City mentions floor area 109
times). Enrolling them would have asserted "go read another document" about
figures inside a chapter already read for this city — a fabricated known absence,
the most expensive error class here. They are curatable gaps.

Worth noting what invited the error: the module's own scope note described these
as districts "whose FARs are set by their own planned-district ordinances." That
sentence is true in a sense and misleading in the sense that matters, and it is
where the hypothesis came from. The note was the source, not an innocent
bystander.

**And there are 83, not 68.** Old Town's fifteen codes were bucketed as ordinary
gaps because their names carry no "PD". Old Town is Article 16 of the same
chapter and all fifteen are named in it — including `OTOP 1-1`, printed with a
SPACE where the layer uses a hyphen. Their shape matches the Chapter 13 base
zones instead (`OTRS-1-1` beside `RS-1-1`), which is exactly what made the
misgrouping plausible: rule 27, and this time the prefix hid a family rather than
inventing one.

**`MPD-MARINA` is a live code for a repealed district.** Article 11 and its
Division 3 both read "(Repealed 6-21-2019 by O-21086 N.S., effective 8-8-2019.)"
and contain no standards at all, yet the zoning layer still publishes the code.
An empty article is the shape most likely to be misread as "no FAR applies here,"
so it is asserted NOT `farUnconstrained`. Its editor's note adds that the repeal
does not reach the Coastal Overlay Zone until the Coastal Commission certifies a
Local Coastal Program Amendment — so what governs such a parcel depends on a
certification status nothing here reads.

**Neither published index is complete**, which sharpens rule 8. The rule says to
read indexes rather than guess paths; here the Table of Contents lists Article 16
but omits Articles 2 and 11, while the Chapter 15 web page lists 2 and 11 and
omits 16. Reading either alone yields a confident wrong answer — the ToC would
have said Marina was repealed *and never existed as a document*, the web page
that Old Town does not exist. Article 16 (95 pages, dated 7-2026) was confirmed
only after the two disagreed and the section number the ToC itself gives
(§1516.0101) was tested. **An index is a claim too.**

The sweep total is unchanged at 883. The composition moved and the count did not,
which is the reporting rule 26 asks for.

### A test that calls a resolver directly tests the resolver

`CMP-NWC-R → 40 ft` was green while no parcel could obtain 40 ft, because the
test called the resolver and nothing on the parcel path did. Generalised at export
granularity and made mechanical: `orphanExports.test.ts` scans every exported
function in the zoning modules and fails on any that no production file reaches,
unless declared with a reason.

Three of 61 are orphans, and the check earned itself on the second one:

- `isDenverProtectedDistrict` — set membership only; production asks
  `denverProtectedDistrictRule` and then runs the spatial query.
- **`plannedDevelopmentSource`** — builds the sentence naming WHICH ordinance
  governs a PD parcel and where to read it. Nothing calls it. `envelope.ts`
  explains that this is the entire reason `planned-development` is preferred over
  `basis-unavailable` — "the limit is in that ordinance" is actionable — and the
  panel instead renders a hardcoded paragraph with the general claim and no
  citation. So the actionable half is computed and discarded, and one claim now
  has two sources that can disagree. Not wired: it returns a sentence only for
  Dallas and Chicago, and Dallas's runs past 400 characters including a quoted
  excerpt of § 51A-4.702. That is a copy decision, not a wiring fix.
- `sanDiegoPlannedDistrict` — inventory for the Chapter 15 triage; resolves no
  limit.

The first version of the scan reported **fourteen** orphans, eleven of which were
internal helpers like `sanDiegoZoneKey` that their own resolver calls one line
down — it excluded same-file callers. That is rule 11 inside the check written to
enforce it, for the second time in this repo. The committed version counts uses
anywhere in production including the defining module, and is verified by adding an
undeclared export and watching it go red.

### Austin: the declaration contradicted itself, and the cause was not the one the contradiction implied

The scope read "Subchapter F single-family zones only" while five single-family
zones sat unhandled beneath it. That contradiction was real and the diagnosis
drawn from it was wrong: it implied § 25-2 had not been read.

§ 25-2 had been read — value-by-value on 2026-08-05 against § 25-2-492(D), with
SF-4A at 35 ft (§ 25-2-779(D)(3)) and SF-4B at two storeys (§ 25-2-558(G))
encoded and cited in `AUSTIN_LIMITS`. **SF-4A publishes 35 ft on a live parcel
today.** The sweep's predicate called `austinSfLimits`, which serves SF-1/2/3 and
returns null for everything else, while the provider falls through to the base
table at `maxHeightFt: sf ? sf.maxHeightFt : lim.h`. So it reported 41 of 44 codes
unhandled for a module carrying 37 cited districts. Fourteen actually are.

Rule 11 again, with a detail worth keeping: `austinLimits` was **module-private**,
so the sweep could not have called the real path even had it tried. The fix is not
a better predicate but one shared function — `austinResolvedLimits` now holds the
`sf ?? lim` composition and both the provider and the sweep call it. Letting the
sweep re-implement that composition would have put it in two places, which is the
duplicate-parse shape that let Seattle's MIO height drift out of agreement with
itself.

Then the scope had to be rewritten a second time, because the first rewrite's
predicate (`excuse anything not starting with SF`) would have excused eight codes
with no basis — reintroducing, four commits later, the exact defect that motivated
`partiallyScoped`. The excused set is now the six absences the module documents
itself: W/LO and CH are footnote pointers to unresolved regulations, PUD/DR/AV/P
vary case-by-case. Austin's gap contribution went 5 → **8** while its unhandled
count went 41 → 14.

**And the parcel counts found the substantive item, which the code counts had
hidden.** `SF2` — no hyphen — is 715 live parcels. Its ZONE_NAME is "Single Family
Residence - Standard Lot", identical to SF-2's, and its ZONING_ZTYPE is `I-SF-2` /
`I-SF-2-NP`: Austin's INTERIM designation, for which the layer drops the hyphen in
BASE_ZONE. Not aliased to SF-2. That the district is SF-2 is established from the
layer's own descriptive fields; whether interim status changes the site
development regulations is not, and an alias would publish 35 ft on 715 parcels on
the strength of a naming pattern (rule 27). It stays a gap with its evidence
recorded.

That is the argument for parcel-weighting the sweep. Among Austin's fourteen,
`SF2` at 715 parcels and `PUD` at 986 dwarf `TND` at 2 and `AG` at 4 — and the
code-weighted total treats them identically.

### The composition check, and the reflex that survives the fix

Three variants of one shape had each been found by investigating a city: Denver
(the sweep omitted a flag), Minneapolis (the sweep hardcodes a parcel fact),
Austin (the sweep called one branch of a two-branch resolution). Austin was the
expensive one — a too-clean number pointing at the city, cause in the instrument —
and finding these one city at a time costs a source read per discovery.

The mechanical form: every parameter beyond the zone string is a PARCEL FACT, so
any parameter the sweep supplies as a constant or omits is something production
measures and the sweep is guessing. That is extractable from the declared
signatures. `sweepComposition.test.ts` now asserts all eleven such call sites are
declared with a reason, reconciling first against the three known cases.

**It found one nobody had looked for.** `resolveDallas(longCode, zoneDist)` tries
its second candidate when the first misses, and the provider passes both fields
while the sweep enumerates `LONG_ZONE_DIST` alone. Measured against the live 1,081
`LONG_ZONE_DIST`/`ZONE_DIST` pairs: exactly ONE of Dallas's 31 changes — `MU=1`, a
typo in the city's own field, an equals sign where a hyphen belongs, whose
`ZONE_DIST` reads `MU-1`. Rescuing that typo is precisely why the second candidate
exists. The `… Chap 51` holdovers correctly do not change: their `ZONE_DIST` reads
GR / MF-2 / O-2, Chapter 51 districts under Dallas's superseded code, which a
Chapter 51A module is not meant to cover.

Two failures of my own instruments are worth recording, because both were the
shapes this ledger already names.

**The namespace came from the wrong side.** The first version built its function
namespace from the SWEEP's imports, making it structurally unable to see a function
the provider calls and the sweep does not — so Denver, the motivating case, came
back clean. Third time a probe here has measured itself. The guard that caught it
was reconciling against known-good cases before believing the total, which is now
a test in its own right.

**And the declaration keyed on an address, not a claim.** With entries keyed
`city:function:argN`, changing `resolveSeattle(v)` to `resolveSeattle(v, 'inside')`
reused the existing declaration and stayed green — an OMITTED parameter and a
hardcoded WRONG VALUE are different facts at the same address, and the reason on
file ("omitting center understates in every one of 24 measured differences") says
nothing whatever about hardcoding one centre. Verified by planting both shapes and
watching them fail only after the argument itself became part of the key. This is
rule 20's lesson in a new place: pin the membership, not the slot.

### The mechanism was fixed and the reflex was not

Austin's scope had to be rewritten twice in one sitting. The first rewrite replaced
a self-contradicting scope with a predicate excusing anything not starting with
`SF` — which would have excused eight codes on no basis, reintroducing the exact
defect `partiallyScoped` was built for **four commits after** it was built, by the
author who had just fixed it for three other cities.

The mechanism now makes the error visible: the split prints, both numbers are
pinned. It does not make the error unavailable. Writing a families-based regex is
what reaching for a scope FEELS like, and that reflex was untouched by fixing the
counting. The pattern generalises past this file — a mechanism that reports
honestly still lets an author supply a dishonest input, so the check has to bind
the input too, which is why the excused set is now the module's own documented
absences rather than a shape I chose.

### Sweep-finished is "read or declared with a citation", and the first two cities were already there

Milwaukee and Nashville were the two smallest remaining, and neither needed a
source read. Both had already been read; the sweep simply could not see the
declarations, because `handled` tests for a resolved figure and a documented
refusal produces none.

**Milwaukee closed completely — 0 gaps.**

- `X`, 11 parcels, is not a district. The layer's own `ZoningType` reads "A
  problem has been identified with the zoning assigned to this parcel. Check with
  the City of Milwaukee's Department of City Development", under `ZoningCategory`
  TEMPORARY. `zoning/milwaukee.ts` carries it as `dataDefect` and
  `providers/milwaukee.ts` quotes that sentence to the user. **A data defect the
  city declares about its own data is an answer**, and a better one than a
  number — counting it as a parse gap says we failed to read something the city
  has said is unreadable.
- `PK`, 488 parcels, was read and deliberately left unresolved, with the sharpest
  statement of the slot test's limit in this repo: s. 295-903-3 gives the Parks
  district setbacks only, with no dimensional table. The DC and Philadelphia
  absences worked because a TABLE existed whose row structure lacked the row — the
  document's own structure was the evidence. Here there is no table whose
  emptiness could be evidence, so "the code sets no height in a park" would be a
  reader's failure to find something (rule 8). A gap, honestly rendered.

**Nashville: three of four declared, one held open.** DTC (23 polygons) and MHP
(1) carry the code's own words about where their standards live — § 17.12.020
Tables B and C read "See Chapter 17.37" and "See Ch. 17.16". Satellite City (5) is
not a district at all: those are the independent municipalities inside Davidson
County, which Metro's Title 17 does not govern, and the provider already refuses
them as a jurisdiction question. DTC additionally needs two fields jointly — its
17 sub-districts arrive in the layer's NAME field — which is rule 13 and the
per-subarea grid shape that produced DC's MU-column off-by-one.

**`I` is held open, and the reason is worth recording.** Its single polygon is 138
acres, zoned by Ordinance BL2000-303 in 2000, and `I` is not among the current
table's industrial districts (IWD, IR, IG) — which points at a legacy code. But
the module also quotes "Table C Note 1: the I district becomes 1.50 inside the
UZO", which would make it current. Both cannot be true.

The source could not settle it: `nashville-tn.elaws.us`, the publisher this module
cites, timed out on two isolated probes at 45s and 90s; Municode answers HTTP 200
with a 6 kB JavaScript shell and no ordinance text; amlegal returns 403; and the
browser pane was denied the host. **A host that will not answer is not evidence
about a district.** Recording the unreachability and leaving `I` a gap is the only
honest option — the alternative, reasoning from "it is not in the current table"
to "it is legacy", is a conclusion from a reader not finding something, which is
the same error the Milwaukee PK note refuses to make one paragraph above.

Total 886 → 881. Both movements are counting corrections and both are falls, which
is the direction to distrust — justified here only because every code removed was
verified to carry a citation in the module already.

### `handled` tested for a figure, so a documented refusal read as a gap

Milwaukee and Nashville both closed without a source read because both had
already been read — the sweep simply could not see a declaration. That is not a
property of those two cities, so it was checked across all of them.

**91 of the 870 counted gaps were already named in their own module.** Naming is
not citing, so each was inspected rather than credited by family, and they split
three ways.

**Credited — 52 codes, every one carrying its own citation.** Las Vegas's C-V,
P-C, PD, R-PD, T-C and T-D families (36 moved of 37 that exist) and Phoenix's
PUD, PCD and PAD-2…PAD-15 (16). Each is cited to a subsection with the quoted
text — LVMC 19.10.020(E)(1), 19.10.030(E)(2), 19.10.040(F), 19.10.050(B)(1),
19.10.060(B)(2); Phoenix §671.A, §671.B.2, §636.D.3, §636.E.1.b, §635. The
sweep's own header had said this all along — "`farUnconstrained` /
`heightUnconstrained` / `planGoverned` are answers under rule 5, not gaps" — and
it credits exactly that for Dallas and Chicago through `isPlannedDevelopment`.
Las Vegas and Phoenix establish it PER DISTRICT in their own modules, which
`envelope.ts` describes as the intended arrangement, so the registry check missed
all 52.

**The credit is bound to the citation, not to the boolean.** A `planGoverned:
true` with nothing saying which instrument governs is not the sweep-finished
state — it asserts a limit exists somewhere, which is what `basis-unavailable`
already says and is the weaker of the two reason codes by `envelope.ts`'s own
argument. The predicate requires a source string; the test checks it per code.

**Refused — Miami's 10, and refusing them is the finding.** Ten of Miami's
thirteen resolve `farUnconstrained: true`, established properly by the slot test
on Article 4 Table 2's FLR row plus Illustrations 5.3–5.10 each reading "Floor Lot
Ratio (FLR) N/A", re-verified by rendering the primary document. Crediting them
would have closed the city. But that target measures HEIGHT and stories, and
`zoning/miami.ts` says outright that "HEIGHT is untouched and stays a gap: Table 2
states T4/T5/D heights in STORIES and the GIS layer populates `Bldg_Height` only
for T6". **An answer to a different question is not an answer.** The same
reasoning withholds Las Vegas's five `farUnconstrained` codes from its height
target. Miami's remaining three are cited gaps of a different kind: CI and CS
defer to the ABUTTING transect zone (§ 5.7.2.4(b)), which is rule 13.

Two instrument errors on the way, both mine, both familiar shapes. The first
audit script built its namespace from the sweep's own imports and so could not
see a function the provider calls and the sweep does not — Denver came back clean.
The second guessed `heightSource` for Las Vegas's citation field when the module
calls it `planSource`, so the credit silently did nothing and Las Vegas did not
move; caught only because the expected total did not appear.

Total 881 → **829**. The largest single-session fall, and every code removed was
verified to carry its own citation individually.

### Refinement to rule 5: a source with no table fails the slot test's precondition

Milwaukee's PK note is the sharpest statement of the slot test's limit in this
repo and belongs in the rule. The DC and Philadelphia absences worked because a
TABLE existed whose row structure lacked the row — the document's own structure
was positive evidence. Milwaukee's Parks district has no dimensional table at all:
s. 295-903-3 gives setbacks only.

So there is nothing whose emptiness could be evidence. "The code sets no height in
a park" would be a conclusion drawn from a reader not finding something, which
rule 8 forbids. **A source with no table does not pass the slot test; it fails the
test's precondition** — the test asks whether a slot exists and is unfilled, and a
document with no slots at all cannot answer it either way. The honest output is a
gap, which is what the module publishes.

### Philadelphia: the first primary-source read this module has had

`zoning/philadelphia.ts` had never read Title 14. Every figure in it came from the
city's derived `ZoningCodeCharacteristics` table, which is the module's stated
source. Reading the ordinance (American Legal, current through May 25 2026 with
amendments through June 23 2026) confirmed two things and corrected a third.

**The RMX rejection is right, and now for a structural reason rather than a
reading of the phrasing.** § 14-701(2) Table 14-701-2 states the denominator ONCE,
in the row header — "Maximum Floor Area (% of lot area, except as otherwise
provided)" — and RMX-1 and RMX-2 are the two cells providing otherwise, in the
code's own words: "150 of district area, excluding streets" and "250 of district
area, excluding streets". The source distinguishes the two denominators inside a
single row, which is the same species of evidence as the slot test. Independent
confirmation from a second row: "Min. District Area (acres)" reads 2 for RMX-1 and
1 for RMX-2 and is empty in every other column, so these really are minimum-area
districts whose ratio is measured across the district. 8 and 13 polygons.

**The ten Table 14-701-1 slot-test citations hold.** All four dimensional tables
were checked for a Floor Area row: 14-701-1 has NONE, while 14-701-2, -3 and -4
each have one. The row is present exactly where the instrument applies, which is
what makes 14-701-1's absence evidence rather than a reader's failure to find.

**RM-1's citation was wrong while its conclusion was right — 3,768 polygons.** The
module read: the "Max. Height / FAR" cell holds 38 ft only, an absence INFERRED
from a combined cell. There is no combined cell. Table 14-701-2 has a separate
"Height / Maximum (ft.)" row where RM-1 reads 38, and a separate Floor Area row
where RM-1 reads **"No Limit"** in words. A stated absence outranks an inferred
one, and the difference is not cosmetic: a reader sent looking for a combined cell
would not find one and might doubt a correct entry.

Worth noting what the derived table loses. RM-1's `MaxFAR` in
`ZoningCodeCharacteristics` is **null** where the ordinance says "No Limit" — the
city's own derived artifact renders an established absence as a missing value.
That is rule 5 at the data layer, and it is invisible to anyone reading only the
table. It cost nothing here because the module already carried RM-1 in its
no-FAR list, but the general lesson is that a derived table cannot distinguish
"the code says no limit" from "nobody filled this in".

Ten strings declared, Philadelphia closes to 0 gaps. Total 829 → 819.

### `explains: () => true` is a target-wide scope wearing the partial mechanism's name

Declaring Philadelphia's seven height strings, the predicate was written as
`() => true`. All seven are enumerated with reasons, so excusing all of them was
correct on the day — and an eighth string arriving next month would have been
excused silently. That is precisely the defect `partiallyScoped` was built to
prevent, reintroduced four commits later, by the author who built it. Second
instance of this exact reflex tonight; the first was Austin's `!/^SF/` predicate.

**Neither existing guard caught it.** The rule-20 check fails when a scope matches
NOTHING. The pinned split fails when the numbers move. A predicate matching
EVERYTHING trips neither, because both are assertions about counts and this is a
property of the function.

The new check is behavioural rather than numeric: every partial scope is fed
values that are not in its enumeration and must reject them. Verified by
restoring the catch-all and watching it go red. The lesson generalises past this
file — **a guard on the output of a function cannot see a fault in its domain**,
so where the thing being declared is a rule rather than a value, the check has to
exercise the rule.

### The derived-table exposure, measured: Philadelphia was the only one

RM-1's `MaxFAR` is null in the city's `ZoningCodeCharacteristics` table where the
ordinance says "No Limit". A derived table cannot distinguish an established
absence from an unfilled cell, and Philadelphia's whole module was built on that
table — so the question is how many other cities read a derived layer as their
source of truth.

Seven providers take a limit from a live field: Philadelphia (MaxFAR/MaxHeight),
NYC (ResidFAR/CommFAR/FacilFAR from MapPLUTO), Denver (HEIGHT_STORIES), Miami
(Bldg_Height), San Jose (HEIGHTLIMIT), Raleigh (HEIGHT), Columbus
(HEIGHT_DISTRICT).

**The dangerous direction is clean.** No provider converts a null or absent
derived field into an unconstrained claim. NYC's `num()` returns null for anything
≤ 0, so PLUTO's "not applicable" zeros become gaps rather than ratios, and
`Math.max(...) || null` collapses the rest. Every `farUnconstrained: true` in every
provider comes from an ordinance-sourced module — checked by grep across all of
them — never from a live field. A missing derived value always degrades to a gap.

**The remaining exposure runs the honest way**, and is structural only where a
module has no ordinance-sourced table behind the derived field. Philadelphia was
the only such module: Denver, Miami, Columbus, Raleigh and San Jose each fall
through to a curated table cited to their code, and NYC's PLUTO figures are
numeric readings rather than an absence claim. Austin, DC and LA have no
`zoning/<city>.ts` at all, but that is file organisation — `AUSTIN_LIMITS` is cited
value-by-value to § 25-2-492(D).

So the answer to "how much of the remaining total is provisional" is: the one city
whose module was derived-only has now been read, and no other city can inherit the
RM-1 shape without first losing its curated table.

### Atlanta: all ten were already read, and four of them do not exist

Reconciling before reading was right — no document was needed.

**Six were credited by fixing the predicate.** LW, LW-C, MRC-1, MRC-1-C, MRC-2 and
MRC-2-C resolve a cited FAR (§16-33.009(1)(a), §16-34.026(1)(a), §16-34.027(1)(a),
sub-capped by §16-34.010 Table A) and were counted as gaps because their HEIGHT
returns as `heightTiers` rather than a scalar. The tiers are Atlanta's
protected-district rule — 35 ft within 150 ft of a protected district, 52 ft to
300 ft, 225 ft beyond — which is Denver's CMP shape exactly, and
`providers/atlanta.ts` already discloses every tier while withholding the scalar.

This target is named for height AND FAR, so a resolved FAR answers half of what it
asks. That is the distinction from Miami, whose target is height and stories only
and whose `farUnconstrained` therefore answers nothing it asks.

**Four are not uncurated — Part 16 never established them.** PD-H1 (37.2 ac),
MR-4-C (16.1), PD-H2 (10.1) and MR-3A-C (3.6) are mapped by the city and absent
from the ordinance: Chapter 35 establishes MR-1, MR-2, MR-3, MR-4A, MR-4B, MR-5A,
MR-5B, MR-6 and MR-MU — no MR-4, no MR-3A — and Chapter 19 establishes PD-H,
PD-MU, PD-OC, PD-BP and PD-CS, with no PD-H1 or PD-H2. The code's own district
roster is the positive evidence, which is the slot test applied to a list rather
than to a table row. They stay UNRESOLVED and specifically not
`farUnconstrained`: a code the ordinance never created says nothing about whether
a limit applies.

Atlanta closes to 0 gaps. Total 819 → 809.

### San Diego Chapter 15: ten codes read, and the slot test passing where Milwaukee's failed

Three of the six small articles are done — Cass Street (1 code), Mission Beach (6)
and La Jolla Shores' single- and multi-family zones (3). Each Division 3 was
fetched from the Chapter 15 page with its byte count checked against
Content-Length, and each carries its own amendment vintage, recorded per entry:
Cass Street 8-2018, Centre City 7-2026, Gaslamp 7-2026, La Jolla 1-2014, La Jolla
Shores 4-2024, Mission Beach 2-2025. These articles are revised independently, so
a 2014 stamp is a stable article rather than a stale copy — but it is recorded
either way, because that is the difference between knowing and assuming.

**La Jolla Shores reuses a table already implemented.** § 1510.0304(i)(1)(A) sends
the single-family zone to Table 131-04J — the same lot-area band table
`RS_FAR_BY_LOT_AREA` holds for the RS base zones. Verified band by band against
the article's own printed table (0.70 / 0.65 / 0.60 / 0.59 … 0.45): identical.
Reused rather than re-transcribed, which is one fewer place for the bands to drift.

**And the slot test passes here, on the strength of the same distinction that made
it fail for Milwaukee's parks.** § 1510.0304 (Single-Family Zone – Development
Regulations) lists nine lettered items, the ninth being "(i) Maximum Floor Area
Ratio". § 1510.0306 (Multi Family Zones – Development Regulations) lists seven —
density, siting, building heights, lot coverage, off-street parking, signs,
landscape — in the same order and the same categories, with NO floor-area item.

Two parallel structures in one article, one carrying the item and one not. That is
the document's own structure as positive evidence. Milwaukee's PK failed the test
because s. 295-903-3 has no dimensional structure at all, so there was nothing
whose emptiness could be read; here there is a structure, and it is empty in a way
the neighbouring section proves is meaningful. Same rule, opposite outcome, and
the difference is whether a slot exists to be unfilled.

The FAR figures carry their programme labels rather than a maximum: Cass Street is
1.0 for exclusively commercial with 1.5 residential and 2.0 mixed as alternatives;
Mission Beach is 1.1 for 1–7 dwelling units with 1.25 for 8–10, and its commercial
subdistricts add nonresidential 1.25 raisable to 1.75 on a parking condition. In
every case the base is the lowest figure any permitted programme can reach, since
reporting the highest would assume a programme the user has not chosen (rule 6).

`LJSPD-SF` resolves but is declared rather than counted: the band is selected by
LOT AREA and the sweep has no parcel — confirmed live, a 5,000 sf lot returns
0.60. Declared for the reason already on file for the RS zones, not as a new one.

San Diego 139 → 129 gaps. Total 809 → 799. The pinned zone inventory moved 75 → 85
and the guard caught it, which is what a pinned inventory is for: a curated table
growing quietly is how an unsourced entry gets in.

### The Gaslamp near-miss: the provision was outside the phrase, not outside the article

A grep for "floor area ratio" across Gaslamp's Article 7 returns NOTHING, and the
first pass recorded that as "no FAR provision". The article states one — it just
writes the abbreviation:

  § 157.0107(a)(3) lets building height rise from 75 ft to 101 ft on parcels of
  20,000 sq ft or more, or 125 ft on 30,000 or more, "subject to the following:
  (A) The development shall not exceed an FAR of 6.0."

Exactly the Denver D-C/D-TD shape — a provision living just outside the phrasing
searched for, where a confident absence would have been recorded from a reader's
failure to find. Caught only by widening to `\bFAR\b`. **Search the abbreviation
and the phrase; a code that defines a term will then use it.**

And the placement is the substance: 6.0 is a CAP CONDITIONING A HEIGHT BONUS, not
a by-right ratio. No base FAR appears anywhere in the article's 9,471 words. So
GQPD is declared rather than encoded — publishing 6.0 would hand every Gaslamp
parcel a ratio the code grants only to projects taking the height increase.

### Centre City: the FAR is per-site and mapped, so no zone code can carry it

§ 156.0309(a) is unambiguous: "The minimum and maximum base FARs for each SITE
within the Centre City Planned District are illustrated in Figure H." Not per
district — per site, on a figure. CCPD-CORE and its nine siblings are therefore
not a lookup this module could ever satisfy, which is Denver's Exhibit 8.1 height
areas exactly. § 156.0309(c) adds one mapped exception, the Ballpark Mixed-Use
District at FAR 6.5, likewise a Figure B area rather than a zone.

The article was the most recently amended of the six (7-2026) and does carry the
base/bonus structure that downtown articles usually do — "Bonus FAR means the
additional floor area ratio…", § 156.0309(d) FAR Bonuses. None of it is
resolvable from a zone code, so the base/bonus discipline never became relevant.

### La Jolla: a table read straight, and "No restriction" in the code's own words

Table 159-03D "Maximum Base Density", column "Maximum Base Floor Area Ratio (FAR)
Permitted Per Lot": Zone 1 1.3, Zone 2 1.3, Zone 3 1.3, Zone 4 1.0, Zone 5 1.5,
Zone 6 **No restriction**. Six codes encoded.

Zone 6 is the Philadelphia RM-1 shape and the stronger form of it: the row exists
and is filled with a refusal to restrict, so `farUnconstrained` rests on a stated
absence rather than an empty cell.

§ 159.0307(c)(2) "Maximum Bonus Density" raises these for mixed-use projects
meeting a residential percentage. Base encoded, bonus NOT recorded as an
alternative — the bonus rules are condition-heavy and were not read closely enough
to state a figure, and a half-read bonus is worse than none.

**The three sub-areas are held open rather than inherited.** § 159.0301(a) creates
SIX zones; LJPD-1A, 5A and 6A are sub-areas "included in" their zone, identified
for orientation and use reasons. Whether the parent zone's FAR carries into a
sub-area is not stated in the passages read, and assuming it would be the prefix-
is-not-a-family error with a table to make it look sourced (rule 27).

San Diego 155 → 140 unhandled, 109 counted gaps. Total 809 → 779.

### A provision can be absent from a phrase and present in the document

Gaslamp's Article 7 returns ZERO hits for "floor area ratio" across 9,471 words,
and states an FAR. It writes the abbreviation: § 157.0107(a)(3)(A), "The
development shall not exceed an FAR of 6.0."

The sharper form of the lesson is not "widen the grep". A zero result for a
phrase is CONSISTENT with the document having no such provision, which is exactly
why it reads as an answer — and the reader has no way to tell the two apart from
inside the search. Three searches are needed and only two of them depend on
guessing the document's vocabulary:

  1. the spelled form ("floor area ratio")
  2. the ABBREVIATION the document itself defines and then uses (`\bFAR\b`)
  3. **the section structure** — the lettered/numbered item list of the
     development-regulation sections

The third is the one that does not require knowing what the document calls the
thing. It is how La Jolla Shores was settled (nine items with "(i) Maximum Floor
Area Ratio" against seven parallel items without it) and how Milwaukee's PK was
settled the other way (no dimensional structure at all). A search asks "does this
string occur"; the structure asks "is there a place where this would live", which
is the question rule 5 is actually about.

### A limit keyed to a MAP is a third reason, distinct from uncurated and from plan-governed

Three instances now, and they read alike:

  · Denver D-C / D-TD — § 8.3.1.4.B.2: unlimited EXCEPT in height areas mapped on
    Exhibit 8.1 (200 ft, 400 ft, plus a sunlight preservation area)
  · Denver CMP campus — § 13.1-13.B: the reduced cap applies within a stated
    distance of a mapped Protected District
  · San Diego Centre City — § 156.0309(a): base FARs "for each SITE … are
    illustrated in Figure H"

In all three the limit is REAL, PUBLISHED and NOT A FUNCTION OF THE ZONE CODE. It
is keyed to a map. That is a different fact from "we have not curated this
chapter" and a different fact from "an adopted plan governs":

  uncurated       — the figure is in a document nobody has read yet
  plan-governed   — the figure is in an instrument written per project, and NO
                    dataset will ever carry it
  map-keyed       — the figure exists in the code and depends on WHERE the parcel
                    is; a spatial layer would resolve it

The distinction has a practical edge: the Denver CMP buffer was closed this
session precisely because the map was queryable — the Protected District polygons
are in the same zoning layer, and a distance query turned a refusal into 200 ft on
a live parcel. Exhibit 8.1 and Figure H are not currently published as layers, so
those stay refusals, but they are refusals of the kind a data source could end.
A plan-governed parcel is not.

If these three ever render identically to a user, the tool is telling someone
"nobody knows" when the truth is "the code knows, and it depends where you are".

### The 56 base zones: 25 were already encoded, and the read confirmed the alignment risk was gone

Chapter 13 Divisions 2, 5 and 6 were fetched (all vintage 7-2026, all byte-checked
against Content-Length) to close the largest readable block in San Diego. The
reconcile came first, and most of the block did not need reading.

**25 of the CC commercial zones were already in `CC_FAR`**, complete with the
Otay Mesa machinery, and were being counted as gaps for a reason already declared
one line above them for the industrial zones. Table 131-05's footnote 3 reads
"Within the Otay Mesa Community Plan area, the maximum floor area ratio is 0.30",
which makes the ratio a joint function of zone AND community plan (rule 13), so
`commercialFar` returns UNRESOLVED when the plan is `undefined` — exactly what a
code-only sweep passes. Measured: all 25 resolve the moment any plan is supplied.
Two families with the same joint dependency, and the declaration had been written
for only one of them.

**The recorded blocker no longer holds.** The module's scope note says Divisions 2
and 5 were not encoded because "the four-row column header does not survive text
extraction". With `pdftotext -layout` it does:

    Zone Designator   1st & 2nd >>   CN-
                            3rd >>   1-  1-  1-  1-  1-  1-
                            4th >>   1   2   3   4   5   6
    Max Floor Area Ratio            1.0 1.0 1.0 1.0 1.0 1.0   (all footnote 3)

Six header columns, six values, and exactly six live CN codes — CN-1-1 through
CN-1-6. **The column count matching the live enumeration is the external check
against the DC MU-column off-by-one**, and it is available for every one of these
tables without trusting the eye. The blocker was real when it was written and is
now an artifact of the extraction flags, which is worth recording because a
documented refusal outlives the reason for it.

San Diego 140 unhandled, 84 counted gaps. Total 779 → 754.

### A blocker phrased as a TOOL limitation decays silently

`zoning/sandiego.ts` refused to encode Divisions 2 and 5 because "the four-row
column header does not survive text extraction". That was accurate when written.
It is false under `pdftotext -layout`, demonstrated against Table 131-05C, and in
the interval it functioned as a permanent exclusion — 56 codes, the largest
readable block in the city, held out by a claim nobody re-tested.

**This is a distinct failure shape from a stale citation.** A stale citation is a
claim about the world that the world changed. This is a claim about a TOOL'S
BEHAVIOUR, and tool behaviour changes with a flag — so it can be true and false in
the same week, on the same document, depending on how it was invoked. Nothing
about the source moved.

The tell is grammatical: a source limitation says what the DOCUMENT does ("Table
14-701-1 has no FAR row", "§ 156.0309 keys the ratio to Figure H"), and stays true
as long as the document does. A tool limitation says what WE could not do
("does not survive extraction", "runs together when flattened"), and expires the
moment the toolchain changes without anyone being told.

Audited the repo for the shape. Two more carry it, both untested since:

  · `zoning/phoenix.ts` — the 17 Downtown Code districts (DTC-*, 1,249 acres) and
    WU, held out because "flattened to text its per-frontage tables run together"
  · `zoning/atlanta.ts` — the SPI chapters, "flattened to text the columns run
    together"

Both are the same claim about the same tool, made before `-layout` was tried.
Neither has been re-tested and neither is asserted here to be wrong — they are
recorded as candidates, because the honest statement is that the reason on file
no longer establishes what it was written to establish.

**Rephrase a blocker as a fact about the source, or re-test it.** A refusal that
cites a tool needs an expiry date the way a fixture needs a `capturedOn`.

### The column-count cross-check is the general instrument

Reading Table 131-05C, three independent counts agreed before a single value was
taken: the table's own four-row Zone Designator header resolves to six columns,
every data row carries six values, and the live ZONE_NAME enumeration carries
exactly six CN codes. Only then were the figures read.

That agreement is an EXTERNAL check in rule 9's sense — the document's structure
against the city's own published data — and it is the check that would have caught
the DC MU-column off-by-one without anyone reading carefully. It costs one query
against a fixture already committed.

It is now standard for any table read here, not a Denver-specific habit:
**reconcile the header's column count against the live enumeration before
encoding a value.** Where they disagree, the disagreement is the finding.

### Phoenix: the expired blocker was also the wrong blocker

The re-test cost one browser page and settled 1,249 acres. Both halves of the
recorded reason failed.

**The extraction claim is dead.** `zoning/phoenix.ts` held the 17 Downtown Code
districts out because Chapter 12's per-frontage tables "run together when
flattened to text". `phoenix.municipal.codes` serves real HTML: § 1209's table is
50 rows by 7 addressable columns (Street Section, Minimum Setback, Frontage Zone
Depth, Minimum Building Frontage, Allowed Frontage Elements, Minimum Sidewalk
Width, Minimum Streetscape Zone Depth). Cell-by-cell reading is available and is
stronger than any flattening. Second confirmed instance of a tool-phrased blocker
outliving its cause — and note the retest did NOT need `-layout`, because this
source was never a PDF. The class generalises; the fix does not.

**And the table was never where the height lives.** It states setbacks and
streetscape. § 1209 and § 1217 both read "Maximum height: … governed by the height
map, Section 1202.B, and height transition standards of Section 1207.E", and
§ 1217 adds "Maximum density: governed by the density map, Section 1202.C".
Checked on two districts rather than one (rule 10).

So DTC is MAP-KEYED — the fourth instance, after Denver's Exhibit 8.1, Denver's
CMP Protected District buffer and San Diego's Figure H. Phoenix publishes no such
layer: all 178 services on maps.phoenix.gov were listed, and the only match,
`Public/WalkableUrbanCode`, carries `APPLICABILITY_AREAS` alone — whether the WU
code applies, not what height it sets.

**The sections do state figures, and that is the trap.** § 1217 gives "Accessory
structures, including accessory dwelling units: 30 feet" and "Maximum lot
coverage: 75 percent". Publishing that 30 as the district's height would answer a
different question than the one asked, in the flattering direction — the main
building is the map's business. Miami's refusal, one city over.

**WU is deliberately left counting.** It shared the retracted extraction reason
and its Chapter 13 sections have not been read, so it now has NO established
reason at all. Retracting a blocker does not transfer its coverage to whatever
else was hiding behind it — the honest state for WU is a gap with nothing said
about it, and it is worse than before the retest, which is correct.

Phoenix 25 unhandled, 17 declared, 8 gaps. Total 748 → 731.

The pattern across four instances is now firm enough to act on: a limit keyed to a
map is resolvable in principle and blocked only on the city publishing the layer.
Denver's CMP buffer was closed exactly that way this session. Exhibit 8.1,
Figure H and § 1202.B are three known asks, and they are the shape of a data
request rather than a reading task.

### "We could not extract X" is two claims, and the second is the cheap one

A blocker of that form asserts (1) that extraction failed and (2) that X was there
to extract. Only the first is ever re-tested, and the second is checkable WITHOUT
fixing the first.

Phoenix failed the second test. Its note held 1,249 acres out because Chapter 12's
per-frontage tables "run together when flattened" — and that table states setbacks
and streetscape. It never contained a height. A successful extraction would have
produced nothing, so the blocker could not have been right even on its own terms.

Atlanta passes it. `api.municode.com` returns Chapter 16-18P as 216,855 bytes with
eight `<table>` elements, the FAR grid is cell-addressable, and the FAR really is
in it. Its access reason has expired; its reading reason has not.

**And the fix does not generalise even though the class does.** Three instances,
three different remedies:

  San Diego  PDF     → `pdftotext -layout` recovers the columns
  Phoenix    HTML    → the page always had real tables; no flag involved
  Atlanta    JSON API → the payload carries HTML tables; no flag involved

Two of the three never needed the tool that fixed the first. So a tool-phrased
blocker cannot be cleared in a batch: **check the publisher before assuming the
last fix applies.** The audit finds the candidates; each one still costs its own
probe.

### Map-keyed: a category, not a gap

Four instances now, and they are one thing:

  Denver   § 8.3.1.4.B.2   height areas on Exhibit 8.1        D-C, D-TD
  Denver   § 13.1-13.B     Protected District buffer          9 CMP districts
  San Diego § 156.0309(a)  base FARs per site on Figure H     10 CCPD districts
  Phoenix  § 1202.B        the height map (and § 1202.C, density)  17 DTC districts

In each the limit is REAL, PUBLISHED, and a function of WHERE the parcel is rather
than of its zone code. That is not "uncurated" — there is nothing left to read.
It is not "plan-governed" — no per-project instrument is involved. It is:
**the instrument is spatial and the city has not published the layer.**

The category earns its own name because it is the only one whose coverage can
improve without anyone reading another document. Denver's CMP buffer proves it:
the Protected District polygons were already in the zoning layer, a distance query
closed it, and CMP-H went from a refusal to 200 ft on a live parcel in one
session. Nothing was read to achieve that.

So three named asks now exist, each attached to a section:

  · Denver Exhibit 8.1 height areas — not in the 4-layer zoning service
  · San Diego Figure H site FARs — not in the DSD services
  · Phoenix § 1202.B height map and § 1202.C density map — absent from all 178
    services on maps.phoenix.gov; the only downtown-adjacent one,
    `Public/WalkableUrbanCode`, carries `APPLICABILITY_AREAS` alone

These are data requests with names attached, not reading tasks, and they should
not sit in the same bucket as either. A plan-governed parcel would not be helped
by any layer; these three would be closed by one each.

### A flat total is the correct outcome for a classification change

The map-keyed and two-claims entries moved the total not at all, and that is the
right result reported the right way. Rule 26 asks whether the system changed or
the counting did; there is a third case, and it was not written down: **the
NAMING changed.** Phoenix's 17 DTC districts were a gap before and a gap after —
what changed is that their reason went from "we could not extract the table" to
"the height is on the § 1202.B map". Nothing became known, so nothing should move.

Worth stating because a flat number after real work reads like a wasted session,
and the temptation is to find something to move. The Phoenix commit before it DID
move the total (748 → 731) because seventeen codes stopped being counted as gaps;
the classification commit after it moved nothing because it only said what they
are. Both are correct and they are different kinds of commit.

### The column-count cross-check is necessary, not sufficient — merged headers break it

The instrument established on San Diego's Table 131-05C — reconcile the header's
column count against the live enumeration before encoding a value — worked because
that table is rectangular. Six header columns, six values per row, six live CN
codes.

**Atlanta's SPI grids are not rectangular, and the check does not transfer.** The
header of Chapter 16-18P's FAR table is multi-row with merged cells and nested
sub-columns: "FAR (by right)" and "Max FAR (with Bonus)" sit UNDER a subarea
heading, so the header column count and the data column count legitimately differ
and a mismatch there is not evidence of misalignment. Applying the CN check
unmodified would either fail on a correct table or, worse, pass on a wrong one
after someone "fixed" the count.

That table needs its own reconciliation — most likely colspan-aware, walking the
header rows to build the real column path per data cell — and working that out is
part of the read, not a prerequisite someone can hand over. Recorded so the next
reader does not inherit the CN check as though it were general.

The check is still right where it applies. What is not right is treating one
table's shape as every table's.

### Two corrections to figures stated earlier today

**Dallas is 31, not 30.** An earlier summary said "Dallas is 31 → 30 gaps, the one
change being a typo rescue", describing a change that was never made. The `MU=1`
finding is real — its `ZONE_DIST` reads `MU-1` and production resolves it through
the second candidate — but the sweep cannot pass `zoneDist`, so 31 is the correct
code-only count and the single-code overstatement is declared in
`sweepComposition.test.ts` rather than subtracted. Stating an intended change as a
completed one is the same shape as a stale citation, one turn wide.

**And a recomputation of the per-city composition summed to 730 against the
sweep's 731.** The sweep is right. `unhandledFor` reads the committed zone-code
enumeration, so it returns nothing for Philadelphia's `MaxFAR`/`MaxHeight` and San
Jose's `HEIGHTLIMIT` — free-text table targets with no zone-code fixture — and San
Jose's single gap was the missing one. Third time in this session a checking
script has been the thing that was wrong, and the only reason it surfaced is that
the two numbers were compared instead of one being trusted.

### A figure repeated between two people is harder to question than one either computed

"Dallas 30" was stated in a summary, repeated back, and then used as settled. It
was never true. Neither party checked it, and the reason is worth naming: the
first statement was a claim, and the repetition made it a shared premise. A
premise does not get re-derived.

This is rule 17's shape in conversation rather than in files. There, a retracted
claim survived because it sat in the header where a reader lands first; here, a
wrong figure survived because it had been said twice. In both cases the defence is
the same — **re-derive, do not recall** — and in both cases the cost of the check
is trivial next to the cost of the propagation.

The practical form: a number that arrives from a summary rather than from a
command is not evidence, however recently it was produced and by whomever.

**Sharper still: a figure passed between two parties acquires a provenance
neither of them has.** "Dallas 30" originated in one summary, was taken up by the
other party, and came back — and by then it had been said twice, by two sources,
which is indistinguishable from corroboration. Neither had computed it. The
repetition manufactured exactly the signal that would normally justify trusting
it.

This is the characteristic failure of a working arrangement where two parties
review each other. Cross-checking is the whole value of the arrangement, and it
produces this artifact for free: agreement between reviewers looks like evidence
even when one is only echoing the other. The defence is that a figure must trace
to a command, not to who said it — and where it cannot, it is a hypothesis, no
matter how many times it has been repeated or by whom.

### Compute the same quantity two ways and investigate the difference

Three times tonight a checking script was the wrong thing: the namespace built
from the sweep's own imports, the `heightSource` guessed where the module has
`planSource`, and `unhandledFor` returning nothing for the free-text targets.
Auditing each script would have been expensive and would not have found the third,
which looked entirely healthy.

What found all three was cheaper: **compute the quantity a second way and look at
the gap.** 730 against 731 is a one-code discrepancy nobody would notice in a
single number, and it located a whole class of target the probe could not see. The
Las Vegas credit that silently did nothing surfaced the same way — the expected
total failed to appear.

This is rule 9 turned inward. External validation checks the system against the
world; this checks an instrument against a second instrument, and the disagreement
is the finding regardless of which one is wrong. It costs one extra computation and
it does not require knowing what to suspect.

### The column-count check invites the wrong repair

Stated plainly because the phrasing matters: applying the CN reconciliation to a
merged-header table like Atlanta's SPI grids can fail a CORRECT table, and it can
also **pass a wrong one after someone makes the counts match by adjusting the
wrong side.**

The second is the dangerous mode, and the check invites it. "Reconcile the header
column count against the data" reads as an instruction to make two numbers agree,
and where a header legitimately has fewer columns than its data — because
"FAR (by right)" and "Max FAR (with Bonus)" sit under one merged subarea heading —
the only way to make them agree is to misread one of them. Someone doing that in
good faith produces a table that passes the check and publishes a neighbouring
subarea's figure.

A check whose failure message is "these counts differ" will be satisfied by
changing either count. Where the counts SHOULD differ, the check must know by how
much and why, or it must not run.

### Merged headers reconcile by column PATH, not column count

Atlanta's SPI grids needed their own reconciliation and it turned out to be
stronger than the one it replaces.

San Diego's Table 131-05C was rectangular: six header columns, six values per
row, six live CN codes, and the agreement of three counts was the proof. Atlanta's
Chapter 16-18P is three header levels deep with merged cells, so a header cell
legitimately spans several data columns and **the counts SHOULD differ**. Reaching
for the count check there is worse than useless — "make the counts reconcile" can
only be satisfied by misreading one side, and a grid repaired that way passes the
check while publishing a neighbouring subarea's figure.

`scripts/municodeGrid.py` expands colspan and rowspan so every data cell carries
its full header path, and the check becomes: **do the distinct paths map onto the
live zone codes?**

SPI-16 answers yes, and the answer is an identity rather than an arithmetic
agreement. The live enumeration carries `SPI-16 SA2 JSTA`. The expanded grid
resolves a column whose path is (Midtown Residential SA #2 → Juniper St.
Transition → FAR by right). **JSTA *is* that sub-column** — the name in the city's
data and the header in the city's code are the same thing, which no count could
have told us. Eleven grid columns, four distinct (subarea, transition) zones, five
live codes, and the fifth is a "-C" conditional variant the module already routes
to its base district. None of those numbers match and all of it reconciles.

The general form: where a table is rectangular, count agreement is the external
check. Where it is not, **the resolved column path must be identifiable with a
thing the city separately publishes** — a zone code, a subarea name, a mapped
area. That is a stronger check, because it survives the counts being unequal and
it cannot be satisfied by adjusting a number.

Read but deliberately NOT encoded this pass. The figures are recorded in
`zoning/atlanta.ts` so the reading is not lost, and the reason for stopping is
that mapping this table's three FAR rows (Non-Residential, Residential, Max) onto
the module's `farNonresidential` / `farResidential` / `farCombined` shape with a
net-or-gross basis per FACT 2 is a modelling decision, not a transcription — and
a half-done mapping is precisely how a neighbouring subarea's figure ships.

### Column path is EXTERNAL corroboration; the count check was internal arithmetic

Worth stating precisely, because it is why one instrument is better than the
other and it is the same distinction as everything else in this session.

The count check compares a table's header count to its data count. Both come from
the SAME document, so the agreement is internal arithmetic — and it can be
satisfied by adjusting either side, which is exactly the wrong repair a merged
header invites.

The column-path check compares the CODE's header hierarchy to the CITY'S GIS
enumeration. `SPI-16 SA2 JSTA` is published in the zoning layer; (Midtown
Residential SA #2 → Juniper St. Transition → FAR by right) resolves in the
ordinance. Two independent sources naming the same thing. That is rule 9 applied
to table extraction, and it cannot be satisfied by changing a number in either.

### Atlanta SPI: the mapping decision was not the one it looked like

The plan was to decide how three FAR rows (Non-Residential, Residential, Max) map
onto `farNonresidential` / `farResidential` / `farCombined`, verify on SPI-16
where four zones have live codes, then apply it mechanically to the other
nineteen chapters.

One command before that: **both SPI-16 FAR rows are GROSS-basis.** The labels read
"(times gross lot area)", and FACT 2 already defines gross for this city as
§16-28.010(1) — "all land within district boundaries plus half of adjoining
permanent open space such as streets, parks, lakes, cemeteries … limited to no
more than 50 feet."

The parcel polygon measures NET lot area. So 8.2 is a correct ratio against a
denominator nothing we currently fetch.

**But it is NOT LA's shape, and calling it that was too fast.** LA's buildable
area subtracts the required front yard, and LA's required front yard is the
PREVAILING setback — the average of what neighbouring owners already built along
40% of the frontage. That is an as-built fact about a street, with no layer behind
it and no spatial query that could recover it. Genuinely unobtainable.

Atlanta's gross is "all land within district boundaries plus half of adjoining
permanent open space such as streets, parks, lakes, cemeteries … limited to no
more than 50 feet". Streets, parks, lakes and cemeteries are published geometry in
most cities, and half-width-capped-at-fifty is a spatial operation rather than an
inference. **So this is plausibly the MAP-KEYED shape, not the basis-unavailable
shape** — the instrument is spatial and the open question is only whether Atlanta
publishes the layers.

That check belongs before the conclusion, because the two reason codes say
different things to a user and only one is a dead end. "The denominator cannot be
known" ends the conversation; "it needs a spatial join nobody has wired" is a
task. Denver's Protected District buffer was the same species and closed in a
single session once the polygons turned out to already be in the zoning service.

**So the real decision is not which row goes in which field. It is whether a
gross-basis ratio can be published at all**, and FACT 2 has already answered it
for this module: record the basis, label the number, never convert. The encoding
is therefore the figure plus `basis: 'gross'` plus a reason code on the floor-area
product — the `farBasis: 'basis-unavailable'` shape, not a multiplication.

The direction is unusually kind: gross exceeds net, so `net * FAR` understates
rather than overstates. That does not make it publishable. A half-street-width
credit capped at fifty feet is precisely the sort of invented factor that reads as
measured six months later (rule 4).

**The value is entirely in the ordering.** The alternative was to decide a field
mapping, verify it end-to-end on SPI-16, apply it mechanically across nineteen
chapters, and meet the denominator afterwards — at which point the wrong decision
would have been replicated everywhere and invisible, because a gross-basis FAR
multiplied by a net lot produces a plausible number in the safe direction.

### The session's actual method was refusing to encode, twelve times

The four largest refusals were LA's buildable area, Denver's former Chapter 59
conditionals, Gaslamp's bonus-conditioned 6.0, and Atlanta's gross-lot denominator.
Each would have produced a plausible number and none would have been catchable
afterward. But the count understates it — the same decision was taken twelve times:

  · LA buildable area — FAR stated against a denominator with no layer
  · Denver former Chapter 59 — conditional FARs with premiums and lot-width heights
  · Denver CMP `near === true` — the limit varies across the site, so neither 75
    nor 200 is the parcel's answer
  · Denver D-C / D-TD height — "unlimited except in three mapped areas" is not
    "unlimited"
  · Gaslamp — 6.0 conditions a height bonus and is not a by-right ratio
  · Atlanta gross basis — a ratio against land the parcel polygon does not measure
  · Atlanta's four non-existent codes — mapped by the city, absent from Part 16
  · Miami's ten `farUnconstrained` — a FAR answer does not close a height target
  · La Jolla § 159.0307(c)(2) bonus density — condition-heavy, not read closely
  · San Diego CN § 131.0546 bonuses — additive or replacing is unknown, and
    1.0 + 1.2 versus 1.2 is a 2.2x difference
  · Austin `SF2` — established as interim SF-2 by the layer's own fields, and an
    alias would publish 35 ft on 715 parcels off a naming pattern
  · Phoenix accessory height 30 ft — stated, and not the district's height

**What made each refusal possible was reading the provision's STRUCTURE before
extracting its number.** The figure and the reason it cannot be published sit in
the same sentence, and whoever goes looking for the figure alone finds only the
figure: "5.0" says nothing, "Non-Residential FAR (times gross lot area)" says
everything. Gaslamp is the sharpest case — the 6.0 is real, correct, and belongs
to a programme, and the only thing distinguishing it from a district FAR is the
clause it hangs off.

So the operational rule is narrower than "be careful": **read the row label, the
column path, the footnote and the conditioning clause before taking the value.**
Every one of the twelve was decided by something adjacent to the number rather
than by the number itself.

This is rule 18 as a practice instead of a warning. Rule 18 says the surviving
errors are the ones that produced plausible output. Its counterpart is that
plausible output is produced by extracting a figure from a provision you have not
finished reading — and the fix is available at the moment of extraction, at
approximately zero cost, if the structure is read first.

### Charlotte's duplicate parse: collapsed, and the comparison found something the refactor would not have

The last known duplicate-parse in the repo. `providers/charlotte.ts` ran its own
`zoneDes.toUpperCase().split(/[()\s]+/).filter(Boolean).slice(1)` to find overlay
names — character-for-character the split inside `parseCharlotteZone`.

**Measured across the WHOLE enumeration before touching anything**, because a
sample is what makes this class survive: Seattle's two MIO strips agreed on every
NC/C code and diverged on the LR/MR/HR family nobody probed, and the overlay
shipped as a by-right height up to 6x too high. All 218 live `ZoneDes` values
through both paths: **token splits disagree on 0**, and after the collapse the
overlay-label output differs on 0. So nothing had drifted — which is the state
Seattle was in, and the reason to remove the possibility rather than wait for it.

Collapsed by EXTRACTION, not by making the second path match: `CharlotteZoneParts`
now carries `tail`, every token after the leading code in string order, and the
provider reads that. `markers` and `unknownTokens` could not be concatenated to
reconstruct it — that reorders, and the labels are emitted in string order.

**And the comparison surfaced two live tokens neither vocabulary knows: `BVO` and
`INNOV`.** Every token the overlay table names is also a marker, so those two
never disagree — but these fall through both and land in `unknownTokens`, which by
design makes the whole string UNRESOLVED. That is why six live codes resolve
nothing: `CAC-1 BVO`, `N2-B BVO`, `MX-1(INNOV)`, `MX-2 INNOV`, `MX-2(INNOV)`,
`MX-3(INNOV)`.

Not guessed at. Expanding `BVO` to "Bonus Village" or `INNOV` to "Innovative"
would be a name invented to fit an abbreviation — rule 27 with less evidence than
a prefix. They stay unknown until Article 14 is read for them specifically. The
refusal is doing real work: a district whose modifiers we cannot read is not a
district whose limits we can publish.

**The readiness harness caught its own subject vanishing.** `city-readiness.test.ts`
pinned exactly one duplicate pair, and removing it turned the test red — which is
the pinned-inventory guard behaving correctly. It now asserts zero, with a planted
pair proving the detector still fires, because an empty result and a broken scan
are otherwise the same output (rule 20).
