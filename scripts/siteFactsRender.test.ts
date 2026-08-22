import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '..')
// ⚠️ COMMENTS ARE NOT CODE, and this file has now matched its own prose twice.
// Every assertion about what the component RENDERS must run against stripped
// source; an explanatory comment naming a defect is indistinguishable from the
// defect to a regex.
const noComments = (t: string) => t.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
const SRC = readFileSync(join(ROOT, 'src/components/boston/result/siteFactValues.ts'), 'utf8')
const TYPES = readFileSync(join(ROOT, 'src/types/parcel.ts'), 'utf8')

// ⚠️ THE RENDER LAYER IS WHERE A RULE-5 DISTINCTION DIES, and the reason is
// structural rather than careless. The types carry five reasons a floor-area
// figure can be absent all the way to this component, and a ternary chain
// ending in a fallback string discards four of them with no compile error.
// Measured on production: SPI-1 SA1 returned `farByUse: {residential: 25,
// commercial: 25}` from the API while the page rendered "Not in public data".
describe('the Max FAR and Max height cells are exhaustive over their unions', () => {
  it('neither cell is a ternary chain ending in a fallback string', () => {
    // The shape that caused it. A chain of `basis === 'x' ? … : 'default'` is
    // invisible to the type checker, so upstream can add a state and this file
    // silently files it under the gap wording.
    expect(SRC).not.toMatch(/farBasis === '[a-z-]+'\s*\n?\s*\?/)
    expect(SRC).not.toMatch(/heightBasis === '[a-z-]+'\s*\n?\s*\?/)
  })

  it('routes both cells through a switch with no default', () => {
    // ⚠️ Bounded by the NEXT declaration, not by a character count. A fixed-size
    // window is a probe that silently stops covering the thing it measures the
    // moment a comment grows — which it did, one commit after this was written.
    const bodyOf = (fn: string) => {
      const i = SRC.indexOf(fn)
      expect(i, `${fn} is missing`).toBeGreaterThan(-1)
      const next = SRC.indexOf('\nexport function ', i + fn.length)
      return SRC.slice(i, next === -1 ? SRC.length : next)
    }
    for (const fn of ['function maxFarValue', 'function maxHeightValue', 'function maxFloorAreaRows']) {
      const body = bodyOf(fn)
      expect(body).toMatch(/switch \(basis\)/)
      // `assertNever` is the only permitted default — it is a compile error, not
      // a fallback. A plain `default:` returning a string is the defect.
      expect(body).toMatch(/assertNever\(basis\)/)
      expect(body).not.toMatch(/default:\s*\n?\s*return \{ value: '/)
    }
  })

  it('names every farBasis state the type declares — none may fall through silently', () => {
    // Rule 20: pin the input set. Without this the check passes vacuously if the
    // union is renamed, and the count is what makes a NEW state visible here.
    const union = TYPES.slice(TYPES.indexOf('farBasis:'), TYPES.indexOf('heightBasis?'))
    const states = [...union.matchAll(/\| '([a-z-]+)'/g)].map((m) => m[1])
    expect(states.length).toBe(7)
    expect(states).toContain('basis-elective')
    const far = SRC.slice(SRC.indexOf('function maxFarValue'), SRC.indexOf('function maxHeightValue'))
    for (const s of states) expect(far, `farBasis '${s}' has no case`).toContain(`case '${s}':`)
  })

  it('never tells the reader a published ratio is missing', () => {
    // ⚠️ COMMENTS STRIPPED FIRST. The previous version of this assertion matched
    // the word "Not in public data" inside an explanatory comment and reported a
    // defect in prose rather than in output — measuring the probe, not the page.
    const far = noComments(SRC.slice(SRC.indexOf('function maxFarValue'), SRC.indexOf('function maxHeightValue')))
    // The three states where the code DOES publish a figure must not reach the
    // gap sentence. 'Not in public data' is reserved for an actual gap.
    for (const s of ['unconstrained', 'planned-development', 'basis-unavailable', 'basis-elective']) {
      const at = far.indexOf(`case '${s}':`)
      expect(at, `'${s}' has no case`).toBeGreaterThan(-1)
      const seg = far.slice(at, far.indexOf('return', at) + 200)
      expect(seg, `'${s}' renders as a gap`).not.toContain('Not in public data')
    }
  })

  it('the per-use ratios reach the client at all', () => {
    // The first of the three layers: `farByUse` used to stop at the API
    // boundary, so the client could not have rendered the ratio even with a
    // correct branch.
    const analysis = readFileSync(join(ROOT, 'src/types/analysis.ts'), 'utf8')
    expect(analysis).toMatch(/farByUse\?: ParcelInfo\['zoning'\]\['farByUse'\]/)
    const fn = readFileSync(join(ROOT, 'netlify/functions/analyze.ts'), 'utf8')
    expect(fn).toMatch(/farByUse: parcel\.zoning\.farByUse/)
    expect(fn).toMatch(/farElectiveByUse: parcel\.zoning\.farElectiveByUse/)
  })

  it('does not truncate a use label into a non-word', () => {
    // 'mixe' and 'inst' shipped for one commit. A cell that looks like a data
    // error is read as one, which costs more trust than the abbreviation saves.
    const far = noComments(SRC.slice(SRC.indexOf('function maxFarValue'), SRC.indexOf('function maxFloorAreaRows')))
    expect(far).not.toMatch(/\.slice\(0, ?4\)/)
    expect(far).toMatch(/USE_LABEL/)
    for (const w of ['res', 'comm', 'mixed', 'civic']) expect(far).toContain(`'${w}'`)
  })
})
