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
//   raleigh     — Read 2026-08-07 from the City's own consolidated UDO text
//                 (udo.raleighnc.gov/udo-book/print-all-chapters), NOT a summary.
//                 Sec. 7.1.1 "Definitions" says verbatim: "Vehicle parking. This
//                 refers to cars, trucks, and similar vehicles. No parking is
//                 required for vehicles, but this code regulates the design and
//                 other aspects of any vehicular parking spaces that are
//                 provided." Sec. 7.1.2.C's table confirms it structurally — its
//                 columns are "Vehicle Parking (max) | Short-Term Bicycle Parking
//                 (min) | Long-Term Bicycle Parking (min)". There is no vehicle
//                 minimum column at all, in any use category. That is the slot
//                 test (CLAUDE.md rule 5) applied to a table: the row exists,
//                 the minimum column does not.
//
//                 ⚠️ THE REFORM YEAR IS DELIBERATELY NOT ASSERTED. The UDO's own
//                 history table shows Sec. 7.1.1 last amended by TC-11-21
//                 (Ord. 2022-352-TC-464, effective 3-15-2022), which proves the
//                 current text is no NEWER than 2022 — it does NOT prove that
//                 amendment is what removed the minimums, and no pre-2025
//                 snapshot of the section was retrievable to check (the Wayback
//                 CDX index for the section returns nothing before 2025-06-20).
//                 So `asOf` carries the date the ordinance was READ, and neither
//                 the headline nor the detail names a year. Guessing "2022" here
//                 would be a date-shaped claim resting on an inference — the
//                 rule-7 failure, where a confidently wrong marker is worse than
//                 no marker. `cellLabel` therefore names no year either — it
//                 reads "Abolished citywide — UDO sets maximums, not minimums".
//                 (Historic note: `parkingCell()` used to synthesise
//                 `Abolished (${asOf})` from the status, which would have
//                 published "Abolished (2026)" — a read date rendered as a
//                 reform year. It no longer derives anything; see `cellLabel`.)

//   milwaukee   — Milwaukee Code of Ordinances ch. 295 (Zoning) subch. 4,
//                 s. 295-403 "Motor Vehicle Parking", read 2026-08-08 from the
//                 City Clerk / Legislative Reference Bureau's own consolidated
//                 PDF (city.milwaukee.gov/ImageLibrary/Groups/ccClerk/
//                 Ordinances/Volume-2/CH295-sub4.pdf; page footers rev.
//                 7/15/2025, 6/11/2024, 5/10/2022), reached from the Clerk's
//                 "City Charter and Ordinances" table of contents — the same
//                 route `zoning/milwaukee.ts` used. NOT Municode, not a summary.
//
//                 ⚠️ SAME REPRODUCIBILITY WARNING the zoning module carries:
//                 city.milwaukee.gov sits behind Cloudflare and answers curl
//                 AND WebFetch with HTTP 403 + `cf-mitigated: challenge`. A 403
//                 here is a BOT CHECK, NOT A MISSING DOCUMENT. These pages were
//                 read by driving a browser at the live host; a plain fetch will
//                 keep failing.
//   columbus    — Columbus City Codes Title 33 ch. 3312 and Title 34, read
//                 2026-08-08 via the same Municode API path the zoning module
//                 established (api.municode.com job 487713 / product 16219,
//                 "Codified through Ordinance No. 0923-2026, enacted April 20,
//                 2026 (Supp. No. 85, 6/26)"); Title 34 from the supplement's
//                 attached PDF, page footer "July 2025".
//   charlotte   — Charlotte UDO Article 19, read 2026-08-08 from the City's own
//                 publisher (charlotteudo.org/articles/part-viii-general-
//                 development-zoning-standards/article-19-off-street-vehicle-
//                 bicycle-parking), reached from the article index at /articles
//                 (rule 8). Table 19-1 was parsed out of the HTML <tr>/<td>
//                 markup with EMPTY CELLS PRESERVED — the same discipline
//                 `zoning/charlotte.ts` used, and load-bearing here because the
//                 table is 105 data rows × 6 value columns and a flattened read
//                 shifts values between tiers. The column mapping is MEASURED,
//                 not guessed: every one of the 105 rows spans exactly 7
//                 columns, and column 2 (Tier 1 Maximum) is empty in all 105 —
//                 which is what the header cell independently asserts ("Tier 1
//                 does not have a parking maximum"). Two independent statements
//                 of the same fact agree, so the order is Tier1-Min | Tier1-Max
//                 | Tier2-Min | Tier2-Max | Tier3-Min | Tier3-Max.
//   atlanta     — Atlanta Code of Ordinances Part 16 (Zoning) §§ 16-28.014,
//                 16-36.020, read 2026-08-08 from the City's electronic code of
//                 record (Municode), reached from the Part 16 chapter index
//                 rather than a guessed path. Currency MEASURED, not asserted:
//                 api.municode.com/Jobs/latest/10376 returns jobId 494611,
//                 "Supplement 106", IsLatest true, "Codified through Ordinance
//                 No. 2026-25(26-O-1312), enacted May 27, 2026."
//
//   All four carry asOf '2026' — the date the ordinance was READ, not a reform
//   year, for the reason spelled out in Raleigh's note above. None of the four
//   has a single datable reform to name: each is a standing code provision or a
//   stack of them. No date reaches the Red Tape Index cell for any of them:
//   `parkingCell()` renders `cellLabel` verbatim and none of the four names a
//   year in it.
//
//   One refinement to that, added when the Charlotte gap below was closed:
//   Charlotte's asOf still dates the UDO READ, and the statute that will void
//   its minimums carries its OWN dates inside the copy (ratified 2026-07-01,
//   effective 2027-01-01) rather than being folded into asOf. Collapsing a
//   future effective date into a single as-of marker is exactly the rule-7
//   failure — one date cannot mean both "we read this then" and "this dies
//   then", and a reader cannot tell which was intended.
//
//   ✅ THE CHARLOTTE OPEN GAP IS CLOSED (resolved 2026-08-08 from the primary
//   source). The prior note recorded that North Carolina had reportedly
//   preempted local parking minimums but that the session-law number, effective
//   date and operative text had not reached this file, so nothing about
//   preemption was allowed into user-facing copy. All three are now read and
//   quoted, and the Charlotte `detail` below states the statute.
//
//   HOW IT WAS FOUND, so the path is reproducible (rule 8 — read indexes, never
//   guess a bill URL). ncleg.gov's own nav → "Bills & Laws" (/Legislation) →
//   "Session Laws" (/Laws/SessionLaws). That index carries all 57 enacted 2026
//   session laws with titles; exactly two mention parking, and only one touches
//   minimums. The prior research's negative finding is CONFIRMED: House Bill 369
//   ("Parking Lot Reform/Stormwater Control") never passed — its bill page shows
//   "Last Action: Re-ref Com On Rules and Operations of the Senate on 6/10/2026".
//   H162 carries the identical subject pairing and IS the enacted vehicle.
//
//   SESSION LAW 2026-39 (House Bill 162),
//   ncleg.gov/EnactedLegislation/SessionLaws/HTML/2025-2026/SL2026-39.html —
//   "AN ACT to restrict local governments from regulating certain aspects of
//   OFF-STREET parking spaceS and to modify the authority of certain local
//   governments to require STORMWATER control for REDEVELOPed property."
//   Ratified 1 July 2026; "Approved 3:04 p.m. this 6th day of July, 2026".
//   Sec. 1(a) adds subdivision (2a) to G.S. 160D-702(c), whose chapeau reads "A
//   zoning or other development regulation shall not do any of the following".
//   Sec. 1(b): "This section becomes effective January 1, 2027."
//
//   THREE LIMBS CHECKED AGAINST PRIMARY SOURCES RATHER THAN ASSUMED:
//   1. The carve-out is GEOGRAPHIC ONLY — there is no use, district-type or
//      population threshold. Subdivision (2a)'s second sentence exempts "local
//      governments located in the coastal area, as those terms are defined under
//      G.S. 113A-103", then carves BACK IN three classes of historic property
//      inside the coastal area. Note the double negative: for coastal historic
//      properties the ban still applies. Neither limb reaches Charlotte.
//   2. Mecklenburg is not coastal. Read from the statute, not from the research:
//      G.S. 113A-103(2) defines "Coastal area" as "the counties that (in whole
//      or in part) are adjacent to, adjoining, intersected by or bounded by the
//      Atlantic Ocean … or any coastal sound", illustrating with 20 named
//      counties as of 2012-07-01. Mecklenburg is in neither the definition nor
//      the list.
//   3. IT IS NOT YET IN FORCE, and that is verified rather than inferred from
//      the effective-date line alone. The live text of G.S. 160D-702(c) pulled
//      2026-08-08 from ncleg's own statutes (ByChapter/Chapter_160D.html) still
//      lists only subdivisions (1)–(4) — none about space counts — with credits
//      ending at 2025-94. So Article 19's minimums genuinely BIND TODAY and
//      become unenforceable 2027-01-01. Both facts have to render, because a
//      project sized today files its permit next year (rule 5: an answer and a
//      gap must not look alike; here, a live rule and a dead one must not).
//
//   SCOPE, argued from the statute's own structure (rule 5's slot test) rather
//   than from what would be convenient: SL 2026-39 amends only G.S. 160D-702(c),
//   a closed list of things a development regulation "shall not do". Nothing in
//   that list concerns parking MAXIMUMS, so Charlotte's Tier 2/Tier 3 maximums
//   survive the preemption and the copy below says so.
//
//   TWO THINGS DELIBERATELY NOT ASSERTED, because the sources do not settle them:
//   · PERMITS ALREADY FILED. The act is SILENT. This is a measured silence, not
//     an unread one: Part II (stormwater) carries an express applicability
//     clause — Sec. 2(c) "applies to stormwater rules and stormwater program
//     amendments adopted on or after that date" — while Part I carries none. The
//     drafters knew how to write one and did not attach it here. That is
//     evidence the act does not speak to pending permits; it is NOT evidence of
//     how they are treated, and no direction is given (rule 1).
//   · BICYCLE PARKING. Sec. 19.4's bicycle minimums are a separate requirement
//     and (2a) speaks of "an off-street parking lot … minimum number of parking
//     spaces". Nothing read settles whether bicycle spaces fall inside that
//     phrase, so the copy neither claims nor denies it.
//
//   ⚠️ SCHEDULED EXPIRY — THIS ENTRY GOES STALE ON A KNOWN DATE. On 2027-01-01
//   Charlotte's `status` becomes wrong by operation of state law, and so does
//   every other North Carolina city in this registry. Raleigh's status does not
//   change (already 'abolished') but its note deserves the statute.
//
//   THREE INSTRUMENTS GUARD THIS ENTRY, in `parkingRules.test.ts`, deliberately
//   as three separate tests so that which one is red tells you what broke:
//     1. the DATE TRIPWIRE — red from 2027-01-01 unless `status` has moved to
//        'abolished'. It answers "has the clock run out?".
//     2. the CITATION PIN — red if this copy stops resting on SL 2026-39 (H162)
//        § 1(a) / G.S. 160D-702(c)(2a), or loses the operative sentence, or
//        flattens the coastal carve-out away from its historic-property
//        counter-exception, or names any other bill or session law. It answers
//        "is the authority under this copy still the one that was read?".
//     3. the EARLY RE-VERIFICATION TRIPWIRE — red from 2026-11-01, two months
//        of lead time before the flip, instructing a fresh read of ncleg.gov.
//
//   ⚠️ AND HERE IS WHAT NONE OF THE THREE CAN DO. No test in this repo can see
//   ncleg.gov, so none of them can detect the General Assembly amending or
//   repealing SL 2026-39 — the failure that would matter most is the one that
//   is structurally invisible from inside. This is rule 9 stated against our own
//   guard rather than against someone else's code: internal verification checks
//   that the copy matches what was read, never that what was read is still true.
//   The pin's value is narrower and worth being precise about: it makes the two
//   failure modes distinguishable, and it stops the claim being quietly re-based
//   on a different authority. It is not evidence about the law.
//
//   The reason the pin exists at all is that the date tripwire ALONE is a
//   wrong-direction hazard. If H162 were amended before 2027-01-01, the date
//   test would still fire on schedule and still instruct the reader to flip
//   Charlotte to 'abolished' — our own guard handing out a confident correction
//   in the wrong direction, which is rule 7's shape.
//
//   ✅ RESOLVED 2026-08-09 — and the Charlotte note is how it was found. This
//   said: if Charlotte ever enters the Red Tape Index, fix `parkingCell()`
//   first, because it renders the literal string 'Near transit only' for EVERY
//   'partial', and Charlotte's mechanism is the district tier, not transit
//   proximity. Charlotte's was called a LATENT wrong claim because it has no
//   lifecycle constants. Measuring the other fourteen showed it was already
//   LIVE for five ranked cities — Nashville (Urban Zoning Overlay), Philadelphia
//   (CMX-4/CMX-5), NYC (Manhattan core), Boston (affordable housing), DC
//   (downtown first) — plus Milwaukee, Columbus and Atlanta latent alongside
//   Charlotte. `parkingCell()` no longer branches on status at all; every city
//   carries its own `cellLabel`, checked by test against its own headline.

import { CITIES } from './cities'

export interface ParkingRule {
  status: 'abolished' | 'partial'
  /** Short, scannable summary for the SiteFacts headline. */
  headline: string
  /**
   * The Red Tape Index's parking column, in THIS city's own words.
   *
   * ⚠️ WHY THIS FIELD EXISTS, AND WHY IT IS REQUIRED. `parkingCell()` used to
   * derive the column from `status`: 'abolished' rendered its as-of date and
   * EVERYTHING ELSE rendered the literal string 'Near transit only'. That is a
   * mechanism claim, and it was false for most of the cities it was drawn for —
   * Nashville's trigger is the Urban Zoning Overlay, Philadelphia's is the
   * CMX-4/CMX-5 districts, NYC's is Manhattan, Boston's is the project being
   * income-restricted, DC's is downtown first and transit second. Roughly half
   * the published column asserted a mechanism its own city does not use.
   *
   * A longer status enum would only move the defect one level out: the next
   * city with a mechanism nobody enumerated lands in whatever branch is last.
   * So the label is DATA, per city, not a function of the status — and because
   * it is a required property of this interface, a new city cannot be added
   * without one. It cannot silently fall through to a default, because there is
   * no default to fall through to (CLAUDE.md rule 14: convert a caught error
   * into an impossible state, not a comment).
   *
   * THE STANDING CONSTRAINT, enforced by test in both `parkingRules.test.ts`
   * and `redTapeIndex.test.ts`: every word here must also appear in `headline`.
   * The cell may SHORTEN the verified headline; it may not add to it. That is
   * what makes the label traceable to the source read for this city rather than
   * to a category someone assigned it. Shorten by dropping a citation
   * ("(AB 2097)") — never by dropping a qualifying clause, because
   * "None required" without "minimums remain elsewhere" is the same class of
   * error one notch smaller. The full headline rides along in the cell's
   * `title` attribute, so nothing is lost to the reader either way.
   */
  cellLabel: string
  /** 1–2 sentence plain-English version of the rule. */
  detail: string
  /** As-of date for the underlying source. */
  asOf: string
}

export const PARKING_RULES: Record<string, ParkingRule> = {
  minneapolis: {
    status: 'abolished',
    headline: 'No parking minimums — abolished citywide (2021)',
    cellLabel: 'Abolished citywide (2021)',
    detail:
      'Minneapolis abolished off-street parking minimums citywide in 2021 under its 2040 plan. No parking is required for any project; you can still build it, but you’re no longer forced to.',
    asOf: '2021',
  },
  sf: {
    status: 'abolished',
    headline: 'No parking minimums — abolished citywide (2018)',
    cellLabel: 'Abolished citywide (2018)',
    detail:
      'San Francisco removed off-street parking minimums citywide in 2018 (Ordinance 286-18). None are required anywhere in the city; parking is optional and demand-driven.',
    asOf: '2018',
  },
  austin: {
    status: 'abolished',
    headline: 'No parking minimums — abolished citywide (2023)',
    cellLabel: 'Abolished citywide (2023)',
    detail:
      'Austin abolished parking minimums citywide in 2023. No off-street parking is required for any use; you decide how much to build.',
    asOf: '2023',
  },
  denver: {
    status: 'abolished',
    headline: 'No parking minimums — abolished citywide (2025)',
    cellLabel: 'Abolished citywide (2025)',
    detail:
      'Denver removed all parking minimums — every use, every zoning district — effective August 11, 2025. No off-street parking is required anywhere in the city.',
    asOf: 'Aug 2025',
  },
  chicago: {
    status: 'partial',
    headline: 'None required near transit; minimums remain elsewhere',
    cellLabel: 'None required near transit; minimums remain elsewhere',
    detail:
      'Chicago’s July 2025 ordinance (effective Sept 25, 2025) allows zero parking by-right in Transit-Served Locations — within ½ mile of CTA/Metra rail or ¼ mile of key bus corridors, covering about 74% of the city in all districts except Downtown. Minimums still apply outside those areas.',
    asOf: 'Sept 2025',
  },
  nyc: {
    status: 'partial',
    headline: 'Eliminated in Manhattan core; reduced or unchanged elsewhere',
    cellLabel: 'Eliminated in Manhattan core; reduced or unchanged elsewhere',
    detail:
      'NYC’s City of Yes for Housing Opportunity (Dec 2024) eliminated minimums in Zone 1 (Manhattan outside Inwood, plus Long Island City and parts of western Queens/Brooklyn), reduced them in transit-rich Zone 2, and largely kept them in Zone 3. ADUs, conversions, and transit-oriented development are exempt citywide.',
    asOf: 'Dec 2024',
  },
  seattle: {
    status: 'partial',
    headline: 'None required in urban centers and transit areas',
    cellLabel: 'None required in urban centers and transit areas',
    detail:
      'Seattle requires no parking minimums inside urban centers/villages and frequent-transit areas, which cover much of the buildable city. Minimums remain elsewhere — confirm whether your parcel falls inside one.',
    asOf: '2026-06-10',
  },
  la: {
    status: 'partial',
    headline: 'None required within ½ mile of major transit (AB 2097)',
    cellLabel: 'None required within ½ mile of major transit',
    detail:
      'Under California AB 2097 (effective 2023), no parking minimums apply within ½ mile of a major transit stop anywhere in the state, including much of Los Angeles. Minimums remain elsewhere in the city.',
    asOf: '2023',
  },
  boston: {
    status: 'partial',
    headline: 'None for affordable housing; reduced near transit',
    cellLabel: 'None for affordable housing; reduced near transit',
    detail:
      'Boston eliminated parking minimums for income-restricted affordable housing in 2021 and has cut them broadly near transit. Most districts still set a ratio, so confirm the requirement for your zone — every space adds significant cost.',
    asOf: '2021',
  },
  dc: {
    status: 'partial',
    headline: 'Eliminated downtown; cut near transit; minimums remain elsewhere',
    cellLabel: 'Eliminated downtown; cut near transit; minimums remain elsewhere',
    detail:
      'Washington, DC’s 2016 zoning regulations eliminated parking minimums downtown and cut them roughly in half near frequent transit. Minimums remain in the rest of the city.',
    asOf: '2016',
  },
  nashville: {
    status: 'partial',
    headline: 'None required in the Urban Zoning Overlay or downtown',
    cellLabel: 'None required in the Urban Zoning Overlay or downtown',
    detail:
      'Metro eliminated parking minimums inside the Urban Zoning Overlay in 2022 and converted the old minimums into maximums; downtown has never had parking requirements at all. The UZO runs roughly from East Nashville to I-440 and Hillwood to South Nashville. Minimums under Metro Code Ch. 17.20 still apply outside it.',
    asOf: '2022',
  },
  sanjose: {
    status: 'abolished',
    headline: 'No parking minimums — abolished citywide (2023)',
    cellLabel: 'Abolished citywide (2023)',
    detail:
      'San Jose removed off-street parking minimums citywide when the Council adopted the Parking and Transportation Demand Management Standards Ordinance in December 2022 (effective spring 2023) — the largest US city to do so. Transportation-demand-management requirements were added in exchange. No parking is required for any project.',
    asOf: '2023',
  },
  sandiego: {
    status: 'partial',
    headline: 'None required near transit (AB 2097 + city Transit Priority Areas)',
    cellLabel: 'None required near transit',
    detail:
      'Two rules stack. San Diego Ordinance O-21057 (March 2019) set zero minimum parking for multifamily housing in Transit Priority Areas, and O-21041 (Jan 2022) removed minimums for many commercial uses there. Statewide, California AB 2097 (Jan 2023) independently bars any minimum within a half mile of a major transit stop. Parking is market-determined across the transit-served majority of the city.',
    asOf: '2023',
  },
  miami: {
    status: 'partial',
    headline: 'Reduced near transit and in TOD areas; minimums remain elsewhere',
    cellLabel: 'Reduced near transit and TOD areas; minimums remain elsewhere',
    detail:
      'Miami 21 still sets parking minimums, but reductions apply in Transit Oriented Development areas and Transit Corridors in the T4, T5 and T6 transects, and a 20% reduction is available near Metrorail, Metromover, and Transit Corridor bus stops. A broader elimination along transit corridors was proposed in 2025 but is not adopted citywide.',
    asOf: '2025',
  },
  philadelphia: {
    status: 'partial',
    headline: 'Eliminated for housing in CMX-4/CMX-5; minimums remain elsewhere',
    cellLabel: 'Eliminated for housing in CMX-4/CMX-5; minimums remain elsewhere',
    detail:
      'Bill 250524, signed June 2025, removed the on-site parking requirement for new residential development in the CMX-4 and CMX-5 districts — mainly Center City, University City, and North Broad — replacing a ratio of three spaces per ten dwelling units. Minimums still apply in the rest of the city.',
    asOf: '2025',
  },
  raleigh: {
    status: 'abolished',
    headline: 'Abolished citywide — the UDO sets parking maximums, not minimums',
    cellLabel: 'Abolished citywide — UDO sets maximums, not minimums',
    detail:
      'The Raleigh Unified Development Ordinance requires no vehicle parking anywhere, for any use. Sec. 7.1.1 states it outright — “No parking is required for vehicles, but this code regulates the design and other aspects of any vehicular parking spaces that are provided” — and the parking table in Sec. 7.1.2.C carries a “Vehicle Parking (max)” column with no minimum counterpart. The code caps parking instead: no more than 2 spaces per dwelling unit downtown (DX-) or in a Transit Overlay (-TOD), 1.5 for studios and one-bedrooms, and projects over 16 units that exceed the table trigger mitigation under Sec. 7.1.4. Bicycle parking minimums do still apply.',
    // The date the ordinance text was read, NOT a reform year — see the source
    // note at the top of this file for why no year is asserted.
    asOf: '2026',
  },
  milwaukee: {
    status: 'partial',
    headline: 'None downtown (except C9A) or for 1–2 family; minimums remain elsewhere',
    cellLabel: 'None downtown (except C9A) or 1–2 family; minimums remain elsewhere',
    detail:
      'Milwaukee keeps parking minimums. Chapter 295 removes them in three places and nowhere else: “Except for within the C9A district, no off-street motor vehicle parking spaces shall be required for uses located in downtown zoning districts. Furthermore, no off-street motor vehicle parking spaces shall be required for uses located in a RED redevelopment district” (Milwaukee Code s. 295-403-2-a), and Table 295-403-2-a sets single-family, two-family and attached single-family dwellings at “no min.; max. of 4 spaces” with accessory dwelling units at “none”. Everything else carries a ratio: multi-family is 1 space per dwelling unit in RM1–RM4, RO1, NS1, LB1 and RB1, and 2 spaces per 3 units in RT4, RT5, RM5–RM7, RO2, NS2, LB2, LB3, RB2, CS, C9A and IM. Note the shape of the downtown carve-out rather than flattening it into “downtown is exempt” — C9A, the one downtown district excluded from it, is the high-density residential one, so the district whose primary product is apartments is also the one still owing spaces. A 25% reduction is available where any ONE of three criteria is met, and the second is close to citywide coverage: being within 1,000 feet of any regularly scheduled local bus stop (s. 295-403-2-b-4).',
    asOf: '2026',
  },
  columbus: {
    status: 'partial',
    headline: 'None required in the 2024 Zoning Code districts or downtown; minimums remain elsewhere',
    cellLabel: 'None in 2024 Zoning Code districts or downtown; minimums remain elsewhere',
    detail:
      'Columbus runs two zoning codes at once and they disagree about parking. Under the 2024 Zoning Code (Title 34, the “Zone In” rewrite) there is no minimum at all — “No minimum vehicular parking is required for Mixed-Use Zoning District designations outlined in this Chapter” (C.C. Title 34 § E.20.030.E.1) — and that covers every district the new code has, because Chapter E.20 is the only district chapter in Title 34. Downtown has never had them on the Title 33 side either: “There are no requirements for off-street parking within the downtown district” (C.C. 3359.27). But most of the city is still governed by Title 33, where C.C. 3312.49 Table 2 requires 2 spaces per unit for 1, 2 or 3 dwelling units and 1.5 per unit for 4 or more, with accessory dwelling units “N/A”. The Short North and East Franklinton Special Parking Areas halve the non-residential requirement and set two-, three- and multi-unit dwellings at 1 space per unit, with no variance available from the Board of Zoning Adjustment or City Council (C.C. 3312.051.C, 3312.053.C). One cross-code trap worth knowing: C.C. 3304.03(F) lists Chapter 3312 among the Title 33 chapters that apply to the 2024 Zoning Code, which reads as though the minimums reach Title 34 parcels. They do not — Title 34 imports 3312’s design provisions only, and 3312 says so from its own side: “For parcels with a 2024 Zoning Code district designation, vehicular parking is not required” (C.C. 3312.55.B).',
    asOf: '2026',
  },
  charlotte: {
    status: 'partial',
    headline: 'Tiered by district today — state law voids all minimums Jan 1, 2027',
    cellLabel: 'Tiered by district today — state law voids all minimums Jan 1, 2027',
    detail:
      'Charlotte sets parking minimums through a three-tier district map rather than one citywide rule. “Tier 1: A minimum number of off-street parking spaces are required. There are no off-street parking space maximums… Tier 3: A minimum number of off-street parking spaces are required for a limited number of uses and locations, but most uses do not have a minimum parking requirement” (Charlotte UDO Sec. 19.2.A.1), and “Where a cell is blank and shaded, no minimum and/or maximum parking is required” (Sec. 19.2.A.3). Measured rather than paraphrased: the Tier 3 Minimum column of Table 19-1 is blank in 99 of the 105 use rows, and the six that carry one are themselves conditional — that column’s header reads “Minimum / Applies only when within 400\' walking distance of a Neighborhood 1 Place Type”. Tier 1 covers Neighborhood 1 districts, N2-A, MHP, ML-1, ML-2, IC-1, OFC and OG; Tier 2 covers N2-B, N2-C, IMU, IC-2, RC, NC, CAC-1, CG and CR; Tier 3 covers CAC-2, TOD-UC, TOD-NC, TOD-CC, TOD-TR, RAC, UC and UE. Residential runs 1 space per unit in Tier 1, 1 per unit with a 2-per-unit maximum in Tier 2, and no minimum with a 2-per-unit maximum in Tier 3. Two routes out: Tier 3 minimums “may be reduced or eliminated upon Planning Director approval of a Parking Demand Management Assessment” (Sec. 19.2.A.1.c.i), and “Any property within one-half mile walking distance of an existing rapid transit station may use the Tier 3 parking standards, unless the property is located in a Neighborhood 1 Place Type” — an all-or-nothing election that brings the maximums across with it (Sec. 19.2.H). All of it is on a clock. North Carolina Session Law 2026-39 (House Bill 162), ratified July 1 and signed July 6, 2026, adds subdivision (2a) to G.S. 160D-702(c) — a list of things a “zoning or other development regulation shall not do” — reading in full: “Require an off-street parking lot to meet a minimum number of parking spaces per development or structure, regardless of occupancy or use. The limitations of this subdivision shall not, however, apply to local governments located in the coastal area, as those terms are defined under G.S. 113A-103, except with respect to the following properties located in the coastal area:” followed by three classes of historic property. There is no use, district-type or population threshold — the only carve-out is geographic, and it does not reach Charlotte, because G.S. 113A-103(2) defines the coastal area as the counties “adjacent to, adjoining, intersected by or bounded by the Atlantic Ocean … or any coastal sound” and Mecklenburg is not one of them. Section 1(b) of the act says “This section becomes effective January 1, 2027”, so the tiered minimums above genuinely bind today: the currently published text of G.S. 160D-702(c) still lists only four prohibitions, none of them about space counts. The act says nothing about permits already filed. Parking maximums are untouched — nothing in G.S. 160D-702(c) restricts them — so Charlotte’s Tier 2 and Tier 3 maximums survive January 1.',
    asOf: '2026',
  },
  atlanta: {
    status: 'partial',
    headline: 'None near high-capacity transit, in the BeltLine Overlay, or in pre-1965 buildings',
    cellLabel: 'None near high-capacity transit, BeltLine Overlay, or pre-1965 buildings',
    detail:
      'Atlanta still sets minimums in its base districts — § 16-08.010 is titled “Minimum off-street parking requirements” and states ratios per dwelling unit — but § 16-28.014 removes them in three sweeping cases. Within 2,640 feet of a high-capacity transit stop, “No parking is required” (§ 16-28.014(14)(a)); the distance is measured along a public or private sidewalk, walkway or street, and “When any portion of a lot is within the applicable distance, the entire lot shall be subject to this requirement” (sub-(h)). For buildings built before 1965, “Residential uses: No parking is required” — and non-residential too, except a business establishment over 1,200 square feet holding an alcoholic beverage licence (§ 16-28.014(13)). And inside the BeltLine Overlay “there will be no minimum parking requirement”, except for commercial food preparation, delivery-based commercial kitchens and eating and drinking establishments, which follow the underlying zoning (§ 16-36.020(1)). The transit rule trades the minimum for a maximum: 1.25 spaces per one-bedroom unit and 2.00 per two-or-more-bedroom unit, with R-1 through R-5 exempt from the cap. The three areas the transit rule excepts — the Buckhead Parking Overlay, special public interest districts, and historic or landmark districts with parking maximums — do NOT put minimums back; they carry their own tables, and those read “None” for residential (SPI-1 Downtown § 16-18A.015, SPI-16 Midtown § 16-18P.020 Table 7, Buckhead Parking Overlay § 16-38.003).',
    asOf: '2026',
  },

  // ── The 2026-08-09 cohort: dallas, lasvegas, phoenix ─────────────────────
  // All three read from the ordinance of record on 2026-08-09. `asOf: '2026'`
  // is the READ DATE in all three, not a reform year — the Raleigh/Charlotte
  // convention. Where a city's own text names a date, it rides inside `detail`
  // in that text's words rather than being promoted into `asOf`.

  dallas: {
    status: 'partial',
    headline:
      'None for most uses; multifamily over 20 units and R, D or TH homes still need spaces',
    cellLabel: 'None for most uses; multifamily over 20 and R/D/TH homes still need spaces',
    detail:
      'Dallas rewrote its off-street parking rules into a single summary table, and the default across most of it is zero. Table 1.0.1 in § 51A-4.301(a)(2)(A) reads "None for any use" for agricultural, lodging, miscellaneous and recreation uses; "When not listed, no parking is required" for institutional, residential and retail uses; "no minimum off-street parking requirements for any use in these categories" for transportation, utility and public service, wholesale/distribution/storage and accessory uses; and for office uses, "When in MD-1, see Table 1.2; Otherwise, none." What survives is specific, and it is where housing lives. Multifamily: "≤ 20 units: None; 21 to 199 units: 0.5 space per dwelling unit; ≥ 200 units: 1 space per dwelling unit", plus guest parking at 10% of required spaces for 20-99 units and 15% for 100 or more. Single-family: "R, D, and TH districts: 1; Otherwise: None." Duplex: "D and TH districts: 1 space per unit; Otherwise: None." Named retail uses keep ratios — alcoholic beverage establishments at 1 space per 200 SF of retail sales and seating, restaurants at 1 space per 200 SF above the first 2,500 SF, commercial amusement at 1 per 200 SF — and churches over 20,000 SF and 9th-12th grade schools keep theirs. Table 1.1 puts minimums back for commercial and industrial uses "contiguous to a single family district with a single family or handicapped group dwelling unit use", at 1 space per 500 to 1,000 SF. Table 1.2.1 keeps the older ratios inside "the MD-1 Overlay in existence since May 14, 2025". Running the other way, § 51A-4.301(a)(2)(B) zeroes everything: "Except when located within the MD-1 Overlay in existence since May 14, 2025, no parking is required for any use if any portion of the lot or established building site containing the use is: (i) within 2,640 feet of a light rail or streetcar station; (ii) in a central area district; or (iii) located on a property designated as a recorded Texas historic landmark, state antiquities landmark, national historic landmark, national register district, or in a local historic district or landmark." A development with no on-site parking still owes one accessible space on site or within 200 feet, or an approved accessible drop-off (§ 51A-4.301(a)(2)(C)). Where a minimum does bind, § 51A-4.311(a) lets the board of adjustment cut it by up to 25 percent on a parking-demand finding — 35 percent for office, 75 percent for commercial amusement (inside) and industrial (inside) — and § 51A-4.313 offers an administrative reduction; the two may not be combined, and the greater applies. Read 2026-08-09 from the code of record; § 51A-4.301’s ordinance history ends at Ord. 33112.',
    asOf: '2026',
  },

  lasvegas: {
    status: 'partial',
    headline:
      'Minimums remain citywide; only the downtown Form-Based Code cuts them, to 30–40% of the base ratio, and it adds a maximum',
    cellLabel: 'Minimums remain citywide; only the downtown Form-Based Code cuts them to 30–40%',
    detail:
      'Las Vegas has not abolished parking minimums. LVMC 19.12.060(A) sends every use to the per-use requirement in 19.12.070, and those are real ratios: "Residential, Single Family, Detached — On-site Parking Requirement: Two spaces per dwelling unit", and for "Residential, Multi-Family", parking is "Calculated by the capacity of each unit as described below, plus one additional guest space for every 6 units spread throughout the development: 1. Studio and One Bedroom Units – 1.25 spaces per unit. 2. Two Bedroom Units – 1.75 spaces per unit. 3. Three Bedroom and Above Units – Two spaces per unit." The reform is geographic and partial: 19.12.060(C) says "Parking requirements for a use within a Form-Based zoning district shall follow the provisions of LVMC 19.09.100.G", and 19.09.100.G Table G-1 replaces the flat minimum with a RANGE keyed to the Downtown Parking Load Map — Low Load (Zone 1) "Min. 30% and Max. 60% of the parking requirement indicated in LVMC Section 19.12.060 for the use", Medium Load (Zone 2) 35%/65%, High Load (Zone 3) 40%/70%. So downtown the minimum falls to roughly a third of the citywide figure AND a maximum appears where none existed. 19.09.100.G.1 also exempts "The first 2,000 square feet of Gross Floor Area (GFA) of nonresidential uses" from the calculation, and 19.09.100.G.2 allows further reduction under LVMC 19.18.030.D.4 (Parking Alternatives). The Form-Based Code covers 866.9 of the city’s 76,917 zoned acres — 1.1% — so the reduced regime applies downtown and nowhere else. Read 2026-08-09 from the publisher the City’s own Zoning Code page links by name (online.encodeplus.com/regs/lasvegas-nv), chapter exports tocid 001.010 and 001.008; Table G-1 was read from the section-level HTML rather than flattened PDF text, because the Form-Based Code tables are graphic-heavy and their columns bleed when flattened.',
    asOf: '2026',
  },

  phoenix: {
    status: 'partial',
    // "five named districts" is not a summariser's rounding — § 702.E.3 names
    // them exhaustively and there are five. The enumeration is in `detail`.
    headline:
      'Minimums citywide; reductions only in five named districts — Downtown, Walkable Urban, Urban Residential and TOD-1/TOD-2',
    cellLabel: 'Minimums citywide; reductions only in five named districts',
    detail:
      'Phoenix requires off-street parking for every use citywide. Section 702.C’s table sets "Dwelling Unit, Multi-family: 1.5 spaces per dwelling unit" — plus "a minimum of 0.25 spaces per dwelling unit … as unreserved spaces when the lot has five or more dwelling units" — and 2 spaces per primary dwelling unit for both single-family detached and single-family attached, the attached case adding 0.25 unreserved visitor spaces. Section 702.E.3 names the ONLY districts that offer a reduction, and names them exhaustively: "Parking reductions are specified within the specific zoning districts. The listed zoning districts offer parking reductions: a. Downtown Code. Per sustainability bonus awards. (Chapter 12) b. Walkable Urban (WU) Code. (Chapter 13) c. Urban Residential District. (Section 642) d. Interim Transit-Oriented Zoning District One (TOD-1). (Section 662) e. Interim Transit-Oriented Zoning District Two (TOD-2). (Section 663)". The other reductions in Section 702.E are discretionary rather than by-right — buildings over four stories or 48 feet (702.E.4), uses in general-plan village cores (702.E.5) and special-needs housing (702.E.6) all require the Zoning Administrator or the Board of Adjustment to grant them, and shared-parking reductions above 15% need a use permit (702.E.2.c). None of those is a district where parking is simply not required. Read 2026-08-09 from § 702 of the ordinance itself.',
    asOf: '2026',
  },
}

/**
 * Live cities whose parking ordinance has NOT been read, and which therefore
 * carry no rule above.
 *
 * Derived, never hand-listed — exactly `CITIES` minus the keys of
 * `PARKING_RULES`, the same construction as
 * `redTapeIndex.citiesWithoutProcessConstants`. A city that gains a rule drops
 * off this list the moment the table is edited, and a typo in a slug cannot
 * masquerade as a disclosed gap.
 *
 * ⚠️ THIS FUNCTION EXISTS BECAUSE ADDING AN HONEST GAP BROKE A GREEN TEST, and
 * the break was correct. `parkingRules.test.ts` asserted that every slug in
 * `CITIES` has a rule — an invariant that was true only because every city so
 * far had had its ordinance read. The two ways to make it pass again were to
 * invent four statuses (rule 1) or to drop four cities out of the check
 * quietly (an absence rendering as nothing at all). Both are failures this repo
 * has already recorded, so the invariant was REFORMULATED instead, exactly as
 * `redTapeIndex`'s ranked-or-disclosed invariant was when Raleigh shipped
 * without a lifecycle row: every live city is either RULED or DISCLOSED, never
 * both and never neither.
 */
export function citiesWithoutParkingRule(
  rules: Record<string, ParkingRule> = PARKING_RULES,
): string[] {
  return CITIES.filter((c) => !(c.slug in rules)).map((c) => c.slug)
}
