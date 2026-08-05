import { describe, it, expect } from 'vitest'
import { laLimits, stripLaQualifier } from './la'

// Verified 2026-08-05 against the PRIMARY source: Los Angeles Municipal Code
// Chapter 1, Article 2, § 12.21.1 (HEIGHT OF BUILDING OR STRUCTURES), read on
// codelibrary.amlegal.com — LAMC current through legislation effective
// 3/31/2026. § 12.21.1 A.1 last amended by Ord. No. 181,624, Eff. 5/9/11;
// A.2–A.4 by Ord. No. 161,684, Eff. 11/3/86.
//
// These call laLimits() itself, not a copy of its regex — the previous LA test
// replicated the pattern into the test file, which measures the probe rather
// than the pipeline (CLAUDE.md rule 11).

describe('LA height districts — figures the code states (LAMC § 12.21.1 A.1–A.4)', () => {
  it('1-SS publishes 18 ft; it shipped with NO height limit at all', () => {
    // WAS: h null → maxHeightFt null → the feasibility height check is skipped
    // and a 1-SS parcel reads as unconstrained in height.
    // § 12.21.1 A.1: "no Building or Structure in Height District No. 1-SS shall
    // exceed one Story, nor shall the highest point of the roof of any Building
    // or Structure located in this District exceed 18 feet in height."
    expect(laLimits('R1-1SS').h).toBe(18)
    expect(laLimits('RE9-1SS').h).toBe(18)
  })

  it('1-SS carries the story count the code states, rather than deriving one', () => {
    // "shall not exceed one Story" — stated, so it is not re-derived by dividing
    // 18 ft by a floor-to-floor convention (CLAUDE.md rule 12).
    expect(laLimits('R1-1SS').s).toBe(1)
  })

  it('1-SS is only ever an RA/RE/RS/R1 designation, so its FAR stays a gap', () => {
    // § 12.21.1 A.1 excepts exactly RA, RE, RS and R1 from the height district's
    // floor area, and 1-SS may only be applied "In the RA, RE, RS, and R1 Zones".
    expect(laLimits('R1-1SS').f).toBeNull()
  })

  it('1-L is 75 ft / six stories and 1-XL is 30 ft', () => {
    // "no Building or Structure in Height District No. 1-L shall exceed six
    // Stories, nor shall it exceed 75 feet in height."
    expect(laLimits('C2-1L')).toMatchObject({ h: 75, s: 6 })
    // "...in Height District No. 1-XL shall exceed two Stories, nor shall the
    // highest point of the roof ... exceed 30 feet in height."
    expect(laLimits('C2-1XL').h).toBe(30)
  })

  it('1-VL is 45 ft and publishes NO story count', () => {
    // "...in Height District No. 1-VL shall exceed three Stories, nor shall it
    // exceed 45 feet in height." The three-story limit is withheld because of the
    // EXCEPTION in the same subdivision: "A Building in Height District Nos.
    // 1-XL, 1-VL, designed and used entirely for residential purposes, or a
    // Building in the RAS3 or RAS4 Zones shall be limited as to the number of
    // feet in height, but not as to the number of Stories." Publishing 3 would
    // assert a cap that does not bind the residential case.
    expect(laLimits('C2-1VL')).toMatchObject({ h: 45, s: null })
    expect(laLimits('C2-1XL').s).toBeNull()
  })

  it('RAS3 / RAS4 in 1-VL are 50 ft, not the district-wide 45', () => {
    // "Notwithstanding that limitation, portions of Height District No. 1-VL
    // that are also in the RAS3 or RAS4 Zones shall not exceed 50 feet in
    // height." WAS: 45 ft for these two zones.
    expect(laLimits('RAS3-1VL').h).toBe(50)
    expect(laLimits('RAS4-1VL').h).toBe(50)
  })

  it('FAR by height district: 3.0 / 6.0 / 10.0 / 13.0, and 1.5 in a C or M zone in HD 1', () => {
    // A.1 "three times the Buildable Area"; A.1 "one-and-one-half times the
    // Buildable Area ... in a commercial or industrial zone in Height District
    // No. 1"; A.2 "six times"; A.3 "ten times"; A.4 "thirteen times".
    expect(laLimits('R3-1').f).toBe(3.0)
    expect(laLimits('C2-1').f).toBe(1.5)
    expect(laLimits('M2-1').f).toBe(1.5)
    expect(laLimits('C4-2').f).toBe(6.0)
    expect(laLimits('C2-3').f).toBe(10.0)
    expect(laLimits('C2-4').f).toBe(13.0)
  })
})

describe('LA base-zone height caps that the height district does not carry', () => {
  it('R3 and RD in Height District 1 are capped at 45 ft; both shipped as null', () => {
    // § 12.21.1 preamble: "In the A1, A2, RZ, RMP, and RW2 Zones, and in those
    // portions of the RD and R3 Zones, which are also in Height District No. 1,
    // no Building or Structure shall exceed 45 feet in height."
    // WAS: h null for every one of these — no height limit published.
    expect(laLimits('R3-1').h).toBe(45)
    expect(laLimits('RD1.5-1').h).toBe(45)
    expect(laLimits('RZ2.5-1').h).toBe(45)
    expect(laLimits('RW2-1').h).toBe(45)
    expect(laLimits('A2-1').h).toBe(45)
  })

  it('CR, R3, RD and RAS3 in Height Districts 2/3/4 are capped at 75 ft', () => {
    // § 12.21.1 preamble: "In the CR Zone and those portions of the RD, R3, and
    // RAS3 Zones, which are in Height District Nos. 2, 3 or 4, no building or
    // structure shall exceed six stories nor shall it exceed 75 feet in height."
    // WAS: h null. The story half is not published — the same sentence continues
    // "However, a building designed and used entirely for residential purposes
    // ... shall only be limited as to the number of feet in height."
    expect(laLimits('R3-2')).toMatchObject({ h: 75, s: null })
    expect(laLimits('CR-3').h).toBe(75)
    expect(laLimits('RAS3-4').h).toBe(75)
    expect(laLimits('RD2-2').h).toBe(75)
  })

  it('RU and RW1 are 30 ft in every height district', () => {
    // § 12.21.1 preamble: "In the RU and RW1 Zones, no Building or Structure
    // shall exceed 30 feet in height." — stated with no district qualifier.
    expect(laLimits('RU-1').h).toBe(30)
    expect(laLimits('RW1-1').h).toBe(30)
  })

  it('the lower of the two caps governs, and the story count goes with it', () => {
    // R3 in 1-L is subject to both the district's 75 ft and the base zone's
    // 45 ft. 45 governs — and the district's six-story figure must NOT ride
    // along, since six stories under a 45 ft cap is not a thing the code allows.
    expect(laLimits('R3-1L')).toMatchObject({ h: 45, s: null })
    // R3 in 1-XL: 30 ft district cap beats the 45 ft base cap.
    expect(laLimits('R3-1XL').h).toBe(30)
  })

  it('leaves the hillside/coastal-conditional caps as a gap, not an answer', () => {
    // § 12.21.1's 33 ft (R2, R1/RS/RE9) and 36 ft (RE11+/RA) figures are prefaced
    // "shall apply on a Lot that is not located in a Hillside Area or Coastal
    // Zone". Hillside status is not in our data, so no height is asserted.
    expect(laLimits('R1-1').h).toBeNull()
    expect(laLimits('R2-1').h).toBeNull()
    expect(laLimits('RA-1').h).toBeNull()
  })

  it('a commercial lot in Height District 1 has no height cap and is not given one', () => {
    expect(laLimits('C2-1').h).toBeNull()
    expect(laLimits('M1-1').h).toBeNull()
  })
})

describe('LA qualifier prefixes — one stripper, both callers', () => {
  it('strips the bracket forms LA publishes', () => {
    expect(stripLaQualifier('[Q]C2-1')).toBe('C2-1')
    expect(stripLaQualifier('(Q)C1-1')).toBe('C1-1')
    expect(stripLaQualifier('[T]R3-1')).toBe('R3-1')
    expect(stripLaQualifier('(F)CM-1-CUGU')).toBe('CM-1-CUGU')
    expect(stripLaQualifier('(WC)COLLEGE-SN')).toBe('COLLEGE-SN')
  })

  it('leaves an unqualified zone string untouched', () => {
    for (const z of ['C2-1', 'R1-1XL', 'RE11-1', 'CM-1']) expect(stripLaQualifier(z)).toBe(z)
  })

  it('the (F) prefix reaches the limits parser', () => {
    // The 2026-08-04 defect, pinned against the real function: (F)CM-1 parsed
    // its base as "(F)CM", so the commercial Height-District-1 override never
    // fired and FAR 3.0 was published where § 12.21.1 A.1 sets 1.5.
    expect(laLimits('(F)CM-1-CUGU').f).toBe(1.5)
    // (F)RE11-1 skipped the base-controlled test and asserted a FAR where the
    // code gives none.
    expect(laLimits('(F)RE11-1').f).toBeNull()
  })
})
