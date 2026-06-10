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
