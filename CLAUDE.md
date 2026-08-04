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

**What is safe to automate, and what is not.** Bounded, machine-verifiable work
(endpoint/field-drift checks, cross-city audits of a known defect class, porting
a verified pattern, test-until-green) is good loop material. **Cost constants in
`src/config/estimates.ts` are NOT** — they are blocked on a data-access decision
and an unattended loop would close that gap by inventing numbers, which is the
exact failure this ledger exists to prevent. Product decisions are not
automatable either: bring them to the user.
