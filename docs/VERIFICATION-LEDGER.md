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
  cohort never issued. Only 64.1% of the matured 2022 cohort ever issued, so an
  80th percentile **does not exist**. A caveat cannot repair an undefined statistic.

### The dominant failure was not the date field

Only one city had the trap we went looking for. The systematic problem is
**right-censoring**: the median is computed over permits that ISSUED, and a large
share never do. Every instance biases the figure LOW — the flattering direction.

- **NYC** — 8.3 mo published; 45% of initial New Building filings since 2022 never
  issued. Kaplan-Meier over all 8,039 gives **15.9 months**.
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
ever issue" is arguably more useful than any median. KM's assumption that
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

**37.7% of SF new-construction filings ever issue.** Matured 2022 cohort: single
32.4%, multi 23.4%, apartment 44.4%. When most filings never issue, the
unconditional median time-to-issuance **does not exist**, and a floor label does
not rescue it — it makes an absent number look cautious. LA was withdrawn at
64.1%; SF is far below that.

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
