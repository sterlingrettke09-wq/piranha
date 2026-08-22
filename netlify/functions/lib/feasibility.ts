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

// ⚠️ MOVED TO src/config/reliefFactors.ts, and re-exported here so every existing
// importer is unchanged. The move happened because a THIRD reader appeared: the
// Methodology page describes these thresholds in prose and said "up to 1.5× over"
// for both dimensions — true of height, false of FAR. The SPA cannot import from
// netlify/, so the definition had to sit where all three readers can reach it.
// See that file for the doctrine and the sourcing.
export { RELIEF_FACTOR_HEIGHT, RELIEF_FACTOR_FAR } from '../../../src/config/reliefFactors'
import { RELIEF_FACTOR_HEIGHT, RELIEF_FACTOR_FAR } from '../../../src/config/reliefFactors'

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
  // A district whose code states a STORY count but no feet. Raleigh's mixed-use
  // designations -7 and above are exactly this (UDO Sec. 3.3.2 row A2 is blank
  // from -7 up while row A1 states 7/12/20/30/40 stories), and Miami 21
  // regulates in stories throughout.
  const statedStories = parcel.zoning.maxStories != null && parcel.zoning.maxStories > 0
    ? parcel.zoning.maxStories
    : null
  if (effHeight != null && limits.maxHeightFt != null) {
    const status = classifyOverage(effHeight, limits.maxHeightFt, RELIEF_FACTOR_HEIGHT)
    const note =
      status === 'NEEDS_RELIEF'
        ? 'Proposed height exceeds the district limit; dimensional relief (a variance) would be required.'
        : status === 'PROHIBITED'
          ? `Proposed height is ${(effHeight / limits.maxHeightFt).toFixed(1)}× the district limit — well past what a variance grants; it would require a rezoning, so it isn't buildable as proposed.`
          : null
    checks.push({ dimension: 'height', status, proposed: `${effHeight} ft`, allowed: `max ${limits.maxHeightFt} ft`, note })
  } else if (project.stories != null && statedStories != null) {
    // ── The code states STORIES and the user proposed STORIES, so compare them
    // directly. Do NOT convert either side to feet to reuse the branch above:
    // that is the round-trip that published 87 stories for a Miami district
    // whose code says 80 (CLAUDE.md rule 12), and Raleigh's own table disproves
    // any single ft/story constant (16.67 / 17.00 / 16.00 across -3/-4/-5).
    // A relief factor is a ratio, so it is unit-free and carries over intact.
    const status = classifyOverage(project.stories, statedStories, RELIEF_FACTOR_HEIGHT)
    const note =
      status === 'NEEDS_RELIEF'
        ? 'Proposed height exceeds the district limit; dimensional relief (a variance) would be required.'
        : status === 'PROHIBITED'
          ? `Proposed height is ${(project.stories / statedStories).toFixed(1)}× the district limit — well past what a variance grants; it would require a rezoning, so it isn't buildable as proposed.`
          : null
    const s = (n: number) => `${n} ${n === 1 ? 'story' : 'stories'}`
    checks.push({ dimension: 'height', status, proposed: s(project.stories), allowed: `max ${s(statedStories)}`, note })
  } else if (effHeight != null && statedStories != null) {
    // The limit is KNOWN — just not in the unit the proposal is in. This must not
    // render as the "no limit on record" case below. That is CLAUDE.md rule 5 one
    // notch finer: an absence and a gap already must not look alike, and neither
    // may a published limit we declined to convert. Before this branch existed,
    // Raleigh's DX-7-SH and DX-40-SH printed "No district height limit is
    // available in public data" over districts whose limit the code states
    // outright — telling the user the city publishes nothing, which is false.
    checks.push({
      dimension: 'height',
      status: 'INDETERMINATE',
      proposed: `${effHeight} ft`,
      allowed: `max ${statedStories} ${statedStories === 1 ? 'story' : 'stories'}`,
      note: `This district's limit is stated in STORIES (${statedStories}), not feet, so a height in feet cannot be checked against it — converting between the two would invent a floor-to-floor assumption the code does not make. Enter a story count to have this checked.`,
    })
  } else if (effHeight != null && parcel.zoning.heightUnconstrained === true) {
    // ⚠️ AN ANSWER, NOT A GAP — and for sixteen Atlanta subareas this branch is
    // the difference between the truth and its opposite. "Maximum Building
    // Height: None" is what the code SAYS; before `heightUnconstrained` existed
    // on the shared type these fell through to the branch below and told the
    // reader no limit was available in public data, which is the tool
    // disclaiming knowledge the code states plainly.
    //
    // AS_OF_RIGHT rather than INDETERMINATE: nothing about height stops this
    // project, and grading it as undecidable would drag the overall verdict down
    // for a district that imposes no ceiling at all.
    checks.push({
      dimension: 'height',
      status: 'AS_OF_RIGHT',
      proposed: `${effHeight} ft`,
      allowed: 'no maximum',
      note: 'This district imposes no maximum building height — that is what the code states, not a gap in the data. Setbacks, transitional height planes near protected districts, and floor-area limits can still govern.',
    })
  } else if (project.stories != null && parcel.zoning.heightUnconstrained === true) {
    checks.push({
      dimension: 'height',
      status: 'AS_OF_RIGHT',
      proposed: `${project.stories} ${project.stories === 1 ? 'story' : 'stories'}`,
      allowed: 'no maximum',
      note: 'This district imposes no maximum building height — that is what the code states, not a gap in the data. Setbacks, transitional height planes near protected districts, and floor-area limits can still govern.',
    })
  } else if (effHeight != null) {
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

  // HISTORIC — tearing down a building in a designated local historic district
  // is not as-of-right. Demolition needs a discretionary certificate from the
  // historic commission (Boston: a Certificate of Design Approval), routinely
  // refused for contributing structures. NEEDS_RELIEF, not PROHIBITED: some
  // teardowns do clear review, and the conservative direction here is to stop
  // overstating buildability, not to overstate the bar. Only fires on a
  // ground-up rebuild ('new') where a building actually stands today.
  // (An addition in-district is review too, but lighter — left for later.)
  const district = parcel.overlays.historicDistrict
  const hasExistingBuilding =
    (ex?.buildingAreaSqFt ?? 0) > 0 || ex?.yearBuilt != null || (ex?.landUse ?? '') !== ''
  if (project.projectType === 'new' && district && hasExistingBuilding) {
    checks.push({
      dimension: 'historic',
      status: 'NEEDS_RELIEF',
      proposed: 'demolish + rebuild',
      allowed: district,
      note: `This parcel sits in the ${district}. Tearing down the existing building needs the historic commission’s sign-off — a discretionary approval that is often refused for contributing structures. Expect this to be the project’s hardest gate.`,
    })
  } else if (
    project.projectType === 'new' &&
    hasExistingBuilding &&
    parcel.overlays.unresolved?.includes('historic')
  ) {
    // ⚠️ THE CHECK ABOVE IS THE ONLY THING THAT RAISES A TEARDOWN TO
    // NEEDS_RELIEF ON HISTORIC GROUNDS, and `district` is `string | null` where
    // the null means EITHER "the layer answered and this parcel is not
    // designated" OR "the layer did not answer". Read as a boolean, a timeout
    // took the check away entirely: measured 2026-08-12 at the analyze handler
    // with only Boston's historic layer faulted, 26 Exeter St (Back Bay
    // Architectural District, restaurant standing) went NEEDS_RELIEF → **
    // AS_OF_RIGHT**. A transport failure upgraded the parcel's legal standing,
    // and `overall` is the single most-read output on the page.
    //
    // INDETERMINATE is the honest status and it is also the structurally
    // correct one: `decisive` below excludes it, so this cannot manufacture a
    // worse verdict than the evidence supports — it appears in the checklist
    // and leaves `overall` to the dimensions that did resolve. Asserting
    // NEEDS_RELIEF instead would be the mirror-image defect, a legal claim made
    // out of a timeout (CLAUDE.md rules 1 and 5).
    checks.push({
      dimension: 'historic',
      status: 'INDETERMINATE',
      proposed: 'demolish + rebuild',
      allowed: 'not established',
      note: 'The city’s historic-designation service did not respond while this report was generated, so we could not check whether this parcel is in a designated historic district. That matters here specifically because a building is standing: inside a district, demolishing it needs the historic commission’s discretionary sign-off, which is routinely refused for contributing structures and is usually the hardest gate a teardown faces. The verdict above is drawn from the checks that did resolve and does not include this one.',
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
  // Same move, same reason, different unknown: a teardown whose historic
  // designation could not be looked up must not publish AS_OF_RIGHT.
  //
  // The check pushed above is INDETERMINATE and therefore not decisive, which is
  // right — it cannot manufacture a NEEDS_RELIEF the evidence does not support.
  // But leaving `overall` alone is not neutral either. Measured 2026-08-12 at
  // the analyze handler with only Boston's historic layer faulted, on 26 Exeter
  // St (Back Bay Architectural District, restaurant standing): the control ran
  // NEEDS_RELIEF and the faulted run ran **AS_OF_RIGHT**. A transport failure
  // upgraded the parcel's legal standing, on the loudest line of the page.
  //
  // "As-of-right" is a positive claim that every gate is clear, and on a
  // teardown the historic check is the ONE gate that would have said otherwise
  // — it is the only thing in this function that raises a teardown to
  // NEEDS_RELIEF on historic grounds. With it unresolved there is no honest
  // caveat, the same bind the fail-closed FAR block below describes: either the
  // parcel is as-of-right or it isn't. INDETERMINATE says what is true.
  //
  // Scoped so it cannot become a blanket refusal: only a teardown ('new' on a
  // parcel with a building), only when the read actually FAILED (an empty answer
  // from the layer resolves the question and leaves the verdict alone), and only
  // when the verdict would otherwise be AS_OF_RIGHT — a NEEDS_RELIEF or
  // PROHIBITED from another dimension already stands on its own evidence.
  const historicUnchecked = checks.some((c) => c.dimension === 'historic' && c.status === 'INDETERMINATE')
  if (overall === 'AS_OF_RIGHT' && historicUnchecked) {
    overall = 'INDETERMINATE'
  }

  // FAIL-CLOSED (2026-08-05). A verdict is a claim about what the CODE PERMITS.
  // When the project's floor area came from `lot × 1.0` because no FAR could be
  // resolved, "as-of-right" would assert something about the law derived from a
  // size the code never stated — and it is the output a user is most likely to
  // act on. There is no honest caveat for it: either the parcel is as-of-right
  // or it isn't.
  //
  // Scoped deliberately to 'assumed-far-1.0'. `assumed-unconstrained` means the
  // code AFFIRMATIVELY imposes no FAR (SF §124(b), Denver's form-based DZC), so
  // a lot-area placeholder sits under a stated absence and the verdict stands.
  // Cost and timeline estimates are NOT blocked — they claim what building that
  // much would cost, not what the code allows.
  //
  // 'assumed-basis-unavailable' fails closed TOO, and for a stricter reason.
  // Under 'assumed-far-1.0' no limit was found; here a limit exists, is
  // published, and cannot be evaluated because the code applies it to buildable
  // area rather than the lot. So the FAR dimension is not merely unknown — it is
  // KNOWN TO BIND and unmeasurable, which is the last state that should be
  // allowed to return AS_OF_RIGHT. `assumed-unconstrained` is the one case that
  // legitimately keeps its verdict: there, no FAR binds at all, so any size
  // clears the check honestly.
  const farUncheckable =
    project.gfaBasis === 'assumed-far-1.0' ||
    project.gfaBasis === 'assumed-basis-unavailable' ||
    // Elective denominator: the ratio is known, the product is not, so the
    // verdict cannot stand on a computed floor area any more than it can above.
    project.gfaBasis === 'assumed-basis-elective'
  if (farUncheckable && (overall === 'AS_OF_RIGHT' || overall === 'NEEDS_RELIEF')) {
    overall = 'INDETERMINATE'
    checks.push({
      dimension: 'far',
      status: 'INDETERMINATE',
      proposed: `${project.gfa.toLocaleString()} sf (assumed)`,
      // ⚠️ THREE REASONS REACH THIS CHECK AND EACH NEEDS ITS OWN SENTENCE. This
      // read as a two-way ternary, so 'assumed-basis-elective' fell through to
      // the unresolved copy and would have told the reader "no floor-area limit
      // could be resolved for this district" about a district that publishes
      // one, cites it, and merely lets them pick its denominator. False on both
      // halves — `allowed` and `note` — and unreachable only until the Atlanta
      // producer landed in the same commit as this fix.
      //
      // Exactly the failure the parallel copy in `assumptionsSummary` was
      // written to avoid, one file over and with no test spanning the two: a
      // sentence true of one branch and false of the branch it was copied to
      // (rule 9's corollary — disclosure copy is code).
      allowed:
        project.gfaBasis === 'assumed-basis-unavailable'
          ? 'published, but stated against buildable area rather than the lot'
          : project.gfaBasis === 'assumed-basis-elective'
            ? 'published — but you choose which lot area it multiplies'
            : 'not published for this district',
      note:
        project.gfaBasis === 'assumed-basis-unavailable'
          ? 'This district publishes a floor-area ratio, but the code applies it to buildable area — the lot minus its required yards — and those yards depend on the setbacks of neighbouring built lots, which no public layer carries. The limit therefore cannot be computed for this parcel, and the size above is a placeholder (lot area). A permitted/not-permitted verdict would be a claim about a limit we can state but cannot measure.'
          : project.gfaBasis === 'assumed-basis-elective'
            ? 'This district publishes a floor-area ratio and the code lets you apply it to either net lot area or gross lot area, which includes a credited half-width of the adjoining street. Both are permitted and they give different answers, so the size above is a placeholder (lot area) rather than a code limit. Using the smaller of the two would put a floor on a page where every other figure is a ceiling — the ratio and its two denominators are in the zoning notes, and the choice of program is yours.'
            : 'No floor-area limit could be resolved for this district, so the size above is a placeholder (lot area), not a code limit. A permitted/not-permitted verdict would be a claim about the law derived from a number the code never states.',
    })
  }
  const path: ApprovalPath = overall === 'PROHIBITED' ? 'prohibited' : overall === 'NEEDS_RELIEF' ? 'variance' : 'as_of_right'
  // The envelope is "known" when the city's DATA gives us a FAR or height limit —
  // independent of whether the user proposed a value to compare. (Previously this
  // keyed off check status, so an unspecified proposed height made us claim there
  // was "no height limit" even when the limit was known and displayed.)
  //
  // `statedStories` counts. A district capped at 7 stories has a published bulk
  // limit; the fact that the code declines to name it in feet is a property of
  // the ordinance, not a hole in our data. Omitting it made every Raleigh
  // district from -7 up report envelopeKnown:false — the tool disclaiming
  // knowledge it demonstrably had, which erodes the disclaimer everywhere it is
  // true.
  const envelopeKnown = farForUse != null || limits.maxHeightFt != null || statedStories != null
  return { overall, checks, path, envelopeKnown }
}
