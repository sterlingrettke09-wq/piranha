import { describe, it, expect } from 'vitest'
import { readEnumeration } from '../../../../scripts/enumerate-zones'
import { isPlannedDevelopment } from './plannedDevelopment'
import {
  SAN_DIEGO_PLANNED_DISTRICTS,
  sanDiegoPlannedDistrict,
  CC_OTAY_MESA_FAR,
  CP_KEARNY_MESA,
  CP_OTAY_MESA,
  INDUSTRIAL_BASE_FAR,
  KEARNY_MESA_FAR,
  resolveSanDiego,
  sanDiegoZoneKey,
  rsFarForLotArea,
  SAN_DIEGO_ZONE_CODES,
  RS_FAR_BY_LOT_AREA,
  RM_5_12_BY_HEIGHT,
} from './sandiego'

// Every figure asserted here was read from the Land Development Code, Chapter 13
// Article 1 Division 4 (7-2026 printing), extracted from the City's own PDF and
// checked against the table's four-row column header. Where a test asserts that
// something is ABSENT, the assertion is about the code's structure — a section
// that does not exist — not about a reader failing to find it (rule 15).

describe('inventory', () => {
  // Rule 20: a check that can pass by finding nothing is not a check. Pin the
  // size AND the membership, so a regex that silently stops matching goes RED
  // rather than green.
  it('covers the base zones plus 34 planned-district zones', () => {
    // 75 → 91 on 2026-08-17: sixteen Chapter 15 planned-district codes read from
    // their own articles (Cass Street 1, Mission Beach 6, La Jolla Shores 3,
    // La Jolla 6).
    // 126 → 135 on 2026-08-19: the nine Central Urbanized CU zones of Table
    // 155-02D. Its four CT zones are deliberately absent — each branches on
    // parcel facts this project does not hold.
    // 114 → 126 on 2026-08-19: the twelve CR/CO/CV/CP zones of Table 131-05D.
    // 97 → 114 on 2026-08-19: SEVENTEEN Carmel Valley codes (Chapter 15, Article
    // 3, Division 3) — six SF, five MF, four whose base zone is not yet read, and
    // EC and MC which state their own ratios. Three of the district's twenty live
    // codes are deliberately absent: EP, OS and SP state no ratio to encode.
    // Most are `incorporates` rows rather than figures — they adopt a Chapter 13
    // base zone, which is what the ordinance does.
    // The pin moving is the guard working — a curated table growing silently is
    // how an unsourced entry gets in.
    expect(SAN_DIEGO_ZONE_CODES.length).toBe(135)
    expect(SAN_DIEGO_ZONE_CODES).toEqual(
      expect.arrayContaining([
        'RS-1-1', 'RS-1-7', 'RS-1-8', 'RS-1-14',
        'RX-1-1', 'RX-1-2',
        'RT-1-1', 'RT-1-5',
        'RM-1-1', 'RM-2-6', 'RM-3-7', 'RM-5-12',
        'CSPD-CASS-STREET', 'MBPD-R-N', 'MBPD-VC-S', 'LJSPD-SF', 'LJSPD-MF1',
        'LJPD-1', 'LJPD-4', 'LJPD-5', 'LJPD-6',
        'CN-1-1', 'CN-1-6',
      ]),
    )
  })

  it('pins the Table 131-04J band count', () => {
    expect(RS_FAR_BY_LOT_AREA.length).toBe(18)
    expect(RM_5_12_BY_HEIGHT.length).toBe(6)
  })
})

describe('Table 131-04J — FAR by lot area', () => {
  // The band EDGES are the whole risk in a stepped table: an off-by-one puts a
  // 8,000 sf lot in the 8,001+ band. Asserted on both sides of three edges.
  it.each([
    [2_500, 0.7],
    [3_000, 0.7],
    [3_001, 0.65],
    [7_000, 0.58],
    [7_001, 0.57],
    [8_000, 0.57],
    [8_001, 0.56],
    [19_000, 0.46],
    [19_001, 0.45],
    [250_000, 0.45],
  ])('a %i sf lot yields FAR %f', (lot, far) => {
    expect(rsFarForLotArea(lot)).toBe(far)
  })

  it('is monotonically non-increasing, as a ratio-by-lot-size table must be', () => {
    const fars = RS_FAR_BY_LOT_AREA.map((b) => b.far)
    for (let i = 1; i < fars.length; i++) expect(fars[i]).toBeLessThanOrEqual(fars[i - 1])
  })
})

describe('resolveSanDiego', () => {
  // THE KNOWN-GOOD RECONCILIATION (rule 16). RS-1-7 at 7,958 sq ft is the exact
  // parcel the null inventory probes, recorded STABLE over four isolated
  // re-probes. Before this module it returned GAP. If this assertion ever
  // disagrees with the live probe, the module is wrong, not the probe.
  it('resolves the probed RS-1-7 parcel at 7,958 sq ft to FAR 0.57', () => {
    const r = resolveSanDiego('RS-1-7', 7_958)
    expect(r.maxFAR).toBe(0.57)
    expect(r.source).toContain('131.0446')
  })

  it('resolves the flat-rate zones without needing a lot size', () => {
    expect(resolveSanDiego('RS-1-1', null).maxFAR).toBe(0.45)
    expect(resolveSanDiego('RS-1-8', null).maxFAR).toBe(0.45)
    expect(resolveSanDiego('RS-1-9', null).maxFAR).toBe(0.6)
    expect(resolveSanDiego('RM-4-11', null).maxFAR).toBe(7.2)
  })

  // A guessed band is an invented number wearing a citation (rule 4). The
  // spread across Table 131-04J is 0.70 to 0.45, so defaulting would be wrong
  // by up to 56% — and it would render as an ANSWER.
  it('REFUSES the lot-area zones when no lot size is available', () => {
    for (const z of ['RS-1-2', 'RS-1-3', 'RS-1-4', 'RS-1-5', 'RS-1-6', 'RS-1-7']) {
      expect(resolveSanDiego(z, null).maxFAR).toBeNull()
      expect(resolveSanDiego(z, 0).maxFAR).toBeNull()
      expect(resolveSanDiego(z, Number.NaN).maxFAR).toBeNull()
    }
  })

  // Rule 6: where the code allows either program A or program B, the larger
  // figure must not become the headline — that assumes a program the user has
  // not chosen, and it flows into unit counts, fees and hurdles.
  it('keeps a program-dependent FAR as an alternative, never as the headline', () => {
    const rt = resolveSanDiego('RT-1-1', 5_000)
    expect(rt.maxFAR).toBe(0.85)
    expect(rt.farAlternatives).toEqual([
      { label: '3-storey building', far: 1.2, source: expect.stringContaining('131.0431') },
    ])

    const rm = resolveSanDiego('RM-1-1', 6_000)
    expect(rm.maxFAR).toBe(0.75)
    expect(rm.farAlternatives.map((a) => a.far)).toEqual([1.0])

    const rm512 = resolveSanDiego('RM-5-12', 12_000)
    expect(rm512.maxFAR).toBe(1.8)
    expect(rm512.farAlternatives.map((a) => a.far)).toEqual([1.85, 1.9, 1.95, 2.0, 2.05, 2.1])
  })

  it('emits no alternative where the code states the same figure twice', () => {
    // RM-1-3 onward the "1 to 2" and "3 to 7" rows agree; restating the
    // headline as an alternative would imply a choice the code does not offer.
    expect(resolveSanDiego('RM-1-3', 6_000).farAlternatives).toEqual([])
    expect(resolveSanDiego('RM-2-6', 6_000).farAlternatives).toEqual([])
  })
})

describe('scope (rule 23)', () => {
  // Codes whose table has NOT been read must return null and keep reading
  // downstream as a GAP. If one of these ever starts resolving, an out-of-scope
  // table has been folded in without its source being read.
  //
  // ⚠️ CN-1-3 WAS IN THIS LIST AND IS NOT ANY MORE, 2026-08-17. The list was
  // written when Division 4 (residential) was the only division read, and it was
  // correct then. Table 131-05C has since been read — six columns reconciled
  // against the header and the live enumeration, max FAR 1.0, footnote 3 giving
  // the Otay Mesa override — so the CN zones are encoded and the assertion had
  // become a claim about our own past scope rather than about the code.
  //
  // ⚠️ CV-1-1, CO-1-1 AND CR-1-1 LEFT THIS LIST 2026-08-19, for exactly the
  // reason CN-1-3 did: Table 131-05D has now been read. Eleven data columns
  // reconciled against twelve live codes — the CR- header spans one column
  // serving both CR-1-1 and CR-2-1 — with footnote 4 giving the same 0.30 Otay
  // Mesa override in that table's own words. The assertion had become a claim
  // about our own past scope rather than about the code (rule 15).
  //
  // The rest stay: Division 2's open-space zones and the Barrio Logan / Centre
  // City planned districts are still unread here.
  it.each(['OP-1-1', 'OC-1-1', 'OR-1-1', 'CCPD-ER', 'BLPD-CT'])(
    'leaves the out-of-scope zone %s unresolved',
    (code) => {
      expect(sanDiegoZoneKey(code)).toBeNull()
      expect(resolveSanDiego(code, 6_000).maxFAR).toBeNull()
      expect(resolveSanDiego(code, 6_000).source).toBeNull()
    },
  )

  it('returns null rather than throwing on absent or malformed input', () => {
    for (const bad of [null, undefined, '', '   ', 'Unknown']) {
      expect(sanDiegoZoneKey(bad)).toBeNull()
      expect(resolveSanDiego(bad, 6_000).maxFAR).toBeNull()
    }
  })

  it('normalises case and internal whitespace', () => {
    expect(sanDiegoZoneKey('rs-1-7')).toBe('RS-1-7')
    expect(sanDiegoZoneKey(' RM-3-8 ')).toBe('RM-3-8')
    expect(sanDiegoZoneKey('RS -1- 7')).toBe('RS-1-7')
  })
})

describe('agricultural zones — a structural absence (rule 5)', () => {
  // Table 131-03C has no "Max Floor Area Ratio" row: its bulk row is "Max Lot
  // Coverage (%)". Division 3 has no maximum-FAR section either, while the
  // divisions where FAR applies each have one exactly where it belongs
  // (§ 131.0446 residential, § 131.0546 commercial, § 131.0632 industrial).
  it.each(['AG-1-1', 'AG-1-2', 'AR-1-1', 'AR-1-2'])('%s reports no FAR as an answer', (code) => {
    const r = resolveSanDiego(code, 40_000)
    expect(r.farUnconstrained).toBe(true)
    expect(r.maxFAR).toBeNull()
    expect(r.source).toContain('131.0331')
  })

  it('does not confuse the table\u2019s "Min Floor Area" row with a ratio', () => {
    // Min Floor Area(6) is a 650 sq ft MINIMUM dwelling size. If it were ever
    // read as a FAR the value would be enormous and obviously wrong; the risk
    // is reading its "applies" cell as a ratio existing.
    expect(resolveSanDiego('AR-1-1', 40_000).maxFAR).toBeNull()
  })

  it('separates the agricultural absence from an unread division', () => {
    // AR is an answer; an unread division is a gap. CN-1-3 was the example here
    // and is now READ, so the example moved to CR-1-1 — Table 131-05D, still
    // unread. Keeping CN would have asserted a gap that no longer exists.
    expect(resolveSanDiego('AR-1-1', 40_000).farUnconstrained).toBe(true)
    expect(resolveSanDiego('CR-1-1', 40_000).farUnconstrained).toBe(false)
    expect(resolveSanDiego('CR-1-1', 40_000).maxFAR).toBeNull()
  })

  it('and CN, now read, resolves only with the community plan it depends on', () => {
    // The joint dependency is the whole reason this cannot be a flat lookup:
    // Table 131-05C footnote 3 overrides the 1.0 to 0.30 inside Otay Mesa, so a
    // call that cannot say where the parcel is must decline.
    expect(resolveSanDiego('CN-1-3', 40_000).maxFAR).toBeNull() // plan undefined
    expect(resolveSanDiego('CN-1-3', 40_000, 'LA JOLLA').maxFAR).toBe(1.0)
    expect(resolveSanDiego('CN-1-3', 40_000, 'OTAY MESA').maxFAR).toBe(0.3)
    // Each table cites its OWN footnote — 131-05C note 3 here, 131-05E note 4
    // for CC. Same figure, different provision, and a shared source string would
    // have pointed a CN reader at the wrong table.
    expect(resolveSanDiego('CN-1-3', 40_000, 'OTAY MESA').source).toContain('131-05C footnote 3')
    expect(resolveSanDiego('CC-1-1', 40_000, 'OTAY MESA').source).toContain('131-05E footnote 4')
  })
})

describe('industrial — a JOINT dependency on zone and community plan (rule 13)', () => {
  // Table 131-06C states 2.0 for every zone family, so a column misalignment
  // cannot change the answer. The risk here is entirely in the two footnotes.
  it.each(['IP-2-1', 'IL-2-1', 'IH-2-1', 'IS-1-1', 'IBT-1-1'])(
    '%s is the base 2.0 outside the two named community plans',
    (code) => {
      const r = resolveSanDiego(code, 40_000, 'NORTH PARK')
      expect(r.maxFAR).toBe(INDUSTRIAL_BASE_FAR)
      expect(r.source).toContain('131.0632')
    },
  )

  // Footnote 7 carries a (7) on the IL and IBT columns only.
  it('Kearny Mesa drops IL and IBT to 1.0 and leaves the rest at 2.0', () => {
    expect(resolveSanDiego('IL-2-1', 40_000, CP_KEARNY_MESA).maxFAR).toBe(KEARNY_MESA_FAR)
    expect(resolveSanDiego('IBT-1-1', 40_000, CP_KEARNY_MESA).maxFAR).toBe(KEARNY_MESA_FAR)
    expect(resolveSanDiego('IP-2-1', 40_000, CP_KEARNY_MESA).maxFAR).toBe(INDUSTRIAL_BASE_FAR)
    expect(resolveSanDiego('IH-2-1', 40_000, CP_KEARNY_MESA).maxFAR).toBe(INDUSTRIAL_BASE_FAR)
  })

  // Footnote 11's 0.50 applies "unless a final map has been recorded prior to
  // May 18, 2014". The parcel layer has no recording date, so 0.50 and 2.0 are
  // both live and NEITHER can be published.
  it.each(['IP-2-1', 'IL-2-1', 'IH-2-1', 'IBT-1-1'])('%s stays a gap in Otay Mesa', (code) => {
    const r = resolveSanDiego(code, 40_000, CP_OTAY_MESA)
    expect(r.maxFAR).toBeNull()
    expect(r.farUnconstrained).toBe(false)
    expect(r.source).toContain('final map')
  })

  // ⚠️ OTAY MESA and OTAY MESA-NESTOR are DIFFERENT plan areas in SANDAG's
  // layer. Footnote 11 names only the former. A substring match would cap
  // Otay Mesa-Nestor at 0.50 — understating it fourfold.
  it('does not apply the Otay Mesa cap to Otay Mesa-Nestor', () => {
    expect(resolveSanDiego('IH-2-1', 40_000, 'OTAY MESA-NESTOR').maxFAR).toBe(INDUSTRIAL_BASE_FAR)
  })

  // THE STATE SPLIT. An unread/failed layer and a layer that answered "no
  // polygon here" are different facts and must not collapse:
  //   · undefined — not read or the read failed. Otay Mesa cannot be ruled
  //     out, so refuse. Defaulting to 2.0 here would overstate fourfold.
  //   · null      — the layer ANSWERED and no plan covers the point, so the
  //     parcel is outside Otay Mesa and Kearny Mesa and the base applies.
  // This was wrong in the first implementation: both returned UNRESOLVED, and
  // the upstream-split guard caught it by asserting on the EMPTY run.
  it('refuses only when the community plan was not read', () => {
    const r = resolveSanDiego('IH-2-1', 40_000, undefined)
    expect(r.maxFAR).toBeNull()
    expect(r.farUnconstrained).toBe(false)
    expect(r.source).toBeNull()
  })

  it.each([null, '', '   '])('takes the base 2.0 when the layer answered with %p', (cp) => {
    // An answer of "no community plan covers this point" rules Otay Mesa out.
    expect(resolveSanDiego('IH-2-1', 40_000, cp).maxFAR).toBe(INDUSTRIAL_BASE_FAR)
  })

  it('is case- and whitespace-insensitive on the plan name', () => {
    expect(resolveSanDiego('IL-2-1', 40_000, ' kearny mesa ').maxFAR).toBe(KEARNY_MESA_FAR)
    expect(resolveSanDiego('IH-2-1', 40_000, 'otay mesa').maxFAR).toBeNull()
  })

  it('never reports an industrial zone as having no FAR', () => {
    // The code states 2.0; an absence would be a different and false claim.
    for (const c of ['IP-1-1', 'IL-3-1', 'IH-1-1', 'IS-1-1', 'IBT-1-1']) {
      expect(resolveSanDiego(c, 40_000, 'NORTH PARK').farUnconstrained).toBe(false)
    }
  })
})

describe('CC commercial — Table 131-05E, read from rendered page images', () => {
  // The header could not be reconstructed by text extraction or by pdfplumber's
  // table parser: the 4th-row numeral spans FOUR 3rd-row tokens and the FAR is
  // one merged cell across that group. Rendering the page and reading it is the
  // method ../zoning/minneapolis.ts already uses for the same problem.
  it.each([
    ['CC-1-1', 0.75], ['CC-2-1', 0.75], ['CC-4-1', 0.75], ['CC-5-1', 0.75],
    ['CC-1-2', 2.0], ['CC-5-2', 2.0],
    ['CC-1-3', 0.75], ['CC-2-3', 0.75], ['CC-5-3', 0.75],
    ['CC-2-4', 1.0], ['CC-3-4', 1.0],
    ['CC-2-5', 2.0], ['CC-3-6', 2.0], ['CC-3-7', 2.0], ['CC-3-9', 2.0],
    ['CC-3-10', 3.0], ['CC-3-11', 4.0],
  ])('%s = %f outside Otay Mesa', (code, far) => {
    const r = resolveSanDiego(code, 40_000, 'SAN YSIDRO')
    expect(r.maxFAR).toBe(far)
    expect(r.source).toContain('131-05E')
  })

  // THE SAMPLED GAP. Its parcel sits in San Ysidro, not Otay Mesa.
  it('CC-2-3 — the sampled gap district — resolves at 0.75', () => {
    expect(resolveSanDiego('CC-2-3', 14_727, 'SAN YSIDRO').maxFAR).toBe(0.75)
  })

  // Footnote 4, and NOT footnote 3 of Table 131-05C, which is the identical
  // sentence attached to a different table. Unlike industrial's footnote 11
  // this one has no recorded-map exception, so it resolves rather than refuses.
  it.each(['CC-2-3', 'CC-3-11', 'CC-1-2'])('%s drops to 0.30 in Otay Mesa', (code) => {
    const r = resolveSanDiego(code, 40_000, CP_OTAY_MESA)
    expect(r.maxFAR).toBe(CC_OTAY_MESA_FAR)
    expect(r.maxFAR).toBe(0.3)
    expect(r.source).toContain('footnote 4')
  })

  it('refuses when the community plan was not read', () => {
    // 0.30 is a quarter of the smallest base figure, so defaulting overstates.
    expect(resolveSanDiego('CC-2-3', 40_000, undefined).maxFAR).toBeNull()
  })

  it('takes the base when the layer answered with no polygon', () => {
    expect(resolveSanDiego('CC-2-3', 40_000, null).maxFAR).toBe(0.75)
  })

  // ⚠️ NEVER the neighbouring rows. "Floor Area Ratio Bonus for Residential
  // Mixed Use" is a bonus (0.75/2.0/2.5/4.5 depending on group) and "Minimum
  // Floor Area Ratio for Residential Use" is a MINIMUM (0.56/1.0/1.5/2.0).
  // Publishing either as the maximum would be wrong in opposite directions.
  it('never publishes the mixed-use bonus or the residential minimum as the max', () => {
    expect(resolveSanDiego('CC-2-3', 40_000, 'SAN YSIDRO').maxFAR).not.toBe(0.56)
    expect(resolveSanDiego('CC-3-10', 40_000, 'SAN YSIDRO').maxFAR).not.toBe(4.5)
    expect(resolveSanDiego('CC-3-11', 40_000, 'SAN YSIDRO').maxFAR).not.toBe(2.0)
  })

  it('does not invent a CC district the table has no column for', () => {
    // e.g. CC-1-4 is not in the 4th>>4 group (its 3rd row starts at 2-).
    for (const z of ['CC-1-4', 'CC-1-5', 'CC-2-6', 'CC-2-11', 'CC-9-9']) {
      expect(resolveSanDiego(z, 40_000, 'SAN YSIDRO').maxFAR, z).toBeNull()
    }
  })
})

describe('Chapter 15 planned districts are gaps, not plan-governed answers', () => {
  // ⚠️ THE DISPROVEN HYPOTHESIS THIS PINS. These 83 codes were first triaged as
  // the Denver-PUD / Dallas-PD shape — "a limit exists, in its own ordinance" —
  // which would make them ANSWERS and would have enrolled them in
  // isPlannedDevelopment. Reading Chapter 15 on 2026-08-17 disproved it: each
  // article publishes Property Development Regulations as tables IN the code for
  // named zones, and all ten carry height and floor-area provisions.
  //
  // So the assertion runs the other way. Enrolling them would claim "go read
  // another document" about figures inside a chapter already read for this city
  // — a fabricated known absence, the error this module's header exists to warn
  // about.
  const codes = readEnumeration('sandiego')!.codes
  const matched = codes.filter((c) => sanDiegoPlannedDistrict(c) != null)

  it('pins the inventory by membership, not by count (rule 20)', () => {
    // A regex that silently stopped matching would fold the group back into the
    // undifferentiated gap pile and read as though nothing had changed.
    expect(codes.length).toBe(183)
    expect(matched.length).toBe(83)
    const byArticle = new Map<string, number>()
    for (const c of matched) {
      const d = sanDiegoPlannedDistrict(c)!
      byArticle.set(d.article, (byArticle.get(d.article) ?? 0) + 1)
    }
    expect(Object.fromEntries([...byArticle].sort())).toEqual({
      'Ch 15 Art 10': 7, // La Jolla Shores
      'Ch 15 Art 11': 1, // Marina — repealed
      'Ch 15 Art 13': 6, // Mission Beach
      'Ch 15 Art 16': 15, // Old Town San Diego
      'Ch 15 Art 3': 20, // Carmel Valley
      'Ch 15 Art 4': 1, // Cass Street
      'Ch 15 Art 5': 13, // Central Urbanized
      'Ch 15 Art 6': 10, // Centre City
      'Ch 15 Art 7': 1, // Gaslamp Quarter
      'Ch 15 Art 9': 9, // La Jolla
    })
  })

  it('NONE of them is enrolled as planned-development', () => {
    // The positive half of the disproof. If a later change enrolls them, this
    // goes red and the reader lands on the reason.
    for (const c of matched) {
      expect(isPlannedDevelopment('sandiego', c), `${c} must not read as plan-governed`).toBe(false)
    }
  })

  it('Old Town is Article 16, not a base zone (rule 27)', () => {
    // Fifteen codes with no "PD" in their names, grouped elsewhere for exactly
    // that reason. Their shape matches the Chapter 13 base zones — OTRS-1-1
    // beside RS-1-1 — which is what made the misgrouping plausible.
    for (const c of ['OTCC-1-1', 'OTMCR-1-3', 'OTOP-2-1', 'OTRM-2-2', 'OTRS-1-1']) {
      expect(sanDiegoPlannedDistrict(c)?.article, c).toBe('Ch 15 Art 16')
    }
    // And the base zones they resemble are NOT planned districts.
    for (const c of ['RS-1-1', 'CC-1-1', 'RM-1-1']) {
      expect(sanDiegoPlannedDistrict(c), c).toBeNull()
    }
  })

  it('Marina is marked repealed, and is still a gap', () => {
    // Article 11 and its Division 3 both read "(Repealed 6-21-2019 by O-21086
    // N.S., effective 8-8-2019.)" and contain no standards — yet the layer still
    // publishes MPD-MARINA. Recording the repeal is not permission to publish a
    // figure: the repeal's reach into the Coastal Overlay Zone depends on a
    // Coastal Commission certification nothing here reads.
    const d = sanDiegoPlannedDistrict('MPD-MARINA')!
    expect(d.repealed).toBe('O-21086 N.S., effective 8-8-2019')
    const r = resolveSanDiego('MPD-MARINA', null)
    expect(r.maxFAR).toBeNull()
    // ⚠️ AND NOT far-unconstrained. A repealed article contains no standards,
    // which is the shape most likely to be misread as "no FAR applies here" —
    // the fabricated known absence this module's header was written about.
    expect(r.farUnconstrained).toBe(false)
    // Exactly one family is repealed — so this cannot pass by the flag spreading.
    expect(SAN_DIEGO_PLANNED_DISTRICTS.filter((x) => x.repealed).length).toBe(1)
  })
})
