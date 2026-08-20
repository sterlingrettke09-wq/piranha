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

## Status — COMPLETE. 16 of 16 established, all 18 cities have a determined state layer

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
| IL | chicago | **no** | 65 ILCS 5/11-13 (Div. 13, Zoning) | rendered text, 0 hits |
| NY | nyc | **no** | Gen. City Law art. 5-A | 7 sections, 0 hits |
| PA | philadelphia | **no — and the MPC does not reach Philadelphia** | Act 247 of 1968 | 398 KB, 0 hits |
| GA | atlanta | **no** | the **entire** OCGA | whole-code search, 0 hits, positive control 370 |
| TN | nashville | **no** | the **entire** Tennessee Code | whole-code search, 0 hits, positive control 235 |

**Four preempt** (AZ, CO, MA, NV). **Twelve do not**, of which Florida's is an
express legislative "may" and Pennsylvania's resolves on scope. None is unlooked-at.

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
article-level index** already fetched, so the 0 hits from that fetch meant nothing.
Illinois was closed the next day by a different route (clicking the index's own
link), and the length changing 19,259 → 64,113 is what proved a different page had
finally been served.

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

## The four that preempt

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

### MA — M.G.L. c. 40A §§ 1A and 3

**⚠️ Corrected 2026-08-20.** This entry originally described Massachusetts as
setting out no ADU size whatever, on a reading that covered only § 3. That was
wrong: **the figure is in the definition, not the operative section.**

§ 1A defines an accessory dwelling unit as one *"not larger in gross floor area
than 1/2 the gross floor area of the principal dwelling or 900 square feet,
whichever is smaller"* — and § 3 then grants the by-right use to that defined
term. Reading the section that confers the right, and not the section that
defines what the right attaches to, produced a confident absence.

**⚠️ And the figure runs the opposite way from every other number in this
survey.** It is not a floor. It is the ceiling of the *protected category*: a
unit above it is not an ADU for the Act's purposes and gets no by-right
protection, though nothing prohibits a municipality allowing it under its own
zoning. § 1A(iii) then expressly permits a municipality to impose *additional*
size restrictions, bounded only by not "unreasonably restrict[ing] the creation
or rental" of a non-short-term-rental ADU. So Massachusetts guarantees no size,
and recording min(50%, 900) as a floor would assert a right the statute does not
confer.

Massachusetts preempts **process**, and reserves dimensions to the municipality.

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

## The ten that do not

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

### The ratio family — five draftings, five operators, none publishable

The same two ingredients — a percentage of the principal dwelling and a
square-foot figure — recombined differently by every jurisdiction that uses them.
This began as an AZ/SF opposition and has not stopped growing, so it is now the
expected result rather than a surprise.

| | rule | shape |
|---|---|---|
| SF § 207.2(d) | 50% of primary **or 850 sq ft, whichever is GREATER** | a ratio **floored** by a figure |
| AZ § 9-461.18(A)(3) | 75% of primary **or 1,000 sq ft, whichever is LESS** | a ratio **capped** by a figure |
| Phoenix ZO § 706.A.8 | 75% of primary **AND** a lot-size figure | **both limbs bind** — the answer is their minimum |
| LVMC 19.12.070 | **100%** — may equal the primary, not exceed it | a **parity** cap |
| MA c. 40A § 1A(ii) | 50% of principal **or 900 sq ft, whichever is SMALLER** | a **ceiling on the protected category**, not a floor |

**Not one of the five yields a number without a parcel input**, and the two that
look most alike — Arizona's and Massachusetts' — point in opposite directions:
Arizona's is the minimum a city must allow, Massachusetts' is the maximum the
by-right protection reaches. Publishing 1,000 for Phoenix overstates on any
primary under 1,333 sq ft; publishing 900 for Boston would assert a guarantee
that does not exist.

**The operating assumption is now that the next jurisdiction drafts it a sixth
way.**

## The three closed on 2026-08-20

**IL — 65 ILCS 5/11-13, Division 13 (Zoning) of the Illinois Municipal Code.**
Reached by clicking the index's own "Division 13 - Zoning" link after the legacy
`ilcs4.asp` URL scheme proved dead. 64,113 rendered characters, 103 section
references across §§ 11-13-1 to 11-13-13, **zero** ADU occurrences. The
length changing from 19,259 to 64,113 is what confirms a different page was
actually served this time.

**NY — General City Law article 5-A, "Buildings and Use Districts".** General City
Law is the zoning enabling law for cities, and NYC is a city. The article carries
seven sections (§§ 81, 81-A, 81-B, 81-C, 81-E, 81-F, 83) and **no ADU provision**;
none of the chapter's 22 article titles mentions accessory dwellings either.
Note § 81-E, "Article not applicable to certain cities" — NYC's zoning power runs
through its own Charter and the Zoning Resolution, which reinforces the answer.

**PA — and this one resolves structurally, on scope rather than content.**
The Municipalities Planning Code (Act 247 of 1968) was read whole: 398,886
characters, **zero** ADU occurrences — "accessory" appears twice, as "accessory
use" in the no-impact-home-based-business definition and as "accessory building".

More decisively, the MPC's own enacting clause empowers **"cities of the second
class A, and third class"**, boroughs, incorporated towns, townships of the first
and second classes, and counties of the second through eighth classes. **Cities of
the first class are absent from that list**, and the phrase "city of the first
class" appears nowhere in the act — the three "first class" hits are all
*townships*. Philadelphia is Pennsylvania's only city of the first class, so the
MPC does not reach it; its zoning authority runs through the First Class City Home
Rule Act and its Home Rule Charter.

That is the slot test applied to a statute's **scope clause** rather than to its
contents: the instrument that would carry a Pennsylvania ADU mandate for cities
excludes Philadelphia by its own terms, so its contents are moot for this city.

## ⚠️ The two that "remained" were the two strongest, and the block was my route

Georgia and Tennessee were recorded as `not-established` on the ground that their
codes sit behind LexisNexis. That was true of the route I had tried and false of
the resource.

**Georgia's own General Assembly publishes no code text.** `legis.ga.gov`'s
"Georgia Code" link points AT `lexisnexis.com/hottopics/gacode` — so the
commercial host *is* the enacting body's designated publication, maintained for
the Georgia Code Revision Commission under contract. Following the legislature's
own link rendered a public-access portal with a working full-code search. The
same pattern holds for Tennessee at `/hottopics/tncode`.

The earlier denial came from a URL I constructed (`.../gacode/`, with a trailing
slash, via a different host spelling), not from a paywall. **"It is behind
LexisNexis" was an inference about a 403, and the fix was to ask who publishes
the code rather than to assume who blocks it** — the same shape as rule 8, where
a 404 on a guessed path proves the guess wrong and nothing else.

The result is that these two are the **strongest** entries in the survey. Every
other `no-provision` row rests on a chapter-scoped read; these are searches over
the whole code:

| state | query | result |
|---|---|---|
| GA | `"accessory dwelling unit"` over the entire OCGA | **0 documents** |
| GA | `"zoning"` — positive control | **370 documents** |
| TN | `"accessory dwelling unit"` over the entire Tennessee Code | **0 documents** |
| TN | `"zoning"` — positive control | **235 documents**, from Title 13 ch. 7, citing Tenn. Code Ann. § 13-7-307 |

**⚠️ The positive controls are the point, not decoration.** A search returning
nothing and a search that is not working are indistinguishable, which is rule 20
inside the instrument. The Tennessee control did double duty: the results page
chrome still read "Georgia General Assembly" while the TOC scope read "Tennessee
Code", and only the control's citation to a Tennessee section confirmed the
search was actually scoped to Tennessee.

## What the survey established about method

**Recall would have failed this survey.** Nevada's mandate is seven weeks old.
Arizona's sanction turns on a 2025-01-01 deadline. Colorado's obligations began
2025-06-30. Three of the four preempting statutes post-date any stable mental
model of this area, and the fourth (MA) was amended in 2024.

**The detection method worth keeping is not auditing the fetcher.** It is noticing
two things that cannot both be true. Five different Texas chapters cannot all be
250,874 bytes. A request for one division of a statute cannot return a page
byte-identical to the article index already on disk. Neither failure was visible in
an exit code or an HTTP status, and neither required inspecting how curl works —
only comparing sizes across requests that should have differed. The same check
confirmed the Illinois success: 19,259 → 64,113 characters is what proved a
different page had finally been served.
