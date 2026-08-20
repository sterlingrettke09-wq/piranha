# ADU state-preemption survey — the eighteen unread cities

Started 2026-08-19. **This file is documentation, not data the engine reads.**
Nothing here is wired into `netlify/functions/lib/zoning/adu.ts` yet, and that is
deliberate: three of the first three states surveyed state their floors in forms
`StateFloorLayer` cannot hold, and encoding them into a type that fits California
would silently convert them into figures they are not (rule 18 — a plausible
answer in the right units gets less scrutiny than a gap).

## Why this pass exists before any ordinance is read

The precondition set for the first five cities applies unchanged here: **establish
whether the binding rule is local or state before encoding anything.** For ADUs
that is not a formality. Reading a city ordinance and publishing its cap is wrong
wherever a statute above it sets a floor the city may not go below.

Eighteen cities sit in sixteen jurisdictions: GA, TX (×2), MA, NC (×2), IL, OH,
DC, CO, NV, FL, WI, MN, TN, NY, PA, AZ.

## Status

| state | city | preempts? | instrument | established |
|---|---|---|---|---|
| AZ | phoenix | **yes** | A.R.S. § 9-461.18 | ✓ 2026-08-19, statute text |
| CO | denver | **yes** | C.R.S. tit. 29 art. 35 (§§ 29-35-101–105) | ✓ 2026-08-19, session law — see caveat |
| MA | boston | **yes, process only** | M.G.L. c. 40A § 3 | ✓ 2026-08-19, statute text |
| GA | atlanta | — | — | **not established** |
| TX | austin, dallas | — | — | **not established** |
| NC | charlotte, raleigh | — | — | **not established** |
| IL | chicago | — | — | **not established** |
| OH | columbus | — | — | **not established** |
| DC | dc | — | — | **not established** |
| NV | lasvegas | — | — | **not established** |
| FL | miami | — | — | **not established** |
| WI | milwaukee | — | — | **not established** |
| MN | minneapolis | — | — | **not established** |
| TN | nashville | — | — | **not established** |
| NY | nyc | — | — | **not established** |
| PA | philadelphia | — | — | **not established** |

**⚠️ "Not established" means nobody has looked, not that the state has no statute.**
Thirteen of sixteen. One negative result was recorded and then discarded as
worthless: Minnesota § 462.357 was fetched and contains no ADU text, but that
section was a GUESS, so it proves the guess wrong and nothing about Minnesota
(rule 8). The Revisor's full-text search does not execute from URL parameters and
needs its form driven; that is the next step for MN.

---

## AZ — A.R.S. § 9-461.18, "Accessory dwelling units; regulation; applicability; definitions"

Found by reading the Title 9 section index, not by guessing a number.
**Applies to municipalities over 75,000 population (H)** — Phoenix qualifies.

A municipality **shall** adopt regulations allowing, on any lot where a
single-family dwelling is allowed:

- (A)(1) at least **one attached and one detached** ADU as a *permitted use*
- (A)(2) one **additional** detached ADU on a lot of 1 acre or more, if at least
  one ADU on the lot is a restricted-affordable dwelling unit
- (A)(3) an ADU that is **75% of the gross floor area of the single-family
  dwelling, or 1,000 sq ft, whichever is LESS**

A municipality **may not**: prohibit long-term rental or its advertisement (B)(1);
require a familial/marital/employment relationship (B)(2); require additional
parking or fees in lieu (B)(3); require exterior design, roof pitch or material to
match the primary (B)(4); **set height, setback, lot size, coverage or frontage
restrictions more restrictive than for single-family dwellings in the same zone**
(B)(5); set rear or side setbacks more than **5 feet** from the property line
(B)(6); require public street improvements except to repair construction damage
(B)(7); require a restrictive covenant (B)(8). It may not require compliance with a
commercial building code or a fire sprinkler (D).

**(F) is the sanction, and it is severe:** a municipality that failed to adopt
regulations by **2025-01-01** must allow ADUs on all residentially zoned lots
**without limits**. Whether Phoenix adopted in time is a fact about Phoenix and is
not established here — but it determines which regime applies, so it must be
answered before Phoenix is encoded.

Excluded (G): tribal land; the vicinity of a military airport or ancillary
facility; the vicinity of certain licensed or public airports above 65 dB.

### ⚠️ Why this does not fit the current type

`AduFloor` is `{ value: number, condition, cite }`. Arizona's size floor is
`min(0.75 × primary gross floor area, 1000)` — **a function of a parcel-specific
input, not a constant.** And its height floor is not a figure at all: (B)(5) sets
height by *parity* with single-family in the same zone, which resolves only
against the base zone this engine already computes.

Note the direction. California's SF drafting was "50% … or 850 sq ft, whichever is
**greater**" — a ratio floored by a figure. Arizona's is "75% … or 1,000 sq ft,
whichever is **less**" — a ratio *capped* by a figure. Same two ingredients,
opposite operator, opposite effect on a small primary dwelling. Publishing 1,000
for Arizona would overstate on every lot whose primary is under ~1,333 sq ft.

---

## CO — C.R.S. title 29, article 35 (§§ 29-35-101 to 29-35-105)

Added by HB24-1152, "Concerning increasing the number of accessory dwelling
units". Obligations attach **on or after 2025-06-30**.

**Subject jurisdiction** = a municipality with population ≥1,000 within the area of
a metropolitan planning organization; or the portion of a county both within a
census-designated place of ≥40,000 and within an MPO area. Denver is within
DRCOG — but confirming Denver's status against the statute's own test is a step
this survey has not taken, and it should not be assumed from size.

A subject jurisdiction must allow, subject to an **administrative** approval
process, one ADU as an accessory use to a single-unit detached dwelling anywhere
it allows single-unit detached dwellings.

Colorado does not state floors. It **prohibits "restrictive design or dimension
standards"**, defined as a local law that:

- (a) requires architectural style, building material or landscaping more
  restrictive for an ADU than for a single-unit detached dwelling in the same zone
- (b) **does not allow for ADU sizes between 500 and 750 sq ft**
- (c) requires side setbacks larger than those for a primary dwelling in the same
  zone
- (d) requires a rear setback larger than the **greater** of the rear setback for
  other accessory building types in the same zone, or **5 feet**
- (e) applies a more restrictive minimum lot size to an ADU than to a single-unit
  detached dwelling
- (f) applies more restrictive aesthetic or dimensional standards to factory-built
  ADUs than to other accessory structures

### ⚠️ Two different size numbers in one act, doing different jobs

The mandate is the **500–750** band in (b). A separate **500–800** figure appears
in the act's list of actions qualifying a local government as a *supportive
jurisdiction* — an optional incentive tier, not the baseline obligation.

Conflating them would publish the incentive tier's number as the mandate. This is
rule 6's shape inside a single statute: two alternatives, and the larger belongs
to a programme the jurisdiction has not necessarily elected.

### ⚠️ And the band is not a floor

"Does not allow for ADU sizes between 500 and 750 sq ft" bars a local law that
*excludes* that band. It plainly bars a cap at 400. It plainly permits a cap at
750 or above. **Whether a cap at 600 complies is not resolved by the text** — such
a law does allow *some* sizes in the band. No figure should be published for
Colorado without a source that settles this, and none has been found. Reading it
as a 750 floor would be an invented conversion (rule 4).

### Caveat on what was read

The text above is the **session law** (HB24-1152 as enacted), not the codified
CRS. That is the same class of exposure as the Los Angeles finding: the enacted
text and current codified law are different instruments, and amendments since 2024
would not appear. The codified article must be read before anything is encoded.

---

## MA — M.G.L. c. 40A § 3, the accessory-dwelling-unit paragraph

Read from the live section text. Massachusetts preempts **process, not
dimensions**, and says so expressly.

No zoning ordinance or by-law shall prohibit, unreasonably restrict, or require a
special permit or other discretionary zoning approval for **a single accessory
dwelling unit**, or its rental, **in a single-family residential zoning district**.

Provided that such an ADU **may** be subject to reasonable regulations, expressly
including 310 CMR 15.000 (Title 5) where applicable, site plan review,
**"regulations concerning dimensional setbacks and the bulk and height of
structures"**, and short-term-rental restrictions.

- Owner occupancy of neither unit may be required.
- Not more than **1** additional parking space may be required — and **none** where
  the ADU is within **0.5 miles** of a commuter rail station, subway station, ferry
  terminal or bus station.
- **More than one** ADU in a single-family district may be made to require a
  special permit.
- The Executive Office of Housing and Livable Communities may issue guidelines or
  regulations administering the paragraph — **not read**, and it may carry
  operative detail.

### ⚠️ A third shape: express reservation

Massachusetts states **no size figure at all**, and this is an answer rather than a
gap — the statute has a slot for dimensional standards and uses it to hand them
back to the municipality. So for Boston the binding size and height rules are
Boston's own, and the state layer contributes count, process and parking only.

That is neither a numeric floor (CA, WA) nor a non-numeric one (AZ, CO). It is a
statute that preempts one axis and expressly declines another, and the type has no
way to say "preempted on process, reserved on dimension".

---

## What the survey has already established about the TYPE

Five states now, five shapes. The user's prediction after the first five cities —
that the type was fitted to whatever had been read at the time, and the eighteen
would force the same — is confirmed at the **state** layer before a single one of
the eighteen ordinances has been opened.

| state | size floor | height floor |
|---|---|---|
| CA | constants (850 / 1,000 / 800) | constants (16 / 18 / 18 / 25) |
| WA | constant (1,000) | constant (24) |
| AZ | `min(75% × primary GFA, 1000)` — **not a constant** | **parity** with single-family, no figure |
| CO | a 500–750 band that may not be excluded — **not a floor** | **none stated** |
| MA | **expressly reserved to the city** | **expressly reserved to the city** |

`StateFloorLayer.floors` assumes `AduFloor { value: number }` throughout. It can
express two of the five. The redesign should happen **once**, after the survey is
complete, rather than five times as each state arrives — which is why nothing here
is encoded yet.
