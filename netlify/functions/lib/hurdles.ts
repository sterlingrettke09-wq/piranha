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

  // Boston-specific policy.
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
      note: 'Private deed restrictions, condo bylaws, or HOA approvals are not in public data and can independently block a project — verify with the owner and a title search.',
    })
  }

  return hurdles
}
