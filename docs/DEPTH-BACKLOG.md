# Depth backlog — per-city curated zoning tables (WO-8.8)

The depth program (SPEC-2026-06-experience.md, WO-8.8) shrinks INDETERMINATE
verdicts by curating per-city district FAR/height tables from the published
municipal code, stored in `netlify/functions/lib/zoning/<city>.ts` with source
+ as-of comments and consumed by `resolveZoningLimits` as the layer between
provider data (which wins when non-null) and the Boston family heuristics
(the last-resort fallback).

**Hard rule (CLAUDE.md):** depth means REAL sourced numbers, never guesses.
A `null` FAR/height with a real source note ("the code says this varies by
frontage" / "this code has no FAR — it's height-governed") IS depth — it tells
the engine what to check and lets the UI say so honestly. Never widen a
block-regex or fabricate a figure to make a verdict look more decisive.

## Done (tranche 1 — this WO)

- **Chicago** — `netlify/functions/lib/zoning/chicago.ts`.
  B/C FAR §17-3-0403-A, B/C height §17-3-0408-A, D base FAR §17-4-0405-A
  (no max height §17-4-0407), M FAR §17-5-0404-A, residential base FAR §17-2.
  Dash-suffix parser resolves any (district × suffix) combination.
- **Denver** — `netlify/functions/lib/zoning/denver.ts`.
  Form-based code: FAR null for all common districts (height-governed),
  height derived from the trailing stories token × ~12 ft/story
  (DZC Art. 3–9 building-form tables; Art. 13 rules of measurement).

---

## Queued (subsequent tranches)

Each city below gets its own `netlify/functions/lib/zoning/<city>.ts` module in
the same shape (`Record<district, { far: number | null; heightFt: number | null }>`
plus a `resolve<City>()` parser), wired into `resolveZoningLimits`, with a
per-city table test (≥8 districts, incl. unknown→null and "varies"→null).

### NYC — contextual R-districts
- **Source:** NYC Zoning Resolution (ZR) Article II, Chapter 3 — residential
  bulk regulations. Contextual districts (R6A/R6B/R7A/R7B/R8A/R8B/R9A/R10A…)
  carry published max FAR and max base/building height per district.
  Commercial overlays (C1/C2) and C-district equivalents in ZR Article III.
  <https://zr.planning.nyc.gov/>
- **Done means:** the ~25 most common contextual R-districts + C overlays with
  ZR-cited FAR + base/max height; non-contextual (R6 without a letter, where
  height/FAR vary by program — Quality Housing vs height-factor) left null with
  a note; tested.

### Seattle — SM and zone suffixes
- **Source:** Seattle Municipal Code Title 23, esp. SMC 23.45 (multifamily LR/MR/HR
  FAR + height tables), SMC 23.47A (commercial/NC FAR + height by suffix, e.g.
  NC2-40, NC3-65, NC3P-95), SMC 23.48 (Seattle Mixed "SM-" suffixes carrying the
  height in the code). <https://library.municode.com/wa/seattle/codes/municipal_code>
- **Done means:** LR1/LR2/LR3, MR, HR, the NC1/NC2/NC3 ± P families with their
  trailing height token parsed, SM-suffix height parse; tested.

### DC — matter-of-right subtitle tables
- **Source:** DC Zoning Regulations of 2016, Title 11 DCMR — Subtitle E
  (Residential House), F (Residential Flat), G (Residential Apartment), and the
  mixed-use/commercial subtitles. Each zone (R-1 through R-21, RF, RA, MU-1…MU-29)
  publishes matter-of-right max FAR, height (ft), and lot occupancy.
  <https://online.encodeplus.com/regs/washington-dc/>
- **Done means:** the RF/RA/MU families' matter-of-right FAR + height (the
  decisive by-right numbers) tabled; PUD-only bonuses left null; tested.

### LA — height districts refinement
- **Source:** LA Municipal Code Chapter 1, Article 2 — base zones (R1, R2, RD,
  R3, R4, R5, C1, C2, CM, M1…) combined with **height districts 1–4** (LAMC
  §12.21.1) which set the FAR (1.5/3/6/13 etc.) and height. The current provider
  knows the base zone; depth = the height-district multiplier table.
  <https://library.municode.com/ca/los_angeles/codes/municipal_code>
- **Done means:** base-zone × height-district (1/1L/1VL/1XL/2/3/4) FAR + height
  matrix per §12.21.1; tested. Note Measure-JJJ/TOC bonuses stay out (case-specific).

### Minneapolis — built-form FAR table
- **Source:** Minneapolis Code of Ordinances Title 20 (Zoning), built-form
  districts (Interior 1–3, Corridor 4–6, Transit 10–30…) which set max FAR and
  height independently of the base district, plus the 2040-plan base districts
  (R1–R6, C1–C4, etc.). <https://library.municode.com/mn/minneapolis/codes/code_of_ordinances>
- **Done means:** the built-form district FAR + height table (the governing
  numbers post-2040 recode) tabled and resolved alongside base district; tested.

### Boston — neighborhood article tables
- **Source:** Boston Zoning Code (BMC) — the neighborhood Articles (e.g. Art. 51
  Allston-Brighton, Art. 65 Dorchester, Art. 53 East Boston…) each publish
  subdistrict FAR + height. Today Boston runs on the family-letter heuristic in
  `zoningLimits.ts`; depth = replacing the heuristic FAR with the article-cited
  per-subdistrict number where published.
  <https://www.bostonplans.org/zoning/zoning-code-maps>
- **Done means:** the highest-traffic neighborhood articles' subdistrict tables
  tabled; the family heuristic stays only as the final fallback; tested. Care
  required — Boston is the one city where the heuristic currently fires, so each
  article number added must come with a test proving it didn't regress a
  legitimate parcel into a worse verdict.

### SF — planning code height/bulk + FAR
- **Source:** San Francisco Planning Code Article 1.2 (use districts: RH, RM,
  RC, NC…) and the **height/bulk districts** (the "40-X", "65-A" suffix on the
  zoning map) plus §124 (basic FAR for C/M districts). FAR is largely C/M-only;
  RH/RM are form/density-governed (FAR often null → height-governed, like Denver).
  <https://codelibrary.amlegal.com/codes/san_francisco/latest/sf_planning/>
- **Done means:** height/bulk-district height parse + §124 FAR for C/M districts;
  RH/RM left FAR-null with a height-governed note; tested.

### Austin — already tabled (reference)
- **Status:** Austin already ships `AUSTIN_LIMITS` inline in
  `netlify/functions/lib/providers/austin.ts` (LDC §25-2-492). When convenient,
  migrate it into `netlify/functions/lib/zoning/austin.ts` for consistency with
  the tranche-1 cities — pure refactor, behavior-preserving, covered by the
  existing Austin provider tests. No new sourcing needed.
