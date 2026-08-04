# City Expansion Plan — 10 → 19 cities

**Status:** plan only. No code written. Awaiting go.
**Date:** 2026-08-03
**Recon:** three live-endpoint audits (2026-08-01 → 08-03), all findings evidence-based against real point queries.

## Goal

Add nine cities to the live engine, in an order that maximises data quality per unit of work
and never ships a city that silently produces wrong numbers.

## Build order (agreed)

| # | City | Rating | Rationale |
|---|---|---|---|
| 1 | Philadelphia | EASY | Only new city with published FAR **and** height. Pattern-setter for the FAR parser. |
| 2 | Miami | EASY | Richest parcel record in the portfolio (owner, lot, year, units, floors). |
| 3 | San Diego | EASY | Reuses the whole CA state-law layer; Coastal Zone confirmed. |
| 4 | Nashville | EASY | Clean single-layer parcels. |
| 5 | Cambridge | EASY–MED | Shares MassGIS parcel endpoint with #6; reuses MA law. |
| 6 | Somerville | MEDIUM | Same parcel endpoint; separate ordinance. |
| 7 | Phoenix | MEDIUM | Two hosts (city zoning + Maricopa parcels). |
| 8 | Charlotte | MEDIUM | Three data traps (below). |
| 9 | Atlanta | MEDIUM | Empty-HEIGHT trap; no year built. |
| — | **San Jose** | **HOLD** | Parcel layer has only APN/PARCELID/LOTNUM. County assessor data unreachable (timeout / Cloudflare 403 / annual shapefile). Would ship a materially thinner product. Revisit only with licensed assessor data. |

## The per-city recipe (every city needs all of these)

External data (recon done) is only half the work. The internal wiring is the other half,
and it is where a city can go silently wrong.

1. **`src/types/parcel.ts`** — add `<CITY>_BBOX`.
2. **`src/config/cities.ts`** — add the `City` entry: slug, name, stateLabel, `live`,
   center, zoom, bbox, permitName/permitUrl, tagline, landmark, and the optional
   client-side zoning overlay config (url + codeField; host must be in the
   `netlify.toml` CSP `connect-src` if the overlay is enabled).
3. **`netlify/functions/lib/providers/<city>.ts`** — the provider. Follows the
   denver/seattle pattern: `Promise.allSettled` over parcel + zoning + historic +
   flood, `fetchParcelSnap` for the buffered nearest-parcel snap, map to `ParcelInfo`.
4. **`netlify/functions/lib/parcel.ts`** — register in the city dispatcher.
5. **`src/config/estimates.ts`** — **the silent-wrongness risk.** Add entries to:
   - `cityCostIndex` — **REQUIRED.** `cost.ts` does `cityCostIndex[city] ?? 1.0`, so a
     missing city does not crash; it silently prices at the U.S. national average.
     Every new city must have a sourced RSMeans City Cost Index value.
   - `lifecycleMonths` (single/multi/apartment) — falls back to `lifecycleFallback`.
   - `demoMonthsByCity` — falls back to `demoMonthsFallback`.
   - `reliefAddMonthsByCity` — falls back to `reliefAddMonthsFallback`.
   - `impactFee()` — a `case` only if the city has a real linkage/impact fee.
     Confirmed NONE for Nashville and Charlotte (TN and NC preempt mandatory IZ).
     Cambridge and Somerville are citywide inclusionary (no fee layer needed).
6. **`netlify/functions/lib/hurdles.ts`** — per-city red-tape policy.
7. **Zoning district table** (`netlify/functions/lib/zoning/<city>.ts`) where FAR/height
   are not published — see below.
8. **Tests** — provider mapping + zoning-limit resolution, colocated `*.test.ts`.
9. **Verification** — live probes at 4+ scattered points, entry in
   `docs/VERIFICATION-LEDGER.md`.
10. **`ESTIMATES_VERSION`** bump when constants change (cache-buster).

## The real cost driver: published FAR/height is the exception

Across all ten recon targets, only **Philadelphia** (FAR + height) and **Miami**
(height, in stories) publish dimensional limits in GIS. Boston's `FARMax`/`HeightMax`
is unusual, not normal.

For the other seven, matching current analysis quality requires **curated zoning district
tables built from each city's ordinance** — the existing Denver pattern. That research,
not the plumbing, is the dominant cost of this expansion. Cambridge is the sharpest case:
its code is fundamentally FAR-driven, so without a table it would mostly report
"not in public data".

## City 1 — Philadelphia (detail)

**Endpoints (all verified live, IPv4-reachable, 4326 point queries OK):**

| Role | Endpoint |
|---|---|
| Parcel geometry | `services.arcgis.com/fLeGjb7u4uXqeF9q/.../DOR_Parcel/FeatureServer/0` |
| Parcel attributes | `.../OPA_PROPERTIES_PUBLIC/FeatureServer/0` (join on `pin`) |
| Zoning | `.../Zoning_BaseDistricts/FeatureServer/0` (`long_code`) |
| FAR/height table | `.../ZoningCodeCharacteristics/FeatureServer/0` (non-spatial; `where ZoningDist='<code>'`) |
| Overlays | `.../Zoning_Overlays/FeatureServer/0` |
| Historic districts | `.../HistoricDistricts_Local/FeatureServer/0` |

**Two-step parcel fetch.** `DOR_Parcel` gives geometry + `pin` but no lot area.
`OPA_PROPERTIES_PUBLIC` gives `total_area` (lot sq ft), `year_built`, `owner_1`,
`number_stories`, `market_value` — joined by `pin`. A distance query against OPA
returned zero features, so the `pin` join is required, not optional.

**Do NOT use `Shape__Area`** — it is Web Mercator (3857) and inflated ~1.7× at
Philadelphia's latitude. Lot size comes from OPA `total_area`.

**Filter `status=1`** on DOR_Parcel — there are inactive and stacked air-rights parcels
(`elev_flag`, `condoflag`).

**Address:** `addr_std` carries condo/unit suffixes ("1500 MARKET ST # 12FL"). Strip the
`#` segment for the headline.

### The FAR/height parser (the novel work)

`ZoningCodeCharacteristics` has `MaxHeight` and `MaxFAR` as **free text, not numbers**,
covering 36 of 39 live districts (missing: RSA-6, RTA-2, SP-CIV). Observed forms:

| Raw value | Correct handling |
|---|---|
| `"38 ft."` | → 38 |
| `"1200%; 1600% for certain lots within Center City/University City FAR Map*"` | → 12.0 with a caveat note |
| `"60 if abutting a Residential or SP-PO district; otherwise no limit;"` | → **null** (conditional — must NOT report a flat 60) |
| `"70% of Lot Area"` (RM-2/3/4) | → **null** (different denominator, not lot FAR) |
| `"% of District Area (excluding streets)"` (RMX-1/2) | → **null** |
| CMX-1 paragraph in all four columns | → **null** |

**Design rule, consistent with `developability.ts`:** the parser returns a number ONLY
for unambiguous forms. Everything conditional, percent-of-lot-area, or prose degrades to
`null` → "not in public data". Never guess a limit. This is TDD-first: write the table of
raw→expected cases as a test before the parser exists.

### Research still needed for Philadelphia
- RSMeans City Cost Index value for Philadelphia (sourced, like the other ten).
- Lifecycle months (single/multi/apartment), demo months, relief months.
- Linkage/impact fee: recon found **no mapped affordable-housing fee area**; Philadelphia's
  Mixed Income Housing bonus is code-based, not a mapped district. Confirm whether any
  per-sf fee applies before adding an `impactFee` case (default: none).

## City 2 — Miami (detail)

**⚠️ Host gotcha — the highest-consequence finding in the whole recon.** Every public
write-up cites `gis.miamigov.com`; that host **TCP-times-out**. The working host is
**`gis.miami.gov`** (199.181.140.25). Hard-coding the documented hostname produces a city
that silently fails 100% on zoning and historic.

**Parcels:** `gisweb.miamidade.gov/arcgis/rest/services/MD_LandInformation/MapServer/26` —
the richest record in the portfolio: `TRUE_OWNER1/2/3`, `LOT_SIZE`, `YEAR_BUILT`,
`UNIT_COUNT`, `FLOOR_COUNT`, `BUILDING_ACTUAL_AREA`, `DOR_DESC`, `TOTAL_VAL_CUR`.

**⚠️ REFERENCE FOLIO condo trap.** Clicking a condo tower returns the land parcel with
`TRUE_OWNER1: "REFERENCE ONLY"`, `DOR_DESC: "REFERENCE FOLIO"`, `LOT_SIZE: 0`,
`YEAR_BUILT: 0`, `UNIT_COUNT: 0`. Must detect `DOR_DESC === 'REFERENCE FOLIO'` and fall
back to geometry area at `outSR=2236` (verified to match `LOT_SIZE` exactly on normal
parcels) — otherwise the tool reports 0 sq ft lots on Miami's densest sites.

**Zoning (Miami 21):** `gis.miami.gov/gis/rest/services/Zoning/ZoningMiami21/MapServer/5`.
`Bldg_Height` is in **stories, not feet** (T6-80-O → 80 stories) and is blank for all
T1/T3/T4/T5/D1/D2/D3/CI/CS zones. `FLR` is a **letter suffix** (A/B/blank) identifying
which Article 4 row applies — **not** a numeric FAR. Both need a static Miami 21 Article 4
lookup keyed on `M21_ZONE`.

**Owner PII:** Florida publishes full individual owner names (`PEDRO MARRERO &W GLORIA`).
The existing reduce-to-boolean discipline (`isGovernmentOwner` → `ownerPublic`) matters
more here than anywhere; the name must never be stored or returned.

**Flood is the story.** FEMA NFHL coverage confirmed (Brickell → zone AE, BFE 12.0).
Miami is the city where the flood layer carries real weight.

**Scope:** the parcel layer is countywide but Miami 21 zoning covers only the City of
Miami (zero features in Miami Beach). Gate on the zoning layer returning a feature.

## Known traps for later cities (recorded now so they aren't rediscovered)

- **Atlanta:** `HEIGHT` exists on the zoning layer but is **unpopulated across all 2,978
  polygons** — a naive read reports 0-ft limits everywhere. Also: no year-built field
  anywhere in city data; the city spans Fulton and DeKalb and the DeKalb attributes are
  systematically thinner.
- **Somerville:** the layer named **"Current Zoning" is pre-2019** and superseded by the
  zoning overhaul — use `PubPlanning/MapServer/15`. Zoning polygons exclude street ROW and
  the gap is one blank sentinel record (`ZONECODE=' '`); must buffer **and** filter blanks
  or every street-adjacent click yields no district.
- **Charlotte:** `totalac` is not acres (it is `landunit`-dependent; `1.0`/`'LOT'` for
  residential) — use `gisacres × 43,560`. CAMA returns **multiple rows per parcel** (one
  per building card; 1–5 observed) — dedupe by `pid`, never take `features[0]` blindly.
- **San Diego:** **no owner-name field** is publicly available (county service requires a
  token), so the government-owner gate does not work there — San Diego needs the curated
  civic hard-block approach instead. `acreage` is null on most urban parcels; compute lot
  size from geometry at `outSR=2230`.
- **Cambridge:** local historic district layer has only **2 records** (Old Cambridge, Fort
  Washington) — pair with the National Register layer or it reads like an outage.
- **MassGIS:** use the **`_4326` variant** of the L3 parcels service; siblings are in
  26986/3857. `LOT_SIZE` is in **acres** for both MA cities — read `LOT_UNITS` per row.
  Treat the L3 `ZONING` field as **unreliable** (assessor-maintained, disagreed with the
  planning department's map at Somerville City Hall) — always use the city zoning layer.
- **Phoenix:** the city parcel layer returns zero lot area and no owner — all parcel
  attributes must come from Maricopa County. County coverage extends past city limits, so
  gate on the city zoning layer.
- **Self-hosted servers** (Atlanta, Phoenix, Maricopa, Nashville, Charlotte, Somerville,
  San Diego, Miami-Dade) are single-IP ArcGIS Server instances, not Esri's CDN-fronted
  AGOL. Expect slower, less reliable responses than the existing cities; keep
  `Promise.allSettled` and use generous timeouts. Charlotte sits behind Cloudflare — watch
  for bot challenges from Netlify egress.

## Open decisions

1. **Austin.** Its zoning layer is `Current_Zoning_20190923` — a 2019 snapshot predating
   the HOME reforms, currently disclaimed to users. Options: (a) leave disclaimed,
   (b) find a current Austin zoning layer and fix it as part of this work.
   **Recommendation: fix it.** A city that is *wrong* costs more credibility than a
   missing 11th city, and accuracy is the product's whole positioning.
2. **Client-side zoning overlay** per new city (optional; needs CSP entry).
3. Whether to ship cities individually as they pass verification, or in batches.

## Definition of done, per city

- Provider returns a correct `ParcelInfo` at 4+ scattered verified points.
- All `estimates.ts` constants present and **sourced** (no silent 1.0 cost index).
- Civic/public sites do not read as developable (owner gate where available; curated
  civic blocks where not).
- Tests pass; `npx tsc && npx eslint . && npx vitest run && npx vite build` all clean.
- Ledger entry recorded with the live probes used.
- `live: true` flipped only after the above.
