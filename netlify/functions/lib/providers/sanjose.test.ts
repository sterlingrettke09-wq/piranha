import { describe, it, expect } from 'vitest'
import { parseSanJoseHeightFt, sanJoseUsesForZone } from './sanjose'

// San Jose publishes HEIGHTLIMIT as free text on the height-limit layer. The
// prose strings below are verbatim from the live layer (recon 2026-08-03).
describe('parseSanJoseHeightFt', () => {
  it('parses a plain numeric height', () => {
    expect(parseSanJoseHeightFt('120')).toBe(120)
    expect(parseSanJoseHeightFt('150')).toBe(150)
    expect(parseSanJoseHeightFt(' 65 ft ')).toBe(65)
    expect(parseSanJoseHeightFt('45 feet')).toBe(45)
  })

  it('returns null for airport/FAA prose rather than inventing a limit', () => {
    // Downtown San Jose sits under the airport approach; these are the real
    // values the layer returns there.
    expect(parseSanJoseHeightFt('Determined by FAA')).toBeNull()
    expect(parseSanJoseHeightFt('Defined by Airspace Req')).toBeNull()
    expect(parseSanJoseHeightFt('Varies by district')).toBeNull()
    expect(parseSanJoseHeightFt('See Council Policy')).toBeNull()
    expect(parseSanJoseHeightFt('Per approved PD permit')).toBeNull()
  })

  it('returns null for empty / missing / absurd values', () => {
    expect(parseSanJoseHeightFt('')).toBeNull()
    expect(parseSanJoseHeightFt('   ')).toBeNull()
    expect(parseSanJoseHeightFt(null)).toBeNull()
    expect(parseSanJoseHeightFt(undefined)).toBeNull()
    expect(parseSanJoseHeightFt('0')).toBeNull()
    expect(parseSanJoseHeightFt('99999')).toBeNull()
  })
})

describe('sanJoseUsesForZone', () => {
  it('maps the codes seen live', () => {
    expect(sanJoseUsesForZone('R-1-8')).toEqual(['residential'])
    expect(sanJoseUsesForZone('A(PD)')).toContain('mixed')
    expect(sanJoseUsesForZone('CN')).toContain('commercial')
    expect(sanJoseUsesForZone('LI')).toContain('institutional')
    expect(sanJoseUsesForZone(null)).toBeNull()
  })
  it('treats Public/Quasi-Public as institutional (San Jose City Hall reads PQP)', () => {
    expect(sanJoseUsesForZone('PQP')).toEqual(['institutional'])
  })
})

// ---- Title 20 use-table audit, 2026-08-05 ----
// Source for every assertion below: San José Municipal Code Title 20 as
// published by Municode, "Codified through Ordinance No. 31330, enacted
// June 16, 2026. (Supp. No. 5, Update 3)".
//
// The district codes exercised here are the live domain of the ZONING field on
// PLN_Geocortex_Public_PRD layer 128, read from the layer's own renderer rather
// than assumed (62 values).
describe('sanJoseUsesForZone — corrected against Title 20 use tables', () => {
  // Table 20-90 (§ 20.40.100), columns CO | CP | CN | CG | PQP. The CO column
  // is "-" on every dwelling row: "Mixed use residential/commercial outside
  // Neighborhood Business District Overlay", the matching "within" row,
  // "Live/work uses", "Single room occupancy, living unit" and "Permanent
  // supportive housing". § 20.40.100: "Land uses not listed on Table 20-90 are
  // not permitted."
  //
  // SHIPPED WRONG as ['commercial','mixed','residential']. That reached users:
  // envelope.ts derives maxUnits only when allowedUses includes 'residential'
  // or 'mixed', so a CO parcel was published with a dwelling-unit count, and
  // feasibility.ts scored a residential project AS_OF_RIGHT in an office
  // district whose use table forbids dwellings outright.
  it('CO Commercial Office permits no dwellings (was commercial+mixed+residential)', () => {
    expect(sanJoseUsesForZone('CO')).toEqual(['commercial'])
    expect(sanJoseUsesForZone('CO')).not.toContain('residential')
    expect(sanJoseUsesForZone('CO')).not.toContain('mixed')
  })

  // Table 20-110 (Chapter 20.50), columns CIC | TEC | IP | LI | HI. Under the
  // "Residential" heading, CIC carries only "Emergency residential shelter"
  // (C / P) and "Hotel supportive housing" C — no dwelling or mixed-use
  // residential row is permitted. SHIPPED WRONG as
  // ['commercial','mixed','residential'] via the /^CIC/ branch.
  it('CIC Combined Industrial/Commercial permits no dwellings (was commercial+mixed+residential)', () => {
    expect(sanJoseUsesForZone('CIC')).toEqual(['commercial', 'institutional'])
    expect(sanJoseUsesForZone('CIC')).not.toContain('residential')
  })

  // Same table, TEC column: "Hotel supportive housing" C is its only entry
  // under Residential. TEC is an industrial district — § 20.50.010, "TEC
  // Transit Employment Center". It previously fell through to null, and a null
  // is not neutral downstream: defaultSpec's pickUse returns 'residential' for
  // an empty use list, so an employment district defaulted to housing.
  it('TEC Transit Employment Center groups with the industrial districts (was null)', () => {
    expect(sanJoseUsesForZone('TEC')).toEqual(['commercial', 'institutional'])
    expect(sanJoseUsesForZone('TEC')).not.toContain('residential')
  })

  // § 20.55.203 use table, columns UVC | UV | MUC | MUN | UR | TR.
  // UVC reads "-" on "One-family dwelling", "Two-family dwelling", "Multiple
  // dwelling" AND "Mixed use development" — alone among the six.
  it('UVC Urban Village Commercial has no residential entitlement (was null)', () => {
    expect(sanJoseUsesForZone('UVC')).toEqual(['commercial'])
  })

  // UV and MUC: "Multiple dwelling" P and "Mixed use development" P, but
  // "One-family dwelling" and "Two-family dwelling" both "-".
  it('UV and MUC allow multiple dwellings and mixed use, not detached houses (were null)', () => {
    expect(sanJoseUsesForZone('UV')).toEqual(['commercial', 'mixed', 'residential'])
    expect(sanJoseUsesForZone('MUC')).toEqual(['commercial', 'mixed', 'residential'])
  })

  // MUN, UR, TR: "One-family dwelling" P, "Two-family dwelling" P, "Multiple
  // dwelling" P, "Mixed use development" P. The P on the detached-house rows is
  // the discriminator against UV/MUC, and is why 'residential' leads.
  it('MUN, UR and TR are residential-first (were null)', () => {
    expect(sanJoseUsesForZone('MUN')).toEqual(['residential', 'mixed', 'commercial'])
    expect(sanJoseUsesForZone('UR')).toEqual(['residential', 'mixed', 'commercial'])
    expect(sanJoseUsesForZone('TR')).toEqual(['residential', 'mixed', 'commercial'])
  })

  // Checked and found CORRECT — pinned so a later edit cannot quietly undo the
  // reading. CN/CP/CG: Table 20-90's "Mixed use residential/commercial outside
  // Neighborhood Business District Overlay" row reads C (CN), C/S (CP) and CGP
  // (CG) — listed with a permission symbol. DC/DC-NT1: the § 20.70.100 table's
  // "Residential, multiple dwelling" row reads PGP in both columns.
  it('leaves CN, CP, CG, DC and DC-NT1 alone — their tables do list residential', () => {
    for (const z of ['CN', 'CP', 'CG', 'DC', 'DC-NT1']) {
      expect(sanJoseUsesForZone(z)).toEqual(['commercial', 'mixed', 'residential'])
    }
  })

  // Table 20-110 again: no dwelling row is permitted in IP, LI or HI; HI adds
  // only "Living quarters, custodian, caretakers" C, which is not development.
  it('leaves IP, LI and HI non-residential', () => {
    for (const z of ['IP', 'LI', 'HI']) {
      expect(sanJoseUsesForZone(z)).toEqual(['commercial', 'institutional'])
      expect(sanJoseUsesForZone(z)).not.toContain('residential')
    }
  })

  // A GAP must not become an answer. MS-C/MS-G's § 20.75.200 table splits MS-G
  // into "Ground Floor Commercial Frontage" and "Residential Street Frontage"
  // sub-columns, so a cell cannot be assigned to a district without a frontage
  // the parcel layer does not carry — a joint dependency, unresolved. TERO is
  // an overlay, WATER is not a district.
  it('keeps genuinely unresolved codes null rather than guessing', () => {
    for (const z of ['MS-C', 'MS-G', 'TERO', 'WATER']) {
      expect(sanJoseUsesForZone(z)).toBeNull()
    }
  })

  // Planned Development is untouched by the exact-code table: Chapter 20.60
  // hands uses to the approved PD permit, so CO(PD) is NOT CO.
  it('planned-development codes still defer to the PD permit, not the base district', () => {
    expect(sanJoseUsesForZone('CO(PD)')).toEqual(['commercial', 'mixed', 'residential'])
    expect(sanJoseUsesForZone('CIC(PD)')).toEqual(['commercial', 'mixed', 'residential'])
    expect(sanJoseUsesForZone('TEC(PD)')).toEqual(['commercial', 'mixed', 'residential'])
    // ...except OS(PD)/PQP(PD), which the open-space branch catches first.
    expect(sanJoseUsesForZone('OS(PD)')).toEqual(['institutional'])
    expect(sanJoseUsesForZone('PQP(PD)')).toEqual(['institutional'])
  })
})

// ---- Chapter 20.85 height values, verified against the live layer ----
// Every distinct HEIGHTLIMIT value on PLN layer 128's sibling layer 84
// ("Specific Height Restriction", the GIS rendering of SJMC Chapter 20.85),
// pulled with returnDistinctValues on 2026-08-05. Ten values; all are stated in
// FEET or are FAA prose. There is no story-denominated value to convert.
describe('parseSanJoseHeightFt — the live Chapter 20.85 domain', () => {
  it('parses every numeric value the layer actually holds', () => {
    expect(parseSanJoseHeightFt('35 feet')).toBe(35)
    expect(parseSanJoseHeightFt('120 feet')).toBe(120)
    expect(parseSanJoseHeightFt('135 feet')).toBe(135)
    expect(parseSanJoseHeightFt('150 feet')).toBe(150)
    expect(parseSanJoseHeightFt('200 feet')).toBe(200)
    expect(parseSanJoseHeightFt('210 feet')).toBe(210)
    expect(parseSanJoseHeightFt('220 feet')).toBe(220)
    expect(parseSanJoseHeightFt('250 feet')).toBe(250)
    expect(parseSanJoseHeightFt('310 feet')).toBe(310)
  })
  it('nulls the one prose value the layer holds ("Determined by FAA")', () => {
    expect(parseSanJoseHeightFt('Determined by FAA')).toBeNull()
  })
})
