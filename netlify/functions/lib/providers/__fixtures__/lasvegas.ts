// Las Vegas fixtures — VERBATIM captures of live point queries, taken
// 2026-08-09 against the City of Las Vegas GIS
// (mapdata.lasvegasnevada.gov/clvgis) and FEMA NFHL.
//
// Every attribute below is exactly what the service returned: the real casing
// ('PROVIDENCE', 'LN'), the real single-space padding the layer uses instead of
// nulls (STRFRAC / STRDIR / STRCITY / ORD / USE_1 all arrive as `' '`), the real
// fixed-width `ADDRESS` string with its zero-padded house number and column
// padding, and the real floats (`SHAPE_Area` to full precision). A fixture
// invented to match the provider's expectations tests the provider against
// itself (CLAUDE.md rule 9).
//
// ONE DEPARTURE, and it is flagged inline at each site it occurs: where `OWNER`
// held a private individual's name it has been replaced with the placeholder
// 'PRIVATE OWNER (NAME REDACTED IN FIXTURE)'. LLC and trust owners are left as
// returned. An unqualified "verbatim" claim next to an edited value is exactly
// the half-true provenance statement rule 9's corollary warns about, so the
// edits are marked one by one rather than in a blanket note.
//
// Route keys used by `mockArcgisFetch` (URL-substring matching):
//   'AdministrativeBoundaries/Parcel_Info/MapServer/0' — parcels
//   'DevelopmentServices/Zoning/MapServer/0'           — zoning
//   'AdministrativeBoundaries/Jurisdictions/MapServer/0' — the jurisdiction gate
//   'NFHL'                                             — FEMA flood

const PARCELS = 'AdministrativeBoundaries/Parcel_Info/MapServer/0'
const ZONING = 'DevelopmentServices/Zoning/MapServer/0'
const JURISDICTIONS = 'AdministrativeBoundaries/Jurisdictions/MapServer/0'

const floodX = { features: [{ attributes: { FLD_ZONE: 'X' } }] }

/** The jurisdiction layer's answer inside the city. Its seven NAME values were
 *  enumerated live 2026-08-09 with returnDistinctValues: 'City of Las Vegas',
 *  'City of North Las Vegas', 'City of Henderson', 'City of Mesquite',
 *  'Boulder City', 'Nellis AFB', and one ' ' (unincorporated Clark County). */
const jurisdictionLasVegas = { features: [{ attributes: { NAME: 'City of Las Vegas' } }] }

/** North Las Vegas — a different city, in the middle of the Las Vegas bbox. */
const jurisdictionNorthLasVegas = { features: [{ attributes: { NAME: 'City of North Las Vegas' } }] }

/** Unincorporated Clark County, which is what the Strip returns. The layer
 *  names it with a single space rather than nulling it. */
const jurisdictionUnincorporated = { features: [{ attributes: { NAME: ' ' } }] }

/** The null-inventory probe parcel: 4617 Providence Ln, R-1, a 7,064 sq ft
 *  single-family lot in privately held ownership.
 *  ⚠️ OWNER REDACTED: the live value is a private individual's name. */
const parcelProvidence = {
  features: [
    {
      attributes: {
        PARCEL: '13931210029',
        STRNO: 4617,
        STRFRAC: ' ',
        STRDIR: ' ',
        STRNAME: 'PROVIDENCE',
        STRTYPE: 'LN',
        STRCITY: 'LV',
        ADDRESS: '004617     PROVIDENCE            LN',
        OWNER: 'PRIVATE OWNER (NAME REDACTED IN FIXTURE)',
        SHAPE_Area: 7063.677094486521,
        // ⚠️ NOT the lot. 1,690 is the RESIDENTIAL BUILDING floor area — see the
        // measurement in providers/lasvegas.ts. The lot is SHAPE_Area, 7,064.
        LOTSQFT: 1690,
        CONSTYR: 1961,
        LUCODE: 110,
        CAPACITY: 1,
        LANDVAL1: 33950,
        IMPVAL: 20515,
        ASSDYR: 2027,
      },
    },
  ],
}

const zoningR1 = {
  features: [
    {
      attributes: {
        ZONE: 'R-1',
        DESCRIPTION: 'Single Family Residential',
        PARCEL: '13931210029',
        ORD: ' ',
        EXP_DATE: ' ',
        MULTI_ZONE: 0,
        ROIZONE: ' ',
        USE_1: ' ',
        VAR_1: ' ',
      },
    },
  ],
}

/** 1395 N Nellis Blvd — C-2, whose Table 3 BUILDING HEIGHT prints "NA" in every
 *  row, and which carries both a Special Use Permit and a Variance on file. */
const parcelNellis = {
  features: [
    {
      attributes: {
        PARCEL: '14029601001',
        STRNO: 1395,
        STRFRAC: ' ',
        STRDIR: 'N',
        STRNAME: 'NELLIS',
        STRTYPE: 'BLVD',
        STRCITY: 'LV',
        ADDRESS: '001395   N NELLIS                BLVD',
        OWNER: 'RAMIREZ RUBIO L L C',
        SHAPE_Area: 33045.41486212306,
        // 0 on a commercial parcel: the field is residential building floor
        // area, and it is 0 on 99.996% of non-residential land uses.
        LOTSQFT: 0,
        CONSTYR: 1963,
        LUCODE: 370,
        CAPACITY: 1,
        LANDVAL1: 118920,
        IMPVAL: 18935,
        ASSDYR: 2027,
      },
    },
  ],
}

const zoningC2 = {
  features: [
    {
      attributes: {
        ZONE: 'C-2',
        DESCRIPTION: 'General Commercial',
        PARCEL: '14029601001',
        ORD: ' ',
        EXP_DATE: ' ',
        MULTI_ZONE: 0,
        ROIZONE: ' ',
        USE_1: 'SUP-61064',
        VAR_1: 'VAR-76590',
      },
    },
  ],
}

/** 611 N Main St — T5-M, a Form-Based Code transect zone. The code states a
 *  story maximum and NO height in feet. */
const parcelMain = {
  features: [
    {
      attributes: {
        PARCEL: '13927705001',
        STRNO: 611,
        STRFRAC: ' ',
        STRDIR: 'N',
        STRNAME: 'MAIN',
        STRTYPE: 'ST',
        STRCITY: 'LV',
        ADDRESS: '000611   N MAIN                  ST',
        OWNER: 'MAIN CORRIDOR L L C',
        SHAPE_Area: 6416.167858144659,
        LOTSQFT: 0,
        CONSTYR: 1950,
        LUCODE: 210,
        CAPACITY: 1,
        LANDVAL1: 20736,
        IMPVAL: 44514,
        ASSDYR: 2027,
      },
    },
  ],
}

const zoningT5M = {
  features: [
    {
      attributes: {
        ZONE: 'T5-M',
        DESCRIPTION: 'T5 Maker',
        PARCEL: '13927705001',
        ORD: ' ',
        EXP_DATE: ' ',
        MULTI_ZONE: 0,
        ROIZONE: ' ',
        USE_1: ' ',
        VAR_1: 'V-0117-94',
      },
    },
  ],
}

/** 4077 Silver Dollar Ave — R-4, a 133-unit apartment complex. The only fixture
 *  here whose CAPACITY is a real multi-unit count. */
const parcelSilverDollar = {
  features: [
    {
      attributes: {
        PARCEL: '16207601003',
        STRNO: 4077,
        STRFRAC: ' ',
        STRDIR: ' ',
        STRNAME: 'SILVER DOLLAR',
        STRTYPE: 'AVE',
        STRCITY: 'LV',
        ADDRESS: '004077     SILVER DOLLAR         AVE',
        OWNER: 'WESTLAND GREENVILLE PARK L L C',
        SHAPE_Area: 160843.2158392795,
        LOTSQFT: 0,
        CONSTYR: 1963,
        LUCODE: 150,
        CAPACITY: 133,
        LANDVAL1: 869750,
        IMPVAL: 1061685,
        ASSDYR: 2027,
      },
    },
  ],
}

const zoningR4 = {
  features: [
    {
      attributes: {
        ZONE: 'R-4',
        DESCRIPTION: 'High Density Residential',
        PARCEL: '16207601003',
        ORD: ' ',
        EXP_DATE: ' ',
        MULTI_ZONE: 0,
        ROIZONE: ' ',
        USE_1: ' ',
        VAR_1: ' ',
      },
    },
  ],
}

/** 2500 W Washington Ave — C-PB, the district whose printed 5 stories / 85 feet
 *  is cut to 2 stories / 35 feet for commercial and retail uses. */
const parcelWashington = {
  features: [
    {
      attributes: {
        PARCEL: '13929601008',
        STRNO: 2500,
        STRFRAC: ' ',
        STRDIR: 'W',
        STRNAME: 'WASHINGTON',
        STRTYPE: 'AVE',
        STRCITY: 'LV',
        ADDRESS: '002500   W WASHINGTON            AVE',
        OWNER: 'MOHIB BANDA L L C',
        SHAPE_Area: 123660.81828126145,
        LOTSQFT: 0,
        CONSTYR: 1982,
        LUCODE: 335,
        CAPACITY: 1,
        LANDVAL1: 377530,
        IMPVAL: 526284,
        ASSDYR: 2027,
      },
    },
  ],
}

const zoningCPB = {
  features: [
    {
      attributes: {
        ZONE: 'C-PB',
        DESCRIPTION: 'Planned Business Park',
        PARCEL: '13929601008',
        ORD: ' ',
        EXP_DATE: ' ',
        MULTI_ZONE: 0,
        ROIZONE: ' ',
        USE_1: ' ',
        VAR_1: 'V-0017-70',
      },
    },
  ],
}

/** 1048 Bonitos Suenos St — P-C (Planned Community), in Summerlin. Plan-governed:
 *  every dimensional standard lives in the approved Planned Community Program.
 *  ⚠️ OWNER REDACTED: the live value is two private individuals' names. */
const parcelBonitosSuenos = {
  features: [
    {
      attributes: {
        PARCEL: '13735416044',
        STRNO: 1048,
        STRFRAC: ' ',
        STRDIR: ' ',
        STRNAME: 'BONITOS SUENOS',
        STRTYPE: 'ST',
        STRCITY: 'LV',
        ADDRESS: '001048     BONITOS SUENOS        ST',
        OWNER: 'PRIVATE OWNER (NAME REDACTED IN FIXTURE)',
        SHAPE_Area: 5000.002002410855,
        LOTSQFT: 1880,
        CONSTYR: 2006,
        LUCODE: 110,
        CAPACITY: 1,
        LANDVAL1: 68600,
        IMPVAL: 94188,
        ASSDYR: 2027,
      },
    },
  ],
}

const zoningPC = {
  features: [
    {
      attributes: {
        ZONE: 'P-C',
        DESCRIPTION: 'Planned Community',
        PARCEL: '13735416044',
        ORD: ' ',
        EXP_DATE: ' ',
        MULTI_ZONE: 0,
        ROIZONE: ' ',
        USE_1: ' ',
        VAR_1: ' ',
      },
    },
  ],
}

/** 2694 Palomino Ln — R-A "Ranch Acres", a classification Title 19 no longer
 *  establishes. The parcel resolves fine; the zoning must come back a GAP.
 *  ⚠️ OWNER REDACTED: the live value is a family trust in private names. */
const parcelPalomino = {
  features: [
    {
      attributes: {
        PARCEL: '13932703009',
        STRNO: 2694,
        STRFRAC: ' ',
        STRDIR: ' ',
        STRNAME: 'PALOMINO',
        STRTYPE: 'LN',
        STRCITY: 'LV',
        ADDRESS: '002694     PALOMINO              LN',
        OWNER: 'PRIVATE OWNER (NAME REDACTED IN FIXTURE)',
        SHAPE_Area: 11596.994931701673,
        LOTSQFT: 4475,
        CONSTYR: 2009,
        LUCODE: 110,
        CAPACITY: 1,
        LANDVAL1: 105000,
        IMPVAL: 285998,
        ASSDYR: 2027,
      },
    },
  ],
}

const zoningRA = {
  features: [
    {
      attributes: {
        ZONE: 'R-A',
        DESCRIPTION: 'Ranch Acres',
        PARCEL: '13932703009',
        ORD: ' ',
        EXP_DATE: ' ',
        MULTI_ZONE: 0,
        ROIZONE: ' ',
        USE_1: ' ',
        VAR_1: 'VAR-21611',
      },
    },
  ],
}

/** The City Hall address point, 495 S Main St, as the City's OWN geocoder
 *  returns it (36.16709811903892, -115.1492777491766). It lands on a ROAD
 *  parcel — the '…99xxx' right-of-way fabric — which carries no address, no
 *  owner and no values, and which the zoning layer does not cover at all. This
 *  is the real shape of "clicked the street", captured rather than imagined. */
const parcelRoad = {
  features: [
    {
      attributes: {
        PARCEL: '13934299002',
        STRNO: 0,
        STRFRAC: ' ',
        STRDIR: ' ',
        STRNAME: ' ',
        STRTYPE: ' ',
        STRCITY: ' ',
        ADDRESS: ' ',
        OWNER: ' ',
        SHAPE_Area: 725024.8865576908,
        LOTSQFT: 0,
        CONSTYR: 0,
        LUCODE: 0,
        CAPACITY: 0,
        LANDVAL1: 0,
        IMPVAL: 0,
        ASSDYR: 0,
      },
    },
  ],
}

/** A publicly owned parcel, for the government-owner path. Synthesised from the
 *  Palomino row by replacing OWNER with a value the shared `isGovernmentOwner`
 *  vocabulary matches — flagged as SYNTHETIC rather than presented as a capture,
 *  because no live City-owned parcel was captured for this build. */
const parcelPublicOwner = {
  features: [
    {
      attributes: {
        ...parcelPalomino.features[0].attributes,
        OWNER: 'CITY OF LAS VEGAS',
      },
    },
  ],
}

export const lasVegasRoutesProvidence = {
  [PARCELS]: parcelProvidence,
  [ZONING]: zoningR1,
  [JURISDICTIONS]: jurisdictionLasVegas,
  NFHL: floodX,
}

export const lasVegasRoutesNellis = {
  [PARCELS]: parcelNellis,
  [ZONING]: zoningC2,
  [JURISDICTIONS]: jurisdictionLasVegas,
  NFHL: floodX,
}

export const lasVegasRoutesMain = {
  [PARCELS]: parcelMain,
  [ZONING]: zoningT5M,
  [JURISDICTIONS]: jurisdictionLasVegas,
  NFHL: floodX,
}

export const lasVegasRoutesSilverDollar = {
  [PARCELS]: parcelSilverDollar,
  [ZONING]: zoningR4,
  [JURISDICTIONS]: jurisdictionLasVegas,
  NFHL: floodX,
}

export const lasVegasRoutesWashington = {
  [PARCELS]: parcelWashington,
  [ZONING]: zoningCPB,
  [JURISDICTIONS]: jurisdictionLasVegas,
  NFHL: floodX,
}

export const lasVegasRoutesBonitosSuenos = {
  [PARCELS]: parcelBonitosSuenos,
  [ZONING]: zoningPC,
  [JURISDICTIONS]: jurisdictionLasVegas,
  NFHL: floodX,
}

export const lasVegasRoutesPalomino = {
  [PARCELS]: parcelPalomino,
  [ZONING]: zoningRA,
  [JURISDICTIONS]: jurisdictionLasVegas,
  NFHL: floodX,
}

export const lasVegasRoutesRoad = {
  [PARCELS]: parcelRoad,
  [ZONING]: { features: [] },
  [JURISDICTIONS]: jurisdictionLasVegas,
  NFHL: floodX,
}

export const lasVegasRoutesPublicOwner = {
  [PARCELS]: parcelPublicOwner,
  [ZONING]: zoningRA,
  [JURISDICTIONS]: jurisdictionLasVegas,
  NFHL: floodX,
}

/** An 'U(DR)' holding-zone polygon, for the U-normalisation test. The zoning
 *  row is a live capture; it is paired with the Palomino parcel so the test can
 *  vary one thing at a time. */
export const lasVegasZoningUdr = {
  features: [
    {
      attributes: {
        ZONE: 'U(DR)',
        DESCRIPTION: 'Undeveloped  (Desert Rural  Up To 2.49 du/ac)',
        PARCEL: '16304315007',
        ORD: ' ',
        EXP_DATE: ' ',
        MULTI_ZONE: 0,
        ROIZONE: ' ',
        USE_1: ' ',
        VAR_1: 'V-0008-00',
      },
    },
  ],
}

/** An 'R-PD7' polygon — plan-governed, with the density numeral in the code. */
export const lasVegasZoningRpd7 = {
  features: [
    {
      attributes: {
        ZONE: 'R-PD7',
        DESCRIPTION: 'Residential Planned Development - 7 Unit Per Acre',
        PARCEL: '16305311019',
        ORD: ' ',
        EXP_DATE: ' ',
        MULTI_ZONE: 0,
        ROIZONE: ' ',
        USE_1: ' ',
        VAR_1: ' ',
      },
    },
  ],
}

export const LAS_VEGAS_PARCEL_ROUTE = PARCELS
export const LAS_VEGAS_ZONING_ROUTE = ZONING

// ── The jurisdiction gate ───────────────────────────────────────────────────
// All three parcel rows below are verbatim captures taken 2026-08-09, at points
// INSIDE `LAS_VEGAS_BBOX`. That is the whole problem: a bounding box cannot
// separate these from Las Vegas, because the valley is a patchwork.

/** 36.2180, -115.1210 — City of North Las Vegas. An unaddressed LLC-owned lot
 *  carrying a $119,526 land value: a parcel, a lot area and a dollar figure, and
 *  no City of Las Vegas zoning behind any of it. */
export const lasVegasRoutesNorthLasVegas = {
  [PARCELS]: {
    features: [
      {
        attributes: {
          PARCEL: '13911815003',
          STRNO: 0,
          STRFRAC: ' ',
          STRDIR: ' ',
          STRNAME: ' ',
          STRTYPE: ' ',
          STRCITY: 'NLV',
          ADDRESS: '000000',
          OWNER: 'LUCKY LUCY D L L C',
          SHAPE_Area: 21149.157043671737,
          LOTSQFT: 0,
          CONSTYR: 0,
          LUCODE: 0,
          CAPACITY: 0,
          LANDVAL1: 119526,
          IMPVAL: 0,
          ASSDYR: 2027,
        },
      },
    ],
  },
  [ZONING]: { features: [] },
  [JURISDICTIONS]: jurisdictionNorthLasVegas,
  NFHL: floodX,
}

/** 36.1250, -115.1700 — 3300 S Las Vegas Blvd, `STRCITY 'PAR'`: Paradise,
 *  unincorporated Clark County. The Strip is not in any city, and this is the
 *  clearest demonstration of why the zoning gap alone was not enough — the row
 *  carries an 847,887 sq ft lot and $199M of assessed value, everything the
 *  cost engine needs to print a confident figure for land Las Vegas does not
 *  zone. Kept verbatim; the owner is an LLC, not an individual. */
export const lasVegasRoutesStrip = {
  [PARCELS]: {
    features: [
      {
        attributes: {
          PARCEL: '16216214001',
          STRNO: 3300,
          STRFRAC: ' ',
          STRDIR: 'S',
          STRNAME: 'LAS VEGAS',
          STRTYPE: 'BLVD',
          STRCITY: 'PAR',
          ADDRESS: '003300   S LAS VEGAS             BLVD',
          OWNER: 'TREASURE ISLAND L V L L C',
          SHAPE_Area: 847887.3164378967,
          LOTSQFT: 0,
          CONSTYR: 1992,
          LUCODE: 310,
          CAPACITY: 2900,
          LANDVAL1: 58847311,
          IMPVAL: 140197519,
          ASSDYR: 2027,
        },
      },
    ],
  },
  [ZONING]: { features: [] },
  [JURISDICTIONS]: jurisdictionUnincorporated,
  NFHL: floodX,
}

/** ⚠️ THE CASE THAT REJECTED `STRCITY = 'LV'` AS THE GATE. 36.14220, -115.29031:
 *  an unaddressed parcel — `STRCITY ' '`, and every other address column blank
 *  with it — that the City zones `R-PD12`, inside the City of Las Vegas
 *  jurisdiction polygon. `STRCITY` is the SITE ADDRESS's city, so it is blank on
 *  vacant land, which is the land a feasibility tool is asked about. An
 *  attribute gate refuses this parcel; the polygon gate admits it. */
export const lasVegasRoutesBlankStrCityInCity = {
  [PARCELS]: {
    features: [
      {
        attributes: {
          PARCEL: '16308115000',
          STRNO: 0,
          STRFRAC: ' ',
          STRDIR: ' ',
          STRNAME: ' ',
          STRTYPE: ' ',
          STRCITY: ' ',
          ADDRESS: ' ',
          OWNER: ' ',
          SHAPE_Area: 344849.63471085695,
          LOTSQFT: 0,
          CONSTYR: 0,
          LUCODE: 0,
          CAPACITY: 0,
          LANDVAL1: 0,
          IMPVAL: 0,
          ASSDYR: 0,
        },
      },
    ],
  },
  [ZONING]: {
    features: [
      {
        attributes: {
          ZONE: 'R-PD12',
          DESCRIPTION: 'Residential Planned Development - 12 Unit Per Acre',
          PARCEL: '16308115000',
          ORD: ' ',
          EXP_DATE: ' ',
          MULTI_ZONE: 0,
          ROIZONE: ' ',
          USE_1: ' ',
          VAR_1: ' ',
        },
      },
    ],
  },
  [JURISDICTIONS]: jurisdictionLasVegas,
  NFHL: floodX,
}

/** The gate's degrade-open path: the Jurisdictions layer is down, everything
 *  else is a normal in-city response. */
export const lasVegasRoutesJurisdictionsDown = {
  ...lasVegasRoutesProvidence,
  [JURISDICTIONS]: () => {
    throw new Error('jurisdictions down')
  },
}

export const LAS_VEGAS_JURISDICTIONS_ROUTE = JURISDICTIONS
