// WHERE EACH CITY'S ZONE CODE COMES FROM — the registry, and the deliverable.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
//
// Every wrong-value defect this codebase has produced was visible in the LIVE
// ENUMERATION of a zoning field and invisible everywhere else. Seattle's Major
// Institution Overlay bug showed up the moment 285 distinct codes were pushed
// through the parser; its five wrong tier heights showed up the moment the code
// was read against them. Neither moved the coverage number by a single point —
// 94% before, 94% after, zero counts changed — because coverage measures whether
// an envelope RESOLVED, never whether the numbers in it are right.
//
// So the enumeration is the instrument, and this file is what makes it runnable
// without anybody remembering how. Which layer, which field, per city.
//
// ── WHAT GOES STALE HERE, AND WHAT CATCHES IT ────────────────────────────────
//
// A city republishes its layer and this file keeps pointing at the old one; or a
// 24th city is added and nobody enrols it. Both are silent. Two guards, and they
// check different things:
//
//   1. ENROLMENT — every slug in src/config/cities.ts has an entry here. A city
//      with no entry is a hole in the sweep, not a clean city.
//   2. FIELD EXISTENCE — the declared field is confirmed against the LIVE layer
//      (`--verify-fields`). A transcribed URL that 404s, or a field the layer
//      stopped publishing, fails. This is the half that cannot be satisfied by
//      writing the file carefully, which is the point: transcription is exactly
//      how a registry goes wrong, and re-reading what I typed cannot catch it.
//
// Same treatment as CITIES_WITH_SPECIFIC_HURDLES, which is kept honest by a test
// that reads the `city === '…'` branches out of hurdles.ts rather than trusting
// a hand-list.
//
// ── EVERY URL HERE WAS EXTRACTED FROM THE PROVIDER, NOT TYPED ────────────────
//
// The layer constants were resolved mechanically out of each provider's source
// (including the ones built from a base constant) rather than copied by hand. A
// hand-copied URL is a second implementation of a fact the provider already
// holds, and this session has now paid for that mistake three times.

export interface ZoneSource {
  /** City slug, matching src/config/cities.ts. */
  city: string
  /** The ArcGIS layer the provider queries for the zone code. */
  layer: string
  /** The attribute the provider reads the district code from. */
  field: string
  /** Other attributes read off the SAME feature that also drive published
   *  values. Enumerated too, because a defect in any of them is the same class
   *  — Denver's HEIGHT_STORIES and NYC's ResidFAR are figures, not labels. */
  alsoRead?: string[]
  /** Why this city cannot be swept, where that is the case. Never left blank to
   *  mean "fine" — an unenrolled city must say so. */
  notEnumerable?: string
}

export const ZONE_SOURCES: readonly ZoneSource[] = Object.freeze([
  { city: 'atlanta', layer: 'https://gis.atlantaga.gov/dpcd/rest/services/LandUsePlanning/LandUsePlanning/MapServer/0', field: 'ZONECLASS', alsoRead: ['ZONINGCODE', 'ZONEDESC', 'SPI'] },
  { city: 'austin', layer: 'https://services.arcgis.com/0L95CJ0VTaxqcmED/arcgis/rest/services/Current_Zoning_gdb/FeatureServer/0', field: 'BASE_ZONE', alsoRead: ['ZONE_NAME', 'ZONING_ZTYPE'] },
  { city: 'charlotte', layer: 'https://gis.charlottenc.gov/arcgis/rest/services/PLN/Zoning/MapServer/0', field: 'ZoneDes', alsoRead: ['ZoneClass', 'Overlay', 'SPA'] },
  { city: 'chicago', layer: 'https://gisapps.chicago.gov/arcgis/rest/services/ExternalApps/Zoning_update/MapServer/15', field: 'ZONE_CLASS' },
  { city: 'columbus', layer: 'https://maps2.columbus.gov/arcgis/rest/services/Applications/Zoning/MapServer/20', field: 'CLASSIFICATION', alsoRead: ['GENERAL_ZONING_CATEGORY', 'HEIGHT_DISTRICT'] },
  { city: 'dallas', layer: 'https://gis.dallascityhall.com/arcgis/rest/services/sdc_public/Zoning/MapServer/15', field: 'LONG_ZONE_DIST', alsoRead: ['ZONE_DIST', 'PD_NUM', 'CD_NUM'] },
  { city: 'dc', layer: 'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCOZ/Zone_Mapservice/MapServer/24', field: 'Zoning', alsoRead: ['ZR16', 'Zone_District'] },
  { city: 'denver', layer: 'https://denvergov.org/maps/data/Zoning/MapServer/1', field: 'ZONE_DISTRICT', alsoRead: ['HEIGHT_STORIES', 'ZONE_USE_FORM', 'OVERLAY_DISTRICT'] },
  { city: 'la', layer: 'https://maps.lacity.org/arcgis/rest/services/Mapping/NavigateLA/MapServer/71', field: 'ZONE_CMPLT', alsoRead: ['ZONE_CLASS'] },
  { city: 'lasvegas', layer: 'https://mapdata.lasvegasnevada.gov/clvgis/rest/services/DevelopmentServices/Zoning/MapServer/0', field: 'ZONE', alsoRead: ['ORD'] },
  { city: 'miami', layer: 'https://gis.miami.gov/gis/rest/services/Zoning/ZoningMiami21/MapServer/5', field: 'M21_ZONE', alsoRead: ['Transect', 'Bldg_Height', 'FLR'] },
  { city: 'milwaukee', layer: 'https://milwaukeemaps.milwaukee.gov/arcgis/rest/services/planning/zoning/MapServer/12', field: 'Zoning', alsoRead: ['ZoningCategory', 'ZoningType'] },
  { city: 'minneapolis', layer: 'https://services.arcgis.com/afSMGVsC7QlRK1kZ/arcgis/rest/services/Planning_Primary_Zoning/FeatureServer/0', field: 'Land_Use_Code', alsoRead: ['Land_Use'] },
  { city: 'nashville', layer: 'https://maps.nashville.gov/arcgis/rest/services/Zoning_Landuse/Zoning/MapServer/14', field: 'ZONE_DESC', alsoRead: ['NAME'] },
  // NYC reads zoning off MapPLUTO, the same feature that carries the parcel —
  // and the FAR figures come from that record rather than from a district table.
  { city: 'nyc', layer: 'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/MAPPLUTO/FeatureServer/0', field: 'ZoneDist1', alsoRead: ['ResidFAR', 'CommFAR', 'FacilFAR'] },
  { city: 'philadelphia', layer: 'https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/Zoning_BaseDistricts/FeatureServer/0', field: 'long_code', alsoRead: ['code'] },
  { city: 'phoenix', layer: 'https://maps.phoenix.gov/pub/rest/services/Public/Zoning/MapServer/0', field: 'ZONING', alsoRead: ['GEN_ZONE'] },
  { city: 'raleigh', layer: 'https://maps.raleighnc.gov/arcgis/rest/services/Planning/Zoning/MapServer/0', field: 'ZONING' },
  { city: 'sandiego', layer: 'https://webmaps.sandiego.gov/arcgis/rest/services/DSD/Zoning_Base/MapServer/0', field: 'ZONE_NAME' },
  { city: 'sanjose', layer: 'https://geo.sanjoseca.gov/server/rest/services/PLN/PLN_Geocortex_Public_PRD/MapServer/128', field: 'ZONING', alsoRead: ['ZONINGABBREV', 'PDUSE'] },
  { city: 'seattle', layer: 'https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Current_Land_Use_Zoning_Detail_2/FeatureServer/0', field: 'ZONING' },
  { city: 'sf', layer: 'https://sfplanninggis.org/arcgiswa/rest/services/PlanningData/MapServer/3', field: 'zoning', alsoRead: ['gen', 'districtname'] },
  { city: 'boston', layer: '', field: '', notEnumerable: 'Boston resolves zoning through a per-article lookup rather than one district field on one layer; the sweep has no single enumerable column here. Declared rather than omitted so the enrolment guard does not read silence as coverage.' },
])

export function zoneSource(city: string): ZoneSource | undefined {
  return ZONE_SOURCES.find((z) => z.city === city)
}

/** Cities the sweep can actually enumerate. Separate from the full registry so a
 *  caller cannot iterate the enumerable set and believe it is every city. */
export const ENUMERABLE: readonly ZoneSource[] = Object.freeze(
  ZONE_SOURCES.filter((z) => !z.notEnumerable),
)
