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

**What is safe to automate, and what is not.** Bounded, machine-verifiable work
(endpoint/field-drift checks, cross-city audits of a known defect class, porting
a verified pattern, test-until-green) is good loop material. **Cost constants in
`src/config/estimates.ts` are NOT** — they are blocked on a data-access decision
and an unattended loop would close that gap by inventing numbers, which is the
exact failure this ledger exists to prevent. Product decisions are not
automatable either: bring them to the user.
