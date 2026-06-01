// Geometry + geocoding helpers shared by city providers.

// Shoelace area of ArcGIS polygon rings, in the rings' linear units squared,
// converted to square feet. unitToFeet = 1 for feet-based SRs, 3.28084 for meters.
export function polygonAreaSqFt(rings: number[][][] | undefined, unitToFeet = 1): number | null {
  if (!rings || rings.length === 0) return null
  let area = 0
  for (const ring of rings) {
    let a = 0
    for (let i = 0; i < ring.length - 1; i++) {
      a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    }
    area += a / 2
  }
  const sqft = Math.abs(area) * unitToFeet * unitToFeet
  return sqft > 0 ? Math.round(sqft) : null
}

// Forward-project WGS84 lng/lat to UTM zone 15N (EPSG:26915), in meters.
// Hennepin County's parcel server (Minneapolis) does not reproject inSR=4326 —
// it silently returns no features — so we must hand it geometry already in 26915.
// Standard Transverse Mercator forward formulas on the WGS84 ellipsoid.
export function lngLatToUtm15(lng: number, lat: number): { x: number; y: number } {
  const a = 6378137.0
  const f = 1 / 298.257223563
  const k0 = 0.9996
  const e2 = f * (2 - f)
  const ep2 = e2 / (1 - e2)
  const lon0 = (-93 * Math.PI) / 180 // zone 15 central meridian
  const phi = (lat * Math.PI) / 180
  const lam = (lng * Math.PI) / 180
  const sin = Math.sin(phi)
  const cos = Math.cos(phi)
  const tan = Math.tan(phi)
  const N = a / Math.sqrt(1 - e2 * sin * sin)
  const T = tan * tan
  const C = ep2 * cos * cos
  const A = (lam - lon0) * cos
  const M =
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * phi))
  const x =
    k0 *
      N *
      (A + ((1 - T + C) * A * A * A) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120) +
    500000
  const y =
    k0 *
    (M +
      N *
        tan *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720))
  return { x, y }
}

// Reverse-geocode a point to a street address via Mapbox. Returns null if no
// token is configured or no result — callers fall back gracefully.
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const token = process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN
  if (!token) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 4000)
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=address&limit=1&access_token=${token}`,
      { signal: ctrl.signal },
    )
    if (!res.ok) return null
    const d = (await res.json()) as {
      features?: Array<{ text?: string; address?: string; place_name?: string }>
    }
    const f = d.features?.[0]
    if (!f) return null
    if (f.address && f.text) return `${f.address} ${f.text}`
    return f.text ?? f.place_name ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
