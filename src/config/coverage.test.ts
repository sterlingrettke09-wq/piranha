import { describe, it, expect } from 'vitest'
import {
  COVERAGE_DIMENSIONS,
  ABSENCE_REASONS,
  ABSENCE_CODE_LEGEND,
  DIMENSION_LABELS,
  coverageCell,
  isCovered,
  suppressedPermitTiers,
  type CoverageDimension,
} from './coverage'
import { CITIES, CITIES_WITH_MEASURED_PERMITS } from './cities'
import { envelopeSample } from './envelopeSample'
import permitStatsJson from '../../netlify/functions/lib/data/permitStats.json'
import reliefStatsJson from '../../netlify/functions/lib/data/reliefStats.json'

// ─── The drift guard ────────────────────────────────────────────────────────
// Every (city, dimension) is either derived-present or carries exactly one
// recorded reason — never both, never neither. This is what forces a stale
// reason to be DELETED in the same change that lands new data: presence is
// derived from the artifact, so the moment (say) Chicago's relief rate lands
// in reliefStats.json, its 'not-published' record here makes this test red.
//
// Proven by perturbation during development (both failures observed, then
// reverted):
//   · a fake city appended to CITIES → "fakecity/hurdles is absent with no
//     recorded reason"
//   · Chicago's relief reason deleted → "chicago/relief is absent with no
//     recorded reason"
describe('coverage drift guard', () => {
  it('every (city, dimension) is derived-present XOR carries exactly one reason', () => {
    for (const c of CITIES) {
      for (const dim of COVERAGE_DIMENSIONS) {
        const covered = isCovered(c.slug, dim)
        const reason = ABSENCE_REASONS[c.slug]?.[dim]
        expect(
          covered !== Boolean(reason),
          `${c.slug}/${dim}: covered=${covered}, reason=${reason ? `'${reason.code}'` : 'none'} — must be exactly one`,
        ).toBe(true)
        // coverageCell throws on the same violation; exercise the real entry
        // point the page renders from, not only the layer underneath it.
        expect(() => coverageCell(c.slug, dim)).not.toThrow()
      }
    }
  })

  it('no absence reason is recorded for a slug outside the city registry', () => {
    const known = new Set(CITIES.map((c) => c.slug))
    for (const slug of Object.keys(ABSENCE_REASONS)) {
      expect(known.has(slug), `${slug} carries reasons but is not a registry city`).toBe(true)
    }
  })

  it('every reason names one of the four codes and carries a readable one-liner', () => {
    for (const [slug, dims] of Object.entries(ABSENCE_REASONS)) {
      for (const [dim, r] of Object.entries(dims ?? {})) {
        expect(r.code in ABSENCE_CODE_LEGEND, `${slug}/${dim} code '${r.code}'`).toBe(true)
        // A reason string is user-facing disclosure copy, not a tag: it must
        // say something ("publishes no permit application date"), not just
        // restate the code.
        expect(r.reason.length, `${slug}/${dim} reason too short to inform`).toBeGreaterThan(40)
      }
    }
  })
})

// ─── Presence is genuinely derived, not transcribed ─────────────────────────
describe('derived presence', () => {
  it('permits presence matches the committed artifact AND the curated list', () => {
    const artifact = Object.keys(permitStatsJson)
    for (const c of CITIES) {
      expect(isCovered(c.slug, 'permits')).toBe(artifact.includes(c.slug))
    }
    // The curated list in cities.ts is itself tested against the artifact
    // elsewhere; cross-check the triangle closes.
    for (const slug of CITIES_WITH_MEASURED_PERMITS) {
      expect(isCovered(slug, 'permits')).toBe(true)
    }
  })

  it('relief presence matches the committed artifact', () => {
    const artifact = Object.keys(reliefStatsJson)
    for (const c of CITIES) {
      expect(isCovered(c.slug, 'relief')).toBe(artifact.includes(c.slug))
    }
  })

  it('a dimension label exists for every dimension', () => {
    for (const dim of COVERAGE_DIMENSIONS) {
      expect(DIMENSION_LABELS[dim as CoverageDimension].label.length).toBeGreaterThan(0)
    }
  })
})

// ─── A filled envelope cell is not a uniform claim ──────────────────────────
// Presence being derived stopped a cell claiming coverage the product does not
// have. It did NOT stop a cell claiming coverage is UNIFORM when it is not:
// `envelope` was derived from `CITIES[].live`, a flag about our plumbing. Over
// the 575-parcel live sample Denver resolved an envelope for 2 of the 6
// developable parcels it answered for and Chicago for 11 of 11 — one dot each.
//
// The cell now carries a measured rate. These tests are the drift guard for it:
// a rate that goes missing, or one hand-typed into this module, is the same
// class of defect as a stale absence reason.
describe('the envelope cell carries a measured rate', () => {
  it('every live city has one — an unmeasured envelope cell must not ship', () => {
    // Rule 20 at the boundary the matrix reads: the artifact can go quiet
    // (deleted, or a new city nobody sampled) and every affected cell would
    // render without anything failing. Pinned so it fails here instead.
    for (const c of CITIES.filter((c) => c.live)) {
      const cell = coverageCell(c.slug, 'envelope')
      expect(cell.covered, `${c.slug}/envelope`).toBe(true)
      if (!cell.covered) continue
      expect(cell.sample, `${c.slug}/envelope carries no sample`).not.toBeNull()
      expect(cell.sample!.kind, `${c.slug}/envelope is not measured`).toBe('measured')
    }
  })

  it('the rate is read from the artifact, not restated here', () => {
    // Same file, same numbers, one source. If this module ever grew its own copy
    // of a rate the two could disagree and the matrix would show the copy.
    for (const c of CITIES.filter((c) => c.live)) {
      const cell = coverageCell(c.slug, 'envelope')
      expect(cell.covered && cell.sample).toEqual(envelopeSample(c.slug))
    }
  })

  it('no other dimension pretends to carry a rate', () => {
    // The qualifier is specific to envelope. A permits or relief cell silently
    // carrying an envelope sample would render a number about the wrong thing.
    for (const c of CITIES) {
      for (const dim of COVERAGE_DIMENSIONS) {
        if (dim === 'envelope') continue
        const cell = coverageCell(c.slug, dim)
        if (cell.covered) expect(cell.sample, `${c.slug}/${dim}`).toBeNull()
      }
    }
  })

  it('the matrix would render the five overstated cities differently from the clean ones', () => {
    // The defect, stated as the property that closes it: before this change
    // every one of these eight cells produced the identical glyph.
    const share = (slug: string) => {
      const cell = coverageCell(slug, 'envelope')
      if (!cell.covered || cell.sample?.kind !== 'measured') throw new Error(`${slug} has no measured envelope rate`)
      return cell.sample.share
    }
    for (const slug of ['denver', 'lasvegas', 'miami', 'austin', 'la']) {
      for (const clean of ['chicago', 'nyc', 'raleigh']) {
        expect(share(slug), `${slug} still renders like ${clean}`).toBeLessThan(share(clean))
      }
    }
  })
})

// ─── The suppressed-tier caveat is derived from the artifact ────────────────
// Denver measured its 2–4 unit tier and refused to publish it (below the n=30
// floor). That marker is read from permitStats.json's own
// tierBreakdown.suppressed record, so publishing the tier deletes the caveat
// in the same commit that lands the data — no hand-kept flag to go stale.
describe('suppressed permit tiers', () => {
  it('denver carries the suppressed multi tier, read from the artifact', () => {
    expect(suppressedPermitTiers('denver')).toEqual(['multi'])
  })

  it('suppression markers only ever appear on derived-present permit cells', () => {
    for (const c of CITIES) {
      if (suppressedPermitTiers(c.slug).length > 0) {
        expect(isCovered(c.slug, 'permits'), `${c.slug} suppresses a tier but publishes nothing`).toBe(true)
      }
    }
  })
})

// ─── Pin the recorded history so it cannot be quietly rewritten ─────────────
// The withdrawn set is the record of published figures taken down after a
// measured disqualifier. A withdrawal disappearing from this set is either a
// re-publication (which must come with a new artifact entry, flipping the cell
// to derived-present) or an erasure — and an erasure should be loud.
describe('recorded absences, spot-checked against the standing records', () => {
  it('the six permit withdrawals are recorded as withdrawn, each with its own disqualifier', () => {
    const withdrawn = CITIES.filter(
      (c) => ABSENCE_REASONS[c.slug]?.permits?.code === 'withdrawn',
    ).map((c) => c.slug)
    expect(withdrawn.sort()).toEqual(['chicago', 'la', 'nyc', 'sandiego', 'seattle', 'sf'])
    // Five cities, five different measured disqualifiers — plus SF's sixth.
    // Flattening them into one sentence would erase the finding, so assert the
    // reasons are pairwise distinct.
    const reasons = withdrawn.map((s) => ABSENCE_REASONS[s]!.permits!.reason)
    expect(new Set(reasons).size).toBe(reasons.length)
  })

  it('milwaukee and dallas hold measured permit data back as conservative', () => {
    expect(ABSENCE_REASONS.milwaukee?.permits?.code).toBe('conservative')
    expect(ABSENCE_REASONS.dallas?.permits?.code).toBe('conservative')
  })

  it('the slot-test no-application-date cities are not-published, not not-built', () => {
    for (const slug of ['boston', 'dc', 'minneapolis', 'sanjose', 'columbus', 'charlotte', 'phoenix', 'lasvegas', 'atlanta']) {
      expect(ABSENCE_REASONS[slug]?.permits?.code, `${slug}/permits`).toBe('not-published')
    }
  })

  it('cities that went live after the relief survey and were never surveyed are not-built', () => {
    for (const slug of ['dallas', 'lasvegas', 'phoenix']) {
      expect(ABSENCE_REASONS[slug]?.relief?.code, `${slug}/relief`).toBe('not-built')
    }
  })

  // The 2026-08-10 addendum settled four cities into three different facts, and
  // the whole point of the matrix is that they do not render the same. Pin all
  // three shapes, because the cheap wrong move is to collapse them.
  it('columbus relief is a verified absence — not-published, not a gap', () => {
    // The status domain has a slot for an outcome and it holds only
    // passed/proposed; denials are absent ROWS, so a rate would read 100% by
    // construction. That is the jurisdiction's fact, not ours (rule 5).
    expect(ABSENCE_REASONS.columbus?.relief?.code).toBe('not-published')
    expect(ABSENCE_REASONS.columbus?.relief?.reason).toMatch(/passed/i)
    expect(ABSENCE_REASONS.columbus?.relief?.reason).toMatch(/proposed/i)
  })

  it('milwaukee and atlanta relief stays not-built: known presence, unbuilt', () => {
    // Surveyed and found FEASIBLE; blocked on our own declined scraping
    // dependency. 'not-published' here would blame the city for our decision,
    // so assert the code AND that the copy says a survey happened — a reason
    // implying nobody looked is the specific regression this guards.
    for (const slug of ['milwaukee', 'atlanta']) {
      expect(ABSENCE_REASONS[slug]?.relief?.code, `${slug}/relief`).toBe('not-built')
      expect(ABSENCE_REASONS[slug]?.relief?.reason, `${slug}/relief`).toMatch(/surveyed/i)
      expect(ABSENCE_REASONS[slug]?.relief?.reason, `${slug}/relief`).not.toMatch(/never surveyed/i)
    }
  })

  it('charlotte relief is derived-present and carries no leftover reason', () => {
    // reliefStats.json gained charlotte.variance on 2026-08-10; the stale
    // 'not-built' reason had to be deleted in the same change. Pinned so it
    // cannot be re-added as a "safe" default.
    expect(isCovered('charlotte', 'relief')).toBe(true)
    expect(ABSENCE_REASONS.charlotte?.relief).toBeUndefined()
  })
})
