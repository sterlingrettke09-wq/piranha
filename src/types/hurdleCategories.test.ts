import { describe, it, expect } from 'vitest'
import { HURDLE_CATEGORIES } from './analysis'
// Vite-native `?raw`, the same mechanism cities.test.ts uses — `src` is
// typechecked without @types/node.
import HURDLES_SRC from '../../netlify/functions/lib/hurdles.ts?raw'
import HOME_SRC from '../routes/Home.tsx?raw'

/** Every `category: '…'` the hurdle engine actually assigns. */
function emitted(): Set<string> {
  return new Set([...HURDLES_SRC.matchAll(/category:\s*'([a-z]+)'/g)].map((m) => m[1]))
}

describe('⚠️ the hurdle-category count is derived, and matches what is emitted', () => {
  it('the list and the engine agree in BOTH directions', () => {
    // The Home page said "9 kinds of red tape tracked". The engine emits TEN,
    // and the last person to check recalled eleven or twelve — three numbers for
    // one claim, which is why it is derived now rather than corrected.
    //
    // Both directions matter and they fail differently: a category in the list
    // that nothing emits inflates the count with a kind we do not actually
    // track, and one emitted but unlisted means the headline undercounts the
    // product. Neither is visible from the number alone.
    const declared = new Set<string>(HURDLE_CATEGORIES)
    const used = emitted()
    expect([...declared].filter((c) => !used.has(c)), 'declared but never emitted').toEqual([])
    expect([...used].filter((c) => !declared.has(c)), 'emitted but not declared').toEqual([])
  })

  it('⚠️ the set is non-empty and pinned, so the check cannot pass by finding nothing', () => {
    // rule 20. If the regex above ever stopped matching — a formatting change in
    // hurdles.ts would do it — both filters would be empty and the test would go
    // green over nothing.
    expect(emitted().size).toBeGreaterThanOrEqual(10)
    expect(HURDLE_CATEGORIES.length).toBe(10)
    expect(new Set(HURDLE_CATEGORIES).size).toBe(HURDLE_CATEGORIES.length)
  })

  it('⚠️ Home states no literal count', () => {
    // Correcting 9 to 10 would have reset the clock rather than fixed the class.
    const i = HOME_SRC.indexOf('Kinds of red tape tracked')
    expect(i).toBeGreaterThan(-1)
    const stat = HOME_SRC.slice(Math.max(0, i - 220), i + 40)
    expect(stat).toMatch(/HURDLE_CATEGORIES\.length/)
    expect(stat).not.toMatch(/figure: '\d+'/)
  })

  it('⚠️ no surface claims completeness the model contradicts', () => {
    // `uncheckedHurdles` documents the count as a FLOOR and the report renders
    // "At least — N checks unavailable". An "every hurdle there is" on the way in
    // is contradicted on the way out, in the same session.
    expect(HOME_SRC).not.toMatch(/title: 'Every hurdle'/)
  })
})
