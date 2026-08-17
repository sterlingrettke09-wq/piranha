import { describe, it, expect } from 'vitest'
import { computeEnvelope } from './envelope'
import type { ParcelInfo } from '../../../src/types/parcel'

// Minimal ParcelInfo factory — only the fields computeEnvelope reads matter.
function info(over: {
  districtCode?: string
  maxFAR?: number | null
  maxHeightFt?: number | null
  allowedUses?: string[] | null
  farByUse?: ParcelInfo['zoning']['farByUse']
  farUnconstrained?: boolean
  farAppliesTo?: 'buildable-area'
  planGoverned?: boolean
  lotSqFt?: number | null
}): ParcelInfo {
  return {
    address: '1 Test St',
    addressBasis: 'record',
    parcelId: 'T1',
    coordinates: [-71.06, 42.36],
    zoning: {
      districtCode: over.districtCode ?? 'R-1',
      subdistrict: null,
      article: null,
      maxFAR: over.maxFAR ?? null,
      maxHeightFt: over.maxHeightFt ?? null,
      allowedUses: over.allowedUses ?? null,
      farByUse: over.farByUse,
      ...(over.farUnconstrained ? { farUnconstrained: true } : {}),
      ...(over.farAppliesTo ? { farAppliesTo: over.farAppliesTo } : {}),
      ...(over.planGoverned ? { planGoverned: true } : {}),
    },
    lot: { sizeSqFt: over.lotSqFt ?? null, lotType: null },
    overlays: { historicDistrict: null, floodZone: null },
    sources: {},
    fetchedAt: '2026-06-09T00:00:00Z',
  }
}

describe('computeEnvelope — Boston family heuristics', () => {
  it('derives FAR/height/uses from a B-2-65 code and sizes the envelope', () => {
    const env = computeEnvelope(info({ districtCode: 'B-2-65', lotSqFt: 10_000 }), 'boston')
    expect(env.maxFloorAreaSqFt).toBe(20_000) // family B FAR 2.0 × 10,000
    expect(env.maxHeightFt).toBe(65) // trailing height token
    // No per-use FAR → district basis → 13 ft/story (commercial). floor(65/13)=5.
    expect(env.farBasis).toBe('district')
    expect(env.maxStories).toBe(5)
    expect(env.allowedUses).toContain('residential')
    expect(env.maxUnits).toBe(15) // floor(20,000 / 1,300 gross sf/unit)
  })

  it('does not fabricate limits for word-named subdistricts', () => {
    const env = computeEnvelope(
      info({ districtCode: 'CHARLESTOWN NAVY YARD SUBDISTRICT', lotSqFt: 10_000 }),
      'boston',
    )
    expect(env.maxFloorAreaSqFt).toBeNull()
    expect(env.maxHeightFt).toBeNull()
    expect(env.maxUnits).toBeNull()
    expect(env.farBasis).toBeNull() // no FAR drove anything
  })
})

describe('computeEnvelope — per-use FAR pick and basis labeling (WO-5.5)', () => {
  it('headline floor area uses the RESIDENTIAL FAR when broken out, and labels the basis', () => {
    const env = computeEnvelope(
      info({
        districtCode: 'C6-7',
        maxFAR: 15,
        farByUse: { residential: 10, commercial: 15, mixed: 15, institutional: 15 },
        allowedUses: ['commercial', 'mixed', 'residential'],
        lotSqFt: 1_000,
      }),
      'nyc',
    )
    expect(env.maxFloorAreaSqFt).toBe(10_000) // residential FAR 10, not the 15 headline max
    expect(env.farBasis).toBe('residential')
  })

  it('uses the MIXED FAR (and 0.85 residential-share for units) when no residential FAR exists', () => {
    const env = computeEnvelope(
      info({
        districtCode: 'C6-7',
        farByUse: { mixed: 10, commercial: 15 },
        allowedUses: ['commercial', 'mixed'],
        lotSqFt: 1_000,
      }),
      'nyc',
    )
    expect(env.maxFloorAreaSqFt).toBe(10_000) // mixed FAR 10
    expect(env.farBasis).toBe('mixed')
    // Mixed envelope isn't 100% residential: floor(10,000 × 0.85 / 1,300) = 6.
    expect(env.maxUnits).toBe(6)
  })

  it('falls back to the district maxFAR (basis "district") when no per-use FAR exists', () => {
    const env = computeEnvelope(
      info({ districtCode: 'MU-4', maxFAR: 2.5, allowedUses: ['mixed'], lotSqFt: 4_000 }),
      'dc',
    )
    expect(env.maxFloorAreaSqFt).toBe(10_000)
    expect(env.farBasis).toBe('district')
    // District basis → no 0.85 share applied; 10,000 / 1,300 = 7.
    expect(env.maxUnits).toBe(7)
  })

  it('uses 13 ft/story for a district basis and 11 ft/story for a residential basis', () => {
    const district = computeEnvelope(
      info({ districtCode: 'C-1', maxFAR: 4, maxHeightFt: 130, allowedUses: ['commercial'], lotSqFt: 1_000 }),
      'nyc',
    )
    expect(district.farBasis).toBe('district')
    expect(district.maxStories).toBe(10) // floor(130 / 13)

    const residential = computeEnvelope(
      info({
        districtCode: 'R-1',
        maxHeightFt: 130,
        farByUse: { residential: 4 },
        allowedUses: ['residential'],
        lotSqFt: 1_000,
      }),
      'nyc',
    )
    expect(residential.farBasis).toBe('residential')
    expect(residential.maxStories).toBe(11) // floor(130 / 11)
  })
})

describe('computeEnvelope — null propagation', () => {
  it('returns null floor area without a lot size, null stories without a height', () => {
    const env = computeEnvelope(info({ districtCode: 'B-2', lotSqFt: null }), 'boston')
    expect(env.maxFloorAreaSqFt).toBeNull()
    expect(env.maxStories).toBeNull() // B-2 has no trailing height token
  })

  it('keeps the residential 11 ft default for a known height with no FAR basis', () => {
    // Height present, but no FAR anywhere → basis null → default to residential
    // 11 ft/story (the taller, conservative story count).
    const env = computeEnvelope(
      info({ districtCode: 'UNKNOWN ZONE', maxHeightFt: 55, lotSqFt: null }),
      'nyc',
    )
    expect(env.farBasis).toBeNull()
    expect(env.maxStories).toBe(5) // floor(55 / 11)
  })

  it('returns null maxUnits when residential is not an allowed use', () => {
    const env = computeEnvelope(
      info({ districtCode: 'M1', maxFAR: 2, allowedUses: ['commercial', 'institutional'], lotSqFt: 10_000 }),
      'chicago',
    )
    expect(env.maxFloorAreaSqFt).toBe(20_000)
    expect(env.maxUnits).toBeNull()
    expect(env.farBasis).toBe('district')
  })
})

// ── storiesBasis: a stated story count is a fact; a derived one is an assumption ──
describe('envelope — storiesBasis marks derived story counts', () => {
  // Annotated, not inferred: an un-annotated const is not excess-property
  // checked, and it is spread into the call below — where a spread is not
  // checked either. Without the annotation `base` accepts any misspelling and
  // this whole storiesBasis suite goes inert. (`as [number, number]` is
  // unnecessary once the annotation supplies the tuple context.)
  const base: Omit<ParcelInfo, 'zoning'> = {
    address: 'x', addressBasis: 'record', parcelId: 'p', coordinates: [-97.7, 30.3],
    lot: { sizeSqFt: 10000, lotType: null },
    overlays: { historicDistrict: null, floodZone: null },
    sources: {}, fetchedAt: '2026-08-04T00:00:00.000Z',
  }
  const z = (o: Partial<ParcelInfo['zoning']>): ParcelInfo['zoning'] => ({
    districtCode: 'X', subdistrict: null, article: null,
    maxHeightFt: null, maxFAR: null, allowedUses: ['residential'], ...o,
  })

  it("marks 'stated' when the code supplies the story count", () => {
    const env = computeEnvelope({ ...base, zoning: z({ maxStories: 80, maxHeightFt: 1120 }) }, 'miami')
    expect(env.maxStories).toBe(80)
    expect(env.storiesBasis).toBe('stated')
  })

  it("marks 'derived' when we divided a published height by the convention", () => {
    const env = computeEnvelope({ ...base, zoning: z({ maxHeightFt: 200 }) }, 'boston')
    expect(env.storiesBasis).toBe('derived')
    expect(env.maxStories).toBe(18) // 200 / 11
  })

  it('omits the basis entirely when there is no story count at all', () => {
    const env = computeEnvelope({ ...base, zoning: z({}) }, 'boston')
    expect(env.maxStories).toBeNull()
    expect(env.storiesBasis).toBeUndefined()
  })

  it('a stated count is NEVER overridden by a derivable height', () => {
    // The Miami/Denver bug: both present, the code's figure must win.
    const env = computeEnvelope({ ...base, zoning: z({ maxStories: 12, maxHeightFt: 144 }) }, 'denver')
    expect(env.maxStories).toBe(12) // not floor(144/11) = 13
  })
})

describe('planned-development districts', () => {
  // A PD parcel has a floor-area limit; it is in the ordinance that created the
  // district, not in any table. Before this bucket existed these reported as
  // GAPS, which told the reader we had failed to find a figure that is not in a
  // district table to begin with.
  it.each([
    ['dallas', 'PD 193'],
    ['chicago', 'PD 1103'],
    ['sanjose', 'A(PD)'],
    ['nashville', 'SP-2019-12'],
    ['columbus', 'PUD4'],
    ['lasvegas', 'PD'],
    ['atlanta', 'PD-MU'],
  ])('%s / %s reports farBasis planned-development', (city, districtCode) => {
    const env = computeEnvelope(info({ districtCode, lotSqFt: 10_000 }), city)
    expect(env.farBasis).toBe('planned-development')
    // No invented floor area — the binding figure is in a document we have not read.
    expect(env.maxFloorAreaSqFt).toBeNull()
  })

  it('never overrides a FAR the city actually resolved', () => {
    // Defensive ordering: if a provider ever does resolve a figure for a PD
    // parcel, that figure wins. The PD branch is a fallback for the null case,
    // not a veto on real data.
    const env = computeEnvelope(info({ districtCode: 'PD 193', maxFAR: 3, lotSqFt: 10_000 }), 'dallas')
    expect(env.farBasis).toBe('district')
    expect(env.maxFloorAreaSqFt).toBe(30_000)
  })

  it('outranks farUnconstrained, because it is the more specific claim', () => {
    // "set by its own ordinance" tells the reader where to look; "no FAR
    // applies" tells them there is nothing to look for. Both would be
    // defensible renderings, and they are not the same sentence.
    const env = computeEnvelope(info({ districtCode: 'PD 193', farUnconstrained: true, lotSqFt: 10_000 }), 'dallas')
    expect(env.farBasis).toBe('planned-development')
  })

  it('leaves ordinary districts in the same cities alone', () => {
    // The over-match direction is the expensive one: turning a by-right
    // district into "governed by an ordinance" SUPPRESSES a real answer.
    for (const [city, code] of [
      ['dallas', 'R-7.5(A)'],
      ['chicago', 'B3-2'],
      ['sanjose', 'R-1-8'],
      ['nashville', 'RS10'],
      ['columbus', 'R4'],
      ['lasvegas', 'R-PD4'],
      ['atlanta', 'R-4'],
    ] as const) {
      expect(computeEnvelope(info({ districtCode: code, lotSqFt: 10_000 }), city).farBasis).not.toBe(
        'planned-development',
      )
    }
  })

  it('does not classify a PD-looking code in a city with no established rule', () => {
    // DC's PDR districts are ordinary by-right zones. An absence is only an
    // answer once someone has looked (rule 23).
    expect(computeEnvelope(info({ districtCode: 'PDR-1', lotSqFt: 10_000 }), 'dc').farBasis).not.toBe(
      'planned-development',
    )
  })
})

describe("farAppliesTo: 'buildable-area' — the FAR is known, its multiplicand is not", () => {
  // THE DEFECT THIS EXISTS TO PREVENT. LAMC § 12.21.1 A.1 caps floor area at
  // "three times the Buildable Area of the Lot" — the lot MINUS its required
  // yards — while this function multiplies by the lot. Buildable area is never
  // larger than the lot, so every LA floor area we published was an upper bound
  // that overstated by the yard fraction, on the RESOLVED side of the ledger
  // where scrutiny does not go (rule 18).
  //
  // It cannot be corrected, only withheld: LA's required front yard is the
  // PREVAILING setback — the average of the front yards already built on 40%+
  // of the frontage — so buildable area is a fact about the street, not about
  // the parcel or its zone. Inventing a lot→buildable ratio is rule 4.

  it('withholds the floor area even though maxFAR resolved', () => {
    const env = computeEnvelope(
      info({ maxFAR: 3.0, farAppliesTo: 'buildable-area', lotSqFt: 10_000 }),
      'la',
    )
    expect(env.farBasis).toBe('basis-unavailable')
    expect(env.maxFloorAreaSqFt).toBeNull()
  })

  it('withholds the UNIT COUNT too, which is the half that was live elsewhere', () => {
    // maxUnits derives from maxFloorAreaSqFt, so withholding one withholds the
    // other. This is what closes LA's R3/R4/R5 exposure: those zones published
    // FAR 3.0 straight into a unit count with no density check, while R2/RD/RW
    // were withheld upstream precisely to avoid that. The guard was on the
    // quieter zones.
    const env = computeEnvelope(
      info({
        maxFAR: 3.0,
        farAppliesTo: 'buildable-area',
        allowedUses: ['residential'],
        lotSqFt: 10_000,
      }),
      'la',
    )
    expect(env.maxUnits).toBeNull()
  })

  it('does NOT suppress height or stories — those resolve independently', () => {
    // Withholding must be surgical. Height comes from the height district and
    // has no buildable-area dependency; dropping it would turn one honest gap
    // into three.
    const env = computeEnvelope(
      info({ maxFAR: 3.0, farAppliesTo: 'buildable-area', maxHeightFt: 75, lotSqFt: 10_000 }),
      'la',
    )
    expect(env.maxHeightFt).toBe(75)
    expect(env.maxStories).not.toBeNull()
  })

  it('takes precedence over every other basis, because maxFAR IS populated', () => {
    // The ordering guard. Each of these would otherwise consume the FAR and
    // multiply it by the lot — this branch has to run FIRST or it never runs.
    for (const over of [
      { farByUse: { residential: 2.0 } },
      { farByUse: { mixed: 2.0 } },
      { farUnconstrained: true },
      // `planGoverned` is DELIBERATELY ABSENT from this list. It used to be
      // here, asserting that an unusable basis outranked everything — and that
      // interpretation was overturned: a planned-development parcel has a
      // document the reader can go and read, so the more specific code wins.
      // See the specificity block below, which pins the exception.
    ]) {
      const env = computeEnvelope(
        info({ maxFAR: 3.0, farAppliesTo: 'buildable-area', lotSqFt: 10_000, ...over }),
        'la',
      )
      expect(env.farBasis, JSON.stringify(over)).toBe('basis-unavailable')
      expect(env.maxFloorAreaSqFt, JSON.stringify(over)).toBeNull()
    }
  })

  it('THE CONTROL: an identical parcel without the flag is unchanged', () => {
    // Rule 20 in the other direction — a withholding test passes trivially if
    // the pipeline stopped producing floor area for everyone. This pins that
    // the ONLY difference is the flag.
    const env = computeEnvelope(
      info({ maxFAR: 3.0, allowedUses: ['residential'], lotSqFt: 10_000 }),
      'boston',
    )
    expect(env.farBasis).toBe('district')
    expect(env.maxFloorAreaSqFt).toBe(30_000)
    expect(env.maxUnits).toBeGreaterThan(0)
  })

  it('is not asserted for any city that has not established it', () => {
    // An absence is only an answer once someone has looked (rule 23). Atlanta is
    // the specific near-miss: its code says "net lot area", which READS like a
    // different basis, and §16-28.006 established that net lot area IS the lot.
    // It must not acquire this state by resemblance.
    for (const city of ['atlanta', 'boston', 'nyc', 'chicago', 'seattle']) {
      const env = computeEnvelope(info({ maxFAR: 2.0, lotSqFt: 10_000 }), city)
      expect(env.farBasis, city).not.toBe('basis-unavailable')
    }
  })
})

describe('specificity: when two true reason codes apply, the more actionable wins', () => {
  // An LA parcel with a "D" Development Limitation is BOTH: the code states its
  // FAR against buildable area (uncomputable) AND the binding figure is in the
  // ordinance that imposed the D. Only one of those tells the reader what to do
  // next, so planned-development wins.

  it('a D-limitation parcel reports planned-development, not basis-unavailable', () => {
    const env = computeEnvelope(
      info({ districtCode: 'C2-2D', maxFAR: 3.0, farAppliesTo: 'buildable-area', lotSqFt: 10_000 }),
      'la',
    )
    expect(env.farBasis).toBe('planned-development')
    expect(env.maxFloorAreaSqFt).toBeNull()
  })

  it('an ordinary LA parcel still reports basis-unavailable', () => {
    // The discriminator. If this ever flips to planned-development, the D-suffix
    // match has widened and every LA parcel is being sent to an ordinance that
    // does not exist for it.
    for (const districtCode of ['C2-2', 'R3-1', 'C4-2', 'R1-1', 'M1-1']) {
      const env = computeEnvelope(
        info({ districtCode, maxFAR: 3.0, farAppliesTo: 'buildable-area', lotSqFt: 10_000 }),
        'la',
      )
      expect(env.farBasis, districtCode).toBe('basis-unavailable')
    }
  })

  it('the specificity rule is scoped to the unusable-basis branch only', () => {
    // THE CONSTRAINT THAT MAKES THE ORDERING SAFE. Outside LA, a PD district
    // whose FAR the city DID publish must keep publishing it — hoisting the PD
    // check to the top of the chain would suppress a real figure. Same claim as
    // 'never overrides a FAR the city actually resolved', asserted here against
    // the new branch so a future reorder cannot break one without the other.
    const env = computeEnvelope(info({ districtCode: 'PD 193', maxFAR: 2.0, lotSqFt: 10_000 }), 'dallas')
    expect(env.farBasis).toBe('district')
    expect(env.maxFloorAreaSqFt).toBe(20_000)
  })

  it('planGoverned also wins over an unusable basis', () => {
    // The provider-side flag and the registry are two sources for the same
    // fact; both must beat basis-unavailable or the answer depends on which
    // one happened to establish it.
    const env = computeEnvelope(
      info({ districtCode: 'SOMETHING', maxFAR: 3.0, farAppliesTo: 'buildable-area', planGoverned: true, lotSqFt: 10_000 }),
      'la',
    )
    expect(env.farBasis).toBe('planned-development')
  })
})

describe('an unreadable code must not claim a known ratio', () => {
  // FOUND BY THE ENUMERATION SWEEP, on a live parcel. LA sets
  // `farAppliesTo: 'buildable-area'` unconditionally because it describes the
  // CODE, not the parcel — so a district string the parser cannot read at all
  // was taking the basis-unavailable branch and disclosing "this district DOES
  // publish a floor-area ratio, but the code applies it to buildable area".
  // That is false about a district we never resolved.
  //
  // LA's new bracketed format is the live instance: 151 distinct codes like
  // [LN1-MU2-5][P2-FA][CPIO] over roughly 869 parcels.

  it('falls to a GAP when the flag is set but no ratio resolved', () => {
    const env = computeEnvelope(
      info({ districtCode: '[LN1-MU2-5][P2-FA][CPIO]', maxFAR: null, farAppliesTo: 'buildable-area', lotSqFt: 10_000 }),
      'la',
    )
    expect(env.farBasis).toBeNull()
    expect(env.maxFloorAreaSqFt).toBeNull()
  })

  it('still reports basis-unavailable when a ratio DID resolve', () => {
    // The discriminator. If this flips, the guard has been widened past its
    // justification and LA stops disclosing the buildable-area problem at all.
    const env = computeEnvelope(
      info({ districtCode: 'C2-1', maxFAR: 1.5, farAppliesTo: 'buildable-area', lotSqFt: 10_000 }),
      'la',
    )
    expect(env.farBasis).toBe('basis-unavailable')
  })

  it('a D-limitation parcel still reports planned-development either way', () => {
    // With a resolved ratio it takes the specificity branch; without one it
    // falls through to the later planned-development branch. Both must answer
    // the same, or the reason a reader sees would depend on whether the FAR
    // happened to parse.
    const withRatio = computeEnvelope(
      info({ districtCode: 'C2-2D', maxFAR: 3.0, farAppliesTo: 'buildable-area', lotSqFt: 10_000 }),
      'la',
    )
    const withoutRatio = computeEnvelope(
      info({ districtCode: '(Q)C2-1VLD', maxFAR: null, farAppliesTo: 'buildable-area', lotSqFt: 10_000 }),
      'la',
    )
    expect(withRatio.farBasis).toBe('planned-development')
    expect(withoutRatio.farBasis).toBe('planned-development')
  })
})
