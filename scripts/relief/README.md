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
- **Milwaukee / Columbus / Charlotte / Atlanta** — never surveyed (added
  2026-08-09, after the survey ran). A gap, not an answer — do not record these
  as negatives.
- **LA** — Zoning Administrator / Area Planning Commission determinations; check
  `data.lacity.org` and the Planning case-tracking (PCTS) exports.
- **Denver** — Board of Adjustment for Zoning Appeals; check
  `denvergov.org`/`opendata-geospatialdenver.hub.arcgis.com`.
- **Minneapolis** — Board of Adjustment / land-use applications on
  `opendata.minneapolismn.gov`.

If a portal doesn't publish outcomes in a parseable, unambiguous way, **skip
honestly and document the gap here** rather than write a guess.
