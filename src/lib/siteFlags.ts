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
  // San Jose zones civic land Public/Quasi-Public — City Hall itself reads PQP.
  { re: /^pqp\b|^pqp-/i, cat: 'civic', label: 'a public or quasi-public site' },
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
  // San Jose — arena, university, museums
  { city: 'sanjose', lat: 37.3327, lng: -121.9010, radiusM: 240, cat: 'venue', label: 'the SAP Center' },
  { city: 'sanjose', lat: 37.3352, lng: -121.8811, radiusM: 450, cat: 'university', label: 'San Jose State University' },
  { city: 'sanjose', lat: 37.3327, lng: -121.8901, radiusM: 200, cat: 'museum', label: 'the Tech Interactive' },
  { city: 'sanjose', lat: 37.3120, lng: -121.8770, radiusM: 300, cat: 'hospital', label: 'Santa Clara Valley Medical Center' },
  // San Diego — ballpark, campuses, museums, medical
  { city: 'sandiego', lat: 32.7073, lng: -117.1566, radiusM: 260, cat: 'venue', label: 'Petco Park' },
  { city: 'sandiego', lat: 32.8801, lng: -117.2340, radiusM: 900, cat: 'university', label: 'UC San Diego' },
  { city: 'sandiego', lat: 32.7757, lng: -117.0719, radiusM: 600, cat: 'university', label: 'San Diego State University' },
  { city: 'sandiego', lat: 32.7341, lng: -117.1446, radiusM: 220, cat: 'museum', label: 'the San Diego Zoo' },
  { city: 'sandiego', lat: 32.7554, lng: -117.1660, radiusM: 300, cat: 'hospital', label: 'the UC San Diego Medical Center' },
  // Miami — arena, stadium, campuses, museums
  { city: 'miami', lat: 25.7814, lng: -80.1870, radiusM: 240, cat: 'venue', label: 'the Kaseya Center' },
  { city: 'miami', lat: 25.7781, lng: -80.2197, radiusM: 300, cat: 'venue', label: 'loanDepot park' },
  { city: 'miami', lat: 25.7482, lng: -80.2601, radiusM: 500, cat: 'university', label: 'the University of Miami' },
  { city: 'miami', lat: 25.7906, lng: -80.1873, radiusM: 200, cat: 'museum', label: 'the Perez Art Museum Miami' },
  { city: 'miami', lat: 25.7907, lng: -80.1949, radiusM: 400, cat: 'hospital', label: 'the Jackson Memorial / UM medical campus' },
  // Philadelphia — stadium complex, campuses, and the art museum
  { city: 'philadelphia', lat: 39.9008, lng: -75.1675, radiusM: 260, cat: 'venue', label: 'Lincoln Financial Field' },
  { city: 'philadelphia', lat: 39.9061, lng: -75.1665, radiusM: 260, cat: 'venue', label: 'Citizens Bank Park' },
  { city: 'philadelphia', lat: 39.9012, lng: -75.172, radiusM: 240, cat: 'venue', label: 'the Wells Fargo Center' },
  { city: 'philadelphia', lat: 39.9656, lng: -75.181, radiusM: 220, cat: 'museum', label: 'the Philadelphia Museum of Art' },
  { city: 'philadelphia', lat: 39.9522, lng: -75.1932, radiusM: 600, cat: 'university', label: 'the University of Pennsylvania' },
  { city: 'philadelphia', lat: 39.9812, lng: -75.1554, radiusM: 500, cat: 'university', label: 'Temple University' },
  { city: 'philadelphia', lat: 39.9496, lng: -75.1817, radiusM: 300, cat: 'hospital', label: 'the Hospital of the University of Pennsylvania' },
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

// --- Civic HARD-BLOCK list (distinct from the advisory LANDMARKS above) ---
// City halls, capitols, courthouses, marquee public parks, and airports. These
// are definitively NOT private development sites, but their parcel data often
// carries no public-owner / open-space / public-land-use signal (the per-city
// gate in developability.ts misses them), so they're blocked by location here.
// Radii are tuned to each site's footprint to limit catching adjacent lots.
interface CivicBlock {
  city: string
  lat: number
  lng: number
  radiusM: number
  label: string
}
const CIVIC_BLOCKS: CivicBlock[] = [
  // City halls (some already block via owner/land-use; listed for robustness)
  { city: 'boston', lat: 42.3605, lng: -71.0582, radiusM: 150, label: 'Boston City Hall' },
  { city: 'nyc', lat: 40.71273, lng: -74.00597, radiusM: 150, label: 'New York City Hall' },
  { city: 'chicago', lat: 41.88378, lng: -87.63197, radiusM: 160, label: 'Chicago City Hall' },
  { city: 'sf', lat: 37.77927, lng: -122.41924, radiusM: 190, label: 'San Francisco City Hall' },
  { city: 'seattle', lat: 47.60383, lng: -122.33006, radiusM: 150, label: 'Seattle City Hall' },
  { city: 'dc', lat: 38.8937, lng: -77.0325, radiusM: 150, label: 'the John A. Wilson Building (DC City Hall)' },
  { city: 'austin', lat: 30.2649, lng: -97.7472, radiusM: 170, label: 'Austin City Hall' },
  { city: 'la', lat: 34.0537, lng: -118.2427, radiusM: 170, label: 'Los Angeles City Hall' },
  { city: 'denver', lat: 39.7392, lng: -104.9903, radiusM: 180, label: 'the Denver City & County Building' },
  { city: 'minneapolis', lat: 44.9773, lng: -93.2657, radiusM: 170, label: 'Minneapolis City Hall' },
  // State / national capitols
  { city: 'denver', lat: 39.7393, lng: -104.9848, radiusM: 190, label: 'the Colorado State Capitol' },
  { city: 'austin', lat: 30.2747, lng: -97.7404, radiusM: 260, label: 'the Texas State Capitol' },
  { city: 'boston', lat: 42.3588, lng: -71.0638, radiusM: 150, label: 'the Massachusetts State House' },
  { city: 'dc', lat: 38.8899, lng: -77.0091, radiusM: 320, label: 'the United States Capitol' },
  // Major courthouses (federal / county)
  { city: 'sf', lat: 37.7816, lng: -122.4137, radiusM: 150, label: 'the Phillip Burton Federal Building & U.S. Courthouse' },
  { city: 'la', lat: 34.0527, lng: -118.2476, radiusM: 150, label: 'the U.S. Courthouse' },
  { city: 'chicago', lat: 41.8787, lng: -87.6299, radiusM: 150, label: 'the Dirksen Federal Courthouse' },
  { city: 'dc', lat: 38.8922, lng: -77.0149, radiusM: 170, label: 'the U.S. District Courthouse' },
  { city: 'denver', lat: 39.7418, lng: -104.9872, radiusM: 170, label: 'the Denver Justice Center' },
  { city: 'seattle', lat: 47.6015, lng: -122.3316, radiusM: 150, label: 'the U.S. Courthouse' },
  { city: 'austin', lat: 30.2705, lng: -97.7393, radiusM: 150, label: 'the U.S. Courthouse' },
  { city: 'minneapolis', lat: 44.9779, lng: -93.2671, radiusM: 190, label: 'the Hennepin County Government Center' },
  { city: 'boston', lat: 42.3567, lng: -71.0496, radiusM: 150, label: 'the Moakley Federal Courthouse' },
  // Marquee public parks (radii cover the green/water core, not bordering lots)
  { city: 'chicago', lat: 41.8735, lng: -87.6195, radiusM: 450, label: 'Grant Park' },
  { city: 'chicago', lat: 41.8826, lng: -87.6231, radiusM: 240, label: 'Millennium Park' },
  { city: 'denver', lat: 39.7003, lng: -104.97, radiusM: 420, label: 'Washington Park' },
  { city: 'denver', lat: 39.7546, lng: -105.0033, radiusM: 200, label: 'Commons Park' },
  { city: 'seattle', lat: 47.6205, lng: -122.3493, radiusM: 300, label: 'Seattle Center' },
  { city: 'minneapolis', lat: 44.953, lng: -93.301, radiusM: 380, label: 'Lake of the Isles Park' },
  // Airport terminals / airfields (large footprints)
  { city: 'chicago', lat: 41.9786, lng: -87.9048, radiusM: 2500, label: "O'Hare International Airport" },
  { city: 'denver', lat: 39.8493, lng: -104.6737, radiusM: 4000, label: 'Denver International Airport' },
  { city: 'austin', lat: 30.1945, lng: -97.6699, radiusM: 1800, label: 'Austin-Bergstrom International Airport' },
  // Central libraries (main branches in the weak-signal cities)
  { city: 'chicago', lat: 41.8757, lng: -87.6282, radiusM: 140, label: 'the Harold Washington Library' },
  { city: 'la', lat: 34.0508, lng: -118.2554, radiusM: 150, label: 'the Los Angeles Central Library' },
  { city: 'austin', lat: 30.273, lng: -97.7443, radiusM: 140, label: 'the Austin Central Library' },
  // Major rail / transit terminals
  { city: 'chicago', lat: 41.8789, lng: -87.639, radiusM: 220, label: 'Chicago Union Station' },
  { city: 'la', lat: 34.0561, lng: -118.235, radiusM: 260, label: 'Union Station' },
  { city: 'sf', lat: 37.7765, lng: -122.3942, radiusM: 200, label: 'the 4th & King Caltrain Station' },
  { city: 'boston', lat: 42.3519, lng: -71.0552, radiusM: 200, label: 'South Station' },
  { city: 'denver', lat: 39.7531, lng: -105.001, radiusM: 220, label: 'Denver Union Station' },
  // Police / public-safety headquarters
  { city: 'la', lat: 34.0534, lng: -118.2456, radiusM: 140, label: 'the LAPD headquarters' },
  { city: 'chicago', lat: 41.859, lng: -87.618, radiusM: 150, label: 'the Chicago Police headquarters' },
  { city: 'austin', lat: 30.2693, lng: -97.743, radiusM: 140, label: 'the Austin Police headquarters' },
  // Cemeteries (large polygons → generous radii)
  { city: 'chicago', lat: 41.7705, lng: -87.5995, radiusM: 700, label: 'Oak Woods Cemetery' },
  { city: 'denver', lat: 39.7185, lng: -104.921, radiusM: 800, label: 'Fairmount Cemetery' },
  { city: 'minneapolis', lat: 44.945, lng: -93.292, radiusM: 550, label: 'Lakewood Cemetery' },
  { city: 'austin', lat: 30.2535, lng: -97.727, radiusM: 220, label: 'the Texas State Cemetery' },
  // Flagship public schools (weak-signal cities; named landmarks)
  { city: 'la', lat: 34.0966, lng: -118.3265, radiusM: 170, label: 'Hollywood High School' },
  { city: 'sf', lat: 37.76, lng: -122.4869, radiusM: 170, label: 'George Washington High School' },
  { city: 'seattle', lat: 47.6145, lng: -122.349, radiusM: 160, label: 'the Seattle Public Schools headquarters' },
  // Military installations
  { city: 'austin', lat: 30.287, lng: -97.755, radiusM: 800, label: 'Camp Mabry' },
  // --- San Jose (added with the city, 2026-08-03) ---
  // San Jose publishes no owner or assessor data at all, so the owner gate is
  // unavailable and this curated list is the primary civic defence.
  { city: 'sanjose', lat: 37.3382, lng: -121.8863, radiusM: 180, label: 'San Jose City Hall' },
  { city: 'sanjose', lat: 37.3376, lng: -121.8949, radiusM: 200, label: 'the Santa Clara County Superior Court' },
  { city: 'sanjose', lat: 37.3300, lng: -121.8900, radiusM: 200, label: 'the Dr. Martin Luther King Jr. Library' },
  { city: 'sanjose', lat: 37.3639, lng: -121.9289, radiusM: 2200, label: 'San Jose Mineta International Airport' },
  { city: 'sanjose', lat: 37.3300, lng: -121.8880, radiusM: 200, label: 'the San Jose Convention Center' },
  { city: 'sanjose', lat: 37.3160, lng: -121.8830, radiusM: 500, label: 'Kelley Park' },
  // --- San Diego (added with the city, 2026-08-03) ---
  // San Diego publishes no owner name, so the curated list carries more weight
  // here; the city-owned-land layer catches only CITY parcels, not county /
  // state / federal / port / school-district land.
  { city: 'sandiego', lat: 32.7157, lng: -117.1625, radiusM: 180, label: 'San Diego City Hall' },
  { city: 'sandiego', lat: 32.7180, lng: -117.1690, radiusM: 200, label: 'the San Diego County Administration Center' },
  { city: 'sandiego', lat: 32.7157, lng: -117.1573, radiusM: 170, label: 'the San Diego Central Courthouse' },
  { city: 'sandiego', lat: 32.7338, lng: -117.1470, radiusM: 1400, label: 'Balboa Park' },
  { city: 'sandiego', lat: 32.7336, lng: -117.1897, radiusM: 2500, label: 'San Diego International Airport' },
  { city: 'sandiego', lat: 32.6850, lng: -117.1500, radiusM: 1800, label: 'Naval Base San Diego' },
  { city: 'sandiego', lat: 32.7080, lng: -117.1750, radiusM: 900, label: 'Naval Air Station North Island' },
  { city: 'sandiego', lat: 32.7130, lng: -117.1660, radiusM: 200, label: 'the San Diego Central Library' },
  // --- Miami (added with the city, 2026-08-03) ---
  { city: 'miami', lat: 25.7743, lng: -80.1937, radiusM: 170, label: 'Miami City Hall' },
  { city: 'miami', lat: 25.7776, lng: -80.1959, radiusM: 200, label: 'the Miami-Dade County Courthouse' },
  { city: 'miami', lat: 25.7784, lng: -80.1878, radiusM: 200, label: 'Bayfront Park' },
  { city: 'miami', lat: 25.7907, lng: -80.1867, radiusM: 220, label: 'Museum Park' },
  { city: 'miami', lat: 25.7959, lng: -80.2870, radiusM: 2500, label: 'Miami International Airport' },
  { city: 'miami', lat: 25.7281, lng: -80.2417, radiusM: 200, label: 'Miami City Hall (Dinner Key)' },
  // --- Philadelphia (added with the city, 2026-08-03) ---
  // Philadelphia's assessor layer has no owner record for many civic parcels, so
  // the owner gate alone does not catch them.
  { city: 'philadelphia', lat: 39.9524, lng: -75.1636, radiusM: 170, label: 'Philadelphia City Hall' },
  { city: 'philadelphia', lat: 39.9489, lng: -75.15, radiusM: 260, label: 'Independence National Historical Park' },
  { city: 'philadelphia', lat: 39.952, lng: -75.152, radiusM: 150, label: 'the U.S. Courthouse' },
  { city: 'philadelphia', lat: 39.9566, lng: -75.182, radiusM: 220, label: '30th Street Station' },
  { city: 'philadelphia', lat: 39.9601, lng: -75.171, radiusM: 150, label: 'the Free Library of Philadelphia' },
  { city: 'philadelphia', lat: 39.8744, lng: -75.2424, radiusM: 2500, label: 'Philadelphia International Airport' },
  { city: 'philadelphia', lat: 39.99, lng: -75.21, radiusM: 1500, label: 'Fairmount Park' },
  { city: 'philadelphia', lat: 39.9683, lng: -75.1727, radiusM: 200, label: 'Eastern State Penitentiary' },
  // More airports (in-city; others like SFO/SeaTac/MSP/Reagan sit outside the
  // city bbox and already return no-coverage)
  { city: 'chicago', lat: 41.786, lng: -87.7524, radiusM: 1500, label: 'Midway International Airport' },
  { city: 'boston', lat: 42.3656, lng: -71.0096, radiusM: 2000, label: 'Logan International Airport' },
  { city: 'nyc', lat: 40.6413, lng: -73.7781, radiusM: 3500, label: 'John F. Kennedy International Airport' },
  { city: 'nyc', lat: 40.7769, lng: -73.874, radiusM: 1800, label: 'LaGuardia Airport' },
  { city: 'la', lat: 34.2098, lng: -118.49, radiusM: 1500, label: 'Van Nuys Airport' },
  // Major parks (radii tuned to the green/water core to limit catching bordering
  // lots; owner-based cities also catch parks via ownership, listed for safety)
  { city: 'boston', lat: 42.355, lng: -71.0656, radiusM: 260, label: 'Boston Common' },
  { city: 'boston', lat: 42.3541, lng: -71.0704, radiusM: 200, label: 'the Public Garden' },
  { city: 'boston', lat: 42.3043, lng: -71.0892, radiusM: 600, label: 'Franklin Park' },
  { city: 'boston', lat: 42.2966, lng: -71.1225, radiusM: 700, label: 'the Arnold Arboretum' },
  { city: 'nyc', lat: 40.7829, lng: -73.9654, radiusM: 700, label: 'Central Park' },
  { city: 'nyc', lat: 40.6602, lng: -73.969, radiusM: 600, label: 'Prospect Park' },
  { city: 'nyc', lat: 40.74, lng: -73.8407, radiusM: 700, label: 'Flushing Meadows–Corona Park' },
  { city: 'chicago', lat: 41.9214, lng: -87.6339, radiusM: 450, label: 'Lincoln Park' },
  { city: 'chicago', lat: 41.79, lng: -87.58, radiusM: 600, label: 'Jackson Park' },
  { city: 'chicago', lat: 41.793, lng: -87.617, radiusM: 450, label: 'Washington Park' },
  { city: 'chicago', lat: 41.905, lng: -87.701, radiusM: 500, label: 'Humboldt Park' },
  { city: 'chicago', lat: 41.886, lng: -87.717, radiusM: 450, label: 'Garfield Park' },
  { city: 'sf', lat: 37.7596, lng: -122.4269, radiusM: 200, label: 'Dolores Park' },
  { city: 'sf', lat: 37.7989, lng: -122.4662, radiusM: 1000, label: 'the Presidio' },
  { city: 'sf', lat: 37.768, lng: -122.442, radiusM: 220, label: 'Buena Vista Park' },
  { city: 'seattle', lat: 47.658, lng: -122.4055, radiusM: 900, label: 'Discovery Park' },
  { city: 'seattle', lat: 47.6806, lng: -122.3286, radiusM: 550, label: 'Green Lake Park' },
  { city: 'seattle', lat: 47.63, lng: -122.316, radiusM: 280, label: 'Volunteer Park' },
  { city: 'seattle', lat: 47.6685, lng: -122.3543, radiusM: 450, label: 'Woodland Park' },
  { city: 'dc', lat: 38.956, lng: -77.046, radiusM: 1000, label: 'Rock Creek Park' },
  { city: 'dc', lat: 38.921, lng: -77.035, radiusM: 200, label: 'Meridian Hill Park' },
  { city: 'austin', lat: 30.267, lng: -97.772, radiusM: 600, label: 'Zilker Park' },
  { city: 'austin', lat: 30.29, lng: -97.756, radiusM: 280, label: 'Pease Park' },
  { city: 'la', lat: 34.1366, lng: -118.294, radiusM: 1800, label: 'Griffith Park' },
  { city: 'la', lat: 34.078, lng: -118.245, radiusM: 700, label: 'Elysian Park' },
  { city: 'la', lat: 34.0726, lng: -118.2606, radiusM: 220, label: 'Echo Park Lake' },
  { city: 'la', lat: 34.0578, lng: -118.278, radiusM: 220, label: 'MacArthur Park' },
  { city: 'denver', lat: 39.745, lng: -104.951, radiusM: 550, label: 'City Park' },
  { city: 'denver', lat: 39.732, lng: -104.961, radiusM: 300, label: 'Cheesman Park' },
  { city: 'minneapolis', lat: 44.9153, lng: -93.211, radiusM: 500, label: 'Minnehaha Park' },
  { city: 'minneapolis', lat: 44.969, lng: -93.286, radiusM: 230, label: 'Loring Park' },
  { city: 'minneapolis', lat: 44.922, lng: -93.307, radiusM: 500, label: 'Lake Harriet' },
]

/** Curated location-based hard block for civic/public sites whose parcel data
 *  carries no public signal. Returns the site label, or null. */
export function assessCivicHardBlock(opts: {
  city?: string | null
  lat?: number | null
  lng?: number | null
}): { label: string } | null {
  const { city, lat, lng } = opts
  if (!city || typeof lat !== 'number' || typeof lng !== 'number') return null
  for (const b of CIVIC_BLOCKS) {
    if (b.city !== city) continue
    if (metersBetween(lat, lng, b.lat, b.lng) <= b.radiusM) return { label: b.label }
  }
  return null
}
