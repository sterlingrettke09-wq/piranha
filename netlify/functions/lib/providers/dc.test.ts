import { describe, it, expect, vi, afterEach } from 'vitest'
import { getDcParcelInfo, dcLimits } from './dc'
import { mockArcgisFetch, featureSet, ARCGIS_ERROR_200 } from './__fixtures__'

// Endpoint URL substrings the DC provider hits (see dc.ts):
//   PARCELS  = .../Property_and_Land/MapServer/40  → 'MapServer/40'
//   ZONING   = .../DCOZ/Zone_Mapservice/MapServer/24 → 'MapServer/24'
//   HISTORIC = .../DCOZ/Zone_Mapservice/MapServer/6  → 'MapServer/6'
//   FLOOD    = FEMA NFHL → 'NFHL'
// (ZONING and HISTORIC share the 'Zone_Mapservice' base, so we route on the
// distinct trailing layer id.)

const LAT = 38.9072
const LNG = -77.0369

const dcParcel = (over: Record<string, unknown> = {}) =>
  featureSet({
    PREMISEADD: '1350 PENNSYLVANIA AVE NW WASHINGTON DC 20004',
    SSL: '0295    0805',
    LANDAREA: 12500,
    USECODE: '012',
    SALETYPE: 'Improved',
    CLASSTYPE: '2 - Commercial',
    OWNERNAME: 'PRIVATE HOLDINGS LLC',
    ...over,
  })

const dcZoning = (code = 'MU-4A') => featureSet({ Zoning: code, Zone_District: 'Mixed-Use' })

afterEach(() => vi.restoreAllMocks())

describe('getDcParcelInfo — happy path', () => {
  it('normalizes a private MU-4A parcel with lettered-subzone fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/40': dcParcel(),
        'MapServer/24': dcZoning('MU-4A'),
        'MapServer/6': featureSet(),
        NFHL: featureSet({ FLD_ZONE: 'X' }),
      }),
    )

    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // PREMISEADD trimmed at "WASHINGTON DC".
    expect(res.info.address).toBe('1350 PENNSYLVANIA AVE NW')
    expect(res.info.parcelId).toBe('0295    0805')
    expect(res.info.zoning.districtCode).toBe('MU-4A')
    // LANDAREA → lot size sq ft.
    expect(res.info.lot.sizeSqFt).toBe(12500)
    expect(res.info.overlays.floodZone).toBe('X')
    // Lettered-subzone parent fallback: 'MU-4A' isn't in DC_LIMITS but 'MU-4' is
    // (h:50, f:2.5) — code strips the trailing A to the numbered parent.
    expect(res.info.zoning.maxHeightFt).toBe(50)
    expect(res.info.zoning.maxFAR).toBe(2.5)
    // MU prefix → commercial/mixed/residential.
    expect(res.info.zoning.allowedUses).toEqual(['commercial', 'mixed', 'residential'])
  })

  // ⚠️ This test asserted `maxFAR === 5.0` until 2026-08-05. That figure was
  // wrong — 11 DCMR Subtitle G Table § 402.1 gives MU-7 a FAR of 4.0, and the
  // table had slipped one row down the column. The test was not failing to catch
  // the defect, it was DEFENDING it: correcting the provider meant arguing
  // against a green test whose name asserted the wrong number (rule 15).
  // The height (65 ft) was right and is unchanged.
  it('pins an exact-match base zone (MU-7 → h:65, f:4.0) without fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/40': dcParcel(),
        'MapServer/24': dcZoning('MU-7'),
        'MapServer/6': featureSet(),
        NFHL: featureSet(),
      }),
    )
    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxHeightFt).toBe(65)
    expect(res.info.zoning.maxFAR).toBe(4.0)
  })

  it('detects a government owner via OWNERNAME and surfaces ownerPublic', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/40': dcParcel({ OWNERNAME: 'DISTRICT OF COLUMBIA' }),
        'MapServer/24': dcZoning('MU-4'),
        'MapServer/6': featureSet(),
        NFHL: featureSet(),
      }),
    )
    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.existing?.ownerPublic).toBe(true)
  })

  it('surfaces a historic district name when the layer matches', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/40': dcParcel(),
        'MapServer/24': dcZoning('MU-4'),
        'MapServer/6': featureSet({ HistDistrict_NAME: 'Downtown Historic District' }),
        NFHL: featureSet(),
      }),
    )
    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBe('Downtown Historic District')
  })
})

describe('getDcParcelInfo — resilience', () => {
  it('still ok:true with null overlays when historic + flood reject', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/40': dcParcel(),
        'MapServer/24': dcZoning('MU-4'),
        'MapServer/6': () => {
          throw new Error('historic down')
        },
        NFHL: () => {
          throw new Error('flood down')
        },
      }),
    )
    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.overlays.historicDistrict).toBeNull()
    expect(res.info.overlays.floodZone).toBeNull()
    expect(res.info.parcelId).toBe('0295    0805')
  })

  it('returns UPSTREAM_ERROR 502 when the parcel dataset returns ArcGIS error-200 on every call', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/40': ARCGIS_ERROR_200,
        'MapServer/24': dcZoning('MU-4'),
        'MapServer/6': featureSet(),
        NFHL: featureSet(),
      }),
    )
    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('UPSTREAM_ERROR')
    expect(res.status).toBe(502)
  })

  it('returns NO_PARCEL 404 when parcels are empty (exact and buffered)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/40': featureSet(), // empty for both exact + buffered snap query
        'MapServer/24': dcZoning('MU-4'),
        'MapServer/6': featureSet(),
        NFHL: featureSet(),
      }),
    )
    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.code).toBe('NO_PARCEL')
    expect(res.status).toBe(404)
  })
})

// DC's limit table used a single `f: null` for two states rule 5 says must never
// render the same: "the code imposes no FAR here" (an ANSWER) and "we could not
// resolve one" (a GAP). The split below is verified against the DC Office of
// Zoning's own PDFs of Title 11 — not against the code comment that used to
// assert it, because rule 15 is precisely about how convincing a well-written
// internal rationale looks. Sections are quoted in dc.ts.
describe('DC separates a stated FAR absence from an unresolved one', () => {
  // Subtitle D ch. 3 and Subtitle E ch. 3/4/5 contain NO floor-area-ratio
  // section at all; the parallel slot is dwelling-unit count. The structural
  // tell is that Subtitle E ch. 6 DOES have § 602 "FAR AND MAXIMUM NUMBER OF
  // DWELLING UNITS" — the section exists exactly where FAR applies.
  it.each(['R-1A', 'R-1B', 'R-2', 'R-3', 'RF-1', 'RF-2', 'RF-3'])(
    '%s is a stated absence, not a gap',
    (zone) => {
      const l = dcLimits(zone)
      expect(l.f).toBeNull()
      expect(l.noFar).toBe(true)
      expect(l.cite).toMatch(/DCMR/)
    },
  )

  // 11 DCMR Subtitle E § 602.1: "The maximum permitted floor area ratio (FAR)
  // for all buildings and structures in the RF-4 and RF-5 zones shall be 1.8."
  it.each([
    ['RF-4', 1.8, 40, 3],
    ['RF-5', 1.8, 50, 4],
  ] as const)('%s publishes FAR %s, height %s ft, %s stories', (zone, f, h, s) => {
    const l = dcLimits(zone)
    expect(l.f).toBe(f)
    expect(l.h).toBe(h)
    expect(l.s).toBe(s)
    expect(l.noFar).toBeUndefined()
  })

  // Downtown and the other unresolved families must NOT be claimed as absences.
  // These fail closed: no FAR and no `noFar`, so the verdict is withheld.
  it.each(['D-4', 'ARTS-1', 'CG-2', 'PDR-1', 'HE-2', 'NHR', 'MU-11', 'MU-14'])(
    '%s stays a GAP — unknown, not unconstrained',
    (zone) => {
      const l = dcLimits(zone)
      expect(l.f).toBeNull()
      expect(l.noFar).toBeUndefined()
    },
  )

  // An overlay suffix means a Subtitle C/W overlay we have not read. The base
  // zone's verified absence is a fact about the BASE ZONE; extending it across
  // an unread overlay would assert legal permission we never checked. Heights
  // still resolve from the base — only the FAR claim is withheld.
  it.each(['R-1A/FH', 'R-1B/WH', 'R-3/NO', 'RF-1/CAP', 'R-1A/TS/NO'])(
    '%s withholds the absence claim because an overlay is unread',
    (zone) => {
      expect(dcLimits(zone).noFar).toBeUndefined()
      expect(dcLimits(zone).h).not.toBeNull()
    },
  )

  it('the Georgetown cap does not inherit an FAR claim from its base zone', () => {
    expect(dcLimits('R-1B/GT')).toEqual({ h: 35, f: null })
  })

  // The code hyphenates as R-1-A while the GIS publishes R-1A. Both must reach
  // the same answer — the Chicago punctuation defect, in another city.
  it('accepts the code spelling and the GIS spelling alike', () => {
    expect(dcLimits('R-1-A').noFar).toBe(true)
    expect(dcLimits('R-1A').noFar).toBe(true)
  })

  // Rule 12: carry the story count the code STATES rather than dividing feet by
  // an ft/story constant the code never used. § 303.1 states 40 ft AND three
  // stories; 40 ÷ 11 rounds to 3 by luck, not by reading.
  it('carries the code-stated story count for R zones', () => {
    expect(dcLimits('R-2')).toMatchObject({ h: 40, s: 3 })
  })

  // A `noFar` with no citation is exactly the state this split exists to
  // prevent — an absence asserted without a source (rule 14: make it impossible,
  // not documented).
  it.each(['R-1A', 'R-2', 'RF-1', 'RF-2', 'RF-3'])('%s cites a section', (zone) => {
    expect(dcLimits(zone).cite).toBeTruthy()
  })
})

// The DCOZ layer carries `Zoning` and `ZR16`, which agree on 974 of 977 polygons
// (measured live 2026-08-05). Where they disagree they name different zones —
// MU-2 vs MU-3A is FAR 6.0 vs 1.0 — and nothing in the layer says which column
// is authoritative. An arbitrary pick is worst exactly where the spread is
// widest, so the envelope is withheld and the gap discloses itself.
describe('DC fails closed where the two zone columns disagree', () => {
  const withZones = (Zoning: string, ZR16: string) =>
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      mockArcgisFetch({
        'MapServer/40': dcParcel(),
        'MapServer/24': featureSet({ Zoning, ZR16, Zone_District: 'Mixed-Use' }),
        'MapServer/6': featureSet(),
        NFHL: featureSet(),
      }),
    )

  it('withholds FAR and height when Zoning and ZR16 name different districts', async () => {
    withZones('MU-2', 'MU-3A')
    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // The label still shows — only the envelope is withheld.
    expect(res.info.zoning.districtCode).toBe('MU-2')
    expect(res.info.zoning.maxFAR).toBeNull()
    expect(res.info.zoning.maxHeightFt).toBeNull()
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
  })

  it('resolves normally when the two columns agree', async () => {
    withZones('MU-2', 'MU-2')
    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.maxFAR).toBe(6.0)
    expect(res.info.zoning.maxHeightFt).toBe(90)
  })

  // A disagreement must not be allowed to manufacture a stated absence either.
  it('withholds the no-FAR claim too when the columns disagree', async () => {
    withZones('R-2', 'MU-4')
    const res = await getDcParcelInfo(LAT, LNG)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.info.zoning.farUnconstrained).toBeUndefined()
    expect(res.info.zoning.maxFAR).toBeNull()
  })
})

// Every figure below is quoted from the DC Office of Zoning's published PDFs of
// Title 11, read 2026-08-05. Before that read, these numbers' only provenance
// was a code comment — and four of the ten MU districts were wrong, two of them
// overstating buildable area. The table was internally consistent, typechecked,
// and covered by a test asserting it equalled itself.
describe('DC RA and MU figures, against Subtitles F and G', () => {
  // Subtitle F Table § 302.1 (FAR) / Table § 303.1 (height, stories).
  it.each([
    ['RA-1', 0.9, 40],
    ['RA-2', 1.8, 50],
    ['RA-3', 3.0, 60],
    ['RA-4', 3.5, 90],
    ['RA-5', 5.0, 90],
  ] as const)('%s → FAR %s, %s ft', (zone, f, h) => {
    expect(dcLimits(zone)).toMatchObject({ f, h })
  })

  // RA-5 also reads "6.0 for an apartment house or hotel". The base is kept:
  // the larger figure assumes a program the user has not chosen (rule 6).
  it('keeps RA-5 at the base 5.0, not the apartment-house 6.0', () => {
    expect(dcLimits('RA-5').f).toBe(5.0)
  })

  // Subtitle G Table § 302.1 (MU-1/2) and Table § 402.1 (MU-3…10).
  it.each([
    ['MU-1', 4.0, 65],
    ['MU-2', 6.0, 90],
    ['MU-3', 1.0, 40],
    ['MU-4', 2.5, 50],
    ['MU-6', 6.0, 90],
    ['MU-7', 4.0, 65],
    ['MU-8', 5.0, 70],
    ['MU-9', 6.5, 90],
    ['MU-10', 6.0, 90],
  ] as const)('%s → FAR %s, %s ft', (zone, f, h) => {
    expect(dcLimits(zone)).toMatchObject({ f, h })
  })

  // The four that were wrong, pinned individually so a regression names itself.
  // Ours held the code's MU-(N+1) figure for N = 6, 7, 8.
  it('MU-7 and MU-8 no longer overstate buildable area', () => {
    expect(dcLimits('MU-7').f).toBe(4.0) // was 5.0 — 25% overstatement
    expect(dcLimits('MU-8').f).toBe(5.0) // was 6.5 — 30% overstatement
  })
  it('MU-6 and MU-9 no longer understate it', () => {
    expect(dcLimits('MU-6').f).toBe(6.0) // was 4.0
    expect(dcLimits('MU-9').f).toBe(6.5) // was 6.0
  })

  // MU-5-A and MU-5-B share FAR 3.5 but NOT height. A single MU-5 at 70 ft
  // matched neither, and the lettered-parent fallback hid it.
  it.each([
    ['MU-5-A', 65],
    ['MU-5A', 65],
    ['MU-5-B', 75],
    ['MU-5B', 75],
  ] as const)('%s is %s ft with FAR 3.5', (zone, h) => {
    expect(dcLimits(zone)).toMatchObject({ f: 3.5, h })
  })

  // A bare MU-5 is ambiguous between the two sub-zones' heights, so it fails
  // closed rather than picking one.
  it('a bare MU-5 resolves to nothing', () => {
    expect(dcLimits('MU-5')).toEqual({ h: null, f: null })
  })

  // IZ rows are bonus tiers earned by providing affordable units, never
  // by-right. The base must never silently become the bonus.
  it('never publishes an Inclusionary Zoning bonus as the by-right figure', () => {
    expect(dcLimits('MU-1').f).toBe(4.0) // not 4.8 (IZ)
    expect(dcLimits('MU-2').f).toBe(6.0) // not 7.2 (IZ)
    expect(dcLimits('MU-10').h).toBe(90) // not 100 (IZ)
  })

  // Every figure now names the section it came from.
  it.each(['RA-1', 'RA-5', 'MU-1', 'MU-7', 'MU-9', 'MU-5A'])('%s cites a section', (zone) => {
    expect(dcLimits(zone).cite).toMatch(/Subtitle [FG]/)
  })
})
