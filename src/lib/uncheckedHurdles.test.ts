// The counting rule the result page and the comparison table both publish.
//
// This is the second half of the "a failed overlay read must not silently
// remove a requirement" fix, and it is the half that decides what a reader
// actually sees. The engine now emits an `unchecked` row where a city layer did
// not answer; if that row were counted as an approval, an outage would render
// as MORE approvals than a healthy run, which is the original defect with its
// sign flipped. These tests pin both directions.
import { describe, it, expect } from 'vitest'
import { summarizeUnchecked } from './uncheckedHurdles'
import type { Hurdle } from '../types/analysis'

const required = (label: string): Hurdle => ({ category: 'review', label, status: 'required', note: '' })
const unchecked = (label: string, excludedMonths?: number): Hurdle => ({
  category: 'historic',
  label,
  status: 'unchecked',
  note: '',
  ...(excludedMonths != null ? { excludedMonths } : {}),
})

describe('summarizeUnchecked', () => {
  it('leaves an ordinary report untouched', () => {
    // The healthy path is the overwhelming majority of responses, and it must
    // be byte-for-byte what it was: same count, no floor marker.
    const rows = [required('Article 80'), required('Inclusionary')]
    const s = summarizeUnchecked(rows)
    expect(s.counted).toEqual(rows)
    expect(s.unchecked).toEqual([])
    expect(s.excludedMonths).toBe(0)
  })

  it('does not count a disclosure as an approval', () => {
    const s = summarizeUnchecked([required('Article 80'), unchecked('Historic designation could not be checked', 3)])
    expect(s.counted.map((h) => h.label)).toEqual(['Article 80'])
    expect(s.unchecked).toHaveLength(1)
    // The whole point: the same parcel with the layer up shows 1 approval, and
    // with the layer down it must not show 2.
    expect(s.counted.length).toBe(summarizeUnchecked([required('Article 80')]).counted.length)
  })

  it('sums only the months an unchecked requirement would have carried', () => {
    // LA with both CA overlays down: the Coastal Development Permit is serial,
    // so its 9 months add in full — measured live 2026-08-12 as a 57 → 48 month
    // drop when the layer failed.
    const s = summarizeUnchecked([
      unchecked('Historic designation could not be checked', 3),
      unchecked('Coastal Zone status could not be checked', 9),
    ])
    expect(s.excludedMonths).toBe(12)
  })

  it('does not mark the timeline for a check that carries no months', () => {
    // A failed FEMA read leaves the SCHEDULE correct and only the cost
    // unstated. Marking the months here would overstate what is unknown, and a
    // caveat on the wrong number is the failure CLAUDE.md rule 7 describes.
    const s = summarizeUnchecked([required('Article 80'), unchecked('FEMA flood zone could not be checked')])
    expect(s.unchecked).toHaveLength(1)
    expect(s.excludedMonths).toBe(0)
  })

  it('never draws months from a row that is not a disclosure', () => {
    // `excludedMonths` on a `required` row would be a contradiction — months we
    // are asserting and withholding at once. If one ever appears, it must not
    // silently inflate the floor.
    const s = summarizeUnchecked([{ ...required('Article 80'), excludedMonths: 9 }])
    expect(s.excludedMonths).toBe(0)
  })
})
