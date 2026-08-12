// How often the envelope actually resolves, per city — read from a committed
// measurement rather than inferred from a flag.
//
// WHAT WENT WRONG WITHOUT IT
// `docs/NULL-INVENTORY.md` probed ONE hand-picked parcel per city and its
// verdict was read as a statement about the city; `src/config/coverage.ts`
// derived the envelope cell from `CITIES[].live`, a boolean that says the
// provider is wired and nothing about how often it answers. Both rendered a
// city that withholds a verdict on two thirds of its parcels exactly like one
// that withholds none.
//
// The 575-parcel live run measured the difference. Over parcels the pipeline
// answered for AND found developable:
//
//   denver 2/6 resolved · lasvegas 2/9 · miami 5/15 · austin 6/14 · la 7/16
//   chicago 11/11 · nyc 15/15 · raleigh 14/14
//
// Denver's golden parcel is `G-MU-5`, a current form-based DZC district that
// resolves. The sample drew `R-2` / `O-1` / `I-B` / `H-1-A` — former Chapter 59
// codes that fall through. Nothing was misreported: n=1 did what n=1 always
// does, and the document read it as a rate.
//
// THE DENOMINATOR IS THE DESIGN. It is developable, answered parcels — not
// parcels attempted. A parcel the sampler drew outside the city gate, or one
// `assessDevelopability` blocked, is not an envelope failure and counting it as
// one would make every city look broken in proportion to how much public land
// and how large a regional parcel layer it has. But those exclusions SHRINK n,
// and a rate over 9 is a weaker claim than the same rate over 25 — so `n` is
// carried everywhere the share is, and the full partition stays in the artifact.
//
// COUNTS ARE COMMITTED, SHARES ARE DERIVED HERE. There is exactly one place a
// percentage is computed from a numerator, so it cannot drift from it.
//
// Regenerate with `npx vite-node scripts/smoke-parcels.ts` (about an hour of
// live municipal-GIS traffic — deliberately NOT part of `npm test`).

import artifact from '../../netlify/functions/lib/data/envelopeSample.json'

/** One city's sample, as a partition of the parcels attempted for it. Field by
 *  field this mirrors `CityEnvelopeSample` in scripts/smoke-parcels.ts, which is
 *  what writes it. */
export interface EnvelopeSampleCounts {
  attempted: number
  outOfCity: number
  noParcel: number
  upstreamError: number
  exception: number
  noSpec: number
  nonDevelopable: number
  developable: number
  resolved: number
  unconstrained: number
  gap: number
  indeterminate: number
  sampledOn: string
}

/**
 * The three states, kept apart on purpose (rule 5 — an absence and a gap must
 * not render the same, and rule 20 — an empty sample must not read as a clean
 * one):
 *
 *   'measured'       — there is a denominator and therefore a rate.
 *   'no-denominator' — the city was sampled and not one developable parcel came
 *                      back answered. There is no rate. This is LOUD, because
 *                      `0/0` rendered as a blank is the vacuous pass.
 *   'unmeasured'     — the artifact has no entry at all. Nobody has looked.
 */
export type EnvelopeSample =
  | { kind: 'unmeasured' }
  | { kind: 'no-denominator'; counts: EnvelopeSampleCounts }
  | {
      kind: 'measured'
      /** Developable parcels the pipeline answered for — the denominator. */
      n: number
      /** Of those, how many produced an envelope: a published FAR/height
       *  (`resolved`) or a stated absence of one (`unconstrained`). Both are
       *  answers; only the fall-through is a gap. */
      resolved: number
      /** Fell through to an assumed FAR. `resolved + gap === n`. */
      gap: number
      /** Of the developable parcels, how many ended with the verdict withheld.
       *  NOT identical to `gap`: Miami's sample has 10 gaps and 9
       *  indeterminates — one gap parcel came back PROHIBITED, which is a
       *  verdict rather than a withheld one. */
      indeterminate: number
      /** `resolved / n`, in 0…1. Derived here and nowhere else. */
      share: number
      counts: EnvelopeSampleCounts
    }

const CITIES_SAMPLED = artifact.cities as Record<string, EnvelopeSampleCounts | undefined>

/** How the artifact was produced, rendered next to the matrix so a reader can
 *  find the entry point rather than take the numbers on trust. */
export const ENVELOPE_SAMPLE_SOURCE: string = artifact.source

/** Every slug the artifact carries. Exported so a guard can PIN the inventory:
 *  a check over an empty set passes vacuously, and this is what makes the set
 *  non-empty and checkable. */
export const ENVELOPE_SAMPLED_CITIES: string[] = Object.keys(CITIES_SAMPLED).sort()

export function envelopeSample(slug: string): EnvelopeSample {
  const c = CITIES_SAMPLED[slug]
  if (!c) return { kind: 'unmeasured' }
  if (c.developable <= 0) return { kind: 'no-denominator', counts: c }
  const resolved = c.resolved + c.unconstrained
  return {
    kind: 'measured',
    n: c.developable,
    resolved,
    gap: c.gap,
    indeterminate: c.indeterminate,
    share: resolved / c.developable,
    counts: c,
  }
}

/** The cell text, in one place, so the coverage matrix and any other reader
 *  cannot render the same measurement two different ways.
 *
 *  The unmeasured and no-denominator strings are deliberately not blank and not
 *  a tick: those are the states that used to be indistinguishable from full
 *  coverage. */
export function envelopeSampleLabel(s: EnvelopeSample): string {
  switch (s.kind) {
    case 'unmeasured':
      return 'not sampled'
    case 'no-denominator':
      return `no sample (0 of ${s.counts.attempted})`
    case 'measured':
      return `${Math.round(s.share * 100)}% · n=${s.n}`
  }
}

/** The long form, for a tooltip or a document cell. States the numerator, the
 *  denominator, what was excluded from it, and when it was measured — so the
 *  percentage is never the only thing on offer. */
export function envelopeSampleDetail(slug: string, s: EnvelopeSample): string {
  if (s.kind === 'unmeasured')
    return `${slug} has no sampled parcels in the committed measurement. This is a gap in what we have measured, not a statement that the city resolves — an unsampled city is not a clean one.`
  const c = s.counts
  const excluded = c.attempted - c.developable
  const why = [
    c.nonDevelopable ? `${c.nonDevelopable} not developable` : '',
    c.outOfCity ? `${c.outOfCity} outside the city gate` : '',
    c.noSpec ? `${c.noSpec} too small for a default program` : '',
    c.noParcel ? `${c.noParcel} resolved to no parcel` : '',
    c.upstreamError ? `${c.upstreamError} upstream error` : '',
    c.exception ? `${c.exception} threw` : '',
  ]
    .filter(Boolean)
    .join(', ')
  if (s.kind === 'no-denominator')
    return `${c.attempted} parcels were sampled for ${slug} on ${c.sampledOn} and none of them was both answered and developable (${why}). There is no denominator, so there is no rate.`
  return `${s.resolved} of ${s.n} sampled developable parcels resolved an envelope on ${c.sampledOn} — ${c.resolved} from published data, ${c.unconstrained} under a stated absence of FAR, ${s.gap} fell through to an assumed FAR (${s.indeterminate} ended with the verdict withheld). ${excluded} of ${c.attempted} sampled parcels are excluded from the denominator: ${why}.`
}
