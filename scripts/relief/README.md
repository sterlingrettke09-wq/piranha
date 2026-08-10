# Relief-approval-odds pipeline

> WO-7.3 — "how often does this city's board actually grant the relief you'd
> need?"

This directory holds an **offline** pipeline, the same shape as
`scripts/permits/`. It is **never** a runtime dependency: nothing in
`netlify/functions/` fetches a city open-data portal at request time. Instead,
each script here is run **locally, by hand**, pulls a city's zoning-relief
decision records, computes a grant rate, and merges it into a single committed
artifact:

```
netlify/functions/lib/data/reliefStats.json
```

That JSON is small (cities × `{ variance: { grantRate, n, window, vintage } }`)
and lives in the repo. `netlify/functions/lib/relief.ts` imports it
(`reliefOddsFor(city)`); `analyze.ts` attaches `reliefOdds` to the result **only
when `feasibility.path === 'variance'`** (i.e. the verdict is NEEDS_RELIEF); and
`VerdictBanner` renders one muted sub-line:

> San Francisco's board granted 97% of variance requests (2022–2026, n=406).

The grant rate is a **historical base rate for the city's board — context, not a
prediction for any specific project**. It is never folded into the verdict or
the timeline.

## How to run

One command per city. No dependencies beyond Node 18+ (global `fetch`):

```bash
node scripts/relief/boston.mjs
node scripts/relief/sf.mjs
node scripts/relief/nyc.mjs
node scripts/relief/dc.mjs
node scripts/relief/charlotte.mjs
```

Each script is **idempotent**: it reads the existing `reliefStats.json`, merges
its city's block in, and writes the file back. Running it twice produces the
same result; running a different city's script never clobbers another city's
data. Re-run **quarterly** to refresh the vintage as new decisions are logged,
then commit the updated artifact.

Socrata (SF) throttles anonymous callers (HTTP 429); the script surfaces that as
a clear "wait a minute and re-run" error and leaves the artifact untouched. Note
that SF's SoQL 2.1 `$query` endpoint now requires authentication — the scripts
use the classic `$select`/`$where`/`$group` params, which still work
anonymously.

## Artifact shape

```jsonc
{
  "sf": {
    "variance": {
      "grantRate": 0.973,   // granted ÷ decided, three decimals
      "n": 406,             // decided records in the sample (granted + denied)
      "window": "2022–2026",
      "vintage": "closed 2022-01-01 onward; computed 2026-08-10; data.sfgov.org … ; 395 granted, 11 denied"
    }
  },
  "nyc": {
    "variance": {
      // ...same fields, plus:
      "label": "variance and special-permit applications"
    }
  }
  // ...other cities merge in alongside
}
```

**`label` is the published denominator, and it renders.** The reality-check card
prints `granted N% of <label>` (falling back to "variance requests" only when
the field is absent). The `variance` KEY is a schema slot, not a claim: where a
city's cleanest track is broader than variances — NYC's BZ calendar (variances
AND §73 special permits), DC's whole-board rate (variances AND special
exceptions) — the script MUST ship a `label` naming the real denominator, and
`relief.test.ts` fails if nyc/dc ever lose theirs. A caveat that lives only in
the `vintage` JSON string is a caveat nobody renders — that is the defect that
got five permit figures withdrawn.

**The label also has to carry an EXCLUSION, not only a widening.** Charlotte's
feed contains two tracks for the same underlying dimensional relief, split by
magnitude: the UDO Board of Adjustment (92.3%) and the staff administrative
adjustment (99.2%, measured every run). The pipeline publishes the Board alone,
so its label reads **"Board of Adjustment variances"** — a bare "variance
requests" there would be a claim true of neither track, i.e. the
pooled-rate-under-an-unpooled-label error, in the rendered line rather than in a
comment. `relief.test.ts` pins that exact string.

### `feed` — the source feed's row count at extraction time

Every script here records, on the run that produces a figure, how many rows its
feed held, as a sibling of `variance`. Optional on an entry (runs predating the
instrumentation have none, and are **not** backfilled); written by
`feedCounts()` in [`../lib/feedCounts.mjs`](../lib/feedCounts.mjs); the contract,
and why the two counts must not be conflated, is the type in
[`netlify/functions/lib/feedCounts.ts`](../../netlify/functions/lib/feedCounts.ts).
The scripts that refuse to write **log** the same counts on their halt path.

```jsonc
"feed": {
  "observedAt": "2026-08-10",   // must equal the vintage's compute date
  "totals": [                   // one entry PER ENDPOINT the script read
    { "endpoint": "…/ZoningVarianceAppeal/FeatureServer/0", "totalRows": 3142 }
  ],
  "cohortRows": 155,            // rows/cases passing this script's window + filters
  "basis": "totalRows: … cohortRows: …"
}
```

Charlotte already probed this number — `returnCountOnly` feeds its three-way
row reconciliation — so there it costs nothing beyond writing it down.

## Sanity gates (every script)

- **Probe the schema first — the COLUMN LIST, not one row.** If the expected
  outcome/date field is missing, **fail loudly** rather than fabricate a grant
  rate (the Boston permit lesson). Read `/api/views/<4x4>.json` (Socrata) or
  `datastore_search`'s `fields` (CKAN): a single sample row omits its null
  fields, and `sf.mjs` asserted for a whole cycle that SF "publishes no decision
  date" on exactly that evidence while `close_date` sat in the schema unread.
  **A field you did not find is not a field that does not exist** (rule 8).
- **Frame the cohort on RESOLUTION, never on filing.** This is the one that bit
  us. A window on the *application* date admits cases that have not been decided
  yet, and scoring `granted ÷ decided` over them silently drops the undecided
  ones from the denominator — a filing cohort counted by its survivors. SF was
  published at **97.6% when its own cohort only supported [76.5%, 98.2%]**, i.e.
  at the very top of its bound, because 83 of 383 records (21.7%) were still
  pending and invisible. Frame on the decision/closure stamp instead
  (`final_decision_date` in Boston, `close_date` in SF) and pending cases are
  excluded **by construction** rather than by censoring. Then **gate on it**:
  assert that every record in the window carries a terminal status, with a
  fail-closed vocabulary so an unrecognised value halts the run. The threshold is
  zero — it is the claim itself, not a tolerance.

  *The one permitted exception is DC*, where the layer publishes **no**
  resolution date of any kind, so a resolution frame does not exist. `dc.mjs`
  instead scores a **matured filing cohort** (filings ≥ 2 years old), publishes
  it explicitly as a *decided-cases share*, requires the residual unresolved
  share to stay under 5% (measured 1.5%; SF's retracted figure hid 21.7%), and
  writes the adversarial floor into the vintage every run. That is a mitigated
  version of the defect, disclosed — not the defect's absence. Do not copy the
  DC frame to a city that has any resolution stamp.

  **Charlotte adds the other half of this: audit the frame against something the
  frame cannot see.** A resolution-date frame is only as complete as the date
  field, and Charlotte's is not complete — the *2025-02-25* Board session decided
  three cases that sit in the feed marked `Granted` with a **blank**
  `Decision_Date`, so a date-framed cohort drops them silently and no internal
  check can notice. `charlotte.mjs` therefore scores the dated cohort but audits
  it against the union of that cohort and every case whose **case-number year**
  is in-window (157 ∪ 159 = 164), which is independent of the date field. Both
  leakage classes — decided-but-undated, and no-disposition — are re-measured
  every run and each refuses (exit 1, no write) above 4%. That defect was found
  by reading the Board's own minutes, i.e. from outside the system (rule 9); the
  gate is what keeps it found.
- The outcome field must be **unambiguous**: map only the statuses that are a
  board ruling on the merits to granted/denied, and **exclude** withdrawn,
  deferred, cancelled, informational, and still-in-progress records from the
  denominator. The grant rate is `granted ÷ decided`.
- If `n < 100` decided records (or nothing matched the outcome buckets), treat
  the result as untrustworthy and **do not write** it — print why and leave the
  city absent. No fabrication, ever.

## Run status

| City | Script | Status | Grant rate | n (decided) | Window | Dataset |
|------|--------|--------|-----------:|------------:|--------|---------|
| **Boston** | `boston.mjs` | **✅ landed** (2026-06-10) | **92.7%** | **3820** | 2022–2026 | CKAN `0f0fa8c2-…` — Zoning Board of Appeal Tracker; `decision` ∈ {AppProv, Approved} granted, {DeniedPrej, Denied} denied; **framed on `final_decision_date` ≥ 2022**. 3542 granted, 278 denied. |
| **SF** | `sf.mjs` | **✅ landed — RESTATED 2026-08-09** | **97.3%** | **406** | 2022–2026 | Socrata `y673-d69b` — Planning Department Records · Non-Projects; `record_type = 'VAR'`; `record_status` ∈ {Closed - Approved, Approved} granted, {Closed - Disapproved} denied; **framed on `close_date` ≥ 2022** (was `open_date` — see below). 395 granted, 11 denied. |
| **NYC** | `nyc.mjs` | **✅ landed** (2026-08-10) | **98.1%** | **210** | 2022–2026 | Socrata `yvxd-uipr` — BSA Applications Status; `application = 'BZ'` **whole track, labelled "variance and special-permit applications"** (strict §72-21 is n=93 < 100; widening by regex to n=102 would let a string-match decide the gate — refused); **framed on the action date `date`** — the feed has NO pending value (pending cases are absent rows, so a filing denominator cannot be audited; the tell: 31 of 36 cases filed in 2025 already show Granted). Window end measured each run: min(`date`) of the transient `Decision` (acted-on, outcome not yet coded) rows, so partially-coded sessions are never scored. Excludes Withdrawn (49) and Dismissed (10, procedural). 206 granted, 4 denied. |
| **Charlotte** | `charlotte.mjs` | **✅ landed — GATED** (2026-08-10) | **92.3%** | **155** | 2022–2026 | City of Charlotte `ZoningVarianceAppeal/FeatureServer/0` — Zoning Variances and Appeals; `Request_Type = 'Variance'` **exact match**, **deduped rows→cases** (164 rows / 157 cases; 0 outcome conflicts — script halts if any appear); **labelled "Board of Adjustment variances"** because the same feed's staff administrative-adjustment track runs **234/236 = 99.2%** and is deliberately excluded (UDO 37.4.A.4.b: an objection by anyone with standing means "the administrative adjustment shall be denied and the applicant may file for a variance" — the staff track is the *consent-filtered residue*, and pooling would publish 96.4%). **Framed on `Decision_Date`, which is the CLERK-FILING date, not the decision date** (UDO 37.8.A.15; runs 9–98 days after the hearing) — sound for cohort membership, never a duration endpoint. Two `Granted (3)` / `Granted-Appeal Pending` cases excluded as not single-valued (including them: 92.4%). **Measured refusal gate**: audited against 164 case-year-2022+ cases, 4 decided-but-undated (the un-entered **2025-02-25** session) + 3 unresolved (1.8%, ceiling 4%), adversarial bound **[90.7%, 92.6%]** written into the vintage every run. 143 granted, 12 denied. |
| **DC** | `dc.mjs` | **✅ landed — CAVEATED** (2026-08-10) | **97.4%** | **617** | 2022–2024 (filings) | DCGIS `Planning_Landuse_and_Zoning_WebMercator/MapServer/34` — Zoning Cases; `CASE_TYPE='BZA'`; **deduped rows→cases** (2,003 rows / 1,121 cases since 2022; matured window 1,200 rows / 688 cases; 0 outcome conflicts — script halts if any appear); **WHOLE-BOARD rate, labelled "zoning relief requests (variances and special exceptions combined)"** — every field that could split them (RELIEFSOUGHT, CASE_TYPE_RELIEF, BZAPURSUANTTO, BZARELIEFOF) is 0/2,003 populated 2022+, and the label renders on the user-facing card; **matured filing cohort** (`DATEFILED` is the layer's only date — filings ≥ 2y before run), residual unresolved 10/688 = 1.5%, gated ≤ 5%, adversarial floor 95.9% stated in the vintage. `Grant in Part` prefix → granted (Boston's AppProv treatment). 601 granted, 16 denied. |

### ⚠️ SF was restated 2026-08-09 — the previous 97.6% / n=289 was censored

The figure published between 2026-06-10 and 2026-08-09 was **97.6% (n=289)**, and
it was unsound: `sf.mjs` framed the cohort on `open_date` (filing) and then
scored only the members that had reached a decision. Measured live on
2026-08-09, VAR records filed since 2022 split **300 decided / 83 still
undecided (21.7% of 383)**, and those 83 were absent from the published
denominator. The cohort could only support a **bound of [76.5%, 98.2%]** — and
97.6% sat at its ceiling.

Restated on **closure-date framing**, the same feed gives **97.3% (n=406, 395
granted / 11 denied)**. The rendered line moves from 98% to 97%.

Two things worth keeping straight about `close_date`:

- **It is not a decision date, and the vintage string does not call it one.** The
  publisher defines it as *"Date the record was closed."* SF has no field
  equivalent to Boston's `final_decision_date`. It is used for cohort
  **membership** only, never as a duration endpoint.
- **What justifies it is measured, not nominal.** `close_date` is populated on
  100% of terminal records (7,534/7,536 all-time; the 2 exceptions opened 2015
  and 2017) and on **0%** of every in-progress status — 'Under Review' 0/33,
  'On Hold' 0/18, 'Pending Review' 0/18, 'Submitted' 0/15, 'Open' 0/3, 'Action
  Pending' 0/2. So "closed in window" *is* "resolved", and all 628 in-window
  rows carry a terminal status. `refuseUnlessCohortIsResolved()` re-measures that
  every run.

Checks run before adopting the frame (all 2026-08-09): per-year rate stable
(2022 95.7% · 2023 99.1% · 2024 98.1% · 2025 95.6% · 2026 96.9%); window-start
sensitivity mild (since-2021 95.49% → since-2024 97.07%); and — the one that
matters — **closure lag does not differ by outcome**, approved p50 269d vs
disapproved p50 274d, so the frame does not select on the result. The restated
97.29% also falls inside the old frame's [76.5%, 98.2%] bound: two independent
framings agree.

Both grant rates are high — that's the real shape of zoning relief in these
cities: variances are routinely granted (the hard cases are filtered out earlier
or withdrawn), which is exactly the context a NEEDS_RELIEF verdict should carry.
The Boston `decision` codes and the SF `record_status` strings were each
verified against the live distinct-value histogram before being hard-coded.

## Other cities (still TODO — one script each)

Follow the same probe → outcome-map → sanity-gate → merge pattern, mapping each
portal's relief/appeal outcome field to granted/denied. The 2026-08 relief
survey (re-verified against the live endpoints before NYC/DC landed) classified
most remaining cities as structurally NOT obtainable — the notes below record
why, so nobody re-spends the research:

- **Chicago** — ZBA outcomes exist only as monthly resolution PDFs; no dataset.
- **Seattle** — `data.seattle.gov` `ht3q-kdvx` has a `decisiondate`, but
  `statuscurrent` is pure workflow (Completed/Canceled/Withdrawn/Issued…): **no
  granted/denied value exists in the domain**. Outcomes are SDCI
  Notice-of-Decision PDFs / Hearing Examiner documents.
- **Philadelphia** — `appeals` on phl.carto.com has a perfect schema
  (`decision`, `decisiondate`) but the values degraded to `Complete` (2025: 836
  `Complete` vs 22 `Granted` / 1 `Denied` / 3 `Refused`); ~3% of 2022+ rows
  carry a real disposition, and that 3% is not a random sample.
- **Austin** — `data.austintexas.gov` `ykxk-t5y9` outcomes look usable until
  the dates: `status_date` maxes 2019-06-20 across the whole 3,291-row table
  (2026 cases carry 2019 stamps). No sound time axis; `Closed` + null ≈ 30% of
  the table unresolvable. Do not ship.
- **LA / Denver / Minneapolis / Raleigh / Miami** — PDF/agenda only, no outcome
  dataset. **San Diego / San Jose / Nashville** — datasets exist, outcome field
  doesn't (no granted/denied value in the status domain, or the field sits on
  the wrong board).
- **LA** — Zoning Administrator / Area Planning Commission determinations; check
  `data.lacity.org` and the Planning case-tracking (PCTS) exports.
- **Denver** — Board of Adjustment for Zoning Appeals; check
  `denvergov.org`/`opendata-geospatialdenver.hub.arcgis.com`.
- **Minneapolis** — Board of Adjustment / land-use applications on
  `opendata.minneapolismn.gov`.

### Surveyed 2026-08-10 — Charlotte, Columbus, Milwaukee, Atlanta

These four were added after the 2026-08 survey ran and were carried as "never
surveyed" until now. All four were probed against live endpoints on 2026-08-10.
**Charlotte has since been BUILT and landed** (see the run-status table above);
for the other three no script landed and their blocks in `reliefStats.json` do
not exist.

- **Charlotte** — **BUILT 2026-08-10 → `charlotte.mjs`, 92.3% / n=155.** The
  survey's own recommendation was 92.4% / n=157; the shipped figure is the
  **strict** variant, which excludes the two dispositions that are not
  single-valued (`Granted (3)` — the field can express a split, as
  `GRANTED (1) DENIED (2)` shows, and truncates at 30 chars; and
  `Granted-Appeal Pending` — granted, but a §160D-1402 superior-court petition
  is outstanding). Both alternatives are re-measured and the 92.4% figure is
  stated in the vintage, so the choice is visible rather than buried. All other
  survey findings held on re-derivation from the live service: 3,142 rows
  reconciled three ways, 164 in-window rows → 157 cases, 0 outcome conflicts,
  the staff track re-measured at **234/236 = 99.2%** (survey: 194/2 = 99.0%,
  a row-level count) against the Board's 92.3%, pooling would publish **96.4%**.
  Two survey numbers moved on re-derivation and the shipped ones are the
  measured ones: the adversarial bound is **[90.7%, 92.6%]** (the survey's
  [90.85%, 92.55%] was computed on the 157-case variant), and the residual gate
  is **4%, not DC's 5%** — Charlotte's leakage is *directional* (every undated
  case measured is a grant), so the same share buys less tolerance, and 4% fires
  on the second occurrence of the Feb-2025 defect rather than the first.

- **Columbus** — **VERIFIED NO.** `BZA_STATUS` on
  `maps2.columbus.gov/arcgis/…/BuildingZoning/MapServer/1` has exactly two values
  across 3,084 live rows (2004–2026): `PASSED` 2,982 / `PROPOSED` 102. Both
  sibling layers agree independently (Council `CV_STATUS` 2,008/100, Graphics
  Code `GC_STATUS` 765/35) — 5,992 rows, three layers, two states, and no value
  that could express a refusal. Enumerated rather than searched: all 65 portal
  datasets from the DCAT catalogue, plus the whole 18-layer `BuildingZoning` and
  34-layer `Development` MapServers read from the service index. **The
  corroboration is what makes this an answer rather than a failed search:**
  `CASE_NO` is sequential (`BZAyy-NNN`) and 8–32% of every year's numbers never
  appear in the layer (BZA24 holds 152 of 178 issued; BZA22 152 of 180), so
  **denials are absent rows, not denied rows**, and a computed rate would be
  **100% by construction** — a plausible number, never a null. Independently
  disqualifying: `CREATED_DATE` is a GIS record-creation stamp, not a case or
  decision date (384 rows in 2009, 539 in 2020, against ~130–180 real cases a
  year), so there is no time axis either. Outcomes live per case behind
  `WEB_LINK` → Accela — Chicago's posture. Coverage-matrix reason string:
  *"Columbus publishes its Board of Zoning Adjustment variances as a map layer
  whose only status values are 'passed' and 'proposed' — denied cases are absent
  from the data entirely, so no grant rate can be computed."* (The endpoint needs
  a browser `User-Agent`; a bare client gets HTTP 403 — that is not absence.)

- **Milwaukee** — **FEASIBLE but DECLINED on the dependency (see below); cell
  stays `not-built`.** Not a negative. `data.milwaukee.gov` (all 196 CKAN
  packages) and `milwaukeemaps.milwaukee.gov` (22 folders, 105 services, every
  layer and table) have no BOZA dataset — but the city's own BOZA page designates
  `aca-prod.accela.com/MILWAUKEE` (module `Development`) as where the records
  live. **The outcome is one layer below the search results:** the result-list
  `Status` column reads Complete/In Process/Void for everything, and a shallower
  pass stopping there would have filed a wrong VERIFIED NO. The **"BOZA Hearing"**
  workflow task carries `Marked as Granted|Denied|Dismissed on MM/DD/YYYY`, so a
  Boston-shaped decision-date frame exists and unheard cases drop out by
  construction. Volume ≈ 2,023 `Zoning Code Appeal` records 2022–2025 (`BZZA-`
  numbers are dense and sequential, so the highest number is the count — verified
  against the two record types where ACA prints an exact total), n ≈ 1,800
  decided. A 2023 spread sample (n=50) gives ~91%, Boston's family — **an
  indicator that the field discriminates, not a publishable rate.**
  `Zoning Appeal Type` separates variances from special uses, so whole-track vs
  variance-only is a real choice that must be made explicitly and named in
  `label`, including the rule for the ~10–16% of records carrying both.

- **Atlanta** — **FEASIBLE but DECLINED on the dependency (see below); cell stays
  `not-built`.** `opendata.atlantaga.gov` and `data.atlantaga.gov` do not resolve
  (DNS failure, not a 404), and `gis.atlantaga.gov/dpcd` — 6 folders, 21 services,
  every layer and table — has no BZA layer. `ZoningRezoningCases` and
  `ZoningSpecialUsePermits` do carry a status but are the Zoning Review Board /
  Council legislative track: **the wrong body**, and no substitute, since
  `analyze.ts` attaches `reliefOdds` only on the variance path. Outcomes are in
  `aca-prod.accela.com/ATLANTA_GA` (module `Planning`), where record types split
  the relief kinds (`Planning/BZA/Variance/NA`, plus a Special-Exception-Variance
  combo), so a variance-only denominator genuinely exists — 612 variance records
  2022–2025, n ≈ 350–450 decided.
  **⚠️ The trap: do NOT score the search-result `Status` column.** It reads
  `Approved` / `Denied` / `App with Conditions` and looks exactly like an outcome.
  It is **stale** — of 41 fully probed 2024 variances, 8 whose list Status reads
  "In Progress" have a hearing task marked `Approved`, and the 2022 cohort still
  shows 18% "In Progress" four years on — and it is a **filing frame**, with
  `In Progress` at 251 of 612 rows (41%) across 2022–25. Censored and
  filing-framed at once, i.e. SF's retracted structure at nearly double the
  hidden share, in a field that yields a plausible number and never a null. Score
  the **"Public Hearing"** task instead (it carries its own decision date), read
  **jointly with the `Close` task** (rule 13): 6 of 81 probed records reach a
  disposition without a hearing, all of them withdrawn or denied-without-
  prejudice, and with the hearing task alone "withdrawn before hearing" and
  "still unresolved" are the same empty cell. Two calls must be settled before
  any figure ships — whether `Denied Without Prejudice` is a merits denial (it is
  the second most common non-approval, so it moves the rate, and it needs the
  BZA's rules of procedure, not the status string), and whether the combo record
  type is in the denominator (which changes `label`). Also: **do not infer counts
  from case numbers here** — the `V-` sequence has gaps (2024's highest is
  `V-24-242` against 160 records), unlike Milwaukee's dense `BZZA-` sequence.

- **The Accela scraping dependency was DECLINED (2026-08-10).** Milwaukee and
  Atlanta are reachable only by scraping ASP.NET Citizen Access portals —
  viewstate, mandatory `Referer`/`Origin` CSRF headers, a session-bound page
  method (`GetProcessingData` takes no record id; it reads the cap the preceding
  GET put in the session), HTTP 429 after ~40–60 request pairs. Every other
  source in this project is an official API or an open-data feed, and a scraped
  portal differs in kind rather than degree: **a markup change breaks it
  silently**, still returning well-formed rows, just fewer or different ones. A
  dependency that can start returning wrong data without erroring is worse than a
  gap, and the gap is currently honest. If this is ever revisited the condition
  is a **structural check that fails loudly on markup drift** — record counts
  reconciled against the record-number sequence, the outcome task asserted
  present, a fail-closed status vocabulary that halts on any unseen value, and a
  hand-count of one hearing's dispositions against the boards' own published
  minutes (Milwaukee posts them under
  `city.milwaukee.gov/ImageLibrary/Groups/cityBOZA/<year>/`) as the external
  check per rule 9 — **not** a comment saying to watch for it. Both cities' cells
  stay `not-built`, which is accurate: nobody built them. That is *known
  presence, unbuilt*, and it must not render like Columbus's verified absence or
  Chicago's PDF-only.

If a portal doesn't publish outcomes in a parseable, unambiguous way, **skip
honestly and document the gap here** rather than write a guess.
