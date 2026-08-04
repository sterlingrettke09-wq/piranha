# Defect-7 sweep — classify every null FAR as *unconstrained* or *unknown*

**Why:** `defaultSpec.ts` falls back to `parcel.lot.sizeSqFt * 1.0` whenever the
envelope yields no floor area. That is an unsourced FAR-1.0 assumption and it
fires in **every city**. Austin made it visible (a 7,000 sf SF-3 lot claimed
7,000 sf buildable against a real 2,800); it was never Austin-specific.

**Goal:** every null FAR carries either `farUnconstrained: true` **with a quoted
code section**, or stays `null` meaning "unresolved".

---

## THE DISCIPLINE RULE — unknown by default

> `farUnconstrained` is set **only** where a code section is quoted in the diff.
> Everything else stays `null`.

This is the whole safety property. An agent (or a tired human) that cannot find
a district's rule is exactly the one that will assert one. Unknown-by-default
makes the failure mode an **incomplete sweep** rather than a **confident wrong
one** — and an incomplete sweep is visible, while a wrong flag is not.

A null that stays null is not a failure of this sweep. It is the correct output
for a district whose rule was not found.

Applies equally: no direction, no magnitude, no "probably unconstrained because
it's residential." See CLAUDE.md rule 1.

## What "unconstrained" means

The code imposes **no FAR limit** on that district — floor area is governed by
height, setbacks, lot coverage, bulk plane, or impervious cover instead. Common
in form-based codes (Denver, Miami 21) and in height-governed residential zones.

It does **not** mean "we couldn't find a FAR." That is `null`.

## Per-city null-FAR paths (measured 2026-08-04)

Counts are code paths that can yield a null FAR, not distinct zoning districts.

| City | Literal `f: null` | Other null paths | Notes |
|---|---|---|---|
| denver | 31 | 2 | largest block; form-based code, many genuinely unconstrained |
| austin | 18 | 4 | SF-1/2/3 done 2026-08-04; rest outstanding |
| philadelphia | 0 | 17 | **invisible to a literal grep** — free-text `parseMaxFAR` |
| dc | 7 | 4 | |
| seattle | 5 | 8 | |
| nyc | 4 | 5 | |
| chicago | 4 | 13 | |
| miami | 3 | 4 | Miami 21 is form-based; expect many unconstrained |
| la | 2 | 3 | |
| sf | 1 | 4 | |
| sanjose | 1 | 7 | |
| nashville | 1 | 4 | already documents "not in public data" for FAR |
| sandiego | 1 | 3 | |
| minneapolis | 1 | 2 | |
| boston | 1 | 4 | in `zoningLimits.ts` + BPDA `FARMax` absence |

**≈164 paths across all 15 cities.**

### Measurement correction — read this before trusting a count

The first pass reported "78 across 11 cities". Both numbers were wrong:

- It counted **13** unique cities, miscounted as 11 (denver and seattle each
  appear twice — once in a provider, once in a zoning module).
- More importantly it **measured the grep pattern, not the defect.** It matched
  only literal `f: null` / `maxFAR: null` / `far: null`. Cities producing a null
  FAR through a lookup miss, a parser return, or an undefined map entry were
  invisible — Philadelphia (17 paths, 0 literal) and Boston (0 literal in its
  provider) dropped out entirely.

Logged here because it is a clean instance of a rule already in CLAUDE.md:
a search result measures your search, not the world. State which you ran.

## Per-city procedure

1. List the districts reaching a null FAR.
2. For each, find the governing code section.
3. If it imposes no FAR → set `farUnconstrained: true`, quote the section in a
   comment.
4. If a FAR exists → set it, quote the section.
5. If not found → **leave null, add nothing.**
6. Test: `farUnconstrained` districts must yield `farBasis: 'unconstrained'` and
   `maxFloorAreaSqFt: null`; unresolved ones must yield `farBasis: null`.
7. `npm test && npm run build && npm run lint` green before the next city.

## Out of scope — do not touch during this sweep

- Anything in `src/config/estimates.ts`. Cost constants are blocked on the
  data-access decision; a sweep is not the place to relitigate them.
- The Austin headline-regime question (base case vs chosen-program vs full
  alternatives). Product decision, pending.
- `defaultSpec.ts`'s `lot * 1.0` fallback itself. Fixing the classification
  first tells us how often the fallback actually fires; changing both at once
  makes neither measurable.

## Status

- [x] Audit + measurement correction (2026-08-04)
- [x] austin — SF-1/2/3 via Subchapter F two-branch
- [x] **denver (2026-08-04)** — 24 curated districts + the parseable-stories and
      SU/TU/RH branches classified `farUnconstrained` (DZC Arts. 3–9, form-based:
      height + setbacks + bulk plane, no FAR). **Former Chapter 59 and
      unrecognised codes deliberately left UNRESOLVED** — Ch. 59 was a
      conventional Euclidean code that DID impose FAR in some districts and we
      do not carry that table, so flagging it would assert an absence we have
      not established. 8 tests; 590 total green.
- [ ] philadelphia · dc · seattle · nyc · chicago · miami · la · sf
      · sanjose · nashville · sandiego · minneapolis · boston
- [ ] austin — remaining districts

### Denver note — the classification was already written, just not typed

Denver's module already stated the finding in prose ("that null is itself
DEPTH... lets the envelope label the district height-governed instead of
pretending a FAR exists"). It was never expressed in the type system, so every
Denver parcel still fell through to `lot * 1.0`. Worth watching for elsewhere:
**a fact documented in a comment but not encoded is not enforced.**

---

## SWEEP FINDING THAT CHANGES THE FIX (2026-08-04)

Surveying the remaining cities before touching them showed the premise was
wrong. **Denver was the exception, not the pattern.** The evidence was already
written in the providers:

| City | Existing comment | Classification |
|---|---|---|
| san diego | "Base-zone heights/FARs live in Land Development Code tables… NOT in the GIS" | **gap** — FARs exist, unpublished |
| san jose | "No FAR anywhere in San Jose's public GIS" | **gap** |
| nashville | "publishes neither height nor FAR in GIS… 'not in public data'" | **gap** |
| denver | form-based; DZC imposes no FAR | **known absence** ✓ classified |
| miami | Miami 21 is form-based BUT carries Floor Lot Ratio in some transects | **unresearched — do NOT assume** |
| philadelphia | parses published FAR text; null = parse miss or genuine absence | **unresearched** |

**Most nulls are MISSING LOOKUPS, not known absences.** So classifying them
`farUnconstrained` was never going to stop the damage — `defaultSpec` kept
inventing FAR 1.0 for every unresolved parcel regardless.

### The actual fix — label the fallback (done)

`defaultSpec.ts` now emits `gfaBasis: 'envelope' | 'assumed-far-1.0'` and
`AnalysisInput` carries it. The FAR-1.0 guess still runs (removing it would
leave those parcels with no estimate at all — a disclosed assumption beats both
a silent one and a blank screen) but it is now **separable downstream**, so the
UI can disclose it and no consumer can mistake it for a code-derived number.

Note the third test: a district that is genuinely `farUnconstrained` STILL gets
`assumed-far-1.0`, because a known absence of FAR does not make lot area a
code-derived floor area. Two different unknowns, not one.

4 tests. 594 total green.

**Remaining per-city work is now research, not code** — establishing, with a
quoted code section, which districts truly have no FAR. Unknown-by-default
still governs: unresearched stays `null`.

---

## MINNEAPOLIS — UNRESOLVED, and the reason is the valuable part (2026-08-04)

Left `null` under the discipline rule. Three findings, each of which would have
caused a wrong encoding:

**1. Municode Chapter 546 is NOT the live district set.** Ch. 546 publishes
R1, R1A, R2, R2B, R3–R6 with clean FAR values (0.5-or-2,500-sq-ft for the low
density districts; multifamily 1.0 / 1.5 / 2.0 / 3.0 for R3/R4/R5/R6). Those
were read and verified — and they are **useless**, because the live GIS
publishes an entirely different set:

> `Land_Use_Code` ∈ UN1-3 · CM1-4 · DT1-2 · PR1-2 · RM1-3 · TR1

Minneapolis comprehensively rezoned. Encoding the Ch. 546 values would have
matched **zero parcels**, or worse, silently mismatched had any code overlapped.
Reading the code without checking it against the live data is the trap here.

**2. FAR lives in the BUILT FORM overlay, not the base district.** Per the City:
"Built Form Districts govern issues such as building height, floor area ratio
(FAR), lot size and setbacks." The provider **already fetches that layer** and
already maps it for HEIGHT (`MPLS_BUILT_FORM_FT`) — it simply never reads FAR
from it. Same shape as the Boston City Hall bug: the data is in hand and unused.

Live built-form values: BFI1-3 (Interior) · BFC3/4/6 + BFC50 (Corridor/Core) ·
BFT10/15/20/30A/30B (Transit) · BFPR (Production) · BFPA (Parks).

**3. The FAR is two-dimensional plus a premium system — which is why it is not
encoded here.** From the City's Built Form Districts Handbook (Oct 2023):
- Interior 1 and Interior 2: max FAR **0.5**, but with a second column reading
  "All other districts: 1.4" — i.e. the FAR depends on the BASE zoning district
  underneath the overlay, not the overlay alone.
- Interior 3: Two-family 0.6 · Three-family 0.7 · "All other districts: 1.6".
- Corridor/Transit/Production districts publish a **Base FAR** plus premiums:
  max 2–3 premiums at 0.3 (C3), 0.4 (C4), 0.65 (C6), 0.75 (PR), 0.8 and 1.0
  (Transit tiers) each.

So FAR = f(built form district × primary zoning district) + premium count. The
authoritative source is **Table 540-2** (Ch. 540, Built Form Overlay Districts),
which did not linearize from the handbook PDF and whose Municode node ID was not
found by guess (a wrong guess, not proof of absence — see CLAUDE.md rule 8).

**To finish:** read Table 540-2 and Table 540-3 directly, encode as a
(builtForm, primaryZoning) → base FAR matrix, and treat premiums as
alternatives (they are earned, not by-right) — the `farAlternatives` construct
built for Austin already fits that shape.
