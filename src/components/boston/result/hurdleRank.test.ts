import { describe, it, expect } from 'vitest'
import { rankHurdles, RANK } from './hurdleRank'
// ?raw rather than node:fs — `tsconfig.app.json` covers `src` without node types,
// and a test that only vitest can typecheck is a test the build cannot see.
import ANALYSIS_SRC from '../../../types/analysis.ts?raw'
import HURDLES_SRC from './HurdlesSection.tsx?raw'
import { HURDLE_CATEGORIES } from '../../../types/analysis'
import type { Hurdle, HurdleStatus } from '../../../types/analysis'

const h = (status: HurdleStatus, label: string): Hurdle =>
  ({ status, label, category: HURDLE_CATEGORIES[0] }) as unknown as Hurdle

// The order a live Atlanta parcel returned on 2026-08-22, verbatim. Not an
// invented shape: the required rows really do arrive at positions 3, 5 and 6,
// behind two informational ones.
const LIVE_ORDER: HurdleStatus[] = [
  'info', 'info', 'required', 'info', 'required', 'required', 'likely', 'info', 'info', 'info', 'info',
]

describe('hurdles are ranked, never collapsed', () => {
  it('puts every required row above every likely, and likely above info', () => {
    const ranked = rankHurdles(LIVE_ORDER.map((s, i) => h(s, `row ${i}`)))
    const seq = ranked.map((r) => r.status)
    expect(seq.slice(0, 3)).toEqual(['required', 'required', 'required'])
    expect(seq[3]).toBe('likely')
    expect(new Set(seq.slice(4))).toEqual(new Set(['info']))
  })

  it('⚠️ LOSES NOTHING — every row survives the sort', () => {
    // The failure mode this whole change was chosen to avoid. A collapse would
    // pass an ordering test and still hide the rows a 40-unit project depends
    // on, so the count and the membership are pinned, not just the order.
    const input = LIVE_ORDER.map((s, i) => h(s, `row ${i}`))
    const ranked = rankHurdles(input)
    expect(ranked.length).toBe(input.length)
    expect(new Set(ranked.map((r) => r.label))).toEqual(new Set(input.map((r) => r.label)))
  })

  it('is stable within a rank — engine order among equals is meaningful', () => {
    const input = [h('info', 'a'), h('required', 'b'), h('info', 'c'), h('required', 'd')]
    expect(rankHurdles(input).map((r) => r.label)).toEqual(['b', 'd', 'a', 'c'])
  })

  it("sorts 'unchecked' last rather than into the severity ramp", () => {
    // It is a claim about the REPORT, not the parcel. Ranked between 'likely'
    // and 'info' it would read as a middling hazard, which is the exact
    // confusion its chip styling already exists to prevent.
    const input = [h('info', 'i'), h('unchecked', 'u'), h('required', 'r'), h('likely', 'l')]
    expect(rankHurdles(input).map((r) => r.label)).toEqual(['r', 'l', 'i', 'u'])
    expect(RANK.unchecked).toBeGreaterThan(Math.max(RANK.required, RANK.likely, RANK.info))
  })

  it('ranks every status the union declares — a new one cannot default to 0', () => {
    // Rule 20: pin the set. `Record<HurdleStatus, number>` already makes a new
    // member a compile error; this pins the count so the union itself cannot be
    // quietly narrowed instead.
    const union = ANALYSIS_SRC.slice(ANALYSIS_SRC.indexOf('export type HurdleStatus'))
    const states = [...union.slice(0, 140).matchAll(/'([a-z]+)'/g)].map((m) => m[1])
    expect(states.length).toBe(4)
    for (const s of states) expect(RANK).toHaveProperty(s)
  })

  it('the renderer actually calls it', () => {
    // The distinction reaching the module is not the distinction reaching the
    // screen — the defect class this session has now hit three times.
    expect(HURDLES_SRC).toMatch(/rankHurdles\(hurdles\)\.map\(/)
    expect(HURDLES_SRC).not.toMatch(/\{hurdles\.map\(/)
  })
})
