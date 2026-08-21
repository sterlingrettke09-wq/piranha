import { describe, it, expect } from 'vitest'
// Vite-native `?raw`, the same mechanism cities.test.ts uses.
import ROADMAP from '../../docs/ROADMAP.md?raw'
import { ADU_LOCAL_READ } from '../../netlify/functions/lib/zoning/adu'
import { CITIES } from './cities'

// ⚠️ WHY THIS GUARD EXISTS. A "what is next?" question surfaced a roadmap entry
// for work finished days earlier — and one stale entry found by accident meant
// others. A sweep found six, two of them SUMMARY TABLES contradicting the same
// document's own section headings: the build order said parcel-weighted coverage
// was NOT STARTED beside a section headed "DONE 2026-08-19", and the feature
// order said "None started" over five rows that were done or under way.
//
// That is rule 17's failure in its purest form. Headers and summaries are read
// FIRST, so a reader opening the roadmap to learn the state of the work takes
// the stale claim and never reaches the detail. The detail being correct is
// exactly what makes it invisible.
//
// The check is WITHIN-DOCUMENT where it can be, because that needs no external
// truth and catches the case that actually happened: a summary asserting the
// opposite of a heading twenty screens below it.

/** Every `## <Feature> — DONE|STARTED` section heading. */
function completedSections(): string[] {
  return [...ROADMAP.matchAll(/^## ([^\n—]+?)\s*—\s*(DONE|STARTED|ALL \d+)/gm)].map((m) =>
    m[1].trim().toLowerCase(),
  )
}

describe('⚠️ the roadmap’s summaries agree with its own body', () => {
  it('no summary claims nothing has started while sections say otherwise', () => {
    // The literal sentence that was wrong for five of six rows.
    expect(ROADMAP).not.toMatch(/^None started\./m)
    // And it cannot pass by the sections having vanished.
    expect(completedSections().length).toBeGreaterThanOrEqual(4)
  })

  it('⚠️ no row is NOT STARTED for something the body reports DONE', () => {
    const done = completedSections()
    const offenders: string[] = []
    for (const row of ROADMAP.split('\n').filter((l) => l.startsWith('|'))) {
      if (!/NOT STARTED/.test(row)) continue
      const label = (row.match(/\*\*([^*]+)\*\*/) ?? [])[1]
      if (!label) continue
      const key = label.trim().toLowerCase()
      if (done.some((d) => d.includes(key) || key.includes(d))) offenders.push(label)
    }
    expect(
      offenders,
      'a summary row says NOT STARTED for work this document reports as done — ' +
        'headers and summaries are read first, so this is the worst place to be stale',
    ).toEqual([])
  })

  it('⚠️ the ADU claims match the engine, not a remembered state', () => {
    // The ADU block said "1 of 5 read" and listed "the eighteen unread cities"
    // as next work, days after all 23 were read. Checked against the engine
    // rather than against the prose, because the prose is the thing that drifts.
    expect(ADU_LOCAL_READ.length).toBe(CITIES.length)
    expect(ROADMAP).not.toMatch(/\b1 of 5 read\b/)
    expect(ROADMAP).not.toMatch(/the eighteen unread cities/)
    // The live figure must appear, so this cannot pass by the section being cut.
    expect(ROADMAP).toMatch(new RegExp(`ALL ${ADU_LOCAL_READ.length} CITIES READ`))
  })

  it('⚠️ the sweep denominator is not the figure the sweep opened at', () => {
    // "LA is 440 of the 731 sweep gaps" survived after the same document's later
    // section recorded the day closing at 653. A stale DENOMINATOR is harder to
    // see than a stale numerator — the 440 was right, which made the sentence
    // look checked.
    const bullet = ROADMAP.slice(ROADMAP.indexOf('#15 LA recodification'))
      .slice(0, 700)
    expect(bullet).toMatch(/440 of the 653/)
    expect(bullet).not.toMatch(/440 of the 731/)
  })
})
