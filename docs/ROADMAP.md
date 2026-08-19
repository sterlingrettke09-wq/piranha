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
| 1 | **Atlanta SPI** | DECIDED 2026-08-17 | IN PROGRESS |
| 1 | **San Diego** | DECIDED 2026-08-17 | NOT STARTED |
| 2 | **Cost-data access** | **OPEN — blocked on Sterling** | BLOCKED |
| 3 | ~~Permit timing~~ | DECIDED 2026-08-17 | **DONE 2026-08-18** — see Superseded |
| 4 | **Parcel-weighted coverage** | DECIDED 2026-08-17 | NOT STARTED |
| 5 | **Map-layer asks** | DECIDED 2026-08-17 | NOT STARTED |
| 6 | **More cities** | DECIDED 2026-08-17, deliberately last | NOT STARTED |

**Atlanta SPI** — method solved (`scripts/municodeGrid.py`); SPI-16, 20 and 21
read in full and recorded row-by-row in `netlify/functions/lib/zoning/atlanta.ts`;
the types are built (`AtlantaSubareaFar`, `basis-elective`, `parseAtlantaFarCell`,
`atlantaFarFor`). What remains is the encoding pass itself, then ~15 further
chapters, which cell-level refusal makes mechanical.

**San Diego** — Carmel Valley (20 codes), Central Urbanized (13), Old Town (15),
Table 131-05D (CR/CO/CV/CP), Division 2 open space, three La Jolla sub-areas.
78 sweep gaps, the largest readable block in the city.

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

Both "yes" answers depend on cost-data access above. Nothing here is billable
while the cost basis is unsourced.

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
