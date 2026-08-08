import { describe, it, expect } from 'vitest'
import {
  parseRaleighZone,
  resolveRaleigh,
  usesForZone,
  RALEIGH_HEIGHT_DESIGNATIONS,
  RALEIGH_RESIDENTIAL,
  RALEIGH_SPECIAL,
} from './raleigh'

// Sources read in full 2026-08-07 (PRIMARY, not a mirror or a summary):
//   https://udo.raleighnc.gov/udo-book/print-all-chapters
//   — the City's own consolidated Unified Development Ordinance, fetched from
//   the site's print index. Supplement 28 on Sec. 3.3.2; TC-1-25 on Sec. 2.2.8
//   and Sec. 4.6.2.
// District inventory from a live query of the City zoning layer
//   maps.raleighnc.gov/.../Planning/Zoning/MapServer/0 — 268 distinct ZONING
//   values, re-probed in isolation and stable.

// ─────────────────────────────────────────────────────────────────────────────
// The whole live district vocabulary, captured 2026-08-07. This is the
// denominator: every string the layer can hand the provider. Enumerating it is
// what turns "the parser looks right" into "the parser was exercised on
// everything production can feed it" (CLAUDE.md rule 11 — measure the pipeline,
// not a hand-picked probe).
const LIVE_ZONING_VALUES = [
  'AP', 'CM', 'CM-CU', 'CMP', 'CX-12', 'CX-12-CU', 'CX-12-UG-CU', 'CX-12-UL', 'CX-12-UL-CU',
  'CX-20-CU', 'CX-20-UL-CU', 'CX-3', 'CX-3-CU', 'CX-3-DE', 'CX-3-GR', 'CX-3-GR-CU', 'CX-3-PK',
  'CX-3-PK-CU', 'CX-3-PL', 'CX-3-PL-CU', 'CX-3-SH-CU', 'CX-3-UG', 'CX-3-UL', 'CX-3-UL-CU',
  'CX-4', 'CX-4-CU', 'CX-4-PL', 'CX-4-PL-CU', 'CX-4-UG-CU', 'CX-4-UL', 'CX-40-CU',
  'CX-40-UL-CU', 'CX-5', 'CX-5-CU', 'CX-5-GR-CU', 'CX-5-PK', 'CX-5-PK-CU', 'CX-5-PL',
  'CX-5-PL-CU', 'CX-5-SH', 'CX-5-SH-CU', 'CX-5-UG', 'CX-5-UG-CU', 'CX-5-UL', 'CX-5-UL-CU',
  'CX-7', 'CX-7-CU', 'CX-7-PK', 'CX-7-PL', 'CX-7-PL-CU', 'CX-7-SH', 'CX-7-SH-CU', 'CX-7-UG',
  'CX-7-UL', 'CX-7-UL-CU', 'DX-12', 'DX-12-SH', 'DX-12-SH-CU', 'DX-12-UG', 'DX-12-UG-CU',
  'DX-12-UL', 'DX-12-UL-CU', 'DX-20', 'DX-20-CU', 'DX-20-SH', 'DX-20-SH-CU', 'DX-20-UG',
  'DX-20-UG-CU', 'DX-20-UL-CU', 'DX-3', 'DX-3-CU', 'DX-3-DE', 'DX-3-SH', 'DX-3-UG',
  'DX-3-UG-CU', 'DX-3-UL', 'DX-30-CU', 'DX-30-SH-CU', 'DX-30-UG-CU', 'DX-4-SH', 'DX-4-UG',
  'DX-40-CU', 'DX-40-SH', 'DX-40-SH-CU', 'DX-40-UG-CU', 'DX-5', 'DX-5-CU', 'DX-5-SH',
  'DX-5-UG', 'DX-5-UG-CU', 'DX-5-UL', 'DX-7-SH', 'DX-7-UG', 'DX-7-UL', 'IH', 'IH-CU', 'IX-12',
  'IX-3', 'IX-3-CU', 'IX-3-GR', 'IX-3-PK', 'IX-3-PK-CU', 'IX-3-PL', 'IX-3-PL-CU', 'IX-3-UL',
  'IX-3-UL-CU', 'IX-4', 'IX-4-CU', 'IX-4-PL-CU', 'IX-4-UL', 'IX-4-UL-CU', 'IX-5', 'IX-5-CU',
  'IX-5-PK', 'IX-5-PL', 'IX-5-UG', 'IX-5-UL', 'IX-7', 'IX-7-PL', 'IX-7-UL', 'MH', 'NX-3',
  'NX-3-CU', 'NX-3-DE', 'NX-3-DE-CU', 'NX-3-GR', 'NX-3-GR-CU', 'NX-3-PK', 'NX-3-PK-CU',
  'NX-3-PL', 'NX-3-PL-CU', 'NX-3-SH', 'NX-3-UG', 'NX-3-UG-CU', 'NX-3-UL', 'NX-3-UL-CU', 'NX-4',
  'NX-4-CU', 'NX-4-GR', 'NX-4-PL-CU', 'NX-4-SH', 'NX-4-SH-CU', 'NX-4-UG', 'NX-4-UL',
  'NX-4-UL-CU', 'NX-5', 'NX-5-CU', 'NX-5-GR-CU', 'NX-5-SH-CU', 'NX-5-UG-CU', 'NX-5-UL',
  'NX-5-UL-CU', 'NX-7-CU', 'NX-7-PK-CU', 'NX-7-SH-CU', 'NX-7-UL', 'NX-7-UL-CU', 'OP-12',
  'OP-12-CU', 'OP-3', 'OP-3-CU', 'OP-3-PL', 'OP-4-CU', 'OP-4-PK', 'OP-5', 'OP-5-CU', 'OP-5-GR',
  'OP-5-GR-CU', 'OP-5-PK', 'OP-7', 'OP-7-GR', 'OP-7-GR-CU', 'OP-7-PL', 'OX-12', 'OX-12-CU',
  'OX-12-GR', 'OX-12-UL', 'OX-12-UL-CU', 'OX-20-CU', 'OX-20-UL-CU', 'OX-3', 'OX-3-CU',
  'OX-3-DE', 'OX-3-DE-CU', 'OX-3-GP', 'OX-3-GR', 'OX-3-GR-CU', 'OX-3-PK', 'OX-3-PK-CU',
  'OX-3-PL', 'OX-3-PL-CU', 'OX-3-UG', 'OX-3-UG-CU', 'OX-3-UL', 'OX-3-UL-CU', 'OX-4', 'OX-4-CU',
  'OX-4-PK', 'OX-4-PK-CU', 'OX-4-PL', 'OX-4-PL-CU', 'OX-4-UL', 'OX-4-UL-CU', 'OX-5', 'OX-5-CU',
  'OX-5-GR', 'OX-5-GR-CU', 'OX-5-PK', 'OX-5-PL', 'OX-5-PL-CU', 'OX-5-UG-CU', 'OX-5-UL',
  'OX-5-UL-CU', 'OX-7', 'OX-7-CU', 'OX-7-GR-CU', 'OX-7-PK-CU', 'OX-7-PL', 'OX-7-PL-CU',
  'OX-7-SH', 'OX-7-UL', 'OX-7-UL-CU', 'PD', 'R-1', 'R-1-CU', 'R-10', 'R-10-CU', 'R-2',
  'R-2-CU', 'R-4', 'R-4-CU', 'R-6', 'R-6-CU', 'RX-12-CU', 'RX-3', 'RX-3-CU', 'RX-3-DE',
  'RX-3-GP', 'RX-3-GR', 'RX-3-GR-CU', 'RX-3-PK', 'RX-3-PK-CU', 'RX-3-PL', 'RX-3-PL-CU',
  'RX-3-UG-CU', 'RX-3-UL', 'RX-3-UL-CU', 'RX-4', 'RX-4-CU', 'RX-4-GR-CU', 'RX-4-PK',
  'RX-4-PK-CU', 'RX-4-PL', 'RX-4-PL-CU', 'RX-4-UL-CU', 'RX-5', 'RX-5-CU', 'RX-5-GP',
  'RX-5-GR-CU', 'RX-5-PK', 'RX-5-PK-CU', 'RX-5-PL-CU', 'RX-5-UL-CU', 'RX-7', 'RX-7-CU',
  'RX-7-GR-CU', 'RX-7-PL-CU', 'RX-7-UL-CU'] as const

// ═══════════════════════════════════════════════════════════════════════════
// FAR — a KNOWN ABSENCE, and it must never render like a failed lookup
// ═══════════════════════════════════════════════════════════════════════════
// The Raleigh UDO contains no floor-area-ratio instrument. Established on the
// document's own structure, not on a reader failing to find one: no chapter's
// district table has a FAR row, and across the whole ordinance text "floor area
// ratio" occurs exactly twice, both inside one traffic level-of-service
// site-plan provision. See the module header, FACT 1.
describe('FAR: the UDO imposes none, and that is an answer', () => {
  it.each(['CX-5', 'DX-20-SH', 'R-10', 'R-1', 'AP', 'IH', 'CM', 'CMP', 'MH', 'PD', 'NX-3-UG'])(
    '%s → maxFAR has no source, farUnconstrained true',
    (zone) => {
      const r = resolveRaleigh(zone)
      expect(r.farUnconstrained).toBe(true)
    },
  )

  // The distinction CLAUDE.md rule 5 exists for. Both states carry no FAR
  // number; only one of them is a claim. If an unrecognised code ever returned
  // farUnconstrained:true, a fetch miss would start asserting "FAR does not
  // bind here" — and the envelope would print an unconstrained floor area for a
  // parcel we know nothing about.
  it.each(['', 'not-a-zone', 'B-3', 'C-MX-5', 'RS-1-7'])(
    '%s is a GAP, not the known absence — farUnconstrained stays false',
    (zone) => {
      const r = resolveRaleigh(zone)
      expect(r.farUnconstrained).toBe(false)
      expect(r.heightFt).toBeNull()
      expect(r.stories).toBeNull()
    },
  )

  it('null and undefined resolve to the gap, not the absence', () => {
    for (const z of [null, undefined]) {
      expect(resolveRaleigh(z).farUnconstrained).toBe(false)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// HEIGHT — carry the unit the code uses; never convert (CLAUDE.md rule 12)
// ═══════════════════════════════════════════════════════════════════════════
// UDO Sec. 3.3.1 (prose enumeration, with a worked CX-5 example) and Sec. 3.3.2
// rows A1/A2 (table) state the same eight designations twice over.
describe('mixed-use height designations — UDO Sec. 3.3.1 / Sec. 3.3.2', () => {
  it.each([
    // designation, feet the code prints, stories the code prints
    [3, 50, 3],
    [4, 68, 4],
    [5, 80, 5],
  ])('-%i → %i ft / %i stories, both printed by the code', (des, feet, stories) => {
    const r = resolveRaleigh(`CX-${des}`)
    expect(r.heightFt).toBe(feet)
    expect(r.stories).toBe(stories)
  })

  // Sec. 3.3.1 lists these as stories alone and Sec. 3.3.2 row A2 carries no
  // feet for them. Reporting stories with feet null cannot overstate anything,
  // because maxStories binds. Manufacturing a feet figure would.
  it.each([7, 12, 20, 30, 40])('-%i → stories stated, feet null (the code prints no feet)', (des) => {
    const r = resolveRaleigh(`DX-${des}`)
    expect(r.stories).toBe(des)
    expect(r.heightFt).toBeNull()
  })

  // THE CORE ANTI-CONVERSION ASSERTION. Raleigh's own table disproves the
  // existence of a feet-per-story constant: 50/3, 68/4 and 80/5 are three
  // different ratios. If anyone ever "tidies" this module by deriving one unit
  // from the other, at least two of these three must break — whichever constant
  // is chosen. This is the Miami-21 defect (12 ft/story in, 11 ft/story out,
  // 87 stories published for an 80-story district) made impossible to
  // reintroduce silently.
  it('no single ft/story constant can produce the code figures', () => {
    const ratios = [50 / 3, 68 / 4, 80 / 5]
    expect(new Set(ratios.map((r) => r.toFixed(4))).size).toBe(3)
    for (const c of [10, 11, 12, 13, 14, 15, 16, 17, 18]) {
      const matches = [
        resolveRaleigh('CX-3').heightFt === 3 * c,
        resolveRaleigh('CX-4').heightFt === 4 * c,
        resolveRaleigh('CX-5').heightFt === 5 * c,
      ].filter(Boolean).length
      expect(matches, `ft/story = ${c} reproduced ${matches} of 3 districts`).toBeLessThan(3)
    }
  })

  // The specific numbers a 11- or 12-ft convention would have published.
  it('never publishes a story count multiplied by a floor-to-floor convention', () => {
    expect(resolveRaleigh('CX-3').heightFt).not.toBe(36) // 3 x 12
    expect(resolveRaleigh('CX-4').heightFt).not.toBe(48) // 4 x 12
    expect(resolveRaleigh('CX-5').heightFt).not.toBe(60) // 5 x 12
    expect(resolveRaleigh('CX-5').heightFt).not.toBe(55) // 5 x 11
    // And the reverse trip: 12 stories must not become 132 or 144 feet.
    expect(resolveRaleigh('DX-12').heightFt).toBeNull()
  })

  // MH is the mirror image: the code states feet and NO stories. A story count
  // derived from 40 ft would be an invented number (CLAUDE.md rule 4).
  it('MH states feet only — stories stays null rather than being derived', () => {
    const r = resolveRaleigh('MH')
    expect(r.heightFt).toBe(40) // Sec. 4.5.3.B, verbatim
    expect(r.stories).toBeNull()
    expect(r.stories).not.toBe(3) // 40/13.3, or "everything else is 3"
    expect(r.stories).not.toBe(4)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// RULE 6 — a maximum across alternatives is not a ceiling
// ═══════════════════════════════════════════════════════════════════════════
// Article 2.2 states R-district height PER BUILDING TYPE. The headline is the
// detached-house figure; the taller programs are alternatives the applicant
// elects. Publishing 45 as R-6's or R-10's ceiling would assume a townhouse or
// apartment program the user has not chosen — the Austin 0.40-or-0.65 mistake.
describe('residential districts — UDO Article 2.2, per building type', () => {
  it.each(['R-1', 'R-2', 'R-4', 'R-6', 'R-10'])(
    '%s headline is 40 ft / 3 stories (Sec. 2.2.1 Detached House)',
    (zone) => {
      const r = resolveRaleigh(zone)
      expect(r.heightFt).toBe(40)
      expect(r.stories).toBe(3)
    },
  )

  it.each(['R-6', 'R-10'])('%s never publishes 45 ft as the headline', (zone) => {
    expect(resolveRaleigh(zone).heightFt).not.toBe(45)
  })

  // Sec. 2.2.3 E1 — townhouse is 40' in R-2/R-4 but 45' in R-6/R-10. The
  // scouting summary that fed this module asserted a flat 40'/3 for townhouse
  // in every R district; it was a plausible-looking claim and the table
  // contradicts it (CLAUDE.md rule 18). These cases pin the real figures.
  it('R-6 carries the townhouse alternative at 45 ft (Sec. 2.2.3 E1)', () => {
    const alts = resolveRaleigh('R-6').alternatives ?? []
    expect(alts.map((a) => a.label)).toEqual(['Townhouse'])
    expect(alts[0].heightFt).toBe(45)
    expect(alts[0].stories).toBe(3)
  })

  it('R-10 carries townhouse, apartment and civic alternatives at 45 ft', () => {
    const alts = resolveRaleigh('R-10').alternatives ?? []
    expect(alts.map((a) => a.label)).toEqual(['Townhouse', 'Apartment', 'Civic building'])
    for (const a of alts) {
      expect(a.heightFt).toBe(45) // Sec. 2.2.3 E1 / 2.2.4 D1 / 2.2.5 D1
      expect(a.stories).toBe(3)
    }
  })

  it.each(['R-1', 'R-2', 'R-4'])('%s has no 45-ft alternative — its columns are all 40', (zone) => {
    for (const a of resolveRaleigh(zone).alternatives ?? []) {
      expect(a.heightFt).not.toBe(45)
    }
  })

  // Sec. 2.2.9 states 68'/4 stories for a General Building in R-1, immediately
  // qualified: "allowed in the above zoning district only as part of a
  // governmental water or wastewater treatment plant use described in Sec.
  // 6.3.3.E." It is not a program a user can elect, so it must appear nowhere.
  it('R-1 never surfaces the 68 ft treatment-plant figure (Sec. 2.2.9)', () => {
    const r = resolveRaleigh('R-1')
    expect(r.heightFt).not.toBe(68)
    expect(r.stories).not.toBe(4)
    for (const a of r.alternatives ?? []) expect(a.heightFt).not.toBe(68)
  })

  // Every alternative is strictly an ALTERNATIVE, never a hidden headline: the
  // resolved height must never silently be the maximum over the set.
  it('the headline is never the max across a district alternatives', () => {
    for (const zone of ['R-1', 'R-2', 'R-4', 'R-6', 'R-10']) {
      const r = resolveRaleigh(zone)
      const maxAlt = Math.max(0, ...(r.alternatives ?? []).map((a) => a.heightFt ?? 0))
      if (maxAlt > 0) expect(r.heightFt!).toBeLessThanOrEqual(maxAlt)
      expect(r.heightFt).toBe(40)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// The bonuses and options that must NEVER reach the published figure
// ═══════════════════════════════════════════════════════════════════════════
describe('overlay and option figures are never returned as by-right height', () => {
  // Sec. 5.5.1.I: in a residential district the -TOD limits non-single/two-unit
  // building types to "4 stories and 60 feet". That is an overlay figure, and
  // the base resolver must not carry it.
  it('does not fold the -TOD residential figure (60 ft / 4 stories) into R districts', () => {
    for (const zone of ['R-1', 'R-2', 'R-4', 'R-6', 'R-10']) {
      const r = resolveRaleigh(zone)
      expect(r.heightFt).not.toBe(60)
      expect(r.stories).not.toBe(4)
    }
  })

  // Sec. 5.5.1.I also allows a mixed-use district's stories to be "increased by
  // fifty percent (50%)" — but only where the added stories are residential and
  // 20% of their units are deed-restricted affordable at 60% AMI for 30 years,
  // or by 30% for wholly non-residential structures. Earned, conditional, and
  // elective: exactly the class of figure CLAUDE.md rule 6 forbids publishing.
  it.each([
    [3, 5, 4], // -3: +50% => 4.5 -> 5 (rounded up per the section); +30% => 3.9 -> 4
    [5, 8, 7],
    [7, 11, 10],
    [12, 18, 16],
    [20, 30, 26],
  ])('-%i never returns the +50%% (%i) or +30%% (%i) TOD bonus stories', (base, plus50, plus30) => {
    const r = resolveRaleigh(`CX-${base}`)
    expect(r.stories).toBe(base)
    expect(r.stories).not.toBe(plus50)
    expect(r.stories).not.toBe(plus30)
  })

  // Sec. 2.7.1's own height rows (E1 40'/3, E2 45'/3, E3 26'/2) are the same
  // figures Article 2.2 already states — the Frequent Transit Development
  // Option relaxes lot area, lot width and site area per unit, not height. So
  // there is nothing here to leak, and this pins that reading.
  it('the Frequent Transit Development Option adds no height above Article 2.2', () => {
    const FTDO_HEIGHTS = [40, 45, 26]
    for (const zone of ['R-4', 'R-6', 'R-10']) {
      const r = resolveRaleigh(zone)
      const published = [r.heightFt, ...(r.alternatives ?? []).map((a) => a.heightFt)]
      for (const h of published) expect(FTDO_HEIGHTS).toContain(h)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Special districts — UDO Chapter 4
// ═══════════════════════════════════════════════════════════════════════════
describe('special districts', () => {
  it.each([
    ['AP', 40, 3, 'Sec. 4.3.1 C1 / 4.3.2 D1'],
    ['CM', 40, 3, 'Sec. 4.2.2 C1'],
    ['CMP', 50, 3, 'Sec. 4.6.1.C'],
    ['IH', 50, 3, 'Sec. 4.4.1 D1'],
  ])('%s → %i ft / %i stories (%s)', (zone, feet, stories) => {
    const r = resolveRaleigh(zone as string)
    expect(r.heightFt).toBe(feet)
    expect(r.stories).toBe(stories)
  })

  // Raleigh has no FAR, so on CM the 5% building-coverage cap (Sec. 4.2.2 A3)
  // is the instrument that actually binds floor area. Losing it would leave the
  // district looking height-governed at 40 ft with nothing limiting footprint.
  it('CM carries the 5% building-coverage cap (Sec. 4.2.2 A3)', () => {
    expect(resolveRaleigh('CM').maxBuildingCoverage).toBe(0.05)
  })

  it('only CM states a coverage cap', () => {
    for (const zone of ['AP', 'CMP', 'IH', 'MH', 'R-10', 'CX-5']) {
      expect(resolveRaleigh(zone).maxBuildingCoverage).toBeUndefined()
    }
  })

  // PD is a known ABSENCE of by-right standards (Sec. 4.7.1/4.7.2: the approved
  // master plan governs), not a lookup we failed. Same shape as Nashville's SP.
  // It must be distinguishable from an unparsed code, which carries the same
  // nulls but asserts nothing.
  it('PD reports "master plan governs" — an answer, not a gap', () => {
    const r = resolveRaleigh('PD')
    expect(r.masterPlanGoverned).toBe(true)
    expect(r.heightFt).toBeNull()
    expect(r.stories).toBeNull()
    expect(r.farUnconstrained).toBe(true)
    expect(r.source).toContain('4.7')
    // The gap case looks nothing like it.
    expect(resolveRaleigh('not-a-zone').masterPlanGoverned).toBeUndefined()
  })

  // CMP is the in-between case and must not collapse into either neighbour: it
  // HAS by-right figures (unlike PD) that an adopted Campus Master Plan may
  // later modify (Sec. 4.6.2.A).
  it('CMP states real figures AND flags that a master plan may modify them', () => {
    const r = resolveRaleigh('CMP')
    expect(r.masterPlanMayModify).toBe(true)
    expect(r.masterPlanGoverned).toBeUndefined()
    expect(r.heightFt).toBe(50)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Parser — exercised on the FULL live vocabulary, not a sample
// ═══════════════════════════════════════════════════════════════════════════
describe('parseRaleighZone over the whole live district inventory', () => {
  it('captured 268 distinct values, so the denominator is the real one', () => {
    expect(LIVE_ZONING_VALUES.length).toBe(268)
    expect(new Set(LIVE_ZONING_VALUES).size).toBe(268)
  })

  // The measurement that matters: not "does the parser work on my example" but
  // "is there anything production can hand it that it drops on the floor".
  it('resolves every one of the 268 live values — zero unhandled', () => {
    const unresolved = LIVE_ZONING_VALUES.filter((z) => parseRaleighZone(z).base === null)
    expect(unresolved).toEqual([])
  })

  it('every live value yields a height, or a stated reason there is none', () => {
    for (const z of LIVE_ZONING_VALUES) {
      const r = resolveRaleigh(z)
      expect(r.farUnconstrained, z).toBe(true)
      const hasFigure = r.heightFt != null || r.stories != null
      // PD is the only district with neither, and it says why.
      expect(hasFigure || r.masterPlanGoverned === true, z).toBe(true)
      if (hasFigure) expect(r.source, z).not.toBe('')
    }
  })

  // R-10 also ends in a number. Reading that number as a mixed-use height
  // designation would publish 10 stories for a district whose trailing digit is
  // a density/lot-size tier — the Denver "B-3" failure mode, where a class code
  // was multiplied into a fabricated height.
  it('R-10 is a residential district, not a 10-storey designation', () => {
    const p = parseRaleighZone('R-10')
    expect(p.base).toBe('R-10')
    expect(p.heightDesignation).toBeNull()
    const r = resolveRaleigh('R-10')
    expect(r.stories).toBe(3)
    expect(r.stories).not.toBe(10)
    expect(r.heightFt).not.toBe(10)
  })

  it.each(['R-1', 'R-2', 'R-4', 'R-6'])('%s trailing digit is never read as stories', (zone) => {
    const digit = Number(zone.split('-')[1])
    expect(parseRaleighZone(zone).heightDesignation).toBeNull()
    expect(resolveRaleigh(zone).stories).toBe(3)
    if (digit !== 3) expect(resolveRaleigh(zone).stories).not.toBe(digit)
  })

  it('decomposes a fully-loaded mixed-use code', () => {
    expect(parseRaleighZone('DX-20-SH-CU')).toEqual({
      base: 'DX-',
      heightDesignation: 20,
      frontage: 'SH',
      conditional: true,
    })
  })

  it('is case- and whitespace-insensitive', () => {
    expect(parseRaleighZone('  cx-5-ug ')).toEqual({
      base: 'CX-',
      heightDesignation: 5,
      frontage: 'UG',
      conditional: false,
    })
  })

  // 1,386 of 3,580 mapped polygons carry "-CU". The suffix must never change
  // which district was matched — only flag that recorded conditions exist.
  it('the -CU suffix flags conditions without altering the base district', () => {
    for (const [plain, cu] of [
      ['R-10', 'R-10-CU'],
      ['CX-5-UL', 'CX-5-UL-CU'],
      ['IH', 'IH-CU'],
      ['CM', 'CM-CU'],
    ]) {
      expect(parseRaleighZone(cu).conditional).toBe(true)
      expect(parseRaleighZone(plain).conditional).toBe(false)
      expect(parseRaleighZone(cu).base).toBe(parseRaleighZone(plain).base)
      expect(resolveRaleigh(cu)).toEqual(resolveRaleigh(plain))
    }
  })

  // A designation the UDO does not list is not a district we know. Inventing a
  // height for "CX-9" because the pattern looks familiar is the failure this
  // guards: Sec. 3.1.2 names exactly eight designations.
  it('rejects height designations the UDO does not list', () => {
    for (const z of ['CX-9', 'CX-2', 'DX-6', 'NX-100', 'OX-0']) {
      expect(parseRaleighZone(z).base, z).toBeNull()
      expect(resolveRaleigh(z).farUnconstrained, z).toBe(false)
    }
  })

  it('rejects a frontage suffix the UDO does not list', () => {
    expect(parseRaleighZone('CX-5-ZZ').base).toBeNull()
    expect(parseRaleighZone('CX-5-SH').base).toBe('CX-')
  })

  // Other cities' vocabularies must not resolve here. Denver's C-MX-5 and San
  // Diego's RS-1-7 both look structurally like Raleigh codes.
  it('does not resolve another city district code', () => {
    for (const z of ['C-MX-5', 'RS-1-7', 'NC3-65', 'R-3', 'R-5', 'RM-1']) {
      expect(parseRaleighZone(z).base, z).toBeNull()
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Uses — sourced to the Allowed Principal Use Table, not to district names
// ═══════════════════════════════════════════════════════════════════════════
describe('usesForZone — UDO Sec. 6.1.4 Allowed Principal Use Table', () => {
  it.each(['R-1', 'R-2', 'R-4', 'R-6', 'R-10', 'R-10-CU'])('%s → residential', (zone) => {
    expect(usesForZone(zone)).toEqual(['residential'])
  })

  it('MH is residential (Single-unit living P, Manufactured home development L)', () => {
    expect(usesForZone('MH')).toEqual(['residential'])
  })

  it.each(['OX-3', 'NX-3-UG', 'CX-5-SH', 'DX-20-SH-CU'])('%s → mixed use', (zone) => {
    expect(usesForZone(zone)).toEqual(['commercial', 'mixed', 'residential'])
  })

  it('RX- leads with residential (Office and Medical are only Limited there)', () => {
    expect(usesForZone('RX-3')).toEqual(['residential', 'mixed', 'commercial'])
  })

  // THE ONE A NAME-BASED GUESS GETS WRONG. "Office Park" sits in the mixed-use
  // chapter and shares the -N suffix grammar, but its Sec. 6.1.4 column reads
  // "--" for Single-unit living, Two-unit living, Multi-unit living AND Group
  // Living. Treating the OP- prefix as mixed-use would assert housing rights
  // the ordinance does not grant.
  it('OP- is NOT residential — every household-living cell in its column is "--"', () => {
    const uses = usesForZone('OP-5')
    expect(uses).toEqual(['commercial', 'institutional'])
    expect(uses).not.toContain('residential')
    expect(uses).not.toContain('mixed')
  })

  // IX- permits multi-unit living only as a LIMITED use, and no single- or
  // two-unit living at all, so residential is not asserted by right.
  it('IX- and IH are commercial/institutional, not residential', () => {
    expect(usesForZone('IX-5-UL')).toEqual(['commercial', 'institutional'])
    expect(usesForZone('IH')).toEqual(['commercial', 'institutional'])
  })

  it('AP allows a house on an agriculture tract (Sec. 4.3.1) plus agriculture', () => {
    expect(usesForZone('AP')).toEqual(['residential', 'institutional'])
  })

  it('CMP is institutional (Sec. 4.6.1.A: government, hospital, college or university)', () => {
    expect(usesForZone('CMP')).toEqual(['institutional'])
  })

  // CM's Sec. 6.1.4 column is "--" for every household-living, office, retail
  // and even Civic row. 'institutional' would assert a civic use the table
  // explicitly denies, so null is the honest render.
  it('CM returns null rather than asserting a use its column denies', () => {
    expect(usesForZone('CM')).toBeNull()
    expect(usesForZone('CM-CU')).toBeNull()
  })

  it('PD returns null — the approved master plan sets the uses (Sec. 4.7.2)', () => {
    expect(usesForZone('PD')).toBeNull()
  })

  it('returns null rather than guessing for an unknown or absent zone', () => {
    for (const z of [null, undefined, '', 'not-a-zone', 'C-MX-5']) {
      expect(usesForZone(z)).toBeNull()
    }
  })

  it('assigns a use vocabulary to every live value except CM and PD', () => {
    const nulls = LIVE_ZONING_VALUES.filter((z) => usesForZone(z) === null)
    expect(new Set(nulls)).toEqual(new Set(['CM', 'CM-CU', 'PD']))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Table integrity
// ═══════════════════════════════════════════════════════════════════════════
describe('curated tables', () => {
  it('every entry carries a UDO citation — a figure without a source cannot ship', () => {
    const all = [
      ...Object.values(RALEIGH_HEIGHT_DESIGNATIONS),
      ...Object.values(RALEIGH_RESIDENTIAL),
      ...Object.values(RALEIGH_SPECIAL),
    ]
    for (const e of all) {
      expect(e.source).toMatch(/UDO Sec\. \d/)
      for (const a of e.alternatives ?? []) expect(a.source).toMatch(/UDO Sec\. \d/)
    }
  })

  it('covers all eight height designations Sec. 3.1.2 lists, and only those', () => {
    expect(Object.keys(RALEIGH_HEIGHT_DESIGNATIONS).map(Number).sort((a, b) => a - b)).toEqual([
      3, 4, 5, 7, 12, 20, 30, 40,
    ])
  })

  it('covers all five R districts and all six special districts', () => {
    expect(Object.keys(RALEIGH_RESIDENTIAL).sort()).toEqual(['R-1', 'R-10', 'R-2', 'R-4', 'R-6'])
    expect(Object.keys(RALEIGH_SPECIAL).sort()).toEqual(['AP', 'CM', 'CMP', 'IH', 'MH', 'PD'])
  })

  it('static tables and the resolver agree exactly', () => {
    for (const [k, v] of Object.entries(RALEIGH_RESIDENTIAL)) expect(resolveRaleigh(k)).toEqual(v)
    for (const [k, v] of Object.entries(RALEIGH_SPECIAL)) expect(resolveRaleigh(k)).toEqual(v)
    for (const [des, v] of Object.entries(RALEIGH_HEIGHT_DESIGNATIONS)) {
      expect(resolveRaleigh(`CX-${des}`)).toEqual(v)
    }
  })

  it('no entry states a height in both units unless the UDO prints both', () => {
    // The three that print both are exactly the -3/-4/-5 designations plus the
    // R and special districts read from Chapter 2 / Chapter 4 tables. MH prints
    // feet only; -7 and above print stories only. Nothing else may.
    expect(RALEIGH_SPECIAL.MH.stories).toBeNull()
    for (const des of [7, 12, 20, 30, 40]) {
      expect(RALEIGH_HEIGHT_DESIGNATIONS[des].heightFt).toBeNull()
    }
  })
})
