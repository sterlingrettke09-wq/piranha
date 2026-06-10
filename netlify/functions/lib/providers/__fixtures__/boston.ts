// Canned Boston responses matching the live schemas documented in
// netlify/functions/_endpoints.ts (verified 2026-05-28/29 against the real
// services). Field names must track FIELDS in _endpoints.ts.

/** Zoning_Subdistricts_Urban layer — downtown business subdistrict. */
export const bostonZoning = {
  features: [
    {
      attributes: {
        Name: 'B-2-65',
        District: 'Downtown',
        Article: 'Article 8',
        HeightMax: 65,
        FARMax: 2,
        Use_: 'Business',
      },
    },
  ],
}

/** Parcels_24_detailed layer — a private three-decker with an existing building. */
export const bostonParcel = {
  features: [
    {
      attributes: {
        PID: '0304567000',
        ST_NUM: '1',
        ST_NAME: 'City Hall Sq',
        LAND_SF: 12450,
        LU_DESC: 'Three-family',
        OWNER: 'SMITH JOHN J',
        YR_BUILT: 1924,
        GROSS_AREA: 3600,
        RES_UNITS: 3,
        COM_UNITS: 0,
        NUM_BLDGS: 1,
        TOTAL_VALUE: 985000,
      },
    },
  ],
}

/** Historic_Districts_BLC layer — empty (outside any district). */
export const bostonHistoricNone = { features: [] }

/** FEMA NFHL layer 28 — minimal-hazard zone. */
export const bostonFloodX = {
  features: [{ attributes: { FLD_ZONE: 'X' } }],
}

/** Standard happy-path route table for mockArcgisFetch. */
export const bostonRoutes = {
  Zoning: bostonZoning,
  Parcels_24_detailed: bostonParcel,
  Historic: bostonHistoricNone,
  NFHL: bostonFloodX,
}
