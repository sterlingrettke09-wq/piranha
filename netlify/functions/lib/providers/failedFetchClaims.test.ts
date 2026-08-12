// THE INVARIANT: where a consumer publishes an overlay's ABSENCE as a finding,
// the provider must be able to say the read FAILED.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT WENT WRONG
//
// `upstreamSplit.test.ts` closed the required reads: a failed ZONING fetch
// refuses instead of publishing "we don't cover this parcel". The OPTIONAL
// reads kept the old idiom — `status === 'fulfilled' ? … : null` — which is
// harmless for a field whose absence renders as nothing, and is the same defect
// one field over for a field whose absence renders as a CLAIM. Two did:
//
//   S2  Denver EHA market area → `estimates.ts` charged the Typical commercial
//       rate whenever the area was missing. Measured 2026-08-12 at the analyze
//       handler, 100,000 sf on a D-C parcel at Union Station whose live area is
//       "High", only that layer faulted:
//
//           control   impact $921,000  total $45,638,500
//           EHA-FAIL  impact $614,000  total $45,331,500
//
//       $307,000 removed from a published total by a timeout, `applied: true`,
//       and nothing in the response said a lookup had failed.
//
//   S3  Miami HISTORIC → `hurdles.ts` publishes "No tenant relocation or
//       replacement-housing requirement" (a stated ABSENCE, framed as the
//       opposite of the rule in most cities) and a note stating the parcel is
//       not in a designated historic district. Measured the same way on a
//       2-unit rental teardown in Coral Way: the control run and the
//       HISTORIC-faulted run were IDENTICAL. That identity is the defect.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY A TABLE (CLAUDE.md rule 14)
//
// `overlays.unresolved` is populated per CONSUMER, not per provider — marking
// every optional layer in all 23 providers would be noise, and noise that is
// wrong the moment a layer is added. So the pairs that DO matter are written
// down here and exercised at the real entry point (`getParcelInfo`), each with
// its layer faulted and its control run beside it.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY IT CANNOT PASS BY FINDING NOTHING (CLAUDE.md rule 20)
//
//   1. `CASES` is asserted non-empty and pinned by exact membership, so a table
//      that quietly stops covering Denver or Miami goes red rather than green.
//   2. Every perturbation asserts `hits > 0`: the fault substring really routed
//      a request. A renamed upstream URL turns the probe into a no-op that
//      passes by testing nothing — the failure mode that makes an instrument
//      worthless (rule 11).
//   3. Each case asserts BOTH directions. The control run must NOT mark the
//      layer, so "mark everything always" is not a way to pass, and the value
//      the layer feeds must still arrive on the healthy run.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { getParcelInfo } from '../parcel'
import { probe } from './__fixtures__/upstreamProbe'
import type { UnresolvedOverlay } from '../../../../src/types/parcel'

interface Case {
  city: string
  lat: number
  lng: number
  /** The key the provider must set when the read below fails. */
  key: UnresolvedOverlay
  /** URL substrings of EVERY read that feeds the field. Miami's historic field
   *  is fed by two layers, so a null is only an answer when both answered —
   *  each is faulted separately (CLAUDE.md rule 13). */
  layers: readonly string[]
  /** What publishes the absence, in one line — so a reader can tell whether
   *  removing the mark would be safe. */
  consumer: string
}

const CASES: Case[] = [
  {
    city: 'denver',
    lat: 39.7392,
    lng: -104.9903,
    key: 'feeArea',
    layers: ['EHA_WebService'],
    consumer: 'estimates.ts impactFee — commercial rate is High $9.21/sf or Typical $6.14/sf, inside costs.total',
  },
  {
    city: 'seattle',
    lat: 47.608,
    lng: -122.3331,
    key: 'feeArea',
    layers: ['MHA_Fee_Areas_1'],
    consumer: 'estimates.ts impactFee — MHA rate published per area ($10.78–$50.46/sf residential), outside the total',
  },
  {
    city: 'miami',
    lat: 25.7743,
    lng: -80.2098,
    key: 'historic',
    layers: ['HEP/MapServer/4', 'HEP/MapServer/3'],
    consumer: 'hurdles.ts — "No tenant relocation or replacement-housing requirement", a stated absence',
  },
]

const run = (c: Case, opts: Parameters<typeof probe>[2] = {}) =>
  probe(getParcelInfo, { city: c.city, lat: c.lat, lng: c.lng }, opts)

describe('an optional read whose absence is published as a claim', () => {
  afterEach(() => vi.restoreAllMocks())

  it('covers exactly the pairs that publish an absence', () => {
    expect(CASES.length).toBeGreaterThan(0)
    expect(CASES.map((c) => `${c.city}.${c.key}`)).toEqual([
      'denver.feeArea',
      'seattle.feeArea',
      'miami.historic',
    ])
  })

  // ── Control: a healthy run marks nothing ──────────────────────────────────
  // Without this, a provider could pass every case below by marking the layer
  // unconditionally — which would move every parcel in the city to the
  // "unpriced, disclosed" branch and look, from the perturbations alone, fixed.
  it.each(CASES)('$city: a healthy run leaves $key resolved', async (c) => {
    const r = await run(c)
    expect(r.ok).toBe(true)
    expect(r.unresolved).not.toContain(c.key)
  })

  // ── Control: an EMPTY answer is an answer, not a gap ──────────────────────
  // The distinction the whole file exists for. The layer responds, nothing
  // covers the parcel, and that must NOT be marked unresolved — otherwise the
  // fix trades a false claim for a permanent refusal to answer.
  it.each(CASES)('$city: an empty answer from every $key layer is not a gap', async (c) => {
    const r = await run(c, { empty: c.layers })
    expect(r.ok).toBe(true)
    expect(r.hits).toBeGreaterThan(0)
    expect(r.unresolved).not.toContain(c.key)
  })

  // ── The perturbation ──────────────────────────────────────────────────────
  // Sibling layers answer EMPTY while one is faulted. Miami's historic field is
  // fed by two layers and the harness answers every layer with a feature, so
  // faulting one alone leaves the other returning a district name — a resolved
  // field, correctly unmarked. Emptying the siblings is what puts the field in
  // the state the consumer reads negatively.
  it.each(CASES.flatMap((c) => c.layers.map((layer) => ({ ...c, layer }))))(
    '$city: a failed $layer read is recorded as an unresolved $key',
    async (c) => {
      const r = await run(c, { fail: c.layer, empty: c.layers.filter((l) => l !== c.layer) })
      expect(r.ok).toBe(true)
      expect(r.hits).toBeGreaterThan(0)
      expect(r.unresolved).toContain(c.key)
    },
  )

  // The other half of the joint dependency (CLAUDE.md rule 13): when a SIBLING
  // layer answers positively, the field IS resolved and must not be marked —
  // Miami reads a historic district name or an archaeological zone name, and
  // either one settles the question the consumer asks.
  it.each(CASES.filter((c) => c.layers.length > 1))(
    '$city: a sibling layer that answers still resolves $key',
    async (c) => {
      for (const layer of c.layers) {
        const r = await run(c, { fail: layer })
        expect(r.ok).toBe(true)
        expect(r.hits).toBeGreaterThan(0)
        expect(r.historicDistrict).not.toBeNull()
        expect(r.unresolved).not.toContain(c.key)
      }
    },
  )
})
