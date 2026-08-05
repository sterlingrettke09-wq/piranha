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
| dc | `RF-1` | **UNCONSTRAINED (an answer)** | NEEDS_RELIEF | code affirmatively imposes no FAR; lot area is a placeholder |
| austin | `MF-4` | **RESOLVED** | AS_OF_RIGHT | FAR 0.75 from published data |
| la | `C2-1-O` | **RESOLVED** | AS_OF_RIGHT | FAR 1.5 from published data |
| denver | `G-MU-5` | **UNCONSTRAINED (an answer)** | AS_OF_RIGHT | code affirmatively imposes no FAR; lot area is a placeholder |
| minneapolis | `CM2` | **GAP — verdict withheld** | INDETERMINATE | no FAR resolvable; cost/timeline still estimated and disclosed |
| philadelphia | `RM-1` | **UNCONSTRAINED (an answer)** | AS_OF_RIGHT | code affirmatively imposes no FAR; lot area is a placeholder |
| miami | `T6-80-O` | **GAP — verdict withheld** | INDETERMINATE | no FAR resolvable; cost/timeline still estimated and disclosed |
| sandiego | `CCPD-ER` | **GAP — verdict withheld** | INDETERMINATE | no FAR resolvable; cost/timeline still estimated and disclosed |
| sanjose | `PQP` | **GAP — verdict withheld** | INDETERMINATE | no FAR resolvable; cost/timeline still estimated and disclosed |
| nashville | `DTC` | **GAP — verdict withheld** | INDETERMINATE | no FAR resolvable; cost/timeline still estimated and disclosed |

**5 resolved from published data · 4 unconstrained (an answer) · 6 gaps · 0 probe failures.**

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
| `published-not-fetched` | dc (D/NC/ARTS/CG/PDR + MU-11…14) · seattle (NR + non-NC/C) · miami (Art. 4 Table 2) · sandiego (LDC tables) | research + a table |
| `fetched-not-mapped` | dc (`IZ_Designation` — inclusionary, published per polygon, never fetched) | wiring |
| `fetched-not-mapped` | minneapolis (Corridor/Transit/Core/Production — base FAR + earned premiums) | wiring, once Table 540-2 is read |
| `not-published` | sanjose · nashville | code-text extraction, or it stays null |

### Highest-ranked open item: DC's RA and MU provenance

**44 DC districts publish a FAR whose only source is a code comment.** Subtitles
F (RA) and G (MU) were not read when Subtitles D and E were, so those numbers
stand exactly where DC's no-FAR claims stood before Title 11 was opened — by
assertion.

Nothing regressed and this is not a defect. It ranks above the unread-overlay
question for one reason: **it affects numbers the tool currently publishes,
rather than verdicts it currently withholds.** A wrong published FAR reaches
cost, unit counts and fees; a withheld verdict reaches nobody.

### Philadelphia's remaining blanks — still gaps, deliberately

Ten residential districts (RSD-1/2/3, RSA-1…5, RTA-1/2, RM-1) are now verified
stated absences against the Feb 2026 Quick Guide. The other ten — CMX-2,
CMX-2.5, CA-1, CA-2, I-P, SP-INS, SP-ENT, SP-STA, SP-PO-A/P, SP-AIR — are NOT,
because those pages were not read. Two successful classifications are not a
licence to generalise the pattern to a district nobody has looked at.

### Resolved: Philadelphia's residential blanks

The city's `ZoningCodeCharacteristics` table carries 36 districts. 13 publish a
numeric FAR, 3 publish prose the parser cannot reduce to a number (`RMX-1` and
`RMX-2` say "150% / 250% of District Area (excluding streets)" — a different
denominator, not a FAR; `CMX-1` defers to adjacent districts), and **20 publish
no value at all** — including every RSA/RSD rowhouse district and `RM-1`, while
`RM-2/3/4` carry 0.7 / 1.5 / 3.5.

Whether those 20 blanks are a stated absence (the code governs them by occupied
area instead — the table's own `MinPercent` field) or an unfilled column is
**unresolved, and it is not resolvable by reading this table.** It matters:
`unconstrained` restores an AS_OF_RIGHT verdict, `null` withholds one. Deciding
it from the shape of the data would be exactly the mechanism-without-a-
measurement that rule 1 forbids. It needs §14-701 itself.

**Chicago is NOT on that list, and the reason is worth recording.** It was, on the
strength of an enumeration reporting 1,528 unhandled zone classes. That number was
an artifact: the script read `.maxFAR` off a resolver returning `{ far, heightFt }`,
so every value scored unhandled. Chicago resolves **63 classes** — the full by-right
B/C/D/M/RM/RS/RT ladder. Of the remainder, 1,457 are PD/PMD planned developments
with no by-right FAR (a stated absence) and 5 are POS/T parks, open space and
transportation (likewise). A backlog entry sized off a broken instrument is the
most expensive kind of wrong — it buys research nobody needed.

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
