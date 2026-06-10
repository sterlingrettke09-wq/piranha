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
and lives in the repo. When `resolveTimeline` eventually reads it (a later work
order — not wired yet), the result page can show a line like:

> Median for new construction in Boston: 7.4 months (p80: 13.1) — based on 312
> permits issued since 2023.

## How to run

One command per city. No dependencies beyond Node 18+ (global `fetch`):

```bash
node scripts/permits/boston.mjs
```

Each script is **idempotent**: it reads the existing `permitStats.json`, merges
its city's block in, and writes the file back. Running it twice produces the
same result; running a different city's script never clobbers another city's
data. Re-run **quarterly** to refresh the vintage as new permits are issued,
then commit the updated artifact.

## Artifact shape

```jsonc
{
  "boston": {
    "newConstruction": {
      "medianMonths": 7.4,   // median application → issuance, one decimal
      "p80Months": 13.1,     // 80th-percentile, one decimal
      "n": 312,              // permits in the sample
      "vintage": "issued 2023-01-01 onward; computed 2026-06-10",
      "source": "data.boston.gov approved-building-permits"
    }
  }
  // ...other cities merge in alongside
}
```

## City data sources (TODO — one script each)

Boston is implemented (`boston.mjs`). The rest are Socrata/CKAN portals; verify
each dataset id at build time (they change), map the permit-type field to our
new-construction class, and follow the same merge pattern:

- **Boston** — `data.boston.gov` approved building permits (CKAN). _Done._
- **NYC** — DOB job filings / issued permits via NYC Open Data (Socrata);
  DOB NOW + BIS. Map `job_type` ERECT/NB (new building).
- **SF** — `data.sfgov.org` building permits (Socrata); filter
  `permit_type_definition` = new construction.
- **Seattle** — `data.seattle.gov` SDCI building permits (Socrata); permit
  type "New".
- **Chicago** — `data.cityofchicago.org` building permits (Socrata); permit
  type `PERMIT - NEW CONSTRUCTION`.
- **Austin** — `data.austintexas.gov` issued construction permits (Socrata);
  work class "New".
- **Los Angeles** — `data.lacity.org` building permits (Socrata); permit type
  "Bldg-New".

DC, Denver, and Minneapolis have open portals too and can be added the same
way; their dataset ids are the open item to verify.
