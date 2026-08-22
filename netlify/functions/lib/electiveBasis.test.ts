import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { computeEnvelope } from './envelope'
import { assessFeasibility } from './feasibility'
import { whatWouldItTake } from './inverse'
import type { AnalysisInput } from '../../../src/types/analysis'
import type { ParcelInfo } from '../../../src/types/parcel'

const ROOT = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

// ── THE STATE, CONSTRUCTED ────────────────────────────────────────────────────
// Built as literals rather than by naming an Atlanta subarea, because a fixture
// that names a live district is a fixture that breaks when the district is
// re-read (rule 29). The behaviour under test is "the selected limb's
// denominator is the applicant's", which needs no real district to exist.
const parcel = (
  zoning: Partial<ParcelInfo['zoning']>,
): ParcelInfo =>
  ({
    lot: { sizeSqFt: 10_000 },
    overlays: {},
    zoning: {
      districtCode: 'TEST-1',
      districtName: 'Constructed',
      article: null,
      maxHeightFt: 100,
      maxFAR: null,
      allowedUses: null,
      ...zoning,
    },
  }) as unknown as ParcelInfo

describe('an elective denominator suppresses the product it cannot compute', () => {
  // One case per limb the envelope can select. The headline is chosen by which
  // limb resolved, so an election on a limb that is NOT selected must not
  // suppress anything — that asymmetry is the whole reason the flag is per-use.
  const CASES: ReadonlyArray<readonly [string, Partial<ParcelInfo['zoning']>]> = [
    [
      'residential',
      { farByUse: { residential: 25 }, farElectiveByUse: { residential: true } },
    ],
    ['mixed', { farByUse: { mixed: 3.0 }, farElectiveByUse: { mixed: true } }],
    ['district', { maxFAR: 2.0, farElectiveByUse: { commercial: true } }],
  ]

  it.each(CASES)('withholds the floor area when the %s limb is elective', (_limb, zoning) => {
    const env = computeEnvelope(parcel(zoning), 'atlanta')
    expect(env.farBasis).toBe('basis-elective')
    // ⚠️ The product is the point. Multiplying by the measured parcel computes
    // the NET option — permitted, and the smaller of the two the code offers —
    // so the failure this guards is not a wrong number, it is a floor published
    // under a heading that says maximum.
    expect(env.maxFloorAreaSqFt).toBeNull()
  })

  it('leaves a limb alone when the election is on a DIFFERENT limb', () => {
    // SPI-20's actual shape: residential elective, combined stated flatly. If
    // the flag were district-level this would wrongly go dark.
    const env = computeEnvelope(
      parcel({ farByUse: { mixed: 3.196 }, farElectiveByUse: { residential: true } }),
      'atlanta',
    )
    expect(env.farBasis).toBe('mixed')
    expect(env.maxFloorAreaSqFt).toBe(31_960)
  })

  it('is inert for every city that states its denominators', () => {
    const env = computeEnvelope(parcel({ farByUse: { residential: 2.0 } }), 'boston')
    expect(env.farBasis).toBe('residential')
    expect(env.maxFloorAreaSqFt).toBe(20_000)
  })
})

// ── THE INVENTORY, PINNED ─────────────────────────────────────────────────────
// A check that can pass by finding nothing is not a check (rule 20). Every
// assertion above would stay green if Atlanta stopped marking any limb elective
// — including because a `far()` argument was renamed and the branch went cold.
describe('the elective limbs exist and are counted', () => {
  const src = read('netlify/functions/lib/zoning/atlanta.ts')

  it('pins how many limbs carry the applicant election', () => {
    const limbs = src.match(/far\([^)]*'net-or-gross'/g) ?? []
    expect(limbs.length).toBeGreaterThan(0)
    // Read 2026-08-22 across the SPI chapters. A change here is a real change to
    // what Atlanta's code says and should be made deliberately, not absorbed.
    expect(limbs.length).toBe(40)
  })

  it('the provider maps every limb it can publish, not just the one that was noticed', () => {
    // The seam that broke: the provider read `.far` off each limb and dropped
    // `.basis`. farByUse has three limbs Atlanta populates, so three bases must
    // be consulted — a fourth limb gaining a ratio without a basis is exactly
    // the regression this counts.
    const prov = read('netlify/functions/lib/providers/atlanta.ts')
    const mapped = prov.match(/basis === 'net-or-gross'/g) ?? []
    expect(mapped.length).toBe(3)
  })
})

// ── THE COPY ──────────────────────────────────────────────────────────────────
// Two files describe this state to the reader and neither imports the other.
// The feasibility copy was a two-way ternary, so elective fell through to
// "no floor-area limit could be resolved" — false of a district that publishes
// one. Disclosure copy is code (rule 9's corollary).
describe('the elective disclosure never borrows the unresolved sentence', () => {
  const feas = read('netlify/functions/lib/feasibility.ts')
  const elective = /'assumed-basis-elective'\s*\n?\s*\?\s*'([^']+)'/g

  it('states its own reason in both fields', () => {
    const found = [...feas.matchAll(elective)].map((m) => m[1])
    // allowed + note. Non-empty first, so a renamed constant fails loudly
    // rather than vacuously passing over nothing.
    expect(found.length).toBe(2)
    for (const s of found) {
      expect(s).not.toMatch(/could be resolved|never states/i)
      expect(s).not.toMatch(/cannot be turned into a floor area|buildable area/i)
    }
    // Names the alternative it refused, rather than reading as a gap.
    expect(found.join(' ')).toMatch(/net lot area|gross lot area/i)
  })

  it('does not say the ratio is unpublished', () => {
    const found = [...feas.matchAll(elective)].map((m) => m[1])
    expect(found.join(' ')).toMatch(/publishe?s?/i)
    expect(found.join(' ')).not.toMatch(/not published for this district/i)
  })
})

// ── THE VERDICT ───────────────────────────────────────────────────────────────
// Withholding the envelope's product did NOT reach this consumer: the FAR
// dimension check reads `farByUse` directly and compares `gfa / lot.sizeSqFt`
// against it — the NET denominator — so an elective district was being judged on
// the smaller of the two areas its code offers. Measured on production before
// the fix, an SPI-11 SA2 parcel returned `far PROHIBITED`, "isn't buildable as
// proposed", against a ratio the applicant may apply to gross lot area instead.
describe('an elective denominator cannot produce a not-buildable verdict', () => {
  const project = (gfa: number): AnalysisInput =>
    ({ use: 'residential', gfa, units: 20, heightFt: null, stories: null, city: 'atlanta' }) as unknown as AnalysisInput

  const electiveParcel = parcel({
    farByUse: { residential: 2.0 },
    farElectiveByUse: { residential: true },
    allowedUses: null,
    maxHeightFt: null,
  })

  it('does not report PROHIBITED on a proposal that overshoots the NET reading', () => {
    // 36,000 sf on a 10,000 sf lot is FAR 3.6 against a stated 2.0 — 1.8×, the
    // exact overshoot that returned PROHIBITED on production.
    const f = assessFeasibility(electiveParcel, project(36_000))
    const far = f.checks.filter((c) => c.dimension === 'far')
    expect(far.map((c) => c.status)).not.toContain('PROHIBITED')
    expect(f.overall).not.toBe('PROHIBITED')
  })

  it('emits exactly ONE far check, not a pair that contradict each other', () => {
    // Production showed `far AS_OF_RIGHT · max FAR 0.70` directly above
    // `far INDETERMINATE · you choose which lot area`, on the same parcel.
    for (const gfa of [5_000, 36_000]) {
      const far = assessFeasibility(electiveParcel, project(gfa)).checks.filter((c) => c.dimension === 'far')
      expect(far.length, `gfa ${gfa}`).toBe(1)
      expect(far[0].status).toBe('INDETERMINATE')
      expect(far[0].allowed).not.toMatch(/^max FAR/)
      expect(far[0].allowed).not.toMatch(/not derivable/)
    }
  })

  it('still judges a NON-elective district normally', () => {
    // The control that keeps the guard from being a blanket suppression: the
    // same overshoot on a district that states its denominator must still bite.
    const stated = parcel({ farByUse: { residential: 2.0 }, allowedUses: null, maxHeightFt: null })
    const far = assessFeasibility(stated, project(36_000)).checks.filter((c) => c.dimension === 'far')
    expect(far.length).toBe(1)
    expect(far[0].status).toBe('PROHIBITED')
  })
})

// ── THE THIRD CONSUMER ────────────────────────────────────────────────────────
// `inverse.ts` powers "what would it take", and it read `farByUse` the same way
// the feasibility check did — `gfa / lot` against the net denominator, then
// classified the gap into a relief instrument. On an elective district that
// tells the reader they need a REZONING to reach a floor area the code may
// already allow them.
describe('what-would-it-take does not prescribe relief against a basis you have not chosen', () => {
  const elective = parcel({
    farByUse: { residential: 2.0 },
    farElectiveByUse: { residential: true },
    allowedUses: null,
    maxHeightFt: null,
  })

  it('names the choice instead of the instrument', () => {
    const r = whatWouldItTake(elective, 'atlanta', { use: 'residential', gfaSqFt: 36_000 })
    const far = r.constraints.filter((c) => c.dimension === 'far')
    expect(far.length).toBe(1)
    expect(far[0].relief).toBe('elective-basis')
    // The two verdicts it must never reach: a relief prescription, and the
    // "could not be resolved" sentence that is false of a published ratio.
    expect(['beyond-variance', 'dimensional-variance']).not.toContain(far[0].relief)
    expect(far[0].note).not.toMatch(/could not be resolved/i)
    expect(r.unresolved).toContain('far')
  })

  it('does not put a derivation on the page for a ratio it did not apply', () => {
    const r = whatWouldItTake(elective, 'atlanta', { use: 'residential', gfaSqFt: 36_000 })
    // "36,000 sq ft on a 10,000 sq ft lot → FAR 3.60; the district allows 2.00"
    // is exactly the sentence that must not appear: the district allows 2.00
    // times an area the reader has not picked.
    expect(r.derivation.join(' ')).not.toMatch(/the district allows/i)
  })

  it('still prescribes relief for a district that states its denominator', () => {
    const stated = parcel({ farByUse: { residential: 2.0 }, allowedUses: null, maxHeightFt: null })
    const far = whatWouldItTake(stated, 'atlanta', { use: 'residential', gfaSqFt: 36_000 })
      .constraints.filter((c) => c.dimension === 'far')
    expect(far[0].relief).toBe('beyond-variance')
  })
})

// ── THE UNION HAS ONE HOME ────────────────────────────────────────────────────
describe('ReliefKind is imported by its consumers, never restated', () => {
  it('is declared exactly once in the repo', () => {
    const files = [
      'src/types/parcel.ts',
      'netlify/functions/lib/inverse.ts',
      'src/components/WhatWouldItTake.tsx',
    ]
    const decls = files.filter((f) => /export type ReliefKind =/.test(read(f)))
    // A restated copy compiles fine and silently stops being an exhaustiveness
    // check — which is how `elective-basis` reached two `Record<ReliefKind, …>`
    // maps in the client without either failing.
    expect(decls).toEqual(['src/types/parcel.ts'])
  })
})
