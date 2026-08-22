import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  aggregateEnvelopeSample,
  mergeEnvelopeSample,
  envelopeSampleFaults,
  type RunRow,
  type CityEnvelopeSample,
} from './smoke-parcels'
import { CITIES } from '../src/config/cities'

// WHAT THESE TESTS DEFEND
//
// The rate this artifact carries replaced a boolean. `src/config/coverage.ts`
// derived the envelope cell from `CITIES[].live` — a flag that says the provider
// is wired and nothing about how often it answers — and `docs/NULL-INVENTORY.md`
// printed one hand-picked parcel's verdict per city. Denver resolved an envelope
// for 2 of the 6 developable parcels the live sample answered for and rendered
// identically to Chicago, which resolved 11 of 11.
//
// A rate is only worth more than a boolean if its DENOMINATOR is right, so that
// is what these tests are about:
//
//   · the buckets partition the sample, so nothing can leave the denominator
//     silently — a denominator that quietly drops the hard cases makes the share
//     go UP, which is the flattering-measurement shape of rule 18;
//   · an empty or partial artifact is a fault, not a pass (rule 20);
//   · a partial re-run cannot restamp cities it did not measure.
//
// The live run is not exercised here. It is an hour of municipal-GIS traffic;
// the aggregation is the part that can be wrong in a way nobody would see.

/** A run row, defaulted to the common case so each test states only what it is
 *  about. */
const row = (over: Partial<RunRow> & { city: string }): RunRow => ({
  lat: 1,
  lng: 2,
  ms: 100,
  outcome: 'RESOLVED',
  attempts: 1,
  developable: true,
  verdict: 'AS_OF_RIGHT',
  ...over,
})

const resolved = (city: string) => row({ city })
const unconstrained = (city: string) => row({ city, outcome: 'UNCONSTRAINED' })
const gap = (city: string) => row({ city, outcome: 'GAP', verdict: 'INDETERMINATE' })
/** A planned-development parcel: the limit exists, in its own ordinance. */
const pd = (city: string) => row({ city, outcome: 'PLANNED_DEVELOPMENT', verdict: 'INDETERMINATE' })
/** Answered, but nobody can build here — analyze.ts zeroes it. */
const blocked = (city: string) => row({ city, outcome: 'GAP', developable: false, verdict: 'INDETERMINATE' })
/** The sampler drew a parcel the runtime city gate rejected. */
const outside = (city: string) => row({ city, outcome: 'PARCEL_OUT_OF_BBOX', developable: undefined, verdict: undefined })

describe('the denominator', () => {
  it('is developable, answered parcels — not parcels attempted', () => {
    const s = aggregateEnvelopeSample(
      [resolved('denver'), gap('denver'), blocked('denver'), blocked('denver'), outside('denver')],
      '2026-08-11',
    ).denver
    expect(s.attempted).toBe(5)
    // 2 blocked and 1 outside the city are excluded: neither is an envelope
    // failure, and counting them would score a city by how much public land it
    // has and how regional its parcel layer is.
    expect(s.developable).toBe(2)
    expect(s.nonDevelopable).toBe(2)
    expect(s.outOfCity).toBe(1)
  })

  it('keeps a planned-development parcel INSIDE the denominator', () => {
    // THE REGRESSION THIS TEST EXISTS FOR. PLANNED_DEVELOPMENT was added to the
    // partition and to the counting, but not to the `answered` filter that
    // feeds `dev`. The parcel then left the denominator entirely: `attempted`
    // still read 25 while `developable` fell to 11, and the share went UP
    // because a hard case had dropped out of the bottom of the fraction — the
    // flattering-measurement shape of rule 18, arrived at by omission.
    //
    // assertPartition threw on the first live Dallas run, which is the only
    // reason it never reached the committed artifact.
    const s = aggregateEnvelopeSample([resolved('dallas'), pd('dallas'), outside('dallas')], '2026-08-11').dallas
    expect(s.attempted).toBe(3)
    expect(s.developable).toBe(2)
    expect(s.plannedDevelopment).toBe(1)
    expect(s.resolved).toBe(1)
    expect(s.gap).toBe(0)
    // The partition must still close over the new bucket.
    expect(s.resolved + s.unconstrained + s.plannedDevelopment + s.gap).toBe(s.developable)
  })

  it('does not count a planned development as resolved or as a gap', () => {
    // It is neither: no envelope was produced, and nobody failed to look. The
    // whole point of the bucket is that those two claims are both wrong.
    const s = aggregateEnvelopeSample([pd('sanjose'), pd('sanjose'), gap('sanjose')], '2026-08-11').sanjose
    expect(s.plannedDevelopment).toBe(2)
    expect(s.resolved).toBe(0)
    expect(s.unconstrained).toBe(0)
    expect(s.gap).toBe(1)
  })

  it('counts an affirmative absence of FAR as resolved, not as a gap', () => {
    // Rule 5: "the code imposes no FAR here" is an ANSWER. Denver's form-based
    // DZC and SF §124(b) would otherwise score as failures.
    const s = aggregateEnvelopeSample([unconstrained('sf'), unconstrained('sf'), gap('sf')], '2026-08-11').sf
    expect(s.unconstrained).toBe(2)
    expect(s.resolved).toBe(0)
    expect(s.gap).toBe(1)
  })

  it('keeps the indeterminate count separate from the gap count', () => {
    // Miami's real sample has 10 gaps and 9 indeterminates: one gap parcel came
    // back PROHIBITED, which is a verdict, not a withheld one. Collapsing them
    // would make the two numbers silently interchangeable.
    const s = aggregateEnvelopeSample(
      [gap('miami'), row({ city: 'miami', outcome: 'GAP', verdict: 'PROHIBITED' })],
      '2026-08-11',
    ).miami
    expect(s.gap).toBe(2)
    expect(s.indeterminate).toBe(1)
  })
})

describe('the partition — nothing may leave the denominator silently', () => {
  it('every attempted parcel lands in exactly one bucket', () => {
    const s = aggregateEnvelopeSample(
      [
        resolved('x'), unconstrained('x'), gap('x'), blocked('x'), outside('x'),
        row({ city: 'x', outcome: 'NO_SPEC', developable: undefined, verdict: undefined }),
        row({ city: 'x', outcome: 'PARCEL_NO_PARCEL', developable: undefined, verdict: undefined }),
        row({ city: 'x', outcome: 'PARCEL_UPSTREAM_ERROR', developable: undefined, verdict: undefined }),
        row({ city: 'x', outcome: 'EXCEPTION', developable: undefined, verdict: undefined }),
      ],
      '2026-08-11',
    ).x
    const counted =
      s.outOfCity + s.noParcel + s.upstreamError + s.exception + s.noSpec + s.nonDevelopable + s.developable
    expect(counted).toBe(s.attempted)
    expect(s.resolved + s.unconstrained + s.gap).toBe(s.developable)
  })

  it('THROWS on an outcome the partition does not cover', () => {
    // The failure this guards is silent and it flatters: an unbucketed row
    // leaves `attempted` alone, shrinks `developable`, and pushes the share UP,
    // because the parcel that fell out is a hard one. Proven by perturbation
    // rather than argued.
    expect(() =>
      aggregateEnvelopeSample([row({ city: 'x', outcome: 'SOMETHING_NEW', developable: undefined, verdict: undefined })], '2026-08-11'),
    ).toThrow(/does not cover/)
  })

  it('does not count an unanswered row as developable even if the flag says so', () => {
    // `developable` is only meaningful on a row that reached an answer. A
    // PARCEL_* row carrying a stale true must not enter the denominator.
    const s = aggregateEnvelopeSample([row({ city: 'x', outcome: 'PARCEL_OUT_OF_BBOX', developable: true })], '2026-08-11').x
    expect(s.developable).toBe(0)
    expect(s.outOfCity).toBe(1)
  })
})

describe('rule 20 — the artifact cannot be published by finding nothing', () => {
  const full = (): Record<string, CityEnvelopeSample> =>
    Object.fromEntries(
      CITIES.filter((c) => c.live).map((c) => [
        c.slug,
        aggregateEnvelopeSample([resolved(c.slug), gap(c.slug)], '2026-08-11')[c.slug],
      ]),
    )

  it('an empty artifact is a fault, not a clean run', () => {
    const faults = envelopeSampleFaults({})
    expect(faults.join('\n')).toMatch(/EMPTY/)
    expect(faults.length).toBeGreaterThan(0)
  })

  it('a live city with no entry is named, rather than rendering as clean', () => {
    const cities = full()
    delete cities.denver
    expect(envelopeSampleFaults(cities).join('\n')).toMatch(/denver is live and has NO entry/)
  })

  it('a sampled city with no usable denominator is a fault, not a 0/0 blank', () => {
    const cities = full()
    cities.denver = { ...cities.denver, developable: 0, resolved: 0, unconstrained: 0, gap: 0, nonDevelopable: 2 }
    expect(envelopeSampleFaults(cities).join('\n')).toMatch(/there is no denominator, so there is no rate/)
  })

  it('a complete artifact has no faults — so the guard is not passing vacuously', () => {
    // The other direction, and the point of pinning it: a fault list that can
    // only ever be non-empty is as useless as one that can only ever be empty.
    expect(envelopeSampleFaults(full())).toEqual([])
  })

  it('an entry for a slug outside the registry is a fault', () => {
    expect(envelopeSampleFaults({ ...full(), atlantis: full().denver }).join('\n')).toMatch(
      /atlantis carries a sample but is not a live registry city/,
    )
  })
})

describe('merging a partial re-run', () => {
  it('updates the cities measured and leaves the rest with their OWN dates', () => {
    // The stale-entry failure this prevents: one file-level stamp would present
    // 22 untouched cities as freshly measured because Denver was re-run.
    const prior = {
      denver: aggregateEnvelopeSample([resolved('denver')], '2026-08-01').denver,
      chicago: aggregateEnvelopeSample([resolved('chicago')], '2026-08-01').chicago,
    }
    const merged = mergeEnvelopeSample(prior, aggregateEnvelopeSample([gap('denver')], '2026-08-12'))
    expect(merged.denver.sampledOn).toBe('2026-08-12')
    expect(merged.denver.gap).toBe(1)
    expect(merged.chicago.sampledOn).toBe('2026-08-01')
  })
})

describe('⚠️ --rates is opt-in, because it is the only phase that writes the repo', () => {
  const SRC = readFileSync(resolve(__dirname, 'smoke-parcels.ts'), 'utf8')

  it('does not run by default', () => {
    // It used to be `phases.length === 0 || phases.includes('--rates')`, which
    // made a bare gauge run destructive: `--cities=boston --per=8` merged an
    // 8-parcel draw into the committed 100-parcel baseline, reducing Boston's
    // `attempted` from 85 to 8 — while the operator was measuring how long a run
    // takes BEFORE doing the real one. The baseline destroyed was the comparison
    // point the real run existed to be measured against.
    expect(SRC).toMatch(/const doRates = phases\.includes\('--rates'\)/)
    expect(SRC).not.toMatch(/const doRates = phases\.length === 0/)
  })

  it('⚠️ the READ-ONLY phases still default on — the asymmetry is the point', () => {
    // --sample, --run and --report write only inside --out, so defaulting them
    // costs nothing. Making everything opt-in would be the wrong lesson: the
    // hazard is writing the REPO, not writing at all.
    for (const phase of ['doSample', 'doRun', 'doReport']) {
      expect(SRC, phase).toMatch(new RegExp(`const ${phase} = phases\\.length === 0`))
    }
  })

  it('⚠️ refuses to publish a draw too thin to stand for a city', () => {
    // --rates merges PER CITY, so even an explicit `--cities=x --rates` at a
    // small --per replaces x's measured rate with a sample that cannot support
    // it. The committed rows are ~100-parcel draws.
    expect(SRC).toMatch(/MIN_RATES_PER = 50/)
    expect(SRC).toMatch(/\[rates\] REFUSED/)
    expect(SRC).toMatch(/process\.exit\(1\)/)
  })

  it('the usage header does not still promise all four phases', () => {
    // The header said "# all four" after the behaviour changed — a doc
    // contradicting its own code, which is the defect class the claim audit
    // just swept the product for.
    expect(SRC).not.toMatch(/# all four/)
    expect(SRC).toMatch(/# sample \+ run \+ report/)
  })
})

describe('⚠️ spec randomization — deterministic, and bounded by the envelope', () => {
  const SRC2 = readFileSync(resolve(__dirname, 'smoke-parcels.ts'), 'utf8')

  it('⚠️ is seeded on the parcel id, not Math.random', () => {
    // A failure found by a randomized run has to be re-runnable. This script's
    // own exception path re-probes in isolation three times before recording
    // anything (rule 10) — which is impossible if the spec that triggered the
    // failure cannot be reproduced. Same seed, same spec, every time.
    expect(SRC2).toMatch(/function rng\(seed: string\)/)
    expect(SRC2).toMatch(/rng\(parcelId\)/)
    const randBlock = SRC2.slice(SRC2.indexOf('function randomizeSpec'), SRC2.indexOf('async function runOne'))
    expect(randBlock).not.toMatch(/Math\.random/)
  })

  it('covers every use, project type and unit tier', () => {
    expect(SRC2).toMatch(/RAND_USES: Use\[\] = \['residential', 'commercial', 'mixed', 'institutional'\]/)
    expect(SRC2).toMatch(/RAND_PROJECT_TYPES: ProjectType\[\] = \['new', 'addition', 'change_of_use', 'adu'\]/)
    // 1 / 2–4 / 5+ — the boundaries that select the cost product and the
    // measured-permit stratum.
    expect(SRC2).toMatch(/\[1, 1\], \/\/ single/)
    expect(SRC2).toMatch(/\[2, 4\], \/\/ small-multi/)
    expect(SRC2).toMatch(/\[5, 60\], \/\/ apartment/)
  })

  it('⚠️ draws height in BOTH forms, so the ft-per-storey conversion executes', () => {
    // The engine converts a storey count through ftPerStory(use) — 11 ft
    // residential, 13 ft otherwise. A spec that only ever carries feet never
    // exercises that path, and it is the one rule 12 exists for.
    const randBlock = SRC2.slice(SRC2.indexOf('function randomizeSpec'), SRC2.indexOf('async function runOne'))
    expect(randBlock).toMatch(/const stories =/)
    expect(randBlock).toMatch(/const heightFt =/)
    expect(randBlock).toMatch(/heightForm/)
  })

  it('⚠️ scales GFA rather than drawing it absolutely', () => {
    // The point is exercising branches, not manufacturing impossible projects:
    // 400,000 sq ft on a 2,000 sq ft lot yields PROHIBITED for a reason that
    // tells us nothing. Multipliers straddle the relief thresholds instead.
    expect(SRC2).toMatch(/const SCALE = \[0\.35, 0\.8, 1\.0, 1\.3, 1\.8, 3\.0\]/)
    expect(SRC2).toMatch(/base\.gfa \* SCALE/)
  })

  it('⚠️ the branch-coverage table pins its expected set', () => {
    // A coverage table built only from what was OBSERVED cannot say what was
    // missed — it renders a run that touched four of twelve branches identically
    // to one that touched all four that exist. The expected list is written down
    // so "never fired" is reportable (rule 20).
    expect(SRC2).toMatch(/const EXPECTED: Array<\[string, string\[\]/)
    expect(SRC2).toMatch(/## 2b\. Branch coverage/)
    expect(SRC2).toMatch(/pinned branches never executed/)
  })

  it('--fixed-spec restores the single reference project', () => {
    // Kept so a run can still be compared against the pre-randomization
    // artifact; the committed envelopeSample was drawn that way.
    expect(SRC2).toMatch(/const RANDOMIZE_SPEC = !process\.argv\.includes\('--fixed-spec'\)/)
  })
})
