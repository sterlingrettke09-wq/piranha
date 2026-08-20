# ADU state-preemption survey — the eighteen unread cities

Begun 2026-08-19, continued 2026-08-20. **This file is documentation, not data the
engine reads.** Nothing here is wired into `netlify/functions/lib/zoning/adu.ts`,
and that is deliberate: the sixteen jurisdictions behind the eighteen cities state
their rules in at least eight structurally different forms, and encoding them into
a type shaped for California would convert several of them into figures they are
not (rule 18 — a plausible answer in the right units gets less scrutiny than a
gap). **The type redesign happens once, after this survey is complete.**

## Why this pass exists before any ordinance is read

The precondition that governed the first five cities governs here unchanged:
**establish whether the binding rule is local or state before encoding anything.**
Reading a city ordinance and publishing its cap is wrong wherever a statute above
it sets a floor the city may not go below.

Eighteen cities sit in sixteen jurisdictions: AZ, CO, DC, FL, GA, IL, MA, MN, NC
(×2 cities), NV, NY, OH, PA, TN, TX (×2 cities), WI.

## Status — 11 of 16 established, 13 of 18 cities have a determined state layer

| jurisdiction | city | preempts? | instrument | basis |
|---|---|---|---|---|
| AZ | phoenix | **yes** | A.R.S. § 9-461.18 | statute text |
| CO | denver | **yes** | C.R.S. tit. 29 art. 35 | session law — see caveat |
| MA | boston | **yes — process only** | M.G.L. c. 40A § 3 | statute text |
| NV | lasvegas | **yes** | NRS 278.257, **eff. 2026-07-01** | statute text |
| FL | miami | **no — enabling only** | F.S. § 163.31771 | statute text |
| NC | charlotte, raleigh | **no** | G.S. ch. 160D, whole chapter read | 494 KB, 0 hits |
| TX | austin, dallas | **no, in scope read** | LGC ch. 211, 214, 218 | rendered text, 0 hits |
| OH | columbus | **no** | R.C. ch. 713, full text | 61 KB, 0 hits |
| WI | milwaukee | **no, in scope read** | Wis. Stat. ch. 66, titled index | 0 hits |
| MN | minneapolis | **no, in scope read** | Minn. Stat. ch. 462, titled index | 0 hits |
| DC | dc | **no — zoning is delegated** | DC Code tit. 6 ch. 6 | index, 0 hits |
| GA | atlanta | — | — | **not established** |
| IL | chicago | — | — | **not established** |
| NY | nyc | — | — | **not established** |
| PA | philadelphia | — | — | **not established** |
| TN | nashville | — | — | **not established** |

**⚠️ "Not established" means nobody has looked, not that the state has no statute.**

---

## ⚠️ Two instrument failures caught, and both would have published false absences

Recorded because in both cases the wrong answer was *already in hand* and looked
like a finding.

**Texas — curl returns a JS shell.** Five Local Government Code chapters were
fetched with curl and greped for "accessory dwelling": five zeros. All five files
were **exactly 250,874 bytes with identical MD5s**, and the payload was the site's
navigation shell, not statute text. The chapters had to be re-read in the browser,
where they render correctly. The five zeros described the instrument.

**Illinois — the server ignores query parameters.** A request for Art. 11 Div. 13
(the zoning division) returned **exactly 232,042 bytes, byte-identical to the
article-level index** already fetched. Illinois is therefore *not* established, and
the 0 hits from that fetch mean nothing.

Both were caught by the same cheap check: **a suspicious byte count, compared
across requests that should have differed.** Neither was caught by the exit code,
which was 0 in every case, nor by the HTTP status, which was 200. This is rule 11
and rule 22 in the same session — the transport succeeded and the payload was not
what was asked for.

A third, milder case: Minnesota § 462.357 was fetched and contains no ADU text,
but that section number was a **guess**, so it disproves the guess and says nothing
about Minnesota (rule 8). It was discarded rather than recorded as an absence. The
Minnesota result in the table above rests on the chapter 462 titled index instead.

---

## The five that preempt

### AZ — A.R.S. § 9-461.18

Found by reading the Title 9 section index, not by guessing a number. **Applies to
municipalities over 75,000 population (H)** — Phoenix qualifies.

A municipality **shall** adopt regulations allowing, on any lot where a
single-family dwelling is allowed: at least **one attached and one detached** ADU
as a permitted use (A)(1); one **additional** detached ADU on ≥1 acre where at
least one ADU is restricted-affordable (A)(2); and an ADU of **75% of the primary
dwelling's gross floor area, or 1,000 sq ft, whichever is LESS** (A)(3).

It **may not** require a familial relationship (B)(2), additional parking or fees
in lieu (B)(3), matching exterior design or roof pitch (B)(4), **height, setback,
lot size, coverage or frontage more restrictive than for single-family dwellings
in the same zone** (B)(5), rear or side setbacks more than **5 feet** (B)(6),
public street improvements except to repair construction damage (B)(7), or a
restrictive covenant (B)(8). It may not require a commercial building code or a
fire sprinkler (D).

**(F) is the sanction and it is severe:** a municipality that failed to adopt
regulations by **2025-01-01** must allow ADUs on all residentially zoned lots
**without limits**. Whether Phoenix adopted in time determines which regime
applies and **is not established here.**

Excluded (G): tribal land; the vicinity of a military airport; certain airports
above 65 dB.

### CO — C.R.S. title 29, article 35 (§§ 29-35-101 to 29-35-105)

Added by HB24-1152. Obligations attach **on or after 2025-06-30**. A **subject
jurisdiction** is a municipality of ≥1,000 population within an MPO area, or the
portion of a county both within a census-designated place of ≥40,000 and within an
MPO area. Denver is within DRCOG, but **confirming Denver against the statute's own
test is a step this survey has not taken** and must not be assumed from size.

Colorado states no floors. It **prohibits "restrictive design or dimension
standards"**, defined to include a local law that requires more restrictive
architecture or materials than for a single-unit detached dwelling (a); **does not
allow for ADU sizes between 500 and 750 sq ft** (b); requires side setbacks larger
than the primary dwelling's (c); requires a rear setback larger than the greater of
other accessory buildings' or **5 feet** (d); applies a more restrictive minimum lot
size (e); or treats factory-built ADUs more restrictively (f).

**⚠️ Two size numbers in one act, doing different jobs.** The mandate is the
**500–750** band. A separate **500–800** figure belongs to the act's list of actions
qualifying a local government as a *supportive jurisdiction* — an optional incentive
tier. Conflating them publishes the incentive number as the mandate.

**⚠️ And the band is not a floor.** "Does not allow for ADU sizes between 500 and
750" bars a local law that *excludes* that band. It plainly bars a cap at 400 and
plainly permits a cap at 750 or more. **Whether a cap at 600 complies is not
resolved by the text** — such a law does allow some sizes in the band. No figure is
publishable for Colorado without a source that settles it, and none has been found.
Reading it as a 750 floor would be an invented conversion (rule 4). Same class as
the San José 50% question.

**Caveat:** the text read was the **session law** (HB24-1152 as enacted), not the
codified CRS. That is the Los Angeles exposure exactly — enacted text and current
codified law are different instruments. The codified article must be read before
anything is encoded.

### MA — M.G.L. c. 40A § 3, the accessory-dwelling-unit paragraph

Massachusetts preempts **process, not dimensions**, and says so expressly.

No zoning ordinance shall prohibit, unreasonably restrict, or require a special
permit or other discretionary approval for **a single ADU**, or its rental, **in a
single-family residential zoning district**. Provided that it **may** be subject to
reasonable regulations expressly including 310 CMR 15.000, site plan review,
**"regulations concerning dimensional setbacks and the bulk and height of
structures"**, and short-term-rental restrictions.

Owner occupancy of neither unit may be required. Not more than **1** additional
parking space may be required — and **none** where the ADU is within **0.5 miles**
of a commuter rail station, subway station, ferry terminal or bus station. **More
than one** ADU may be made to require a special permit.

The Executive Office of Housing and Livable Communities may issue guidelines or
regulations administering the paragraph — **not read**, and it may carry operative
detail.

### NV — NRS 278.257, effective 2026-07-01

The newest instrument in the survey, in force seven weeks. Added by 2025 Nev.
Stats. p. 2376. **Applies to counties ≥100,000 and cities ≥60,000** — Las Vegas
qualifies.

The governing body **shall adopt an ordinance** authorising ADU development and use
on property zoned single-family residential. The ordinance **must not**: prohibit
separate kitchen facilities (2)(a); require more than one additional parking space
where existing and street parking meet anticipated need (2)(b); require **side or
rear setbacks more restrictive than for the primary residence** (2)(c); require
public street improvements except to repair construction damage or for health and
safety (2)(d); or prohibit use as rental housing — though it **may** prohibit
transient lodging (2)(e). An approved ADU need not meet commercial building code,
including sprinkler requirements (3)(b).

**(4)(b) is a ceiling on the statute, not a floor:** nothing in the section
authorises more than **two** ADUs on any residential property. **(5)** disapplies
the section in a region with an interstate-compact regional planning agency whose
regional plan regulates housing — the Tahoe carve-out, not relevant to Las Vegas.

**⚠️ Nevada states no size figure and no height figure.** Subsection 2 is a list of
conditions the ordinance may not impose, it is filled with six items, and size and
height are not among them. That is the slot test returning a structural answer
rather than a failed search.

---

## The six that do not

**FL — § 163.31771 "Accessory dwelling units" exists and expressly declines to
preempt.** Subsection (3): "A local government **may** adopt an ordinance to allow
accessory dwelling units in any area zoned for single-family residential use."
Enabling, not mandating; no standards are imposed on the city. A building permit
application for an ADU allowed under such an ordinance must carry an affidavit that
the unit will be rented at an affordable rate (4). This is an **answer** — the
statute has the slot and fills it with permission — not an absence.

**NC — G.S. ch. 160D, "Local Planning and Development Regulation".** The entire
enabling chapter was read as rendered text (494,602 characters) and contains **zero**
occurrences of "accessory dwelling". Charlotte and Raleigh are governed locally.

**TX — LGC ch. 211, 214, 218.** Zero in each, read in the browser after the curl
failure above. Chapter 211 carries the legislature's recent subchapter of limits on
municipal zoning (§§ 211.051–211.058, minimum lot sizes) and has no ADU section —
the slot exists and is empty. **Scope stated rather than absolute:** three chapters
were read, not the whole code.

**OH — R.C. ch. 713.** Full section text, zero hits.

**WI — Wis. Stat. ch. 66** (General Municipality Law), titled index, zero hits.
**Scope caveat:** ch. 62.23, the city planning and zoning section, was not read.

**MN — Minn. Stat. ch. 462** (Housing, Redevelopment, Planning, Zoning), titled
index of 208 sections, zero hits.

**DC — DC Code tit. 6 ch. 6** ("Zoning and Height of Buildings"), six subchapters,
no ADU provision. DC zoning is delegated to the Zoning Commission and lives in
11 DCMR, which is the *local* instrument. DC has no legislature above it for this
purpose, so the state/local question resolves differently here than anywhere else
in the set.

---

## What the survey has already established about the TYPE

Eight distinct shapes across the jurisdictions resolved so far. `StateFloorLayer`
and `null` express two of them.

| shape | jurisdictions |
|---|---|
| numeric floors | CA, WA |
| a floor that is **not a constant** — `min(75% × primary GFA, 1000)` | AZ |
| a **band that may not be excluded**, which is not a floor | CO |
| **process preempted, dimensions expressly reserved** to the city | MA |
| **process preempted, dimensions not addressed** (slot filled, size/height absent from it) | NV |
| a statute that **exists and declines to preempt** | FL |
| **no provision in the scope read** | NC, TX, OH, WI, MN, DC |
| **not established** | GA, IL, NY, PA, TN |

Two of these need saying plainly because they are easy to collapse and must not be:

- **FL's "no" is an answer; NC/TX/OH/WI/MN's "no" is an absence within a read
  scope; GA/IL/NY/PA/TN's "no" does not exist yet.** Three different things that a
  single `stateFloor: null` renders identically today — rule 5 at the state layer.
- **MA's silence on dimensions is express; Nevada's is structural.** MA states that
  bulk and height remain the municipality's; Nevada simply omits them from a list
  of prohibited conditions. Both leave the city free, but the evidentiary basis
  differs and a reader deserves to know which one they have.

### The AZ/SF opposition, kept

The same two ingredients, opposite operator:

| | rule | effect |
|---|---|---|
| SF § 207.2(d) | 50% of primary **or 850 sq ft, whichever is GREATER** | a ratio **floored** by a figure |
| AZ § 9-461.18(A)(3) | 75% of primary **or 1,000 sq ft, whichever is LESS** | a ratio **capped** by a figure |

Publishing 1,000 for Phoenix overstates on any primary dwelling under 1,333 sq ft.

## Next

Five jurisdictions remain: **GA, IL, NY, PA, TN.** Illinois and New York both
resisted automated fetching in ways that produced false-looking zeros, so both need
the browser and careful byte checks. Georgia and Tennessee publish through
LexisNexis, which has not been attempted. Pennsylvania's Municipalities Planning
Code text was not reached — and Philadelphia is a first-class city, which may be
excluded from the MPC entirely, so that question has two parts.
