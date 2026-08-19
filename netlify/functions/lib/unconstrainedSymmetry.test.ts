import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { assessFeasibility } from './feasibility'
import { whatWouldItTake } from './inverse'
import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput } from '../../../src/types/analysis'

// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
//
// `farUnconstrained` and `heightUnconstrained` express the SAME distinction
// about two different instruments: the code imposes none here (an answer) versus
// we could not read one (a gap). For months only FAR had a flag. Three zoning
// modules — atlanta, dallas, charlotte — resolved the height fact with citations
// and each carried a comment saying the shared type had nowhere to put it, so
// sixteen Atlanta subareas whose code prints "Maximum Building Height: None"
// reached the engine as `maxHeightFt: null` and rendered as "no district height
// limit is available in public data".
//
// The asymmetry is the whole failure: nobody decided height's known absence was
// a gap. One instrument got a field and the other did not, and every consumer
// inherited the difference silently. So this asserts the pair moves together,
// in the type and at both consumers.

const ROOT = resolve(__dirname, '../../..')

const parcel = (z: Partial<ParcelInfo['zoning']> = {}): ParcelInfo =>
  ({
    address: '1 Main St', addressBasis: 'record', parcelId: '1', coordinates: [-84.4, 33.7],
    zoning: {
      districtCode: 'SPI-1 SA1', subdistrict: null, article: null,
      maxHeightFt: null, maxFAR: 25, allowedUses: ['residential', 'mixed'], ...z,
    },
    lot: { sizeSqFt: 10000, lotType: null },
    overlays: { historicDistrict: null, floodZone: null },
    existing: { landUse: null },
    sources: {}, fetchedAt: '2026-08-19T00:00:00.000Z',
  }) as ParcelInfo

const project = (o: Partial<AnalysisInput> = {}): AnalysisInput =>
  ({
    parcelId: '1', city: 'atlanta', projectType: 'new', funding: 'private',
    lat: 33.7, lng: -84.4, use: 'residential', gfa: 50000, heightFt: 300, ...o,
  }) as AnalysisInput

const heightCheck = (p: ParcelInfo, pr = project()) =>
  assessFeasibility(p, pr).checks.find((c) => c.dimension === 'height')

describe('the two flags express the same distinction', () => {
  it('both exist on the shared zoning type', () => {
    // Read as text: a compile-time reference would pass by inference even if one
    // were removed, and the point is that neither may quietly disappear.
    const t = readFileSync(join(ROOT, 'src/types/parcel.ts'), 'utf8')
    expect(t).toMatch(/farUnconstrained\?: boolean/)
    expect(t).toMatch(/heightUnconstrained\?: boolean/)
  })

  it('every provider that resolves the height fact now passes it through', () => {
    // These three each carried a comment saying the type had no field for it.
    // If one stops forwarding the flag, its districts silently go back to
    // rendering a known absence as missing data.
    for (const city of ['atlanta', 'charlotte', 'dallas']) {
      const src = readFileSync(join(ROOT, `netlify/functions/lib/providers/${city}.ts`), 'utf8')
      expect(src, city).toMatch(/heightUnconstrained \? \{ heightUnconstrained: true \}/)
    }
  })
})

describe('the feasibility engine treats a stated absence as an answer', () => {
  it('does not tell the reader the limit is unavailable when the code states none', () => {
    const c = heightCheck(parcel({ heightUnconstrained: true }))
    expect(c?.status).toBe('AS_OF_RIGHT')
    expect(c?.allowed).toBe('no maximum')
    // The exact sentence this replaced, which was false for these districts.
    expect(c?.note ?? '').not.toMatch(/available in public data/)
  })

  it('still says so when the limit genuinely is unavailable', () => {
    const c = heightCheck(parcel())
    expect(c?.status).toBe('INDETERMINATE')
    expect(c?.note ?? '').toMatch(/available in public data/)
  })

  it('and names what still governs, because "no ceiling" is not "nothing applies"', () => {
    const c = heightCheck(parcel({ heightUnconstrained: true }))
    expect(c?.note ?? '').toMatch(/transitional height plane/)
  })

  it('handles a storey proposal against an unconstrained district too', () => {
    // A storey count is the other way a user states height, and it fell through
    // to a different branch. Both must reach the same answer.
    const c = heightCheck(parcel({ heightUnconstrained: true }), project({ heightFt: undefined, stories: 40 }))
    expect(c?.status).toBe('AS_OF_RIGHT')
    expect(c?.allowed).toBe('no maximum')
  })

  it('an unconstrained height does not drag the overall verdict down', () => {
    // INDETERMINATE would have. A district with no ceiling should not make a
    // project read as undecidable on height.
    const f = assessFeasibility(parcel({ heightUnconstrained: true }), project())
    expect(f.overall).not.toBe('INDETERMINATE')
  })
})

describe('the inverse query agrees with the forward pass', () => {
  it('reports no-limit rather than unknown, and keeps the answer complete', () => {
    const r = whatWouldItTake(parcel({ heightUnconstrained: true }), 'atlanta', {
      use: 'residential', heightFt: 900,
    })
    const h = r.constraints.find((c) => c.dimension === 'height')
    expect(h?.relief).toBe('no-limit')
    expect(r.unresolved).not.toContain('height')
  })

  it('and the two directions do not disagree on the same parcel', () => {
    // The failure this closes: one saying the height is fine and the other
    // saying it could not be checked, off identical inputs.
    const p = parcel({ heightUnconstrained: true })
    const fwd = heightCheck(p, project({ heightFt: 900 }))
    const inv = whatWouldItTake(p, 'atlanta', { use: 'residential', heightFt: 900 })
      .constraints.find((c) => c.dimension === 'height')
    expect(fwd?.status).toBe('AS_OF_RIGHT')
    expect(inv?.relief).toBe('no-limit')
  })
})

describe('⚠️ a CONDITIONAL absence is not this flag', () => {
  it("Denver's downtown districts deliberately withhold it, and say why", () => {
    // § 8.3.1.4.B.2: heights "are not limited EXCEPT in the following height
    // areas as shown on Exhibit 8.1" — 200 ft and 400 ft over three mapped
    // areas, on a figure no published layer carries. Setting the flag would be
    // wrong by 2x for a Height Area 1 parcel, in the flattering direction.
    //
    // Asserted against the module text because the refusal is the finding: a
    // future edit that "completes" Denver by setting the flag is exactly the
    // mistake, and it would otherwise look like progress.
    const src = readFileSync(join(ROOT, 'netlify/functions/lib/zoning/denver.ts'), 'utf8')
    expect(src).toMatch(/HEIGHT DELIBERATELY WITHHELD, and NOT as `heightUnconstrained`/)
    expect(src).toMatch(/Exhibit 8\.1/)
    // And the flag really is absent from Denver's resolved output.
    expect(src).not.toMatch(/heightUnconstrained: true/)
  })
})
