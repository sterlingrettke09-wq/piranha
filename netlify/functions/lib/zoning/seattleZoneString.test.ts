import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { seattleBaseHeightFt, seattleBaseZoneToken, stripMioPrefix } from './seattleZoneString'

// THE EXTERNAL ANCHOR.
//
// Every code below came from a live enumeration of the ZONING field, not from
// either parser. That distinction is the whole point: a test that compares two
// implementations to each other passes when both are wrong, which is exactly the
// state this codebase was in — zoning/seattle.ts and providers/seattle.ts each
// parsed the same string, disagreed on 39 of 285 live codes, and the only thing
// asserting they agreed was a sentence in a docstring.
//
// CLAUDE.md rule 9: every check that has ever found a real defect here compared
// the system to something OUTSIDE it.

interface Row {
  code: string
  before: number | null
  after: number | null
  direction: 'overstated' | 'understated' | 'null-side'
}
interface Fixture {
  source: string
  totalDistinct: number
  allCodes: string[]
  divergent: Row[]
}

const FIXTURE: Fixture = JSON.parse(
  readFileSync(resolve(__dirname, './__fixtures__/seattleZoneCodes.json'), 'utf8'),
)

describe('the fixture is pinned to the live layer (rule 20)', () => {
  it('carries the full enumeration and a non-empty divergent set', () => {
    // A check over an empty set passes vacuously. Pin the sizes so a fixture
    // that silently empties — or a regeneration that quietly shrinks — goes red.
    expect(FIXTURE.totalDistinct).toBe(285)
    expect(FIXTURE.allCodes.length).toBe(285)
    expect(FIXTURE.divergent.length).toBe(39)
    expect(FIXTURE.source).toMatch(/live enumeration/i)
  })

  it('pins both directions separately, and both are non-empty', () => {
    // ⚠️ THE ASSERTION THAT STOPS A HALF-FIX. 22 codes overstated and 11
    // understated. A fix that corrected only the overstating family — the
    // flattering direction, and the one anybody would notice first — would sail
    // through a test that only counted "is it lower now".
    const by = (d: Row['direction']) => FIXTURE.divergent.filter((r) => r.direction === d)
    expect(by('overstated').length).toBe(22)
    expect(by('understated').length).toBe(11)
    expect(by('null-side').length).toBe(6)
  })
})

describe('the MIO overlay height is never published as the base height', () => {
  // The defect, stated structurally so it needs no sourced height figure:
  // "MIO-160-LR1 (M)" carries a 160 that belongs to the Major Institution
  // Overlay. Whatever LR1's base height is, it is not the overlay's number.
  const mioCodes = FIXTURE.allCodes.filter((c) => /^MIO-\d{1,3}-/.test(c))

  it('the MIO set is non-empty', () => {
    expect(mioCodes.length).toBeGreaterThan(30)
  })

  it.each(mioCodes)('%s does not report its overlay height', (code) => {
    const overlay = Number(/^MIO-(\d{1,3})-/.exec(code)![1])
    const got = seattleBaseHeightFt(code)
    // COINCIDENCE GUARD. The claim is that the overlay number does not LEAK into
    // the answer — not that the answer never equals it. Two live codes collide
    // honestly: MIO-240-HR (M), where HR's tier default is also 240, and
    // MIO-50-LR3 (M), where LR3's is also 50. Deciding that by re-reading the
    // bare form is the right discriminator, because the bare form cannot see
    // the overlay at all.
    const bareAnswer = seattleBaseHeightFt(code.replace(/^MIO-\d{1,3}-/, ''))
    if (bareAnswer !== overlay) {
      expect(got, `${code} published its MIO overlay height`).not.toBe(overlay)
    }
  })
})

describe('an MIO-prefixed code reads exactly like its bare equivalent', () => {
  // What the fix actually guarantees. It deliberately does NOT claim the bare
  // figure is correct — the LR/MR/HR tier heights are uncited and pre-existing
  // (see the module header). It claims the overlay prefix stops changing the
  // answer, which is true whether or not the tier figures are later corrected.
  it.each(FIXTURE.allCodes.filter((c) => /^MIO-\d{1,3}-/.test(c)))(
    '%s == its bare form',
    (code) => {
      const bare = code.replace(/^MIO-\d{1,3}-/, '')
      expect(seattleBaseHeightFt(code)).toBe(seattleBaseHeightFt(bare))
    },
  )
})

describe('every divergent code now returns the corrected value', () => {
  it.each(FIXTURE.divergent.map((r) => [r.code, r.before, r.after, r.direction] as const))(
    '%s: %s -> %s (%s)',
    (code, before, after) => {
      expect(seattleBaseHeightFt(code)).toBe(after)
      expect(seattleBaseHeightFt(code)).not.toBe(before)
    },
  )
})

describe('the 246 non-divergent codes are unchanged', () => {
  // The control. A "fix" that moved every code would also make the divergent
  // assertions pass, and would be a different bug. Pins that only the 39 moved.
  const unchanged = FIXTURE.allCodes.filter(
    (c) => !FIXTURE.divergent.some((r) => r.code === c),
  )

  it('the control set is the rest of the enumeration', () => {
    expect(unchanged.length).toBe(285 - 39)
  })

  it('NC/C codes with a trailing height still read that height', () => {
    // The family the old parse got right, and the reason its author believed
    // take-the-last-number was sufficient.
    expect(seattleBaseHeightFt('NC3-65')).toBe(65)
    expect(seattleBaseHeightFt('C1-40')).toBe(40)
    expect(seattleBaseHeightFt('MIO-105-NC3-65')).toBe(65)
    expect(seattleBaseHeightFt('NC3P-95 (M2)')).toBe(95)
  })

  it('industrial U/## still returns null, not a wrongly-low cap', () => {
    expect(seattleBaseHeightFt('IG1 U/85')).toBeNull()
    expect(seattleBaseHeightFt('IC-45 U/85')).toBeNull()
  })
})

describe('the two strip helpers stay distinct', () => {
  // Collapsing them deleted the MHA suffix and moved nine NC/C districts off
  // their correct FAR. The existing Seattle tests caught it; this pins why the
  // split exists so nobody merges them back.
  it('stripMioPrefix keeps the MHA suffix', () => {
    expect(stripMioPrefix('MIO-160-LR1 (M)')).toBe('LR1 (M)')
    expect(stripMioPrefix('NC2-40 (M1)')).toBe('NC2-40 (M1)')
  })

  it('seattleBaseZoneToken removes it, for the height read only', () => {
    expect(seattleBaseZoneToken('MIO-160-LR1 (M)')).toBe('LR1')
    expect(seattleBaseZoneToken('NC2-40 (M1)')).toBe('NC2-40')
  })

  it('the parenthetical that started it', () => {
    // "LR2 (0.75)" is in the live enumeration; its "75" was read as a height.
    expect(FIXTURE.allCodes).toContain('LR2 (0.75)')
    expect(seattleBaseHeightFt('LR2 (0.75)')).toBe(40)
  })
})

// ── Seattle: the second instance of the same pattern, found by grepping for
// comments that CLAIM a mirroring nothing enforces. The discriminator that
// matters when running that grep: a comment DESCRIBING a test is fine
// (analyze.ts:56 names the test that keeps its list in sync); a comment
// SUBSTITUTING for one is the failure. zoning/seattle.ts said it "mirrors the
// provider's suffix parsing" and nothing checked — and could not have, since
// the provider's parser was module-private.
const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('Seattle reads a zone string in exactly one place', () => {
  const SEATTLE_SITES: Array<[string, string]> = [
    ['providers/seattle.ts', '../providers/seattle.ts'],
    ['zoning/seattle.ts', './seattle.ts'],
  ]

  it('the inventory is pinned and readable (rule 20)', () => {
    expect(SEATTLE_SITES.length).toBe(2)
    for (const [name, rel] of SEATTLE_SITES) expect(read(rel).length, name).toBeGreaterThan(500)
    const shared = read('./seattleZoneString.ts')
    expect(shared).toMatch(/export function seattleBaseHeightFt/)
    expect(shared).toMatch(/export function stripMioPrefix/)
  })

  it.each(SEATTLE_SITES)('%s imports the shared reader', (_name, rel) => {
    expect(read(rel)).toMatch(/from '[^']*seattleZoneString'/)
  })

  it.each(SEATTLE_SITES)('%s does not strip the MIO prefix inline', (_name, rel) => {
    // The signature of the copied logic. Finding it again means the two readings
    // have been re-forked, which is how 39 of 285 live codes came to disagree.
    expect(read(rel), 'inline MIO strip found — has the parse been copied back?').not.toMatch(
      /replace\(\/\^MIO-/,
    )
  })
})
