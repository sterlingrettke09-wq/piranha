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

## Other cities (still TODO — one script each)

The remaining cities are Socrata portals; verify each dataset id at run time
(they rotate), map the permit-type field to our new-construction class, and
follow the same probe → filter → sanity-gate → merge pattern:

- **Chicago** — `data.cityofchicago.org` building permits (Socrata); permit
  type `PERMIT - NEW CONSTRUCTION`.
- **Austin** — `data.austintexas.gov` issued construction permits (Socrata);
  work class "New".
- **Los Angeles** — `data.lacity.org` building permits (Socrata); permit type
  "Bldg-New".

DC, Denver, and Minneapolis have open portals too and can be added the same
way; their dataset ids are the open item to verify.
