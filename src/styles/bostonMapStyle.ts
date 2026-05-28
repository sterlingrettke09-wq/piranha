// Brand-palette overrides applied to mapbox://styles/mapbox/light-v11.
// Apply via map.setPaintProperty(layerId, prop, value) on style.load.

export const BRAND = {
  burgundy: '#7A1B2E',
  charcoal: '#1A1A1A',
  bone: '#F5F1EA',
  gold: '#C9A55C',
} as const

export const BOSTON_CENTER: [number, number] = [-71.0589, 42.3601]
export const BOSTON_ZOOM = 12

export interface PaintOverride {
  layerId: string
  property: string
  value: string | number
}

export const BRAND_OVERRIDES: PaintOverride[] = [
  { layerId: 'background', property: 'background-color', value: BRAND.bone },
  { layerId: 'land', property: 'background-color', value: BRAND.bone },
  { layerId: 'water', property: 'fill-color', value: '#D9D2C6' },
  { layerId: 'road-primary', property: 'line-color', value: BRAND.charcoal },
  { layerId: 'road-secondary-tertiary', property: 'line-color', value: '#5C5C5C' },
]

// No public BPDA raster tile service identified as of 2026-05-28.
// Probed: services.arcgis.com/sFnw0xNflSi8J0uh (BPDA AGOL org — FeatureServer only,
// zero MapServers), gisportal.boston.gov/arcgis/rest/services/Planning (OpenData +
// Parcels25 MapServers, no zoning layer, singleFusedMapCache=false), gis.bostonplans.org
// (FeatureServer only), tiles.arcgis.com/tiles/sFnw0xNflSi8J0uh (empty services list),
// and bostonopendata DCAT — every zoning dataset (Boston Zoning Districts, Zoning
// Subdistricts, GCOD) publishes vector FeatureServer + CSV/Shapefile/GeoJSON/KML only.
// Map will render brand-styled basemap only; client-side feature rendering of the
// FeatureServer (FeatureServer/93 verified in Task 6) is a possible future enhancement.
export const ZONING_RASTER_URL = '<verified URL here>'
