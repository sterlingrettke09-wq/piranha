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
