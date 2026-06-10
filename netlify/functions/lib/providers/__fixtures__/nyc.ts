// Canned NYC MapPLUTO response matching the fields providers/nyc.ts reads
// (mirrors the shape pinned by lib/parcel.test.ts against the live service).

/** MapPLUTO lot — Times Square area C6-7 commercial lot with a building. */
export const nycPluto = {
  features: [
    {
      attributes: {
        BBL: '1009950005',
        Address: '1472 BROADWAY',
        ZoneDist1: 'C6-7',
        ResidFAR: 10,
        CommFAR: 15,
        FacilFAR: 15,
        LotArea: 45800,
        BldgArea: 120000,
        UnitsTotal: 0,
        NumFloors: 16,
        YearBuilt: 1925,
        NumBldgs: 1,
        LandUse: '05',
        OwnerType: 'P',
        OwnerName: '1472 BROADWAY LLC',
      },
    },
  ],
}

export const nycFloodX = {
  features: [{ attributes: { FLD_ZONE: 'X' } }],
}

export const nycRoutes = {
  MAPPLUTO: nycPluto,
  NFHL: nycFloodX,
}
