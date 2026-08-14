import { describe, it, expect } from 'vitest'
import {
  envelopeSample,
  envelopeSampleLabel,
  envelopeSampleDetail,
  ENVELOPE_SAMPLED_CITIES,
  ENVELOPE_SAMPLE_SOURCE,
  type EnvelopeSample,
  type EnvelopeSampleCounts,
} from './envelopeSample'
import { CITIES } from './cities'
import artifact from '../../netlify/functions/lib/data/envelopeSample.json'

// WHAT THIS FILE DEFENDS
//
// The committed artifact is what the /math coverage matrix and
// docs/NULL-INVENTORY.md both read to say how often a city's envelope actually
// resolves. It is produced by an hour-long live run that this suite does not and
// must not perform — so the file itself is the only thing here that can be
// checked, and the checks have to be the kind that cannot pass by finding
// nothing.
//
// Three failures are in scope, and all three are silent:
//   · the artifact goes empty or loses a city, and every affected cell renders
//     as though nothing is wrong;
//   · a hand edit breaks the partition, so a denominator shrinks and the share
//     goes up;
//   · the column stops discriminating — every city reads 100% — which looks
//     exactly like success and is what the boolean it replaced already did.

const RAW = artifact.cities as Record<string, EnvelopeSampleCounts>
const LIVE = CITIES.filter((c) => c.live).map((c) => c.slug).sort()

describe('the artifact inventory is PINNED, not merely non-empty', () => {
  it('carries exactly the live registry cities — membership, not count', () => {
    // A set that matches in size and not in members is the regex that silently
    // stopped matching. Pin the members.
    expect(ENVELOPE_SAMPLED_CITIES).toEqual(LIVE)
    expect(ENVELOPE_SAMPLED_CITIES.length).toBeGreaterThan(0)
  })

  it('every entry has a real sample behind it', () => {
    for (const slug of LIVE) {
      const c = RAW[slug]
      expect(c, `${slug} has no entry`).toBeDefined()
      // 0 attempted and 0 developable are the two ways a row can be present and
      // mean nothing. Neither may render as coverage.
      expect(c.attempted, `${slug} attempted`).toBeGreaterThan(0)
      expect(c.developable, `${slug} developable — no denominator, no rate`).toBeGreaterThan(0)
      expect(c.sampledOn, `${slug} sampledOn`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('every committed entry still partitions its own sample', () => {
    // Checked against the FILE, not only against the generator that wrote it:
    // a hand edit that nudges one count is exactly how a denominator shrinks
    // without anyone deciding to shrink it.
    for (const slug of LIVE) {
      const c = RAW[slug]
      const counted =
        c.outOfCity + c.noParcel + c.upstreamError + c.exception + c.noSpec + c.nonDevelopable + c.developable
      expect(counted, `${slug}: buckets vs attempted`).toBe(c.attempted)
      expect(
        c.resolved + c.unconstrained + c.plannedDevelopment + c.gap,
        `${slug}: split vs developable`,
      ).toBe(c.developable)
      expect(c.indeterminate, `${slug}: indeterminate exceeds its own denominator`).toBeLessThanOrEqual(c.developable)
    }
  })

  it('names its own provenance', () => {
    expect(ENVELOPE_SAMPLE_SOURCE).toMatch(/smoke-parcels/)
  })
})

describe('the share is derived, never stored', () => {
  it('no entry carries a precomputed rate', () => {
    // A stored 0.33 is a second source of truth that can disagree with its own
    // numerator. There must be exactly one place a percentage comes from.
    for (const slug of LIVE) {
      for (const k of Object.keys(RAW[slug])) {
        expect(k, `${slug} carries a stored rate field '${k}'`).not.toMatch(/share|rate|pct|percent/i)
      }
    }
  })

  it('computes the share from the counts, counting unconstrained as resolved', () => {
    for (const slug of LIVE) {
      const s = envelopeSample(slug)
      expect(s.kind).toBe('measured')
      if (s.kind !== 'measured') continue
      const c = RAW[slug]
      // Rule 5: "the code affirmatively imposes no FAR here" is an ANSWER, not a
      // gap. Denver's form-based DZC and SF's §124(b) would otherwise score as
      // failures of a lookup that in fact succeeded.
      expect(s.resolved).toBe(c.resolved + c.unconstrained)
      expect(s.n).toBe(c.developable)
      expect(s.share).toBeCloseTo(s.resolved / s.n, 10)
      expect(s.resolved + s.plannedDevelopment + s.gap).toBe(s.n)
    }
  })
})

describe('the column still discriminates', () => {
  it('does not report every city the same', () => {
    // THE WHOLE POINT. The boolean this replaced drew one dot for Denver, which
    // resolved 2 of 6, and for Chicago, which resolved 11 of 11. A measurement
    // that has quietly gone uniform has regressed to that boolean while looking
    // like success (rule 18: the surviving errors are the ones that produce
    // plausible output).
    //
    // If a future run genuinely resolves every parcel in every city, DELETE this
    // assertion on purpose and say so — do not leave a guard that can only pass.
    const shares = LIVE.map((slug) => {
      const s = envelopeSample(slug)
      return s.kind === 'measured' ? s.share : -1
    })
    expect(new Set(shares).size, 'every city reports an identical rate').toBeGreaterThan(1)
    expect(Math.min(...shares), 'no city resolves for less than all its sampled parcels').toBeLessThan(1)
  })

  it('the five cities the matrix used to overstate are all below their own n', () => {
    // Recorded, not asserted as a permanent truth: these are the cities the
    // 2026-08-11 run found withholding a verdict on a large share of sampled
    // parcels while carrying a clean single-parcel inventory row. If one of them
    // is fixed, this goes red and the entry is deleted deliberately — which is
    // the point, since the alternative is a fix nobody notices.
    for (const slug of ['denver', 'lasvegas', 'miami', 'austin', 'la']) {
      const s = envelopeSample(slug)
      expect(s.kind, slug).toBe('measured')
      if (s.kind !== 'measured') continue
      expect(s.resolved, `${slug} now resolves every sampled parcel — delete this entry deliberately`).toBeLessThan(s.n)
    }
  })
})

describe('the states with no rate are LOUD, not blank', () => {
  const counts = (over: Partial<EnvelopeSampleCounts> = {}): EnvelopeSampleCounts => ({
    attempted: 25, outOfCity: 0, noParcel: 0, upstreamError: 0, exception: 0, noSpec: 0,
    nonDevelopable: 25, developable: 0, resolved: 0, unconstrained: 0, plannedDevelopment: 0, gap: 0,
    indeterminate: 0,
    sampledOn: '2026-08-11', ...over,
  })

  it('an unmeasured city says so in words', () => {
    const s = envelopeSample('atlantis')
    expect(s).toEqual({ kind: 'unmeasured' })
    // Not '', not '—', not a tick. A blank is what full coverage would look
    // like too, and that ambiguity is the vacuous pass (rule 20).
    expect(envelopeSampleLabel(s)).toBe('not sampled')
    expect(envelopeSampleDetail('atlantis', s)).toMatch(/an unsampled city is not a clean one/)
  })

  it('a sampled city with no usable denominator is not a 0%, and not a 100%', () => {
    const s: EnvelopeSample = { kind: 'no-denominator', counts: counts() }
    expect(envelopeSampleLabel(s)).toBe('no sample (0 of 25)')
    expect(envelopeSampleDetail('x', s)).toMatch(/There is no denominator, so there is no rate/)
    // It must not be renderable as a percentage at all — a 0/0 printed as either
    // 0% or 100% is a claim the sample cannot support.
    expect(envelopeSampleLabel(s)).not.toMatch(/%/)
  })

  it('a measured cell always carries its denominator', () => {
    const s = envelopeSample('denver')
    expect(s.kind).toBe('measured')
    // 33% over 6 and 33% over 25 are different claims. The n is not decoration.
    expect(envelopeSampleLabel(s)).toMatch(/^\d+% · n=\d+$/)
  })

  it('the detail line states what was excluded from the denominator', () => {
    // Otherwise the percentage is the only thing on offer, and the reader cannot
    // tell a rate over 9 parcels from one over 25.
    const d = envelopeSampleDetail('lasvegas', envelopeSample('lasvegas'))
    expect(d).toMatch(/excluded from the denominator/)
    expect(d).toMatch(/outside the city gate/)
  })
})
