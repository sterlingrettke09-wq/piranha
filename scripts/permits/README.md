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

> Measured: the median new-construction permit in Seattle ran 5.7 months
> from application to issuance (p80 10.0, n=4996; …) — permit time only, a subset
> of the full life-cycle shown above.

The measured figure is **never** folded into the estimated months; it sits
beside it as an empirical sanity check.

## How to run

One command per city. No dependencies beyond Node 18+ (global `fetch`):

```bash
# ── Publish a figure (these eight are the current artifact) ────────────────
node scripts/permits/austin.mjs
node scripts/permits/denver.mjs       # ArcGIS (denvergov org); DATE_RECEIVED → lands
node scripts/permits/miami.mjs        # ArcGIS; master building permits only
node scripts/permits/nashville.mjs    # ArcGIS; rolling ~3-yr ISSUED window → a FLOOR
node scripts/permits/nyc.mjs          # DOB NOW w9ak-ipjd, initial -I1 filings only
node scripts/permits/philadelphia.mjs # Carto permits ⋈ ArcGIS APPLICATIONDATE
node scripts/permits/raleigh.mjs      # ArcGIS; carries NON-ISSUED rows
node scripts/permits/seattle.mjs

# ── Compute, then correctly REFUSE to write (see "Run status") ─────────────
node scripts/permits/boston.mjs       # no application-date column → halt, exit 0
node scripts/permits/dc.mjs           # no application-date column → warn, exit 0
node scripts/permits/minneapolis.mjs  # no application-date column → warn, exit 0
node scripts/permits/milwaukee.mjs    # commercial use-column unenumerable → throws, exit 1

# ── ⚠️ WITHDRAWN. Do NOT run these to refresh the artifact ─────────────────
# They have no refusal gate and WILL write their disqualified figures back
# into permitStats.json. See "Run status" below before touching them.
# node scripts/permits/sf.mjs
# node scripts/permits/chicago.mjs
# node scripts/permits/la.mjs
```

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
  "seattle": {
    "newConstruction": {
      "medianMonths": 5.7,   // median application → issuance, one decimal
      "p80Months": 10.0,     // 80th-percentile, one decimal
      "n": 4996,             // permits in the sample
      "vintage": "applied 2022-01-01 onward; computed 2026-08-06; data.seattle.gov Building Permits (permittypedesc = New, …)"
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
  "nyc": {
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

**8 of the 20 cities in the index publish a measured figure.** The other 12 do
not, and the reason differs per city — a city with no line is unmeasured, never
"fast".

### Publishing (8)

`computed` is the vintage stamp on the row, not the date this table was written.

| City | Script | Median | p80 | n | computed | Source & filter |
|------|--------|-------:|----:|--:|---|---|
| **Nashville** | `nashville.mjs` | **1.2 mo** | **2.8 mo** | **7,796** | 2026-08-06 | ArcGIS `Building_Permits_Issued_2` L0; `Per_Ty IN (CARN, CACN, CACH)`, building `Per_SubTy` only. ⚠️ Rolling ~3-yr **issued-only** window (applied 2023-08-01+, not 2022) → a **FLOOR**; 24.9% of rows cite a master permit. |
| **Raleigh** | `raleigh.mjs` | **1.8 mo** | **3.2 mo** | **7,475** | 2026-08-09 | ArcGIS `Building_Permits` L0; `workclass IN (New Building, New Residential Dwelling, Townhouse, Shell Building)`, building `proposeduse` only. Feed carries **non-issued** rows (90.7% of window filings have an issue date), so ≈unconditional, not a floor. ⚠️ The row is not the project — per-unit/per-building child permits. |
| **Austin** | `austin.mjs` | **2.1 mo** | **6.1 mo** | **11,534** | 2026-08-06 | Socrata Issued Construction Permits; `permittype = 'BP'`, `work_class IN (New, Shell)`, building `permit_class` only. |
| **Philadelphia** | `philadelphia.mjs` | **3.0 mo** | **6.3 mo** | **3,766** | 2026-08-05 | `phl.carto.com` permits (`permitdescription` = Residential/Commercial Building Permit, `typeofwork = New Construction*`) **joined on permit number** to ArcGIS `AGO_Lyr_Permit_App_Status_Eclipse.APPLICATIONDATE`. No tier split. |
| **Denver** | `denver.mjs` | **4.5 mo** | **11.1 mo** | **6,922** | 2026-08-06 | ArcGIS denvergov Construction Permits; residential `CLASS = 'NEW BUILDING'` + commercial `CLASS IN ('NEW BUILDING','PHASED CONSTRUCTION')`. ⚠️ `multi` tier **suppressed** under the n<30 floor. |
| **Seattle** | `seattle.mjs` | **5.7 mo** | **10.0 mo** | **4,996** | 2026-08-06 | Socrata Building Permits; `permittypedesc = 'New'`, plus Addition/Alteration rows whose *filing-time* description states a detached ADU; STFI excluded. |
| **NYC** | `nyc.mjs` | **8.3 mo** | **17.0 mo** | **4,403** | 2026-08-06 | Socrata **DOB NOW `w9ak-ipjd`** (not the legacy BIS feed); `job_type = 'New Building'`, `job_filing_number LIKE '%-I1'` (initial filings only). No tier split. ⚠️ Conditional on issuance — see below. |
| **Miami** | `miami.mjs` | **12.6 mo** | **21.4 mo** | **991** | 2026-08-06 | ArcGIS "Building Permits Since 2014"; `ScopeofWork = 'NEW CONSTRUCTION'`, master permits `PermitNumber LIKE '%001B001'`, building `WorkItems` allowlist; `PlanCreatedDate → IssuedDate`. Issued-only → a FLOOR. |

### Not publishing (12)

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
| **SF** | `sf.mjs` | **WITHDRAWN 2026-08-06.** Only 37.7% of new-construction filings since 2022 carry an issue date at extract, so the unconditional median **does not exist** — the 50th percentile is past the last observation. A "floor" label cannot rescue an undefined statistic. |
| **Chicago** | `chicago.mjs` | **WITHDRAWN 2026-08-05.** 46% of the sample was a 2022-23 cohort with 51.6%/31.2% of records stamped `applied == issued` — a backfill artifact that roughly **halved** the median. Clean 2024-25 cohorts give 1.71 mo, not the published 1.0. |
| **LA** | `la.mjs` | **WITHDRAWN 2026-08-05.** 45.4% of the cohort carries no issue date at extract, and only 64.1% of the matured 2022 cohort does, so the published **p80 of 13.0 is undefined**, not merely imprecise. |
| **San Diego** | *none* | **WITHDRAWN 2026-08-05. Wrong date field** — the start stamp is documented as when a permit is "added to the Permit System", never earlier than intake (median +14 d, p90 +181 d), and 8.93% of rows are `create == issue` on projects filed a median 928 days earlier. The UI called it "Median filing→permit". It was not. No script retained. |

> ⚠️ **`sf.mjs`, `chicago.mjs` and `la.mjs` are still present and have NO refusal
> gate.** Unlike Boston/DC/Minneapolis/Milwaukee, nothing in them stops a write —
> re-running any of the three merges its disqualified figure straight back into
> `permitStats.json`. The backstop is `netlify/functions/lib/timeline.test.ts`,
> which asserts all three resolve to **no** measurement, so a silent reinstatement
> fails the suite rather than shipping. Do not treat a green run of these scripts
> as permission to publish.

### NYC — how it came to publish, and which feeds were rejected

NYC now publishes **8.3 mo / p80 17.0 / n=4,403**. It got there by changing
*dataset*, so the two rejected feeds are recorded here to stop either being
re-adopted:

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
- **DOB NOW: Build – Job Application Filings (`w9ak-ipjd`)** — what is used now.
  `filing_date` and `first_permit_date` are real `calendar_date` columns, so a
  server-side `>=` is correct. The load-bearing filter is
  `job_filing_number LIKE '%-I1'`, which keeps **initial** filings only: of 19,319
  permitted NB filings just 4,394 are `-I1`; the other 14,029 are `-S*` subsequent
  per-work-type filings (plumbing, sprinkler, structural) — the sub-permits that
  contaminated the old query. Cross-check: all 4,394 carry
  `general_construction_work_type_ = 'YES'`, and that independent discriminator
  yields the identical 8.3 / 17.0.

⚠️ **Known limitation, not corrected.** The 8.3 is **conditional on issuance**:
45% of initial NB filings since 2022 carry no issue date at extract, and the
permitted share falls by cohort (1461/1960 in 2022 → 764/1764 in 2025), so recent
cohorts are right-censored and the pooled figure sits *below* the mature 2022
cohort's 10.1 months. Kaplan-Meier over all 8,039 filings gives ~15.9 months.
**State the share, not the fate** — 45% is the share with no issue date on the
extract day, not a share that "never issues"; the feed does not distinguish a
*not-yet* from a *never*, and that undistinguished 45% is exactly what KM must
assume something about. Correcting it is a separate pass.

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

The index holds **20** cities. **15** have a script; **8** publish a figure.

- **8 publish** — Austin, Denver, Miami, Nashville, NYC, Philadelphia, Raleigh,
  Seattle. This set is exactly `CITIES_WITH_MEASURED_PERMITS`, and a test asserts
  it equals the set of cities carrying a `newConstruction` block in
  `permitStats.json`.
- **4 have a script that computes and then refuses** — Boston, DC, Minneapolis
  (no application-date column; exit 0) and Milwaukee (commercial use-column not
  enumerable; **exit 1**).
- **3 have a script but are WITHDRAWN** — SF, Chicago, LA. The scripts have no
  refusal gate; see the warning under "Run status".
- **5 have no script** — San Diego (withdrawn: wrong date field), San Jose
  (issue-side dates only), Columbus (no application date), Atlanta (no issue
  date), Charlotte (no permit dataset at all).

Re-run each publishing script **quarterly** to refresh the vintage, then commit
the updated `permitStats.json` — and update the tables above from the artifact in
the same pass, since nothing tests the *figures* transcribed here.

## A script may exist and correctly publish nothing

Four of these scripts compute what they can and then refuse to write, and in the
two cases below the refusal is **a function you can read** rather than an accident
of ordering. (`dc.mjs` and `minneapolis.mjs` refuse too, at an inline
`if (!appliedField)` guard that warns and returns — same outcome, weaker
structure.)

| Script | Gate | Why |
|---|---|---|
| `boston.mjs` | `applicationDateField()` | No application-date column exists. The latency has no numerator, so the gate throws a `ComputabilityHalt` and the script exits 0. *(Its header comment used to cite a `refuseUnlessComputable()` that never existed; corrected 2026-08-09 to name the real gate — the defect class the ledger records, a claim written down that nothing checks.)* |
| `milwaukee.mjs` | `refuseUnlessEnumerable()` | Both dates exist and are clean, but the commercial half of `Use of Building` is free text (123 distinct strings over 354 windowed rows, 25.7 % singletons, 15.0 % blank), and Milwaukee files all 5+-unit multifamily as commercial. The apartment tier cannot be enumerated. |

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
