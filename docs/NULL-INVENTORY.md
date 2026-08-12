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
count.** The whole suite passes whether a city resolves a FAR or assumes one —
and, until 2026-08-11, whether a city answered every request or one in five.
(A hand-typed test count used to sit here; the suite had grown well past it. A
generated document should not carry a number its generator cannot see.)

## Verified 2026-08-12

Two independent columns, measuring two different things. **Read the last one
first.**

- `Live sample` — clean calls / calls made, from 6 isolated calls to the ONE
  golden parcel. Does the pipeline answer? See
  [why that column exists](#why-there-is-a-live-sample-column).
- `Outcome` / `Verdict` / `What it means` — what the pipeline returned **for that
  one parcel.** A fixed point, not a rate.
- `Sampled rate` — over a multi-parcel live sample drawn from the city's own
  parcel layer, the share of DEVELOPABLE, answered parcels for which the envelope
  actually resolved, and the `n` it is over. This is the column that describes
  the city. See [why it was added](#why-there-is-a-sampled-rate-column).

| City | District probed | Live sample | Outcome | Verdict | Sampled rate | What it means |
|---|---|---|---|---|---|---|
| boston | `MFR/LS` | 6/6 | **RESOLVED** | NEEDS_RELIEF | **93% · n=14** | FAR 2 from published data |
| nyc | `R6B` | 6/6 | **RESOLVED** | NEEDS_RELIEF | 100% · n=15 | FAR 2 from published data |
| chicago | `—` | **0/6 — never clean** | **PROBE FAILED** | — | 100% · n=11 | not a pass — re-run before trusting |
| sf | `NCD-24TH-NOE-VALLEY` | 6/6 | **UNCONSTRAINED (an answer)** | NEEDS_RELIEF | **89% · n=19** | code affirmatively imposes no FAR; lot area is a placeholder |
| seattle | `NR` | 6/6 | **GAP — verdict withheld** | INDETERMINATE | **6% · n=18** | no FAR resolvable; cost/timeline still estimated and disclosed |
| dc | `RF-1` | 6/6 | **UNCONSTRAINED (an answer)** | NEEDS_RELIEF | **78% · n=9** | code affirmatively imposes no FAR; lot area is a placeholder |
| austin | `MF-4` | 6/6 | **RESOLVED** | AS_OF_RIGHT | **43% · n=14** | FAR 0.75 from published data |
| la | `C2-1-O` | 6/6 | **RESOLVED** | AS_OF_RIGHT | **44% · n=16** | FAR 1.5 from published data |
| denver | `G-MU-5` | 6/6 | **UNCONSTRAINED (an answer)** | AS_OF_RIGHT | **33% · n=6** | code affirmatively imposes no FAR; lot area is a placeholder |
| minneapolis | `CM2` | 6/6 | **GAP — verdict withheld** | INDETERMINATE | **38% · n=21** | no FAR resolvable; cost/timeline still estimated and disclosed |
| philadelphia | `RM-1` | 6/6 | **UNCONSTRAINED (an answer)** | AS_OF_RIGHT | **95% · n=20** | code affirmatively imposes no FAR; lot area is a placeholder |
| miami | `T6-80-O` | 6/6 | **RESOLVED** | NEEDS_RELIEF | **33% · n=15** | FAR 24 from published data |
| sandiego | `RS-1-7` | 6/6 | **GAP — verdict withheld** | INDETERMINATE | **0% · n=11** | no FAR resolvable; cost/timeline still estimated and disclosed |
| sanjose | `R-1-8` | 6/6 | **GAP — verdict withheld** | INDETERMINATE | **0% · n=15** | no FAR resolvable; cost/timeline still estimated and disclosed |
| nashville | `DTC` | 6/6 | **GAP — verdict withheld** | INDETERMINATE | **0% · n=24** | no FAR resolvable; cost/timeline still estimated and disclosed |
| raleigh | `R-6` | 6/6 | **UNCONSTRAINED (an answer)** | AS_OF_RIGHT | 100% · n=14 | code affirmatively imposes no FAR; lot area is a placeholder |
| milwaukee | `RS4` | 6/6 | **UNCONSTRAINED (an answer)** | AS_OF_RIGHT | **87% · n=23** | code affirmatively imposes no FAR; lot area is a placeholder |
| columbus | `R4` | 6/6 | **UNCONSTRAINED (an answer)** | AS_OF_RIGHT | **93% · n=14** | code affirmatively imposes no FAR; lot area is a placeholder |
| charlotte | `N1-C` | 6/6 | **UNCONSTRAINED (an answer)** | AS_OF_RIGHT | **73% · n=22** | code affirmatively imposes no FAR; lot area is a placeholder |
| atlanta | `R-4` | 6/6 | **RESOLVED** | AS_OF_RIGHT | **96% · n=23** | FAR 0.5 from published data |
| dallas | `R-7.5(A)` | 6/6 | **UNCONSTRAINED (an answer)** | AS_OF_RIGHT | **92% · n=12** | code affirmatively imposes no FAR; lot area is a placeholder |
| lasvegas | `R-1` | 6/6 | **UNCONSTRAINED (an answer)** | AS_OF_RIGHT | **22% · n=9** | code affirmatively imposes no FAR; lot area is a placeholder |
| phoenix | `R1-6` | 6/6 | **UNCONSTRAINED (an answer)** | AS_OF_RIGHT | **88% · n=8** | code affirmatively imposes no FAR; lot area is a placeholder |

**Golden parcel, one per city: 6 resolved from published data · 11 unconstrained (an answer) · 5 gaps · 0 no default spec · 1 probe failures.**
Those five counts describe 23 cities' worth of hand-picked parcels and nothing
more. The `Sampled rate` column is the one that generalises.

**Sampled rate: 216 of 353 sampled developable parcels across 23 cities resolved an envelope (61.2%).**
Measured 2026-08-11 — a different run from the golden-parcel probe above, so the two
columns can carry different dates, and a probe failing today does not erase a
rate measured earlier (nor the other way round).

**20 cities resolve for less than every sampled parcel**, worst first — sandiego 0/11 (0.0%), sanjose 0/15 (0.0%), nashville 0/24 (0.0%), seattle 1/18 (5.6%), lasvegas 2/9 (22.2%), denver 2/6 (33.3%), miami 5/15 (33.3%), minneapolis 8/21 (38.1%), austin 6/14 (42.9%), la 7/16 (43.8%), charlotte 16/22 (72.7%), dc 7/9 (77.8%), milwaukee 20/23 (87.0%), phoenix 7/8 (87.5%), sf 17/19 (89.5%), dallas 11/12 (91.7%), boston 13/14 (92.9%), columbus 13/14 (92.9%), philadelphia 19/20 (95.0%), atlanta 22/23 (95.7%).

Read the Outcome column beside these with the rate in hand. The probe is one
hand-picked parcel, and for the low rows it is a parcel that works in a city
where most do not — Denver’s `G-MU-5` is a current form-based DZC district,
while the sample drew former Chapter 59 codes that fall through.

**Sample: 23 cities × 6 isolated calls = 138 observations; 132 came back clean (95.7%).**

**⚠️ 1 city never came back clean** — chicago 0/6.

### Why there is a `Live sample` column

Until 2026-08-11 there wasn't one, and this document said **23 of 23 cities clean**
while Phoenix was failing about one request in five.

The probe retried up to 3× whenever a city returned `districtCode: 'Unknown'` and
recorded the first clean result. That half is correct and still stands: a
transient failure must not be written down as a permanent one (rule 10). What was
wrong is that **the retry was the only place the failure was ever observed, and
nothing counted it.** At a 19% per-call failure rate, three tries hide the failure
on ~99% of runs. The instrument measured the best case and published it as the
state — rule 18 turned on the tool itself, since the retry produced an answer and
an answer gets less scrutiny than a gap.

Two changes, and the pair is the point:

- Each city is now sampled a **fixed 6 times with no early exit.** Stopping at the
  first clean call samples until the answer is good and then reports it, which
  biases the estimate towards success by construction.
- The recorded row is **still the first clean call.** The fix is not to start
  recording transients as defects; it is to stop discarding the evidence.

This is also why the column prints `6/6` rather than a tick. A tick on an empty
sample and a tick on a healthy system are the same glyph, and that is the vacuous
pass rule 20 is about. The denominator makes an unsampled city loud.

### Why there is a `Sampled rate` column

The `Live sample` column fixed whether the probe ANSWERED. It did not touch the
older and larger problem: **the probe is one hand-picked parcel, and its Outcome
was being read as the city's.**

Denver is the clean example. Its golden parcel is `G-MU-5`, a current form-based
DZC district that resolves 6 times out of 6. A 25-parcel live sample drawn
from Denver's own parcel layer returned `R-2`, `O-1`, `I-B`, `H-1-A` — former
Chapter 59 codes that fall through — and the envelope resolved for **2 of 6**
developable parcels the pipeline answered for. Denver's row rendered exactly
like Chicago's, which resolved 11 of 11. Four more cities sat in the same place:
Las Vegas 2 of 9, Miami 5 of 15, Austin 6 of 14, LA 7 of 16.

Nothing here was misreported, and that is the part worth keeping. The Method
section at the foot of this file has said "a single probed parcel does not
characterise a whole city" the whole time. **A caveat under a table does not
survive contact with the table** — a grid of one-verdict-per-city is a
rate-shaped object, and readers, including the coverage matrix on /math, read it
as one.

So the fix is not a stronger caveat. It is a second number, measured:

- **The golden parcel stays.** It is a fixed point whose stability check catches
  provider drift, and swapping it for an aggregate would trade a regression
  signal for a headline. Both columns, not one replacing the other.
- **The rate's denominator is developable, ANSWERED parcels** — not parcels
  attempted. A parcel the sampler drew outside the city gate, or one nobody can
  build on, is not an envelope failure; counting it as one would score each city
  by how much public land it has. Those exclusions shrink `n`, which is why `n`
  is printed in every cell: Las Vegas's rate is over 9 of the 25 parcels
  sampled for it, and a rate over 9 is a weaker claim than the same rate over 25.
- **`unconstrained` counts as resolved**, because a code that affirmatively
  imposes no FAR is an answer (rule 5). Only the fall-through to an assumed FAR
  is a gap.
- **It is DERIVED from a committed measurement**
  (`netlify/functions/lib/data/envelopeSample.json`), not typed in here, and
  `src/config/coverage.ts` reads the same file — so the /math matrix and this
  document cannot disagree, and re-running the sampler moves both.

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

### Permit timing: `not-published` in four cities, and the queries are already written

Filing→issuance is measured from the city's own open-data portal for **11 of 15
cities**. It is NOT measurable in **Boston, DC, Minneapolis and San Jose** — those
four publish only issue-side dates. This is a fact about municipal data
transparency, not a gap in this pipeline, and it is the kind of thing a user of
this tool would want to know.

Absence was established the right way — by asking whether the schema has a SLOT
for an application date, not whether a row was blank — and every tempting
substitute was tested and rejected rather than assumed unusable:

| city | what it publishes | substitute tested and rejected |
|---|---|---|
| boston | `issued_date`, `expiration_date` | none available; confirmed 3 ways (datastore schema, raw CSV header, full row dump) |
| dc | `ISSUE_DATE` across all 8 year layers | `CREATED_DATE` is an identical ETL stamp on every row; `LASTMODIFIEDDATE` post-dates issuance |
| minneapolis | `issueDate`, `completeDate` | `completeDate` falls AFTER `issueDate` in **409 of 409** sampled records — the far side of the leg |
| sanjose | `ISSUEDATE`, `FINALDATE` | `FINALDATE` is final inspection — same trap |

**Do not re-do the filter work.** In DC, Minneapolis and San Jose the
new-construction filter is already identified and correct
(`PERMIT_SUBTYPE_NAME = 'NEW BUILDING'`, `workType = 'New'`,
`WORKDESCRIPTION = 'New Construction'`). If any of those cities adds an
application date, this becomes a config change, not research.

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
- **6 isolated calls per city, 400 ms apart, with no early exit**, and every one of
  them counted in the `Live sample` column. The recorded row is the first CLEAN
  call, so a transient `Unknown` is still not written down as a permanent failure
  (rule 10 — Chicago returned `Unknown` once under concurrent load and resolved
  to `B3-2` on three consecutive isolated re-probes). Retrying and *not counting*
  is what published Phoenix as clean at a 19% failure rate.
- This is not more live load than before: the old code made up to 3 retry calls
  plus 3 unconditional stability calls. One sample now answers both questions.
- **A clean sample bounds the failure rate; it does not measure it as zero.**
  6 clean calls admit a true per-call failure rate up to 39.3% (95% one-sided).
  A city quieter than that can still be broken and this table will not see it.
- Exercises the REAL entry point (`getParcelInfo` → `computeEnvelope` →
  `buildDefaultSpec` → `assessFeasibility`). An earlier attempt called
  `resolveZoningLimits` with `maxFAR: null`, bypassed every provider-side
  resolver, and reported "11/65 resolved" — it measured the probe, not the
  pipeline.
- A single probed parcel does not characterise a whole city. Columns 2–5 say
  what the pipeline returned for ONE real address, which is enough to separate
  "resolves" from "falls back" and not enough to quantify coverage. That
  sentence sat here alone until 2026-08-12 and did not stop five cities being
  read as covered; `Sampled rate` is the same statement made as a number.

### Method for `Sampled rate`

- **A different instrument, deliberately.** `scripts/smoke-parcels.ts` grids each
  city's bbox, pulls one real parcel polygon per cell **from the same layer the
  city's provider reads**, and takes an interior point of it — so the population
  sampled is the one the tool actually serves. Hand-picked parcels are the ones
  that already work.
- **The same composition as `netlify/functions/analyze.ts`**, step for step
  (rule 11). If it would change the answer to call a layer directly, calling the
  layer directly measures the layer.
- Written to `netlify/functions/lib/data/envelopeSample.json` as COUNTS. The
  share is computed in `src/config/envelopeSample.ts` and nowhere else, so a
  percentage cannot drift from its own numerator, and this document and the
  /math coverage matrix read the same file.
- **Not part of `npm test`.** It is about an hour of live municipal-GIS traffic;
  the committed artifact is what ships, as with the permit pipelines. Regenerate
  with `npx vite-node scripts/smoke-parcels.ts`.
- Each city's entry carries its own `sampledOn`, so re-running one city cannot
  restamp the other 22 as freshly measured.
- **A sampled rate is not a guarantee either.** `n` is printed in every cell
  because 100% over 6 parcels and 100% over 25 are different claims, and because
  the sample is drawn from a grid over a bbox — spread across the city, but not
  a random draw from its parcel population.
