import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { costPerSqFtByProduct } from '../src/config/estimates'
import { DIMENSION_LABELS } from '../src/config/coverage'

const ROOT = resolve(__dirname, '..')
// Whitespace-normalised: the source is JSX and its prose wraps mid-sentence,
// so a regex over the raw file matches nothing a reader would call absent.
const PAGE = readFileSync(join(ROOT, 'src/routes/Methodology.tsx'), 'utf8').replace(/\s+/g, ' ')

// THE PUBLISHED PAGE MUST NOT OUTLIVE THE WITHDRAWN FIGURE.
//
// Methodology renders its tables from the live constants precisely so they cannot
// drift — but the mixed-use rate was withdrawn in the engine while the page still
// printed $365 from the old use-keyed constant. That is the disclosure-copy
// failure this repo keeps finding: a retraction that reached the code and not the
// page a reader lands on.

describe('the cost table is generated from the product constant, not a stale one', () => {
  it('the page no longer reads the withdrawn use-keyed rates', () => {
    expect(PAGE, 'costPerSqFtByUse was replaced by costPerSqFtByProduct').not.toMatch(
      /costPerSqFtByUse/,
    )
    expect(PAGE).toMatch(/costPerSqFtByProduct/)
  })

  it('and never hardcodes a figure the engine could withdraw', () => {
    // 365 was the mixed-use blend. If it reappears as a literal on this page it
    // is no longer coming from the constant.
    expect(PAGE).not.toMatch(/\$365/)
  })

  it('every product state has copy explaining it', () => {
    // Four states, four explanations. A table cell reading "Not priced" with
    // nothing saying what that means is a dash with extra steps.
    // 'Provisional' left the page 2026-08-19 when NAHB sourced the detached rate.
    // In its place the page states that detached is a POINT, not a range —
    // because the survey publishes an average and no spread, and inventing a
    // band around a point is the thing the range was supposed to avoid.
    for (const phrase of ['Corroborated', 'Not sourced', 'Not priced']) {
      expect(PAGE, phrase).toContain(phrase)
    }
    expect(PAGE, 'the page must say detached is a single figure, not a range').toMatch(
      /a single figure, not a range/i,
    )
  })

  it('and the page states that no cost is shown rather than a zero', () => {
    expect(PAGE).toMatch(/not a zero and not a blank/i)
  })
})

describe('the coverage matrix says what its cost column covers', () => {
  it('the meaning names the multiplier and disclaims the base rate', () => {
    // The gap is per-PRODUCT and the matrix is per-CITY, so it cannot render
    // there. What it can do is stop a filled cell being read as "cost is
    // covered here".
    const means = DIMENSION_LABELS.cost.means
    expect(means).toMatch(/multiplier/i)
    expect(means).toMatch(/NOT the base rate/i)
    expect(means).toMatch(/2–4 unit|mixed/i)
  })

  it('and the two unpriced products really are unpriced, so the claim is true', () => {
    // Guards the copy against the constant: if either product gains a rate, the
    // disclaimer above becomes false and this goes red.
    expect(costPerSqFtByProduct['small-multi'].kind).not.toBe('rate')
    expect(costPerSqFtByProduct.mixed.kind).not.toBe('rate')
  })
})
