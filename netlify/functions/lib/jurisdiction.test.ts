// The jurisdiction registry's own guard.
//
// `providers/upstreamSplit.test.ts` perturbs each gate through the real entry
// point and is the test that would catch a gate that stopped working. This file
// guards the thing that cannot be perturbed: the SHAPE of the table — that it
// covers every live city, that a 'none' entry is a decision rather than an
// omission, and that the fixture value each gate hands the shared probe harness
// actually satisfies that gate's own predicate.
//
// ⚠️ EVERY ASSERTION HERE PINS A NON-EMPTY SET (CLAUDE.md rule 20). A registry
// guard is exactly the shape that goes green by finding nothing: iterate the
// gates, assert each is well-formed, and the file passes with flying colours
// over an empty registry — including because someone deleted it. So the counts
// are pinned, the membership is pinned, and the 'none' side is pinned too.
import { describe, it, expect } from 'vitest'
import { JURISDICTIONS, GATED_CITIES, cityLimitsGate, outsideCity, type CityLimitsGate } from './jurisdiction'
import { LIVE_CITIES } from './parcel'

/** Cities measured on 2026-08-12 returning `ok: true` for a real address in a
 *  neighbouring jurisdiction, at the real entry point, stable on isolated
 *  re-probes. This is the defect the registry exists to close, so it is written
 *  down as membership rather than as a count. */
const WAS_PUBLISHING_NEIGHBOURS = [
  'austin',
  'charlotte',
  'chicago',
  'la',
  'miami',
  'nashville',
  'raleigh',
  'sandiego',
] as const

/** Gates that already existed, hand-written into their own providers. */
const ALREADY_GATED = ['columbus', 'dallas', 'lasvegas', 'phoenix'] as const

const settled = (features: Array<{ attributes: Record<string, unknown> }>) =>
  ({ status: 'fulfilled', value: { features } }) as const

describe('the jurisdiction registry', () => {
  it('covers exactly the cities the dispatcher serves', () => {
    expect(Object.keys(JURISDICTIONS).sort()).toEqual([...LIVE_CITIES].sort())
    expect(LIVE_CITIES.length).toBeGreaterThan(0)
  })

  // The inventory, pinned by MEMBERSHIP. A count would let one city swap for
  // another; this cannot. It is also the record of what was measured — if a
  // city moves off this list, someone has to say what changed upstream.
  it('gates every city that was measured publishing its neighbours', () => {
    expect(GATED_CITIES).toEqual([...ALREADY_GATED, ...WAS_PUBLISHING_NEIGHBOURS].sort())
    expect(GATED_CITIES.length).toBe(12)
  })

  it('every city is either gated or carries a stated reason it is not', () => {
    const ungated = Object.entries(JURISDICTIONS).filter(([, j]) => j.kind === 'none')
    // Non-empty on purpose: if this ever reaches zero the assertion below stops
    // asserting anything, and the file would pass by having nothing to check.
    expect(ungated.length).toBe(11)
    for (const [city, j] of ungated) {
      if (j.kind !== 'none') throw new Error('unreachable')
      // A reason must name what it looked at and what refuses instead — the
      // difference between "no layer exists" and "nobody looked" (rule 23).
      expect([city, j.reason.length > 80]).toEqual([city, true])
      expect([city, /Probed|probed|falls? OUTSIDE|enumerat/.test(j.reason)]).toEqual([city, true])
    }
  })

  // No city may be given a boundary by inference. A bbox is a rectangle and a
  // city is not — that substitution is the cause of the sibling defect in this
  // same round — so a 'none' entry must not be quietly backed by one.
  it('no ungated city is handed an approximated boundary', () => {
    for (const city of Object.keys(JURISDICTIONS)) {
      if (JURISDICTIONS[city].kind === 'none') expect([city, cityLimitsGate(city)]).toEqual([city, null])
    }
  })
})

describe('every gate is well-formed', () => {
  const gates = GATED_CITIES.map((city) => [city, cityLimitsGate(city)!] as const)

  it.each(gates)('%s: reads a named field list, never a wildcard sweep', (city, gate) => {
    expect([city, gate.fields.length > 0]).toEqual([city, true])
    expect([city, gate.fields.includes('*')]).toEqual([city, false])
  })

  it.each(gates)('%s: its refusal says where the point IS and what we have instead', (city, gate) => {
    // The copy a user reads has to say WHY, or "That address is outside
    // coverage." is all `ParcelPanelContent` can render and the refusal teaches
    // nothing. Two things every one of them states: the larger place the point
    // falls in, and that this tool carries only the one city's zoning.
    expect([city, gate.message.length > 90]).toEqual([city, true])
    expect([city, /zoning/.test(gate.message)]).toEqual([city, true])
  })

  /** Refusals that name the containing COUNTY but not the neighbouring
   *  municipalities. Pinned by membership rather than tolerated silently: this
   *  is the weakest copy in the table, and it is left alone only because it is
   *  live wording nobody measured a problem with — not because it is as good as
   *  the rest. Adding a city here should require an argument. */
  const NAMES_NO_NEIGHBOURS = ['columbus']

  it('pins which refusals stop at the county name', () => {
    const stops = GATED_CITIES.filter((c) => !/—/.test(cityLimitsGate(c)!.message))
    expect(stops).toEqual(NAMES_NO_NEIGHBOURS)
  })

  it.each(gates.filter(([c]) => !NAMES_NO_NEIGHBOURS.includes(c)))(
    '%s: names the neighbouring jurisdictions it is refusing on behalf of',
    (city, gate) => {
      const afterDash = gate.message.split('—')[1] ?? ''
      expect([city, afterDash.length > 40]).toEqual([city, true])
    },
  )

  it.each(gates)('%s: records how the layer was established', (city, gate) => {
    expect([city, gate.verified.length > 80]).toEqual([city, true])
  })

  // The fixture-drift guard. `__fixtures__/upstreamProbe.ts` feeds `insideSample`
  // to every mocked gate query; if it stopped satisfying `covers`, every gated
  // provider would answer OUT_OF_BBOX on every mocked request and the failure
  // would look like the providers rather than like this table.
  it.each(gates)('%s: its inside-sample really satisfies its own predicate', (city, gate) => {
    if (!gate.covers) {
      // A presence gate compares nothing, so a sample would be a value nobody
      // reads — and a value nobody reads is a value that can quietly go stale.
      expect([city, gate.insideSample]).toEqual([city, undefined])
      return
    }
    expect([city, gate.insideSample != null]).toEqual([city, true])
    expect([city, gate.covers(gate.insideSample!)]).toEqual([city, true])
    // and it must be reachable through the fields the gate actually asks for
    for (const k of Object.keys(gate.insideSample!)) {
      expect([city, k, gate.fields.includes(k)]).toEqual([city, k, true])
    }
  })
})

describe('outsideCity — the reader', () => {
  const presence = GATED_CITIES.map((c) => [c, cityLimitsGate(c)!] as const).filter(([, g]) => !g.covers)
  const compare = GATED_CITIES.map((c) => [c, cityLimitsGate(c)!] as const).filter(([, g]) => g.covers)

  it('pins how many gates decide by presence and how many by value', () => {
    // Both arms below are it.each'd; a table that lost one arm entirely would
    // otherwise leave those tests iterating an empty list and passing.
    expect(presence.map(([c]) => c)).toEqual(['chicago', 'columbus', 'dallas', 'la', 'miami', 'phoenix', 'sandiego'])
    expect(compare.map(([c]) => c)).toEqual(['austin', 'charlotte', 'lasvegas', 'nashville', 'raleigh'])
  })

  it.each(presence)('%s: a feature at the point opens the gate, zero features closes it', (city) => {
    expect(outsideCity(city, settled([{ attributes: {} }]), 0)).toBeNull()
    const refusal = outsideCity(city, settled([]), 0)
    expect(refusal?.code).toBe('OUT_OF_BBOX')
    expect(refusal?.status).toBe(400)
    expect(refusal?.message).toBe(cityLimitsGate(city)!.message)
  })

  it.each(compare)('%s: a non-matching row closes the gate', (city, gate) => {
    const foreign = Object.fromEntries(gate.fields.map((f) => [f, 'SOME OTHER JURISDICTION']))
    const refusal = outsideCity(city, settled([{ attributes: foreign }]), 0)
    if (gate.emptyMeans === 'inside') {
      // An exclusion layer: a row that does NOT match `covers` is the excluded
      // place itself, so build the row from the sample's opposite instead.
      expect(refusal).toBeNull()
      return
    }
    expect(refusal?.code).toBe('OUT_OF_BBOX')
    expect(outsideCity(city, settled([{ attributes: gate.insideSample! }]), 0)).toBeNull()
  })

  // The one exclusion-polarity gate, asserted in both directions, because its
  // empty case is the one that would publish a FALSE geographic claim: a Metro
  // Nashville point with no zoning polygon (a river, a right-of-way) must not be
  // told it is in a satellite city.
  it('nashville refuses only on the satellite-city LABEL, never on an empty answer', () => {
    const gate = cityLimitsGate('nashville')!
    expect(gate.emptyMeans).toBe('inside')
    expect(outsideCity('nashville', settled([]), 0)).toBeNull()
    expect(outsideCity('nashville', settled([{ attributes: { ZONE_DESC: 'RS5' } }]), 0)).toBeNull()
    const refusal = outsideCity('nashville', settled([{ attributes: { ZONE_DESC: 'Satellite City' } }]), 0)
    expect(refusal?.code).toBe('OUT_OF_BBOX')
    expect(refusal?.message).toContain('satellite cities')
  })

  // Rule 3: a failed fetch is a GAP and must not close the gate. It must not
  // open one silently either — the log line is the only trace that the tool
  // served a point it could not place.
  it.each(GATED_CITIES)('%s: a REJECTED gate fetch degrades OPEN and says so in the log', (city) => {
    const lines: unknown[] = []
    const spy = console.log
    console.log = (v: unknown) => void lines.push(v)
    try {
      expect(outsideCity(city, { status: 'rejected', reason: new Error('probe') }, 0)).toBeNull()
    } finally {
      console.log = spy
    }
    expect(lines).toEqual([{ event: 'parcel.jurisdiction_unread', city, durationMs: expect.any(Number) }])
  })

  it.each(Object.keys(JURISDICTIONS).filter((c) => JURISDICTIONS[c].kind === 'none'))(
    '%s: an ungated city never refuses on jurisdiction, whatever the reader is handed',
    (city) => {
      expect(outsideCity(city, settled([]), 0)).toBeNull()
      expect(outsideCity(city, { status: 'rejected', reason: new Error('probe') }, 0)).toBeNull()
    },
  )
})

describe('the gate wording that is regression-tested elsewhere', () => {
  // providers/dallas.test.ts asserts this substring against a Highland Park
  // fixture. It is repeated here because the string now lives in a shared table
  // where a well-meaning edit for consistency would not look like a behaviour
  // change (CLAUDE.md rule 17: the claim has to be pinned everywhere it lives).
  it('keeps the Highland Park refusal verbatim', () => {
    expect(cityLimitsGate('dallas')!.message).toBe(
      'That point is inside the Dallas area but outside the City of Dallas — Highland Park and University Park are separate cities. Dallas zoning is the only zoning this tool has here.',
    )
  })

  it('keeps the four pre-existing refusals verbatim', () => {
    const say = (c: string) => (cityLimitsGate(c) as CityLimitsGate).message
    expect(say('columbus')).toBe(
      'That point is in Franklin County but outside the City of Columbus, whose zoning is the only zoning this tool has for the area.',
    )
    expect(say('lasvegas')).toBe(
      'That point is in the Las Vegas valley but outside the City of Las Vegas — North Las Vegas, Henderson and unincorporated Clark County (including the Strip) write their own zoning, and City of Las Vegas zoning is the only zoning this tool has here.',
    )
    expect(say('phoenix')).toBe(
      'That point is in Maricopa County but outside the City of Phoenix — Scottsdale, Tempe, Mesa and Glendale write their own zoning, and Phoenix zoning is the only zoning this tool has here.',
    )
  })
})
