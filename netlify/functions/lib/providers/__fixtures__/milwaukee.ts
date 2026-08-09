// Canned Milwaukee responses for getMilwaukeeParcelInfo tests.
//
// Every fixture below is a VERBATIM capture of a live point query run
// 2026-08-08 against the real services, not a hand-written approximation. That
// matters: a fixture invented to match the provider's expectations tests the
// provider against itself, which is the internal-verification trap CLAUDE.md
// rule 9 describes. These carry the upstream's actual field names, actual
// casing ('2318 N SHERMAN BL' arrives as separate uppercase components), actual
// nulls (PARCEL_TYPE null on 1,026 real fee parcels), and actual value TYPES —
// note especially that MPROP returns every assessment column and NR_STORIES as
// a STRING ('128800', '1.5') while LOT_AREA and BLDG_AREA are floats.
//
// ONE DELIBERATE DEPARTURE, named here so the sentence above stays true: where
// the live OWNER_NAME_1 value is a private individual's name it has been
// replaced with a placeholder, flagged inline at each site. Every other field
// is as captured. The provider reduces the owner to a boolean and never returns
// the name, so the substitution changes no assertion — but a checked-in fixture
// is not the place for a private person's name, and an unqualified "verbatim"
// claim next to an edited value is the kind of half-true provenance statement
// CLAUDE.md warns about (disclosure copy is code).
import { featureSet } from './index'

// ── 2318 N Sherman Bl — RS5, an ordinary single-family house ────────────────
// Point 43.0611, -87.9670. Re-queried across separate isolated runs: identical.
// PLACEHOLDER — the live OWNER_NAME_1 here is a private individual.
export const milwaukeeParcelSherman = featureSet({
  TAXKEY: '3271717000',
  PARCEL_TYPE: 0,
  HOUSE_NR_LO: 2318,
  HOUSE_NR_SFX: '',
  SDIR: 'N',
  STREET: 'SHERMAN',
  STTYPE: 'BL',
  UNIT: '',
  OWNER_NAME_1: 'PRIVATE OWNER (placeholder)',
  C_A_CLASS: '1',
  C_A_LAND: '7400',
  C_A_TOTAL: '128800',
  C_A_EXM_LAND: '0',
  C_A_EXM_TOTAL: '0',
  YR_ASSMT: 2026,
  LOT_AREA: 8150.0,
  ZONING: 'RS5',
  NR_UNITS: 1,
  YR_BUILT: 1930,
  NR_STORIES: '1.5',
  BLDG_AREA: 2120.0,
})

export const milwaukeeZoningRs5 = featureSet({
  Zoning: 'RS5',
  ZoningCategory: 'RESIDENTIAL',
  ZoningType: 'SINGLE-FAMILY RESIDENTIAL DISTRICTS',
})

// ── 1030 W Scott St — RT4, the district whose height is 48 ft, not 45 ───────
// Point 43.0195, -87.9250. PLACEHOLDER owner: a private individual.
export const milwaukeeParcelScott = featureSet({
  TAXKEY: '4320374000',
  PARCEL_TYPE: 0,
  HOUSE_NR_LO: 1030,
  HOUSE_NR_SFX: '',
  SDIR: 'W',
  STREET: 'SCOTT',
  STTYPE: 'ST',
  UNIT: '',
  OWNER_NAME_1: 'PRIVATE OWNER (placeholder)',
  C_A_CLASS: '1',
  C_A_LAND: '7600',
  C_A_TOTAL: '86700',
  C_A_EXM_LAND: '0',
  C_A_EXM_TOTAL: '0',
  YR_ASSMT: 2026,
  LOT_AREA: 3500.0,
  ZONING: 'RT4',
  NR_UNITS: 1,
  YR_BUILT: 1875,
  NR_STORIES: '1',
  BLDG_AREA: 906.0,
})

export const milwaukeeZoningRt4 = featureSet({
  Zoning: 'RT4',
  ZoningCategory: 'RESIDENTIAL',
  ZoningType: 'TWO-FAMILY RESIDENTIAL DISTRICTS',
})

// ── 789 N Water St — C9F(B), downtown, "Building height, maximum: none" ─────
// Point 43.04065, -87.90993.
export const milwaukeeParcelWater = featureSet({
  TAXKEY: '3920401110',
  PARCEL_TYPE: 0,
  HOUSE_NR_LO: 789,
  HOUSE_NR_SFX: '',
  SDIR: 'N',
  STREET: 'WATER',
  STTYPE: 'ST',
  UNIT: '',
  OWNER_NAME_1: 'DRUML MARINE LLC',
  C_A_CLASS: '4',
  C_A_LAND: '1584000',
  C_A_TOTAL: '7168100',
  C_A_EXM_LAND: '0',
  C_A_EXM_TOTAL: '0',
  YR_ASSMT: 2026,
  LOT_AREA: 16000.0,
  ZONING: 'C9F(B)',
  NR_UNITS: 46,
  YR_BUILT: 1999,
  NR_STORIES: '5',
  BLDG_AREA: 73250.0,
})

export const milwaukeeZoningC9fB = featureSet({
  Zoning: 'C9F(B)',
  ZoningCategory: 'DOWNTOWN',
  ZoningType: 'OFFICE AND SERVICE',
})

// ── 200 E Wells St (City Hall) — the tax-exempt trap ────────────────────────
// Point 43.04166, -87.90972. C_A_TOTAL is the STRING '0' and the assessor's
// real figure is in C_A_EXM_TOTAL. LOT_AREA is 0.0, so the polygon fallback is
// the only source of a lot size here.
export const milwaukeeParcelCityHall = featureSet({
  TAXKEY: '3921261000',
  PARCEL_TYPE: 0,
  HOUSE_NR_LO: 200,
  HOUSE_NR_SFX: '',
  SDIR: 'E',
  STREET: 'WELLS',
  STTYPE: 'ST',
  UNIT: '',
  OWNER_NAME_1: 'CITY OF MILWAUKEE',
  C_A_CLASS: '9',
  C_A_LAND: '0',
  C_A_TOTAL: '0',
  C_A_EXM_LAND: '1541800',
  C_A_EXM_TOTAL: '10966000',
  YR_ASSMT: 2026,
  LOT_AREA: 0.0,
  ZONING: 'C9D(A)',
  NR_UNITS: 16,
  YR_BUILT: 1895,
  NR_STORIES: '8',
  BLDG_AREA: 250000.0,
})

export const milwaukeeZoningC9dA = featureSet({
  Zoning: 'C9D(A)',
  ZoningCategory: 'DOWNTOWN',
  ZoningType: 'CIVIC ACTIVITY',
})

// ── 200 S Rite-Hite Wa — IM, inside the Reed Street Yards DIZ ───────────────
// Point 43.02840, -87.91517. Two traps in one parcel: PARCEL_TYPE is NULL (a
// real fee parcel — a 128-unit apartment building assessed at $68.8M — not a
// shell row), and LOT_AREA is 0.0.
export const milwaukeeParcelReedSt = featureSet({
  TAXKEY: '4281163000',
  PARCEL_TYPE: null,
  HOUSE_NR_LO: 200,
  HOUSE_NR_SFX: '',
  SDIR: 'S',
  STREET: 'RITE-HITE',
  STTYPE: 'WA',
  UNIT: '',
  OWNER_NAME_1: 'SIXSIBS LLC',
  C_A_CLASS: '4',
  C_A_LAND: '4113800',
  C_A_TOTAL: '68801500',
  C_A_EXM_LAND: '0',
  C_A_EXM_TOTAL: '0',
  YR_ASSMT: 2026,
  LOT_AREA: 0.0,
  ZONING: 'IM',
  NR_UNITS: 128,
  YR_BUILT: 2022,
  NR_STORIES: '2.0',
  BLDG_AREA: 245485.0,
})

export const milwaukeeZoningIm = featureSet({
  Zoning: 'IM',
  ZoningCategory: 'INDUSTRIAL',
  ZoningType: 'INDUSTRIAL-MIXED',
})

// ── 311 E Chicago St — a condominium stack, C9G ─────────────────────────────
// Point 43.0322, -87.9068 returns FIFTEEN features, every one PARCEL_TYPE 1,
// every one over the same 21,651 sq ft ring, each with its own per-unit
// LOT_AREA. The first three are captured here in the order the server returned
// them; the test asserts the provider's choice does not depend on that order.
export const milwaukeeParcelCondoStack = featureSet(
  {
    TAXKEY: '3960393110',
    PARCEL_TYPE: 1,
    HOUSE_NR_LO: 311,
    HOUSE_NR_SFX: '',
    SDIR: 'E',
    STREET: 'CHICAGO',
    STTYPE: 'ST',
    UNIT: '210',
    // PLACEHOLDER — the live OWNER_NAME_1 here names a private family trust.
    OWNER_NAME_1: 'PRIVATE OWNER (placeholder)',
    C_A_CLASS: '2',
    C_A_LAND: '32500',
    C_A_TOTAL: '790600',
    C_A_EXM_LAND: '0',
    C_A_EXM_TOTAL: '0',
    YR_ASSMT: 2026,
    LOT_AREA: 929.0,
    ZONING: 'C9G',
    NR_UNITS: 3,
    YR_BUILT: 1907,
    NR_STORIES: '1',
    BLDG_AREA: 3069.0,
  },
  {
    TAXKEY: '3960391110',
    PARCEL_TYPE: 1,
    HOUSE_NR_LO: 311,
    HOUSE_NR_SFX: '',
    SDIR: 'E',
    STREET: 'CHICAGO',
    STTYPE: 'ST',
    UNIT: '100',
    OWNER_NAME_1: 'BECK RETAIL LLC',
    C_A_CLASS: '2',
    C_A_LAND: '47300',
    C_A_TOTAL: '1191400',
    C_A_EXM_LAND: '0',
    C_A_EXM_TOTAL: '0',
    YR_ASSMT: 2026,
    LOT_AREA: 1352.0,
    ZONING: 'C9G',
    NR_UNITS: 1,
    YR_BUILT: 1907,
    NR_STORIES: '1',
    BLDG_AREA: 4459.0,
  },
  {
    TAXKEY: '3960392110',
    PARCEL_TYPE: 1,
    HOUSE_NR_LO: 311,
    HOUSE_NR_SFX: '',
    SDIR: 'E',
    STREET: 'CHICAGO',
    STTYPE: 'ST',
    UNIT: '150',
    OWNER_NAME_1: 'BECK RETAIL LLC',
    C_A_CLASS: '2',
    C_A_LAND: '74400',
    C_A_TOTAL: '1837600',
    C_A_EXM_LAND: '0',
    C_A_EXM_TOTAL: '0',
    YR_ASSMT: 2026,
    LOT_AREA: 2126.0,
    ZONING: 'C9G',
    NR_UNITS: 3,
    YR_BUILT: 1907,
    NR_STORIES: '1',
    BLDG_AREA: 7018.0,
  },
)

export const milwaukeeZoningC9g = featureSet({
  Zoning: 'C9G',
  ZoningCategory: 'DOWNTOWN',
  ZoningType: 'MIXED ACTIVITY',
})

/** The GIS's own zoning-defect flag. 12 polygons carry it citywide, and the
 *  ZoningType string below is the live value, verbatim (note the non-breaking
 *  spaces the upstream actually returns). */
export const milwaukeeZoningX = featureSet({
  Zoning: 'X',
  ZoningCategory: 'TEMPORARY',
  ZoningType:
    "A problem has been identified with the zoning assigned to this parcel.  Check with the City of Milwaukee's Department of City Development for details (planadmin@milwaukee.gov).",
})

// ── Overlays ────────────────────────────────────────────────────────────────
/** Layer 17, captured at the Sherman Bl point. LOCAL historic district. */
export const milwaukeeHistoricSherman = featureSet({ NAME: 'Sherman Boulevard' })

/** Layer 4, captured at the Reed St point. The DIZ genuinely returns TWO
 *  features here, one per Common Council file, so the provider must dedupe. */
export const milwaukeeDizReedSt = featureSet(
  {
    DIZ_NAME: 'Reed Street Yards',
    CFN: '090353',
    CFN_LINK: 'http://milwaukee.legistar.com/gateway.aspx?M=L2&FileID=090353',
  },
  {
    DIZ_NAME: 'Reed Street Yards',
    CFN: '120426',
    CFN_LINK: 'http://milwaukee.legistar.com/gateway.aspx?M=L2&FileID=120426',
  },
)

/** Layer 9. Captured from the SPROZ layer's own feature set. */
export const milwaukeeSproz = featureSet({
  SPROD_NAME: 'Messmer High School',
  CFN: '981712',
  CFN_LINK: 'http://milwaukee.legistar.com/gateway.aspx?M=L2&FileID=981712',
})

/** Layer 8. One of only three Neighborhood Conservation overlay zones. */
export const milwaukeeNc = featureSet({ NAME: 'Brewers Hill / Harambee', CFN_APPROVE: '050633' })

export const milwaukeeFloodX = featureSet({ FLD_ZONE: 'X' })

/** The polygon fallback response: the parcel geometry in the layer's own
 *  EPSG:32054 (NAD27 / Wisconsin South, US feet). A 100 x 216.51 ft rectangle,
 *  i.e. 21,651 sq ft — the measured area of the shared 311 E Chicago St
 *  condominium ring. Coordinates are a synthetic rectangle rather than the
 *  live ring (which is 40-odd vertices of state-plane coordinates); what is
 *  under test is the shoelace, and the live ring's real area is asserted
 *  separately in the unit test for `ringAreaSqFt`. */
export const milwaukeePolygon21651 = {
  features: [
    {
      attributes: { TAXKEY: '3960393110' },
      geometry: {
        rings: [
          [
            [0, 0],
            [100, 0],
            [100, 216.51],
            [0, 216.51],
            [0, 0],
          ],
        ],
      },
    },
  ],
}

const NO_FEATURES = { features: [] }

/** Default routing. The overlay layers are distinguished only by their layer
 *  index, so the route keys must be the full "MapServer/N" path — matching on
 *  "zoning" alone would send all four to the same fixture.
 *
 *  NOTE the ordering constraint: 'parcels_mprop/MapServer/2' must be listed
 *  before any shorter substring that would also match it. mockArcgisFetch
 *  returns the FIRST matching route in insertion order. */
export const milwaukeeRoutes = {
  'parcels_mprop/MapServer/2': milwaukeeParcelSherman,
  'planning/zoning/MapServer/12': milwaukeeZoningRs5,
  'planning/zoning/MapServer/4': NO_FEATURES,
  'planning/zoning/MapServer/9': NO_FEATURES,
  'planning/zoning/MapServer/8': NO_FEATURES,
  'special_districts/MapServer/17': milwaukeeHistoricSherman,
  NFHL: milwaukeeFloodX,
}

/** RT4 — the two-family district the code caps at 48 ft, not 45. */
export const milwaukeeRoutesScott = {
  ...milwaukeeRoutes,
  'parcels_mprop/MapServer/2': milwaukeeParcelScott,
  'planning/zoning/MapServer/12': milwaukeeZoningRt4,
  'special_districts/MapServer/17': NO_FEATURES,
}

/** Downtown C9F(B): the code states NO maximum height, and floor area is a
 *  formula rather than a ratio. */
export const milwaukeeRoutesWater = {
  ...milwaukeeRoutes,
  'parcels_mprop/MapServer/2': milwaukeeParcelWater,
  'planning/zoning/MapServer/12': milwaukeeZoningC9fB,
  'special_districts/MapServer/17': NO_FEATURES,
}

/** City Hall: tax-exempt (C_A_TOTAL '0'), LOT_AREA 0, government owner. */
export const milwaukeeRoutesCityHall = {
  ...milwaukeeRoutes,
  'parcels_mprop/MapServer/2': (url: string) =>
    url.includes('where=TAXKEY') ? milwaukeePolygon21651 : milwaukeeParcelCityHall,
  'planning/zoning/MapServer/12': milwaukeeZoningC9dA,
  'special_districts/MapServer/17': NO_FEATURES,
}

/** IM inside a Development Incentive Zone, whose standards supersede the base
 *  district's. Also PARCEL_TYPE null and LOT_AREA 0. */
export const milwaukeeRoutesReedSt = {
  ...milwaukeeRoutes,
  'parcels_mprop/MapServer/2': (url: string) =>
    url.includes('where=TAXKEY') ? milwaukeePolygon21651 : milwaukeeParcelReedSt,
  'planning/zoning/MapServer/12': milwaukeeZoningIm,
  'planning/zoning/MapServer/4': milwaukeeDizReedSt,
  'special_districts/MapServer/17': NO_FEATURES,
}

/** The 15-deep condominium stack, three units of it, deliberately NOT in
 *  TAXKEY order. */
export const milwaukeeRoutesCondo = {
  ...milwaukeeRoutes,
  'parcels_mprop/MapServer/2': (url: string) =>
    url.includes('where=TAXKEY') ? milwaukeePolygon21651 : milwaukeeParcelCondoStack,
  'planning/zoning/MapServer/12': milwaukeeZoningC9g,
  'special_districts/MapServer/17': NO_FEATURES,
}

/** A parcel the City's own zoning layer flags as defective. */
export const milwaukeeRoutesZoningDefect = {
  ...milwaukeeRoutes,
  'planning/zoning/MapServer/12': milwaukeeZoningX,
}

/** A parcel with no zoning feature at all — a fetch that came back empty. */
export const milwaukeeRoutesNoZoning = {
  ...milwaukeeRoutes,
  'planning/zoning/MapServer/12': NO_FEATURES,
}
