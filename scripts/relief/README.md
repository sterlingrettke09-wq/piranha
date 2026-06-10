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

> San Francisco's board granted 98% of variance requests (2022–2026, n=289).

The grant rate is a **historical base rate for the city's board — context, not a
prediction for any specific project**. It is never folded into the verdict or
the timeline.

## How to run

One command per city. No dependencies beyond Node 18+ (global `fetch`):

```bash
node scripts/relief/boston.mjs
node scripts/relief/sf.mjs
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
      "grantRate": 0.976,   // granted ÷ decided, three decimals
      "n": 289,             // decided records in the sample (granted + denied)
      "window": "2022–2026",
      "vintage": "opened 2022-01-01 onward; computed 2026-06-10; data.sfgov.org … ; 282 granted, 7 denied"
    }
  }
  // ...other cities merge in alongside
}
```

## Sanity gates (every script)

- **Probe the schema first.** If the expected outcome/date field is missing,
  **fail loudly** rather than fabricate a grant rate (the Boston permit lesson).
- The outcome field must be **unambiguous**: map only the statuses that are a
  board ruling on the merits to granted/denied, and **exclude** withdrawn,
  deferred, cancelled, informational, and still-in-progress records from the
  denominator. The grant rate is `granted ÷ decided`.
- If `n < 100` decided records (or nothing matched the outcome buckets), treat
  the result as untrustworthy and **do not write** it — print why and leave the
  city absent. No fabrication, ever.

## Run status (live runs, computed 2026-06-10)

| City | Script | Status | Grant rate | n (decided) | Window | Dataset |
|------|--------|--------|-----------:|------------:|--------|---------|
| **Boston** | `boston.mjs` | **✅ landed** | **92.7%** | **3820** | 2022–2026 | CKAN `0f0fa8c2-…` — Zoning Board of Appeal Tracker; `decision` ∈ {AppProv, Approved} granted, {DeniedPrej, Denied} denied; `final_decision_date` ≥ 2022. 3542 granted, 278 denied. |
| **SF** | `sf.mjs` | **✅ landed** | **97.6%** | **289** | 2022–2026 | Socrata `y673-d69b` — Planning Department Records · Non-Projects; `record_type = 'VAR'`; `record_status` ∈ {Closed - Approved, Approved} granted, {Closed - Disapproved} denied; `open_date` ≥ 2022. 282 granted, 7 denied. |

Both grant rates are high — that's the real shape of zoning relief in these
cities: variances are routinely granted (the hard cases are filtered out earlier
or withdrawn), which is exactly the context a NEEDS_RELIEF verdict should carry.
The Boston `decision` codes and the SF `record_status` strings were each
verified against the live distinct-value histogram before being hard-coded.

## Other cities (still TODO — one script each)

Follow the same probe → outcome-map → sanity-gate → merge pattern, mapping each
portal's relief/appeal outcome field to granted/denied. Portals to start from:

- **NYC** — BSA (Board of Standards & Appeals) decisions. Check NYC Open Data
  (`data.cityofnewyork.us`) for a BSA case/decision dataset; CPC/ULURP actions
  are a separate, more complex track (use-permit, not variance).
- **Chicago** — Zoning Board of Appeals decisions on `data.cityofchicago.org`.
- **Seattle** — SDCI land-use decisions / Hearing Examiner; check
  `data.seattle.gov` and the SDCI decisions feed.
- **DC** — BZA (Board of Zoning Adjustment) orders via DC Open Data
  (`opendata.dc.gov`) / the Office of Zoning IZIS case records.
- **Austin** — Board of Adjustment cases on `data.austintexas.gov`.
- **LA** — Zoning Administrator / Area Planning Commission determinations; check
  `data.lacity.org` and the Planning case-tracking (PCTS) exports.
- **Denver** — Board of Adjustment for Zoning Appeals; check
  `denvergov.org`/`opendata-geospatialdenver.hub.arcgis.com`.
- **Minneapolis** — Board of Adjustment / land-use applications on
  `opendata.minneapolismn.gov`.

If a portal doesn't publish outcomes in a parseable, unambiguous way, **skip
honestly and document the gap here** rather than write a guess.
