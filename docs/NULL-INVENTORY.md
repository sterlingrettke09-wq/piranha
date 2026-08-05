# Null inventory — what the tool actually knows

**GENERATED, not hand-written.** Run `npx vite-node scripts/null-inventory.ts --write`.
Every entry below was verified live on the date shown.

A hand-maintained version of this file drifted from the system inside a single
session: Chicago sat recorded as unresolved while `B3-2` resolves, San Diego's
probe coordinate was a landmark rather than a parcel, and Philadelphia's RM
districts started resolving once the FAR parser was corrected. **The inventory
determines what work is worth doing, so a stale entry misdirects the backlog** —
the same failure as measuring your probe instead of the pipeline (rule 11), one
level up.

**This is the artifact that says whether the tool is fit to ship — not the test
count.** 709 tests pass whether a city resolves a FAR or assumes one.

## Verified 2026-08-05

| City | District probed | Outcome | Verdict | What it means |
|---|---|---|---|---|
| boston | `MFR/LS` | **RESOLVED** | NEEDS_RELIEF | FAR 2 from published data |
| nyc | `R6B` | **RESOLVED** | NEEDS_RELIEF | FAR 2 from published data |
| chicago | `B3-2` | **RESOLVED** | AS_OF_RIGHT | FAR (per-use) from published data |
| sf | `NCD-24TH-NOE-VALLEY` | **UNCONSTRAINED (an answer)** | NEEDS_RELIEF | code affirmatively imposes no FAR; lot area is a placeholder |
| seattle | `NR` | **GAP — verdict withheld** | INDETERMINATE | no FAR resolvable; cost/timeline still estimated and disclosed |
| dc | `RF-1` | **GAP — verdict withheld** | INDETERMINATE | no FAR resolvable; cost/timeline still estimated and disclosed |
| austin | `MF-4` | **RESOLVED** | AS_OF_RIGHT | FAR 0.75 from published data |
| la | `C2-1-O` | **RESOLVED** | AS_OF_RIGHT | FAR 1.5 from published data |
| denver | `G-MU-5` | **UNCONSTRAINED (an answer)** | AS_OF_RIGHT | code affirmatively imposes no FAR; lot area is a placeholder |
| minneapolis | `CM2` | **GAP — verdict withheld** | INDETERMINATE | no FAR resolvable; cost/timeline still estimated and disclosed |
| philadelphia | `RSA-5` | **GAP — verdict withheld** | INDETERMINATE | no FAR resolvable; cost/timeline still estimated and disclosed |
| miami | `T6-80-O` | **GAP — verdict withheld** | INDETERMINATE | no FAR resolvable; cost/timeline still estimated and disclosed |
| sandiego | `CCPD-ER` | **GAP — verdict withheld** | INDETERMINATE | no FAR resolvable; cost/timeline still estimated and disclosed |
| sanjose | `PQP` | **GAP — verdict withheld** | INDETERMINATE | no FAR resolvable; cost/timeline still estimated and disclosed |
| nashville | `DTC` | **GAP — verdict withheld** | INDETERMINATE | no FAR resolvable; cost/timeline still estimated and disclosed |

**5 resolved from published data · 2 unconstrained (an answer) · 8 gaps · 0 probe failures.**

## What a "gap" costs the user, post fail-closed audit

A gap no longer produces a confident claim. On `assumed-far-1.0`:

- **Verdict is withheld** — INDETERMINATE, not AS_OF_RIGHT. The tool will not
  assert legal permission derived from a size the code never stated.
- **Size-triggered required hurdles are downgraded to `info`**, with the doubt
  named rather than the hurdle deleted.
- **Cost and timeline are still produced**, disclosed at the assumptions panel.
  They claim what building that much would cost, not what the code allows.

`assumed-unconstrained` is NOT a gap: the code affirmatively imposes no FAR
(SF Planning Code §124(b), Denver's form-based DZC), so verdicts and hurdles
stand and the lot-area figure is a placeholder under a stated absence.

## Known remaining gaps, by fix cost

| Reason | Cities | What it needs |
|---|---|---|
| `published-not-fetched` | chicago (B/C/D/M classes) · dc · seattle (NR + non-NC/C) · miami (Art. 4 Table 2) · sandiego (LDC tables) | research + a table |
| `fetched-not-mapped` | minneapolis (Corridor/Transit/Core/Production — base FAR + earned premiums) | wiring, once Table 540-2 is read |
| `not-published` | sanjose · nashville | code-text extraction, or it stays null |

## Method

- One real parcel per city; published example parcels where they exist.
- **Each probe retried up to 3× in isolation** before a failure is recorded
  (rule 10 — Chicago returned `Unknown` once under concurrent load and resolved
  to `B3-2` on three consecutive isolated re-probes).
- Exercises the REAL entry point (`getParcelInfo` → `computeEnvelope` →
  `buildDefaultSpec` → `assessFeasibility`). An earlier attempt called
  `resolveZoningLimits` with `maxFAR: null`, bypassed every provider-side
  resolver, and reported "11/65 resolved" — it measured the probe, not the
  pipeline.
- A single probed parcel does not characterise a whole city. This table says
  what the pipeline returned for one real address, which is enough to separate
  "resolves" from "falls back" and not enough to quantify coverage.
