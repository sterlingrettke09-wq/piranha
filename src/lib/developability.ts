// Heuristic gate for parcels that aren't a developable building site — public
// or government land, parks, monuments, federal property (e.g. the White House),
// water, or right-of-way. We'd rather say "you can't build here" than run a
// cost-and-timeline analysis on a national monument. Conservative by design:
// only flags strong, specific signals so real private lots are never blocked.

// 'public' = government/park/federal land you can't build on.
// 'no_coverage' = we got a parcel but no zoning — likely a neighboring city or
// unincorporated area outside the city's zoning data we cover.
export type SiteBlockKind = 'public' | 'no_coverage'

export interface Developability {
  developable: boolean
  reason: string | null
  kind: SiteBlockKind | null
}

// Land-use strings that denote public / non-developable land. Word-boundaried
// so "parking" is NOT caught by "park", and ordinary uses pass through.
const PUBLIC_LANDUSE =
  /\b(federal|government|gov't|white house|capitol|monument|memorial|cemeter(y|ies)|military|national park|park|parkland|right[- ]of[- ]way|public land|water|reservoir|tax[- ]exempt)\b/i

export function assessDevelopability(opts: {
  districtCode?: string | null
  landUse?: string | null
}): Developability {
  const code = (opts.districtCode ?? '').trim().toLowerCase()
  const use = (opts.landUse ?? '').trim()

  // No zoning on record — typically federal or other public land (the White
  // House, the Mall, monument grounds all read as "Unzoned" in DC/Austin data).
  if (/^unz/.test(code)) {
    return {
      developable: false,
      kind: 'public',
      reason:
        'This parcel has no zoning on record. That almost always means federal or other public land that is not open to private development.',
    }
  }

  // Open space / parkland zoning.
  if (/\bopen space\b|^os\b|^os-|\bpark\b/.test(code)) {
    return {
      developable: false,
      kind: 'public',
      reason: 'This parcel is zoned as open space or parkland, not as a developable building site.',
    }
  }

  // Public / government land use on record.
  if (use && PUBLIC_LANDUSE.test(use)) {
    return {
      developable: false,
      kind: 'public',
      reason: `Public records list this as ${use.toLowerCase()}. It reads as government or other public land, not a private development site.`,
    }
  }

  // Parcel exists but no zoning matched — usually a neighboring municipality or
  // unincorporated land just outside the city's zoning coverage (e.g. clicking
  // Manhattan Beach while in Los Angeles).
  if (code === '' || code === 'unknown') {
    return {
      developable: false,
      kind: 'no_coverage',
      reason:
        'We couldn’t find zoning for this parcel. It may sit in a neighboring city or unincorporated area that isn’t in the zoning data we cover yet, so we can’t run a reliable analysis here.',
    }
  }

  return { developable: true, reason: null, kind: null }
}
