import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { computeEnvelope } from './envelope'
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
