// Soft "special site" detector. Unlike developability.ts (which HARD-blocks
// parks / public / federal land), this flags parcels that look like a stadium,
// arena, hospital, university, museum, or convention center — sites that are
// rarely open to private redevelopment — without stopping the analysis. The UI
// shows a prominent warning and lets the user read on.
//
// Three signals, in order of reliability:
//   1. land-use text (generalizes across cities where the layer carries a use)
//   2. per-city institutional zoning-code prefixes (Seattle MIO, Denver CMP-, LA PF)
//   3. a curated proximity list of marquee venues whose parcel data carries NO
//      usable signal (Minneapolis/Chicago stadiums read as ordinary downtown
//      lots; Chase Center / Ball Arena read as "vacant"). The list guarantees
//      the famous cases; the patterns handle the long tail where data allows.
import type { SiteAdvisory, SiteAdvisoryCategory } from '../types/analysis'

const LABELS: Record<SiteAdvisoryCategory, string> = {
  venue: 'a stadium, arena, or event venue',
  hospital: 'a hospital or medical campus',
  university: 'a college or university campus',
  museum: 'a museum or cultural institution',
  transit: 'a transit hub or major infrastructure',
  civic: 'a civic or institutional site',
}

function advisory(category: SiteAdvisoryCategory, label = LABELS[category]): SiteAdvisory {
  return {
    category,
    label,
    note: `This parcel appears to be ${label}. Sites like this are rarely open to private redevelopment, so treat everything below as a hypothetical exercise — confirm ownership and availability before relying on any of it.`,
  }
}

// --- Signal 1: land-use text patterns (matched against the mapped landUse) ---
const LANDUSE_RULES: { re: RegExp; cat: SiteAdvisoryCategory }[] = [
  { re: /\b(stadiums?|arenas?|ballparks?)\b/i, cat: 'venue' },
  { re: /sport(s)?\s*(facilit|field|center|centre|complex)|athletic|amusement\s*facilit/i, cat: 'venue' },
  { re: /auditorium|assembly\s*(bldg|building)|convention|exhibition|\btheat(er|re)s?\b/i, cat: 'venue' },
  { re: /\bhospitals?\b|medical\s*center/i, cat: 'hospital' }, // hospitals? but not "hospitality"
  { re: /univers|\bcolleges?\b|\bcampus\b/i, cat: 'university' },
  { re: /\bschool\s*\(public\)|\bpublic\s*school\b/i, cat: 'university' },
  { re: /\bmuseums?\b/i, cat: 'museum' },
  { re: /public\s*facilit(y|ies)?\s*(&|and)?\s*institution/i, cat: 'civic' },
  { re: /\binstitutional\b/i, cat: 'civic' },
  { re: /transportation\s*(&|and)\s*utilit/i, cat: 'transit' },
]

// --- Signal 2: institutional zoning-code prefixes ---
const DISTRICT_RULES: { re: RegExp; cat: SiteAdvisoryCategory; label?: string }[] = [
  { re: /^mio\b|^mio-/i, cat: 'civic', label: 'a major-institution site (hospital or university)' }, // Seattle
  { re: /^cmp-/i, cat: 'university', label: 'a campus (university or hospital)' }, // Denver
  { re: /^pf\b|^pf-/i, cat: 'civic', label: 'a public-facilities site' }, // Los Angeles
]

// --- Signal 3: curated marquee venues (city, centroid, radius, category) ---
// Coordinates are the venue centroids verified during the city audits; a ~300m
// radius covers the parcel footprint. Only the famous, data-signal-less cases
// need to live here — the patterns above catch the rest.
interface Landmark {
  city: string
  lat: number
  lng: number
  radiusM: number
  cat: SiteAdvisoryCategory
  label: string
}
const LANDMARKS: Landmark[] = [
  // Minneapolis — venues read as ordinary DT1/DT2/RM3 with null land use
  { city: 'minneapolis', lat: 44.974, lng: -93.2575, radiusM: 320, cat: 'venue', label: 'US Bank Stadium' },
  { city: 'minneapolis', lat: 44.9817, lng: -93.2776, radiusM: 300, cat: 'venue', label: 'Target Field' },
  { city: 'minneapolis', lat: 44.9795, lng: -93.276, radiusM: 220, cat: 'venue', label: 'Target Center' },
  { city: 'minneapolis', lat: 44.974, lng: -93.2277, radiusM: 500, cat: 'university', label: 'the University of Minnesota' },
  { city: 'minneapolis', lat: 44.9582, lng: -93.2737, radiusM: 200, cat: 'museum', label: 'the Minneapolis Institute of Art' },
  { city: 'minneapolis', lat: 44.97, lng: -93.273, radiusM: 220, cat: 'venue', label: 'the Minneapolis Convention Center' },
  // Chicago — Planned Developments (PD) are shared with private projects, so a code rule would over-block
  { city: 'chicago', lat: 41.9484, lng: -87.6553, radiusM: 260, cat: 'venue', label: 'Wrigley Field' },
  { city: 'chicago', lat: 41.8807, lng: -87.6742, radiusM: 280, cat: 'venue', label: 'the United Center' },
  { city: 'chicago', lat: 41.8623, lng: -87.6167, radiusM: 300, cat: 'venue', label: 'Soldier Field' },
  { city: 'chicago', lat: 41.83, lng: -87.6338, radiusM: 300, cat: 'venue', label: 'Guaranteed Rate Field' },
  { city: 'chicago', lat: 41.8956, lng: -87.6214, radiusM: 260, cat: 'hospital', label: 'Northwestern Memorial Hospital' },
  { city: 'chicago', lat: 41.7886, lng: -87.5987, radiusM: 500, cat: 'university', label: 'the University of Chicago' },
  { city: 'chicago', lat: 41.8796, lng: -87.6237, radiusM: 200, cat: 'museum', label: 'the Art Institute of Chicago' },
  { city: 'chicago', lat: 42.0021, lng: -87.6843, radiusM: 500, cat: 'university', label: 'Northwestern University' },
  // San Francisco — Chase Center reads as "vacant"; Moscone is downtown commercial
  { city: 'sf', lat: 37.768, lng: -122.3877, radiusM: 220, cat: 'venue', label: 'the Chase Center' },
  { city: 'sf', lat: 37.7841, lng: -122.4014, radiusM: 220, cat: 'venue', label: 'the Moscone Center' },
  // Denver — Ball Arena and the Art Museum carry no land-use string
  { city: 'denver', lat: 39.7487, lng: -105.0077, radiusM: 280, cat: 'venue', label: 'Ball Arena' },
  { city: 'denver', lat: 39.7372, lng: -104.9893, radiusM: 180, cat: 'museum', label: 'the Denver Art Museum' },
  // Austin — TCAD mirror carries no land-use; venues sit on ordinary commercial/industrial zones
  { city: 'austin', lat: 30.3877, lng: -97.7195, radiusM: 240, cat: 'venue', label: 'Q2 Stadium' },
  { city: 'austin', lat: 30.2755, lng: -97.7335, radiusM: 200, cat: 'hospital', label: 'Dell Seton Medical Center' },
  { city: 'austin', lat: 30.264, lng: -97.7395, radiusM: 220, cat: 'venue', label: 'the Austin Convention Center' },
  // Boston — land-use strings are unreliable (MGH read as "BANK ATM", MFA as "charitable")
  { city: 'boston', lat: 42.3467, lng: -71.0972, radiusM: 260, cat: 'venue', label: 'Fenway Park' },
  { city: 'boston', lat: 42.3662, lng: -71.0621, radiusM: 220, cat: 'venue', label: 'TD Garden' },
  { city: 'boston', lat: 42.3632, lng: -71.0686, radiusM: 280, cat: 'hospital', label: 'Massachusetts General Hospital' },
  { city: 'boston', lat: 42.345, lng: -71.0465, radiusM: 260, cat: 'venue', label: 'the Boston Convention & Exhibition Center' },
  { city: 'boston', lat: 42.3394, lng: -71.094, radiusM: 200, cat: 'museum', label: 'the Museum of Fine Arts' },
  // NYC — MSG/Grand Central usually caught by land use, listed as a backstop
  { city: 'nyc', lat: 40.7505, lng: -73.9934, radiusM: 200, cat: 'venue', label: 'Madison Square Garden' },
  { city: 'nyc', lat: 40.7527, lng: -73.9772, radiusM: 200, cat: 'transit', label: 'Grand Central Terminal' },
  // DC — covered by the USECODE provider tweak, listed as a backstop
  { city: 'dc', lat: 38.873, lng: -77.0074, radiusM: 280, cat: 'venue', label: 'Nationals Park' },
  { city: 'dc', lat: 38.8981, lng: -77.0209, radiusM: 220, cat: 'venue', label: 'Capital One Arena' },
  { city: 'dc', lat: 38.8685, lng: -77.0125, radiusM: 220, cat: 'venue', label: 'Audi Field' },
]

// Equirectangular distance — accurate to well under a meter at city scale.
function metersBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180
  const x = (lng2 - lng1) * toRad * Math.cos(((lat1 + lat2) / 2) * toRad)
  const y = (lat2 - lat1) * toRad
  return Math.sqrt(x * x + y * y) * 6_371_000
}

export function assessSiteAdvisory(opts: {
  city?: string | null
  districtCode?: string | null
  landUse?: string | null
  lat?: number | null
  lng?: number | null
}): SiteAdvisory | null {
  const use = (opts.landUse ?? '').trim()
  if (use) {
    for (const rule of LANDUSE_RULES) {
      if (rule.re.test(use)) return advisory(rule.cat)
    }
  }

  const code = (opts.districtCode ?? '').trim()
  if (code) {
    for (const rule of DISTRICT_RULES) {
      if (rule.re.test(code)) return advisory(rule.cat, rule.label)
    }
  }

  const { city, lat, lng } = opts
  if (city && typeof lat === 'number' && typeof lng === 'number') {
    for (const lm of LANDMARKS) {
      if (lm.city !== city) continue
      if (metersBetween(lat, lng, lm.lat, lm.lng) <= lm.radiusM) return advisory(lm.cat, lm.label)
    }
  }

  return null
}
