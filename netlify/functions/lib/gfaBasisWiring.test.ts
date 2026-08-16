import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// THE ASSERTION THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT.
//
// `src/lib/gfaBasis.ts` is correct, and its correctness is worth nothing if a
// call site reimplements it. That is precisely what had happened: the chain was
// copied into the live handler, the client-side default spec and the coverage
// sampler, and when a fourth `farBasis` landed only one copy was updated. The
// live handler would have mapped LA to 'assumed-far-1.0' — disabling the
// fail-closed guard written for it and printing a disclosure claiming the
// district publishes no floor-area ratio when it publishes one.
//
// No unit test could see it: a unit test calls the function under test, and
// every copy was internally consistent. `tsc` caught it only by luck (the
// sampler's copy had narrowed enough for the new comparison to be provably
// dead, TS2367). This file replaces that luck with a check.
//
// It lives under `netlify/` rather than beside the module because `src`'s
// tsconfig carries no node types and these assertions must read files.

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

/** Every file that derives a gfaBasis. Pinned and asserted non-empty, because a
 *  wiring check over zero files passes vacuously (rule 20). */
const SITES: Array<[string, string]> = [
  ['analyze.ts (the live HTTP path)', '../analyze.ts'],
  ['defaultSpec.ts (client-side)', '../../../src/lib/defaultSpec.ts'],
  ['smoke-parcels.ts (the coverage sampler)', '../../../scripts/smoke-parcels.ts'],
]

describe('the site inventory is pinned and readable (rule 20)', () => {
  it('names three sites and every one exists', () => {
    expect(SITES.length).toBe(3)
    for (const [name, rel] of SITES) {
      expect(read(rel).length, `${name} is unreadable — the check would pass by finding nothing`).toBeGreaterThan(500)
    }
  })

  it('the shared module exists and exports both entry points', () => {
    const src = read('../../../src/lib/gfaBasis.ts')
    expect(src).toMatch(/export function deriveGfaBasis/)
    expect(src).toMatch(/export function gfaBasisForFarBasis/)
  })
})

describe('all three call sites use the shared derivation', () => {
  it.each(SITES)('%s imports it', (_name, rel) => {
    expect(read(rel)).toMatch(/from '[^']*gfaBasis'/)
  })

  it.each(SITES)('%s does not reimplement the chain', (_name, rel) => {
    // The copied chain's signature: comparing farBasis to the reason strings
    // inline. Matching again means a fourth copy has appeared, which is the
    // exact state this module was created to end.
    const src = read(rel)
    expect(src, 'inline farBasis comparison found — has the chain been copied back?').not.toMatch(
      /farBasis === 'unconstrained'/,
    )
    expect(src).not.toMatch(/farBasis === 'planned-development'/)
    expect(src).not.toMatch(/farBasis === 'basis-unavailable'/)
  })
})
