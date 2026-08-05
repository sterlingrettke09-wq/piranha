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
