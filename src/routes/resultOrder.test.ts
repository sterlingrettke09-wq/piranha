import { describe, it, expect } from 'vitest'
import SRC from './BostonResult.tsx?raw'

// ⚠️ THE ANSWER MUST NOT SIT BELOW THE READER'S OWN INPUT.
//
// Measured on production before this change, 1280x720: the address block opened
// at 199px and the verdict kicker did not appear until 510px. Everything in
// between — the display-size address, the parcel/district/lot line, the watch
// control, the project pills — is something the reader typed or chose.
//
// Asserted on ORDER OF APPEARANCE in the source, which is what determines
// document order here. Fragile to a large refactor and deliberately so: this is
// a claim about layout that no type can carry, and the alternative is nothing.
const at = (needle: string) => {
  const i = SRC.indexOf(needle)
  expect(i, `not found: ${needle}`).toBeGreaterThan(-1)
  return i
}

describe('the report answers before it restates the question', () => {
  it('renders the verdict before the identity details, on BOTH branches', () => {
    const placements = [...SRC.matchAll(/\{identityBlock\}/g)].map((m) => m.index!)
    expect(placements.length, 'must render on the blocked branch too').toBe(2)
    // Branch order in the file: developable === false first, then the normal one.
    // Each placement must follow its own branch's verdict, not merely one of them
    // — a single check would pass with the blocked branch still leading with the
    // identity block.
    expect(placements[0], 'blocked branch').toBeGreaterThan(at('Not a developable site'))
    expect(placements[1], 'developable branch').toBeGreaterThan(at('<VerdictBanner'))
  })

  it('keeps the address above — the wrong-parcel check is worth one line', () => {
    // Deliberate exception. Geocoding can resolve to the wrong lot, and a
    // NOT ALLOWED verdict read against a parcel the reader never meant is worse
    // than a verdict one scroll further down.
    expect(at('{state.data.parcel.address}')).toBeLessThan(at('<VerdictBanner'))
  })

  it('no longer gives the address display-size type above the answer', () => {
    const h1 = SRC.slice(at('<h1'), at('</h1>'))
    expect(h1).not.toMatch(/3\.6rem|5vw/)
  })

  it('⚠️ the identity details are still UNCONDITIONAL', () => {
    // What the previous comment on the lot line actually protected: no size test
    // decides whether a reader sees the size of the thing being priced. Moving
    // the block must not have turned it into something a branch can skip.
    const decl = SRC.slice(at('const identityBlock'), at('const identityBlock') + 900)
    expect(decl).toMatch(/lotSqFt != null/)
    expect(decl).toMatch(/lot size not on file/)
    // and it renders on the blocked branch too, where KeyMetrics never mounts
    expect([...SRC.matchAll(/\{identityBlock\}/g)].length).toBe(2)
  })

  it('does not restate the retracted claim about sitting above the verdict', () => {
    // Rule 21: the note that said this block is on screen before the verdict is
    // now false. It must be described, not reproduced.
    const live = SRC.replace(/⚠️ RENDERED AFTER THE ANSWER[\s\S]*?\*\//, '')
    expect(live).not.toMatch(/on screen before\s*\n?\s*(the )?verdict/)
  })
})
