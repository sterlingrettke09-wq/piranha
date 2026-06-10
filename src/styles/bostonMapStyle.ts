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

// A warm editorial basemap (think NYT graphics) layered over Mapbox light-v11.
// The earlier override set painted background, land AND water nearly the same
// bone tone — at city zoom the result was a featureless beige void with no
// visible streets, blocks, or water. This set keeps the brand's warm bone
// canvas but reintroduces legible urban fabric: cooler water, sage parks, a
// faint building tone so blocks read, and a warm-gray → charcoal road
// hierarchy. Labels are intentionally LEFT ON (we never hide them).
//
// Layer ids below are the documented Mapbox light-v11 ids. Every override is
// guarded by map.getLayer() at apply time (see Map.tsx onStyleLoad), so any id
// that a future style revision renames or drops is silently skipped rather than
// throwing. Ids that vary in confidence across style versions (national-park,
// landuse, the building layer name) are noted in the project report.
export const BRAND_OVERRIDES: PaintOverride[] = [
  // ── Canvas: warm bone, unchanged brand ground ──
  { layerId: 'background', property: 'background-color', value: BRAND.bone },
  { layerId: 'land', property: 'background-color', value: BRAND.bone },

  // ── Water: clearly cooler + darker than the land so the harbor/river read
  //    at a glance. A desaturated warm slate that still harmonizes with bone. ──
  { layerId: 'water', property: 'fill-color', value: '#AEB7B8' },

  // ── Green space: a soft sage tint so parks/commons stand out from the
  //    street grid without shouting. (landuse covers parks/cemeteries/etc.;
  //    national-park is a separate fill in light-v11.) ──
  { layerId: 'landuse', property: 'fill-color', value: '#D6DAC4' },
  { layerId: 'national-park', property: 'fill-color', value: '#CFD6BC' },

  // ── Buildings: a faint warm tone, just darker than bone, so the urban
  //    fabric (block footprints) is visible at neighborhood zoom. ──
  { layerId: 'building', property: 'fill-color', value: '#EAE4D8' },
  { layerId: 'building', property: 'fill-opacity', value: 0.55 },

  // ── Road hierarchy: warm grays climbing to charcoal, so streets are
  //    obviously present and the arterials anchor the eye. ──
  { layerId: 'road-minor', property: 'line-color', value: '#CFC8BA' },
  { layerId: 'road-street', property: 'line-color', value: '#C6BEAF' },
  { layerId: 'road-secondary-tertiary', property: 'line-color', value: '#A89F8E' },
  { layerId: 'road-primary', property: 'line-color', value: '#3A3633' },
]

// ── Zoning-district overlay (WO-8.1b/c/d) ──────────────────────────────────
// The dashboard fetches each city's zoning FeatureServer as GeoJSON (viewport
// envelope, zoom ≥ 14) and colors polygons by district FAMILY so the map reads
// at a glance without a per-city legend. Four families, one shared palette.

export type ZoningFamily = 'residential' | 'commercial' | 'industrial' | 'other'

export const ZONING_FAMILY_COLORS: Record<ZoningFamily, string> = {
  // Residential greens, commercial burgundies (brand), industrial grays, else neutral.
  residential: '#5C8A5A',
  commercial: BRAND.burgundy,
  industrial: '#7C7C82',
  other: '#A89B86',
}

export const ZONING_FAMILY_LABELS: Record<ZoningFamily, string> = {
  residential: 'Residential',
  commercial: 'Commercial / mixed',
  industrial: 'Industrial',
  other: 'Other',
}

// Classify a raw district code (the per-city codeField value) into a family.
// Deliberately broad and prefix-based: zoning codes vary wildly by city, but the
// leading letters are remarkably consistent (R/RS/RM = residential, B/C/MU/NC =
// commercial-ish, M/I/IG/PD-industrial = industrial). Anything unrecognized
// falls to 'other' (neutral) rather than guessing — the overlay communicates
// broad strokes, not a legal determination.
export function classifyZoningFamily(code: string | null | undefined): ZoningFamily {
  if (!code) return 'other'
  const c = code.trim().toUpperCase()
  if (!c) return 'other'
  // Industrial FIRST, but only on unambiguous prefixes so it never steals a
  // commercial/mixed code: M followed by a digit (M1/M2/M3 — NOT MX/MU), the
  // I-districts (I1/I-2/IG/IH/IL/IP), PDR (SF production-distribution-repair,
  // which must beat the commercial "PD" prefix), or the word industrial.
  if (/^(M\d|IG|IH|IL|IP|I\d|I-\d|PDR)/.test(c) || c === 'I' || /\bINDUSTR/.test(c)) return 'industrial'
  // Commercial / mixed / downtown: B, C, MU, NC, MX, D, CM, GB, LB, CC, CB, PD, TOD, OR…
  if (/^(B\d|C\d|B-|C-|MU|NC|MX|D$|D-|CM|GB|LB|CC|CB|PD|TOD|OR)/.test(c)) return 'commercial'
  if (/\b(COMMERCIAL|MIXED|DOWNTOWN|OFFICE|BUSINESS)\b/.test(c)) return 'commercial'
  // Residential: R, RS, RM, RH, RR, SF, RES, UN#, UR#…
  if (/^(RS|RM|RH|RR|R\d|R-|R$|SF|RES|UN\d|UR\d)/.test(c)) return 'residential'
  if (/\bRESIDENT/.test(c)) return 'residential'
  return 'other'
}

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
