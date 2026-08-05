// Austin base-zone height/FAR table, pinned to the PRIMARY source.
//
// Source of every figure below: City of Austin Land Development Code
// § 25-2-492 (SITE DEVELOPMENT REGULATIONS), Subsection (D) "Site development
// regulation table" — Municode Supplement No. 173, banner "Codified through
// Ordinance No. 20260122-059, effective February 2, 2026". Read cell-by-cell
// 2026-08-05; the table's Source line ends "Ord. 20100819-064; Ord. No.
// 20251023-063, Pt. 1, 11-3-25".
//
// § 25-2-492(A): "The table in Subsection (D) establishes the principal site
// development regulations for each zoning district."
//
// WHY THIS FILE EXISTS: the table has 37 district columns and every row carries
// exactly 37 value cells, so one row slipping a column publishes a NEIGHBOURING
// district's number under this district's name — internally consistent, green
// under every existing test. These assertions pin the alignment, not just the
// values: the districts either side of each corrected one are asserted too, so a
// future single-column shift cannot pass.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getAustinParcelInfo } from './austin'
import { computeEnvelope } from '../envelope'
import { mockArcgisFetch, featureSet } from './__fixtures__'

const LAT = 30.2672
const LNG = -97.7431

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

/** Run the REAL provider entry point for one base zone. Reading the constant
 *  table directly would measure the table, not the pipeline that publishes it —
 *  the SF-1/2/3 Subchapter F branch overrides it, and only the entry point
 *  exercises that precedence. */
async function zoneFor(base: string, opts: { insideSubchapterF?: boolean } = {}) {
  vi.stubEnv('MAPBOX_TOKEN', 'test-token')
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    mockArcgisFetch({
      EXTERNAL_tcad_parcel: featureSet({ SITUS: '123', PID_10: '0203140112', Shape__Area: 8712 }),
      Current_Zoning_gdb: featureSet({ BASE_ZONE: base, ZONE_NAME: base, ZONING_ZTYPE: 'Base' }),
      NFHL: featureSet(),
      // Subchapter F: an empty feature set = outside the boundary.
      PLANNINGCADASTRE_residential_design_standards: opts.insideSubchapterF
        ? featureSet({ ZONING_OVERLAY_NAME: 'RESIDENTIAL DESIGN STANDARDS' })
        : featureSet(),
      'api.mapbox.com': { features: [{ properties: { name: '123 Congress Ave' } }] },
    }),
  )
  const res = await getAustinParcelInfo(LAT, LNG)
  expect(res.ok).toBe(true)
  if (!res.ok) throw new Error('provider failed')
  return res.info.zoning
}

// ---------------------------------------------------------------------------
// CORRECTED — CBD max height. Old shipped value: null (rendered downtown as
// "height not published"). § 25-2-492(D), MAXIMUM HEIGHT row, CBD column: 350.
// ---------------------------------------------------------------------------
describe('CBD — § 25-2-492(D) states 350 ft (was published as null)', () => {
  it('publishes 350 ft, not the retracted null', async () => {
    const z = await zoneFor('CBD')
    expect(z.maxHeightFt).toBe(350)
    expect(z.maxHeightFt).not.toBeNull() // the value this replaces
    expect(z.maxFAR).toBe(8.0) // unchanged: CBD FAR cell reads "8:1"
  })

  it('350 is a BASE entitlement — § 25-2-586(B)(2) measures bonus area above it', async () => {
    // § 25-2-581 (CBD District Regulations) imposes no height of its own, and the
    // Downtown Density Bonus Program describes participation "only for
    // floor-to-area ratio that exceeds 8:1 or height above 350 feet". So 350 is
    // the floor of the bonus, i.e. the top of the by-right envelope.
    const z = await zoneFor('CBD')
    expect(z.maxHeightFt).toBe(350)
  })

  it('pins the neighbouring columns, so a one-column slip cannot pass', async () => {
    // Table order: … GR | L | CBD | DMU | W/LO | CS …
    expect((await zoneFor('L')).maxHeightFt).toBe(200) // L, column left of CBD
    expect((await zoneFor('DMU')).maxHeightFt).toBe(120) // DMU, column right of CBD
    expect((await zoneFor('L')).maxFAR).toBe(8.0) // "8:1"
    expect((await zoneFor('DMU')).maxFAR).toBe(5.0) // "5:1"
  })
})

// ---------------------------------------------------------------------------
// CORRECTED — SF-4B. Old shipped value: maxHeightFt 30. The code states STORIES.
// § 25-2-492(D) height cell is footnote 5 → § 25-2-558(G): "Except as provided
// in Subsection (H), the maximum height of a building is two stories. A story
// may not exceed a plate height of 10 feet."
// ---------------------------------------------------------------------------
describe('SF-4B — the code states 2 stories, not 30 feet', () => {
  it('carries the stated story count and leaves feet unresolved (was 30 ft)', async () => {
    const z = await zoneFor('SF-4B')
    expect(z.maxStories).toBe(2)
    expect(z.maxHeightFt).toBeNull()
    expect(z.maxHeightFt).not.toBe(30) // the invented conversion this replaces
  })

  it('the envelope reports the story count as STATED, never derived', async () => {
    // Deriving stories from a height round-trips through a floor-to-floor
    // constant the Austin code never uses. `storiesBasis` is what keeps the two
    // distinguishable in the published record.
    const z = await zoneFor('SF-4B')
    const env = computeEnvelope(
      {
        address: 'test',
        parcelId: 'test',
        coordinates: [LNG, LAT],
        zoning: z,
        lot: { sizeSqFt: 8712, lotType: null },
        overlays: { historicDistrict: null, floodZone: null },
        sources: {},
        fetchedAt: '2026-08-05T00:00:00.000Z',
      },
      'austin',
    )
    expect(env.maxStories).toBe(2)
    expect(env.storiesBasis).toBe('stated')
    expect(env.maxHeightFt).toBeNull()
  })

  it('SF-4A, the adjacent column, is a real 35 ft figure — § 25-2-779(D)(3)', async () => {
    // "The maximum height for a structure is 35 feet." SF-4A and SF-4B sit side
    // by side and BOTH footnote out of the § 25-2-492 table; only one of them
    // resolves to feet. Pinning both keeps them from being conflated again.
    const z = await zoneFor('SF-4A')
    expect(z.maxHeightFt).toBe(35)
    expect(z.maxStories).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// CORRECTED — R&D FAR. Old shipped value: 0.25 on every R&D parcel.
// § 25-2-492(D)'s R&D FAR cell is footnote 14 → § 25-2-603(E), which applies
// ".25 to 1" only "in the following areas" (five named watersheds / the
// Northwest Area). We do not resolve watershed geometry.
// ---------------------------------------------------------------------------
describe('R&D — the 0.25 FAR is geographically conditioned, not district-wide', () => {
  it('leaves FAR unresolved rather than publishing the conditional 0.25', async () => {
    const z = await zoneFor('R&D')
    expect(z.maxFAR).toBeNull()
    expect(z.maxFAR).not.toBe(0.25) // the unconditional value this replaces
  })

  it('is a GAP, not a known absence — § 25-2-603(E) does fill the slot somewhere', async () => {
    // Rule 5: "we could not resolve a FAR" must not render as "the code imposes
    // none". The slot exists and is filled for five named areas, so no absence
    // has been established and `farUnconstrained` must stay unset.
    const z = await zoneFor('R&D')
    expect(z.farUnconstrained).toBeUndefined()
    const env = computeEnvelope(
      {
        address: 'test',
        parcelId: 'test',
        coordinates: [LNG, LAT],
        zoning: z,
        lot: { sizeSqFt: 8712, lotType: null },
        overlays: { historicDistrict: null, floodZone: null },
        sources: {},
        fetchedAt: '2026-08-05T00:00:00.000Z',
      },
      'austin',
    )
    expect(env.farBasis).toBeNull()
    expect(env.maxFloorAreaSqFt).toBeNull()
  })

  it('R&D height 45 ft is the BASE, not the 90 ft setback-earned maximum', async () => {
    // § 25-2-603(F): "The maximum height is 45 feet, except that the height of a
    // building may exceed 45 feet by one foot for each additional two feet that
    // the building is set back … up to a maximum height of 90 feet."
    const z = await zoneFor('R&D')
    expect(z.maxHeightFt).toBe(45)
    expect(z.maxHeightFt).not.toBe(90)
  })
})

// ---------------------------------------------------------------------------
// CONFIRMED CORRECT — checked cell-by-cell and left alone. A negative is a
// result: these pin the alignment of the whole MAXIMUM HEIGHT / MAXIMUM FLOOR
// AREA RATIO rows so a future edit cannot slide one district's value onto
// another's key without failing here.
// ---------------------------------------------------------------------------
describe('§ 25-2-492(D) MAXIMUM HEIGHT row — verified unchanged', () => {
  const heights: Array<[string, number]> = [
    ['RR', 35],
    ['SF-5', 35],
    ['SF-6', 35],
    ['MF-1', 40],
    ['MF-2', 40], // cell reads "40 or 3 stories"; 40 is the code's own foot figure
    ['MF-3', 40],
    ['MF-4', 60],
    ['MF-5', 60],
    ['MF-6', 90],
    ['MH', 35], // NOT from this table — § 25-2-1205(15); see austin.ts
    ['NO', 35], // "35 or 2 stories"
    ['LO', 40], // "40 or 3 stories"
    ['GO', 60],
    ['CR', 40],
    ['LR', 40], // "40 or 3 stories"
    ['GR', 60],
    ['CS', 60],
    ['CS-1', 60],
    ['IP', 60],
    ['MI', 120],
    ['LI', 60],
  ]
  for (const [zone, ft] of heights) {
    it(`${zone} = ${ft} ft`, async () => {
      expect((await zoneFor(zone)).maxHeightFt).toBe(ft)
    })
  }
})

describe('§ 25-2-492(D) MAXIMUM FLOOR AREA RATIO row — verified unchanged', () => {
  const fars: Array<[string, number]> = [
    ['MF-3', 0.75], // ".75:1"
    ['MF-4', 0.75], // ".75:1"
    ['MF-5', 1.0], // "1:1"
    ['NO', 0.35], // ".35:1"
    ['LO', 0.7], // ".7:1"
    ['GO', 1.0],
    ['CR', 0.25], // ".25:1"
    ['LR', 0.5], // ".5:1"
    ['GR', 1.0],
    ['CS', 2.0], // "2:1"
    ['CS-1', 2.0], // "2:1"
    ['IP', 1.0],
    ['MI', 1.0],
    ['LI', 1.0],
  ]
  for (const [zone, far] of fars) {
    it(`${zone} = ${far}`, async () => {
      expect((await zoneFor(zone)).maxFAR).toBe(far)
    })
  }

  it('MF-1 and MF-6 have no usable FAR cell — a gap, not a zero', async () => {
    // MF-1's FAR cell is BLANK; MF-6's is an em dash. Neither is a number, and
    // neither has been shown to be an absence, so both stay null.
    expect((await zoneFor('MF-1')).maxFAR).toBeNull()
    expect((await zoneFor('MF-6')).maxFAR).toBeNull()
    expect((await zoneFor('MF-1')).farUnconstrained).toBeUndefined()
    expect((await zoneFor('MF-6')).farUnconstrained).toBeUndefined()
  })
})

describe('districts deliberately absent from the table stay gaps', () => {
  // W/LO and CH have real § 25-2-492(D) cells, but they are footnote pointers we
  // have not resolved (CH's height is a function of impervious cover,
  // § 25-2-582(B): 60 ft at >80% cover rising to 120 ft at ≤65%). Publishing a
  // single number for either would pick one branch of a conditional.
  for (const zone of ['W/LO', 'CH', 'DR', 'AV', 'P', 'AG']) {
    it(`${zone} resolves to no height and no FAR`, async () => {
      const z = await zoneFor(zone)
      expect(z.maxHeightFt).toBeNull()
      expect(z.maxFAR).toBeNull()
      expect(z.farUnconstrained).toBeUndefined() // a gap, never an answer
    })
  }
})

// ---------------------------------------------------------------------------
// The SF-1/2/3 Subchapter F branch overrides this table entirely. Asserted here
// so a future edit to AUSTIN_LIMITS cannot quietly start winning over it.
// ---------------------------------------------------------------------------
describe('SF-1/2/3 still resolve through the Subchapter F branch, not this table', () => {
  it('inside the boundary: 0.40 FAR / 32 ft, not the table 35 ft', async () => {
    const z = await zoneFor('SF-3', { insideSubchapterF: true })
    expect(z.maxHeightFt).toBe(32)
    expect(z.maxFAR).toBe(0.4)
  })

  it('outside the boundary: table height 35 ft, FAR unconstrained', async () => {
    const z = await zoneFor('SF-3')
    expect(z.maxHeightFt).toBe(35)
    expect(z.maxFAR).toBeNull()
    expect(z.farUnconstrained).toBe(true)
  })
})
