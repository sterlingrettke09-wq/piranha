import { describe, it, expect, vi, afterEach } from 'vitest'
import { getDenverParcelInfo, isFormerChapter59 } from './denver'
import { mockArcgisFetch, featureSet, ARCGIS_ERROR_200 } from './__fixtures__'
import { resolveZoningLimits } from '../zoningLimits'

// Endpoint URL substrings the Denver provider hits (see denver.ts):
//   PARCELS  = .../Zoning/MapServer/0 → 'MapServer/0'
//   ZONING   = .../Zoning/MapServer/1 → 'MapServer/1'
//   HISTORIC = ODC_HIST_LANDMARKDISTRICT_A → 'ODC_HIST_LANDMARKDISTRICT_A'
//   FLOOD    = FEMA NFHL → 'NFHL'
//   EHA      = EHA_WebService → 'EHA_WebService'

const LAT = 39.7392
const LNG = -104.9903

// The upstream ArcGIS field names cannot be checked against any type in this
// repo — only a live field query settles those. What CAN be checked is that an
// override names a field the fixture actually declares: `Record<string,
// unknown>` accepted `denverZoning({ HEIGHT_STORIESX: null })`, which silently
// leaves the base value in place, so the test asserts the unmodified fixture
// while reading as though it pinned a variant.
const DENVER_PARCEL = {
  SITUS_ADDRESS_LINE1: '1437  Bannock   St',
  LAND_AREA: 9500,
  SCHEDNUM: '0234512018000',
  D_CLASS_CN: 'COMMERCIAL',
  APPRAISED_IMP_VALUE: 450000,
  COM_ORIG_YEAR_BUILT: 1958,
  RES_ORIG_YEAR_BUILT: 0,
  OWNER_NAME: 'PRIVATE OWNER LLC',
}
const denverParcel = (over: Partial<typeof DENVER_PARCEL> = {}) =>
  featureSet({ ...DENVER_PARCEL, ...over })

// Spelled out rather than inferred, because tests override HEIGHT_STORIES with
// null and the inferred type of `5` is not nullable. An interface, not a cast:
// it checks the base literal as well as every override.
interface DenverZoningAttrs {
  ZONE_DISTRICT: string
  ZONE_DESCRIPTION: string
  OVERLAY_DISTRICT: string | null
  HEIGHT_STORIES: number | null
  ZONE_USE_FORM: string | null
}
const DENVER_ZONING: DenverZoningAttrs = {
  ZONE_DISTRICT: 'C-MX-5',
  ZONE_DESCRIPTION: 'Urban Center, Mixed Use',
  OVERLAY_DISTRICT: null,
  HEIGHT_STORIES: 5,
  ZONE_USE_FORM: 'MX',
}
const denverZoning = (over: Partial<DenverZoningAttrs> = {}) =>
  featureSet({ ...DENVER_ZONING, ...over })

afterEach(() => vi.restoreAllMocks())

describe('getDenverParcelInfo — happy path', () => {
  it('prefers the code-stated height over a HEIGHT_STORIES derivation for a C-MX-5 parcel', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': denverParcel(),
        'MapServer/1': denverZoning({ HEIGHT_STORIES: 5 }),
        ODC_HIST_LANDMARKDISTRICT_A: featureSet(),
        NFHL: featureSet({ FLD_ZONE: 'X' }),
        EHA_WebService: featureSet({ MarketArea: 'High' }),
      }),
    )

    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // SITUS_ADDRESS_LINE1 collapses runs of whitespace.
    expect(res.info.address).toBe('1437 Bannock St')
    expect(res.info.parcelId).toBe('0234512018000')
    expect(res.info.zoning.districtCode).toBe('C-MX-5')
    expect(res.info.lot.sizeSqFt).toBe(9500)
    // ⚠️ Was `5 stories × 12 ft/story = 60`. That assertion — and this test's own
    // former title — DEFENDED the production defect: the provider derived feet
    // from the live HEIGHT_STORIES field before consulting the curated table, so
    // correcting the table changed nothing for real parcels. DZC Art. 7
    // § 7.3.3.3.D prints C-MX-5 at 70 ft. A figure read from the code outranks
    // one manufactured from a story count (rules 11 and 12).
    expect(res.info.zoning.maxHeightFt).toBe(70)
    expect(res.info.zoning.maxFAR).toBeNull() // form-based code, no FAR
    // Resolving through the curated table keeps FAR null (Denver is
    // height-governed) while the code-stated 70 ft carries through — the honest
    // "height-governed district" shape, not a fabricated FAR.
    const resolved = resolveZoningLimits(res.info.zoning, 'denver')
    expect(resolved.maxFAR).toBeNull()
    expect(resolved.maxHeightFt).toBe(70)
    // -MX → commercial/mixed/residential.
    expect(res.info.zoning.allowedUses).toEqual(['commercial', 'mixed', 'residential'])
    // EHA market area feeds overlays.feeArea.
    expect(res.info.overlays.feeArea).toBe('High')
    // Existing structure derived from APPRAISED_IMP_VALUE > 0.
    expect(res.info.existing?.yearBuilt).toBe(1958)
    expect(res.info.existing?.landUse).toBe('Commercial')
    expect(res.info.existing?.numBuildings).toBe(1)
    // APPRAISED_IMP_VALUE → assessedValue, flagged as improvement-only (not a total).
    expect(res.info.existing?.assessedValue).toBe(450000)
    expect(res.info.existing?.assessedValueBasis).toBe('improvement only')
  })

  it('Former-Chapter-59 guard: returns null height despite a trailing number in the code', async () => {
    // HEIGHT_STORIES absent → falls through; description marks Former Chapter 59,
    // whose trailing number is a district CLASS not a story count → height null.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': denverParcel(),
        'MapServer/1': denverZoning({
          ZONE_DISTRICT: 'B-3',
          ZONE_DESCRIPTION: 'Former Chapter 59 — B-3 Business',
          HEIGHT_STORIES: null,
        }),
        ODC_HIST_LANDMARKDISTRICT_A: featureSet(),
        NFHL: featureSet(),
        EHA_WebService: featureSet(),
      }),
    )
    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // NOTE: pins the guard — B-3 has a trailing "3" but Former Chapter 59
    // description suppresses the story-count interpretation.
    expect(res.info.zoning.maxHeightFt).toBeNull()
    // Legacy B- prefix still maps to commercial/mixed/residential uses.
    expect(res.info.zoning.allowedUses).toEqual(['commercial', 'mixed', 'residential'])
  })

  // ⚠️ This test asserted `maxHeightFt === 36` and was titled "still derives a
  // height from the trailing token" — it PINNED a fabrication. `B-3` is a former
  // Chapter 59 code whose "3" is a district CLASS, not a story count, and the
  // guard fired only when ZONE_DESCRIPTION happened to contain the phrase
  // "former chapter 59". Described as plain "Business", the parcel published
  // 3 × 12 = 36 ft out of a number that means nothing of the kind.
  // The guard is now structural (code shape, not description text), so the
  // description being absent no longer opens the fabricating branch.
  it('a legacy code fabricates NO height even when the description omits "Former Chapter 59"', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': denverParcel(),
        'MapServer/1': denverZoning({
          ZONE_DISTRICT: 'B-3',
          ZONE_DESCRIPTION: 'Business',
          HEIGHT_STORIES: null,
        }),
        ODC_HIST_LANDMARKDISTRICT_A: featureSet(),
        NFHL: featureSet(),
        EHA_WebService: featureSet(),
      }),
    )
    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBeNull()
  })

  it('detects a government owner via OWNER_NAME and surfaces ownerPublic', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': denverParcel({ OWNER_NAME: 'CITY OF DENVER' }),
        'MapServer/1': denverZoning(),
        ODC_HIST_LANDMARKDISTRICT_A: featureSet(),
        NFHL: featureSet(),
        EHA_WebService: featureSet(),
      }),
    )
    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.ownerPublic).toBe(true)
  })
})

describe('getDenverParcelInfo — resilience', () => {
  it('still ok:true with null overlays when historic + flood + eha reject', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': denverParcel(),
        'MapServer/1': denverZoning(),
        ODC_HIST_LANDMARKDISTRICT_A: () => {
          throw new Error('historic down')
        },
        NFHL: () => {
          throw new Error('flood down')
        },
        EHA_WebService: () => {
          throw new Error('eha down')
        },
      }),
    )
    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
    expect(res.info.overlays.feeArea).toBeUndefined()
  })

  it('returns UPSTREAM_ERROR 502 when the parcel dataset returns ArcGIS error-200 on every call', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': ARCGIS_ERROR_200,
        'MapServer/1': denverZoning(),
        ODC_HIST_LANDMARKDISTRICT_A: featureSet(),
        NFHL: featureSet(),
        EHA_WebService: featureSet(),
      }),
    )
    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  it('returns NO_PARCEL 404 when parcels are empty (exact and buffered)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': featureSet(),
        'MapServer/1': denverZoning(),
        ODC_HIST_LANDMARKDISTRICT_A: featureSet(),
        NFHL: featureSet(),
        EHA_WebService: featureSet(),
      }),
    )
    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// ZONE_USE_FORM = '999' is the layer's OWN marker for a Former Chapter 59
// district. Measured 2026-08-15 across all 184 distinct ZONE_DISTRICT values:
// 76 carry it, 108 do not, and the split is exactly legacy vs DZC.
//
// The hyphen heuristic it replaces missed 31 of those 76 — every code with two
// or more hyphens — and for the ones ending in a number the trailing token was
// then read as a STORY COUNT. This is the B-3 defect one heuristic later.
// ---------------------------------------------------------------------------
describe('Former Chapter 59 detection reads the layer, not the code shape', () => {
  const legacy = async (code: string) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': denverParcel(),
        // No HEIGHT_STORIES: a legacy polygon carries none, and the point is
        // that the CODE must not manufacture one either.
        'MapServer/1': denverZoning({ ZONE_DISTRICT: code, ZONE_DESCRIPTION: '', HEIGHT_STORIES: null, ZONE_USE_FORM: '999' }),
        ODC_HIST_LANDMARKDISTRICT_A: featureSet(),
        NFHL: featureSet({ FLD_ZONE: 'X' }),
        EHA_WebService: featureSet({ MarketArea: 'High' }),
      }),
    )
    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error('refused')
    return res.info.zoning
  }

  // Each of these has TWO OR MORE hyphens, so the shape test called it a
  // current DZC district. C-MU-30 published 30 stories and 360 ft before this.
  it.each(['C-MU-20', 'C-MU-30', 'R-MU-20', 'R-MU-30', 'T-MU-30', 'C-CCN-12'])(
    '%s: the trailing number is a district CLASS, never a storey count',
    async (code) => {
      const z = await legacy(code)
      expect(z.maxStories ?? null).toBeNull()
      expect(z.maxHeightFt).toBeNull()
    },
  )

  // The second half of the same fabrication: Chapter 59 DID impose FAR in some
  // districts and this repo does not carry that table, so claiming none applies
  // asserts an absence nobody established (rule 5).
  it.each(['C-MU-30', 'C-CCN-12', 'H-1-A', 'R-2-A'])('%s never claims that no FAR applies', async (code) => {
    const z = await legacy(code)
    expect(z.farUnconstrained).toBeUndefined()
    expect(z.maxFAR).toBeNull()
  })

  it('still catches the single-hyphen legacy codes the shape test already got', async () => {
    for (const code of ['B-3', 'R-2', 'I-B']) {
      const z = await legacy(code)
      expect(z.maxStories ?? null, code).toBeNull()
      expect(z.maxHeightFt, code).toBeNull()
    }
  })

  it('leaves a current DZC district alone', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/0': denverParcel(),
        'MapServer/1': denverZoning({ ZONE_DISTRICT: 'C-MX-5', ZONE_USE_FORM: 'MX', HEIGHT_STORIES: 5 }),
        ODC_HIST_LANDMARKDISTRICT_A: featureSet(),
        NFHL: featureSet({ FLD_ZONE: 'X' }),
        EHA_WebService: featureSet({ MarketArea: 'High' }),
      }),
    )
    const res = await getDenverParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // The DZC figure, not a 999 refusal.
    expect(res.info.zoning.maxHeightFt).not.toBeNull()
    expect(res.info.zoning.farUnconstrained).toBe(true)
  })
})

describe('the legacy SHAPE fallback misclassifies current DZC districts', () => {
  // The layer's own ZONE_USE_FORM wins whenever present, so this is latent —
  // but it is a trap laid for whoever curates Campus or Downtown next. A
  // correct entry would be silently suppressed on any parcel missing that
  // field, and `farUnconstrained` is precisely what the legacy path withholds.
  //
  // Measured against the live enumeration: the shape test flags 41 of 184
  // codes, and these fourteen are CURRENT districts, each verified in the
  // republished-2025 code.
  const CURRENT_BUT_FLAGGED = [
    ['CMP-EI', 'Article 9 Div 9.2'], ['CMP-EI2', 'Article 9 Div 9.2'],
    ['CMP-H', 'Article 9 Div 9.2'], ['CMP-H2', 'Article 9 Div 9.2'],
    ['CMP-NWC', 'Article 9 Div 9.2'],
    ['D-AS', 'Article 8'], ['D-C', 'Article 8'], ['D-CV', 'Article 8'],
    ['D-GT', 'Article 8'], ['D-LD', 'Article 8'], ['D-TD', 'Article 8'],
    ['I-A', 'Article 9 Div 9.1'], ['I-B', 'Article 9 Div 9.1'],
    ['PUD-G', 'Article 9 Div 9.6'],
  ] as const

  it('the misclassified set is pinned, not merely non-empty (rule 20)', () => {
    expect(CURRENT_BUT_FLAGGED.length).toBe(14)
  })

  it.each(CURRENT_BUT_FLAGGED)('%s is current even carrying the 999 sentinel (%s)', (code) => {
    // ⚠️ THE LIVE LAYER PUBLISHES 999 FOR ALL OF THESE. Measured: ZONE_USE_FORM
    // is the BUILDING FORM (S-MX-3 → "MX", U-SU-A → "SU"), and 999 is its
    // sentinel for a district with no form — which is wider than former
    // Chapter 59. Reading 999 as "legacy" would mark every current Downtown,
    // Campus, Industrial-A/B and PUD district as predating the 2010 code.
    expect(isFormerChapter59(code, undefined, '999')).toBe(false)
  })

  it('and is current with the field missing too', () => {
    for (const [code] of CURRENT_BUT_FLAGGED) {
      expect(isFormerChapter59(code, undefined, undefined), code).toBe(false)
    }
  })

  it('genuinely legacy codes are still caught, by sentinel and by shape', () => {
    for (const code of ['R-2', 'B-3', 'O-1', 'R-X', 'OS-1', 'R-0', 'B-8']) {
      expect(isFormerChapter59(code, undefined, '999'), `${code} via sentinel`).toBe(true)
      expect(isFormerChapter59(code, undefined, undefined), `${code} via shape`).toBe(true)
    }
  })

  it('a form-bearing district is never legacy', () => {
    // The other side of the sentinel: these carry a real building form.
    for (const [code, form] of [['S-MX-3', 'MX'], ['G-MU-3', 'MU'], ['U-SU-A', 'SU'], ['E-TU-B', 'TU']]) {
      expect(isFormerChapter59(code, undefined, form), code).toBe(false)
    }
  })
})
