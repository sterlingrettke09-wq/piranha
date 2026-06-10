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

> Measured: the median new-construction permit in San Francisco ran 11.8 months
> from filing to issuance (p80 24.4, n=165; …) — permit time only, a subset of
> the full life-cycle shown above.

The measured figure is **never** folded into the estimated months; it sits
beside it as an empirical sanity check.

## How to run

One command per city. No dependencies beyond Node 18+ (global `fetch`):

```bash
node scripts/permits/boston.mjs
node scripts/permits/sf.mjs
node scripts/permits/seattle.mjs
node scripts/permits/nyc.mjs   # probes both DOB feeds; currently writes nothing (see below)
node scripts/permits/chicago.mjs
node scripts/permits/austin.mjs
node scripts/permits/la.mjs
node scripts/permits/dc.mjs     # ArcGIS, not Socrata; no filed-date column → writes nothing (see below)
node scripts/permits/denver.mjs # ArcGIS (denvergov org); has DATE_RECEIVED → lands a figure
node scripts/permits/minneapolis.mjs # ArcGIS (CCS Permits); issued-date only → writes nothing (see below)
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
  "sf": {
    "newConstruction": {
      "medianMonths": 11.8,  // median filing → issuance, one decimal
      "p80Months": 24.4,     // 80th-percentile, one decimal
      "n": 165,              // permits in the sample
      "vintage": "filed 2022-01-01 onward; computed 2026-06-10; data.sfgov.org Building Permits (permit_type 1,2 = new construction)"
    }
  }
  // ...other cities merge in alongside
}
```

## Sanity gates (every script)

- Drop records with a **negative** or **> 120-month** filing→issuance span.
- If the **median < 0.5 months** or **n < 30**, treat the result as
  unreliable and **do not write** it — print why and leave the city absent.
- Probe the schema first; if an expected date/type field is missing, **fail
  loudly** rather than fabricate a latency figure (the Boston lesson).

## Run status (live runs, computed 2026-06-10)

| City | Script | Status | Median | p80 | n | Notes |
|------|--------|--------|-------:|----:|--:|-------|
| Boston | `boston.mjs` | template (pre-existing) | — | — | — | CKAN; needs a filed-date column to publish a figure. |
| **SF** | `sf.mjs` | **✅ landed** | **11.8 mo** | **24.4 mo** | **165** | Socrata `i98e-djp9`; `permit_type` 1 ("new construction") + 2 ("new construction wood frame"); `filed_date` → `issued_date`, filed since 2022. |
| **Seattle** | `seattle.mjs` | **✅ landed** | **6.2 mo** | **10.8 mo** | **3956** | Socrata `76t5-zqzr`; `permittypedesc = 'New'`; `applieddate` → `issueddate`, applied since 2022. (Socrata omits null fields from row JSON, so date columns are confirmed via the `/api/views` metadata, not a single-row probe.) |
| **NYC** | `nyc.mjs` | **⚠️ no trustworthy figure — left absent** | (0.0) | — | 3261 | See below. |
| **Chicago** | `chicago.mjs` | **✅ landed** | **1.0 mo** | **3.9 mo** | **5899** | Socrata `ydr8-5enu`; `permit_type = 'PERMIT - NEW CONSTRUCTION'`; `application_start_date` → `issue_date`, applied since 2022. 22.3 % same-day (under the 50 % OTC gate); fast express-permit culture pulls the median to ~1 mo. |
| **Austin** | `austin.mjs` | **✅ landed** | **2.2 mo** | **6.3 mo** | **17279** | Socrata `3syk-w9eu`; `permittype = 'BP'` + `work_class = 'New'`; `applieddate` → `issue_date`, applied since 2022. 1.3 % same-day. |
| **LA** | `la.mjs` | **✅ landed** | **6.0 mo** | **13.0 mo** | **13406** | Socrata `pi9x-tg5x` (live LADBS feed, current to within days); `permit_type = 'Bldg-New'`; `submitted_date` → `issue_date`, submitted since 2022. 1.2 % same-day. |
| **DC** | `dc.mjs` | **⚠️ no trustworthy figure — left absent** | — | — | — | ArcGIS (not Socrata). DCRA Building Permits feed carries only `ISSUE_DATE`; no application/filed date → can't measure the filing leg. See below. |
| **Denver** | `denver.mjs` | **✅ landed** | **4.4 mo** | **10.4 mo** | **6590** | ArcGIS denvergov org (`zdB7qR0BtYrg0Xpl`), residential layer 316 + commercial layer 317 pooled; `CLASS = 'NEW BUILDING'`; `DATE_RECEIVED` → `DATE_ISSUED`, received since 2022. 1.7 % same-day; data fresh to 2026-06-09. |
| **Minneapolis** | `minneapolis.mjs` | **⚠️ no trustworthy figure — left absent** | — | — | — | ArcGIS Hub (`afSMGVsC7QlRK1kZ`). `CCS_Permits` feed carries only `issueDate` (+ project `completeDate`); no application/filed date → can't measure the filing leg. The legacy per-year Hub layers stop at 2014. See below. |

### NYC — why it is absent (honest failure)

NYC publishes two relevant DOB datasets and **neither yields a true
filing→issuance latency** for new construction:

- **DOB NOW: Build – Approved Permits (`rbx6-tga4`)** — current data, but only
  carries `approved_date` + `issued_date`. **No filing/applied date**, so the
  filing leg of the duration can't be measured without fabricating it.
- **DOB Permit Issuance (`ipu4-2q9a`)** — the legacy BIS feed. It *does* expose
  both `filing_date` and `issuance_date` plus `job_type` (NB = New Building),
  which is why `nyc.mjs` uses it. Two real-world gotchas were handled:
  `filing_date`/`issuance_date` are **TEXT in `MM/DD/YYYY`** (a naive
  `>= '2022-01-01'` compares lexicographically and silently returns the wrong
  rows — we filter `issuance_date LIKE '%/YYYY'` and parse the dates ourselves),
  and `permit_sequence__` is **zero-padded** (`'01'`, not `'1'`).
  **But the deal-breaker:** for original NB permits issued 2022–2025,
  **74.5 % have `filing_date == issuance_date`** (same-day OTC issuance) — the
  feed stamps both legs at issuance, so the measured median is **0 months**
  (p90 ≈ 11 days). That is an artifact of how the record is written, not a real
  ~0-month review time. The sanity gate (median < 0.5 mo) correctly **skips
  writing NYC**, and the script exits 0 with a clear message.

If NYC later exposes a genuine application/pre-filing timestamp (e.g. a DOB NOW
"submitted" date alongside "issued"), point `nyc.mjs` at it and re-run.

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

## All ten cities accounted for

Every city in the index now has a script. Seven publish a genuine
application/filed date and land a measured figure (SF, Seattle, Chicago, Austin,
LA, Denver); three publish issuance-only feeds and are honestly left absent
(NYC's OTC artifact, DC, Minneapolis) — Boston remains a CKAN template pending a
filed-date column. Re-run each script **quarterly** to refresh the vintage, then
commit the updated `permitStats.json`.
