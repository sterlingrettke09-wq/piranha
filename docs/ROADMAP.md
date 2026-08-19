# Roadmap

What is being built, in what order, and who decides. Written 2026-08-18 because
every entry below was a decision made once in conversation and recorded nowhere
durable — which is the failure this repo's ledger exists to catch, applied to the
plan instead of to a figure.

**Three conventions, and they are the point of the file.**

1. **Every decision carries the date it was made.** "Change alerts first" is a
   call from a particular day. In three weeks that matters as much as it does for
   any number in `VERIFICATION-LEDGER.md`.
2. **DECIDED and OPEN are marked, never mixed.** An unstarted item that has been
   decided and an item waiting on someone are both "not done" and are not the
   same thing. A ranking is not a commitment either, and says so where it is one.
3. **Superseded entries are struck through, not deleted.** When a plan item turns
   out to have rested on a wrong belief, deleting it loses the more useful half —
   that the belief was wrong. Same reason the ledger keeps retractions
   (rule 17), and the entries live at the bottom rather than in place.

---

## Build order

Sequence set **2026-08-17**, reordered by Sterling from the version proposed.

| # | Item | Kind | State (2026-08-18) |
|---|------|------|--------------------|
| 1 | ~~Atlanta SPI~~ | DECIDED 2026-08-17 | **DONE 2026-08-19** |
| 1 | ~~San Diego~~ | DECIDED 2026-08-17 | **DONE 2026-08-19** |
| 2 | **Cost-data access** | **OPEN — blocked on Sterling** | BLOCKED |
| 3 | ~~Permit timing~~ | DECIDED 2026-08-17 | **DONE 2026-08-18** — see Superseded |
| 4 | **Parcel-weighted coverage** | DECIDED 2026-08-17 | NOT STARTED |
| 5 | **Map-layer asks** | DECIDED 2026-08-17 | NOT STARTED |
| 6 | **More cities** | DECIDED 2026-08-17, deliberately last | NOT STARTED |

**~~Atlanta SPI~~ — DONE 2026-08-19.** 105 of 123 live SPI codes resolve across
eleven chapters. The 18 that do not are pinned as an exact list with a reason
each: SPI-18 (10, its Development Controls Table contradicts itself — Subarea 10
states a non-residential base of 0.505 while the combined figure implies 0.500),
SPI-9 (6, its base FAR is "According to Map Attachment"), and SPI-5 SA1 / SPI-7
SA1, both outside their sections' titled scope.

*What the chapter took, and what it cost to be right:* **ten distinct structural
patterns and eight distinct basis mechanisms, none predictable from the last.**
The basis is not uniform at ANY level of the code — not the city (§16-29.001(37)
scopes itself to R-1 through R-5), not the chapter (SPI-20 and SPI-21 each leave
one limb unqualified and it is a different limb), not the section (SPI-15
§16-18O.028 states residential against gross for Subareas 2 and 4 and against net
for Subarea 3). Only the subarea. That warning is in the module for the next
editor.

**~~San Diego~~ — DONE 2026-08-19.** ZERO sweep gaps: all 183 live zone names
either resolve or carry a declared reason. 78 → 0 in one day.

*The reusable finding:* Chapter 15's planned districts mostly **incorporate base
zones by reference** rather than restating figures, and modelling that as a
reference (`incorporates`) rather than a copied number paid for itself
immediately — four Carmel Valley zones resolved the day Table 131-05D landed,
without being touched. The four blocks: Carmel Valley (20 codes), Table 131-05D
(12), Central Urbanized (13), Old Town (15), plus a tail of open-space, mixed-use
and La Jolla Shores zones.

*And an instrument rule worth keeping:* `pdftotext` first, **rendered page when
the column count will not reconcile**. Needed three times, and every time the
counts were RIGHT to differ — a merged header cell serving two zone designators
(CR-1-1/CR-2-1, CU-2-3/CU-3-3, OP-1-1/OP-2-1). Forcing them to match could only
have been done by misreading a side.

**Cost-data access** — the only item blocked on a person rather than on work, and
it gates monetization: a feasibility number with an unsourced cost basis cannot be
charged for. `src/config/estimates.ts` is explicitly marked NOT safe to automate
in `CLAUDE.md`, because an unattended loop would close the gap by inventing
constants in the right units — the exact failure rule 18 says gets the least
scrutiny.

**Map-layer asks** — five named, each a figure that exists in a code and depends
on WHERE: Atlanta ROW width (published as cartographic annotation, not a feature
layer), Denver Exhibit 8.1, San Diego Figure H, Phoenix § 1202.B/C, and the
Charlotte site-plan basis. These are data-publication gaps, not epistemic ones.

---

## Change alerts — STARTED 2026-08-19

Ordered account → watchlist → alerting, because an alert has nowhere to live
without durable per-parcel state.

### Done

**Accounts.** Passwordless magic link, built here rather than on a hosted
provider — decided 2026-08-19 so that no third party holds the user table and the
strict CSP needs no new origin. The raw token is never stored; the store is keyed
by its SHA-256, so a dump cannot be replayed and there is no secret comparison to
get wrong. Sessions are opaque and server-side, in a `__Host-` cookie, so they can
be revoked. `/api/auth-request` answers 204 for every outcome — unknown address,
throttled, send failed — or it is an account-enumeration oracle. The per-address
throttle is durable in Blobs, not the in-memory limiter, because this endpoint
sends mail to an address the *caller* names.

**Watchlist.** Keyed `(city, parcelId)`, stored as two fields. Each row carries
the answer snapshot at the time of adding, which is what makes a diff possible at
all.

### ⚠️ The parcel-id check, run BEFORE the schema was written

| city | id | present | unique | permanent |
|---|---|---|---|---|
| nyc | `BBL` | 856,614 / 856,614, 0 null | **yes** — distinct count equals row count | not tested |
| chicago | `PIN10` | 5 null of 1,432,483 | **unmeasured** — the service refuses a distinct-count, so a gap, not a pass | **no** |
| dallas | `ACCT` | **35,383 of 500,142 (7.1%) unusable** | no | not tested |

Chicago's is the sharpest: Cook County publishes **26 year-versioned parcel
layers** (2000–2025) plus a *Parcel History 2000-2023* layer carrying `LastTaxed`.
The county's own data model states the fabric changes between years, and the
provider pins `/2025` — so every Chicago watch reads a frozen year the moment 2026
is published. Scheduled, not hypothetical. `layerVintage` is stored on each row so
a non-resolving id is not ambiguous between "the parcel was retired" and "we are
reading last year's layer".

Dallas's 7.1% is 3,660 rows carrying the literal string `MULTIPLE` (condominium
footprints), 29,090 empty and 2,633 null. `addWatch` refuses those and says so, as
a 200 with a reason — "this parcel has no identifier in its city's records" is an
answer about the parcel, and a 4xx would render it as "something went wrong".

### The reproducibility precondition — MEASURED, and it gates the alert layer

`scripts/source-stability.ts` + `scripts/__fixtures__/sourceStability.json`.
A source is `insufficient` until observed twice; the alert layer must refuse
anything not `stable`.

| source | verdict |
|---|---|
| permit-feed:nyc | **UNSTABLE** — 4,394 → 1,040 → 8,103 on one unchanged query |
| permit-feed:austin | diffable — 11,534 → 11,650 over 12 days, medians unmoved |
| 18 zoning rosters | diffable, **on a 2-day interval** |

The expected direction is declared before each measurement, which is what gives
the test power: a fixed lower-bound window over an append-mostly feed can only
grow, so *any* decrease refutes regardless of magnitude. Without that prior,
+1.0% and −76% are both merely "different".

**⚠️ 18 of the 19 diffable verdicts rest on two days**, which is close to vacuous
for a near-static source — a zoning roster barely moves in two days whether the
feed is sound or quietly serving a cached snapshot. What that interval *does* rule
out is the failure mode already seen: NYC moved an order of magnitude in three
days. Every verdict carries `evidence: 'weak-short-interval' | 'adequate'` so
`stable` cannot be read as settled. **Re-run the register in a week** — that is
the single highest-value follow-up here, and it costs one command.

The one real change across the whole zoning sweep: **Dallas gained `PD-1144`**, a
new planned development. Exactly the change an alert should fire on.

### ~~The Chicago vintage pin~~ — FIXED 2026-08-19

`providers/chicago.ts` read `parcelHistorical/MapServer/2025`, a typed year. That
was a scheduled break, not a risk: the day Cook County publishes `Parcel 2026`
every Chicago answer keeps reading the previous year's parcels and nothing says
so — and a watchlist checking a frozen year reports "no change" forever while
looking like it works.

The layer is now RESOLVED from the service's own layer list
(`providers/parcelVintage.ts`), and the resolved year travels on the answer into
`ParcelInfo.parcelVintage` and onto every stored watchlist row.

Three things that were nearly wrong and are now pinned by tests:

- **The layer id is not the year.** Cook County numbers 2000–2021 as ids 0–23
  (with a `Parcels 2012A` in the middle) and only 2022–2025 happen to use the
  year as the id. A resolver taking the largest *id* works today and picks the
  wrong layer the moment id 24 becomes 2026. Resolution is by NAME.
- **`Parcel History 2000-2023` also starts with "Parcel ".** It is a history
  index, not a year's fabric, and is excluded by name rather than by hoping a max
  never selects it.
- **A failed layer-list read falls back to the pinned floor and says so.**
  `basis: 'pinned-fallback'` is distinct from `'resolved'`, so a metadata blip can
  never read as "this year is current" (rule 5). Cities whose fabric carries no
  year answer `'not-versioned'` — an answer — and an undeclared city throws.

`scripts/verify-parcel-vintage.ts` fails when the live newest is ahead of the
floor, and its failure message says the part that gets forgotten: **every row
stored before a rollover carries the old vintage, so the checker must compare
vintages before it compares snapshots.** A parcel that stops resolving against a
new fabric has been subdivided or merged — worth alerting on, and not the same
event as its zoning changing.

Deliberately NOT done: Chicago was not moved to Cook County's
`parcel_current_beta` or `CookViewer3Parcels`, which exist and are not
year-versioned. Both key on the **fourteen**-digit `PARID` against this layer's
ten-digit `PIN10`, and their counts (1,872,370 and 1,865,097 vs 1,432,483) are
consistent with the extra records being individual condominium units. That would
change what a "parcel" IS and what a watchlist row identifies — a different
decision from un-pinning a year, and one of them is named "beta".

### Next

1. **Re-observe the stability register.** One command, and it is the single
   highest-value follow-up here — it turns 18 two-day verdicts into twelve-day
   ones. **Due on or after 2026-08-26.**

   ```
   npx vite-node scripts/source-stability.ts --observe
   ```

   Re-run `npx vite-node scripts/parcel-weight.ts --counts` first if the zoning
   rosters need a fresh vintage to compare against.

2. ~~The watchlist UI~~ — **DONE 2026-08-19.** `/watchlist` (sign-in, list,
   remove) and `WatchParcelButton` on the report. Three states carry through to
   the screen rather than collapsing into one: `not-watchable` renders as a
   neutral fact about the parcel, not a red error, because it *is* one; a failed
   list load says "not the same as an empty list — nothing has been removed"; and
   every row prints when it was last checked and which parcel-map year it was
   read against, so a list that has quietly stopped moving cannot look like a
   list where nothing changed. `noindex` via the edge function — the page renders
   nothing without a session, so a crawler would only ever bank a sign-in form.
3. ~~The checker's decision layer~~ — **DONE 2026-08-19.**
   `netlify/functions/lib/watchCheck.ts`, pure and fully tested. Five gates, in a
   fixed order, because each earlier one can produce a change in the later ones
   for a reason that has nothing to do with the land:

   | # | gate | on failure |
   |---|---|---|
   | 1 | could we read it at all? | `check-failed`, **no event** |
   | 2 | does the register call this source diffable? | refuse, no event |
   | 3 | did the parcel FABRIC change? | report the rebase, **do not diff across it** |
   | 4 | is the parcel still in the layer? | `left-the-layer` — an event in itself |
   | 5 | diff the fields | only `changed` is alertable |

   Two refusals carry the weight. An unreachable service produces **nothing** —
   otherwise every upstream wobble reads as a rezoning. And a value going `null`
   is recorded as `became-unavailable`, never as a change: `null` means "not
   resolved", so "we stopped being able to read the FAR" is not "your FAR moved".

   The snapshot advances **only when a comparison actually ran on one fabric.**
   Adopting an uncompared reading as the new baseline would mean the change is
   never reported by anyone — this run suppressed it, the next finds it banked.

4. ~~The runner~~ — **DONE 2026-08-19.** `lib/parcelLookup.ts` +
   `lib/watchRunner.ts` + `scripts/watch-run.ts`.

   **Re-finding a watched parcel is a different query from the report's.** The
   report resolves from a point; a row is keyed on `(city, parcelId)`, so the
   runner looks the id up, takes an **interior point** of the returned polygon
   (not a centroid — an area centroid falls outside a concave lot, the recorded
   Charlotte failure) and re-runs `getParcelInfo`, the same function
   `/api/analyze` calls.

   **⚠️ The first version read the parcel row's attributes instead, and shipped a
   wrong number within minutes of meeting a live service.** San Francisco's
   `blklot` lookup reported a lot area of `2.7e-7`, because `Shape__Area` there is
   in **square degrees** and a regex matching "shape area" had turned an
   unlabelled projection unit into square feet by assumption. Through the real
   pipeline the same parcel now returns `districtCode: "P"`, `lotSqFt: 28332`.

   The unit bug was a symptom. A parcel layer carries no zoning, no height, no FAR
   and no developability at all, so four of the five snapshot fields could never
   have been compared from attributes — a checker that can never fire.

   **The identity guard.** The interior point came from this parcel's polygon, so
   the pipeline should land back on it. When it does not — a boundary revision, a
   sliver — the run is **refused**, not diffed. The premise of keying on the parcel
   is that one piece of ground is never compared against another.

   The layer/field pairs are **imported from the providers**, not transcribed:
   each now exports `PARCEL_SOURCE`. Chicago's is a *function*, because its layer
   is resolved per tax year.

   | verified live, 2026-08-19 | result |
   |---|---|
   | ids round-trip through `WHERE field = id` | **22/22** |
   | unique on a sample spread across the layer | LA, Miami, Dallas, Denver, Austin, Las Vegas, Minneapolis, Nashville and others |
   | one real duplicate each | Chicago (`1716405037`, 2 rows), Charlotte, Columbus |
   | no by-id lookup at all | boston (its parcel read goes through `_endpoints`) |

   **⚠️ CORRECTION, same day.** An earlier run of this check reported LA and Miami
   as having almost no unique ids, and that was the SAMPLER, not the cities. It
   drew from the first page of each layer, which is precisely where degenerate
   rows collect — LA's first fourteen carry a placeholder APN. Sampled across the
   layer, **LA's APN is unique on every sample of 2,432,668 rows and Miami's
   FOLIO on every sample of 596,113.** Third time in this repo a result implying
   a lot of work has turned out to be the instrument (rule 25), and the first
   time it reached a status table before being caught.

   Two things came out of the corrected run and both are kept:

   - **Placeholder ids, counted per city** and added to the runtime refusal list
     with the count behind each: LA `' --'` 19 rows, Miami all-zero folio 5,128,
     Columbus `'-'` ~410, Dallas `MULTIPLE` 3,660. Those parcels are refused at
     add time with a stated reason.
   - **`ambiguous` stays**, because Chicago's duplicate is genuine. A lookup
     matching several rows refuses to diff — taking `features[0]` would watch
     whichever row came back first and report a change every time that ordering
     moved.

   The check now separates **UNMEASURED** from **FAIL**: LA began answering HTTP
   302 midway through a later run (throttling, after this script had queried it
   hard) and a service that will not answer must never read as a city whose rows
   carry no identifier.

   `no-lookup` is its own state too: nobody looked, which is neither a failed
   check nor a missing parcel.

   Run it: `npx vite-node scripts/watch-run.ts --dry`. It reports and **sends
   nothing.**

5. Delivery. Nothing is sent until the runner has been observed producing no false
   positives across at least one re-observation interval — **the 2026-08-26
   register re-run is the gate**, and the runner already refuses any city the
   register does not call diffable.

### Recurring checks, so they do not get lost

| check | command | when |
|---|---|---|
| stability register | `npx vite-node scripts/source-stability.ts --observe` | weekly; **next due 2026-08-26** |
| Cook County tax-year rollover | `npx vite-node scripts/verify-parcel-vintage.ts` | monthly, and before the checker ships |
| parser-domain sweep | `npx vite-node scripts/enumerate-parser-domains.ts` | when a parser changes |
| parcel-id lookup + uniqueness | `npx vite-node scripts/verify-parcel-lookup.ts` | before delivery, and when a provider changes |
| watchlist check (dry) | `npx vite-node scripts/watch-run.ts --dry` | before delivery |

---

## Pro forma — DONE 2026-08-19, revenue-free by decision

`src/lib/proForma.ts` + `ProForma.tsx` on the report. Total development cost,
unit count, cost per unit and per sq ft, plus **carry**.

**In `src/`, not `netlify/`, and that is the point.** The arithmetic needs nothing
but numbers the analysis already returned, so the client builds it with no second
round trip and no endpoint. It takes a structural `CostSide` rather than the
server's `CostEstimate`, because `netlify/` imports from `src/` and never the
reverse — with a compile-time check that the server's type still fits.

### The revenue side is a stated blank, not an omission

No rents, no sale prices, no cap rate, no IRR, no yield, no residual land value.
That is not a phase-one simplification: this repo carries no revenue data at any
granularity and rents are not published per parcel the way construction costs and
permit feeds are. A pro forma missing those is not a *partial* pro forma — it is
one where the two numbers that **determine the answer** would be invented, and an
invented cap rate wearing a computed IRR is exactly rule 4. It would look sourced
because everything around it is.

So the missing half renders as a first-class block naming what the user would
have to supply and what each unlocks — never `Revenue: —`, which reads as a
number we failed to fetch. A test asserts no return metric exists as a *field*.

### Carry cost — and it is a RANGE

Months (from the timeline leg) × rate × loan. Computable precisely *because* the
two things this repo cannot source come from the caller.

⚠️ **Both drawdown conventions are returned, neither called the answer.** A
construction loan is not outstanding in full from day one:

| convention | figure | assumption |
|---|---|---|
| full balance | `principal × rate × months/12` | whole loan, whole period — an upper bound |
| average balance | half of that | a linear draw — the common convention |

Picking one silently would be inventing a drawdown schedule with a **2× spread**.
The UI says the range is the drawdown assumption, not cost uncertainty — a range
on a cost figure otherwise reads as "we are unsure what this costs".

### Three inputs, all the user's

Interest rate, loan amount, land price. **Nothing is defaulted**: no market rate,
no loan-to-cost ratio, and an assessed value is not a price. The total is `null`
until all components exist — `?? 0` is how a missing figure becomes free, and the
cost engine was rewritten to avoid exactly that.

Caught by running it: with a rate supplied and no loan, the copy still read
*"needs an interest rate and a loan amount"* — sending the reader back to a field
they had already filled. The `missing` array was precise and the prose was not,
and the prose is what people act on.

### Open, and unchanged by this

Revenue stays blocked on a source. If one ever exists at parcel granularity, it
slots in behind `REVENUE_NEEDS` without touching the cost side.

---

## `heightUnconstrained` — DONE 2026-08-19

`farUnconstrained` and `heightUnconstrained` express the same distinction about
two instruments: **the code imposes none here** (an answer) versus **we could not
read one** (a gap). Only FAR had a flag.

The fact was never missing. `zoning/atlanta.ts`, `zoning/dallas.ts` and
`zoning/charlotte.ts` each resolve it with a citation, and each carried a comment
saying the shared type had nowhere to put it — so it was flattened into an
`article` sentence and `maxHeightFt: null` reached the engine, which reported
**"no district height limit is available in public data"** for sixteen Atlanta
subareas whose code prints *"Maximum Building Height: None"*. The tool disclaiming
knowledge the code states plainly.

The asymmetry is the whole failure: nobody decided height's known absence was a
gap. One instrument got a field, the other did not, and every consumer inherited
the difference silently.

Now: the flag is on the type, the three providers forward it, `feasibility.ts`
returns `AS_OF_RIGHT / "no maximum"` instead of INDETERMINATE, and the inverse
returns `no-limit` and keeps the answer out of `unresolved`. Verified live —
downtown Atlanta `SPI-1 SA1` resolves it and both directions agree.

**⚠️ Denver Article 8 is NOT one of these, and the correction matters.** § 8.3.1.4.B.2
states heights *"are not limited **except** in the following height areas as shown
on Exhibit 8.1"* — 200 ft and 400 ft over three mapped areas, on a figure no
published layer carries. `zoning/denver.ts` deliberately withholds the flag and
says so: setting it would be **wrong by 2× for a Height Area 1 parcel, in the
flattering direction**. A conditional absence is a third state, not this flag, and
`unconstrainedSymmetry.test.ts` asserts the refusal so a future edit that
"completes" Denver goes red rather than looking like progress.

Both notes say `heightUnconstrained` still means only that no *ceiling* applies —
setbacks and the transitional height plane near a protected district still govern.

---

## Inverse query — DONE 2026-08-19

**"I want 40 units here — what would it take?"** The existing pipeline run
backward on ONE parcel: given a target, report which constraints bind, by how
much, and what kind of relief each needs. No index, no bounded result set, no new
infrastructure.

`netlify/functions/lib/inverse.ts` (pure), `/api/inverse`, and
`WhatWouldItTake.tsx` on the report — placed after it, because it answers the
question the report provokes.

**Not a search.** "Find me parcels where I could build X" is a different product
with a per-city index behind it. If it is worth doing it is a separate item and
it needs the index conversation on its own terms.

**Every threshold is the forward pass's.** `RELIEF_FACTOR_HEIGHT` (1.5) and
`RELIEF_FACTOR_FAR` (1.2) are now exported from `feasibility.ts` and imported
here; `avgUnitGrossSqFt` converts units to floor area. A second copy of any of
them would let the two directions contradict each other off the same inputs — the
report saying variance while the inverse says rezoning. The tests pin against the
shared constants rather than literals, so raising one cannot leave them disagreeing.

### The thing this feature could most easily get wrong

**An unresolved limit is not an absent constraint.** If a district's FAR cannot be
read, "you need a height variance" is a false completeness claim — the FAR might
be the harder problem and nobody looked, and the user goes to the wrong hearing.
So an unreadable limit yields `relief: 'unknown'`, the dimension is listed in
`unresolved`, it is excluded from being named the binding constraint, and the
summary says what it does not cover **in the same sentence** as the
recommendation. A confident headline with a grey caveat underneath is how a
partial answer gets read as a whole one.

Five relief states, not three, because collapsing any pair produces a false
sentence: `none` · `dimensional-variance` · `beyond-variance` · `no-limit` (the
code imposes none — an answer) · `unknown` (a gap).

### Caught by running it on live parcels

- **Denver `D-CV` returned "fits within what the district allows by right"**
  while the FAR line directly beneath it said height, setbacks and coverage govern
  instead — neither of which was checked, because the target named neither. "No
  FAR applies here" is an answer about FAR, not about the parcel, and the summary
  was borrowing the confidence of one for the other. Now it says what actually
  governs and that no height was given.
- SF `C-3-G`: 40 units on a 1,426 sf lot → FAR 36.47 against 6.00, 6.1× over,
  correctly rezoning-grade. NYC `C6-7`: same target on 14,246 sf fits by right.

### Known limits, stated rather than papered over

- **Storeys and feet are never converted.** A storey target against a limit in
  feet returns `unknown` and says why — the round trip is what published 87
  storeys for a district whose code says 80 (rule 12).
- ~~**There is no `heightUnconstrained` on the zoning type**~~ — **FIXED
  2026-08-19.** The flag now exists beside `farUnconstrained`, three providers
  forward it, and both the forward pass and the inverse read it. See below.
- **No district unit cap is read.** `envelope.maxUnits` is derived from floor
  area, so reporting it would restate the FAR constraint as a second problem and
  imply a second hearing. A district that caps units directly would need its own
  field, and none exists.
- **The relief thresholds are doctrine, not any city's ordinance.** The UI says
  so: which board hears it, and what it is called locally, is a question for the
  city.

---

## Feature order

Ranking set **2026-08-18**. Sterling's own weighting, quoted.

| # | Feature | Weight given | Kind |
|---|---------|--------------|------|
| 1 | **Change alerts** | *"extremely important"* | DECIDED 2026-08-18 |
| 2 | **Inverse query** | *"very important"* | DECIDED 2026-08-18 |
| 3 | **Pro forma** | *"important"* | DECIDED 2026-08-18 |
| 4 | **ADU** | *"yes, not first"* | DECIDED 2026-08-18 |
| 5 | **Account + favorites** | — | DECIDED 2026-08-18 |
| 5.1 | **Assemblage** | — | **RANKING, NOT A COMMITMENT** |

None started. Assemblage's "5.1" was a position in a list, not a decision to
build it; it is recorded that way so a later reader does not promote it by
finding it on a roadmap.

---

## Monetization

Answered **2026-08-17**, against four options put to Sterling.

| Option | Answer | Kind |
|--------|--------|------|
| **API / data licensing** | **Yes** | DECIDED 2026-08-17 |
| **Pro subscription** | **Yes, but hard** | DECIDED 2026-08-17, difficulty acknowledged |
| Per-report purchase | *"Idk, I don't see how this would generate anything good"* | **OPEN — leaning no** |
| Lead generation | **No** | DECIDED 2026-08-17 |

Both "yes" answers depend on cost-data access above. **Updated 2026-08-19:** the
free-stack work moved the cost basis from unsourced to sourced-per-product, with
two products carrying explicit stated absences instead of numbers. What is still
missing for a billable product is a *spread* — every rate is a point, and a
point with no range is hard to sell as a feasibility figure.

---

## Open questions — technical, carried forward

| Question | Since | State |
|---|---|---|
| **La Jolla sub-areas LJPD-1A / 5A / 6A** | before 2026-08-19 | § 159.0301(a) creates six zones with 1A, 5A and 6A "included in" them, and nothing establishes that the parent zone's FAR carries to the included sub-area. This is an unanswered question about the ordinance, NOT an unread document — re-reading Article 9 will not settle it. Declared out of scope in the sweep. |
| **Atlanta SPI-18 Subarea 10** | 2026-08-18 | The Development Controls Table contradicts itself: a stated non-residential base of `0.505` against a combined figure implying `0.500`, with nine of ten columns exactly additive. A fused footnote digit is the likely cause and is demonstrably something this source does — but the chapter's footnotes 4/5/6 concern sidewalks, so a "5" there has nothing to point at. Correcting a published cell from the table's own arithmetic is the inference the module refuses elsewhere. Left unencoded. |

---

## Open questions — waiting on Sterling, not on work

| Question | Since | Consequence while open |
|----------|-------|------------------------|
| **Cost-data access** — which source | before 2026-08-17 | blocks monetization entirely |
| `plannedDevelopmentSource` — copy decision | 2026-08-15 | the PD citation sentence is computed and discarded; the panel shows a generic paragraph. Dallas's runs 400+ chars incl. a quoted excerpt, so it is a copy call, not a wiring fix |
| **RSMeans credential rotation** | 2026-08-18 | a password was pasted into a transcript. Never used, never entered anywhere. Still needs rotating |
| **Photos** — Dallas, Las Vegas, Phoenix | 2026-08-18 | three city cards have no image |

---

## Smaller open work

- **Minneapolis story paragraph** — must be produced by `cityStories.ts` through
  interpolation, not hand-written: `parkingClause` is guarded so every word except
  the city name must appear in the verified parking headline.
- **#15 LA recodification** — make the bracketed-format count dynamic. The
  151-vs-169 discrepancy is to be resolved BY the dynamic count, not investigated
  first. LA is 440 of the 731 sweep gaps.
- **Prose FAR** — Atlanta SPI-6 states a ratio in prose with no table. The grid
  parser is structurally blind to it. No live zone code carries SPI-6, which is
  the only reason it is not urgent.

---

## How each item gets done

Written 2026-08-18. The *method* for each build-order item, so the work does not
get re-derived every time it is picked up. Each states what unblocks it, the
instrument it uses, and the specific way it can go wrong — because in this repo
the failure is almost never "we could not find the number", it is "we found a
plausible one".

### 1a. ~~Atlanta SPI~~ — DONE 2026-08-19

*Method kept because it generalises to any Municode city; the work itself is
finished.*

Per chapter, in order:

1. **Get the nodeId from the Part 16 TOC index**, never by guessing a URL
   (rule 8). `codesToc/children?nodeId=PTIIICOORANDECO_PT16ZO&productId=10376`.
2. **Fetch `CodesContent` and confirm the payload parses.** A truncated fetch
   returns HTTP 200 (rule 22); JSON that parses to completion is the destination
   check.
3. **Expand with `scripts/municodeGrid.py`.** Merged headers mean the header and
   data column counts legitimately differ — reconcile the **column PATH** against
   live zone codes, never the count.
4. **Check live coverage before reading**: every column needs a live code, or the
   uncovered column gets declared read-but-unverifiable (SPI-21 SA6's treatment).
5. **Read EVERY FAR row**, and record which rows were read and which are declared
   out of the envelope model. Chapter-level "read" is what produced the SPI-16
   2.6x defect.
6. **Apply `parseAtlantaFarCell` to every cell.** Anything not a bare number is
   not a ratio and is refused, never coerced.
7. **Slot-test any unstated basis** before assuming one.
8. **Encode all limbs together** — per-use plus combined — so no district ships
   half-answered, and run the suite.

*Failure mode to watch:* a chapter that states FAR in prose with no table
(SPI-6 does) is invisible to the grid parser entirely.

### 1b. ~~San Diego~~ — DONE 2026-08-19 (78 → 0 gaps)

*Method kept for the same reason. Two additions this city contributed: model an
incorporation-by-reference as a REFERENCE, not a copied figure; and escalate
`pdftotext` → rendered page the moment a column count will not reconcile.*

Same discipline, different source: Municipal Code Chapter 15 planned districts
plus Table 131-05D. Named blocks — Carmel Valley (20 codes), Central Urbanized
(13), Old Town (15), Table 131-05D (CR/CO/CV/CP), Division 2 open space, three La
Jolla sub-areas.

Where headers are NOT merged the column-count cross-check does apply and is the
strongest available instrument — it is what proved Table 131-05C (header count,
data count and live code count all six). Where a district publishes a base and a
bonus, encode the base and label the rest, the way Denver's D-GT went in at 8.0
with the 15.0 incentive noted (rule 6).

### 2. Cost-data access  — PARTLY DONE 2026-08-19 via the free stack; ranges still open

**Decided 2026-08-19:** take the free-stack path rather than wait on a paid
subscription. What that produced, in order:

| Step | State |
|---|---|
| Re-key cost by PRODUCT TYPE, not use | **DONE.** `detached / small-multi / apartment / office / institutional / mixed`. A detached house was being priced at an apartment rate. |
| `small-multi` (2–4 unit) | **DONE as an explicit absence.** `kind: 'unsourced'` — no published source covers it at this scope, and interpolating between detached and apartment would be an invented conversion (rule 4). Renders no construction cost with a stated reason. |
| `mixed` | **DONE as an explicit absence.** `kind: 'unpriced'`; the former figure is withdrawn. Cumming publishes no mixed-use row. |
| Source `detached` | **DONE.** NAHB *Cost of Constructing a Home in 2024* → $152/sf, scope-matched by subtracting four published line items. A 2.24× reduction from the apartment rate it had been inheriting. |
| Re-validate `apartment` against Cumming apartment ranges alone | **DONE**, and now **stored as data** — `src/config/cummingRanges.ts` + `cummingCheck.test.ts` recompute it rather than restating a verdict. |
| Height premium — is it real? | **DONE.** RSMeans three-point series, size-normalised, gives ~1.10 at 4–7 storeys and ~1.40 at 8–24 against this file's 1.12 / 1.28. The premium is real; the 9–20 tier is **modelled low**, recorded as a measured direction and deliberately not changed. |
| Validate against permit-declared valuations | **DONE**, in the only direction a known-understated source permits. |
| **Ranges (a spread, not a point)** | **STILL OPEN.** NAHB publishes no spread, so `detached` is a sourced *point* and says so. This is what a paid source would buy. |

*Still blocked on Sterling:* nothing structural — but the RSMeans credential
pasted into a transcript on 2026-08-17 has not been rotated, and that is his
action, not one this repo can take.

If a paid source is later chosen:

1. Source each constant in `src/config/estimates.ts` individually, with a
   citation per figure — **composite constants need BOTH inputs sourced** or the
   composite is labelled derived (rule 3).
2. **External benchmark before shipping**, not on request. Every defect ever
   found here was caught by comparing to something outside the system (rule 9);
   the test suite has never caught one.
3. The Methodology page derives its tables from these constants, so changing them
   changes published math — the disclosure copy has to be re-read in place, not
   moved (rule 9 corollary).

*Why this is not automatable:* an unattended loop closes the gap by inventing
constants in the right units, which is the shape that gets the least scrutiny
(rule 18).

### 3. ~~Permit timing~~ — DONE 2026-08-18

Audited end to end. No live target remains. The only recurring work is
re-checking that the ten withholdings still hold for current reasons — a
coverage question, not an accuracy one, and the reason-type sort makes it cheap:
city-facts cannot expire, measurement-facts can, tool-facts have three times.

### 4. ~~Parcel-weighted coverage~~ — DONE 2026-08-19

Denominator decided before measuring: all live features in each city's principal
zoning layer — the same layer and field the provider reads. `scripts/parcel-weight.ts`
counts per code, `docs/PARCEL-WEIGHTED-GAPS.md` is the derived report, and
`scripts/parcelWeight.test.ts` pins it.

**All 23 targets reconcile exactly** — per-code counts plus the *measured* blank
bucket plus the *measured* whitespace bucket equal each layer's own `count(1=1)`.
The residual is never obtained by subtraction, which cannot fail to balance.

The reconciliation is what found things, exactly as intended:

| finding | what it was |
|---|---|
| Chicago's grouped aggregate **undercounts its own layer by 68** | RT-4 groups to 1,954 against a direct count of 1,967; ten PD codes in `returnDistinctValues` absent from the grouped result and two the reverse. Not truncation, not transient. Fell back to per-value; the shortfall is recorded so the repair cannot delete the finding. |
| Four Chicago codes stored with a **trailing space** | `WHERE ZONE_CLASS = 'PD 194'` returns 0 for a code that exists as `'PD 194 '` — and 0 from a query that ran is precisely what this tool treats as an established absence. Rule 5's own failure mode, inside the instrument built to avoid it. |
| Philadelphia's blank check was **invalid SQL** on a numeric column | `MaxHeight = ''` → HTTP 400, recorded as unmeasured, residual −11. `MaxHeight IS NULL` returns exactly 11. Which predicate answered is now stored. |
| Raleigh 500s on `count(ZONING)` but not `count(OBJECTID)` | Same grouped query, different statistic column. Counting the row is also the more correct one. |
| Charlotte 500s on its own **layer-info** request while every query succeeds | Degraded, not fatal — metadata is descriptive, the counts are the measurement. |

**RANKED BY LAND AREA, decided 2026-08-19.** Polygon count is published in every
table beside it and never breaks a tie, so the two cannot quietly swap roles.

The two disagree, in both directions, which is why both are published:

| city | by area | by count |
|---|---:|---:|
| san francisco | **41.91%** | 12.82% |
| miami | **37.04%** | 68.67% |
| columbus | 21.37% | 16.31% |
| las vegas | 11.07% | 3.03% |

Miami is near a factor of two *down* from its polygon share; San Francisco over
three times *up*, because public land arrives in a few enormous parcels. The
single largest gap in the file is SF's `P` — 30.7% of the city's land, 7.5% of
its polygons.

Miami's substance is unchanged and still the sharpest finding: T4-\*, T5-\*, CS,
CI, D1–D3 and T1 resolve nothing, verified against T6-8-O and T3-R which do.

**⚠️ 448 of the 653 are UNRANKED — not last, and not zero.** Ten of the 23 layers
publish no area column; nine cities, of which two have gaps: **LA with 440 and
Phoenix with 8**. So the largest single contributor to the sweep total is not in
the ranked list at all, and the ranked list covers 204.

This is an established absence rather than a missing lookup. Seven area-column
spellings were queried against each service — `SHAPE.STArea()`, `Shape.STArea()`,
`SHAPE.AREA`, `ST_Area(SHAPE)`, `Shape__Area`, `SHAPE_Area`, `Shape.area` — and
all seven were rejected by LA, Phoenix and Seattle. They publish geometry with no
summable area statistic.

*Open:* whether to compute LA's and Phoenix's areas client-side from returned
geometry. That is a real option and a different instrument — it would fetch
~68,000 polygons rather than one aggregate — so it is a decision, not a to-do.

### 5. ~~Map-layer asks~~ — PARKED 2026-08-19, and not because they are hard

**These are outbound requests to city GIS departments, not code.** Nothing in this
repo can close any of them; each needs a person to email a city and wait. Sterling
is sending them separately, so they are off the build order entirely rather than
sitting in it looking like unstarted work.

They stay listed because each is a live constraint on a published figure — a
reader wondering why Atlanta has no gross-lot denominator should find the reason
here, not conclude nobody looked.

| city | ask | what it unblocks |
|---|---|---|
| Atlanta | ROW width as a queryable feature layer — today it is cartographic annotation, `type: "Annotation SubLayer"`, and `/query` answers 400 | the gross-lot denominator |
| Denver | Exhibit 8.1 | |
| San Diego | Figure H | |
| Phoenix | § 1202.B/C | |
| Charlotte | site-plan basis | |

*Re-open this section only if a city answers.* No code change can move it.

### 6. More cities  (deliberately last)

`docs/ADDING-A-CITY.md` is the procedure. Per city: provider adapter, zoning
module, **live field verification before any encoding** (a layer name is not a
layer — verify it is queryable at all), enumeration fixture, hurdles, and a
permit script only if the feed carries an application date.

*Why last:* every city added widens every sweep, and a city added before its
fields are verified adds gaps that look like coverage.

---

## Feature order — how each would be built

Ranked 2026-08-18. None started. Listed with what each actually requires, because
the ranking and the difficulty are not the same order.

**1. Change alerts** *(extremely important)* — the largest infrastructure lift on
the list, and it is first. Needs three things this project does not yet have:
durable per-user state, scheduled re-runs of saved parcels, and a **diff engine**
that can say what changed and why. The hard part is not the notification, it is
that a diff is only meaningful if a re-run is reproducible — and this session
established that NYC's own population is not (4,394 / 1,040 / 8,103). An alert
built on an unstable source fires on noise. **So per-source reproducibility is a
precondition, not a detail.**

**2. Inverse query** *(very important)* — "show me every parcel where X". Needs
precomputed envelopes in an index rather than per-request computation, which
means a build step and a store. Bounded and mechanical once the store exists.

**3. Pro forma** *(important)* — **downstream of cost-data.** A pro forma with an
unsourced cost basis is the same unshippable artifact as a feasibility number
with one.

**4. ADU** *(yes, not first)* — per-city ADU rules module, same shape as the
existing zoning modules. Self-contained; no new infrastructure.

**5. Account + favorites** — auth plus storage. **Also the precondition for the
pro subscription below**, which is worth noting because it is ranked fifth while
one of the two approved monetization paths depends on it.

**5.1. Assemblage** — a RANKING, not a commitment (see above). Multi-parcel
envelope math; the interesting part is that combining parcels changes frontage,
setbacks and sometimes district, so it is not a sum.

---

## Monetization — what each requires

**API / data licensing — YES.** Needs a stable versioned schema, rate limiting
(`netlify/functions/lib/guard.ts` already exists), and a licence. The valuable
fields are the derived ones, so this is **gated on cost-data** for anything
beyond zoning envelope.

**Pro subscription — YES, but hard.** Sterling's own assessment. Requires
accounts (feature #5) plus a billing integration plus something worth paying for
monthly — which is change alerts (feature #1). **So the subscription is
downstream of the two heaviest features**, which is what "hard" means concretely.

**Per-report — OPEN, leaning no.** *"Idk, I don't see how this would generate
anything good."* Recorded as open rather than closed because it was a doubt, not
a decision.

**Lead-gen — NO.** Decided 2026-08-17.

---

## Also open — smaller

| Item | Method |
|---|---|
| **Minneapolis story paragraph** | Must come from `cityStories.ts` by interpolation. `parkingClause` is guarded so every word except the city name must appear in the verified parking headline — checked mechanically. Target text: parking minimums abolished citywide in 2021; a by-right apartment build ~38 months, +3 once a variance is needed. Both figures already exist on the ranked city object. |
| **Photos — Dallas, Las Vegas, Phoenix** | Asset acquisition. Sterling. |
| **#15 LA recodification** | Make the bracketed-format count dynamic. The 151-vs-169 discrepancy is resolved BY the dynamic count, not investigated first. LA is 440 of the remaining 653 sweep values — now by far the single largest block, and the only readable city work left on the build order. |
| **RSMeans credential rotation** | Sterling. A password was pasted into a transcript on 2026-08-18. Never used, never entered anywhere. Still needs rotating. |

---

## Next session — Atlanta SPI encode, two things to settle first

Recorded 2026-08-18. Both are preconditions, not tasks: getting either wrong
produces a published figure rather than a visible failure.

**1. SPI-20's non-residential basis is UNSTATED, and that is a slot question.**
The chapter's bonus cap is explicitly against gross lot area, and the residential
limb is elective ("may use net lot area or gross lot area"). Neither establishes
the denominator for the BASE non-residential ratio, and it must not be inferred
from its neighbours — a basis taken from the adjacent limb is an invented
conversion wearing a citation (rule 4).

Apply rule 5's slot test to the section structure: does the chapter have a place
where a basis for that limb would be stated? If the slot exists and is empty,
that is an ANSWER. If there is no slot at all, the test's precondition is unmet
and the honest output is a gap — the same distinction that settled DC and
Philadelphia, and the same one that made Milwaukee's parks a gap rather than an
absence.

**2. SPI-21 has ten columns and nine live codes — SA6 has no parcel.**
Live codes measured against the 2026-08-17 enumeration: SA1–SA5, SA7–SA10. SA6 is
absent.

This is NOT a coverage gap: no parcel carries the code, so nothing renders wrong
whatever the column says. But it cannot be VERIFIED either, because column-path
identity is checked by mapping distinct paths onto live zone codes, and there is
no code to map. Encoding it would publish a figure whose column mapping was never
checked against reality — which is the DC MU-column off-by-one with nothing able
to detect it.

So: encode the nine that check out, and declare SA6 read-but-unverifiable with
that reason stated. It is the same shape as a declared-out-of-model row in the
rows-not-chapters convention — a column someone looked at and could not confirm
is different from one nobody read.

**Why the encode is safe to attempt at all:** `providers/atlanta.ts` sets
`maxFAR` only when all three limbs agree, and leaves it null with `farByUse`
carrying the answer wherever they differ. So SPI-16's 8.2 combined cap cannot
become "the FAR" for a residential project regardless of how the encoding lands.
That architecture predates 2026-08-18, and it is why the 2.6x overstatement was a
READING defect caught before encoding rather than a shipped one.

---

## Where the sweep stands, 2026-08-19

The parser-domain sweep opened the day at **731** unexplained values and closed at
**653**. Composition, because the bare number is not the report (rule 26):

| block | then | now |
|---|---|---|
| **San Diego** | 78 gaps | **0** — every live zone name resolves or carries a declared reason |
| **Atlanta** | 0 gaps, 173 excused | 0 gaps, 68 excused — 105 of 123 SPI codes now resolve |
| **LA** | 440 | 440 — recodification mid-transition, deliberately unencoded |
| everything else | ~213 | ~213 — per-city tails never queued |

**Two of the three movements this session were the system, not the counting**, and
the distinction is stated wherever the number appears. San Diego's 78 → 0 is code:
codes that returned nothing now return a figure. Atlanta's 173 → 68 excused is
also code, and is only visible in the EXCUSED count because those values were
already declared out of scope — the gap total never moved, so the headline number
would have shown a completed chapter as nothing at all.

**The readable city work on the build order is now finished.** What remains in the
653 is LA's recodification — one bounded task (`#15`, make the bracketed-format
count dynamic) rather than a reading programme — and per-city tails of 30–40 codes
that were never queued. Neither is next: the roadmap's order puts cost-data access
after this, and it has been blocked since before 2026-08-17.

---

## Superseded

Kept rather than deleted. In each case the plan item was real and the belief
under it was wrong, and the second half is the part worth keeping.

### ~~Permit timing — "needs to be fixed" (planned 2026-08-17, closed 2026-08-18)~~

Ranked #3 on the build order under the belief that most published permit figures
were wrong and needed correcting. **The belief was wrong in a specific way.**

Measured across all sixteen scripts: six cities publish, ten withhold. Four of the
five cities queued for filter work were already withheld and the fifth had no
script at all, so the filter and censoring steps had no live target. The eight
bad figures the plan was built around had already been withdrawn in earlier
sessions.

What the leg actually needed was an audit, and the audit's result is that the
figures which survive are **labelled, not corrected** — four of the six publish
conditional medians off issued-only feeds where the issuance rate is not
observable. That is an honest state, not a fixed one.

One item did change: **Milwaukee now publishes** its 1–2 family pair (single
2.3 mo n=262, multi 5.3 mo n=83) with no city aggregate, decided 2026-08-18.

*Why this entry stays:* "permit timing needs fixing" was a confident,
reasonable, and largely incorrect belief. Deleting the row would leave the
roadmap looking like a list of things that went as planned.
