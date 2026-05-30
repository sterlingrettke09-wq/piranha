import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput, Hurdle } from '../../../src/types/analysis'

// Curated private-governance sites (no public dataset exists for HOAs/covenants).
const PRIVATE_SITES: Array<{ bbox: [number, number, number, number]; label: string; note: string }> = [
  {
    // Louisburg Square, Beacon Hill — privately owned/governed by its proprietors since 1844.
    bbox: [-71.0706, 42.3581, -71.0692, 42.3592],
    label: 'Private square — proprietors’ approval',
    note: 'Louisburg Square is privately governed by its proprietors; private approval and easements almost certainly apply, on top of city process.',
  },
]

function inBox(lng: number, lat: number, b: [number, number, number, number]): boolean {
  return lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3]
}

const FLOOD_OK = new Set(['', 'X', 'AREA OF MINIMAL FLOOD HAZARD', 'AREA NOT INCLUDED'])

// Parking minimums are a flagship Abundance-era reform target. Where a city has
// abolished them that's a tailwind; where they remain they drive cost/feasibility.
const PARKING_NOTE: Record<string, string> = {
  boston:
    'Boston has dropped parking minimums for income-restricted housing and cut them broadly near transit; many districts still set a ratio. Confirm the requirement for your zone — every space adds significant cost.',
  nyc:
    'NYC’s “City of Yes for Housing Opportunity” (2024) eliminated mandatory parking minimums citywide. You can still build parking, but you’re no longer forced to — a major cost saver.',
  sf:
    'San Francisco removed off-street parking minimums citywide in 2018. None are required; parking is optional and demand-driven.',
  chicago:
    'Chicago sets parking minimums by zone, with sharp reductions (often to zero) for transit-served (TOD) sites near rail and frequent bus. Confirm your site’s transit-proximity reduction.',
  seattle:
    'Seattle requires no parking minimums inside urban villages and frequent-transit areas, which cover much of the buildable city. Confirm whether your parcel falls inside one.',
}

const LABOR_NOTE =
  'Public funding, tax abatements, tax-increment financing, or city land typically trigger prevailing-wage requirements and minority/women-owned business (MWBE/DEI) participation goals — raising labor cost and adding compliance reporting. Large projects also commonly negotiate Community Benefit Agreements. These are the “everything-bagel” mandates that stack on top of the build itself.'

// Assess non-zoning regulatory hurdles for a project. Boston is fully modeled;
// other cities get the shared overlay + private-governance hurdles for now.
export function assessHurdles(city: string, parcel: ParcelInfo, project: AnalysisInput): Hurdle[] {
  const hurdles: Hurdle[] = []
  const units = project.units ?? 0
  const isResidential = project.use === 'residential' || project.use === 'mixed'
  const isCommercial = project.use === 'commercial' || project.use === 'mixed'

  // Historic district — design review (applies in every city we cover).
  if (parcel.overlays.historicDistrict) {
    hurdles.push({
      category: 'historic',
      label: 'Historic district design review',
      status: 'required',
      note: `This parcel is in the ${parcel.overlays.historicDistrict}. Exterior changes and new construction require design approval from the local historic/architectural commission.`,
      addsMonths: 3,
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
      note: 'Accessory dwelling units have their own size caps, owner-occupancy, and parking rules that vary by city — confirm the local ADU ordinance.',
    })
  } else if (project.projectType === 'change_of_use') {
    hurdles.push({
      category: 'review',
      label: 'Change-of-use code upgrades',
      status: 'likely',
      note: 'Converting to a new use commonly triggers building-code, accessibility (ADA), and fire upgrades, plus a use review — even without exterior changes.',
    })
  }

  // ---- Per-city policy. Programs are publicly documented; applicability often
  // depends on the specific area/funding, so area-dependent rules are "likely". ----
  if (city === 'boston') {
    if (isResidential && units >= 10) {
      hurdles.push({
        category: 'affordability',
        label: 'Inclusionary (IDP) — income-restricted units',
        status: 'required',
        note: 'Boston’s Inclusionary Development Policy requires roughly 13% of units be income-restricted (or a payment in lieu) for residential developments of 10+ units.',
      })
    }
    if (project.gfa >= 50000) {
      hurdles.push({
        category: 'review',
        label: 'Article 80 Large Project Review (BPDA)',
        status: 'required',
        note: 'Developments of 50,000+ sq ft undergo BPDA Article 80 Large Project Review, including community meetings and impact studies.',
        addsMonths: 9,
      })
    } else if (project.gfa >= 20000) {
      hurdles.push({
        category: 'review',
        label: 'Article 80 Small Project Review (BPDA)',
        status: 'required',
        note: 'Developments of 20,000–50,000 sq ft undergo BPDA Article 80 Small Project Review.',
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
  } else if (city === 'nyc') {
    if (isResidential && units >= 10) {
      hurdles.push({
        category: 'affordability',
        label: 'Mandatory Inclusionary Housing (MIH)',
        status: 'likely',
        note: 'In MIH areas, new residential of 10+ units must include permanently affordable units (~25–30%) or pay in lieu. Confirm whether the site sits in an MIH area.',
      })
    }
    if (project.gfa >= 50000) {
      hurdles.push({
        category: 'review',
        label: 'ULURP — Uniform Land Use Review Procedure',
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
    if (project.gfa >= 50000) {
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
      hurdles.push({
        category: 'affordability',
        label: 'Mandatory Housing Affordability (MHA)',
        status: 'likely',
        note: 'In MHA zones, new development contributes affordable units or pays a fee. Confirm the site is in an MHA zone.',
      })
    }
    if (units >= 20 || project.gfa >= 12000) {
      hurdles.push({
        category: 'environmental',
        label: 'SEPA environmental review',
        status: 'likely',
        note: 'Washington’s State Environmental Policy Act applies above local thresholds (roughly 20+ units or larger commercial), adding review time.',
        addsMonths: 4,
      })
    }
  }

  // Labor / DEI — the "everything-bagel" mandates that attach when a project
  // taps public money or land. Surface on projects large enough to plausibly
  // seek subsidy/abatement (smaller as-of-right builds rarely trigger these).
  if (project.gfa >= 50000 || units >= 25) {
    hurdles.push({
      category: 'labor',
      label: 'Prevailing wage & MWBE/DEI goals',
      status: 'info',
      note: LABOR_NOTE,
    })
  }

  // Parking — flagship Abundance reform target; always worth surfacing.
  hurdles.push({
    category: 'parking',
    label: 'Parking requirements',
    status: 'info',
    note: PARKING_NOTE[city] ?? 'Check the local parking-minimum requirement for your zone — required spaces add significant cost and can constrain the building envelope.',
  })

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
      note: 'Private deed restrictions, condo bylaws, or HOA approvals are not in public data and can independently block a project — verify with the owner and a title search.',
    })
  }

  return hurdles
}
