# Piranha — project notes for Claude

Parcel-level building-feasibility tool (thepiranhaproject.com). Vite + React 19
+ TypeScript + Tailwind v4, Netlify Functions + one Edge Function. See
README.md for env vars and deploy.

## Architecture in one minute

- `src/` — SPA. Routes lazy-load from `src/App.tsx`. City config lives in
  `src/config/cities.ts` (single source of truth for slugs/labels/centers);
  cost/timeline constants in `src/config/estimates.ts` — the Methodology page
  derives its tables from these, so changing them changes the published math.
- `netlify/functions/` — `/api/parcel` and `/api/analyze` are deterministic
  (city ArcGIS services + Mapbox reverse geocode; NO LLM). `/api/ask` calls
  Google Gemini. `log-search`/`searches-log` are the private search log
  (Netlify Blobs). Shared abuse guards in `netlify/functions/lib/guard.ts`.
- `netlify/edge-functions/og.ts` rewrites <title>/meta/canonical per route —
  it string-matches the tags in `index.html`; keep the two in sync.
- Per-city parcel data adapters: `netlify/functions/lib/providers/*.ts`.

## Conventions

- Tests are Vitest, colocated as `*.test.ts`. Run `npm test`; lint with
  `npm run lint`; typecheck via `npm run build` (tsc -b first).
- Business-logic heuristics (`src/lib/developability.ts`, `siteFlags.ts`) are
  deliberately conservative — never broaden a block-regex without a test
  showing it can't catch a legitimate private parcel.
- No secrets in the client except `VITE_MAPBOX_TOKEN` (public by design,
  URL-restricted in the Mapbox dashboard). Anything else stays in
  `process.env` inside functions.
- The CSP in `netlify.toml` is strict: adding a new third-party script, style,
  or fetch target requires extending it.

## Evidence rules — READ BEFORE CHANGING ANY NUMBER

Every rule below was learned by getting it wrong in this repo. The full record
is `docs/VERIFICATION-LEDGER.md`; these are the standing rules distilled.

**1. A mechanism argued aloud earns NO DIRECTION until something measures it.**
Not a weaker direction, not a hedged one — none. Writing "biased high (magnitude
unknown)" is what let a retracted claim propagate into three files. A plausible
mechanism is not a measurement, and this applies to claims from the user, from
a document, and from you, symmetrically.

**2. Sums don't discriminate; ratios do; perturbation does best.** Ranked:
- *Addition* tests arithmetic only. `a + b + c = total` is consistent with
  parallel AND sequential composition — it discriminates nothing.
- *Ratios between addends* test structure. Is `b` a percentage of the bare base
  or of the running subtotal? That question has one answer.
- *Perturbation* tests structure with a disproof: predict the number under each
  competing structure, change one input, run it. The fee-compounding question
  was settled this way to the cent after the sum had misled for rounds.

**3. A citation on one input launders the whole derivation.** `avgUnitGrossSqFt
= 1300` reads as sourced because the ~1,000 sf net unit cites Statista — but the
75% efficiency that produces 1300 cites nothing. When a constant is computed
from two inputs, source BOTH or label the composite as derived. Composite
constants with one cited component are where this hides.

**4. Never invent a conversion factor.** A US-average ratio applied to a
specific parcel is an invented number wearing a citation, and six months later
it is indistinguishable from a measured one. If a conversion is needed and not
sourceable, the honest output is "unpriced, disclosed" — not a plausible number.

**5. Distinguish a known absence from a missing lookup.** "The code imposes no
FAR here" is an ANSWER; "we could not resolve a FAR" is a GAP. They must not
render the same. See `zoning.farUnconstrained` / `envelope.farBasis:
'unconstrained'` for the pattern. Corollary: a failed fetch must never
silently become a substantive answer.

*How to establish an absence — ask whether the source has a SLOT for the value,
not whether the slot is filled.* This settled two cities. DC: Subtitle D ch. 3
and Subtitle E ch. 3/4/5 have **no FAR section at all**, while Subtitle E ch. 6
has § 602 "FAR AND MAXIMUM NUMBER OF DWELLING UNITS" — the section exists exactly
where FAR applies. Philadelphia: Table 14-701-1 has **no FAR row**, and
14-701-2's combined "Max. Height / FAR" cell holds a height alone for RM-1 while
RM-2/3/4 hold percentages of lot area. In both, the document's own structure is
POSITIVE evidence of absence rather than a reader failing to find something.
A blank cell is not this. And the method does not generalise past what was read:
Philadelphia's other ten blanks (CMX-2, CA-1, I-P, SP-*) stay gaps, because **an
absence is only an answer once someone has looked.**

**6. Do not report a maximum across alternatives as if it were a ceiling.**
Where a code allows either A or B (Austin: 0.40 single-family OR 0.65 for three
units), reporting the larger assumes a program the user has not chosen and
flows into unit counts, fees and hurdles.

**7. A stale-data disclaimer naming the wrong direction is worse than none.**
It tells the reader which way to correct and they correct into the error.

**8. Check before you claim, and say which one you did.** A 404 on a URL you
guessed proves your guess was wrong, not that the resource is absent. Read
indexes, not guessed paths.

**9. Every check that has ever found a real defect here compared the system to
something OUTSIDE it.** Not one was caught by internal verification.

| What found it | What it caught |
|---|---|
| External cost benchmark | a data-set mapping bug (`1.15` vs `1.25`); and a *more traceable* chain that had drifted further from reality |
| Live GIS field query | Minneapolis — a zoning chapter that would have matched **zero** parcels |
| Live field-value query | Miami `FLR` is a letter suffix, not a floor-lot ratio |
| Asking "is this text true *here*?" | a disclaimer true of one branch, false of the branch it was being copied to — and, underneath it, a live user-facing provenance claim that was half false |

The test suite, the type checker and the linter found **none** of them, and could
not have: each error was internally consistent on both sides of a boundary.

> **External validation is a required step before any level change or provenance
> claim ships — not a thing done on request.** Internal checks verify that the
> code does what you said. Only an outside measurement checks whether what you
> said is true.

Corollary: **disclosure copy is code.** It makes claims, and a claim can be true
in one file and false in another. Never move explanatory text between contexts
without re-checking it against the context it lands in.

**10. A single probe is not evidence.** A transient failure under concurrent
load is indistinguishable from a defect, and the incentive to report it
immediately is strongest exactly when it looks urgent. Chicago returned
`districtCode: Unknown` once during a 15-city batch and resolved to `B3-2` on
three consecutive isolated re-probes — reporting the first result would have
cost a session chasing a regression that did not exist. **Re-probe in isolation
before recording any live failure.**

**11. Measure the pipeline, not your probe.** Four times now a measurement has
described the instrument rather than the system: a grep that matched only
literal nulls (missing Philadelphia's 17 and Boston entirely); a resolver called
with `maxFAR: null` that bypassed every provider-side FAR lookup and reported
"11/65 resolved"; a guessed URL whose 404 was read as absence; and
`enumerate-parser-domains.ts` reading `.maxFAR` off a resolver returning
`{ far, heightFt }` — `undefined` on every input, so it reported Chicago 1,528
unhandled and NYC 203 unhandled when Chicago in fact resolves 63 classes.
**Exercise the real entry point.** If the answer would change depending on which
layer you called, you measured the layer.

The fourth was committed *by the script written to enforce this rule*, which is
the point: a checking tool is code, and nothing was checking it. `scripts/` and
`netlify/` sat outside the typecheck (`tsconfig.app.json` includes only `src`),
so a nonexistent property was a silent `undefined` rather than a build error.
`tsconfig.scripts.json` now covers both — verified by reintroducing the bug and
watching `tsc` reject it. And note the second-order cost: the false result had
already put "chicago — research + a table" in the backlog for work that was
**already done**. A broken instrument misdirects effort long after you stop
running it.

**12. Never convert through a unit the code does not use.** Miami 21 regulates
in STORIES. The module multiplied 80 stories by an unsourced 12 ft/story, then
the envelope divided 960 ft by a *different* 11 ft/story constant and published
**87 stories for a district whose code says 80**. Two conversions, two
constants, neither cancelling. Carry the figure the code states; derive only at
the last possible moment, and never round-trip.

**13. Some fields resolve only from TWO layers jointly.** Minneapolis FAR needs
the built-form overlay for the row AND the primary zoning code for the column —
no single-layer lookup returns a correct number, and the provider held both
while reading one. A joint dependency is invisible to both the fetched-but-unread
grep and the null inventory. The sweep question is: **for each field the engine
reads, does resolving it correctly require another field it also reads?**

**14. Convert a caught error into an impossible state, not a comment.** After the
Denver story-count bug, all 26 curated entries were routed through one
`storeys(n)` helper that emits height and stories together, with a test asserting
every entry carries a story count — a hand-written `{ heightFt: ft(12) }` can no
longer silently drop it. Same move as the test asserting the superseded
Minneapolis Chapter 546 codes resolve to nothing. A comment documents a mistake;
a structure prevents it.

**15. A test encodes an INTERPRETATION, and a well-explained one is the hardest
to overturn.** Four tests asserted `parseMaxFAR('70% of Lot Area')` returns
null, with a comment explaining that it was "lot coverage, not floor-area
ratio". The interpretation was wrong — that string IS the FAR expression — and
Philadelphia's RM-2/3/4 districts were published at an assumed FAR 1.0 against
code figures of 0.70/1.50/3.50.

The suite was not failing to catch the defect. It was **defending** it: fixing
required arguing against green tests *and* a documented rationale. This sharpens
rule 9 — internal verification does not merely fail to detect errors of
interpretation, it entrenches them, and **the entrenchment is proportional to
how well the wrong reasoning was written down.**

When a test asserts that something is absent, unparseable, or not applicable,
check the interpretation against the source before trusting the assertion. A
green test is evidence the code matches an interpretation, never evidence the
interpretation is right.

**16. A measurement that contradicts a known-good result is the INSTRUMENT's
problem until proven otherwise.** `B3-2` resolving to FAR 2.2 and "1,528 Chicago
classes unhandled" could not both be true. The contradiction was visible in the
data before anyone looked for a cause — and the reflex was to explain the
surprising number (a narrow parser? PDs?) rather than to distrust the thing that
produced it. Both explanations were plausible, which is precisely why they were
worthless: a wrong instrument generates plausible stories on demand.

The tell is a result that is *surprising in a direction that implies work*. "This
city is far more broken than we thought" is the shape a measurement error takes
when it flatters your sense that there is more to find. Reconcile against the
known-good case FIRST — one hand-run of the resolver would have closed it — and
only then believe the aggregate. Note the asymmetry with rule 10: a single probe
is not evidence of a defect, but a single *known-good* result IS evidence against
a measurement that contradicts it.

**17. A retraction must propagate to every place the claim appears — and headers
and summaries are read FIRST.** `zoning/philadelphia.ts` contained both the
retracted claim (`"70% of Lot Area" = lot coverage, not FAR`) and its detailed
retraction, **three lines apart**, with the false version in the file's opening
summary where a reader lands. Anyone opening it to learn what the module does
would have read the wrong claim and never scrolled to the correction.

This is worse than rule 15. There the wrong interpretation was merely
well-defended; here the correct one was already written and lost anyway, on
position alone. Second instance of the shape — defect 5 carried a retracted
tier-premium claim after it had been retracted elsewhere — so it is a pattern,
not an incident.

The mitigation is mechanical and takes one command: **when you retract something,
grep the claim's distinctive terms across the whole repo** rather than fixing the
site where you happened to notice it. Fix every hit, or label it as a recorded
retraction. Run 2026-08-05 over the known retracted claims found no third live
instance — the check is cheap and the failure it prevents is silent.

**18. A result that LOOKS like an answer gets less scrutiny than one that looks
like a gap — so the surviving errors are always the ones that produced plausible
output.** Eleven cities returned a permit-timing number and four returned
nothing. The four nulls were interrogated hard, because a null feels like
something to explain. The eleven numbers were waved through, because a number in
the right units looks like success. **Eight of the eleven were wrong or
overstated**, and not one was catchable by re-reading our own code.

Every defect this session fits the shape. The FAR-1.0 fallback, the fabricated
Denver heights, the 87-story Miami round-trip, the `1.15` markup, LA's overstated
qualifiers, DC's off-by-one MU column — **all produced numbers, none produced
nulls.** This is rule 5's asymmetry one level up: rule 5 says an absence and a
gap must not render the same; this says a plausible answer and a correct answer
do not feel different either.

The operational consequence: **verification cannot be triggered by a suspicious
result.** Suspicion is precisely the signal that is missing in the dangerous
cases — Chicago's 1.0-month median was suspicious and got caught, while NYC's
perfectly reasonable 8.3 was wrong by nearly 2× and looked fine. The audit step
has to be unconditional and it has to run BEFORE shipping, not after.

Corollary, from the same round: **the absence of a wrong output is not evidence
the code is right.** `scripts/permits/boston.mjs` admits Certificates of Occupancy
as new construction — 54% of what it selects — and has never emitted a wrong
number only because a missing date field halted it first. It was one schema change
from shipping. Code that did not run is not code that works.

**19. Never slice a handoff. Write it to a file and pass the path.** Passing four
agents' research on as `JSON.stringify(r).slice(0, 4500)` did not lose the tail of
each field evenly — the cut landed inside the FIRST key, so **140,418 characters
of hurdles research across four cities arrived as nothing at all.** A cap on a
serialised object is a *total* deletion of every field after the cut, chosen by key
order, and the intuition "I'll cap it, I'll lose some detail" is wrong about what
happens.

It is also **silent on both sides**: the sender's log shows four agents completing
successfully, and the receiver sees a well-formed object. Nothing in the pipeline
can see the deletion. This is rule 11's shape at the seam between agents — the
handoff, not the work, is what got measured.

Second instance in one session (the first sliced `HURDLE-PROPOSALS.md` at
`[:48]/[:90]/[:70]`, discarding ~90% of 109 researched rows), so it is a pattern.
What caught this one was the *receiving* agent reporting that its input arrived
truncated — which it could only do because it had been told what fields to expect.
**Where content must go inline, name the fields the receiver should find, so a
missing one is reportable instead of invisible.** And note what it nearly cost:
the four cities were added to `CITIES_WITH_SPECIFIC_HURDLES` — the constant
`Compare.tsx` reads to decide whether a hurdle count renders as a floor — while
only their parking rows existed. A truncated handoff had become a user-facing
completeness claim.

**20. A check that can pass by finding nothing is not a check.** Three times now
the same defect has shipped in three different instruments: `check-citations`
returned PASS over zero checkable URLs; the FAR extractor reported "no FAR
stated" for districts it had failed to read; and the deliberate-absence guard, as
first written, would have gone green the moment the notes stopped naming anyone —
including because someone deleted them.

The shape is always the same. The check asserts something about a set, the set is
empty, the assertion is vacuously true, and **green means "nothing to report"
where the reader hears "nothing wrong."** It is rule 5 inside the instrument: an
empty result and a clean result must not render the same.

The fix is equally mechanical and has now been written three times, so write it
by default: **assert the input set is non-empty, and pin its size or membership.**
`check-citations` cannot print PASS while any file is unchecked; the ledger guard
pins its exact 27-citation inventory; the absence guard fails if neither note
names a city, with a message saying to delete the block deliberately rather than
leave a guard that can only pass. A pinned inventory also catches the other
direction — a regex that silently stops matching goes RED instead of green, which
is the failure that makes a checking tool worthless (rule 11).

**21. A retraction must DESCRIBE the retracted claim, not restate it.** Twice in
one day a correction tripped the very guard that motivated it, because the
correction quoted the false sentence verbatim: once in a ledger entry about stale
ledger figures, once in a `cities.ts` note about stale notes.

A verbatim quote is indistinguishable from a live claim — to any scanner, and to
most readers, who see the sentence before they see the frame around it. That is
rule 17 one level in: it is not enough for the correction to be adjacent, it must
not reproduce the thing it corrects. Write *"this note asserted that none of the
three had been investigated"*, not the sentence itself. Where the exact wording
genuinely matters, mark it with the supersede convention so a scanner can see the
frame, and expect the guard to hold you to it.

**This is now the most frequently violated rule here, and the violator is always
the person writing the retraction** — four instances in one day, each caught by
the very guard the correction existed to satisfy. That points at the cause:
**quoting feels like precision.** Reproducing the false sentence reads as
scrupulous — you are showing your work, not paraphrasing away the evidence — and
that instinct is right everywhere except here, where the artifact you are editing
is also the corpus someone will scan. Precision about a retracted claim means
being exact about WHAT IT ASSERTED, not exact in its words.

**22. A transport can silently transform its payload. Verify byte-identity at the
DESTINATION; a clean send proves nothing.** Four instances this session, four
different mechanisms, one signature — the payload was mangled in transit while
both ends reported success:

| transport | what it did |
|---|---|
| `JSON.stringify(r).slice(0, 4500)` | deleted every field after the first key (rule 19) |
| `String.replace(anchor, block)` | `$$` in a replacement string escapes to one `$`, so two currency figures published as bare numbers |
| unquoted shell expansion under zsh | no word-splitting, so a probe returned a plausible zero for every city |
| `wc -l` on a CSV | counted newlines embedded in a 1,000-char field, inflating the row count |
| a 37 MB PDF fetch | stopped at 30 MB with **HTTP 200**, and `pdftotext` blamed a corrupt xref |

None was detectable from the sending side. The slice logged four successful
agents; `replace` returned a well-formed string; the shell command exited 0;
`wc -l` returned a number in the right units. **The destination is the only place
the corruption exists**, so that is the only place worth checking.

The PDF case adds a mechanism worth naming separately: the transport reported
success, the payload was SHORT, and the downstream tool's error pointed at the
wrong cause — "Invalid XRef entry" reads as a bad source document, not an
incomplete transfer. Two more attempts at a different URL would have been the
natural next move. **Check the byte count against `Content-Length`, not the exit
code**; the size mismatch is the only signal that distinguishes a truncated
download from a broken file.

`$&`, `` $` `` and `$'` in a `String.replace` replacement are the same hazard and
equally silent — prefer index splicing, or `replace(a, () => b)` where the
function form disables all substitution. Then compare the written region to the
source **by string equality, not by eye.** That verification is the default for
any splice, not a response to having been caught once.

**23. Absence within a scope is not absence. Establish the scope first.** Las
Vegas's Title 19 — the zoning code, the obvious place to read — contains no
impact fee, no drainage permit and no landscape rule. Reading it and stopping
would have published "nearly exaction-free" as a positive finding. The
requirements are real and live in Titles 4, 14 and 20: a $1,000/unit construction
tax, a $2,551/ERU sewer occupancy fee, a traffic-signal fee, a turf prohibition,
a citywide drainage permit.

This is rule 5's slot test one level up. The slot test asks whether a document
has a place for the value; this asks whether you are reading the right document
at all, and it fails in the direction that flatters — a thorough read of the
wrong scope produces a confident absence, not a gap. Before recording that a city
imposes no X, state which titles or chapters were read and why those are the ones
that would carry X. An absence is only an answer once someone has looked in the
place it would be.

**24. A reason code is a CLAIM, and a claim can be true of the jurisdiction
and false of the parcel.** LA's `farAppliesTo: 'buildable-area'` is correct and
cited: LAMC § 12.21.1 A.1 states every FAR against Buildable Area, and that is a
fact about the CODE, so the flag is set unconditionally for the city. The bug was
running the branch without checking that a ratio had actually resolved — so a
parcel whose district string the parser cannot read reported
`farBasis: 'basis-unavailable'`, which asserts "the ratio is known and its basis
is unobtainable" about a district that was never resolved at all.

Both halves were right in isolation. The city-level statement is true; the
parcel-level statement had an unmet precondition. **A reason code carries an
implicit "given that we resolved X" — state it as a guard, not as an assumption**,
because the flag's own correctness makes the misapplication invisible: nothing
about the claim looks wrong until you find the parcel it is wrong about.

Found by the enumeration sweep on a live parcel (`[LN1-MU2-5][P2-FA][CPIO]`),
never by a test — the tests exercised parcels whose FAR resolved, which is
precisely the case where the precondition holds.

**25. When a sweep reports a number that implies a lot of work, the first
hypothesis is that the sweep is wrong.** Four for four in one session:
Chicago 1,528 unhandled (the resolver was called with the wrong property),
Dallas 1,031 of 1,077 (1,000 were `PD ###`, which are answers), San Jose
LAYER UNREACHABLE (the sweep declared a service the provider never read), and a
2,294 grand total that reconciled to 717 without a single parser being fixed.

Every reduction came from reconciling against something already known — a
module's own documented scope, a reason code that already existed, a provider's
actual layer. The one INCREASE came from measuring something previously skipped,
which is the honest direction.

This is rule 16 specialised to this instrument, and it now has a hit rate.
Reconcile the largest contributor against a known-good BEFORE reporting a total,
every time.

**26. A sweep's total can move for instrument reasons alone — say which.** This
session's parser-domain total went 2,294 → 1,009 → 1,010 → 717 → 734 → 753, and
**not one of those movements was a code change.** Every one was a correction to
how it counts: planned-development codes were answers not gaps (Dallas 1,031 →
31); Atlanta's SPI exclusion was documented, not broken; Charlotte's site-plan
basis was already a reason code; San Jose rose because it stopped being skipped;
Denver rose because nineteen legacy codes stopped being credited with storey
counts the code never states.

The two RISES are the honest direction and the more valuable signal — something
stopped being counted as coverage it never had. A falling total is the one to
distrust, because it is indistinguishable from progress.

**Report the composition, never the bare number**, and when the total moves, say
whether the system changed or the counting did.

**27. A prefix is not a family.** `OS-A`/`OS-B`/`OS-C` were triaged into Denver's
former-Chapter-59 group because they start "OS-", alongside the genuinely legacy
`OS-1`. They are current DZC districts (Article 9, Division 9.3), and one query
against the frozen former code settled it: **zero occurrences**. They had also
been misclassified in the provider, so their heights were being suppressed as
pre-2010.

Same shape as matching a city on a name or a district on its spelling — cheap,
plausible, and wrong exactly when the naming collides. Denver's own convention
guarantees collisions: the legacy code and the current one both use letter
prefixes, so `OS-` spans both eras and `I-A` (current) sits beside `I-0`
(legacy).

**Test membership against the source, not the string.** A grep of the frozen
document is one command and it is dispositive in both directions.

**28. A planted defect must be verified as the defect you meant to plant.** The
duplicate-parse detector is proven by planting a matching pair and asserting it
fires — the standard answer to rule 20, since a detector that found nothing and a
detector that stopped working look identical. The plant was
`"const t = s.split(/[()\s]+/)"`, written as a JS string, where `\s` collapses to
a bare `s`. So the planted regex was `/[()s]+/`, **which appears nowhere in this
codebase**, and the detector was proven against a pattern it will never meet.

It passed. Both halves of the pair were malformed *identically*, so they matched
each other and the check went green. Nothing in the test could see it; the only
thing that ever noticed was the linter's `no-useless-escape`.

This is a new member of the rule-20 family and it is one level deeper. Rule 20
says a check that can pass by finding nothing is not a check, and the fix is to
assert the input set is non-empty. Here the set was non-empty and the assertion
was real — **the PLANT was wrong**, so a working detector correctly reported a
defect nobody meant to introduce. A green plant proves the detector fires; it
does not prove it fires on the thing you care about.

So: after planting, **assert a property of the plant itself**, not only that the
check went red. One line — `expect(shared[0]).toContain('\\s')` — and the fixture
can no longer drift into modelling something that does not exist. Escapes inside
string literals that stand for source code are where this hides, because the
string is read by a human as the text it denotes and by the runtime as something
else.

**A note on the instruments, recorded because it is the first time.** The stale
Milwaukee absence reason — a hand-written note saying the residential pair "stays
unpublished pending a live re-run and a product decision" — was caught by the
coverage XOR guard the moment the data landed, before anyone grepped for it. Every
other stale claim in this ledger was found by a person going looking. That guard
asserts a city is either derived-present OR carries exactly one absence reason,
never both, and it turned red on its own.

That is what the guards are for, and it is worth knowing they have started to
work: the discipline moves out of the reader's head and into the build. It also
sets the standard for the next one — a guard that only fires when someone
remembers to consult it is still the reader carrying it.

## Working with the user

**Do not tell the user when to stop working, rest, or sleep.** Not as a
sign-off, not as concern, not as a suggestion. They decide when they stop; it is
not a call to make on their behalf, and it has been asked for once already.
Report state, hand over what is open, and end there.

**What is safe to automate, and what is not.** Bounded, machine-verifiable work
(endpoint/field-drift checks, cross-city audits of a known defect class, porting
a verified pattern, test-until-green) is good loop material. **Cost constants in
`src/config/estimates.ts` are NOT** — they are blocked on a data-access decision
and an unattended loop would close that gap by inventing numbers, which is the
exact failure this ledger exists to prevent. Product decisions are not
automatable either: bring them to the user.
