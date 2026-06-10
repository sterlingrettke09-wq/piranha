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

// FUTURE ENHANCEMENT — Boston zoning overlay. No public BPDA raster tile
// service existed as of 2026-05-28. Probed: services.arcgis.com/sFnw0xNflSi8J0uh
// (BPDA AGOL org — FeatureServer only, zero MapServers),
// gisportal.boston.gov/arcgis/rest/services/Planning (OpenData + Parcels25
// MapServers, no zoning layer), gis.bostonplans.org (FeatureServer only),
// tiles.arcgis.com/tiles/sFnw0xNflSi8J0uh (empty services list), and
// bostonopendata DCAT — every zoning dataset (Boston Zoning Districts, Zoning
// Subdistricts, GCOD) publishes vector FeatureServer + CSV/GeoJSON/KML only.
// If an overlay is added later, render the FeatureServer vectors client-side
// (FeatureServer/93 was verified) rather than waiting for a raster service.
// The earlier raster plumbing (ZONING_RASTER_URL + Map's showZoningRaster
// prop) shipped permanently disabled and was removed 2026-06-09.
