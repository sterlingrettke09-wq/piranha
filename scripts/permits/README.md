# Permit-timeline pipeline

> WO-7.1 — "the city's published pace vs. what the records show."

This directory holds an **offline** pipeline. It is **never** a runtime
dependency: nothing in `netlify/functions/` fetches a city open-data portal at
request time. Instead, each script here is run **locally, by hand**, pulls a
city's open permit dataset, computes summary statistics, and merges them into a
single committed artifact:

```
netlify/functions/lib/data/permitStats.json
```

That JSON is small (cities × permit classes × `{ median, p80, n, vintage }`)
and lives in the repo. `netlify/functions/lib/timeline.ts` imports it
(`measuredFor(city)` / `resolveTimeline(...).measured`) and the result-page
`Timeline` component renders a muted line under the full-lifecycle estimate when
a city has a figure:

> Measured: the median new-construction permit in Denver ran 4.5 months
> from application to issuance (p80 11.1, n=6922; …) — permit time only, a subset
> of the full life-cycle shown above.

*(This example read "Seattle … 5.7 months" until 2026-08-09, when Seattle was
withdrawn — see the run-status table.)*

The measured figure is **never** folded into the estimated months; it sits
beside it as an empirical sanity check.

## How to run

One command per city. No dependencies beyond Node 18+ (global `fetch`):

```bash
# ── Publish a figure (these six are the current artifact) ─────────────────
node scripts/permits/austin.mjs
node scripts/permits/denver.mjs       # ArcGIS (denvergov org); DATE_RECEIVED → lands
node scripts/permits/miami.mjs        # ArcGIS; master building permits only
node scripts/permits/nashville.mjs    # ArcGIS; rolling ~3-yr ISSUED window → a FLOOR
node scripts/permits/philadelphia.mjs # Carto permits ⋈ ArcGIS APPLICATIONDATE
node scripts/permits/raleigh.mjs      # ArcGIS; carries NON-ISSUED rows

# ── Compute, then correctly REFUSE to write (see "Run status") ─────────────
node scripts/permits/boston.mjs       # no application-date column → halt, exit 0
node scripts/permits/dc.mjs           # no application-date column → warn, exit 0
node scripts/permits/minneapolis.mjs  # no application-date column → warn, exit 0
node scripts/permits/milwaukee.mjs    # commercial use-column unenumerable → throws, exit 1
node scripts/permits/nyc.mjs          # p80 unidentified at 63.65% observed → throws, exit 1
node scripts/permits/seattle.mjs      # p80 unidentified at 74.71% observed → throws, exit 1
node scripts/permits/sf.mjs           # no quantile identified at 37.61% → throws, exit 1
node scripts/permits/chicago.mjs      # applied==issued backfill mass → throws, exit 1
node scripts/permits/la.mjs           # issued-only feed, no denominator → throws, exit 1
node scripts/permits/dallas.mjs       # p80 unidentified at 73.44% + terminal snapshot → throws, exit 1

```

⚠️ The five withdrawn scripts above (`nyc`, `seattle`, `sf`, `chicago`, `la`)
used to sit in a commented-out block headed *"do NOT run these"* (or, for
`seattle`, in the publish list), because they had no refusal gate and **would
write their disqualified figures back into `permitStats.json`**. They now all
refuse structurally, on a condition recomputed from the live feed rather than on
a flag, so running them is safe and is the way to check whether anything has
changed. NYC and Seattle were the last to get gates — each shipped a figure for
three days with the disqualifier already written in its own file.

Socrata throttles anonymous callers (HTTP 429), and NYC's portal is especially
aggressive. The scripts surface a 429 as a clear "wait a minute and re-run"
error and leave the artifact untouched — they never write a partial result.

Each script is **idempotent**: it reads the existing `permitStats.json`, merges
its city's block in, and writes the file back. Running it twice produces the
same result; running a different city's script never clobbers another city's
data. Re-run **quarterly** to refresh the vintage as new permits are issued,
then commit the updated artifact.

## Artifact shape

```jsonc
{
  "denver": {
    "newConstruction": {
      "medianMonths": 4.5,   // median application → issuance, one decimal
      "p80Months": 11.1,     // 80th-percentile, one decimal
      "n": 6922,             // permits in the sample
      "vintage": "applied 2022-01-01 onward; computed 2026-08-06; opendata-geospatial.denvergov.org Construction Permits (…)"
    },
    "byTier": { /* same block per tier: single ≤1 unit, multi 2–4, apartment 5+ */ },

    // REQUIRED on every city (a test fails the build without it). It says
    // whether a per-tier split was COMPUTED, and names every tier the split
    // computed and then withheld.
    "tierBreakdown": {
      "attempted": true,
      "minPublishableN": 30,
      "suppressed": {
        "multi": {
          "n": 18,          // rows the withheld tier held; null = never recorded
          "reason": "..."   // why, in words a reader can act on
        }
      }
    }
  },
  "philadelphia": {
    "newConstruction": { /* ... */ },
    // A city whose script computes no split at all. Its aggregate spans every
    // tier, so serving the aggregate for any tier is the disclosed answer.
    "tierBreakdown": { "attempted": false, "reason": "..." }
  }
  // ...other cities merge in alongside
}
```

### Why `tierBreakdown` exists

`attempted: false` and a *suppressed tier* used to look identical in this file —
both were simply "no `byTier` entry for that tier" — and
`measuredFor(city, tier)` served the city aggregate for both. Denver's `multi`
tier fell under the n<30 floor, so **a Denver duplex was answered with the
4.5-month city aggregate**: 3,505 single-family rows, 628 apartment rows, the
untiered residential rows and the whole commercial layer, fewer than 30 of which
are 2–4 unit buildings. That is rule 5 — a known absence and a missing lookup
must not render the same.

Now: `measuredFor` **fails closed** for any tier absent from an *attempted*
breakdown, and keeps the aggregate fallback only where no breakdown was
attempted. The result page renders the closed case as
*"Not measured — for 2–4 unit buildings"* rather than dropping the card.

Do not hand-write the suppression record. `splitTiersAtFloor()` in
[`lib/tierFloor.mjs`](./lib/tierFloor.mjs) applies the floor **and** emits the
record from the same call, so a tier cannot be dropped without one.

### `feed` — the source feed's row count at extraction time

Every script here records, on the run that produces a figure, how many rows its
feed held. Optional on an entry (runs predating the instrumentation have none,
and are **not** backfilled); written by `feedCounts()` in
[`../lib/feedCounts.mjs`](../lib/feedCounts.mjs); the contract, and why the two
counts must not be conflated, is the type in
[`netlify/functions/lib/feedCounts.ts`](../../netlify/functions/lib/feedCounts.ts).
The scripts that refuse to write **log** the same counts on their halt path.

```jsonc
"feed": {
  "observedAt": "2026-08-06",          // must equal the vintage's compute date
  "totals": [                          // one entry PER ENDPOINT the script read
    { "endpoint": "data.austintexas.gov/resource/3syk-w9eu", "totalRows": 2369500 }
  ],
  "cohortRows": 18270,                 // rows passing this script's window + filters
  "basis": "totalRows: … cohortRows: …"
}
```

## Sanity gates (every script)

- Drop records with a **negative** or **> 120-month** filing→issuance span.
- If the **median < 0.5 months** or **n < 30**, treat the result as
  unreliable and **do not write** it — print why and leave the city absent.
- Per tier, the same n<30 floor applies — but a suppressed tier is **recorded,
  not dropped**: use `splitTiersAtFloor()`, which returns `{ tiers,
  tierBreakdown }` together. A city that writes `byTier` without `tierBreakdown`
  fails `netlify/functions/lib/timeline.test.ts`.
- Probe the schema first; if an expected date/type field is missing, **fail
  loudly** rather than fabricate a latency figure (the Boston lesson).

## Run status

*Refreshed 2026-08-09 by reading the artifact, not by re-running the scripts.*
Every figure below is transcribed from
`netlify/functions/lib/data/permitStats.json`, and the publish/withhold column is
transcribed from `CITIES_WITH_MEASURED_PERMITS` in `src/config/cities.ts`. Those
two remain **authoritative over this table**, and a test in
`netlify/functions/lib/timeline.test.ts` asserts they agree with each other. If
this table ever disagrees with them, they are right and this is stale — the
figures move whenever a script is re-run, but the *set* of publishing cities is
test-enforced.

**6 of the 23 cities in the index publish a measured figure.** The other 17 do
not, and the reason differs per city — a city with no line is unmeasured, never
"fast". *(This line said 8 until 2026-08-09; NYC and Seattle were withdrawn the
same day.)*

### Publishing (6)

`computed` is the vintage stamp on the row, not the date this table was written.

| City | Script | Median | p80 | n | computed | Source & filter |
|------|--------|-------:|----:|--:|---|---|
| **Nashville** | `nashville.mjs` | **1.2 mo** | **2.8 mo** | **7,796** | 2026-08-06 | ArcGIS `Building_Permits_Issued_2` L0; `Per_Ty IN (CARN, CACN, CACH)`, building `Per_SubTy` only. ⚠️ Rolling ~3-yr **issued-only** window (applied 2023-08-01+, not 2022) → a **FLOOR**; 24.9% of rows cite a master permit. |
| **Raleigh** | `raleigh.mjs` | **1.8 mo** | **3.2 mo** | **7,475** | 2026-08-09 | ArcGIS `Building_Permits` L0; `workclass IN (New Building, New Residential Dwelling, Townhouse, Shell Building)`, building `proposeduse` only. Feed carries **non-issued** rows (90.7% of window filings have an issue date), so ≈unconditional, not a floor. ⚠️ The row is not the project — per-unit/per-building child permits. |
| **Austin** | `austin.mjs` | **2.1 mo** | **6.1 mo** | **11,534** | 2026-08-06 | Socrata Issued Construction Permits; `permittype = 'BP'`, `work_class IN (New, Shell)`, building `permit_class` only. |
| **Philadelphia** | `philadelphia.mjs` | **3.0 mo** | **6.3 mo** | **3,766** | 2026-08-05 | `phl.carto.com` permits (`permitdescription` = Residential/Commercial Building Permit, `typeofwork = New Construction*`) **joined on permit number** to ArcGIS `AGO_Lyr_Permit_App_Status_Eclipse.APPLICATIONDATE`. No tier split. |
| **Denver** | `denver.mjs` | **4.5 mo** | **11.1 mo** | **6,922** | 2026-08-06 | ArcGIS denvergov Construction Permits; residential `CLASS = 'NEW BUILDING'` + commercial `CLASS IN ('NEW BUILDING','PHASED CONSTRUCTION')`. ⚠️ `multi` tier **suppressed** under the n<30 floor. |
| **Miami** | `miami.mjs` | **12.6 mo** | **21.4 mo** | **991** | 2026-08-06 | ArcGIS "Building Permits Since 2014"; `ScopeofWork = 'NEW CONSTRUCTION'`, master permits `PermitNumber LIKE '%001B001'`, building `WorkItems` allowlist; `PlanCreatedDate → IssuedDate`. Issued-only → a FLOOR. |

### Not publishing (17)

| City | Script | Why no figure |
|---|---|---|
| **Boston** | `boston.mjs` | **No application-date column exists** in the CKAN schema (25 columns; only other timestamp is `expiration_date`, derived from issuance). `applicationDateField()` throws `ComputabilityHalt`; **exits 0** — a permanent known gap, not a broken pipeline. |
| **DC** | `dc.mjs` | **No application/filed date.** DCRA ArcGIS feed carries `ISSUE_DATE` + the GIS stamps `CREATED_DATE`/`LAST_EDITED_DATE`, which are a single ETL load timestamp. Warns and returns; **exits 0**. See below. |
| **Minneapolis** | `minneapolis.mjs` | **No application/filed date.** `CCS_Permits` carries `issueDate` + project `completeDate` (which falls *after* issuance). Legacy per-year Hub layers stop at 2014. Warns and returns; **exits 0**. See below. |
| **San Jose** | *none* | Publishes only issue-side dates; `FINALDATE` is **final inspection**, not filing. No script written. |
| **Milwaukee** | `milwaukee.mjs` | **WITHHELD 2026-08-08 — refuses by design.** Both dates are clean (0.00% null) and the *residential* pair measures (single 2.3 mo n=262, multi 5.3 mo n=83), but Milwaukee files all 5+-unit multifamily as commercial and the commercial half of `Use of Building` is **free text** (123 distinct strings over 354 rows, 25.7% singletons, 15.0% blank). `refuseUnlessEnumerable()` throws before any write → **exits 1, by design.** |
| **Columbus** | *none* | Publishes **no application date**. No usable feed. |
| **Atlanta** | *none* | Publishes **no issue date**. No usable feed. |
| **Charlotte** | *none* | Publishes **no building-permit dataset at all** — established by enumerating the portal's full 300-dataset catalogue through its own OGC search API, so this is a verified absence, not a failed guess. |
| **SF** | `sf.mjs` | **WITHDRAWN 2026-08-06; refuses by design since 2026-08-09.** 132 of 351 in-window filings carry an issue date — **37.61%** — so the unconditional median **does not exist**: the 50th percentile is past the last observation. Per tier 39.4% / 30.1% / 43.2%, none clearing 50%. `refuseUnlessQuantilesAreObserved()` throws before any write → **exits 1, by design.** |
| **Chicago** | `chicago.mjs` | **WITHDRAWN 2026-08-05; refuses by design since 2026-08-09.** **21.45%** of the sample is stamped `applied == issued`, and removing those rows moves the median **1.0 → 1.7 mo**. The mass is a cohort property, not a process one: same-day runs 51.61% (2022) / 31.18% (2023) against 2.57% / 3.20% / 4.64% for 2024-26. `refuseUnlessReviewIsObserved()` throws before any write → **exits 1, by design.** |
| **NYC** | `nyc.mjs` | **WITHDRAWN 2026-08-09; refuses by design.** Published **8.3 mo / p80 17.0 / n=4,403** from 2026-08-06. The figure was a median **conditional on issuance**, and the condition lived only in the artifact's `vintage` string, which `src/lib/realityCheck.ts` never renders. Measured 2026-08-09 through this script's own filters, **662 of 1,040** in-window `-I1` filings carry an issue date — **63.65%** — which clears p50 and fails p80, so it is specifically the published **p80 of 17.0** that is unidentified (LA's shape, not SF's). By filing year 71.4% / 63.4% / 57.0% / 46.8%, so no matured cohort rescues it. `refuseUnlessQuantilesAreObserved()` throws before any write → **exits 1, by design.** ⚠️ Kaplan-Meier's ~15.9 mo is **not** a replacement — see the note under the table. |
| **Seattle** | `seattle.mjs` | **WITHDRAWN 2026-08-09; refuses by design.** Published **5.7 mo / p80 10.0 / n=4,996** from 2026-08-06. Same defect class as NYC, found differently: the **outcome-selection guard's** registry demands a measured share on every `known-defect` exemption, and measuring Seattle's — its own cohort filter against `76t5-zqzr` run with and without the `issueddate IS NOT NULL` limb — gave **6,980** in-window applications, **5,215** observed = **74.71%** (the limb hid 1,765 filings). That clears p50 and fails p80, so the published **p80 of 10.0** was unidentified. The script's own RESULTS block had recorded 74.1% observed beside the p80 it unidentifies. The median is **not republished alone** — at 74.71% it is conditional on issuance and no UI surface renders the condition (the Milwaukee reason) — and `byTier` cannot come back on an aggregate share: per-tier shares are only **bounded** (`housingunitsadded` is 58.2% populated on non-issued rows), no tier's lower bound clears 80, and apartment's interval straddles 50. `refuseUnlessQuantilesAreObserved()` throws before any write → **exits 1, by design.** |
| **LA** | `la.mjs` | **WITHDRAWN 2026-08-05; refuses by design since 2026-08-09.** The feed *this script reads* (`pi9x-tg5x`) is **issued-only** — `issue_date` is non-null on 404,414 of 404,414 rows, and `status_desc` carries no pre-issuance value — so the issuance rate is not computable **from it**. `refuseUnlessIssuanceIsMeasurable()` throws before any write → **exits 1, by design.** ✅ The recorded reason (45.4% / 64.1%) **does reproduce** — against LADBS's *submitted* feed `gwh9-jnip`, sourced 2026-08-09; at 54.64% observed the p80 of 13.0 is unidentified. See the note under the table. |
| **San Diego** | *none* | **WITHDRAWN 2026-08-05. Wrong date field** — the start stamp is documented as when a permit is "added to the Permit System", never earlier than intake (median +14 d, p90 +181 d), and 8.93% of rows are `create == issue` on projects filed a median 928 days earlier. The UI called it "Median filing→permit". It was not. No script retained. |
| **Dallas** | `dallas.mjs` | **CLASSIFIED 2026-08-10 — refuses by design.** The only feed with both dates ("New Permits 1971-2024", City of Dallas GIS Services) is a **terminal snapshot** of the retired Posse system ("no updates planned", max dates 2024-11-12). CREATED_DATE is a real per-row application date (checked against the DC ETL-stamp trap) and the new-construction filter is a closed vocabulary — but **8,509 of 11,587** gated 2022+ filings carry an issue date = **73.44%**, identifying the p50 and **not the p80** (per tier: single 93.01%, multi 70.74%, apartment 47.76% — below even the median). Live Dallas permitting (Accela) publishes no open-data feed; the Socrata dataset is flagged historical, frozen 2020-08-30, `issued_date` only. `refuseUnlessQuantilesAreObserved()` throws before any write → **exits 1, by design.** |
| **Las Vegas** | *none* | **No application-date slot.** The portal's live "Building Permits" (436,689 rows, refreshed through 2026-08-07) carries exactly one date field, `ISSDTTM` — established by the slot test, not a blank row. The only both-dates layer (`Bldg_Permits`, an operational INFOR dump) is not an open-data product and measured unusable: ~11.6× row duplication (288,841 rows vs 24,861 distinct permits in 2024), misaligned columns, `DD-MON-YY` two-digit-year strings, and no enumerable new-construction class ('SFD Tract' exists; custom/commercial ground-up hides in `Building`/`OTC` free text). No script written. |
| **Phoenix** | *none* | **Publishes no per-permit dataset at all** — the portal's full 160-package CKAN catalogue was enumerated through its own API (2026-08-10). The sole building-permit package is a HUD SOCDS export of **annual counts** (no dates, no permit rows), and the PDD ArcGIS dashboards are fed by CMPR KPI aggregates. Charlotte's class: a verified absence of the dataset itself. |

> ✅ **`sf.mjs`, `chicago.mjs` and `la.mjs` now refuse structurally (2026-08-09).**
> Until then nothing in the three scripts stopped a write — the withdrawal lived
> only in `permitStats.json` (by absence) and in
> `netlify/functions/lib/timeline.test.ts`, so re-running any of them merged its
> disqualified figure straight back into production data and the test caught it
> only *afterwards*. Each now recomputes **its own** disqualifier from the live
> feed and halts on it before any write; all three verified halting with
> `permitStats.json` byte-identical. The test assertions stay as the second line
> of defence. Do not treat a green run of these scripts as permission to publish.

> ✅ **LA's recorded withdrawal reason RECONSTRUCTS — the source is `gwh9-jnip`.**
> **Resolved 2026-08-09.** Earlier the same day this section read *"LA's recorded
> withdrawal reason does not reproduce"*. **That note was itself the error and is
> withdrawn.**
>
> The 2026-08-05 audit recorded *"45.4% of the cohort carries no issue date at
> extract; only 64.1% of the matured 2022 cohort carries one"*. Re-probing
> `pi9x-tg5x` returned **100.00%** — all 14,225 in-window `Bldg-New` rows carry an
> issue date — and that was read as irreproducibility. It was an instrument
> mismatch, textbook **rule 11**: `pi9x-tg5x` is titled *"Building Permits
> **Issued** from 2020 to Present"*, and asking an issued-only feed how many
> applications never issued measures the query rather than the city.
>
> LADBS publishes a companion feed — **`gwh9-jnip`, "Building and Safety - Building
> Permits SUBMITTED from 2020 to Present"** — found by reading the portal's own
> catalogue rather than guessing ids (rule 8). Against it, measured 2026-08-09 over
> two isolated passes (rule 10), all three recorded figures reconstruct to the
> decimal:
>
> | recorded | measured on `gwh9-jnip` | query |
> |---|---|---|
> | 45.4% carry no issue date | **45.36%** (11,810 / 26,035) | `permit_type='Bldg-New'`, `submitted_date ≥ 2022-01-01` |
> | only 54.6% observed | **54.64%** | same cohort |
> | 64.1% of the matured 2022 cohort | **64.11%** (3,901 / 6,085) | `submitted_date` in 2022 |
>
> The denominator is genuine, not a null artifact. Rows without an `issue_date`
> carry a real pre-issuance `status_desc` vocabulary — Quality Review Completed
> 5,592, Verifications in Progress 2,902, PC Info Complete 1,215, Corrections
> Issued 698, PC Approved 648, Ready to Issue 286, Submitted 87, Plans on Hold 16 —
> exactly the values correctly reported as absent from `pi9x-tg5x`. The feeds join
> cleanly both ways: **0 of 12** sampled never-issued permit numbers appear in
> `pi9x-tg5x`, and **12 of 12** sampled issued permits appear in `gwh9-jnip` with
> `issue_date` set. `gwh9-jnip` is the application population; `pi9x-tg5x` is its
> issued subset.
>
> **This makes LA's withdrawal stronger, not weaker.** The reason is not "no
> denominator exists" — the denominator exists and it *disqualifies* the figure. At
> 54.64% observed the quantile-existence rule identifies p50 (54.64 > 50) and not
> p80 (54.64 < 80), and the withdrawn pair was median 6.0 / **p80 13.0**. LA stays
> withdrawn, now for a sourced reason rather than a recorded one.
>
> **Open decision (not automatable):** repointing `la.mjs` at `gwh9-jnip` is now a
> real option — it would supply the 11,810 censored observations Kaplan-Meier
> needs. That means choosing between a KM estimate and a labelled conditional
> median, splitting by tier, and re-running the audit. Bring it to a person; do not
> let an unattended run adopt the new feed.

### NYC — WITHDRAWN 2026-08-09, and which feeds were rejected on the way in

NYC published **8.3 mo / p80 17.0 / n=4,403** from 2026-08-06 and is now
withdrawn; the section below is kept because it records which feeds were rejected
and why, and re-adopting one of them is the likeliest way to get this wrong
again. The withdrawal itself is at the end.

- **DOB NOW: Build – Approved Permits (`rbx6-tga4`)** — carries `approved_date` +
  `issued_date`. **No filing/applied date**, so the filing leg cannot be measured
  without fabricating it. Rejected.
- **DOB Permit Issuance (`ipu4-2q9a`)** — the legacy BIS feed. It exposes
  `filing_date`, `issuance_date` and `job_type`, and `nyc.mjs` used to use it. Two
  gotchas were handled (both dates are **TEXT `MM/DD/YYYY`**, so a server-side
  `>= '2022-01-01'` compares lexicographically and silently returns the wrong
  rows; `permit_sequence__` is zero-padded `'01'`). **The deal-breaker:** for
  original NB permits issued 2022–2025, **74.5% have
  `filing_date == issuance_date`** — the feed stamps both legs at issuance, so the
  median came out at **0 months**. The sanity gate (median < 0.5 mo) caught it.
  Rejected.
- **DOB NOW: Build – Job Application Filings (`w9ak-ipjd`)** — what `nyc.mjs`
  reads. `filing_date` and `first_permit_date` are real `calendar_date` columns,
  so a server-side `>=` is correct. The load-bearing filter is
  `job_filing_number LIKE '%-I1'`, which keeps **initial** filings only; the `-S*`
  rows are subsequent per-work-type filings (plumbing, sprinkler, structural) —
  the sub-permits that contaminated the old query, and still 5,075 of the 12,417
  in-window NB filings, so the filter is still doing real work. ⚠️ The 2026-08-06
  counts recorded here (4,394 `-I1` of 19,319 permitted NB filings, 14,029 `-S*`)
  **no longer reproduce**: measured 2026-08-09, `job_type='New Building'` returns
  13,353 rows of which 5,469 are permitted and 914 are `-I1`. Resource id, name
  and column set are unchanged and `rowsUpdatedAt` is current, so the population
  itself appears ~3.5x smaller than the record. **Cause not diagnosed.** It is a
  reason to distrust the 2026-08-06 extract, never a reason to publish today's
  numbers (median 12.0 / p80 22.4 / n=662), which fail the same gate.

#### The withdrawal

The paragraph that used to close this section was headed *"Known limitation, not
corrected"* and ended *"correcting it is a separate pass"*. It recorded that the
8.3 was **conditional on issuance** — 45% of initial NB filings since 2022 carried
no issue date at extract, the permitted share falling by cohort (1461/1960 in 2022
→ 764/1764 in 2025), the pooled figure sitting *below* the mature 2022 cohort's
10.1 months, and Kaplan-Meier over all 8,039 filings giving **~15.9 months**,
roughly **2x** what shipped.

All of that was true, written down, and served anyway for three days. Two reasons,
both mechanical:

1. **The script could not see its own disqualifier.** `pull()` ended
   `AND first_permit_date IS NOT NULL`, so `main()` reproduced 8.3 exactly and had
   no access to the denominator sitting four paragraphs above it in the same file.
   A query that selects on the outcome cannot measure how often the outcome
   occurs.
2. **The condition had nowhere to be shown.** "Conditional on issuance" could only
   have been stated in the artifact's `vintage` string, and
   `src/lib/realityCheck.ts` does not render `vintage`. The card read *"Median
   filing→permit in New York City"*. A caveat nobody can see is not a caveat —
   which is exactly why Milwaukee's sound residential pair is still withheld.

**What the gate now measures**, recomputed every run: 662 of 1,040 in-window `-I1`
filings carry an issue date = **63.65%**. That clears p50 and fails p80, so it is
specifically the published **p80 of 17.0** that is unidentified. By filing year:
2022 71.4%, 2023 63.4%, 2024 57.0%, 2025 46.8% — even the matured cohort fails.
Both extracts fail the same limb (55% observed in 2026-08-06, 63.65% today), so
the gate would have refused on either.

⚠️ **Withdrawing is not publishing 15.9.** The KM figure assumes something about
what the non-issued filings eventually do, and nothing here has adopted that
assumption. Removing a wrong number is finished work; choosing an estimator is a
decision for a person.

⚠️ **Retraction.** This section used to say NYC's feed *"does not distinguish a
not-yet from a never"*. That is true of SF's and LA's feeds and **false here** — it
was copied in rather than checked against NYC. `filing_status` over the 378
non-issued rows: Objections 155, Approved 151, **Filing Withdrawn 57**, Plan
Examiner Review 7, On Hold – Administrative Action 6, QA Failed 1,
OnHold-NoGoodCheck 1. So 57 *are* terminal. This does not change the withdrawal —
dropping them gives 662/983 = 67.3%, still failing p80 — but "state the share, not
the fate" forbids asserting a fate you cannot see, and does not licence asserting
that no feed records one.

### DC — why it is absent (honest failure, the Boston mode)

DC publishes building permits only as **ArcGIS FeatureServer** layers
(opendata.dc.gov → `maps2.dcgis.dc.gov/.../FEEDS/DCRA/FeatureServer`, one layer
per year), so `dc.mjs` speaks ArcGIS REST rather than Socrata. The schema probe
is the deal-breaker: the DCRA feed carries `ISSUE_DATE` plus the GIS
housekeeping stamps `CREATED_DATE` / `LAST_EDITED_DATE` — and **no
application/filed date**. `CREATED_DATE` is a single ETL load timestamp (every
new-building row in the 2024 layer reads `2026-06-09`, ~850–890 days after
issuance), i.e. when the record was loaded into GIS, not when the permit was
filed. Using it would fabricate the filing leg. (`PERMIT_SUBTYPE_NAME =
'NEW BUILDING'` does correctly isolate ground-up construction — the gap is the
missing filing date, not the type filter.) `dc.mjs` therefore documents the gap
and **writes nothing**, exiting 0. If DC ever exposes a genuine
application/submitted timestamp, add it to `APPLIED_DATE_CANDIDATES` in
`dc.mjs` and re-run.

### Minneapolis — why it is absent (honest failure, the Boston/DC mode)

Minneapolis publishes building permits through its ArcGIS Hub portal
(opendata.minneapolismn.gov → `services.arcgis.com/afSMGVsC7QlRK1kZ`), so
`minneapolis.mjs` speaks ArcGIS REST. The current feed is the **`CCS_Permits`**
FeatureServer (CCS = Construction Code Services). The schema probe is the
deal-breaker: it carries `issueDate` and `completeDate` — and **no
application/filed/submitted date**. `completeDate` is the *project*-completion
date (after issuance, and frequently null), the wrong direction entirely, so it
can't supply the filing leg. (`workType = 'New'` does correctly isolate
ground-up construction — the gap is the missing application date, not the type
filter.) The legacy per-year `Minneapolis_Building_Permits_YYYY` Hub layers were
also checked and stop at **2014**, too old for a 2022+ vintage. `minneapolis.mjs`
therefore documents the gap and **writes nothing**, exiting 0. If Minneapolis
ever exposes a genuine application/submitted timestamp, add it to
`APPLIED_DATE_CANDIDATES` in `minneapolis.mjs` and re-run.

## All twenty cities accounted for

The index holds **20** cities. **15** have a script; **6** publish a figure.

- **6 publish** — Austin, Denver, Miami, Nashville, Philadelphia, Raleigh. This
  set is exactly `CITIES_WITH_MEASURED_PERMITS`, and a test asserts it equals
  the set of cities carrying a `newConstruction` block in `permitStats.json`.
  *(This bullet counted 8 — with NYC and Seattle — until 2026-08-09, when both
  were withdrawn in the same pass that had left this very count stale once
  already. Headers and summaries are read first; check this one against the
  artifact when anything moves.)*
- **4 have a script that computes and then refuses** — Boston, DC, Minneapolis
  (no application-date column; exit 0) and Milwaukee (commercial use-column not
  enumerable; **exit 1**).
- **5 have a script but are WITHDRAWN** — SF, Chicago, LA, NYC, Seattle. All
  five refuse structurally, each recomputing its own disqualifier from the live
  feed and halting before any write (**exit 1**); see the gate table under "A
  script may exist and correctly publish nothing". *(This bullet read "The
  scripts have no refusal gate" until 2026-08-09 — true when written, stale the
  moment the gates landed, and contradicted by the gate table in this same file.
  A summary goes stale in the direction of whatever it once described.)*
- **5 have no script** — San Diego (withdrawn: wrong date field), San Jose
  (issue-side dates only), Columbus (no application date), Atlanta (no issue
  date), Charlotte (no permit dataset at all).

Re-run each publishing script **quarterly** to refresh the vintage, then commit
the updated `permitStats.json` — and update the tables above from the artifact in
the same pass, since nothing tests the *figures* transcribed here.

## A script may exist and correctly publish nothing

Nine of these scripts compute what they can and then refuse to write, and in the
seven cases below the refusal is **a function you can read** rather than an
accident of ordering. (`dc.mjs` and `minneapolis.mjs` refuse too, at an inline
`if (!appliedField)` guard that warns and returns — same outcome, weaker
structure.)

Every gate refuses on **the specific disqualifying condition, recomputed from the
live feed on each run** — never on a flag or a stored boolean, which is a comment
with a type. None of them can be reached past by a caveat, an env var or a
`--force`; the only thing that opens one is the city publishing different data.

| Script | Gate | Why | Exit |
|---|---|---|---|
| `boston.mjs` | `applicationDateField()` | No application-date column exists. The latency has no numerator, so the gate throws a `ComputabilityHalt`. *(Its header comment used to cite a `refuseUnlessComputable()` that never existed; corrected 2026-08-09 to name the real gate — the defect class the ledger records, a claim written down that nothing checks.)* | **0** |
| `milwaukee.mjs` | `refuseUnlessEnumerable()` | Both dates exist and are clean, but the commercial half of `Use of Building` is free text (123 distinct strings over 354 windowed rows, 25.7 % singletons, 15.0 % blank), and Milwaukee files all 5+-unit multifamily as commercial. The apartment tier cannot be enumerated. | **1** |
| `sf.mjs` | `refuseUnlessQuantilesAreObserved()` | 37.61% of the cohort carries an issue date, so neither published quantile is identified — a p-th quantile needs an observed share above *p*, and the p50 lands inside the unobserved 62%. Re-run per tier, so a thin tier cannot ride an aggregate over the line. | **1** |
| `chicago.mjs` | `refuseUnlessReviewIsObserved()` | Two limbs: 21.45% of rows are `applied == issued` (limit 10%), and removing them moves the median 1.0 → 1.7 (limit 0.2). Both calibrated against three publishing cities measured the same way — 1.13–3.29% same-day, 0.0–0.1 shift. | **1** |
| `la.mjs` | `refuseUnlessIssuanceIsMeasurable()` | Limb 1: `pi9x-tg5x` is issued-only, so the share is 100% *by construction* and the denominator is a missing lookup, not an answer. Limb 2 (unreachable against *this* feed) applies SF's quantile bound. Note both limbs condemn LA: on LADBS's submitted feed `gwh9-jnip` the share is 54.64%, which fails limb 2 at p80. | **1** |
| `nyc.mjs` | `refuseUnlessQuantilesAreObserved()` | 63.65% of the in-window `-I1` cohort carries an issue date. The p50 is identified; the published p80 of 17.0 is not — it lands inside the unobserved 36.35%, past the last observation. The gate publishes both, so it writes nothing. | **1** |
| `seattle.mjs` | `refuseUnlessQuantilesAreObserved()` | 74.71% of the in-window cohort (server-side, both arms) carries an issue date; p50 identified, published p80 of 10.0 not. Reports the two arms' shares separately ('New' ~71%, DADU ~88%) because the arm that dominates the published number carries the lower share and pooling must not read as rescue. | **1** |

**Why the exit codes differ.** Boston's gap is structural and permanent — a
column that does not exist, which no re-run can change — so exiting 0 stops a
batch runner treating a known-forever gap as a broken pipeline. The other six
refuse on a **live-data condition that every run genuinely re-tests**, five of
them on cities whose figures were published and then retracted. A silent exit 0
there is rule 18's failure exactly: the run would look like success.

### Choosing a threshold for a new gate

Two of these gates need no threshold at all, and that is the shape to reach for
first. `sf.mjs` compares the observed share against **the quantile it publishes** —
the number is not chosen, it is the definition of the statistic, and no safety
margin is added because the test is an *existence* condition rather than a
quality one. `la.mjs` limb 1 is a count of zero.

Where a number is unavoidable (`chicago.mjs`), **calibrate it against cities
measured the same way and leave the gap visible**, the way `milwaukee.mjs` sets
its vocabulary limits against the residential column that passes them. Chicago's
10% sits 3× above the highest clean comparator (so drift does not start tripping
it) and below half of Chicago's own 21.45% (so dilution does not let Chicago
under it). Splitting the difference between two numbers is not calibration.

**A gate that would pass at today's data is not a gate.** Run the script and
watch it halt.

Milwaukee is the case worth understanding before adding a city. Its residential
figures are sound — single 2.3 mo (n=262), multi 5.3 mo (n=83) — and they were
withheld for a **wiring** reason on top of the data one.

> ⚠️ **That wiring reason is fixed as of 2026-08-09 and the sentence that used to
> stand here is now false.** It read: "`measuredFor(city, tier)` falls back to
> `newConstruction` for any tier without its own entry". It no longer does — see
> `tierBreakdown` above. An apartment query in a city publishing only 1-2-family
> tiers now renders *"Not measured — for 5+ unit buildings"*, not a house's
> number.

Milwaukee stays absent because its commercial `Use of Building` column cannot be
enumerated, and because publishing its residential pair needs a live re-run and a
product decision. `refuseUnlessEnumerable()` still throws before any write.

**Before publishing a city whose tiers are partial, check what the aggregate will
be served for** — the check is now mechanical (`tierBreakdown` + the test in
`netlify/functions/lib/timeline.test.ts`), but a caveat in `vintage` is still not
a disclosure: nothing renders it.
