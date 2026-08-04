# RSMeans capture sheet — cost-model step 1

**Purpose:** resolve four unverified premises in `src/config/estimates.ts` (see the
DEFECTS block at the top of that file) before any constant is changed.
**Rule:** nothing in the cost model moves until these lines are read.
**Licensing:** cleared 2026-08-03 (counsel + RSMeans). A future Data Online
subscription is a separate instrument — see the note in `estimates.ts`.

---

## RUN ORDER

**C first, then B, then A.** Not because C is the biggest error — the tier defect
(a mid-rise constant on a stick-frame house) is almost certainly larger. C goes
first because it is **upstream**: it determines whether the CCI multiply is valid
at all, and every tier constant sourced in A gets passed through that multiply.
Sourcing three clean constants and then running them through a broken geography
path wastes the sourcing work.

This matters most if the ratio comes back ambiguous: "foundational" says stop and
resolve it, where "biggest" would tempt you to proceed.

---

## A. Tier constants — run at NATIONAL AVERAGE

The tier axis the tool needs is detached → small-scale infill → mid-rise.

| # | Model | What it settles |
|---|---|---|
| A1 | **Residential SF Cost models** — check access first. Separate data set from the commercial models: 4 construction classes (economy / average / custom / luxury) × 8 residential types by stories/levels, priced per sq ft of **living area**. | The detached tier we have never had. Also gives a principled answer to the quality-tier problem, since it is quality-classed rather than a midpoint of a wide range. |
| A2 | **Apartment, 1–3 story** | Small-scale infill — Austin HOME triplexes, Philadelphia rowhouses, Nashville infill. The tier currently priced with a mid-rise constant. |
| A3 | **Apartment, 4–7 story** | Whether `costPerSqFtByUse.residential = 340` is actually this, as the comment claims. |
| A4 | **Office, 5–10 story** (optional) | Whether `commercial = 390` matches its claimed source. Note 390 is the arithmetic midpoint of RSMeans' published $208–574 range. |

**Capture:** total $/SF for each. And whether a detached residential entry exists
in the commercial model set at all — if not, A1 is the path, and NAHB's *Cost of
Constructing a Home* is the fallback only if A1 is inaccessible.

## B. Fee structure — settles the 25% / 7% question at the source

On any one model, capture the **pre-populated defaults**:

- [ ] Contractor fee / GC overhead & profit — ____ %
- [ ] Architectural fee — ____ %
- [ ] User / other fee — ____ %
- [ ] **What each fee is COMPUTED ON** ← the line that matters most.
      If the architectural fee applies to the contractor-fee-inclusive subtotal
      rather than to bare construction cost, then 25% + 7% compounds to
      **33.75%**, not 32%. Read it off the report; do not infer it.
- [ ] **Repeat the fee capture on a RESIDENTIAL model.** The 25%/7% defaults are
      documented for the COMMERCIAL Square Foot Estimator. The Residential SF Cost
      models are a different data set — priced per sq ft of living area, organised
      by quality class rather than exterior wall and framing system — and there is
      no guarantee the fee treatment matches. Capturing only on the commercial
      side would inherit the structure into the detached tier by assumption, which
      is the same mistake one level down.
      Residential: contractor ____ % · architectural ____ % · computed on ____
- [ ] Is the headline total **BEFORE or AFTER** these fees?
      (A subtotal → fees → total sequence settles it outright.)
- [ ] Exclusions list, if the report prints one.

## C. Geography — does applying CCI double-count?

Run **one model twice**, identical inputs: once at **National Average**, once at
**San Francisco**.

Use San Francisco (CCI 129.8), **not** Philadelphia. Philadelphia's 115.8 sits
close enough to several plausible partial-application errors — and to the ~7%
architectural fee — that a wrong answer would read as a pass. A ~30% delta is
unmistakable. Running both is better still.

- [ ] National total: ____
- [ ] San Francisco total: ____
- [ ] **Ratio, computed to three decimals: ____**

| Result | Meaning | Fix |
|---|---|---|
| ratio = **1.298** | Location applied on top of a national base | None — CCI multiply is valid |
| ratio **materially below** (e.g. 1.121) | Location hit some components and not others | Correct or abandon the multiply |
| ratio **near but not at** 1.298 (e.g. 1.28, 1.31) | ⚠️ NOT a rounding pass — see below | Different fix entirely |

**The awkward middle is the important case.** RSMeans' CCI is a fixed-weight
composite of a STANDARDISED building mix. The model you run has its OWN mix,
which may not match. So a near-miss is most likely a **mix mismatch**, not a
broken multiply — and the remedy is not to adjust the factor but to recognise
that a single composite factor is the wrong instrument for a model whose
materials/labour split differs from the CCI's.

**Diagnostic:** a mix mismatch shows up as materials and installation EACH
scaling correctly while the total does not. That is exactly why the component
breakdown is worth capturing alongside the totals — without it, a mix mismatch
and a partial application look identical.

Write the number down to three decimals. Do not eyeball a match, and do not
round a near-miss into a pass.

## D. Assembly breakdown + additives — sizes two open defects

Capture the **assembly list** for each model, not just the total.

- [ ] **Sitework.** Is there a site-preparation / excavation assembly line?
      Absence in the assembly list is *affirmative* evidence of exclusion, which
      is what sizes defect #3 — better than inferring it from a textbook about a
      different artifact. Many reports never print an exclusions list, so this is
      the reliable route.
- [ ] **Parking — additives list on the APARTMENT models specifically.** Does
      structured parking appear as a base assembly or as an optional additive?
      That tells us where parking cost lives in RSMeans' structure, which is the
      input the step-4 parking model needs.

## E. Structure — what the rebuild axis should be

- [ ] Does cost vary by story count **within** a building type, or only
      **between** models (Apartment 1–3 vs 4–7)?

Expected: only between models. If so, `heightCostFactor` should be rebuilt on
**construction type** (Type V → podium → Type I), and **story count becomes a
classifier input that selects the type — not a multiplier**. Confirm against the
model list rather than assuming.

---

## Report back

Three (or four) totals · three fee percentages · what each fee computes on ·
before/after · assembly breakdown · additives list on the apartment models ·
the SF-vs-national pair **with the ratio computed to three decimals**.

Screenshots of those lines are sufficient — the full reports are not needed.

---

## Ledger discipline — do this in the SAME session

If C passes and A yields the residential data set, three of the four defects
logged in `estimates.ts` close at once. Update `docs/VERIFICATION-LEDGER.md` and
the DEFECTS block **in the same sitting as the capture**, not after the wiring.

The record must distinguish what was resolved BY EVIDENCE from what was resolved
BY REWRITE. The temptation to skip this is highest exactly when the answers
finally arrive — which is when the distinction is most worth preserving.
