// Per-city parking-minimum rules — single source of truth for the parking
// hurdle (netlify/functions/lib/hurdles.ts), the SiteFacts parcel fact, the
// Red Tape Index table, and the Methodology page.
//
// Parking minimums are a flagship Abundance-era reform target: where a city has
// abolished them that's a real cost saver (parking becomes market-driven, not
// mandated); where they remain — even partially — required spaces drive cost
// and constrain the building envelope.
//
// Verified against current city sources on 2026-06-10. Source note per city:
//   minneapolis — Minneapolis 2040 comprehensive plan; minimums abolished
//                 citywide in 2021.
//   sf          — San Francisco Ordinance 286-18 (2018); off-street minimums
//                 removed citywide.
//   austin      — Austin City Council vote (2023); minimums abolished citywide.
//   denver      — Denver City Council action effective Aug 11, 2025; removed ALL
//                 minimums, every use, every zoning district.
//   chicago     — July 2025 ordinance (effective Sept 25, 2025); zero parking
//                 by-right in Transit-Served Locations, all districts except the
//                 D Downtown districts. Minimums remain outside TSLs.
//   nyc         — City of Yes for Housing Opportunity (adopted Dec 2024); Zone 1
//                 eliminated, Zone 2 reduced, Zone 3 largely unchanged.
//   seattle     — Seattle Municipal Code; no minimums in urban centers/villages
//                 and frequent-transit areas; minimums remain elsewhere.
//   la          — California AB 2097 (effective 2023); no minimums statewide
//                 within ½ mile of a major transit stop; minimums remain
//                 elsewhere in LA.
//   boston      — Boston Planning Dept. policy (2021); minimums eliminated for
//                 income-restricted affordable housing and reduced near transit;
//                 most districts still set ratios.
//   philadelphia — Bill 250524 (signed June 2025); residential parking
//                 minimums removed in CMX-4/CMX-5 (Center City, University
//                 City, North Broad). Minimums remain in other districts.
//   nashville   — Minimums eliminated inside the Urban Zoning Overlay (2022,
//                 old minimums became maximums); downtown never had them.
//                 Metro Code Ch. 17.20 minimums remain outside the UZO.
//   sanjose     — Parking & TDM Standards Ordinance (Council 12/6/2022, eff.
//                 spring 2023) removed minimums citywide from Zoning Ordinance
//                 Ch. 20.90; supersedes AB 2097 locally. TDM added in exchange.
//   sandiego    — CA AB 2097 (2023) statewide half-mile-of-transit exemption,
//                 plus the city's own Transit Priority Area removal for
//                 multifamily. Minimums remain outside those areas.
//   miami       — Miami 21 retains minimums; TOD/Transit Corridor reductions in
//                 T4/T5/T6 plus a 20% transit-proximity reduction (city
//                 guidelines rev. 4/29/2025). Citywide elimination only proposed.
//   dc          — DC 2016 zoning regulations; eliminated downtown, cut roughly
//                 in half near frequent transit; minimums remain elsewhere.

export interface ParkingRule {
  status: 'abolished' | 'partial'
  /** Short, scannable summary for table cells and the SiteFacts headline. */
  headline: string
  /** 1–2 sentence plain-English version of the rule. */
  detail: string
  /** As-of date for the underlying source. */
  asOf: string
}

export const PARKING_RULES: Record<string, ParkingRule> = {
  minneapolis: {
    status: 'abolished',
    headline: 'No parking minimums — abolished citywide (2021)',
    detail:
      'Minneapolis abolished off-street parking minimums citywide in 2021 under its 2040 plan. No parking is required for any project; you can still build it, but you’re no longer forced to.',
    asOf: '2021',
  },
  sf: {
    status: 'abolished',
    headline: 'No parking minimums — abolished citywide (2018)',
    detail:
      'San Francisco removed off-street parking minimums citywide in 2018 (Ordinance 286-18). None are required anywhere in the city; parking is optional and demand-driven.',
    asOf: '2018',
  },
  austin: {
    status: 'abolished',
    headline: 'No parking minimums — abolished citywide (2023)',
    detail:
      'Austin abolished parking minimums citywide in 2023. No off-street parking is required for any use; you decide how much to build.',
    asOf: '2023',
  },
  denver: {
    status: 'abolished',
    headline: 'No parking minimums — abolished citywide (2025)',
    detail:
      'Denver removed all parking minimums — every use, every zoning district — effective August 11, 2025. No off-street parking is required anywhere in the city.',
    asOf: 'Aug 2025',
  },
  chicago: {
    status: 'partial',
    headline: 'None required near transit; minimums remain elsewhere',
    detail:
      'Chicago’s July 2025 ordinance (effective Sept 25, 2025) allows zero parking by-right in Transit-Served Locations — within ½ mile of CTA/Metra rail or ¼ mile of key bus corridors, covering about 74% of the city in all districts except Downtown. Minimums still apply outside those areas.',
    asOf: 'Sept 2025',
  },
  nyc: {
    status: 'partial',
    headline: 'Eliminated in Manhattan core; reduced or unchanged elsewhere',
    detail:
      'NYC’s City of Yes for Housing Opportunity (Dec 2024) eliminated minimums in Zone 1 (Manhattan outside Inwood, plus Long Island City and parts of western Queens/Brooklyn), reduced them in transit-rich Zone 2, and largely kept them in Zone 3. ADUs, conversions, and transit-oriented development are exempt citywide.',
    asOf: 'Dec 2024',
  },
  seattle: {
    status: 'partial',
    headline: 'None required in urban centers and transit areas',
    detail:
      'Seattle requires no parking minimums inside urban centers/villages and frequent-transit areas, which cover much of the buildable city. Minimums remain elsewhere — confirm whether your parcel falls inside one.',
    asOf: '2026-06-10',
  },
  la: {
    status: 'partial',
    headline: 'None required within ½ mile of major transit (AB 2097)',
    detail:
      'Under California AB 2097 (effective 2023), no parking minimums apply within ½ mile of a major transit stop anywhere in the state, including much of Los Angeles. Minimums remain elsewhere in the city.',
    asOf: '2023',
  },
  boston: {
    status: 'partial',
    headline: 'None for affordable housing; reduced near transit',
    detail:
      'Boston eliminated parking minimums for income-restricted affordable housing in 2021 and has cut them broadly near transit. Most districts still set a ratio, so confirm the requirement for your zone — every space adds significant cost.',
    asOf: '2021',
  },
  dc: {
    status: 'partial',
    headline: 'Eliminated downtown; cut near transit; minimums remain elsewhere',
    detail:
      'Washington, DC’s 2016 zoning regulations eliminated parking minimums downtown and cut them roughly in half near frequent transit. Minimums remain in the rest of the city.',
    asOf: '2016',
  },
  nashville: {
    status: 'partial',
    headline: 'None required in the Urban Zoning Overlay or downtown',
    detail:
      'Metro eliminated parking minimums inside the Urban Zoning Overlay in 2022 and converted the old minimums into maximums; downtown has never had parking requirements at all. The UZO runs roughly from East Nashville to I-440 and Hillwood to South Nashville. Minimums under Metro Code Ch. 17.20 still apply outside it.',
    asOf: '2022',
  },
  sanjose: {
    status: 'abolished',
    headline: 'No parking minimums — abolished citywide (2023)',
    detail:
      'San Jose removed off-street parking minimums citywide when the Council adopted the Parking and Transportation Demand Management Standards Ordinance in December 2022 (effective spring 2023) — the largest US city to do so. Transportation-demand-management requirements were added in exchange. No parking is required for any project.',
    asOf: '2023',
  },
  sandiego: {
    status: 'partial',
    headline: 'None required near transit (AB 2097 + city Transit Priority Areas)',
    detail:
      'Two rules stack. San Diego Ordinance O-21057 (March 2019) set zero minimum parking for multifamily housing in Transit Priority Areas, and O-21041 (Jan 2022) removed minimums for many commercial uses there. Statewide, California AB 2097 (Jan 2023) independently bars any minimum within a half mile of a major transit stop. Parking is market-determined across the transit-served majority of the city.',
    asOf: '2023',
  },
  miami: {
    status: 'partial',
    headline: 'Reduced near transit and in TOD areas; minimums remain elsewhere',
    detail:
      'Miami 21 still sets parking minimums, but reductions apply in Transit Oriented Development areas and Transit Corridors in the T4, T5 and T6 transects, and a 20% reduction is available near Metrorail, Metromover, and Transit Corridor bus stops. A broader elimination along transit corridors was proposed in 2025 but is not adopted citywide.',
    asOf: '2025',
  },
  philadelphia: {
    status: 'partial',
    headline: 'Eliminated for housing in CMX-4/CMX-5; minimums remain elsewhere',
    detail:
      'Bill 250524, signed June 2025, removed the on-site parking requirement for new residential development in the CMX-4 and CMX-5 districts — mainly Center City, University City, and North Broad — replacing a ratio of three spaces per ten dwelling units. Minimums still apply in the rest of the city.',
    asOf: '2025',
  },
}
