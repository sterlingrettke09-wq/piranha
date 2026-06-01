// URLs verified 2026-05-28 against live Boston open-data ArcGIS services.
// If a query starts failing, re-check the source dataset.
//
// Verification: each /query endpoint was hit with a point at Boston City Hall
// (lat=42.3601, lng=-71.0589, WGS84/wkid=4326) using
//   geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&inSR=4326
//
// Observed City Hall attributes:
//   zoning   -> { Name: "OS-UP", District: "Government Center/Markets", Article: "45", ... }
//   parcels  -> { pid: "0302604000", full_addre: "0 CAMBRIDGE ST",
//                 owner: "BOSTON REDEVELOPMENT AUTH", lot_size: 243879, ... }
//   historic -> 0 features at City Hall (it is outside any designated district);
//               cross-checked with Beacon Hill (42.3588, -71.0707), which returned
//               { HIST_NAME: "Historic Beacon Hill District",
//                 PLACE_NAME: "Beacon Hill", TYPE: "LHD", STATUS: "Designated & Activated" }
//   flood    -> { FLD_ZONE: "X", ZONE_SUBTY: "AREA OF MINIMAL FLOOD HAZARD",
//                 SFHA_TF: "F", STATIC_BFE: -9999 }
//
// Deviations from the original plan field list (Task 8 normalization must use these):
//   - zoning  : Name | District | Article   (NOT SUBDISTRICT/DISTRICT/ARTICLE)
//   - parcels : pid  | full_addre | lot_size (NOT PID_LONG/FULL_ADDRES/LAND_SF)
//   - historic: HIST_NAME                    (NOT NAME; also PLACE_NAME=neighborhood)
//   - flood   : FLD_ZONE                     (matches plan)
//
// Source notes:
//   - Zoning + parcels + historic are hosted by BPDA on ArcGIS Online
//     (org id sFnw0xNflSi8J0uh). BPDA_Parcels is the BPDA-curated parcel layer
//     and exposes pid/full_addre/lot_size cleanly; preferred over
//     City_of_Boston_Parcels (FY22, different schema) and
//     parcels_latest_ExportFeatures_ExportFeatures (PARCEL_ID/LOT_SIZE but
//     returned 0 features at City Hall, suggesting incomplete coverage of
//     city-owned parcels).
//   - FEMA flood data is NOT hosted by BPDA; use upstream FEMA NFHL
//     (hazards.fema.gov). Layer 28 = "Flood Hazard Zones" (polygon).
export const ENDPOINTS = {
  // BRITTLE: URL contains date stamp '_20240719'. Re-verify after each BPDA zoning re-publish.
  zoning:
    'https://services.arcgis.com/sFnw0xNflSi8J0uh/ArcGIS/rest/services/Zoning_Subdistricts_Urban_20240719/FeatureServer/93',
  // Citywide assessing parcels (~182k features) WITH address + land area.
  // Verified 2026-05-29: BPDA_Parcels was a 324-feature curated subset and
  // missed almost every real building — DO NOT use it. Parcels_24_detailed is
  // layer index 112 on the BPDA hosting server.
  parcels:
    'https://gis.bostonplans.org/hosting/rest/services/Parcels_24_detailed/FeatureServer/112',
  historic:
    'https://services.arcgis.com/sFnw0xNflSi8J0uh/ArcGIS/rest/services/Historic_Districts_BLC/FeatureServer/0',
  flood:
    'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28',
} as const

// Field names match the live attribute schemas verified above. Task 8's
// normalization layer should read these and translate to user-facing labels.
export const FIELDS = {
  // HeightMax/FARMax/Use_ are real dimensional fields on the zoning layer
  // (verified 2026-05-29): e.g. Stuart St => HeightMax 155, FARMax 10,
  // Use_ "Mixed-Use"; Open Space subdistricts return null limits.
  zoning: ['Name', 'District', 'Article', 'HeightMax', 'FARMax', 'Use_'],
  // address = ST_NUM + ST_NAME; PID = parcel id; LAND_SF = lot size (sq ft).
  // OWNER / MAIL_* exist on this layer but are intentionally NOT requested — PII.
  // Trailing fields describe the *existing* structure (what's there today).
  parcels: ['PID', 'ST_NUM', 'ST_NAME', 'LAND_SF', 'LU_DESC', 'YR_BUILT', 'GROSS_AREA', 'RES_UNITS', 'COM_UNITS', 'NUM_BLDGS', 'TOTAL_VALUE'],
  historic: ['HIST_NAME'],
  flood: ['FLD_ZONE'],
} as const
