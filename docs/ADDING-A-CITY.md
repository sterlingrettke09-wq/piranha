# Adding a city

This is the procedure, written from adding **Raleigh** end to end on 2026-08-07.
It is not the procedure we thought we had — Raleigh was run deliberately as a
test of whether adding a city is repeatable, and the places where it was harder
or different than expected are called out inline as **what actually happened**.

Read `CLAUDE.md`'s evidence rules first. This document is the operational form of
them; the rule numbers below refer to it.

**Every step names the guard that enforces it.** A checklist without its
enforcement is a suggestion — the next person will skip whichever step is
inconvenient, and nothing will notice. Where a step has no guard, it says so, and
that is the honest state rather than a gap in this document.

---

## 0. Before anything: what "adding a city" is not

It is not one file. Raleigh's provider stage created five files and touched
nothing shared; the wiring stage then touched **eight** shared files, one of them
core feasibility logic, and changed a test invariant. Budget for both stages.

The three things a new city is most likely to ship wrong, in order of how much
damage they do:

1. A **fabricated number** where the code states nothing (rule 1).
2. A **plausible number** derived through a unit or a table the code does not use
   (rules 12, 6).
3. A **gap rendered as an answer**, or an answer rendered as a gap (rule 5).

Every step below exists to catch one of those.

---

## 1. Scout the data — by point-querying, never by reading a catalogue

**Do:** pick two or three real addresses in the city, and hit every candidate
endpoint with an actual point query:

```
?geometryType=esriGeometryPoint&geometry=<lng>,<lat>&inSR=4326
&spatialRel=esriSpatialRelIntersects&outFields=*&f=json
```

Read the attributes that come back. Write down the **exact** field names, casing,
value types and nulls.

**Do not** conclude anything from a service's layer index, a field list, a
metadata page, or a dataset description. A layer can exist, advertise the right
field, and match zero parcels.

Check, at minimum, and record what each returned:

- **Parcel layer** — id, address, owner, lot area, existing units, year built.
  *What unit is lot area in, and how do you know?* Raleigh's `Shape_Area` is
  square feet because the layer's spatial reference is EPSG:2264 (NC State Plane,
  US survey feet) and shoelacing the returned rings in that projection reproduced
  `Shape_Area` to four decimal places on 25 of 25 sampled parcels — measured
  against the geometry, not inferred from the field name. The independent
  `DEED_ACRES` column agreed to a median of 0.996 and is the weaker source (it
  rounds a 5,225 sf lot to `0.12`), so it is a fallback only.
- **Zoning layer** — the district code field, and whether the layer's *extent*
  matches the city. Query it with `where=1=1&returnExtentOnly=true&outSR=4326`.
- **Overlay layers** — one per type, or one multi-type layer? This decides
  whether an existing provider's dedup logic ports.
- **Whether the parcel layer and the zoning layer cover the same ground.**

**What actually happened.** Raleigh's parcel service is *Wake County* property
republished by the City, so it also returns Cary, Apex and Garner parcels. The
zoning layer stops at the city limits. That mismatch is why `RALEIGH_BBOX` is
scoped to the **zoning layer's measured extent** (`xmin -78.819399 ymin 35.706213
xmax -78.469890 ymax 35.971650`, rounded outward to 2 dp) rather than drawn
around the city label: otherwise a user types a Cary address, gets a real parcel,
and sees `districtCode: 'Unknown'` with null limits — a correct render of a gap
and a useless answer. Raleigh's overlays are twelve separate layers, one per
type, so Nashville's dedup did not port; four of the twelve bear on feasibility.

**Guard:** none at this step, and that is the point — this is the step that has
to be done by hand, because it is the only one that compares the system to
something outside it (rule 9). Everything downstream inherits its errors.

---

## 2. Write the provider

Model it on the closest existing provider rather than on the generic shape.
Raleigh used `providers/nashville.ts` — one parcel layer carrying assessor
attributes *and* owner, one separate zoning layer, optional overlays.

Files, using Raleigh's names:

| File | What it holds |
|---|---|
| `netlify/functions/lib/providers/raleigh.ts` | endpoints, field reads, normalisation to `ParcelInfo` |
| `netlify/functions/lib/providers/raleigh.test.ts` | 22 tests, driving `getRaleighParcelInfo` |
| `netlify/functions/lib/providers/__fixtures__/raleigh.ts` | verbatim captures of live responses |

Rules that bit here:

- **Fixtures must be verbatim captures of live point queries**, not hand-written
  approximations. A fixture invented to match the provider's expectations tests
  the provider against itself (rule 9). Keep the upstream's real casing
  (`'2000 FAIRVIEW RD'`), real nulls (`HEIGHT` null on R districts, `OLAY_NAME`
  null on `-TOD`) and real types (`Shape_Area` as a float).
  - One departure is allowed and must be flagged **inline at each site**:
    replace a private individual's name in an `OWNER` field with a placeholder. An
    unqualified "verbatim" claim next to an edited value is exactly the half-true
    provenance statement rule 9's corollary warns about.
- **Provider tests drive the provider's exported entry point**, never the zoning
  resolver underneath it (rule 11). Denver's curated table was corrected while
  every real parcel kept publishing the old height, because the provider
  consulted a live story count first and the table's own tests called the
  resolver directly and passed throughout.
- **Convert nothing.** If the code states stories, carry stories (rule 12).
- **A parcel outside the zoning layer must surface as a gap**, and that behaviour
  needs a test so it cannot quietly become a substantive answer.

**Guard:** `npx tsc -b` — and note *which* tsconfig. `tsconfig.app.json` includes
only `src`. `tsconfig.scripts.json` includes `scripts` **and** `netlify`, and it
exists because a checking script read `.maxFAR` off a resolver returning
`{ far, heightFt }`, got `undefined` on every input, and reported 1,528 phantom
unhandled Chicago classes (rule 11). Without that config a nonexistent property
in a provider is a silent `undefined`, not a build error. `npm run build` runs
`tsc -b` first; run it.

---

## 3. Curate the zoning table from the OFFICIAL code, with a citation per value

Fetch the **official consolidated ordinance text**, from the publisher's own
index — not Municode, not a mirror, not a summary, and not a guessed chapter URL.
Raleigh's was `https://udo.raleighnc.gov/udo-book/print-all-chapters`, reached
from the site's own print index (rule 8: a 404 on a guessed path proves your
guess wrong, not that the resource is absent).

Record at the top of the module: the URL, the fetch date, and the **currency** of
what you read (Raleigh: Supplement 28 on Sec. 3.3.2; text change TC-1-25 on
Sec. 2.2.8 and 4.6.2). Then, per district, one value per line with its section.

Four questions to answer explicitly in the module header, because each is a
recorded defect class:

**(a) Does this code impose a FAR at all?** Answer it by the **slot test** — does
the source have a place for the value, filled or not? Raleigh: every district
dimensional table in Chapters 2, 3 and 4 is built from the same lettered sections
(Lot Dimensions / Building Setbacks / Parking Setbacks / Height / Transparency /
Allowed Building Elements) and **there is no FAR row in any of them**; the string
"floor area ratio" occurs exactly twice in the whole ordinance, both inside one
traffic level-of-service site-plan provision, and never as a heading. That is a
stated absence — `farUnconstrained: true` — and it must never fall through to an
assumed FAR of 1.0. A blank cell alone is *not* this.

**(b) What units does the code regulate in, and are they convertible?** Raleigh's
Sec. 3.3.2 tabulates `-3 → 3 stories / 50 ft`, `-4 → 4/68'`, `-5 → 5/80'`. Those
imply 16.67, 17.00 and 16.00 ft/story — **three different ratios in three
adjacent columns.** The source document contains its own disproof that a
ft/story constant exists. Encode that as a test (see step 4).

**(c) Is the height stated per building type?** If so, the headline is the lowest
common type, not the maximum across types (rule 6). Raleigh Article 2.2 states
R-6 and R-10 townhouse at 45' and R-10 civic at 45' while detached is 40'/3
everywhere; 40'/3 is the headline and the 45' figures ride in `alternatives` as
programs the applicant may elect. And some figures must **never** be published:
R-1 carries 68'/4 for a General Building, immediately qualified as allowed "only
as part of a governmental water or wastewater treatment plant use". It is absent
from `alternatives` and pinned absent by a test.

**(d) What do the overlays and options actually change?** Check each; do not
infer from its name. Raleigh's Frequent Transit Development Option relaxes lot
area, lot width and site area per dwelling unit — its own height rows are the
same 40'/3, 45'/3, 26'/2 Article 2.2 already states. The `-TOD` overlay's
mixed-use height increase is an **earned** bonus conditioned on deed-restricted
affordability, so the module never returns it and the provider surfaces overlay
presence instead. Conditional-use (`-CU`) suffixes sit on 1,386 of 3,580 mapped
polygons and can cap height, units or use *below* the base district — so the base
figure is labelled as a ceiling the site may not have, with the ordinance linked.

> **What actually happened, and it is the whole reason this step is separate from
> step 1.** The scouting notes that fed the Raleigh zoning module contained
> **four wrong claims**, all of them plausible, all caught only by reading the
> primary source:
>
> 1. *"The UDO sets no feet-per-story cap for mixed-use districts."* False, and
>    load-bearing. Sec. 3.3.1 says verbatim: "The designation establishes the
>    maximum height in stories and feet… For example, CX-5 has a maximum height
>    limit of 5 stories and 80 feet." Trusting the summary would have shipped
>    `maxHeightFt: null` on every `-3/-4/-5` parcel — a **fabricated gap on the
>    majority of mixed-use land**.
> 2. *"R-1…R-10 detached, attached, townhouse, civic: 40'/3."* Wrong for
>    townhouse in R-6 and R-10 (45') and for civic in R-10 (45').
> 3. *"The Frequent Transit Development Option permits higher height."* It does
>    not; it is a density option.
> 4. The `-TOD` height increase read as available rather than earned.
>
> Textbook rule 18: each was a plausible summary, wrong in the direction that
> looks like an answer. **A scout's summary is an input to be checked, never a
> source.**

**Guard:** the module's own test file — Raleigh's `zoning/raleigh.test.ts` is 96
tests — plus `npx vite-node scripts/check-citations.ts --strict`. Know what the
citation checker can and cannot do: it fetches URLs found **in comments** and
fails on a dead one, which catches *repealed* and *moved* (the NYC ZR 23-662
case). It does **not** catch a section amended in place, and it cannot test a
section-style citation at all — measured 2026-08-06, 3 fetchable URLs against 418
distinct section citations. A file that plainly cites things but yields no
checkable URL is reported UNCHECKED and the run's verdict is PARTIAL, never PASS.

---

## 4. Turn each caught error into an impossible state

Not a comment — a structure or a test that makes reintroduction fail (rule 14).
Raleigh's:

- A test asserting **no constant in 10–18 ft/story reproduces all three** of the
  `-3/-4/-5` rows. The Miami-21 round-trip is now arithmetically impossible to
  reintroduce here.
- A test asserting the R-1 68'/4 General Building figure is **absent** from
  `alternatives`.
- A test asserting an out-of-city point yields a gap, not an answer.
- In `feasibility.test.ts`: *"carries the STORY count through untouched — no
  ft/story conversion anywhere"*, which asserts the rendered check contains no
  `ft` or `feet` token at all.

Beware the inverse (rule 15): **a test that asserts absence encodes an
interpretation.** Four tests once asserted `parseMaxFAR('70% of Lot Area')`
returns null, with a well-written comment explaining it was lot coverage. The
interpretation was wrong, Philadelphia shipped at an assumed FAR 1.0 against real
figures of 0.70/1.50/3.50, and the suite *defended* the defect. When you write an
absence assertion, check the interpretation against the source, and say in the
comment which source and which section.

---

## 5. Wire config and routing

In order, all of these are required and each has a guard or a test that fails
without it:

| File | What to add | Enforced by |
|---|---|---|
| `src/types/parcel.ts` | `RALEIGH_BBOX` — **measured** from the zoning layer's extent | none directly; step 8's probe fails if it's wrong |
| `netlify/functions/lib/parcel.ts` | dispatcher row `raleigh: { bbox, label, provider }` | `getParcelInfo` returns a hard error for an unknown city — no silent Boston fallback |
| `src/config/cities.ts` | the `CITIES` entry: slug, labels, `live`, measured `center`/`landmark`, `zoom`, `bbox`, `permitName`/`permitUrl`, `tagline`, `zoningLayer` | `parkingRules.test.ts` fails on any city slug without a rule |
| `src/config/parkingRules.ts` | the parking rule, read from the code | same test, both directions (no orphan slugs either) |
| `src/config/estimates.ts` | `cityCostIndex` row | see step 7 |
| `scripts/null-inventory.ts` | the slug in `CITIES`, and the probe point in `EXTRA` | see step 6 |

Two details that are easy to get wrong:

- **`center` and `landmark` must be measured, not eyeballed.** Raleigh's are the
  midpoint of the DX (Downtown Mixed Use) districts' own extent, from
  `Planning/Zoning/MapServer/0` with `returnExtentOnly`.
- **`permitUrl` must be read, not guessed.** Raleigh's came from the department
  page's own `<link rel="canonical">`.
- **`zoningLayer` is gated by the CSP in `netlify.toml`, and the reason you omit
  it must be stated precisely.** Raleigh ships `zoningLayer: undefined` because
  `maps.raleighnc.gov` is not in the CSP `connect-src` (checked — the file
  contains no Raleigh host). That is a **CSP gap, not a CORS finding**: no
  cross-origin probe was run, so nothing is claimed about
  `Access-Control-Allow-Origin`. Denver's entry, by contrast, records an actual
  CORS probe run twice. Do not copy one city's reason onto another — disclosure
  copy is code, and a claim true in one file can be false in the next.

---

## 6. Choose a probe parcel — developable, and stability-checked

The probe is what the null inventory measures. A bad probe measures the probe.

**Choose it from a parcel query, not from a landmark.** Filter the parcel layer's
own attributes for an ordinary developable lot, then take **the polygon's own
centroid** — an address pin is what put the old Philadelphia probe off a parcel
edge. Raleigh's filter: `PLANNING_JURISDICTION = 'RA'` (Raleigh, not Cary or
Apex), `LAND_CLASS_DECODE = 'Residential Less Than 10 Acres'`, `TOTUNITS = 1`,
7,000–11,000 sq ft. Result: 810 Daniels St, R-6, 9,433 sq ft, parcel 1704142690,
privately owned, no historic/NCOD/TOD overlay, FEMA zone X, at
`35.79544, -78.65841`.

**Two properties are required, and both were learned by shipping the failure:**

1. **It must be DEVELOPABLE.** San Diego's and San Jose's old probes were civic
   land, so `analyze.ts` zeroed their hurdles and **neither city's regulatory
   encoding was exercised by the inventory at all.** Those rows measured a
   blocked parcel, not a city.
2. **It must be STABLE across repeated isolated calls.** A point inside
   *overlapping* parcel polygons returns an arbitrary feature — every candidate
   contains it, `nearestFeatureSet()` has no tiebreak, and the server's ordering
   decides. San Diego's old probe returned two parcelIds at lot sizes 97,106 /
   39,615 / 21,389 / 8,500 sq ft across four calls. **A single call always looks
   fine** (rule 18 again), so the symptom exists only in the comparison.

Verify stability **through `getParcelInfo`**, the real entry point, not the
provider. Raleigh's adoption check was two independent runs of four isolated
calls each, 400 ms apart — eight calls, every one returning parcelId 1704142690
and lot 9,433 sq ft. One distinct value, not "close enough".

Note the distinction between the two probe failures, because they look alike and
have opposite causes: Philadelphia's old point was **off any parcel** (unstable
`NO_PARCEL`); San Diego's was **on too many**.

**Guard:** `scripts/null-inventory.ts` runs `stability()` on every city on every
run (3 calls, 300 ms apart) and stamps `⚠️ PROBE UNSTABLE — this row is not
reproducible` into the generated table when the parcelId/lot-size set has more
than one member. Its `probe()` also retries up to 3× **in isolation** before
recording a failure — rule 10, from Chicago returning `Unknown` once under
concurrent batch load and resolving to `B3-2` on three consecutive isolated
re-probes.

---

## 7. Cost index, and what you must NOT put in `estimates.ts`

**`cityCostIndex`** — take the RSMeans **ZIP group**, not the city name. Raleigh
is 275-276 = 84.4 → `0.84`. Two safeguards:

- **Name collisions.** The comment on the Miami row exists because "Miami OK"
  (743) = 80.3 is a different city. Confirm the ZIP group, and confirm the name
  occurs where you expect ("RALEIGH" occurs exactly twice in the document, both
  in the North Carolina block).
- **Reconcile against known-good rows in the same pull before trusting it**
  (rule 16). Raleigh's extraction reproduced Nashville 89.0, Austin 82.9 and
  Miami 85.1 — values already committed — which is what establishes the
  extraction is reading the table this file was built from and not a lookalike.

**`lifecycleMonths` — do NOT add a row.** Raleigh has none, deliberately, and the
comment in the file says so at the point where a reader will look for it. What
was available was an *argument* (Southern metro, no state environmental-review
statute, fast Census SOC construction durations, therefore "about Nashville's
16/25/40"). That is a mechanism argued aloud, and rule 1 gives it **no direction
at all**, not a hedged one — and Nashville's own row is itself a peer-set
calibration, so copying it sideways makes the new number a derivative of a
derivative wearing the same font as Boston's.

> **What actually happened.** This is the step that did not go smoothly.
> Omitting the row **broke a passing test**, and the break was correct.
> `redTapeIndex.test.ts` asserted `expect(ranked).toHaveLength(CITIES.length)` —
> every live city is ranked. The two ways to make that pass again were to invent
> a duration (rule 1) or to drop Raleigh out of the table quietly (an absence
> rendering as a finding). Both are failures this repo has already recorded, so
> the **invariant was reformulated** instead: *every city is either RANKED or
> DISCLOSED, and never both*, cross-checked against `lifecycleMonths` in both
> directions, with a companion test proving the unranked list is derived from the
> constants rather than typed (hand it an empty lifecycle table and every city
> must come back disclosed).
>
> Expect this. **Adding an honest gap will break a test that assumed
> completeness**, and the fix is to reformulate the invariant, never to fill the
> gap.

Downstream, the omission carries itself: `lifecycleFallback` supplies the
timeline, `assumptionsSummary` branches on membership in `lifecycleMonths` and
says so in words, and `computeRedTapeIndex` omits the city rather than ranking it
on an invented duration.

**Guard:** `src/lib/redTapeIndex.test.ts` — ranked-or-disclosed, both directions,
plus "only disclosed-as-unranked cities are real registry slugs" so a typo cannot
excuse a genuine gap.

---

## 8. Verify through the REAL handler

Not the provider. Not the resolver. The `/api/analyze` handler, with the request
built the way the browser builds it:

```
getParcelInfo → buildDefaultSpec → the app's own toQuery() → handler
```

**Hand-rolling the query string is how the `gfaBasis` fail-closed guard shipped
dead for a day.** If you construct the query yourself, you are testing your
construction of it.

Run at least four real parcels spanning the district families the city actually
has. Raleigh's:

| Parcel | District | Verdict | Height check | Hurdles | Cost | Timeline |
|---|---|---|---|---|---|---|
| 810 Daniels St | `R-6` | AS_OF_RIGHT | 33 ft vs max 40 ft | 3 | $3,432,676 | 43 mo |
| 1133 Fuller St | `NX-3` | AS_OF_RIGHT | 33 ft vs max 50 ft | 3 | $2,709,075 | 43 mo |
| 122 Glenwood Ave | `DX-7-SH` | AS_OF_RIGHT | **6 stories vs max 7 stories** | 3 | $6,074,093 | 43 mo |
| 215 S McDowell St | `DX-40-SH` | PROHIBITED | 6 stories vs max 40 stories | 5 | $0 | 0 mo |

What to check in the output, beyond "it returned something":

- **The absence renders as an absence.** All four returned `farBasis:
  'unconstrained'`, `maxFAR: null`, and the `assumed-unconstrained` disclosure
  string — *"This district has NO floor-area ratio in the zoning code — size is
  governed by height, setbacks and lot coverage instead. Lot area is used as a
  placeholder here; it is not a code limit."* — never `assumed-far-1.0`.
- **A surprising verdict resolves to data or to a bug; decide which.** The
  `DX-40-SH` `PROHIBITED` is the data: the parcel holds ~306 existing homes and
  the default spec proposes 102, firing the generic no-net-loss check.
- **Cross-check one number by ratio, not by sum** (rule 2). 9,500 sf × $340 ×
  0.84 = $2,713,200 = the returned hard cost exactly, which is what confirms the
  city cost index actually flows through rather than only being displayed. A sum
  would not have discriminated that.

> **What actually happened — a shared-code change was unavoidable.** Raleigh is
> the first city whose code states a **story count and no feet** for a whole band
> of districts (`-7` and above: Sec. 3.3.2 row A1 states 7/12/20/30/40 stories,
> row A2 is blank). Run through the handler as originally written, `DX-7-SH` and
> `DX-40-SH` printed *"No district height limit is available in public data"* and
> reported `envelopeKnown: false` — **the tool disclaiming knowledge it
> demonstrably had**, over districts whose limit the ordinance states outright.
>
> `netlify/functions/lib/feasibility.ts` gained three branches and six tests:
> stories-vs-stories compared directly (never via feet — that is the Miami
> round-trip), a distinct `INDETERMINATE` for *the limit is known, just in
> another unit* with copy that says so, and `statedStories` now counting toward
> `envelopeKnown`. The middle one is rule 5 one notch finer: an absence and a gap
> must not look alike, and **neither may a published limit we declined to
> convert**.
>
> The lesson for the next city: **the provider stage can be self-contained; the
> wiring stage may not be.** Do not treat a required change to shared feasibility
> logic as scope creep — treat a *city-specific* branch in shared logic as the
> thing to avoid.

**Guard:** `npm test` (Raleigh's wire stage: 60 files, 1401 tests, up from
60/1393), `npm run lint`, `npx tsc -b`.

---

## 9. Run the null inventory

```
npx vite-node scripts/null-inventory.ts            # print
npx vite-node scripts/null-inventory.ts --write    # rewrite docs/NULL-INVENTORY.md
```

Raleigh's row:

```
| raleigh | `R-6` | **UNCONSTRAINED (an answer)** | AS_OF_RIGHT | code affirmatively imposes no FAR; lot area is a placeholder |
```

`UNCONSTRAINED (an answer)` and `GAP — verdict withheld` are different outcomes
and must not be confused. A new city landing on `GAP` is not a failure — it is
the honest state until someone reads the code. A new city landing on
`UNCONSTRAINED` **without** a slot-test argument written into the zoning module
is a rule-5 violation wearing a green result.

**This file, not the test count, is the artifact that says whether the tool is
fit to ship.** The tests pass identically whether a city resolves a FAR or
assumes one.

---

## 10. What NOT to claim yet — and the guards that stop you

A new city is **not** entitled to any of these on the day it goes live. Each has
a published coverage list and a test that reads the list back out of the code, so
the failure mode is a red suite rather than a quiet false claim.

### City-specific hurdles

**Do not add the slug to `CITIES_WITH_SPECIFIC_HURDLES`.** Raleigh is not in it,
so it gets the generic set only — historic review, flood, permit fees,
demolition — which is why the four probes above show 3 hurdles and not more. That
list is a **floor**, not an account of what the city requires, and the disclaimer
in `analyze.ts` says so and names Raleigh as the current exception.

*Why it matters:* Compare renders "Approvals to clear" as a bare count side by
side. An unencoded city reads as a *less regulated* city — a coverage artifact
presented as a finding about the world, in the direction that flatters the tool.

**Guard:** `netlify/functions/lib/hurdles.test.ts` reads the `city === '…'`
branches out of `hurdles.ts` and asserts the set equals
`CITIES_WITH_SPECIFIC_HURDLES` exactly. Encoding hurdles without updating the
list fails the suite; so does the reverse, which is worse.

Before encoding any hurdle later, note the standing defect classes found by
audit: gates that over-fire (a lot-area threshold standing in for DC's
*disturbed*-area trigger), gates that under-fire, and **disclosure copy that
over-claims while the condition is correct** — Miami's DRI fee note dropped its
source's opening exception. Disclosure copy is code.

### Measured permit timing

**Do not add the slug to `CITIES_WITH_MEASURED_PERMITS`,** and do not write a
`scripts/permits/<city>.mjs` result into `permitStats.json` until the city
publishes a real **application** date.

Establish that by the slot test: does the schema have a slot for a filing date?
Four cities (Boston, DC, Minneapolis, San Jose) publish only issue-side dates,
and every tempting substitute was tested and rejected — DC's `CREATED_DATE` is an
identical ETL stamp on every row; Minneapolis's `completeDate` falls after
`issueDate` in 409 of 409 sampled records; San Jose's `FINALDATE` is final
inspection.

Then check the **cohort**, not just the filter: `chicago`, `la`, `sandiego` and
`sf` were all published and then withdrawn. SF's withdrawal is the sharpest —
only 37.7% of new-construction filings since 2022 ever issue, and when most
filings never issue the unconditional median **does not exist**; a "floor" label
cannot rescue an undefined statistic, it only makes an absent number look
cautious.

**Guard:** `netlify/functions/lib/timeline.test.ts` asserts
`CITIES_WITH_MEASURED_PERMITS` equals exactly the set of cities carrying a
`newConstruction` measurement in `permitStats.json`, plus a per-city assertion
that the four issue-side-only cities stay unmeasured.

### A lifecycle duration

Covered in step 7. **Guard:** `src/lib/redTapeIndex.test.ts`.

---

## Known traps, from this repo's ledger

Every one of these shipped, or nearly shipped, in a city already in the tool.
Check each explicitly for the new city; do not wait to be surprised.

| Trap | Where it bit | How to check |
|---|---|---|
| **A zoning layer that matches zero parcels** | Minneapolis Ch. 546 — an encoded chapter that would have matched no parcel at all | Point-query the layer at real addresses and read returned values. A live field-value query, not a field list. Pin superseded codes with a test asserting they resolve to nothing |
| **A cited section that was repealed** | NYC ZR 23-662 — City of Yes repealed it 2024-12-05, moving Quality Housing heights to 23-432; nine published heights cited a section that no longer existed, and the URL had 404'd ever since | `scripts/check-citations.ts --strict`. It catches repealed and moved; it does **not** catch amended-in-place, which still needs a human reading the source |
| **A per-use FAR table collapsed to one number** | Detroit and Austin — Austin allows 0.40 single-family **or** 0.65 for three units; reporting the larger assumes a program the user never chose, and it flows into unit counts, fees and hurdles | Keep the per-use structure. Publish the lowest common program as the headline and put the rest in `alternatives` (rule 6) |
| **Heights derived through a per-story constant** | Denver (fabricated heights) and Miami 21 (80 stories × 12 ft, then ÷ 11 ft → **87 stories published for a code that says 80**) | Carry the unit the code prints. Never round-trip. Raleigh proves the constant cannot exist — 16.67 / 17.00 / 16.00 across three adjacent columns — and a test pins it (rule 12) |
| **A field name that isn't what it looks like** | Miami's `FLR` is a letter suffix, not a floor-lot ratio | Query live field **values**, not the schema |
| **A permit filter admitting sub-permits or certificates of occupancy** | NYC (~2× overstatement on a perfectly reasonable-looking 8.3 months) and Boston — `scripts/permits/boston.mjs` admits COs as new construction, 54% of what it selects, and has never emitted a wrong number only because a missing date field halted it first | Enumerate what the filter selects and inspect a sample. **Code that did not run is not code that works** |
| **A probe coordinate on civic land or overlapping polygons** | San Diego (Horton Plaza — city-owned, overlapping ownership polygons, four calls → two parcelIds at four lot sizes) and San Jose (a PQP public/quasi-public lot). Both non-developable, so both rows measured a blocked parcel rather than a city | Step 6: pick from a parcel query, take the polygon centroid, require developable, verify stability over repeated isolated calls through `getParcelInfo` |
| **A stale-data disclaimer naming the wrong direction** | recorded as rule 7 — worse than no disclaimer, because the reader corrects into the error | Re-read every disclaimer string in the context it now lands in. Never move explanatory copy between cities without re-checking it |

---

## The short version

1. Point-query every endpoint at real addresses; write down what came back.
2. Write the provider from the closest existing one; fixtures are verbatim
   captures; tests drive the exported entry point.
3. Read the official consolidated code. Treat the scout's summary as an input to
   check — four of Raleigh's claims were wrong.
4. Convert each caught error into a test or a structure.
5. Wire bbox → dispatcher → `CITIES` → parking → cost index → probe.
6. Pick a developable probe from a parcel query; verify stability over repeated
   isolated calls.
7. Cost index from the ZIP group, reconciled against known-good rows. **No
   lifecycle row without a measurement** — expect that to break a test, and
   reformulate the invariant rather than fill the gap.
8. Verify through `/api/analyze` with a browser-shaped query. Cross-check one
   number by ratio.
9. Regenerate the null inventory and read the row.
10. Claim no city-specific hurdles and no measured permits. The lists are guarded
    in both directions.
