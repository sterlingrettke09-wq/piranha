import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput, Hurdle } from '../../../src/types/analysis'
import { PARKING_RULES } from '../../../src/config/parkingRules'

// Curated private-governance sites (no public dataset exists for HOAs/covenants).
const PRIVATE_SITES: Array<{ bbox: [number, number, number, number]; label: string; note: string }> = [
  {
    // Louisburg Square, Beacon Hill — privately owned/governed by its proprietors since 1844.
    bbox: [-71.0706, 42.3581, -71.0692, 42.3592],
    label: 'Private square: proprietors’ approval',
    note: 'Louisburg Square is privately governed by its proprietors; private approval and easements almost certainly apply, on top of city process.',
  },
]

function inBox(lng: number, lat: number, b: [number, number, number, number]): boolean {
  return lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3]
}

const FLOOD_OK = new Set(['', 'X', 'AREA OF MINIMAL FLOOD HAZARD', 'AREA NOT INCLUDED'])

// What currently stands on the parcel, as ONE definition. The per-city
// demolition / tenant-protection hurdles below and the generic demolition block
// at the end both ask "is there a building here?" and "is it rental
// multifamily?" — two copies of those regexes would be two places for the same
// claim to drift apart (ledger rule 9's boundary problem, in miniature).
function existingStructure(parcel: ParcelInfo) {
  const ex = parcel.existing
  const exUnits = ex?.units ?? 0
  const lu = ex?.landUse ?? ''
  const vacantOrUnbuilt = /vacant|parking|open space|outdoor|undevelop/i.test(lu)
  const hasBuilding =
    !!ex && ((ex.buildingAreaSqFt ?? 0) > 0 || exUnits > 0 || (ex.numBuildings ?? 0) > 0 || (!!lu && !vacantOrUnbuilt))
  // Word-boundaried "multifamily" — NOT bare "multi", which wrongly matched
  // commercial labels like "COMM MULTI-USE" (same fix as feasibility.ts).
  const multifamilyExisting =
    !!ex && (exUnits >= 3 || /apartment|condo|multi-?family|townhouse|triplex|fourplex|housing/i.test(lu))
  // Rental-multifamily test for the tenant-protection teardown hurdles.
  // Floor is exUnits >= 2 (a duplex is already "rental multifamily" for RSO /
  // Rent-Ordinance purposes), OR the same word-boundaried landUse regex
  // feasibility.ts uses — NOT bare "multi" (would match "COMM MULTI-USE").
  const rentalMultifamily =
    !!ex && (exUnits >= 2 || /apartment|condo|multi-?family|triplex|fourplex|elevator|tenement|\bflats\b/i.test(lu))
  return { ex, exUnits, lu, hasBuilding, multifamilyExisting, rentalMultifamily }
}

// The body that reviews exterior changes / new construction in a designated district.
const HISTORIC_BODY: Record<string, string> = {
  boston:
    'Exterior work and new construction need a Certificate of Design Approval from the Boston Landmarks Commission (or the relevant local historic district commission) before permits issue.',
  nyc:
    'Exterior work and new construction need a Certificate of Appropriateness (or permit) from the NYC Landmarks Preservation Commission before the Department of Buildings will issue permits.',
  chicago:
    'Exterior work and new construction are reviewed by the Commission on Chicago Landmarks (Historic Preservation Division) before a building permit can issue.',
  sf:
    'Exterior work and new construction need a Certificate of Appropriateness from the San Francisco Historic Preservation Commission under Planning Code Article 10.',
  seattle:
    'Exterior work and new construction need a Certificate of Approval from the district’s review board (under the Seattle Landmarks Preservation Board / special-review-district process) before permits issue.',
  austin:
    'Exterior alteration, removal, or demolition of a designated historic landmark — or of a contributing building in a historic district — needs a Certificate of Appropriateness from the Historic Landmark Commission before permits issue, and so does any new standalone ground-up structure on an (H) landmark property or inside an (HD) district, whether or not a building permit is otherwise required (Austin LDC § 25-11-212(A)–(B); review standards at § 25-11-213(K)). Small work can be signed off administratively — a one-storey ground-floor addition or outbuilding under 600 sq ft, a rear second-storey addition not visible from the street, or a pool, deck or fence — but ground-up new construction is not on that list.',
  dc:
    'Any permit to construct a building or structure in a historic district, or on the site of a historic landmark, is reviewed by the Historic Preservation Review Board — or instead by the U.S. Commission of Fine Arts where the Old Georgetown Act or the Shipstead-Luce Act applies (Georgetown, and sites near the Mall, the Capitol grounds, Rock Creek Park and other federal property). The Mayor has 120 days after the Board receives the referral to make the finding. The DC standard is compatibility, not appropriateness: the permit issues unless the design and the district’s character are found incompatible (D.C. Official Code § 6-1107(b), (c), (f); alterations at § 6-1105).',
  denver:
    'Work on a designated structure for preservation, or on any property inside a designated historic district, needs written approval from the Denver Landmark Preservation Commission or its staff before permits issue — building, demolition, curb cut, encroachment and zoning construction permits alike, plus zone lot amendments (D.R.M.C. §§ 30-6(2)(b), 30-6(3), 30-6(4), 30-6(6)(d)). Staff can administratively approve work that clearly meets the adopted design guidelines; everything else goes to the commission, and demolition of a designated or contributing primary structure requires a public hearing.',
  philadelphia:
    'Alteration or demolition of a historic building, structure, site or object — and alteration, demolition OR new construction anywhere in a designated historic district, not just work on designated buildings — is reviewed by the Philadelphia Historical Commission before permits issue: the gate is the building permit itself, and L&I must forward the application to the Commission before it can issue (Phila. Code § 14-1005(1)–(3), ch. 14-1000). Where the permit involves demolition, L&I also posts a notice on every street frontage within seven days announcing that the property is historic and the application is under Commission review.',
  miami:
    'Work on a parcel inside a designated historic site, historic district or multiple property designation needs a Certificate of Appropriateness before the Building Department will issue any permit — new construction, alteration, relocation and demolition alike (City of Miami Code § 23-6.2(a)–(c)). Minor work gets a standard certificate from the preservation officer within ten calendar days; anything major — and any request to waive or except a Miami 21 requirement — becomes a SPECIAL certificate decided by the Historic and Environmental Preservation Board at a noticed public hearing, with mailed notice to owners within 500 feet. The code carries a shot clock: if the board does not act within 60 calendar days of a complete application (August excluded) the application is deemed approved. Appeals run to the City Commission within 15 days, de novo, for a $525.00 fee. A separate "certificate to dig" is required for ground-disturbing work in a designated archaeological site, zone or conservation area — which covers substantial stretches of the Miami River, Brickell and the Biscayne Bay shoreline.',
  sanjose:
    'Any work in a City Historic District or on a City Landmark — new construction, additions, paving, and demolition, removal or relocation alike — needs a Historic Preservation (HP) permit before it can proceed, and the building official will not issue a building permit until it is in hand (San José Municipal Code § 13.48.210.A, D–E). The decision sits with the Director of Planning, Building and Code Enforcement, advised by the Historic Landmarks Commission, and is appealable to the City Council (§ 13.48.270); where the HP permit is reviewed concurrently with another permit, the Planning Commission or Council decides instead. Work is judged against the design criteria at § 13.48.250.',
  nashville:
    'A parcel inside one of the historic overlay districts listed at Metro Code § 17.36.110 needs a preservation permit from the Metro Historic Zoning Commission before a certificate of zoning compliance can issue — for new construction, exterior alteration, repair, relocation, and demolition in whole or in part (Metro Nashville & Davidson County Code § 17.40.420.A–B; commission powers at § 17.40.410.B–C). Unusually, the code clocks the commission rather than the applicant: it must meet within fifteen working days of a sufficient application, and failure to act within thirty days of a sufficient application is deemed an approval unless both sides agree to extend. Budget roughly a month for the hearing; design revisions to satisfy the district’s guidelines are the real variable.',
  // NOTE — no minneapolis entry on purpose. The Minneapolis research returned a
  // citywide DEMOLITION screen (§§ 599.910, 599.920, encoded below) but no
  // section for historic-district design review, so this city falls through to
  // the generic copy rather than getting an invented body and citation.
  //
  // NOTE — no sandiego entry either. San Diego's research returned a 45-year
  // screening (SDMC § 143.0212) and a Process Four Site Development Permit where
  // a historical resource is present (§ 143.0210(e)(2)) — both encoded in the
  // city branch below — but no section naming a design-review body for a
  // historic district, so it keeps the generic copy rather than an invented one.
}

// Design-review months for the historic hurdle. 3 is the module's standing
// estimate; two cities' research states a different figure — DC's HPRB /
// Commission of Fine Arts path at 4 months (D.C. Official Code § 6-1107) and
// Nashville's Metro Historic Zoning Commission preservation permit at 1 month
// (Metro Code § 17.40.420.A–B), both per docs/HURDLE-PROPOSALS.md. No other city
// gets an override, because no other city's research states one.
const HISTORIC_MONTHS: Record<string, number> = { dc: 4, nashville: 1 }

// Private projects that are large enough to plausibly seek a subsidy/abatement.
const SUBSIDY_NOTE =
  'If you pursue tax abatements, tax-increment financing, or city land, expect added strings: prevailing-wage requirements, minority- and women-owned business (MWBE) participation goals, and extra reporting. Large projects also commonly negotiate Community Benefit Agreements.'

// Projects that actually tap public money/land — the process is mandatory.
const PUBLIC_FUNDING_NOTE =
  'Public funding, tax credits, bonds, or city land bring a defined process: competitive public procurement and bidding, prevailing-wage requirements (federal Davis-Bacon or the state equivalent), minority- and women-owned business (MWBE) participation goals, and ongoing reporting and audits. Expect public-board approvals and a longer pre-construction timeline.'

// Assess non-zoning regulatory hurdles for a project. Boston is fully modeled;
// other cities get the shared overlay + private-governance hurdles for now.
export interface HurdleContext {
  /** The feasibility approval path — discretionary-only hurdles (ULURP,
   *  Chicago PD) fire only on the variance path, since they apply to
   *  discretionary actions, not as-of-right buildings. */
  path?: 'as_of_right' | 'variance' | 'prohibited'
}

// FAIL-CLOSED (2026-08-05). A `required` hurdle is a regulatory claim. When the
// project's floor area (and therefore its unit count) came from `lot × 1.0`
// because no FAR could be resolved, a size-triggered hurdle would be asserting
// that a rule APPLIES on the strength of a placeholder — Boston's Article 80
// 15-unit trigger firing off `lot × 1.0 ÷ 1300` is two assumptions producing a
// legal claim.
//
// Downgraded to 'info', not removed: the rule may well apply, and saying so
// while naming the uncertainty is more useful than silence. Hurdles already
// carrying 'likely' or 'info' are left alone — their own text already hedges.
// `assumed-unconstrained` is NOT downgraded: the code affirmatively imposes no
// FAR there, so the size sits under a stated absence.
function softenSizeDependent(hurdles: Hurdle[], gfaBasis: AnalysisInput['gfaBasis']): Hurdle[] {
  if (gfaBasis !== 'assumed-far-1.0') return hurdles
  return hurdles.map((h) =>
    h.sizeDependent && h.status === 'required'
      ? {
          ...h,
          status: 'info' as const,
          note: `${h.note} ⚠️ This threshold is measured against a placeholder size — no floor-area limit could be resolved for this district, so whether the rule applies here is unconfirmed.`,
        }
      : h,
  )
}

export function assessHurdles(city: string, parcel: ParcelInfo, project: AnalysisInput, ctx: HurdleContext = {}): Hurdle[] {
  const discretionary = ctx.path === 'variance'
  const hurdles: Hurdle[] = []
  const units = project.units ?? 0
  const isResidential = project.use === 'residential' || project.use === 'mixed'
  const isCommercial = project.use === 'commercial' || project.use === 'mixed'
  const existing = existingStructure(parcel)
  const lotSqFt = parcel.lot.sizeSqFt ?? 0
  // A teardown: new construction on a parcel that already carries a building.
  const teardown = project.projectType === 'new' && existing.hasBuilding

  // Historic district — design review (applies in every city we cover).
  if (parcel.overlays.historicDistrict) {
    hurdles.push({
      category: 'historic',
      label: 'Historic district design review',
      status: 'required',
      note: `This parcel is in the ${parcel.overlays.historicDistrict}. ${HISTORIC_BODY[city] ?? 'Exterior changes and new construction require design approval from the local historic-district commission before permits issue.'}`,
      addsMonths: HISTORIC_MONTHS[city] ?? 3,
    })
  }

  // California Coastal Zone — a Coastal Development Permit is required, often with
  // its own environmental review and (in some areas) Coastal Commission appeal.
  if (parcel.overlays.coastalZone) {
    hurdles.push({
      category: 'environmental',
      label: 'Coastal Development Permit',
      serial: true, // runs IN ADDITION to CEQA/entitlement, not nested within it
      status: 'required',
      note: 'This parcel is in the California Coastal Zone. A Coastal Development Permit (city, and appealable to the Coastal Commission) is required, with its own review — this adds significant time and uncertainty.',
      addsMonths: 9,
    })
  }

  // FEMA flood zone.
  const fz = parcel.overlays.floodZone
  if (fz && !FLOOD_OK.has(fz.toUpperCase())) {
    hurdles.push({
      category: 'flood',
      label: `FEMA flood zone ${fz}`,
      status: 'likely',
      note: 'Flood-resistant construction (and possibly elevation or floodproofing) will be required, raising cost.',
    })
  }

  // ---- Project-type-specific requirements (apply in every city). ----
  if (project.projectType === 'adu') {
    hurdles.push({
      category: 'review',
      label: 'ADU-specific rules',
      status: 'likely',
      note: 'Accessory dwelling units have their own size caps, owner-occupancy, and parking rules that vary by city. Confirm the local ADU ordinance.',
    })
  } else if (project.projectType === 'change_of_use') {
    hurdles.push({
      category: 'review',
      label: 'Change-of-use code upgrades',
      status: 'likely',
      note: 'Converting to a new use commonly triggers building-code, accessibility (ADA), and fire upgrades, plus a use review, even without exterior changes.',
    })
  }

  // ---- Per-city policy. Programs are publicly documented; applicability often
  // depends on the specific area/funding, so area-dependent rules are "likely". ----
  if (city === 'boston') {
    if (isResidential && units >= 10) {
      hurdles.push({
        category: 'affordability',
        label: 'Inclusionary (IDP): income-restricted units',
        sizeDependent: true,
        status: 'required',
        note: 'Boston’s Inclusionary Development Policy requires roughly 17% of units be income-restricted (or a payment in lieu) for residential developments of 10+ units (raised from 13% in the 2024 zoning amendment).',
      })
    }
    // Article 80 thresholds verified against bostonplans.org (2026-06-10):
    // Large Project Review at 50,000+ sf; Small Project Review at 20,000–50,000
    // sf OR 15+ dwelling units. The BPDA's review functions moved to the city's
    // Planning Department in July 2024 — same Article 80 process, new letterhead.
    if (project.gfa >= 50000) {
      hurdles.push({
        category: 'review',
        label: 'Article 80 Large Project Review',
        status: 'required',
        note: 'Developments of 50,000+ sq ft undergo Article 80 Large Project Review by the Planning Department (formerly the BPDA), including community meetings and impact studies. For most large Boston projects this is the longest single gate.',
        addsMonths: 9,
      })
    } else if (project.gfa >= 20000 || (isResidential && units >= 15)) {
      hurdles.push({
        category: 'review',
        label: 'Article 80 Small Project Review',
        sizeDependent: true,
        status: 'required',
        note: 'Developments of 20,000–50,000 sq ft — or any project adding 15+ dwelling units — undergo Article 80 Small Project Review by the Planning Department (formerly the BPDA), covering design and climate resilience.',
        addsMonths: 4,
      })
    }
    if (isCommercial && project.gfa >= 100000) {
      hurdles.push({
        category: 'fees',
        label: 'Development impact (linkage) fees',
        status: 'required',
        note: 'Large commercial projects (100,000+ sq ft) pay linkage fees into Boston’s Neighborhood Housing and Jobs Trusts.',
      })
    }
    // Abutter appeals — the real chokepoint for Boston projects that need any
    // discretionary approval (a variance/special permit from the ZBA). Under
    // MGL c.40A §17, any aggrieved abutter may appeal a ZBA decision to the Land
    // Court or Superior Court within 20 days of the decision being filed.
    // Source: Mass. General Laws c.40A §17 (mass.gov/info-details/mass-general-
    // laws-c40a-ss-17; malegislature.gov Chapter 40A Section 17). The pending
    // appeal clouds the permit and routinely stalls financing/construction for
    // 6–18 months even when the developer ultimately prevails. NO addsMonths:
    // an appeal is a RISK, not a certainty — most approvals are never appealed,
    // so baking months into every variance timeline would overstate delay. We
    // surface it as 'info' so it informs without inflating the verdict.
    if (discretionary) {
      hurdles.push({
        category: 'review',
        label: 'Abutter appeal risk (MGL c.40A §17)',
        status: 'info',
        note: 'This project needs a discretionary approval from the Zoning Board of Appeal. Under Massachusetts law (MGL c.40A §17), any aggrieved abutter can appeal the ZBA’s decision to Land Court or Superior Court within 20 days — and that appeal clouds the permit while it’s litigated, routinely adding 6–18 months even when the developer wins. The board approves the large majority of variances it hears; in Boston, the courthouse — not the hearing room — is where projects actually die.',
      })
    }
  } else if (city === 'nyc') {
    if (isResidential && units >= 10) {
      hurdles.push({
        category: 'affordability',
        label: 'Mandatory Inclusionary Housing (MIH)',
        status: 'likely',
        note: 'In MIH areas, new residential of 10+ units must include permanently affordable units (~25–30%) or pay in lieu. Confirm whether the site sits in an MIH area.',
      })
    }
    // ULURP applies to DISCRETIONARY actions (rezonings, special permits) —
    // an as-of-right building of any size never runs it. Previously fired on
    // raw GFA alone, over-penalizing as-of-right NYC projects by 7 months.
    if (project.gfa >= 50000 && discretionary) {
      hurdles.push({
        category: 'review',
        label: 'ULURP: Uniform Land Use Review Procedure',
        status: 'likely',
        note: 'Rezonings, special permits, and large projects run the City’s ~7-month public ULURP (community board → borough president → City Planning → City Council).',
        addsMonths: 7,
      })
      hurdles.push({
        category: 'environmental',
        label: 'CEQR environmental review',
        status: 'likely',
        note: 'Discretionary approvals trigger City Environmental Quality Review, often running in parallel with ULURP.',
      })
    }
  } else if (city === 'sf') {
    if (isResidential && units >= 10) {
      hurdles.push({
        category: 'affordability',
        label: 'Inclusionary affordable housing',
        sizeDependent: true,
        status: 'required',
        note: 'San Francisco requires roughly 12–26% of units be affordable (or a fee) for residential projects of 10+ units.',
      })
    }
    hurdles.push({
      category: 'environmental',
      label: 'CEQA environmental review',
      status: 'likely',
      note: 'The California Environmental Quality Act applies to most discretionary approvals and is a frequent source of delay and litigation.',
      addsMonths: 6,
    })
    hurdles.push({
      category: 'review',
      label: 'Planning Commission / Discretionary Review',
      status: 'likely',
      note: 'SF projects routinely face discretionary review and Planning Commission hearings even when code-compliant.',
      addsMonths: 6,
    })
  } else if (city === 'chicago') {
    if (isResidential && units >= 10) {
      hurdles.push({
        category: 'affordability',
        label: 'Affordable Requirements Ordinance (ARO)',
        status: 'likely',
        note: 'Chicago’s ARO requires ~20% affordable units (or in-lieu fees) for residential projects of 10+ units that need a zoning change, city land, or city financing.',
      })
    }
    // PD designation is a discretionary action; as-of-right projects under the
    // existing zoning don't run it (same reasoning as NYC ULURP above).
    if (project.gfa >= 50000 && discretionary) {
      hurdles.push({
        category: 'review',
        label: 'Planned Development / City Council review',
        status: 'likely',
        note: 'Large projects often require a Planned Development and aldermanic / City Council approval.',
        addsMonths: 6,
      })
    }
  } else if (city === 'seattle') {
    if (isResidential || isCommercial) {
      // seattle.ts fetches the parcel-exact MHA fee area; when present we can
      // say "this parcel IS in an MHA zone" instead of asking the user to check.
      const feeArea = parcel.overlays.feeArea
      hurdles.push(
        feeArea
          ? {
              category: 'affordability',
              label: 'Mandatory Housing Affordability (MHA)',
              status: 'required',
              note: `This parcel is in Seattle's "${feeArea}" MHA area: new development contributes affordable units or pays the MHA fee for that area.`,
            }
          : {
              category: 'affordability',
              label: 'Mandatory Housing Affordability (MHA)',
              status: 'likely',
              note: 'In MHA zones, new development contributes affordable units or pays a fee. Confirm the site is in an MHA zone.',
            },
      )
    }
    // OVER-fire, corrected (2026-08-07) — same shape as San José's TDM gate.
    // SMC 25.05.800.A sorts the minor-new-construction exemption by USE, and it
    // gives each use its own unit of measure: "The construction or location of
    // residential or mixed-use development" is exempt up to "the number of
    // DWELLING UNITS identified in Table A", while "the construction of office,
    // school, commercial, recreational, service, or storage buildings" is exempt
    // up to "the GROSS FLOOR AREA listed in Table B". The section says so
    // explicitly for a building that is both: "residential uses are evaluated
    // according to number of dwelling units, and non-residential uses are
    // evaluated according to square footage of gross floor area." The state
    // provision Seattle's thresholds flex, WAC 197-11-800(1)(b), has the same
    // split — its unit limbs read "four attached or detached single family
    // residential units" and "four multifamily residential units", and its
    // non-residential limb is "an office, school, commercial, recreational,
    // service or storage building with 4,000 square feet of gross floor area".
    // A unit count is therefore a RESIDENTIAL measure in this code; there is no
    // limb under which a wholly commercial or institutional project is screened
    // on units. `units` arrives off the query string independent of `use`
    // (analyze.ts reads them separately), so the unguarded `units >= 20` was
    // applying Table A's residential number to non-residential projects.
    //
    // The floor-area limb is deliberately left UNGUARDED. Table B's own list of
    // buildings — "office, school, commercial, recreational, service or storage"
    // — spans both `commercial` and `institutional` (a school is institutional
    // here), so narrowing it to `isCommercial` would drop institutional projects
    // out of a limb the source plainly covers. That would be an under-fire, and
    // an under-fire never tells the user the rule applies at all.
    //
    // NOT fixed here, recorded instead (never invent a threshold): Table A is a
    // TABLE, not one number — its exempt level varies by zone and by whether the
    // site is inside an Urban Center / Urban Village, and the state limbs above
    // separate single-family from multifamily. The single `20` collapses all of
    // that, so it is right only where Table A happens to read 20. Same for
    // `12000` against Table B: SDCI's own SEPA page publishes 30,000 sq ft for
    // retail-commercial and institutional uses and 65,000 sq ft for offices,
    // lodging, storage and warehouses, so 12,000 is below both figures we can
    // actually cite. Reading the two tables is the fix; guessing at them is not.
    if ((isResidential && units >= 20) || project.gfa >= 12000) {
      hurdles.push({
        category: 'environmental',
        label: 'SEPA environmental review',
        status: 'likely',
        note: 'Washington’s State Environmental Policy Act applies above Seattle’s local exemption thresholds, adding review time. The thresholds are sorted by use: a residential or mixed-use project is screened on its number of dwelling units, and an office, school, commercial, recreational, service or storage building is screened on its gross floor area (SMC 25.05.800.A, Tables A and B). The exempt level varies by zone and by whether the site sits inside an Urban Center or Urban Village, so confirm the figure for this parcel — the numbers this tool applies are approximate.',
        addsMonths: 4,
      })
    }
    // Design review SUSPENDED — rare good news worth surfacing. Verified at
    // seattle.gov/sdci/codes/changes-to-code/2025-design-review-program-changes
    // (2026-06-10): CB 121048 (Sept 26, 2025) made design review voluntary
    // while SDCI writes permanent rules required by state HB 1293; permanent
    // legislation was expected at Council in spring 2026. Status 'info', no
    // months — this REMOVES a board rather than adding one, and the rules are
    // in flux, so we tell the user to confirm at filing.
    if (project.projectType === 'new') {
      hurdles.push({
        category: 'review',
        label: 'Design review: currently suspended',
        status: 'info',
        note: 'Seattle made design review voluntary in September 2025 (Council Bill 121048) while it writes permanent rules to comply with state law HB 1293 — one less board between you and a permit, for now. Permanent replacement rules were due in 2026; confirm the current status when you file.',
      })
    }
  } else if (city === 'austin') {
    // Austin Land Development Code, read from Municode's content API at Supp.
    // No. 173 ("codified through Ordinance No. 20260122-059, effective February
    // 2, 2026"). Section cites below are to that text.

    // ABSENCE, and the headline finding for Austin: no inclusionary mandate at
    // ANY size. Affordability is bought with bonus density, not required.
    if (isResidential) {
      hurdles.push({
        category: 'affordability',
        label: 'No mandatory inclusionary requirement',
        status: 'info',
        note: 'Austin sets no affordable-unit mandate at any project size — there is no unit count or floor area at which income-restricted units become compulsory, and no fee in lieu. Affordability here is voluntary and incentive-based, traded for extra density under the Affordability Unlocked Bonus Program (LDC § 25-1-720(A)). State law is the reason: Tex. Loc. Gov’t Code § 214.905 bars a Texas city from capping the sale price of privately built housing, while expressly preserving voluntary bonus programs.',
      })
    }

    // ABSENCE: site plan approval is administrative. Size alone never buys you
    // a public hearing in Austin.
    hurdles.push({
      category: 'review',
      label: 'Site plan review is administrative — no discretionary hearing by default',
      status: 'info',
      note: 'Austin site plans are approved by staff, not by a board. Land Use Commission review — the public hearing — fires on exactly three things: a conditional use, development in a Hill Country Roadway Corridor, or where another code section requires it (LDC § 25-5-142; site plan requirement at § 25-5-1, director approval at § 25-5-112(A)). Project size is not on that list, so size alone never sends you to a hearing — there is no Austin analogue to Boston’s Article 80 or San Francisco’s Discretionary Review.',
    })

    hurdles.push({
      category: 'fees',
      label: 'Street impact fee',
      status: 'required',
      note: 'All new development inside the city limits pays Austin’s street impact fee, assessed at final plat approval (or at building permit where no plat is required) and collected when the building permit issues — LDC §§ 25-6-657, 25-6-662, 25-6-663(B), under Tex. Loc. Gov’t Code ch. 395. There is no size threshold; small projects pay too. The code states no dollar amount — the rate per service unit is set by a separate fee ordinance, so budget from the current adopted schedule. Reductions exist for transit proximity, parking management and affordability, but you have to qualify for them.',
    })

    hurdles.push({
      category: 'fees',
      label: 'Water and wastewater capital recovery (impact) fees',
      status: 'required',
      note: 'Any new development in the water and wastewater impact fee service area that increases the number of service units pays capital recovery fees — separate from the street impact fee — assessed at final plat and collected when the building permit issues (LDC §§ 25-9-311(A), 25-9-321, 25-9-323, 25-9-325(A)–(B), under Tex. Loc. Gov’t Code ch. 395). No tap permit is released until they are paid, and the amounts sit in a separate fee ordinance, not in the code text.',
    })

    if (isResidential) {
      hurdles.push({
        category: 'fees',
        label: 'Parkland dedication or fee in lieu',
        status: 'required',
        note: 'Any subdivision or site plan that includes residential units (or a hotel-motel use) must dedicate parkland, pay a fee in lieu, or both, with the director choosing — LDC §§ 25-1-601(C)–(D), 25-1-603(C)–(D), 25-1-608(B)–(E). There is no minimum project size: it applies from the first unit. The dedication is 0.005 acre per multifamily unit (0.004 per hotel/motel room), capped at 10% of gross site area; the fee version multiplies that same acreage by the average land value for your geographic area and divides by a density factor of 1 (suburban), 4 (urban) or 40 (central business district). Income-restricted and S.M.A.R.T. Housing units are exempt.',
      })
    }

    // Two independent limbs in § 25-11-39(C): floor area, OR (since October 1,
    // 2019) any commercial/multifamily project needing a demolition permit. Only
    // the first is size-triggered, so sizeDependent tracks the limb that fired —
    // a demolition-limb hurdle must not be softened by a placeholder GFA.
    const cdDemolitionLimb = teardown && (isCommercial || existing.multifamilyExisting || units >= 3)
    if (project.gfa > 5000 || cdDemolitionLimb) {
      hurdles.push({
        category: 'demolition',
        label: 'Construction and demolition materials diversion',
        sizeDependent: project.gfa > 5000,
        status: 'required',
        note: 'Construction projects with more than 5,000 sq ft of new, added, or remodeled floor area — and, since October 1, 2019, every commercial or multifamily project that needs a demolition permit — must run a materials diversion program and acknowledge it before the permit issues (LDC § 25-11-39(C); rates at City Code §§ 15-6-151, 15-6-152). The baseline in force since October 2016 is at least 50% of materials diverted for beneficial use, or no more than 2.5 lb of disposal per square foot. Steeper 75% and 95% tiers are written into the code but each is conditioned on City Council first approving a staff report, so confirm which tier is live before pricing haul-off.',
      })
    }

    // 50-year screen: fires on the EXISTING structure, not on project size, so
    // it is not sizeDependent. Suppressed only when the year built is KNOWN and
    // the building is younger than 50 — an unknown year must not wave it through.
    if (teardown) {
      const yb = existing.ex?.yearBuilt
      const age = yb == null ? null : new Date().getFullYear() - yb
      if (age == null || age >= 50) {
        hurdles.push({
          category: 'demolition',
          label: 'Historic review of any building 50 years or older',
          status: 'likely',
          note:
            (age == null
              ? 'The record shows an existing building here but no year built. In Austin, a demolition, relocation, or building permit for any structure 50 years or older goes to historic review before it can issue (LDC § 25-11-213(B), (C), (F), (G)) — confirm the building’s age early, because the review sits ahead of the permit. '
              : `This parcel’s existing building dates to ${yb}, so it is 50 years or older — in Austin, a demolition, relocation, or building permit for any structure that old goes to historic review before it can issue (LDC § 25-11-213(B), (C), (F), (G)). `) +
            'A structure escapes the review only if the historic preservation officer finds all three of: under 50 years old, failing at least two landmark designation criteria, and not contributing to a historic area (HD) district — so an ordinary 1960s house is inside the net by default. Published outer bounds: a hearing within 60 days of a complete application, then a permit hold of up to 75 days after the first Commission meeting — roughly four months worst case, or 180 days for a contributing structure in a National Register district. The permit can issue sooner if the Commission declines to initiate a designation case; if it initiates one, designation becomes pending and any permit issued is void (§ 25-11-214).',
          addsMonths: 4,
        })
      }
    }

    // Triggered by the EXISTING building's tenancies, not by the new project's
    // size — so no sizeDependent tag. The statutory threshold is FIVE existing
    // residential units (§ 25-1-711(C)(2)); a known 2–4 unit building is below
    // it and gets no hurdle, but an unknown unit count must not wave it through.
    if (project.projectType === 'new' && existing.rentalMultifamily && (existing.exUnits === 0 || existing.exUnits >= 5)) {
      const known = existing.exUnits >= 5
      hurdles.push({
        category: 'review',
        label: '120-day tenant notice before applying to demolish',
        status: 'required',
        note:
          (known
            ? `The record shows ${existing.exUnits} residential units here, at or above the five-unit threshold. `
            : 'The record shows rental housing here but no unit count; the rule bites at five or more existing residential units, so confirm the count. ') +
          'Where a permit would displace a tenant at a property with at least five residential units, Austin requires notice to every affected unit at least 120 days BEFORE the demolition or building permit application is submitted, and a certification that you gave it (LDC §§ 25-1-711(C)(2), 25-1-712(A)–(B)). This is a hard pre-application waiting period, not a review that runs alongside anything else — the clock starts before the city ever sees your file, and it counts the units already on the site, not the units you propose. A mobile home park gets 270 days instead, measured from the rezone, site plan or change-of-use application.',
        addsMonths: 4,
      })
    }

    hurdles.push({
      category: 'environmental',
      label: 'Save Our Springs: impervious cover cap',
      status: 'likely',
      note: 'Development in the watersheds that contribute to Barton Springs is capped on impervious cover under the Save Our Springs Initiative: 15% across the entire recharge zone, 20% in the Barton Creek contributing zone, and 25% in the remainder of the contributing zone, measured on NET site area and reduced further where needed to hold pollutant loads flat (LDC §§ 25-8-514(A), 25-8-515; Barton Springs Zone applicability at § 25-8-481). The trigger is geographic, not size — confirm whether your parcel drains to Barton Springs, because these caps routinely bind harder than the zoning envelope. They are also not waivable: the article is expressly exempt from the code’s ordinary variance and special-exception machinery.',
    })

    // Discretionary-only: the protest right attaches to a rezoning, not to an
    // as-of-right building (same reasoning as NYC ULURP / Chicago PD above).
    if (discretionary) {
      hurdles.push({
        category: 'review',
        label: 'Valid petition: 20% of neighbours can force a supermajority vote',
        status: 'info',
        note: 'If you need a rezoning, owners of at least 20% of the land either inside the proposed change area or immediately adjoining it and extending 200 feet out can protest in writing — a "valid petition" — and that single filing raises the approval bar from a simple majority to three-fourths of City Council, 9 of 11 votes (LDC § 25-2-284(A), under Tex. Loc. Gov’t Code ch. 211). It costs the objectors nothing, which is why the discretionary path here carries far more risk than the as-of-right path. A PUD rezoning the Land Use Commission recommends denying needs the same three-fourths vote.',
      })
    }
  } else if (city === 'dc') {
    // Citations are to the DC Municipal Regulations (11-C DCMR, Zoning
    // Regulations of 2016; 10-B, 12-A, 21 DCMR) and the D.C. Official Code.
    if (isResidential && units >= 10) {
      hurdles.push({
        category: 'affordability',
        label: 'Inclusionary Zoning (IZ) set-aside',
        sizeDependent: true,
        status: 'required',
        note: 'Residential development proposing 10 or more new dwelling units — cellar and penthouse units count toward the ten — must set aside income-restricted Inclusionary Units in any zone where Subtitle C Chapter 10 is identified as applicable (11-C DCMR § 1001.2(a)(1)). The set-aside is 10% of residential gross floor area (excluding penthouse habitable space) where the project is NOT Type I construction AND the by-right height limit is 50 ft or less, and 8% where it is Type I construction OR the height limit exceeds 50 ft (§§ 1003.1, 1003.2). Rental units go to households at or below 60% of MFI, ownership units at or below 80% (§ 1003.3). Unit counts combine across building permits over a 3-year window (§ 1001.3), and there is no in-lieu fee in the base rule — the units must be built.',
      })
    }

    // TWO limbs at 10-B DCMR § 2300.1(a): land area of 3 acres (130,680 sq ft),
    // OR a commercial / mixed-use commercial project of 50,000 sq ft or more of
    // gross floor area above grade plus cellar. A purely residential project
    // below three acres is outside it. Tagged sizeDependent per the research row;
    // the tag only ever downgrades, so it fails closed.
    const ltrLandLimb = lotSqFt >= 130680
    const ltrCommercialLimb = isCommercial && project.gfa >= 50000
    if (ltrLandLimb || ltrCommercialLimb) {
      hurdles.push({
        category: 'review',
        label: 'Large Tract Review (Office of Planning)',
        sizeDependent: true,
        status: 'required',
        note: `${
          ltrLandLimb
            ? 'A site of three acres or more (about 130,680 sq ft)'
            : 'A commercial or mixed-use commercial development of 50,000 sq ft or more of gross floor area above grade plus cellar area'
        } goes through Large Tract Review at the Office of Planning before any building permit application may be filed, on a 60-day schedule (10-B DCMR § 2300.1(a), § 2303.1). Note what this is NOT: it produces a technical report, not an approval or denial, so it is a schedule item rather than a veto point. Notice goes to the affected ANC, any known civic association and every property owner within 200 feet, and there is at least one community meeting. Exemptions at § 2304.1 include projects filed as Planned Unit Developments and sites in the former C-3-C, C-4 and C-5 downtown districts (now the D zones).`,
        addsMonths: 2,
      })
    }

    hurdles.push({
      category: 'environmental',
      label: 'DC Environmental Policy Act screening',
      status: 'likely',
      note: 'Any action requiring a District permit that costs over $1,000,000 in 1989 dollars — CPI-adjusted annually, so the live figure is roughly $2.6M today — and that may significantly affect the environment must file an Environmental Impact Screening Form; if screening shows significant impact, a full Environmental Impact Statement follows and no agency may issue the permit until review completes (D.C. Official Code §§ 8-109.02(2), 8-109.03, 8-109.06(a)(7); rules at 20 DCMR §§ 7201.1, 7202.1–7202.2). Issuing a building permit is itself an "action", so this reaches private projects. Two exemptions do most of the work: projects inside the Central Employment Area are exempt by statute (§ 8-109.06(a)(7)), and 20 DCMR § 7202.2 exempts residential projects in the former R-1 through R-5-A zones — pre-2016 zone names, so check the mapping against the current zone map.',
    })

    // DISTURBED AREA, NOT LOT AREA (2026-08-07). 21 DCMR § 599 triggers on the
    // area an activity DISTURBS; this gate used lot area as a stand-in. That
    // stand-in only holds for ground-up construction, where the whole site is
    // worked. A change of use disturbs no land at all — yet any 5,000 sq ft lot
    // was being told a Stormwater Retention Volume was REQUIRED with no site
    // work in the project. An addition or an ADU disturbs some unknown fraction
    // of the lot; we hold no footprint input, so the hurdle stays and names the
    // condition rather than asserting a requirement off a quantity the source
    // does not measure. NOT modelled, and reported rather than invented: the
    // second qualifying case in the source (a major substantial improvement
    // activity whose combined improved-building and land-disturbance footprint
    // reaches 5,000 sq ft), which can bite on a lot below 5,000 sq ft.
    const dcDisturbsLand = project.projectType !== 'change_of_use'
    const dcWholeSiteWork = project.projectType === 'new'
    if (lotSqFt >= 5000 && dcDisturbsLand) {
      hurdles.push({
        category: 'environmental',
        label: 'Stormwater Retention Volume (major land-disturbing activity)',
        status: dcWholeSiteWork ? 'required' : 'likely',
        note:
          'Disturbing 5,000 sq ft or more of land — or being part of a common plan of development that does — makes this a "major land-disturbing activity" and triggers DC’s Stormwater Retention Volume requirement: retain on site the runoff from a 1.2-inch rainfall event, with at least half of that volume retained on the site itself absent DOEE relief for extraordinarily difficult conditions (21 DCMR § 599 for the definition, §§ 520.3 and 520.4(a) for the standard). On a tight urban lot this drives real design cost — green roofs, cisterns, permeable paving — and the shortfall can be bought as Stormwater Retention Credits in a live DC market. The threshold is land disturbance, not building size, so a small building on a large site still triggers it.' +
          (dcWholeSiteWork
            ? ''
            : ' This project is not ground-up construction, so the 5,000 sq ft is measured against the area your work actually disturbs — not against the whole lot, which is all this tool can see. Confirm the disturbed footprint before pricing the retention volume.'),
      })
    }

    // ZONE RESTRICTION (2026-08-06). 11-C DCMR § 601.2 applies the Green Area
    // Ratio to "all new buildings on properties in ALL ZONES EXCEPT the R and RF
    // zones" — the house-form residential zones, which are most of DC's land
    // area. The gate asserted it on every new building in the city, while the
    // hurdle's OWN note already said "in all zones except the R and RF
    // house-form zones": the claim was true in the text and false in the gate
    // (ledger rule 9's boundary problem). Base zone only — an overlay suffix
    // (`R-3/NO`, `RF-1/CAP`) does not move the parcel out of its base zone.
    // Matches R-1A/R-2/R-3… and RF-1…RF-5; deliberately NOT RA-* (Residential
    // Apartment), NC, MU, PDR or D, all of which are inside the GAR. An
    // unresolved district code ('Unknown') keeps firing — the exemption is only
    // applied where the zone is affirmatively known to be R or RF.
    const dcBaseZone = (parcel.zoning.districtCode ?? '').toUpperCase().split('/')[0].trim()
    const dcHouseFormZone = /^RF?(-|$)/.test(dcBaseZone)
    if (project.projectType === 'new' && !dcHouseFormZone) {
      hurdles.push({
        category: 'environmental',
        label: 'Green Area Ratio: landscape minimum',
        status: 'required',
        note: 'Every new building in DC must meet a Green Area Ratio — a minimum score for on-site landscape and stormwater elements such as trees, vegetated roofs, permeable paving and bioretention — in all zones except the R and RF house-form zones (11-C DCMR §§ 601.2, 601.3, 604.2–604.8, with exemptions at § 601.3(a)–(d) and § 601.7). The required ratio is set per zone in that zone’s development-standards chapter, so the number is zone-specific rather than citywide. A landscape plan prepared by a Certified Landscape Expert is a permit submission requirement, and no certificate of occupancy issues until a landscape checklist is accepted. It also reaches existing buildings where additions or interior renovations within any 12-month period exceed 100% of the building’s assessed value; historic resources are exempt unless an addition increases gross floor area by 50% or more.',
      })
    }

    if (project.gfa >= 10000) {
      hurdles.push({
        category: 'environmental',
        label: 'DC Green Construction Code (10,000 sq ft and up)',
        sizeDependent: true,
        status: 'required',
        note: 'New construction of 10,000 sq ft or more — including an addition of that size and its associated site development, and demolition, alteration or relocation at the same threshold — must comply with the DC Green Construction Code, a full code layer beyond the energy code covering site development, materials, water use and commissioning (12-A DCMR § 101.12.3, Exception 1; the code itself at 12-K DCMR). Below 10,000 sq ft it does not apply at all. Cost shows up in design and commissioning, not in review time.',
      })
    }

    // SCOPE CORRECTION (2026-08-06). The mandatory LEED obligation in § 6-1451.03(b)
    // is written for NONRESIDENTIAL projects and the nonresidential portion of a
    // mixed-use project — a purely residential building of any size is outside it.
    // The earlier encoding fired on any project ≥ 50,000 sq ft, residential
    // included, which is the misquote the research specifically warns against.
    if (isCommercial && project.gfa >= 50000) {
      hurdles.push({
        category: 'environmental',
        label: 'Green Building Act: LEED certification (nonresidential portion)',
        sizeDependent: true,
        status: 'required',
        note: 'The Act reaches privately-owned projects of at least 50,000 sq ft of gross floor area, but the mandatory LEED obligation applies to NONRESIDENTIAL projects — or, in a mixed-use building, to the nonresidential portion, which must certify at LEED Certified level (D.C. Official Code § 6-1451.03(a), (b)(1)(B), (b)(2)(B), (b)(4)). A purely residential building of any size is outside it. Certification must be verified within two years of the certificate of occupancy, and financial security must be posted before occupancy — $7.50 per sq ft below 100,000 sq ft, $10 per sq ft at 100,000 sq ft and above, capped at $3 million (§ 6-1451.05) — forfeited if certification is not achieved. That security is a real carrying cost, not a paper filing.',
      })
    }

    // THERE MUST BE SOMETHING TO DEMOLISH (2026-08-06). § 6-1104(b) reaches "any
    // permit to demolish a historic landmark or a building or structure located
    // in a historic district". The gate fired on `projectType === 'new'` alone,
    // so a new building on a VACANT lot inside a historic district was told a
    // demolition permit needed a public-interest finding. `teardown` is
    // `new` AND an existing structure — the condition the source actually states.
    if (parcel.overlays.historicDistrict && teardown) {
      hurdles.push({
        category: 'demolition',
        label: 'Demolition in a historic district: "necessary in the public interest"',
        status: 'required',
        note: 'Demolishing a historic landmark — or any building in a historic district — requires a finding that the demolition is necessary in the public interest, or that refusing the permit would cause the owner unreasonable economic hardship; without it the permit is denied (D.C. Official Code § 6-1104(b), (c), (e)). That is a substantive test, not a formality: the applicant carries the burden, there is a public hearing, and the statute runs a 120-day clock. This is a materially harder gate than the design review that accompanies it. Where demolition is allowed only because the replacement is a "project of special merit", the demolition permit cannot issue until the new-construction permit issues simultaneously — the teardown cannot precede a fully approved replacement design.',
        addsMonths: 4,
      })
    }

    // Both of these fire on the EXISTING rental housing, not on project size.
    if (project.projectType === 'new' && existing.rentalMultifamily) {
      hurdles.push({
        category: 'demolition',
        label: 'Demolishing occupied rental housing: 180-day notice',
        status: 'required',
        note: 'To recover possession of an occupied rental unit in order to demolish the building and replace it with new construction, DC requires that a copy of the demolition permit first be filed with the Rent Administrator, then a 180-day notice to vacate served on every tenant, plus statutory relocation assistance under subchapter VII (D.C. Official Code § 42-3505.01(g)(1)–(2)). The tenancy, not the permit, is the binding constraint: the clock cannot start before the demolition permit exists, so six months of holding costs on an already-entitled site is the realistic floor.',
        addsMonths: 6,
      })
      // NEW-CONSTRUCTION EXCLUSION (2026-08-06). § 42-3404.02b(b)(20), added by
      // the RENTAL Act of 2025, takes a multifamily building whose permanent
      // certificate of occupancy issued within the prior 15 years OUT of TOPA.
      // The gate asserted TOPA on every rental teardown, including buildings
      // finished last year. `yearBuilt` is the CO-date proxy already used for
      // Austin's 50-year screen and LA/SF rent control; suppress only when the
      // year is KNOWN and inside the window — an unknown year keeps the hurdle.
      const topaYearBuilt = existing.ex?.yearBuilt
      const topaNewConstructionExcluded =
        topaYearBuilt != null && new Date().getFullYear() - topaYearBuilt < 15
      if (!topaNewConstructionExcluded) {
        hurdles.push({
          category: 'demolition',
          label: 'TOPA: tenants get first right to buy',
          status: 'likely',
          note: 'Under the Tenant Opportunity to Purchase Act, tenants of an occupied housing accommodation must be given a bona fide opportunity to purchase before the owner can sell it OR issue a notice to vacate for demolition (D.C. Official Code § 42-3404.02(a)) — it fires on the teardown, not just on a sale. For accommodations of 5 or more units the statute sets minimum periods the owner must allow: 45 days for the tenants to register an organization, then not less than 120 days to negotiate a contract, then not less than 120 days after contracting to arrange financing (§ 42-3404.11). Tenants routinely assign those rights to a developer for a payment. No months are assigned here because the clock only runs if tenants organize, but a TOPA-encumbered site should never be underwritten on an as-of-right timeline. Since the RENTAL Act of 2025, a multifamily building whose permanent certificate of occupancy issued within the prior 15 years is excluded (§ 42-3404.02b(b)(20)).',
        })
      }
    }

    hurdles.push({
      category: 'labor',
      label: 'First Source hiring — only if the project takes government assistance',
      status: 'info',
      note: 'DC imposes no prevailing-wage or local-hire mandate on a privately financed building permit — the obligation attaches to District assistance. Between $300,000 and $5,000,000 of assistance, at least 51% of new hires must be District residents; for construction projects at $5,000,000 or more, at least 20% of journey-worker hours, 60% of apprentice hours, 51% of skilled-laborer hours and 70% of common-laborer hours must go to District residents (D.C. Official Code § 2-219.03(a), (e)(1)(A), (e)(1A)(A)). Tax abatements, land dispositions and DHCD/DCHFA financing are the usual routes in, so weigh this against the subsidy before assuming public money is free. A project that takes no District assistance is not covered.',
    })
  } else if (city === 'denver') {
    // Denver Zoning Code (June 25, 2010, republished February 25, 2025) and the
    // Denver Revised Municipal Code. The affordability rules are DRMC ch. 27
    // arts. V and X as enacted by CB22-0426 (Expanding Housing Affordability).
    if (isResidential && units >= 10) {
      hurdles.push({
        category: 'affordability',
        label: 'Mandatory Affordable Housing (10+ units)',
        sizeDependent: true,
        status: 'required',
        note: 'A residential development creating 10 or more new dwelling units at one location — by construction, alteration, or conversion of non-residential space to residential — must make a share of them income-restricted for 99 years, pay a fee-in-lieu, or negotiate an alternative (D.R.M.C. ch. 27, art. X, §§ 27-219(t), 27-221, 27-223, 27-224, enacted by the Expanding Housing Affordability ordinance CB22-0426, effective July 1, 2022). On-site percentages are set by market area: 8% (Typical) or 10% (High) at the lower-AMI option, rising to 12% / 15% at the higher-AMI option. "At one location" aggregates commonly owned adjacent parcels, and the code expressly forbids splitting an application to stay under ten units.',
      })
    }

    // CARVE-OUT (2026-08-06): § 27-154(k) exempts the gross floor area of a
    // residential development subject to art. X — you pay Mandatory Affordable
    // Housing or the linkage fee, not both. A purely residential 10+ unit project
    // therefore owes no linkage fee at all; a mixed-use one still pays on its
    // commercial floor area. The earlier encoding charged both.
    const mahExempt = project.use === 'residential' && units >= 10
    if ((project.projectType === 'new' || project.projectType === 'addition') && !mahExempt) {
      hurdles.push({
        category: 'fees',
        label: 'Affordable housing linkage fee',
        sizeDependent: true,
        status: 'required',
        note: `Denver charges an affordable-housing linkage fee on any new structure, and on any addition that increases gross floor area, when the building permit issues (D.R.M.C. §§ 27-153(a), 27-153(e), 27-154(k)). The schedule effective July 1, 2025 is $5.00/sq ft for units of 1,600 sq ft or less and $8.00/sq ft for larger units, in buildings of 9 dwelling units or fewer; commercial space pays $6.00/sq ft in a typical market area or $9.00/sq ft in a high market area. Rates are re-indexed to CPI every July 1 from 2026 onward, so confirm the current published schedule with CPD.${
          isResidential && units >= 10
            ? ' Residential floor area subject to Mandatory Affordable Housing is exempt, so on this project the fee reaches only the commercial floor area.'
            : ' Residential floor area subject to Mandatory Affordable Housing (10+ units) is exempt — you pay one or the other, not both.'
        }`,
      })
    }

    // Administrative, but universal: the exception is narrow enough to state.
    if (!(isResidential && units > 0 && units <= 2)) {
      hurdles.push({
        category: 'review',
        label: 'Site Development Plan review (administrative)',
        status: 'required',
        note: 'Nearly all development in Denver needs an approved Site Development Plan before any zoning or building permit — every zone district, every use, as "development" is defined in DZC Division 13.3. The exceptions are narrow: one single-unit or two-unit dwelling structure (or two single-unit structures) on a single zone lot, ADUs inside already-approved structures, and development under an approved detailed PUD plan (Denver Zoning Code § 12.4.3.2.A–B). Review is inter-agency staff review by Community Planning and Development — no appointed board, no public hearing, no community-benefits negotiation.',
      })
    }

    // 5 acres = 217,800 sq ft. Lot area, not project size.
    if (lotSqFt > 217800) {
      hurdles.push({
        category: 'review',
        label: 'Large Development Review (sites over 5 acres)',
        status: 'likely',
        note: 'Sites over 5 acres (about 217,800 sq ft) are commonly routed into Large Development Review; the Development Review Committee decides after the pre-application meeting, using the factors listed at Denver Zoning Code §§ 12.4.12.2.A and 12.4.12.3. Gross land area of more than 5 acres or 3 blocks — or work creating 3 or more blocks — is one listed factor, alongside an adopted plan recommending the process and any project that changes the arterial/collector street grid, regional stormwater, or public park and open space. Where it applies, an approved Large Development Framework must be in place BEFORE any rezoning, subdivision, site development plan or infrastructure master plan is finalized.',
      })
    }

    // Downtown design-board districts, verbatim from DZC § 12.2.7.2; the Cherry
    // Creek North board covers the C-CCN districts (§§ 12.2.8.2, 12.2.8.3).
    const DENVER_DESIGN_BOARD_DISTRICTS = new Set(['D-GT', 'D-AS-12+', 'D-AS-20+', 'D-CPV-T', 'D-CPV-R', 'D-CPV-C'])
    const dzDistrict = (parcel.zoning.districtCode ?? '').toUpperCase()
    const cherryCreekBoard = dzDistrict === 'C-CCN' || dzDistrict.startsWith('C-CCN-')
    if (DENVER_DESIGN_BOARD_DISTRICTS.has(dzDistrict) || cherryCreekBoard) {
      hurdles.push({
        category: 'review',
        label: 'Design Advisory Board review',
        status: 'required',
        note: cherryCreekBoard
          ? `This parcel is zoned ${parcel.zoning.districtCode}, inside Cherry Creek North, where the Cherry Creek North Design Advisory Board reviews the project and makes recommendations to the Development Review Committee or Zoning Administrator (Denver Zoning Code §§ 12.2.8.2, 12.2.8.3). Its meetings are open to the public with public comment. The board advises rather than decides, but it adds a public design step that projects elsewhere in Denver do not face.`
          : `This parcel is zoned ${parcel.zoning.districtCode}, one of the six downtown districts (D-GT, D-AS-12+, D-AS-20+, D-CPV-T, D-CPV-R, D-CPV-C) where the Downtown Design Advisory Board reviews the project and makes recommendations to the Development Review Committee or Zoning Administrator (Denver Zoning Code § 12.2.7.2). Its meetings are open to the public with public comment. The board advises rather than decides, but it adds a public design step that projects elsewhere in Denver do not face.`,
      })
    }

    if (teardown) {
      hurdles.push({
        category: 'demolition',
        label: 'Landmark demolition screen on every teardown',
        status: 'required',
        note: 'Every application to demolish a primary structure in Denver — designated or not, at any age — is first screened for landmark significance, as is any accessory structure of 1½ storeys or more (D.R.M.C. § 30-6(1)(b)(i)–(vi)). The executive director has 10 working days to decide whether the structure has "potential for designation". If it does, the property is posted publicly for 21 calendar days; a notice of intent to file a landmark designation lodged by day 21 extends the posting to 60 days and forces a facilitated meeting with the applicant, and a full designation application can then run up to 90 days more. A screen is not a designation, but it sits ahead of the demolition permit. An owner can buy certainty in advance with a Certificate of Demolition Eligibility (§ 30-6(1)(c)), which blocks non-consensual designation for 5 years.',
      })
    }

    // PROJECT-TYPE RESTRICTION (2026-08-06). The ordinance reaches "new buildings
    // and additions containing 25,000 square feet or more of gross floor area",
    // plus existing buildings of that size ON A ROOF REPLACEMENT. The gate fired
    // on floor area alone, so a change of use or an interior ADU conversion in a
    // 25,000 sq ft building was told a cool roof was required with no roof work
    // in the project at all. The roof-replacement limb is NOT modelled — we have
    // no roof-work input — and the note says so rather than pretending otherwise.
    const denverGboProjectLimb = project.projectType === 'new' || project.projectType === 'addition'
    if (denverGboProjectLimb && project.gfa >= 25000) {
      hurdles.push({
        category: 'environmental',
        label: 'Green Buildings Ordinance (25,000 sq ft)',
        sizeDependent: true,
        status: 'required',
        note: 'New buildings and additions of 25,000 sq ft or more of gross floor area must provide a cool roof AND satisfy one further compliance path — green space, on-site renewable energy, an energy-efficiency package, certification, or a payment into the Green Building Fund (D.R.M.C. ch. 10, art. XIII; CPD / Office of Climate Action rules §§ 3.01 and 4.01, effective October 9, 2023). The same threshold reaches an existing building of that size on a roof replacement or recover of more than 5% of the total roof area or of an individual roof section. Price this into the roof and envelope at 25,000 sq ft rather than discovering it at permit.',
      })
    }

    hurdles.push({
      category: 'labor',
      label: 'Denver citywide minimum wage',
      status: 'info',
      note: 'Denver sets its own minimum wage, above Colorado’s, and it covers all work performed physically within the city — including construction trades on a private jobsite — whether or not the project takes public money. The exclusions are narrow: work totalling under four hours a week inside the city, and pass-through travel (D.R.M.C. ch. 58, art. II, enacted by CB19-1237; first rate effective January 1, 2020). The rate rises every January 1 with the Denver-area CPI, an escalation running since January 1, 2023, so a multi-year build faces a rising labour floor. This is not a prevailing-wage rule — Denver’s prevailing wage attaches to city contracts, not to privately funded projects.',
    })
  } else if (city === 'minneapolis') {
    // Minneapolis Code of Ordinances (Title 20 zoning; Title 22 subdivision;
    // Title 23 heritage preservation) read at Supplement 72 Update 2, plus the
    // city's Unified Housing Policy and the state EAW rules (Minn. R. 4410).
    if (isResidential && units >= 50) {
      hurdles.push({
        category: 'affordability',
        label: 'Inclusionary Zoning: 8% affordable units',
        sizeDependent: true,
        status: 'required',
        note: 'A residential RENTAL project of 50 or more new dwelling units must set aside 8% of its units at or below 60% of Area Median Income, held affordable for at least 20 years. Two alternatives are allowed instead: 7% at 50% AMI, or 4% at 30% AMI. Cash in lieu is $15 per square foot of net residential area in buildings up to 7 stories, and $22 per square foot at 8 stories or more. In buildings under 100 units the first 15 units are excluded from the calculation (20–85-unit buildings), tapering to 1 exempt unit at 99 units. The zoning ordinance’s own trigger is 20 units, but the Unified Housing Policy currently exempts rental projects of 20–49 units, so 50 is the line that actually bites (Minneapolis Code of Ordinances § 550.810(a); Unified Housing Policy § III(A)(1), effective April 1, 2025). TENURE IS PART OF THE TRIGGER and this tool holds no tenure field: the mandate reaches RENTAL projects only, and for-sale projects — condominiums and for-sale townhomes — are exempt at any size until further notice. Confirm which you are building before treating this as binding. The requirement is set by Council policy, not the zoning text — the policy in effect the day your complete land use application is submitted governs.',
      })
    }

    // ABSENCE, and the finding that matters for most Minneapolis projects: the
    // mandate has a floor of 50 rental units, and never reaches for-sale housing.
    if (isResidential) {
      hurdles.push({
        category: 'affordability',
        label: 'Inclusionary zoning does not bite below 50 rental units',
        sizeDependent: true,
        status: 'info',
        note: 'Minneapolis’s 8% affordable set-aside reaches only rental projects of 50 or more units. Rental projects of 20–49 units — and all for-sale projects, including condominiums and for-sale townhomes — are exempt "until further notice" (Minneapolis Unified Housing Policy § III, Delayed Phase-In for Smaller Projects and For-Sale Projects; enabled by Minneapolis Code of Ordinances § 550.810(c)(1)). This is a policy switch the Council can flip without amending the zoning code, and CPED must bring a comprehensive review to Council every 3–5 years, so confirm the current policy before underwriting a 20–49 unit deal on it. Separately, units created inside a building originally built for non-residential use are exempt if a complete application is submitted before October 1, 2029 (§ 550.810(c)(3)).',
      })
    }

    // Unit-count trigger → sizeDependent (rule 1). The published duration for
    // this row is 2 months — Minn. Stat. § 15.99, subd. 2's 60-day rule;
    // nothing else in the Minneapolis research states one. The SECOND threshold
    // (20 units → mandatory public hearing) was lost to truncation and is
    // restored here: below 20 units the same review is administrative.
    // Administrative review is CONJUNCTIVE in Table 550-1 — it needs BOTH that
    // the project carries no other land use application requiring a public
    // hearing AND that it is under 20 units. The unit half alone was encoded,
    // so a 6-unit project that also needs a variance (itself a land use
    // application heard in public) was told its review would be administrative
    // with "no hearing, no commission" — false on the variance path.
    //
    // OVER-fire, corrected (2026-08-07). Both thresholds on this row are written
    // in RESIDENTIAL UNIT TYPES: Table 550-1 reads "four (4) or more new or
    // additional DWELLING UNITS OR ROOMING UNITS", and the administrative-review
    // limb reads "fewer than twenty (20) new or additional dwelling units or
    // rooming units". An office block or a warehouse contains none of either, so
    // this row cannot reach it. `units` arrives straight off the query string
    // independent of `use` (analyze.ts reads them separately), so an unguarded
    // `units >= 4` applied a dwelling-unit threshold to a wholly non-residential
    // project. Mixed-use still fires — its dwellings are dwelling units.
    // Table 550-1's OTHER rows (the non-residential triggers) were not read for
    // this repo, so a commercial project now gets nothing here rather than a
    // borrowed number — rule 5: a gap must not render as an answer.
    // Two collapses the source makes and this gate cannot: it counts dwelling
    // units and rooming units TOGETHER against one threshold (we carry a single
    // count), and footnote 2 aggregates additions "in any three (3) year period"
    // (we see only this project). Both are under-fires, disclosed in the note
    // rather than modelled.
    if (isResidential && units >= 4) {
      const mplsHearing = units >= 20 || discretionary
      hurdles.push({
        category: 'review',
        label: 'Site plan review',
        sizeDependent: true,
        status: 'required',
        note: !mplsHearing
          ? 'Any building or use containing 4 or more new or additional dwelling units or rooming units goes through site plan review before a building permit (Minneapolis Code of Ordinances § 550.510 and Table 550-1). Administrative review is available only if BOTH conditions in Table 550-1 hold: the project includes no other land use application requiring a public hearing, AND it includes fewer than 20 new or additional dwelling units or rooming units. This project meets both, so the review is administrative — no hearing, no commission; the public-hearing requirement starts at 20 new or additional units, counting units added in any 3-year period together. Minnesota’s 60-day rule (Minn. Stat. § 15.99, subd. 2) requires the city to approve or deny within 60 days, extendable once by up to 60 more days with written notice. Conversions of non-residential floor area to housing stay administrative at any unit count.'
          : units >= 20
            ? 'Any building or use containing 4 or more new or additional dwelling units or rooming units goes through site plan review before a building permit — and at 20 or more units the application is NOT eligible for administrative review: it must go to a public hearing before the City Planning Commission (Minneapolis Code of Ordinances § 550.510 and Table 550-1, incl. footnote 2). Administrative review needs BOTH conditions in Table 550-1 — no other land use application requiring a public hearing, and fewer than 20 units — and the unit half already fails here. Units added in any 3-year period are counted together. Minnesota’s 60-day rule (Minn. Stat. § 15.99, subd. 2) requires the city to approve or deny within 60 days, extendable once by up to 60 more days with written notice.'
            : 'Any building or use containing 4 or more new or additional dwelling units or rooming units goes through site plan review before a building permit (Minneapolis Code of Ordinances § 550.510 and Table 550-1). This project is under 20 units, but the unit count is only HALF the test: administrative review requires BOTH that the project includes no other land use application requiring a public hearing AND that it is under 20 units. This project needs discretionary zoning relief, which is itself a land use application heard in public, so the first condition fails and the site plan is NOT eligible for administrative review — expect the City Planning Commission, not a staff sign-off. Minnesota’s 60-day rule (Minn. Stat. § 15.99, subd. 2) requires the city to approve or deny within 60 days, extendable once by up to 60 more days with written notice.',
        addsMonths: 2,
      })
    }

    // OVER-fire, corrected (2026-08-07) — the same shape as San José's TDM gate.
    // Both Table 555-10 rows encoded here are written in residential unit types:
    // "fifty (50) or more and less than two hundred fifty (250) new or additional
    // DWELLING UNITS OR ROOMING UNITS" and "two hundred fifty (250) or more new
    // or additional dwelling units or rooming units". These are the table's
    // residential rows; a commercial or institutional building has no dwelling
    // units to count against them. Table 555-10's non-residential rows were not
    // read for this repo — and the planning director's discretionary TDM power
    // over "any project not listed in the table" states no threshold at all — so
    // a non-residential project gets no TDM claim here rather than a borrowed
    // one. Mixed-use still fires on its dwellings.
    if (isResidential && units >= 50) {
      hurdles.push({
        category: 'review',
        label: 'Travel demand management plan',
        sizeDependent: true,
        status: 'required',
        note:
          units >= 250
            ? 'At 250 or more new or additional dwelling units or rooming units, Minneapolis requires a MAJOR travel demand management plan scoring at least 6 points, including a traffic study prepared to industry standards and certified by a licensed engineer (Minneapolis Code of Ordinances § 555.1310(c) and Table 555-10). The 250-unit row carries its own exception — "except as otherwise authorized in this table for building conversions" — so a building conversion may sit on a different line of Table 555-10; check the table before assuming the major plan. You pick strategies from Table 555-11 — transit passes, bike facilities, unbundled parking, car-share — until you hit the point total, and you must keep complying afterward. A written exemption request is possible.'
            : 'At 50 or more (and fewer than 250) new or additional dwelling units or rooming units, Minneapolis requires a MINOR travel demand management plan scoring at least 4 points with the application; at 250 units it becomes a major plan requiring 6 points plus a licensed engineer’s traffic study (Minneapolis Code of Ordinances § 555.1310 and Table 555-10). You pick strategies from Table 555-11 — transit passes, bike facilities, unbundled parking, car-share — until you hit the point total, and you must keep complying afterward. A written exemption request is possible. This is the practical replacement for the parking minimums Minneapolis abolished.',
      })
    }

    // § 598.370(a) fires on a NET INCREASE in residential dwelling units, not on
    // residential use — the ordinance's own exclusion list is entirely made of
    // things that add no units (tax parcel combinations and splits, minor
    // subdivisions, lot line adjustments, apartment-to-condominium conversions,
    // internal leasehold improvements). A residential job adding no units owes
    // nothing, so the zero/non-zero test is part of the trigger. NOT tagged
    // sizeDependent: the research row states sizeDependent False, and this is an
    // applicability test (any units at all), not a magnitude threshold.
    if (isResidential && units >= 1) {
      hurdles.push({
        category: 'fees',
        label: 'Parkland dedication: land or fee in lieu',
        status: 'required',
        note: 'Any development needing a building permit that produces a net increase in residential dwelling units must dedicate parkland or pay a fee in lieu (Minneapolis Code of Ordinances § 598.370(a)–(d)). There is no minimum project size — it applies from the first added unit. The land option is .0066 acres per new unit downtown (the area bounded by I-35W, I-94, Plymouth Avenue and the Mississippi River) or .01 acres per new unit outside downtown, capped at 10% of the area being platted or developed. The cash alternative is written into the ordinance at $1,500 per non-exempt unit — but that is the 2013 base figure, adjusted every April 1 by the Minneapolis–St. Paul CPI-U and never reduced, so what you will actually owe is materially higher. The current per-unit figure is published in the city’s parkland dedication fee schedule; get it from Minneapolis Development Review before you underwrite, because no current dollar amount is asserted here. Affordable housing units as defined in § 598.360 (including inclusionary units) are exempt, as are lot combinations and splits, minor subdivisions, lot line adjustments, apartment-to-condominium conversions and internal leasehold improvements.',
      })
    }

    if (isResidential) {
      // ABSENCE by threshold: state environmental review sits far above the size
      // of an ordinary Minneapolis building, so most projects never see it.
      hurdles.push({
        category: 'environmental',
        label: 'State environmental review (EAW) — the threshold is very high',
        sizeDependent: true,
        status: 'info',
        note: 'Minnesota requires a mandatory Environmental Assessment Worksheet only at 375 attached dwelling units (250 unattached) for a project consistent with the city’s adopted comprehensive plan — well above almost every project (Minn. R. 4410.4300, subp. 19, items C and D). If the project is NOT consistent with Minneapolis 2040, the trigger drops to 150 attached units (100 unattached), and that consistency call is the city’s, not yours. A mandatory Environmental Impact Statement starts higher still, at 1,500 attached units / 1,000 unattached (Minn. R. 4410.4400, subp. 14, item D). Units are counted across all contiguous land the proposer owns or holds an option on. Below those lines there is no state environmental review to clear — Minnesota has no discretionary-approval catch-all of the CEQA or SEPA kind.',
      })
    }

    if (teardown) {
      hurdles.push({
        category: 'demolition',
        label: 'Every demolition is screened for historic significance',
        status: 'required',
        note: 'Minneapolis screens every demolition of a principal building for historic significance, anywhere in the city and regardless of the building’s age or whether it is designated (Minneapolis Code of Ordinances §§ 599.910, 599.920; Chapter 599 rewritten in its entirety by Ord. No. 2025-053, adopted November 20, 2025 — this is new law). A screen is not a designation, but it sits ahead of the demolition permit. If the planning director finds the building is not a potential historic resource the permit issues with no hearing. If it is flagged, you need an approved application for demolition of a potential historic resource, decided by the Heritage Preservation Commission at a public hearing, and the HPC may approve only on one of three findings: a certified engineer’s report of a structurally unsafe condition, a finding that the property lacks significance and integrity, or a cost estimate showing rehabilitation to the Secretary of the Interior’s Standards is not economically viable. Denial either converts into a landmark nomination with interim protection or imposes a 90-day demolition delay during which anyone may file a district nomination; the HPC can also condition approval on up to 90 days’ delay plus a documentation and mitigation plan.',
      })

      // Unit-count trigger (100+) on the NEW project → sizeDependent. The
      // 50-year test is on the EXISTING units; an unknown year built must not
      // wave it through (same rule as Austin's 50-year screen).
      const yb = existing.ex?.yearBuilt
      const age = yb == null ? null : new Date().getFullYear() - yb
      // The rule counts DWELLING UNITS demolished ("will demolish units that are
      // 50 or more years old"). Tearing down a warehouse or a store demolishes
      // none, and the inclusionary requirement stays at the ordinary 8% — but
      // the gate read only `teardown`, so any old building on the site raised a
      // replacement duty. Fails closed: a positive unit count, a residential
      // land use, or an unlabelled building all still fire; only an
      // affirmatively non-residential land use with no units suppresses it.
      const exLu = existing.lu
      const luResidential = /apartment|condo|multi-?family|town ?house|triplex|fourplex|duplex|dwelling|residen|housing|\bflats\b/i.test(exLu)
      const luNonResidential = /commercial|retail|office|industrial|warehouse|storage|parking|church|school|hotel|motel|restaurant|manufactur/i.test(exLu)
      const demolishesDwellings = existing.exUnits > 0 || luResidential || !luNonResidential
      // OVER-fire, corrected (2026-08-07). The 100 is a count of the NEW
      // project's dwelling units, and what it modifies is "the Inclusionary
      // Zoning requirement" — which § 550.810(a) attaches only to "a building or
      // use containing twenty (20) or more new or additional dwelling units".
      // A commercial or institutional project has no inclusionary requirement
      // for No Net Loss to raise, so the row cannot reach it however many units
      // the query string carries. Guarded to match the IZ gate above, which is
      // already `isResidential && units >= 50`; mixed-use still fires.
      // Under-fire the source names and this gate does not model: the duty is
      // sized by the NUMBER of 50-plus-year-old units demolished, which we do
      // not carry — the note states the rule rather than computing a figure.
      if (isResidential && units >= 100 && demolishesDwellings && (age == null || age >= 50)) {
        hurdles.push({
          category: 'demolition',
          label: 'No net loss: demolishing 50-year-old units raises a replacement duty',
          sizeDependent: true,
          status: 'required',
          note:
            age == null
              ? 'A project of 100 or more units that demolishes existing dwelling units 50 or more years old owes, as its inclusionary requirement, the GREATER of 8% of the units in the project or the number of 50-plus-year-old units being demolished (Minneapolis Unified Housing Policy § III(A)(1)(viii), "No Net Loss", applied through Minneapolis Code of Ordinances § 550.810). Demolish 40 old units inside a 150-unit project and you owe 40 affordable units, not 12 — and the cash-in-lieu alternative scales up with it. The record shows no year built for the existing building here — confirm its age early, because the rule turns on it.'
              : `A project of 100 or more units that demolishes existing dwelling units 50 or more years old owes, as its inclusionary requirement, the GREATER of 8% of the units in the project or the number of 50-plus-year-old units being demolished (Minneapolis Unified Housing Policy § III(A)(1)(viii), "No Net Loss", applied through Minneapolis Code of Ordinances § 550.810). Demolish 40 old units inside a 150-unit project and you owe 40 affordable units, not 12 — and the cash-in-lieu alternative scales up with it. The building here dates to ${yb}, so it is over that line; count the old units before you price the site.`,
        })
      }
    }

    // ABSENCE: no local prevailing-wage rule reaches a privately financed job.
    hurdles.push({
      category: 'labor',
      label: 'No prevailing-wage rule for privately financed projects',
      status: 'info',
      note: 'Minneapolis imposes no prevailing-wage or living-wage requirement on privately financed construction — its living-wage ordinance reaches only City contracts for services valued at $100,000 or more and City business subsidies valued at $100,000 or more (Minneapolis Code of Ordinances §§ 38.30, 38.40). The mirror image is the thing to watch: the moment you take tax increment financing, a land write-down, a fee deferral, city bonds or any other subsidy worth $100,000 or more, the living wage and the business-subsidy agreement attach. Minneapolis’s citywide minimum wage (Ch. 40, art. IV) is a separate rule that does cover every hour worked inside city limits, though it rarely binds on skilled construction trades.',
    })

    hurdles.push({
      category: 'environmental',
      label: 'Mississippi River Corridor Critical Area overlay',
      status: 'info',
      note: 'Parcels inside the MR Mississippi River Corridor Critical Area overlay carry a second layer on top of base zoning: the MRCCA sub-districts impose their own structure height and placement limits and lot sizes (§ 535.1650), plus vegetation-management, land-alteration/stormwater and exterior-lighting standards, and a permit is required for construction of buildings or additions, sewage-system work, vegetation removal and land alteration (Minneapolis Code of Ordinances §§ 535.1610, 535.1620(a), 535.1650, adopted under Minn. Stat. ch. 116G and Minn. R. 6106.0010–6106.0180). A variance needs extra written findings — no harm to primary conservation areas, public river corridor views, or birds using the Mississippi Flyway — beyond the ordinary variance test, and subdivisions or master-planned development of five or more acres face additional design standards (§ 535.1710). The trigger is geographic, not size — check the river corridor boundary on the zoning map (§ 530.800) before assuming the base district’s height applies.',
    })
  } else if (city === 'philadelphia') {
    // The Philadelphia Code (Title 14 zoning, Title 19 taxes, Title 4 Subcode
    // "A" administrative), read on American Legal, plus the PWD manual.
    // Table 14-304-2 has TWO cases, and the truncated table carried only the
    // first. Case 1 is citywide at >100,000 sq ft / >100 units. Case 2 HALVES
    // both figures (>50,000 sq ft / >50 units) where the site "affects" a
    // property in a Residential district — shares a side or rear line, is
    // separated only by an alley, or is within 200 ft on the same or facing
    // blockface (§ 14-304(5)(b)(.2)). We hold no adjacency data, so the halved
    // band is 'likely' with the condition named, not asserted.
    //
    // Two qualifiers sit ahead of both cases and neither was implemented.
    // (a) Each case requires "new construction or an expansion" and counts only
    //     floor area / units created OUTSIDE an existing structure — Table
    //     14-304-2 excludes "any floor area within an existing structure" and
    //     "any dwelling units within an existing structure". A change of use
    //     inside an existing building creates neither, so it cannot meet either
    //     case however large the building is.
    // (b) Both cases open "located in any district, except as provided in
    //     § 14-304(5)(b)(.1)" — SP-ENT, SP-PO and SP-STA are excluded outright.
    // The industrial exclusion is "certain I-1/I-2/I-3/I-P buildings" — the
    // source qualifies it with "certain", so it stays in the note rather than
    // becoming a gate we would have to invent the boundary of.
    const phlDistrict = parcel.zoning.districtCode ?? ''
    const cdrEligible = project.projectType !== 'change_of_use' && !/^SP-(ENT|PO|STA)\b/i.test(phlDistrict)
    const cdrCase1 = cdrEligible && (project.gfa > 100000 || (isResidential && units > 100))
    const cdrCase2 = cdrEligible && (project.gfa > 50000 || (isResidential && units > 50))
    // § 14-303(12)(a)(.3) and § 18-502(2)(c) both trigger on "meets the
    // requirements for Civic Design Review in § 14-304(5)" — which is Case 1 OR
    // Case 2. Reading only Case 1 made both rows NARROWER than their source: a
    // 60-unit project in the halved band was never told RCO notice or a Project
    // Information Form might apply at all. Case 2 turns on adjacency we do not
    // hold, so that arm carries the CDR row's own 'likely', not 'required'.
    if (cdrCase1 || cdrCase2) {
      hurdles.push({
        category: 'review',
        label: 'Civic Design Review',
        sizeDependent: true,
        status: cdrCase1 ? 'required' : 'likely',
        note: cdrCase1
          ? 'New construction or expansion creating more than 100,000 sq ft of new gross floor area — or more than 100 additional dwelling units, in either case excluding anything inside an existing structure — must go through Civic Design Review, including a public meeting, before permits (Phila. Code § 14-304(5)(b) and Table 14-304-2). The threshold halves to 50,000 sq ft or 50 units where the site affects a property in a Residential district. Review is advisory (§ 14-304(5)(d)), but L&I cannot issue a final decision and the Zoning Board cannot open a hearing until it completes; the code’s only stated duration is a backstop — a good-faith applicant is deemed complete at 150 days. SP-ENT, SP-PO and SP-STA districts, certain I-1/I-2/I-3/I-P industrial buildings, and wireless facilities are excluded.'
          : 'This project is over 50,000 sq ft of new gross floor area or over 50 additional dwelling units, which is the HALVED Civic Design Review threshold that applies where the property affects a property in any Residential district — sharing a side or rear lot line, separated only by an alley, or within 200 ft on the same or facing blockface (Phila. Code § 14-304(5)(b) and Table 14-304-2, Case 2; definition at § 14-304(5)(b)(.2)). It is below the 100,000 sq ft / 100-unit citywide trigger, so whether CDR applies turns on that adjacency — confirm it. Review is advisory (§ 14-304(5)(d)), but L&I cannot issue a final decision until it completes.',
        addsMonths: 5,
      })
    }

    if (isResidential) {
      // Threshold restored: a "Residential Housing Project" is 10+ dwelling
      // units (or 20+ sleeping units), not any residential project.
      if (units >= 10) {
        hurdles.push({
          category: 'affordability',
          label: 'Mixed Income Neighborhoods (/MIN) overlay: mandatory affordable units',
          sizeDependent: true,
          status: 'likely',
          note: 'Inside the /MIN Mixed Income Neighborhoods overlay, a development of 10 or more dwelling units (or 20 or more sleeping units), alone or combined with closely related development, must make at least 15% of dwelling units affordable ON SITE, and 20% of dwelling units and 20% of sleeping units affordable overall (Phila. Code § 14-533(2), § 14-533(3)(a)–(b)). The extra 5% can be shifted off-site within a half mile, or bought out, only with a Department of Planning and Development waiver for "exceptional circumstances". The in-lieu payment is $9 per sq ft of maximum permitted gross floor area in RM-2/3/4, RMX-1/2/3, IRMX and CMX-3/4/5, or $10,900 per permitted dwelling unit in RM-1, CMX-1, CMX-2 and CMX-2.5. Exempt: developments where under 25% of gross floor area is residential, institution-owned student housing, and personal care homes. The overlay is mapped to parts of the 3rd Council District (University City / West Philadelphia) and several 7th District areas (Kensington/Fairhill, Frankford/Oxford Circle, Hunting Park), plus lots in both the /TOD overlay and the 7th District — confirm whether your parcel is inside the mapped boundaries, because outside them none of this applies.',
        })
      }

      // ABSENCE, and the headline for Philadelphia: the /MIN overlay aside,
      // affordability is bought with bonuses, never mandated.
      hurdles.push({
        category: 'affordability',
        label: 'No citywide inclusionary mandate',
        status: 'info',
        note: 'Outside the /MIN overlay, Philadelphia sets no affordable-unit mandate at any project size. Affordability is voluntary and traded for extra floor area under the Mixed Income Housing bonus (Phila. Code § 14-702(7)(a)).',
      })

      hurdles.push({
        category: 'fees',
        label: 'Development Impact Tax: 1% of construction cost',
        status: 'required',
        note: 'Philadelphia levies a Development Impact Tax of $1.00 per $100 of construction or improvement costs — a flat 1% — on any building permit for a structure for human occupancy for residential purposes (Phila. Code § 19-4402(1), ch. 19-4400, added by Bill No. 200556, effective January 1, 2022 for permit applications filed on or after that date). There is no floor-area or unit-count threshold and no small-project exemption. Half is due when the building permit issues and half at the certificate of final inspection. Non-residential construction is not taxed; in a mixed-use building the tax reaches only the costs attributable to the residential portion, including its common space. Proceeds go to the Housing Trust Fund. Exemptions are use-based (§ 19-4401(3)): improvements ineligible for real-estate tax exemption under §§ 19-1303.2/.3/.4, property exempt under 72 P.S. § 5020-204 or the Keystone Opportunity Zone Act, turn-over improvements to an existing rental unit, and certified City-funded affordable projects.',
      })
    }

    // NOT discretionary-only. § 14-303(12)(a) lists FOUR triggers and the
    // truncated table carried one: a ZBA special exception or variance, OR
    // meeting the Civic Design Review criteria of § 14-304(5), OR a /NCO
    // Commission building-permit review, OR /UCO Planning Commission approval.
    // The CDR arm makes this fire on a purely as-of-right, size-triggered
    // permit — so when it fires that way it is size-gated and tagged as such.
    if (discretionary || cdrCase1 || cdrCase2) {
      hurdles.push({
        category: 'review',
        label: 'RCO neighborhood notice and public meeting',
        status: discretionary || cdrCase1 ? 'required' : 'likely',
        ...(discretionary ? {} : { sizeDependent: true }),
        note: `${
          discretionary
            ? 'An application needing Zoning Board approval — a special exception under § 14-303(7) or a variance under § 14-303(8) — must be noticed to the Registered Community Organizations covering the parcel, and a public meeting held, before the hearing'
            : cdrCase1
              ? 'This project meets the Civic Design Review criteria of § 14-304(5), which is an independent trigger for RCO notice even on an as-of-right permit: the parcel must be noticed to the Registered Community Organizations covering it, and a public meeting held'
              : 'This project sits in the HALVED Civic Design Review band (Table 14-304-2, Case 2), which applies only where the property affects a property in a Residential district. If it does, the project meets the Civic Design Review criteria of § 14-304(5) — an independent trigger for RCO notice even on an as-of-right permit — and the parcel must be noticed to the Registered Community Organizations covering it, with a public meeting held. Confirm the adjacency, because the whole row turns on it'
        } (Phila. Code § 14-303(12)(a), (b)(.4), (e)(.1)). The Planning Commission names a Coordinating RCO, and you must mail written notice to every RCO covering the site, the district Councilmember, and every property within 250 ft plus the whole blockface and the facing blockface. The Coordinating RCO convenes the public meeting — which you or your representative must attend — within 45 days of the appeal filing or of L&I’s notice that CDR is required, and Civic Design Review will not meet on your application until you document that it happened. Practically, the district Councilmember’s involvement is the point: councilmanic prerogative means their read of that meeting often decides a project.`,
      })
    }

    // Floor-area trigger → sizeDependent (rule 1). The 2,500 sq ft figure is
    // only HALF the trigger: § 18-502(2) is conjunctive — a covered development
    // project is over 2,500 sq ft AND requires a Council ordinance/resolution,
    // a ZBA special exception or variance, or meets the CDR criteria. The
    // truncated table lost the second half, so this fired on size alone.
    const pifExemptSmallResidential = project.use === 'residential' && units >= 1 && units <= 3
    if (project.gfa > 2500 && (discretionary || cdrCase1 || cdrCase2) && !pifExemptSmallResidential) {
      hurdles.push({
        category: 'review',
        label: 'Project Information Form (Chapter 18-500)',
        sizeDependent: true,
        status: discretionary || cdrCase1 ? 'required' : 'likely',
        note: `A structure — or a resulting structure — of more than 2,500 sq ft gross floor area is a "covered development project" and must file a sworn Project Information Form when it ${
          discretionary
            ? 'requires a Zoning Board special exception or variance'
            : cdrCase1
              ? 'meets the Civic Design Review criteria of § 14-304(5)'
              : 'meets the Civic Design Review criteria of § 14-304(5) — which here depends on the halved Case 2 threshold, so it applies only if the property affects a property in a Residential district; confirm that adjacency'
        }; a Council ordinance or resolution is a third trigger (Phila. Code § 18-502(2), § 18-503, ch. 18-500). Purely residential developments of three or fewer dwelling units are exempt, as are signage-only applications. The form must state net change in units and floor area, projected construction period, parking, any bonuses sought, stormwater and remediation plans, and headcount and wage ranges for construction and permanent jobs. Civic Design Review will not meet on the project until the form is delivered, and Council cannot pass an enabling ordinance unless it is filed 10 days before the hearing and attached to the bill. It is published on the City’s website and stays there five years.`,
      })
    }

    // Earth-disturbance area, approximated by lot area. Tagged sizeDependent
    // per the research row; the tag only ever downgrades, so it fails closed.
    if (lotSqFt >= 5000) {
      hurdles.push({
        category: 'environmental',
        label: 'Water Department stormwater review',
        sizeDependent: true,
        status: 'likely',
        note: 'Disturbing 5,000 sq ft or more of earth requires an erosion-and-sediment control plan submission and Water Department stormwater review; 15,000 sq ft or more of earth disturbance triggers the full Post-Construction Stormwater Management requirements in most of the city, dropping to 5,000 sq ft in the Darby and Cobbs Creek watershed (Phila. Code § 14-704(3)(a)(.1), (b), which delegates the threshold to PWD regulation; figures from the PWD Stormwater Management Guidance Manual ch. 1 § 1.1.3). No zoning or building permit issues until PWD signs off, and the plan is deemed to comply if PWD fails to approve or disapprove within 45 days. Note the threshold is measured in EARTH DISTURBANCE area, not floor area — it turns on how much of the lot you touch, and lot size is only a proxy here. Demolition-only work is generally exempt from PCSM but still owes an E&S plan. This is the environmental gate on a Philadelphia project.',
      })
    }

    if (teardown) {
      hurdles.push({
        category: 'demolition',
        label: 'Licensed demolition contractor and 21-day posted notice',
        status: 'required',
        note: 'Demolition in Philadelphia must be carried out by a Demolition Contractor licensed under § 9-1008, and L&I issues a notice the contractor must post on EVERY street frontage; demolition cannot commence less than 21 days from the date of that initial posting (Phila. Code Title 4, Subcode "A" §§ A-303.1, A-303.2, A-303.2.1, A-303.3). The permit is valid only for the contractor named on it, so swapping contractors requires a permit amendment. A separate demolition permit is required wherever the work demolishes, moves or removes a structure greater than one story or greater than 500 sq ft (§ A-301.1). The posting — and with it the 21-day wait — has three stated exceptions: a structure L&I has declared imminently dangerous, a structure already posted under § 14-303(13), and a structure that was the subject of a Zoning Board variance. The Department also distributes an informational bulletin to every property within 250 ft, the district Councilmember, and any RCO covering the site. Plan the 21 days into the schedule — it runs before any machine moves.',
      })

      // The trigger has TWO parts: current-or-former religious use AND at least
      // 50 years old. An unknown year built must not wave it through (same rule
      // as the Minneapolis no-net-loss screen above); a building known to be
      // under 50 cannot be caught by it, so it is not raised.
      const phlYb = existing.ex?.yearBuilt
      const phlAge = phlYb == null ? null : new Date().getFullYear() - phlYb
      if (phlAge == null || phlAge >= 50) {
        hurdles.push({
          category: 'demolition',
          label: 'Demolishing a former house of worship: extra RCO review',
          status: 'info',
          note: `If the structure being demolished is currently, or was formerly, used as a church, synagogue, mosque or other religious facility AND is at least 50 years old, L&I may not issue the demolition permit until it notifies the district Councilmember and the RCO, receives confirmation that the RCO held a meeting to discuss the demolition within 30 days of that notice, and fully considers the RCO’s position (Phila. Code Title 4, Subcode "A" § A-303.5, added by Bill No. 220110, 2022). It applies on FORMER religious use, so a building long since converted to housing or offices can still be caught. ${
            phlYb == null
              ? 'The record shows no year built here — verify both the age and the use history before pricing a teardown.'
              : `The building here dates to ${phlYb}, so it clears the 50-year half of the trigger — verify the use history before pricing a teardown.`
          }`,
        })
      }

      hurdles.push({
        category: 'demolition',
        label: '/AHP overlay: no demolition without a replacement plan',
        status: 'info',
        note: 'On a lot inside the /AHP Affordable Housing Preservation overlay, no zoning or building permit issues for demolition of a principal building unless a building permit has ALREADY been issued for the construction, expansion or alteration of a principal building on the same lot (Phila. Code § 14-534(6)(b), (c)). It governs sequencing, not unit count — an anti-vacant-lot rule rather than a no-net-loss rule — and it supersedes any other demolition authorization, waived only for an L&I-declared imminently dangerous or unsafe condition. The overlay is five small areas of West Philadelphia around Market Street between roughly 39th and 46th Streets, plus a Sansom-to-Walnut block at 45th–46th; confirm whether your parcel is in it. (The separate temporary moratorium in the same section expired March 13, 2023.)',
      })
    }
  } else if (city === 'miami') {
    // City of Miami Code of Ordinances and Miami 21 (the zoning code), plus the
    // Miami-Dade County Code for the two county-wide impact fees and the 2025
    // Florida Statutes for the two state-level absences.
    // § 13-6's own exemption is a net-increase test, not a use test: a building
    // permit for "additions, remodels, rehabilitation or other improvements to
    // an existing structure and reconstruction of a demolished structure which
    // result in ... no net increase in the number of residential dwelling
    // units" pays nothing. The gate read residential use alone. Not tagged
    // sizeDependent — the research row states False, and this is a zero /
    // non-zero applicability test rather than a magnitude threshold.
    if (isResidential && units >= 1) {
      hurdles.push({
        category: 'fees',
        label: 'City of Miami development impact fees',
        status: 'required',
        note: 'Any new development producing a net increase in dwelling units pays FOUR separate City of Miami impact fees, collected before the building permit issues (City of Miami Code §§ 13-6, 13-7, 13-9, 13-10, 13-11, 13-12; Ord. No. 12750, adopted 12-15-2005 — Chapter 13 carries no CPI escalator, so these remain the operative amounts). There is no size threshold, but the per-unit rate tiers by units per building. In a building of 10 or more units ("high rise") each unit pays police $95.00 + fire-rescue $409.00 + general services $239.00 + parks and recreation $3,959.00. In a 3–9-unit building ("low rise") each unit pays $144.00 + $619.00 + $363.00 + $5,998.00. A single-family detached house pays $164.00 + $704.00 + $413.00 + $6,818.00. A remodel or addition with no net increase in dwelling units is exempt.',
      })
    }

    if (isResidential) {
      // Kept on residential use rather than a net-unit test: § 33K-5 is charged
      // per new unit BUT the same section reaches "expansions of existing
      // units", so a residential job adding floor area and no units can still
      // owe it. Narrowing this to units >= 1 would under-fire.
      hurdles.push({
        category: 'fees',
        label: 'Miami-Dade educational facilities impact fee',
        status: 'required',
        note: 'Any building permit for new residential development anywhere in Miami-Dade County pays the county’s educational facilities impact fee, on top of the city’s own fees, and the city cannot issue the permit until it is paid (Miami-Dade County Code §§ 33K-1(c), 33K-5, 33K-6; § 33K-5 amended by Ord. No. 22-26, 3-1-2022). The codified formula is: new unit size in square feet × $0.90 + a $600.00 base fee + a 2% administrative fee. The county presumes units larger than 3,800 sq ft create no additional school impact, so the square-footage component effectively tops out there. A ~900 sq ft apartment therefore carries roughly $1,400; a 2,500 sq ft house roughly $2,900. It is also charged on conversions from non-residential to residential and on expansions of existing units.',
      })

      // ABSENCE: no affordability mandate at any size anywhere in the city.
      hurdles.push({
        category: 'affordability',
        label: 'No mandatory inclusionary requirement',
        status: 'info',
        note: 'Miami sets no affordable-unit mandate and no linkage fee at any project size — no unit count or floor area triggers an affordability obligation on a base-zoned project. Miami 21’s housing provisions are all opt-in incentive programs you qualify INTO in exchange for extra height, density or parking relief: § 3.15 (Affordable and Attainable Mixed-Income Housing Special Benefit Program), § 3.14 (Public Benefits), § 3.16.A/B (Workforce Housing) and § 3.19 (Transit Station Neighborhood Development). Building at base zoning triggers none of them. Florida law is the structural reason: a municipality imposing inclusionary zoning or a linkage fee must "provide incentives to fully offset all costs to the developer" (Fla. Stat. § 166.04151(4) (2025)). A vestigial Affordable Housing Trust Fund contribution survives in City Code § 13-8.2 but cross-references section 914 of Ordinance 11000 — the code Miami 21 replaced in 2010.',
      })
    }

    hurdles.push({
      category: 'fees',
      label: 'Miami-Dade multimodal mobility impact fee',
      status: 'required',
      note: 'Every building permit application for development activity in Miami-Dade County pays the county’s multimodal mobility impact fee, and the CITY cannot issue your building permit until it is paid (Miami-Dade County Code §§ 33E-2(c), 33E-6, 33E-7.1, 33E-8; Ord. No. 23-68, adopted 9-6-2023). It is charged per dwelling unit for residential: under the adopted rate schedule in § 33E-8 a multifamily unit (mid-rise or high-rise) runs $4,465 in Context Zone 2, $4,638 in Context Zone 1 (the SMART Plan corridors), $4,901 in Context Zone 3 and $5,115 in Context Zone 4 — which of the four zones applies is set by the parcel’s location under § 33E-7.1. This is a county charge and is separate from the city’s impact fees.',
    })

    hurdles.push({
      category: 'fees',
      label: 'Downtown DRI supplemental fee (Downtown Miami only)',
      status: 'info',
      note: 'Net new development inside the Downtown Development of Regional Impact area pays a fourth layer of fee on top of the city and county impact fees, charged per gross square foot of floor area so it scales with the building (City of Miami Code §§ 13-55, 13-56, 13-56.1). The imposing provision opens with an exception in as many words — "Except as may be provided section 13-58, no zoning permits, building permits or other development permits shall be issued for any net new development ... unless the applicant has paid the downtown development supplemental fee" — and § 13-58 was NOT read here, so treat the fee as presumptively owed but check that section before assuming it is unavoidable. The codified residential coefficient is $0.3846 per gross sq ft — transportation mitigation $0.1531 + master-plan recovery $0.156223 + DRI administration $0.07521 — but § 13-56.1 escalates every fee by CPI each March 1 since 2018, capped at 10% a year, so the amount actually collected today is materially higher than the codified figure; confirm the current published coefficient with the Planning Department rather than budgeting the codified one. It applies only downtown — confirm whether your parcel is inside the DRI boundary. A parallel supplemental fee exists for the Southeast Overtown/Park West area under §§ 13-96 et seq.',
    })

    // Floor-area trigger → sizeDependent (rule 1).
    if (project.gfa > 200000) {
      hurdles.push({
        category: 'review',
        label: 'Urban Development Review Board referral (200,000 sq ft)',
        sizeDependent: true,
        status: 'likely',
        note: 'Projects exceeding 200,000 sq ft of floor area are referred to the Urban Development Review Board — nine architects and landscape architects who review and recommend on design — as may any project the Planning Director deems necessary (Miami 21 § 7.1.1.2(10); City of Miami Code ch. 62, art. IX, §§ 62-256 to 62-259). The code frames this as a Director power rather than an automatic requirement, which is why it reads "likely" and why a smaller project can be referred at will. The same 200,000 sq ft figure also forces a Warrant or Exception application to the Coordinated Review Committee (§§ 7.1.2.4, 7.1.2.6). Otherwise Miami’s design review is light: there is no mandatory design-review board for an ordinary by-right building and Administrative Site Plan Review is explicitly optional (§ 7.1.2.10).',
      })
    }

    // ABSENCE, and the biggest single difference from the California cities:
    // Florida has no CEQA/SEPA analogue for an ordinary city project.
    hurdles.push({
      category: 'environmental',
      label: 'No state environmental review act',
      status: 'info',
      note: 'Florida has no state environmental review statute of the CEQA or SEPA kind. The absence is conditional, not flat, and § 380.06(12)(a) states the condition: a proposed development that EXCEEDS the statewide guidelines and standards of Fla. Stat. § 380.0651, and is not otherwise exempt, must still be approved by the LOCAL government under Fla. Stat. § 163.3184(4) — and only where the development is consistent with the comprehensive plan (§ 163.3194(3)(b)) does even that review drop away (Fla. Stat. § 380.06(12)(a) (2025), as rewritten by ch. 2018-158). For a Miami project consistent with the Miami Comprehensive Neighborhood Plan there is no state-level environmental or regional-impact review to run at all, which removes what is usually the largest schedule risk in the California and Washington cities — but consistency is the thing that buys it, not project type. Federal review (NEPA, Army Corps § 404) still applies where a federal permit or federal money is involved, and Miami-Dade County’s environmental code (ch. 24 — wetlands, mangroves, natural forest communities, tidal waters) is a separate permitting layer this tool does not model.',
    })

    hurdles.push({
      category: 'environmental',
      label: 'Tree removal permit and replacement / Tree Trust Fund',
      status: 'likely',
      note: 'Any tree activity on any property in the city — public or private — needs a permit before you clear a site, with replacement trees or a payment into the Tree Trust Fund (City of Miami Code §§ 17-3, 17-4, 17-6 and Chart 17.6.1.1). The applicability clause is qualified in as many words — the article applies to all public or private property in the city "unless expressly exempted by law" — and that exemption list was NOT read here, so confirm whether a particular tree is exempt rather than assuming every tree on the lot is covered. Removal is priced on a sliding scale by the summed diameter of what you take out: a single 13"–18" DBH tree requires six 2"-caliper replacement trees, or three 4"-caliper trees, or a $6,000.00 contribution to the Tree Trust Fund; 49"–60" requires 20 trees, 10 trees, or $20,000.00, and totals above 60 inches accumulate from the top of the chart down. On a mature Coconut Grove or Shenandoah lot this is a real line item. The trigger is the trees on your site, not the size of the building. Trees in an Environmental Preservation District (ch. 17, art. II) or in a Miami-Dade natural forest community or wetland carry additional county review under ch. 24 of the county code.',
    })

    if (teardown) {
      // § 23-6.2(b)(4)b.4's deferral has TWO arms and only the second is
      // citywide. The six-month arm applies to "demolition or relocation of a
      // contributing structure or landscape feature" — inside a designated
      // historic district or site, since that is what "contributing" is
      // contributing TO, and the certificate of appropriateness the deferral
      // attaches to is itself required only there (§ 23-6.2(a)). The gate read
      // `teardown` alone, so every Miami teardown in the city was told a
      // six-month historic delay was 'likely'. The 45-day archaeological arm
      // does reach any ground-disturbing work, so it keeps a row of its own
      // rather than disappearing with the district test.
      if (parcel.overlays.historicDistrict) {
        hurdles.push({
          category: 'demolition',
          label: 'Historic demolition delay',
          status: 'likely',
          note: 'This parcel is in a designated historic district, so demolishing or relocating a CONTRIBUTING structure or landscape feature here can be delayed while alternatives are explored: the HEPB may approve the demolition but defer the effective date of that approval by up to six months (City of Miami Code § 23-6.2(b)(4)b.4). Ground-disturbing work touching an archaeological site, zone or conservation area can be deferred up to 45 calendar days on the same mechanism. Both are stated CEILINGS, not scheduled durations, so no fixed delay is added to the timeline here. Confirm whether the existing building is contributing — a non-contributing building in the district is not reached by the six-month arm.',
        })
      } else {
        hurdles.push({
          category: 'demolition',
          label: 'Archaeological zone: certificate to dig and possible deferral',
          status: 'info',
          note: 'This parcel is not in a designated historic district, so the six-month HEPB demolition deferral — which reaches contributing structures in a designated district or site — does not apply. The other arm of the same provision does not depend on a district: a certificate to dig is required for any ground-disturbing activity within a designated archaeological site, archaeological zone or archaeological conservation area, and the HEPB may defer the effective date of that approval by up to 45 calendar days (City of Miami Code § 23-6.2(a), (b)(4)b.4). The designated zones cover substantial stretches of the Miami River, Brickell and the Biscayne Bay shoreline, so a teardown-and-rebuild near the water should check the archaeological map before assuming clear ground. This is a stated CEILING, not a scheduled duration, so no delay is added to the timeline here.',
        })
      }

      // ABSENCE: unusual among the cities we cover, and it cuts the other way —
      // no tenant-relocation duty on a Miami teardown outside a historic
      // district. The trigger says "outside a designated historic district" in
      // as many words; inside one, demolition runs the certificate-of-
      // appropriateness process above and the absence is not the whole story.
      if (existing.rentalMultifamily && !parcel.overlays.historicDistrict) {
        hurdles.push({
          category: 'demolition',
          label: 'No tenant relocation or replacement-housing requirement',
          status: 'info',
          note: 'Demolishing occupied rental housing outside a designated historic district triggers no city relocation payment, no no-net-loss replacement duty, and no conditional-use hearing of the kind SF Planning Code § 317 or LA’s RSO/Ellis Act impose — the opposite of the rule in most cities we cover. Chapter 47, the code’s entire rental-housing chapter, consists of one article, and what it requires is 30 days’ written notice to terminate a month-to-month tenancy; beyond that it defers to Fla. Stat. ch. 83 (City of Miami Code ch. 47, art. I, § 47-1, read with Fla. Stat. § 166.043(1)(a) (2025)). Nor is there rent stabilization to trigger — Florida preempts local price controls on lawful business activity. A Miami teardown is a demolition-permit-and-abatement problem, not an entitlement problem.',
        })
      }
    }

    // ABSENCE: state law confines prevailing wage to public work.
    hurdles.push({
      category: 'labor',
      label: 'No local prevailing-wage rule on private projects',
      status: 'info',
      note: 'Florida forbids cities and counties from imposing wage or benefit mandates on private employers, so Miami has no local prevailing-wage or living-wage rule reaching a privately financed residential project (Fla. Stat. § 218.077(2)–(3)(a) (2025)). Three carve-outs survive: the city’s own employees, employers under contract with the city, and — the one developers hit — employees of an employer receiving a direct tax abatement or subsidy from the political subdivision, as a condition of that abatement or subsidy. So the wage strings attach only if you take city money or a city abatement. Federal Davis-Bacon still applies to federally assisted work.',
    })
  } else if (city === 'sandiego') {
    // San Diego Municipal Code, read from the city-published PDFs on
    // docs.sandiego.gov (Ch. 12 CEQA; Ch. 13 art. 2 CPIO; Ch. 14 art. 2 divs. 5,
    // 6, 13; Ch. 14 art. 3 divs. 1, 2, 8, 11, 12). The parking row is carried by
    // PARKING_RULES['sandiego'] at the bottom of this function, not here.
    const inCoastalOverlay = !!parcel.overlays.coastalZone

    // The set-aside itself, stated once — it is the same either side of the
    // coastal threshold, and only the unit trigger moves (§ 142.1304 / § 142.1306).
    const SD_INCLUSIONARY_TERMS =
      'A rental project must set aside at least 10% of its units at 30% of 60% of median income, affordable for 55 years; a for-sale project 10% at median income or 15% at moderate income (§ 142.1304(a)–(b)). The alternative is the Inclusionary In Lieu Fee, which § 142.1306(a) sets at $25.00 per square foot of net market-rate building area effective July 1, 2024, escalated annually by the ENR Los Angeles Construction Cost Index — so today’s published rate is above $25.00 and must be confirmed with the City rather than assumed. A condominium conversion triggers the division at just 2 dwelling units. One caveat on the trigger itself: § 142.1302 applies the division "except as provided in Section 142.1303", and § 142.1303 was not read here — check it before assuming the requirement attaches to your project.'

    // The inclusionary threshold is 10 units — but 5 inside the Coastal Overlay
    // Zone, which is why the trigger reads off the overlay rather than a constant.
    if (isResidential && units >= (inCoastalOverlay ? 5 : 10)) {
      hurdles.push({
        category: 'affordability',
        label: 'Inclusionary Affordable Housing',
        sizeDependent: true,
        status: 'required',
        note: inCoastalOverlay
          ? `This parcel is in the Coastal Overlay Zone, where San Diego’s Inclusionary Affordable Housing requirement starts at 5 dwelling units instead of the citywide 10 (San Diego Municipal Code § 142.1302). ${SD_INCLUSIONARY_TERMS}`
          : `Residential development of 10 or more dwelling units is subject to San Diego’s Inclusionary Affordable Housing regulations; inside the Coastal Overlay Zone the threshold drops to 5 units (San Diego Municipal Code § 142.1302). ${SD_INCLUSIONARY_TERMS}`,
      })
    }

    // The exception is numeric, not vague: residential development of four or
    // fewer dwelling units is exempt outright, so this fires from the fifth unit.
    // Non-residential development has no unit exemption at all.
    if (!isResidential || units >= 5) {
      hurdles.push({
        category: 'fees',
        label: 'Mobility Choices (VMT) requirements',
        sizeDependent: true,
        status: 'required',
        note: 'Any development issued a building permit must satisfy San Diego’s Mobility Choices regulations, except residential development of four or fewer dwelling units — so a housing project hits this at 5 units (San Diego Municipal Code §§ 143.1102, 143.1103). You either build vehicle-miles-travelled reduction measures worth 5 points in Mobility Zone 2 or 8 points in Mobility Zone 3 (Land Development Manual Appendix T), or pay the Active Transportation In Lieu Fee if the site is in Mobility Zone 4. Sites within a half-mile walk of an existing passenger rail station, and all of Downtown (Mobility Zone 1), are exempt. Watch the parking interaction: build MORE parking than the minimum and § 143.1103(b)(6)–(7) raises the requirement to 8 points (Zone 2) or 11 points (Zone 3), and expressly switches off the transit-priority-area zero-parking rule for that calculation. Fee amounts are set by City Council resolution, not in the code.',
      })
    }

    // Fires on the EXISTING structure's age, not on project size. An unknown
    // year built must NOT wave it through (same rule as Austin's 50-year screen).
    if (existing.hasBuilding) {
      const yb = existing.ex?.yearBuilt
      const age = yb == null ? null : new Date().getFullYear() - yb
      if (age == null || age >= 45) {
        hurdles.push({
          category: 'historic',
          label: '45-year historical screening',
          status: 'required',
          note:
            age == null
              ? 'The record shows an existing building here but no year built. In San Diego, any parcel carrying a structure 45 or more years old — or flagged on the Historical Resource Sensitivity Maps — must be screened for a site-specific historical survey before a construction or development permit issues (San Diego Municipal Code § 143.0212(a), (c)). The City Manager makes that call within 10 business days of a construction-permit application, or 30 calendar days of a development-permit application; if a survey is required and finds a historical resource, the project falls into the Historical Resources Regulations and a discretionary permit. Interior-only work and in-kind roof or foundation repair are exempt. Confirm the building’s age early, because the screening sits ahead of the permit.'
              : `This parcel’s existing building dates to ${yb}, so it is 45 or more years old — San Diego screens it for a site-specific historical survey before a construction or development permit issues (San Diego Municipal Code § 143.0212(a), (c)). The City Manager decides whether a survey is needed within 10 business days of a construction-permit application, or 30 calendar days of a development-permit application; if the survey finds a historical resource, the project falls into the Historical Resources Regulations and a discretionary permit. This is not limited to designated landmarks or historic districts.`,
        })
      }
    }

    // Historical resource present. § 143.0210(e)(2)(B) reaches "Multiple dwelling
    // unit residential, COMMERCIAL, OR INDUSTRIAL development on any size lot, or
    // any subdivision on any size lot" — the residential-only gate here was
    // NARROWER than the code and left a commercial project on a historical-resource
    // parcel with no Process Four row at all. Tagged sizeDependent because the
    // residential limb reads a unit count (rule 1); the tag only ever downgrades,
    // so it fails closed.
    if (parcel.overlays.historicDistrict && ((isResidential && units >= 2) || isCommercial)) {
      hurdles.push({
        category: 'historic',
        label: 'Site Development Permit (Process Four) where a historical resource is present',
        sizeDependent: true,
        status: 'required',
        note: 'Multiple-dwelling-unit residential, commercial or industrial development on premises holding a historical resource — and any subdivision — needs a Site Development Permit decided through Process Four: a Planning Commission public hearing, appealable to the City Council (San Diego Municipal Code § 143.0210(e)(2), (e)(2)(B); Process Four defined at § 112.0507). Lot size does not matter: the code says "on any size lot". The only carve-outs on this row are capital improvement program projects, public projects and project-specific land use plans, none of which a private development is. And § 143.0210(b) applies the division to the WHOLE premises if any portion of it contains historical resources, so a resource in one corner pulls the entire site in. Separate exemptions at § 143.0220 were not read here — check them before assuming the permit is unavoidable.',
      })
    }

    // The permit assignment we actually read is Table 143-01A ROW 3, which covers
    // MULTIPLE DWELLING UNIT development. Firing this on a single-dwelling or a
    // commercial project would publish a Process Three claim off a row nobody
    // read (rule 5: a gap must not render as an answer). The site conditions
    // themselves — biological resources, steep hillsides, coastal bluffs — are
    // not in any dataset we hold, so the copy stays conditional on them.
    if (isResidential && units >= 2) {
      hurdles.push({
        category: 'environmental',
        label: 'Environmentally Sensitive Lands: Site Development Permit',
        sizeDependent: true,
        status: 'likely',
        note: 'If any portion of the premises contains sensitive biological resources, steep hillsides, coastal beaches (including V zones), sensitive coastal bluffs, or a FEMA Special Flood Hazard Area (except V zones), multiple-dwelling-unit development needs a Site Development Permit decided through Process Three — a Hearing Officer at a public hearing, appealable to the Planning Commission (San Diego Municipal Code § 143.0110(a), (b)(1), Table 143-01A row 3; Process Three at §§ 112.0505, 112.0506). Any deviation from the ESL regulations pushes the permit up to Process Four. The trigger is what is on the ground, not project size — and note that a FEMA A-zone designation here is not just a build-higher problem, it is a discretionary hearing, which is what pulls CEQA in. Row 3 is the multiple-dwelling-unit row; other development types sit on rows this analysis has not read.',
      })
    }

    // CEQA attaches to DISCRETIONARY approvals, and § 128.0202(b) says so from
    // the other direction: an activity is not subject to CEQA if it does not
    // involve the exercise of discretionary powers. An unconditional row told
    // every as-of-right San Diego project it carried environmental review.
    if (discretionary) {
      hurdles.push({
        category: 'environmental',
        label: 'CEQA environmental review',
        status: 'likely',
        note: 'The California Environmental Quality Act attaches to any private activity needing a discretionary City approval — a development permit, a use permit, a variance (San Diego Municipal Code § 128.0202(a)(3), (b)). § 128.0202(b) states the converse: an activity is not subject to CEQA if it does not involve the exercise of discretionary powers, so a project that clears entirely as-of-right carries no CEQA document. Watch what can push you off the ministerial path even when the zoning works: a Site Development Permit for environmentally sensitive lands, a historical resource on the premises, a CPIO "Type B" mapping, or any deviation from a development regulation.',
      })
    }

    if (teardown && (existing.exUnits > 0 || existing.multifamilyExisting)) {
      hurdles.push({
        category: 'demolition',
        label: 'Dwelling Unit Protection: no net loss and protected units',
        status: 'required',
        note: 'Any development with a complete application filed on or after January 1, 2020 that demolishes existing dwelling units runs San Diego’s Dwelling Unit Protection rules, and there is no unit threshold (San Diego Municipal Code §§ 143.1203, 143.1210). Before a demolition permit issues you must record a covenant guaranteeing the replacement project holds at least as many dwelling units as the most recent permitted development on the premises. On top of that, if any demolished unit is "protected" — rent-restricted, or simply rented by a very low or low income household at any point in the preceding five years (seven in Barrio Logan) — § 143.1212 requires one-for-one replacement at the same bedroom count and the same or lower income category, affordable for 55 years, plus tenant relocation benefits and a right of first refusal (definition at § 143.1207). The five-year lookback runs on who lived there, not on anything recorded against title, so an ordinary older rental building can be protected with no warning on the deed.',
      })

      // Two thresholds, not one: a single structure of 3+ units, OR 5+ units
      // where two or more structures are involved (§ 143.0815(b)(3)). With more
      // than one building on the premises, four units across them is below both.
      const coastalReplacementTrigger =
        (existing.ex?.numBuildings ?? 1) >= 2 ? existing.exUnits >= 5 : existing.exUnits >= 3
      if (inCoastalOverlay && coastalReplacementTrigger) {
        hurdles.push({
          category: 'demolition',
          label: 'Coastal Overlay Zone affordable housing replacement',
          sizeDependent: true,
          status: 'required',
          note: 'Inside the Coastal Overlay Zone, demolishing a residential structure of 3 or more dwelling units — or at least 5 dwelling units where two or more structures are involved — triggers a separate replacement-housing review under the City’s implementation of California Government Code § 65590, the Mello Act (San Diego Municipal Code § 143.0815(b)(3)). § 143.0830(a) prohibits converting or demolishing units occupied by very low, low or moderate income households unless replacement housing is provided; structures of fewer than three units, and four or fewer units on a multi-structure premises, are exempt (§ 143.0820(c)–(d)). This stacks on top of the citywide Dwelling Unit Protection Regulations rather than replacing them.',
        })
      }
    }

    // § 142.0640 exempts the FIRST TWO ADUs on a premises outright, so asserting
    // a required fee on an ADU project contradicts the ordinance for all but the
    // third-and-later ADU — a case no field on the record distinguishes.
    if (project.projectType !== 'adu') {
      hurdles.push({
        category: 'fees',
        label: 'Development Impact Fees for public facilities',
        status: 'required',
        note: 'Development in an area where the City has adopted Development Impact Fees pays them toward parks, mobility, library and fire facilities, and the final inspection will not occur until they are paid (San Diego Municipal Code § 142.0640(b)). There is no size threshold in the code, and the code states no amounts either — they are adopted separately by City Council resolution (e.g. R-313688 for the Citywide Park DIF), so no dollar figure should be taken from the ordinance. Exemptions written into the code: the first two ADUs on a premises, permanent supportive housing, low-barrier navigation centers, transitional housing, and inclusionary units provided on the same premises as the market-rate units.',
      })
    }

    hurdles.push({
      category: 'review',
      label: 'Community Plan Implementation Overlay Zone (CPIO)',
      status: 'info',
      note: 'A parcel mapped "Type B" in a Community Plan Implementation Overlay Zone needs a Site Development Permit decided through Process Three (Hearing Officer, public hearing, appealable to the Planning Commission) regardless of project size; a "Type A" parcel needs one only if the project does not comply with the community plan’s development criteria (San Diego Municipal Code § 132.1402(a)–(b), Table 132-14B rows (3) and (4)). Eighteen community plan areas carry the overlay — Uptown, Pacific Beach, Peninsula, Mission Valley, Kearny Mesa, Barrio Logan, Midway-Pacific Highway, University, Mira Mesa and Southeastern San Diego among them (Table 132-14A). Affordable, in-fill and sustainable-building projects can step down to a Neighborhood Development Permit under Process Two. The trigger is the mapping, not the project, and Type A versus Type B is on rezone maps filed with the City Clerk — confirm it per parcel.',
    })
  } else if (city === 'sanjose') {
    // San José Municipal Code, read from Municode's content API at Supp. No. 5,
    // Update 3 ("codified through Ordinance No. 31330, enacted June 16, 2026").
    // The parking row (Ch. 20.90 Part 8) is carried by PARKING_RULES['sanjose'],
    // and the Historic Preservation permit by HISTORIC_BODY['sanjose'] above.
    if (isResidential && units >= 20) {
      hurdles.push({
        category: 'affordability',
        label: 'Inclusionary Housing Ordinance (20+ units)',
        sizeDependent: true,
        status: 'required',
        note: 'A residential development of 20 or more new, additional or modified dwelling units is subject to San José’s Inclusionary Housing Ordinance; under 20 units there is no obligation at all, and density-bonus units are excluded from the count (San José Municipal Code §§ 5.08.250.A, 5.08.320.A.2, 5.08.400.A). The on-site requirement is 15% of for-sale units affordable at up to 120% of Area Median Income, or — for rental — 5% to moderate-income households, 5% at 60% AMI and 5% at 80% AMI. Off-site construction, in-lieu fee, land dedication and acquisition/rehab options exist (§§ 5.08.510–5.08.590), but taking an off-site route raises the basis to 20% of all units. Fee amounts are set by Council resolution, not in the code.',
      })
    }

    // Universal but for a narrow exception the code states for the smallest
    // residential case; framed the way Denver's Site Development Plan row is.
    if (!(isResidential && units > 0 && units <= 1)) {
      hurdles.push({
        category: 'review',
        label: 'Site Development Permit — a discretionary approval',
        status: 'required',
        note: 'Erecting or constructing a building in San José needs a Site Development Permit before any building permit issues, and that permit is a discretionary approval rather than a staff sign-off: the Director must set a public hearing, owners and occupants within 300 feet are noticed, and the decision is appealable to the Planning Commission and then the City Council (San José Municipal Code §§ 20.100.190.A, 20.100.610.A, 20.100.620). The code exempts one one-family dwelling on a single lot and certain one- and two-family dwellings under Ch. 20.30 Parts 8/9/9.5; everything else goes through it, so there is no as-of-right path for a new apartment building outside the ministerial routes in Ch. 20.195. This — not a separate large-project review — is the discretionary gate.',
      })
    }

    // CEQA rides on the Site Development Permit, so it has to carry the SDP's
    // own exception: the single one-family dwelling that § 20.100.610.A exempts
    // takes no discretionary approval, and § 21.04.010.A attaches CEQA to
    // discretionary approvals. Firing here where the SDP row does not would be
    // an environmental-review claim with nothing discretionary under it.
    if (!(isResidential && units > 0 && units <= 1)) {
      hurdles.push({
        category: 'environmental',
        label: 'CEQA environmental review',
        status: 'likely',
        note: 'CEQA attaches to discretionary approvals (San José Municipal Code § 21.04.010.A) — and because a Site Development Permit is discretionary, an ordinary San José project carries environmental review with it rather than escaping it. The single one-family dwelling the SDP exempts, and the ministerial routes in Ch. 20.195, are the way out. Title 21 adopts CEQA wholesale, with local procedures for negative declarations (Ch. 21.06) and EIRs (Ch. 21.07) that are each separately appealable (§§ 21.06.020, 21.07.040). The code publishes no processing duration.',
      })
    }

    if (isResidential) {
      hurdles.push({
        category: 'fees',
        label: 'Stacked San José construction taxes',
        status: 'required',
        note: 'Every residential building permit in San José pays four separate construction taxes (San José Municipal Code §§ 4.46.050.A.1, 4.47.040.A.1, 4.54.050 and ch. 4.64). The two percentage taxes stack: 1.75% and 2.75%, each applied to 88% of the building official’s valuation — about 3.96% of assessed construction valuation. Both are levied on the building "or portion thereof" designed or intended for residential purposes, so on a mixed-use building the base is the residential portion, not the whole valuation; the non-residential rates sit elsewhere in §§ 4.46/4.47 and were not read here. On top of that, Ch. 4.54 charges $75–$150 per unit and Ch. 4.64 charges $90–$180 per unit, both sliding down as unit count rises. There is no size threshold; they apply from the first unit. Time-limited suspensions exist for downtown high-rises and for projects on the Council’s Multifamily Housing Incentive list, but those are programs you must qualify for, not the baseline.',
      })

      hurdles.push({
        category: 'fees',
        label: 'Park impact fee or land dedication',
        sizeDependent: true,
        status: 'required',
        note: 'No building permit issues for a residential unit until the park impact fee is paid, land is dedicated, or a parkland agreement is signed (San José Municipal Code §§ 14.25.300.A–B, 14.25.310.A–C). Chapter 14.25 catches the units that the subdivision-stage dedication under Ch. 19.38 does not, so between them every new unit is covered; only deed-restricted low- and moderate-income units are exempt (§§ 14.25.500, 14.25.510). The standard behind the fee is three acres of parkland per 1,000 residents; the schedule itself is adopted by Council resolution, so the code states no dollar amount.',
      })

      if (units >= 10) {
        hurdles.push({
          category: 'environmental',
          label: 'Green building certification (10+ units)',
          sizeDependent: true,
          status: 'required',
          note: 'A "large residential project" — 10 or more single-family or multi-family dwelling units in a non-high-rise building — must actually achieve LEED Certified or GreenPoint Rated certification, not merely file a checklist, and no building permit issues until a refundable green-building deposit (amount set by Council resolution) is paid or a Housing Department in-lieu guarantee is provided (San José Municipal Code §§ 17.84.113, 17.84.119, 17.84.121, 17.84.220.B–C, 17.84.300). Projects of 2–9 units are "tier one" and need only the completed checklist; high-rise residential must reach LEED Certified. Hardship modification is available from the Director under § 17.84.210.',
        })
      }
    }

    // 26 units for attached/multifamily; the single-family trigger is lower (16),
    // and the note says so rather than the code assuming the project's form.
    // OVER-fire, corrected: § 20.90.900.B.2's exemption list is written entirely
    // in HOME END USES — "fewer than 16 single-family detached housing units" or
    // "fewer than 26 units of all other home end uses" — so 26 is a residential
    // threshold. `units` arrives straight off the query string independent of
    // `use` (analyze.ts reads them separately), so an unguarded `units >= 26`
    // applied the home-end-use number to a wholly non-residential project. The
    // non-residential TDM thresholds sit on floor area and were not read here, so
    // there is nothing to assert for that case (rule 5: a gap must not render as
    // an answer). Mixed-use still fires — its dwellings are a home end use.
    if (isResidential && units >= 26) {
      hurdles.push({
        category: 'review',
        label: 'Transportation Demand Management (TDM) plan',
        sizeDependent: true,
        status: 'required',
        note: 'At 26 or more attached or multifamily units, San José requires a Transportation Demand Management plan filed with the initial permit application — the application is not deemed complete without it — and the plan must score at or above the point target set for the project level and use category in Table 20-255 (San José Municipal Code §§ 20.90.900.B.2, 20.90.905). A detached single-family project hits the same requirement at 16 units. A 100%-affordable project at 35 or more dwelling units per acre inside a High Quality Transit Area is exempt. Expect ongoing monitoring and enforcement obligations under §§ 20.90.915–20.90.920; this was the trade for repealing parking minimums, adopted in the same ordinance.',
      })
    }

    if (teardown) {
      hurdles.push({
        category: 'demolition',
        label: 'Demolition needs its own development permit',
        status: 'required',
        note: 'No demolition permit issues in San José until a development permit specifically approving the demolition has issued and become effective — it is a discretionary land-use approval, not a ministerial building-department action (San José Municipal Code §§ 20.80.440.A, 20.80.460, exemptions at § 20.80.450). The Director, or the Planning Commission or City Council on appeal, weighs benefits against impacts, expressly including whether the demolition maintains the city’s existing housing stock and whether rehabilitation would be feasible (criteria 4 and 6); where the building is a Multiple Dwelling or mobilehome park, criterion 8 requires evidence that all state and local tenant-relocation obligations have been met. The main exemption is a single-family home where building permits have already issued for a replacement single-family house.',
      })

      // Triggered by the EXISTING rental building, not by the new project's size
      // — and the ordinance reaches buildings of THREE or more units; one- and
      // two-unit buildings are outside it (§ 17.23.1150.C). exUnits === 0 means
      // the record does not state a count, so a rental-multifamily land use
      // still fires (fail-closed) rather than being waved through.
      if (existing.rentalMultifamily && (existing.exUnits >= 3 || existing.exUnits === 0)) {
        hurdles.push({
          category: 'demolition',
          label: 'Ellis Act withdrawal: 120-day notice',
          status: 'likely',
          note: 'Clearing an existing rental building of three or more units means withdrawing the WHOLE building from the rental market first — partial withdrawal is not allowed (San José Municipal Code §§ 17.23.1130.E–H, 17.23.1140.A, 17.23.1145, 17.23.1150.C). You pay the city filing fee, including relocation-specialist services, BEFORE serving notice; serve a Notice of Intent to Withdraw at least 120 days ahead; and record a memorandum encumbering the property for ten years. Where the units are rent-stabilized — a multiple dwelling with a certificate of occupancy issued on or before September 7, 1979 (§ 17.23.167.A) — you must also deposit base and qualified relocation assistance into escrow and grant tenants a right of return. Elderly, disabled and school-age-child households can extend past the 120 days. Relocation amounts are set by Council resolution and CPI-adjusted, so no figure is quoted here. The clock runs ahead of your application, so it lands at the front of the schedule; the 4 months reflects only the code’s published 120-day minimum notice.',
          addsMonths: 4,
        })
      }
    }

    if (isCommercial) {
      hurdles.push({
        category: 'fees',
        label: 'Commercial linkage fee (non-residential floor area)',
        status: 'info',
        note: 'San José charges an affordable-housing linkage fee on a non-residential project, or on the non-residential portion of a mixed project — the ground-floor retail or office component of a mixed-use building carries it (San José Municipal Code §§ 5.11.030.A, C–D, 5.11.040). It is an automatic condition of approval of the development permit whether or not the permit says so, payable before final building inspection, and escalated annually by the ENR San Francisco construction cost index. The rate varies by subarea and project type and is set by Council resolution, so the code states no dollar amount; shelter and hotel supportive housing and other uses are excepted under § 5.11.050. It is charged on the commercial floor area, not the housing.',
      })
    }

    hurdles.push({
      category: 'labor',
      label: 'Prevailing wage and 30% local hire — only if you take a City subsidy',
      status: 'info',
      note: 'San José imposes no prevailing-wage or skilled-workforce mandate on an ordinary privately financed housing project: the requirements attach to accepting a City "Subsidy" as the code defines it (San José Municipal Code §§ 14.10.110, 14.10.140, 14.10.180, 14.10.190.A–B, 14.10.200, 14.10.240–14.10.260). Read that definition carefully — it covers not only City land or money but any City reduction, permanent suspension or exemption of a fee or tax for the project, which potentially catches the downtown high-rise and Multifamily Housing Incentive construction-tax suspensions. Taking one brings Ch. 14.09 prevailing wage and apprenticeship rules, a good-faith target of 30% of total work hours performed by local residents (waived if Santa Clara County construction unemployment is at or below 4%), and a 25% underrepresented-worker apprentice target. De minimis assistance, 55-year deed-restricted affordable projects, and City housing projects under 8 units are carved out.',
    })

    // ABSENCE, and an unusual one: the ordinance exists and does nothing.
    hurdles.push({
      category: 'environmental',
      label: 'All-electric mandate: enacted but dormant',
      status: 'info',
      note: 'San José’s ban on natural-gas infrastructure in newly constructed buildings is on the books but suspended by its own operative clause: it switches on only if California Restaurant Association v. City of Berkeley, 89 F.4th 1094 (9th Cir. 2023, as amended) is overturned or disapproved by a court of competent jurisdiction, or modified by the legislature to authorize local control of natural gas infrastructure; or if the Energy Policy and Conservation Act (42 U.S.C. § 6297) or other similar legislation is clarified or modified (San José Municipal Code §§ 17.845.010.E, 17.845.030.A). So there is no all-electric requirement to design around today — state Title 24 energy rules and project-specific conditions of approval still apply, and the chapter would switch on automatically if the case law changes. Confirm its status when you file.',
    })
  } else if (city === 'nashville') {
    // Metro Nashville & Davidson County Code, read from Municode's content API
    // at Supp. No. 53 ("codified through Ord. BL2025-1141, approved December 17,
    // 2025"). The two parking rows — no minimums inside the Urban Zoning Overlay
    // or downtown, minimums under Ch. 17.20 outside it — are carried together by
    // PARKING_RULES['nashville'], and the preservation permit by
    // HISTORIC_BODY/HISTORIC_MONTHS['nashville'] above.
    if (isResidential) {
      // ABSENCE, and the headline finding for Nashville: state law forbids the
      // mandate outright, so affordability here can only ever be a trade.
      hurdles.push({
        category: 'affordability',
        label: 'State law bars mandatory inclusionary zoning',
        status: 'info',
        note: 'Tennessee law prohibits any local government from imposing a mandatory inclusionary-zoning requirement on private development (Tenn. Code Ann. § 66-35-102(b), as amended by 2018 Tenn. Pub. Ch. 685). No unit count in Nashville triggers an affordability obligation on a by-right project.',
      })

      // …with the one exception: ask for more than base zoning and affordability
      // becomes negotiable. Discretionary-only, because that is the trigger —
      // and there is a published floor under it: developments of fewer than five
      // residential units are exempt outright (§ 17.40.780(B)).
      // The five is a RESIDENTIAL unit count — § 17.40.055 reaches "all proposed
      // residential development", § 17.40.780(B) reads "For residential uses" —
      // so this gate must not fire on a commercial project carrying a unit
      // count. It cannot: the enclosing `if (isResidential)` is the guard, and
      // an added `isResidential &&` here would be redundant. Pinned by the
      // commercial-at-5-units test in hurdles.test.ts; do not unnest.
      if (discretionary && units >= 5) {
        hurdles.push({
          category: 'affordability',
          label: 'Inclusionary housing — only if you seek more than base zoning',
          sizeDependent: true,
          status: 'likely',
          note: 'A residential development asking for entitlements beyond its current base zoning — a rezoning or SP — or using Metro public money or land can be required to include affordable units as part of that grant; developments of fewer than five residential units are exempt outright (Metro Nashville & Davidson County Code §§ 17.40.055, 17.40.780(B)). Where it applies, the set-aside under § 17.40.790.A runs 7.5%–17.5% of residential floor area, lower for taller buildings, with an off-site or in-lieu cash option; the 80–100% median-household-income tiers are Urban Zoning Overlay only. Build within base zoning and it does not arise. One caution: § 17.40.820 says the article expires December 31, 2019 "unless extended by resolution of the metropolitan council" — the codifier still publishes it as live, but we could not locate the extending resolution, so confirm the program is in force before pricing it.',
        })
      }
    }

    hurdles.push({
      category: 'fees',
      label: 'Sidewalk construction or in-lieu fee — not currently in force',
      status: 'info',
      note: 'Metro’s sidewalk exaction — build the sidewalk along your whole frontage or pay into the pedestrian benefit zone fund — would otherwise apply to multi-family and non-residential development in the urban services district, in a designated center, or on a Major and Collector Street Plan street, and also to new single- or two-family construction inside the Urban Zoning Overlay or a designated center — but the code section carries an editor’s note recording that it is no longer enforced under a permanent injunction (Metro Nashville & Davidson County Code § 17.20.120, editor’s note; Agreed Entry of Judgment and Injunction entered 9/22/23 in Knight v. Metropolitan Government, M.D. Tenn. No. 3:20-cv-00922). Treat the sidewalk cost as not currently required but confirm at permit — Metro may re-adopt a compliant version, and if it does, § 17.20.120.D.1 caps the in-lieu payment at three percent of the total construction value of the permit.',
    })

    // § 17.20.140.B.2 reads "NONRESIDENTIAL developments of more than fifty
    // thousand square feet". `isCommercial` is true for use === 'mixed' too, and
    // `project.gfa` is the WHOLE building — so a mixed-use project was being
    // measured against a non-residential threshold using its residential floor
    // area. We hold no split of gfa, so the floor-area limb is restricted to a
    // wholly non-residential project; the unit limb still catches large mixed
    // programs. (Criterion 3, the 750-daily / 100-peak-hour trip test, needs a
    // trip generation figure we do not compute, so it is stated, not gated.)
    if (units > 75 || (project.use === 'commercial' && project.gfa > 50000)) {
      hurdles.push({
        category: 'review',
        label: 'Multimodal transportation analysis (NDOT)',
        sizeDependent: true,
        status: 'required',
        note: 'More than 75 dwelling units — or more than 50,000 sq ft of non-residential floor area, or a mixed program expected to generate 750 or more daily trips or 100 or more peak-hour trips — requires a multimodal transportation analysis, and NDOT can require one below those thresholds on its own judgment (Metro Nashville & Davidson County Code § 17.20.140.B, .J). NDOT sets the scope and level of analysis and must comment on or approve the scoping form within ten business days; no timeline is published for the analysis itself. The cost is the mitigation, not the study: § 17.20.140.J.2 provides that any required improvements Metro has not funded or completed must be completed by the developer before a use and occupancy permit issues, with a pro-rata contribution where the project is only a partial cause. Budget for off-site roadway and pedestrian work of unknown size at this threshold.',
      })
    }

    hurdles.push({
      category: 'review',
      label: 'Planning Commission final site plan approval (SP / PUD / UDO)',
      status: 'likely',
      note: 'In most of Nashville the final site plan is signed off administratively by the zoning administrator — no board, no hearing. But a parcel inside a Specific Plan district, a PUD overlay, an urban design overlay or an institutional overlay goes to the Metropolitan Planning Commission on a public agenda, and no zoning permit issues until the final site plan is approved (Metro Nashville & Davidson County Code § 17.40.170.B, .C; the UDO requirement also at § 17.40.130.D). In the Downtown Code district the equivalent review is by the planning department, with NDOT sign-off. The trigger is the mapping — confirm which, if any, covers your parcel.',
    })

    if (discretionary) {
      hurdles.push({
        category: 'review',
        label: 'Specific Plan (SP) rezoning',
        status: 'likely',
        note: 'A project needing entitlements beyond base zoning generally takes the Specific Plan route, and that is a legislative act, not a staff approval: a development plan filed with the Planning Commission, a Commission recommendation, then an ordinance through the Metropolitan Council on three readings with a public hearing, plus a Law Department liability opinion ten days before third reading (Metro Nashville & Davidson County Code §§ 17.40.075, 17.40.105, 17.40.106.C–E). An SP cannot be used to escape the inclusionary incentive — § 17.40.105 says the specific plan cannot vary § 17.40.055 — and an SP in a redevelopment district or historic overlay must first be referred to MDHA and/or the Metropolitan Historic Zoning Commission. No statutory clock is published for the overall process.',
      })
    }

    if (teardown) {
      hurdles.push({
        category: 'demolition',
        label: 'Metro Council demolition review for National Register properties',
        status: 'likely',
        note: 'Beyond the historic overlays, Tennessee’s historic-demolition statute gives Metro a second bite: the Historic Zoning Commission determines whether the structure meets the criteria of T.C.A. § 7-51-1201 (broadly, listed on or eligible for the National Register), and if it does, the commission must initiate legislation putting the demolition to the Metropolitan Council to approve or disapprove (Metro Nashville & Davidson County Code § 17.40.410.G). That converts a permit into a political decision on a Council calendar — screen the existing building’s National Register status early if you are planning a teardown of anything old.',
      })
    }

    hurdles.push({
      category: 'demolition',
      label: 'Permit moratorium while a historic overlay is pending',
      status: 'info',
      note: 'The mere filing of an ordinance to designate your parcel’s area as a historic overlay district freezes permits for demolition, relocation, new construction, exterior alteration and additions on the land recommended for designation (Metro Nashville & Davidson County Code § 17.40.430). The freeze runs until Council approves, rejects, withdraws or indefinitely defers the ordinance — or has deferred it for ninety days in total. A neighbourhood that objects can start that clock without Council ever voting, so check whether a designation ordinance is filed for the area before you count on a permit date.',
    })

    // § 17.28.020.A: "new construction on land in an UNDEVELOPED STATE where
    // natural slopes are of fifteen percent or greater." Two conditions, and the
    // first one is on the record — a parcel already carrying a building is not
    // land in an undeveloped state. The slope itself is in no dataset we hold,
    // so the copy stays conditional on it rather than the gate.
    if (project.projectType === 'new' && !existing.hasBuilding) {
      hurdles.push({
        category: 'environmental',
        label: 'Hillside development standards (15% natural slope)',
        status: 'likely',
        note: 'New construction on land in an undeveloped state with natural slopes of 15% or more must meet Metro’s hillside development standards (Metro Nashville & Davidson County Code §§ 17.28.020.A, 17.28.030.A). In residential districts, development must minimise grading and cut/fill on the portions at 20% or more natural slope; on single- or two-family lots under one acre, natural slopes of 25% or more must be platted outside the building envelope and the lot becomes a "critical lot" needing Planning Commission and Public Works sign-off. The trigger is the topography, not the size of the building — but it can materially shrink the buildable area on a hilly parcel. The standards reach land in an undeveloped state, so a parcel already carrying a building is outside them.',
      })
    }

    hurdles.push({
      category: 'environmental',
      label: 'Tree density requirement and tree-removal permit',
      status: 'required',
      note: 'Nashville enforces a tree canopy budget on the finished site, not just a protection rule: a property other than a single- or two-family subdivision must reach a tree density factor of at least 22 units per acre using retained or replacement trees, and a single/two-family subdivision must reach 14 (excluding building lots) (Metro Nashville & Davidson County Code § 17.28.065.A.3, .B.2). Separately, no retained, protected (6 inches DBH or more) or heritage tree may be removed without a permit from the zoning administrator, and trees 24 inches DBH or larger must be survey-located on the final site plan (§ 17.40.440). Replacement planting to hit the density factor is a real line item on a wooded parcel. Construction of a single- or two-family dwelling on a lot already platted when the chapter was enacted is exempt (§ 17.28.020.F.4).',
    })

    if (fz && !FLOOD_OK.has(fz.toUpperCase())) {
      hurdles.push({
        category: 'flood',
        label: 'Preserved floodplain: encroachment needs approval',
        status: 'likely',
        note: 'Metro goes beyond the federal NFIP baseline: floodplain designated as natural floodplain on a parcel is meant to stay preserved, and encroaching on it needs a variance from the Stormwater Management Commission under Metro Code ch. 15.64 (Metro Nashville & Davidson County Code § 17.28.040.A, .C.1). The variance can cover no more than twenty percent of the preserved floodplain area, and only on a finding that the encroachment reduces the flood danger or improves the floodplain’s environmental quality. Manipulated floodplain land cannot count toward the base district’s minimum lot size, and a lot containing natural floodplain becomes a "critical lot" with finished-floor elevations fixed on the final plat. When sizing the envelope, treat preserved floodplain as effectively unbuildable — and Metro maps its own floodplain, so confirm the local mapping rather than relying on the FEMA zone alone.',
      })
    }
  }

  // Demolition + loss of existing structure. New construction on a developed
  // parcel means tearing down what's there first, which adds time and cost, and
  // replacing existing homes with fewer is restricted in most cities.
  if (project.projectType === 'new') {
    // Same definitions the per-city branches used above — see existingStructure().
    const { ex, exUnits, lu, hasBuilding, multifamilyExisting, rentalMultifamily } = existing

    if (hasBuilding) {
      // No addsMonths here — the demolition phase is already in the timeline via
      // the per-city demoMonths, so a hardcoded number here would contradict it.
      hurdles.push({
        category: 'demolition',
        label: 'Demolition of the existing building',
        status: 'required',
        note: `${lu ? `The record shows an existing ${lu.toLowerCase()} here. ` : 'There is already a building on this parcel. '}Building new means demolishing it first: a demolition permit, utility disconnects, and hazardous-material abatement, all of which add cost and time.`,
      })
      const proposedUnits = project.units ?? (isResidential ? 1 : 0)
      if (multifamilyExisting && (exUnits === 0 || proposedUnits < exUnits)) {
        // 'review' (not 'demolition') so its no-net-loss/relocation delay counts
        // toward the discretionary timeline instead of being filtered out.
        hurdles.push({
          category: 'review',
          label: 'Replacing existing housing',
          status: 'required',
          note: 'This parcel already holds multiple homes. Tearing down occupied housing triggers tenant-relocation requirements and demolition review, and replacing it with fewer units runs into “no net loss of housing” rules in many cities. Expect significant added time, and in some places it may not be permitted at all.',
          addsMonths: 6,
        })
      }

      // ---- Tenant-protection teardown (LA / SF). Distinct from the no-net-loss
      // rule above: rent-regulated demolition controls fire even when the new
      // project ADDS units, because the trigger is the loss of *occupied,
      // rent-controlled* tenancies, not a net unit reduction. We reuse the
      // feasibility.ts multifamily heuristic (word-boundaried, exUnits>=2 floor). ----
      const yb = ex?.yearBuilt
      if (city === 'la' && rentalMultifamily) {
        // LA RSO covers most rental units in buildings with a certificate of
        // occupancy on or before Oct 1, 1978; post-RSO buildings are generally
        // exempt. Source: LAHD, "What is Covered under the RSO"
        // (housing.lacity.gov/residents/what-is-covered-under-the-rso) — built
        // on or before 10/1/1978. So suppress only when yearBuilt is KNOWN and
        // >= 1979; an unknown year must NOT wave the teardown through.
        if (yb == null || yb < 1979) {
          // Demolishing occupied RSO units runs the state Ellis Act: a Notice of
          // Intent to Withdraw, a 120-day notice period (extendable to up to one
          // year for senior/disabled tenants with 1+ year tenancy), tenant
          // relocation payments, and multi-year re-rental restrictions. Source:
          // SF.gov "Evictions Pursuant to the Ellis Act" + LAHD "Removal From
          // Rental Market" (120 days / up to 1 year). addsMonths: 6 = the
          // 120-day statutory notice floor (~4 months) plus filing/processing —
          // a defensible minimum, NOT the senior/disabled 1-year ceiling.
          hurdles.push({
            category: 'review',
            label: 'Rent-control teardown (RSO + Ellis Act)',
            status: 'likely',
            note:
              yb == null
                ? 'The record shows existing multifamily housing here but no year built. LA’s Rent Stabilization Ordinance (RSO) covers most rental units in buildings with a certificate of occupancy on or before October 1, 1978 — confirm the building’s RSO status. If it is RSO, demolishing occupied units triggers the state Ellis Act: a Notice of Intent to Withdraw, a 120-day tenant notice period (up to one year for senior or disabled tenants), tenant relocation payments, and multi-year re-rental restrictions on the new building.'
                : 'This parcel’s existing multifamily building predates October 1, 1978, so its rental units are almost certainly covered by LA’s Rent Stabilization Ordinance (RSO). Demolishing occupied RSO units triggers the state Ellis Act: a Notice of Intent to Withdraw, a 120-day tenant notice period (up to one year for senior or disabled tenants), tenant relocation payments, and multi-year re-rental restrictions on the new building.',
            addsMonths: 6,
          })
        }
      } else if (city === 'sf' && rentalMultifamily) {
        // SF Rent Ordinance covers rental units in buildings whose first
        // certificate of occupancy issued on or before June 13, 1979 (the date
        // rent control passed). Source: SF.gov "Partial Exemption for Newly
        // Constructed Rental Units" — new-construction exemption applies only if
        // the first C of O issued AFTER 6/13/1979. SF parcel data (providers/sf.ts)
        // carries existing.landUse and sometimes existing.units, but NEVER
        // yearBuilt — so this hurdle is, in practice, always the confirm-language
        // branch. We still branch on yb defensively in case the field is added.
        if (yb == null || yb < 1980) {
          // Demolition also runs Planning Code Section 317: loss of residential
          // units requires a Conditional Use hearing before the Planning
          // Commission. Source: SF Planning Code Sec. 317 (codelibrary.amlegal.com)
          // + sfplanning.org "Dwelling Unit Removal". addsMonths: 6 mirrors the
          // RSO/Ellis floor (120-day notice + CU hearing lead time); a defensible
          // minimum, not a ceiling.
          hurdles.push({
            category: 'review',
            label: 'Rent-control teardown (Rent Ordinance + Section 317)',
            status: 'likely',
            note:
              yb == null
                ? 'The record shows existing multifamily housing here but no year built. SF’s Rent Ordinance covers rental units in buildings with a certificate of occupancy on or before June 13, 1979 — confirm the building’s rent-control status. Demolishing residential units also runs Planning Code Section 317, which requires a Conditional Use hearing before the Planning Commission, plus tenant-relocation and notice protections.'
                : 'This parcel’s existing multifamily building predates June 13, 1979, so its rental units are almost certainly covered by SF’s Rent Ordinance. Demolishing residential units runs Planning Code Section 317, which requires a Conditional Use hearing before the Planning Commission, plus tenant-relocation and notice protections.',
            addsMonths: 6,
          })
        }
      }
    }
  }

  // Public funding triggers a mandatory procurement + labor process. Privately
  // funded projects only see this as a heads-up, and only when large enough to
  // plausibly chase a subsidy.
  if (project.funding === 'public') {
    hurdles.push({
      category: 'labor',
      label: 'Public-funding process (procurement & prevailing wage)',
      status: 'required',
      note: PUBLIC_FUNDING_NOTE,
      addsMonths: 4,
    })
  } else if (project.gfa >= 50000 || units >= 25) {
    hurdles.push({
      category: 'labor',
      label: 'Subsidy strings (if you seek public funds)',
      status: 'info',
      note: SUBSIDY_NOTE,
    })
  }

  // Parking — flagship Abundance reform target; always worth surfacing. Every
  // city we cover has a rule in PARKING_RULES (verified per ordinance); where a
  // city has abolished minimums entirely we frame it as the tailwind it is.
  const parkingRule = PARKING_RULES[city]
  if (parkingRule) {
    hurdles.push({
      category: 'parking',
      label: parkingRule.headline,
      status: 'info',
      note:
        parkingRule.status === 'abolished'
          ? `${parkingRule.detail} This is a major cost saver — parking is now market-driven, not mandated.`
          : parkingRule.detail,
    })
  } else {
    hurdles.push({
      category: 'parking',
      label: 'Parking requirements',
      status: 'info',
      note: 'Check the local parking-minimum requirement for your zone. Required spaces add significant cost and can constrain the building envelope.',
    })
  }

  // Private governance — curated sites escalate; otherwise a standing disclaimer.
  const [lng, lat] = parcel.coordinates
  const site = PRIVATE_SITES.find((s) => inBox(lng, lat, s.bbox))
  if (site) {
    hurdles.push({ category: 'private', label: site.label, status: 'likely', note: site.note })
  } else {
    hurdles.push({
      category: 'private',
      label: 'Private deed / HOA restrictions',
      status: 'info',
      note: 'Private deed restrictions, condo bylaws, or HOA approvals are not in public data and can independently block a project. Verify with the owner and a title search.',
    })
  }

  return softenSizeDependent(hurdles, project.gfaBasis)
}
