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
// "Park" and "water" only match as the whole land-use value or in specific
// public compounds — a bare \bpark\b / \bwater\b token would wrongly block
// private uses like "Trailer park" (a residence) or "Waterfront residential".
const PUBLIC_LANDUSE =
  /\b(federal|governmental?|gov't|white house|capitol|monument|memorial|cemeter(y|ies)|military|national park|public park|state park|city park|parkland|park land|open[ -]?space|right[- ]of[- ]way|public land|water body|waterway|water (department|supply|treatment|district)|reservoir|tax[- ]exempt|city of boston|commonwealth of mass)\b|^parks?$|^water$/i

// Government / public-entity OWNER names (from assessing owner fields). Private
// owners are individuals or LLCs, so these strong public-entity signals are safe
// to hard-block. Used transiently in the provider to derive a boolean — owner
// names are never stored or surfaced.
const GOV_OWNER =
  /\b(cit(y|ies) of|town of|county of|commonwealth(\s+of)?|state of|united states|u\.?s\.?\s*gov|federal government|government of|district of columbia|housing authority|redevelopment authority|transit authority|MBTA|MTA|metropolitan transit|port authority|board of education|department of (education|transportation|general services|administrative)|school (district|department)|national park service|general services admin)\b/i

/** True when an assessing owner name denotes a government / public entity. */
export function isGovernmentOwner(owner: string | null | undefined): boolean {
  return !!owner && GOV_OWNER.test(owner)
}

export function assessDevelopability(opts: {
  districtCode?: string | null
  landUse?: string | null
  /** True when the parcel's owner is a government/public entity (no name passed). */
  ownerPublic?: boolean
}): Developability {
  const code = (opts.districtCode ?? '').trim().toLowerCase()
  const use = (opts.landUse ?? '').trim()

  // Government-owned (City Hall, courthouses, schools, fire stations). Strong,
  // precise signal — hard-block before the softer land-use heuristics.
  if (opts.ownerPublic) {
    return {
      developable: false,
      kind: 'public',
      reason:
        'Public records list this parcel as government-owned — a civic building, school, or similar public site, not a private development parcel. Confirm ownership and availability before relying on any analysis.',
    }
  }

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

  // Open space / parkland zoning. `^p$` catches SF/Austin "P" (Public) districts;
  // does not match Chicago "PD"/Seattle "PMM"/"PUD" (those keep their own zoning).
  // "parkland" (not bare "park") so named district areas like a hypothetical
  // "Hyde Park Neighborhood" string can't block a whole residential neighborhood.
  if (/\bopen space\b|^os\b|^os-|^p$|\bparkland\b|^parks?$/.test(code)) {
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
