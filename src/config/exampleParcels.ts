// One known-good demo parcel per city, for the "no address in mind?" chip on
// the map page. EVERY entry was verified live against /api/parcel on
// 2026-06-10: the coordinates resolve to the stated address with a real
// zoning district (no 'Unknown's, no guesses). If a city's GIS re-parcels and
// one of these stops resolving, the chip still just drops a pin — the panel
// shows its normal no-parcel state — but re-verify and replace it.
export interface ExampleParcel {
  /** Short display label — the street address only. */
  label: string
  lat: number
  lng: number
}

export const EXAMPLE_PARCELS: Record<string, ExampleParcel> = {
  boston: { label: '592 Tremont St', lat: 42.343, lng: -71.073 }, // South End, MFR/LS
  nyc: { label: '495 1st St, Park Slope', lat: 40.671, lng: -73.976 }, // R6B brownstone
  chicago: { label: '3731 N Clark St', lat: 41.9498, lng: -87.6586 }, // B3-2, Wrigleyville
  sf: { label: '4049 24th St, Noe Valley', lat: 37.751, lng: -122.433 }, // NCD-24th
  seattle: { label: '1515 E Republican St', lat: 47.623, lng: -122.312 }, // Capitol Hill
  dc: { label: '7th St SE, Capitol Hill', lat: 38.886, lng: -76.996 }, // RF-1 rowhouse
  austin: { label: '401 E 43rd St, Hyde Park', lat: 30.305, lng: -97.727 }, // MF-4
  la: { label: '4907 W Pico Blvd', lat: 34.048, lng: -118.344 }, // C2-1
  denver: { label: '735 E 10th Ave, Cap Hill', lat: 39.732, lng: -104.978 }, // G-MU-5
  minneapolis: { label: '2548 Nicollet Ave', lat: 44.956, lng: -93.278 }, // CM2
}
