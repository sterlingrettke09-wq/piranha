import type { ParcelInfo } from '../../../src/types/parcel'
import type { AnalysisInput, ApprovalPath, CheckStatus, FeasibilityCheck, Use } from '../../../src/types/analysis'
import { resolveZoningLimits } from './zoningLimits'
import { ftPerStory } from './assumptions'
import { avgUnitGrossSqFt } from '../../../src/config/estimates'

const SEVERITY: Record<CheckStatus, number> = {
  AS_OF_RIGHT: 0,
  INDETERMINATE: 1,
  NEEDS_RELIEF: 2,
  PROHIBITED: 3,
}

// A dimensional variance can bridge a modest overage; beyond it, relief isn't
// realistically grantable (it takes a rezoning). Height and FAR differ: a height
// variance is the classic, routinely-granted dimensional relief (~1.5×), but a
// FAR/density increase above ~1.2× crosses into rezoning territory — density is
// generally excluded from area-variance consideration. Source: variance-practice
// doctrine (NY ZR §72-21; area- vs use-variance literature).
const RELIEF_FACTOR_HEIGHT = 1.5
const RELIEF_FACTOR_FAR = 1.2

// A proposal taller than this on a parcel whose district carries NO height
// limit in public data can't honestly be called "as-of-right" — outside
// downtown cores, by-right envelopes above ~85 ft are rare, and use variances
// aside, height is the dimension most likely to bite. Below it (houses,
// triplexes) the missing limit shouldn't punish obviously-modest projects.
const UNKNOWN_HEIGHT_CONFIDENCE_FT = 85

// Use adjacency: a use that's "next door" to an allowed one (mixed↔residential,
// mixed↔commercial) is plausible variance/special-permit territory. A use with
// NO adjacency to anything allowed (a factory or office tower in a pure
// residential district) needs a USE variance — the hardest relief to get,
// banned outright in several states — so it scores PROHIBITED, not the old
// blanket NEEDS_RELIEF (which made a use conflict read as LESS severe than a
// 1.3× FAR overage). Institutional stays adjacent-to-everything: schools,
// churches, and clinics are conditionally permitted in most district types.
const USE_ADJACENT: Record<Use, Use[]> = {
  residential: ['mixed'],
  mixed: ['residential', 'commercial'],
  commercial: ['mixed'],
  institutional: ['residential', 'commercial', 'mixed'],
}

// Classify a proposed value against a limit: within → as-of-right, modestly over
// → relief, grossly over → prohibited. reliefFactor differs by dimension.
function classifyOverage(proposed: number, limit: number, reliefFactor: number): CheckStatus {
  if (proposed <= limit) return 'AS_OF_RIGHT'
  if (proposed <= limit * reliefFactor) return 'NEEDS_RELIEF'
  return 'PROHIBITED'
}

export interface Feasibility {
  overall: CheckStatus
  checks: FeasibilityCheck[]
  path: ApprovalPath
  // True when at least one of FAR/height was decidable. When false, an
  // "as-of-right" verdict reflects use only and shouldn't be stated with full
  // confidence (the size/bulk envelope is unknown for this city's data).
  envelopeKnown?: boolean
}

export function assessFeasibility(parcel: ParcelInfo, project: AnalysisInput): Feasibility {
  const limits = resolveZoningLimits(parcel.zoning, project.city)
  const checks: FeasibilityCheck[] = []

  // USE
  if (!limits.allowedUses) {
    checks.push({ dimension: 'use', status: 'INDETERMINATE', proposed: project.use, allowed: 'not derivable', note: 'Allowed uses not derivable from available zoning data.' })
  } else if (limits.allowedUses.includes(project.use)) {
    checks.push({ dimension: 'use', status: 'AS_OF_RIGHT', proposed: project.use, allowed: limits.allowedUses.join(', '), note: null })
  } else {
    const adjacent = USE_ADJACENT[project.use].some((u) => limits.allowedUses?.includes(u))
    checks.push(
      adjacent
        ? { dimension: 'use', status: 'NEEDS_RELIEF', proposed: project.use, allowed: limits.allowedUses.join(', '), note: 'Proposed use is not listed for this district, but it is close to one that is; a special permit or use variance would be required.' }
        : { dimension: 'use', status: 'PROHIBITED', proposed: project.use, allowed: limits.allowedUses.join(', '), note: 'Proposed use conflicts with everything this district allows. That takes a use variance — the hardest relief to get, and one several states bar outright — or a rezoning, so it isn’t buildable as proposed.' },
    )
  }

  // FAR — prefer a use-specific limit (e.g. NYC Resid/Comm/Facil FAR) when present.
  const farForUse = parcel.zoning.farByUse?.[project.use] ?? limits.maxFAR
  if (farForUse == null || parcel.lot.sizeSqFt == null) {
    checks.push({ dimension: 'far', status: 'INDETERMINATE', proposed: `${project.gfa.toLocaleString()} sf`, allowed: 'not derivable', note: 'FAR cannot be evaluated without lot size and a district FAR limit.' })
  } else {
    const proposedFAR = project.gfa / parcel.lot.sizeSqFt
    const status = classifyOverage(proposedFAR, farForUse, RELIEF_FACTOR_FAR)
    const note =
      status === 'NEEDS_RELIEF'
        ? 'Proposed floor area exceeds the district FAR; dimensional relief (a variance) would be required.'
        : status === 'PROHIBITED'
          ? `Proposed floor area is ${(proposedFAR / farForUse).toFixed(1)}× the district FAR — far beyond what a variance can grant. On this lot it would require a rezoning or special district, so it isn't buildable as proposed.`
          : null
    checks.push({ dimension: 'far', status, proposed: `FAR ${proposedFAR.toFixed(2)}`, allowed: `max FAR ${farForUse.toFixed(2)}`, note })
  }

  // HEIGHT. Only emit a check when there's something to evaluate. A missing
  // *proposed* height is the user's omission, NOT a data gap — so when the
  // district limit is known but no height was proposed, we stay silent (the
  // limit is still shown in the envelope) instead of claiming "height could not
  // be evaluated," which falsely reads as missing city data.
  const effHeight = project.heightFt ?? (project.stories != null ? project.stories * ftPerStory(project.use) : null)
  if (effHeight != null && limits.maxHeightFt != null) {
    const status = classifyOverage(effHeight, limits.maxHeightFt, RELIEF_FACTOR_HEIGHT)
    const note =
      status === 'NEEDS_RELIEF'
        ? 'Proposed height exceeds the district limit; dimensional relief (a variance) would be required.'
        : status === 'PROHIBITED'
          ? `Proposed height is ${(effHeight / limits.maxHeightFt).toFixed(1)}× the district limit — well past what a variance grants; it would require a rezoning, so it isn't buildable as proposed.`
          : null
    checks.push({ dimension: 'height', status, proposed: `${effHeight} ft`, allowed: `max ${limits.maxHeightFt} ft`, note })
  } else if (effHeight != null && limits.maxHeightFt == null) {
    // A proposed height we genuinely can't check — no limit on record. Worth noting.
    checks.push({ dimension: 'height', status: 'INDETERMINATE', proposed: `${effHeight} ft`, allowed: 'not derivable', note: 'No district height limit is available in public data to check this against.' })
  }

  // HOUSING — demolishing existing homes to build fewer is not an as-of-right
  // teardown. No-net-loss rules, rent regulation, and tenant protections make
  // shrinking the housing on a lot a major discretionary action, and often a
  // non-starter when an established multifamily building is involved.
  const ex = parcel.existing
  const exUnits = ex?.units ?? 0
  const exLu = ex?.landUse ?? ''
  // Word-boundaried "multifamily"/"multi-family" — NOT a bare "multi", which
  // wrongly matched commercial labels like "COMM MULTI-USE" and fired no-net-loss.
  const multifamilyExisting =
    exUnits >= 3 || /apartment|condo|multi-?family|triplex|fourplex|elevator|tenement|\bflats\b/i.test(exLu)
  const isResidentialish = project.use === 'residential' || project.use === 'mixed'
  // A residential project with NO unit count entered must not be treated as
  // "1 unit proposed" — that fired no-net-loss PROHIBITED off a blank field.
  // We ask for the number instead (INDETERMINATE), and only run the rule when
  // we actually know what's being proposed.
  if (project.projectType === 'new' && multifamilyExisting && isResidentialish && project.units == null) {
    checks.push({
      dimension: 'housing',
      status: 'INDETERMINATE',
      proposed: 'unit count not entered',
      allowed: exUnits > 0 ? `${exUnits} existing` : 'existing multifamily',
      note: 'The record shows existing multifamily housing here. Enter the proposed unit count to check the city’s housing-replacement (no-net-loss) rules.',
    })
  }
  const proposedResUnits = isResidentialish ? (project.units ?? 0) : 0
  const unitCountProposed = !isResidentialish || project.units != null
  // When the record names multifamily housing but omits a unit count, estimate
  // it from building area so the no-net-loss rule still fires (don't let a
  // missing number wave through demolishing apartments). Uses the same gross
  // sf/unit constant as the rest of the engine (1,300) — the old 1,000 net
  // figure over-counted existing units by ~30% and over-fired the rule.
  const exb = ex?.buildingAreaSqFt ?? 0
  const unitsKnown = exUnits > 0
  const effectiveExUnits = unitsKnown ? exUnits : exb > 0 ? Math.max(3, Math.round(exb / avgUnitGrossSqFt)) : 3
  if (
    project.projectType === 'new' &&
    multifamilyExisting &&
    unitCountProposed &&
    proposedResUnits < effectiveExUnits
  ) {
    // Confidence heuristic (NOT a legal threshold — no-net-loss laws like CA
    // SB 330 trigger at ANY net unit loss). We only call it flat-out PROHIBITED
    // when the count is large and known; otherwise we hedge to "needs permission."
    const severe = unitsKnown && (exUnits >= 10 || (exUnits >= 5 && proposedResUnits <= 1))
    const status: CheckStatus = severe ? 'PROHIBITED' : 'NEEDS_RELIEF'
    const note = severe
      ? `This parcel holds roughly ${exUnits} homes. Tearing down established multifamily housing to build ${proposedResUnits || 'no'} ${proposedResUnits === 1 ? 'unit' : 'units'} is a large net loss of housing. In cities with no-net-loss rules (e.g. California's SB 330), this generally requires one-for-one replacement and is very unlikely to be approved as proposed.`
      : unitsKnown
        ? `Replacing ${exUnits} existing homes with ${proposedResUnits} reduces the housing on this lot. Cities with no-net-loss rules require discretionary approval for this, and it may not be granted.`
        : `The record shows existing multifamily housing here. Replacing it with fewer units triggers no-net-loss rules in many cities and needs city approval. Confirm the existing unit count.`
    checks.push({
      dimension: 'housing',
      status,
      proposed: `${proposedResUnits} ${proposedResUnits === 1 ? 'unit' : 'units'}`,
      allowed: unitsKnown ? `${exUnits} existing` : 'existing multifamily',
      note,
    })
  }

  // Overall reflects the worst DECISIVE check. A single indeterminate dimension
  // (e.g. NYC height, which public data doesn't carry) shouldn't drag an
  // otherwise-clear verdict to "indeterminate" — it still shows in the checklist.
  // Only when no dimension is decisive does the verdict become indeterminate.
  const decisive = checks.filter((c) => c.status !== 'INDETERMINATE')
  let overall: CheckStatus =
    decisive.length === 0
      ? 'INDETERMINATE'
      : decisive.reduce<CheckStatus>(
          (worst, c) => (SEVERITY[c.status] > SEVERITY[worst] ? c.status : worst),
          'AS_OF_RIGHT',
        )
  // Tall proposal + no height limit in public data: don't let the machine
  // verdict read AS_OF_RIGHT (a 600 ft tower on a brownstone block in NYC —
  // where height is never in PLUTO — previously sailed through on use + FAR).
  // Modest heights below the confidence bound keep their verdict.
  const heightUnknown = checks.some((c) => c.dimension === 'height' && c.status === 'INDETERMINATE')
  if (overall === 'AS_OF_RIGHT' && heightUnknown && effHeight != null && effHeight > UNKNOWN_HEIGHT_CONFIDENCE_FT) {
    overall = 'INDETERMINATE'
  }
  const path: ApprovalPath = overall === 'PROHIBITED' ? 'prohibited' : overall === 'NEEDS_RELIEF' ? 'variance' : 'as_of_right'
  // The envelope is "known" when the city's DATA gives us a FAR or height limit —
  // independent of whether the user proposed a value to compare. (Previously this
  // keyed off check status, so an unspecified proposed height made us claim there
  // was "no height limit" even when the limit was known and displayed.)
  const envelopeKnown = farForUse != null || limits.maxHeightFt != null
  return { overall, checks, path, envelopeKnown }
}
