import { describe, it, expect } from 'vitest'
import { decideDelivery, compose, DELIVERY_NOT_BEFORE, type DeliveryContext } from './watchDelivery'
import type { RunReport, RowResult } from './watchRunner'

const rowResult = (over: Partial<RowResult['outcome']> = {}): RowResult => ({
  city: 'denver',
  parcelId: '0123',
  outcome: {
    resolution: 'resolves',
    events: [],
    alertable: [{ kind: 'field-changed', field: 'districtCode', from: 'R-2', to: 'R-3' }],
    suppressed: null,
    ...over,
  },
})

const report = (o: Partial<RunReport> = {}): RunReport => ({
  lists: 1, rows: 1, checked: 1, compared: 1, suppressed: 0,
  results: [rowResult()], alerts: [rowResult()], errors: [], ...o,
})

const ctx = (o: Partial<DeliveryContext> = {}): DeliveryContext => ({
  now: new Date('2026-09-01T00:00:00.000Z'),
  enabled: true,
  registerSpanDays: 12,
  ...o,
})

describe('the gate', () => {
  it('⚠️ sends nothing before the gate date, however good the run looks', () => {
    // 2026-08-26 is when the register can first carry a twelve-day interval. Until
    // then eighteen of its nineteen diffable verdicts rest on TWO DAYS, which is
    // close to vacuous for a near-static source.
    const d = decideDelivery(report(), ctx({ now: new Date('2026-08-25T23:59:00.000Z') }))
    expect(d.send).toBe(false)
    if (!d.send) expect(d.refusal.reason).toBe('before-gate')
  })

  it('opens on the gate date itself, not the day after', () => {
    const d = decideDelivery(report(), ctx({ now: new Date(`${DELIVERY_NOT_BEFORE}T00:00:00.000Z`) }))
    expect(d.send).toBe(true)
  })

  it('⚠️ and the date alone is NOT enough — waiting does not re-observe anything', () => {
    // The trap this closes: the gate passes on its own, but nobody running
    // `source-stability.ts --observe` means the evidence is exactly as thin on the
    // 27th as on the 19th. The date and the register are separate conditions.
    const d = decideDelivery(report(), ctx({ registerSpanDays: 2 }))
    expect(d.send).toBe(false)
    if (!d.send) {
      expect(d.refusal.reason).toBe('register-too-weak')
      expect(d.refusal.detail).toMatch(/nobody re-observed/)
    }
  })

  it('requires an explicit opt-in, with no default-on path', () => {
    const d = decideDelivery(report(), ctx({ enabled: false }))
    expect(d.send).toBe(false)
    if (!d.send) expect(d.refusal.reason).toBe('not-enabled')
  })

  it('refuses when the run had errors, because its silence then means nothing', () => {
    const d = decideDelivery(report({ errors: ['blobs unreachable'] }), ctx())
    expect(d.send).toBe(false)
    if (!d.send) expect(d.refusal.reason).toBe('run-had-errors')
  })

  it('refuses when nothing was compared, even if alerts somehow exist', () => {
    const d = decideDelivery(report({ compared: 0 }), ctx())
    expect(d.send).toBe(false)
    if (!d.send) expect(d.refusal.reason).toBe('nothing-compared')
  })

  it('names each refusal separately, because the fixes are different', () => {
    // A single boolean would send "wait for the date", "flip the switch",
    // "re-observe the register" and "the run is broken" to the same place.
    const reasons = new Set(
      [
        decideDelivery(report(), ctx({ now: new Date('2026-08-01T00:00:00.000Z') })),
        decideDelivery(report(), ctx({ enabled: false })),
        decideDelivery(report(), ctx({ registerSpanDays: 1 })),
        decideDelivery(report({ errors: ['x'] }), ctx()),
        decideDelivery(report({ compared: 0 }), ctx()),
      ].map((d) => (d.send ? 'sent' : d.refusal.reason)),
    )
    expect(reasons.size).toBe(5)
  })

  it('sends one message per alerting row once every condition holds', () => {
    const d = decideDelivery(report(), ctx())
    expect(d.send).toBe(true)
    if (d.send) expect(d.messages).toHaveLength(1)
  })
})

describe('what a message says', () => {
  it('names the field and both values, not that "something changed"', () => {
    const m = compose(rowResult())
    expect(m.body).toContain('Zoning district: R-2 → R-3')
    expect(m.body).toContain('Parcel 0123, denver.')
  })

  it('gives a parcel leaving the layer its own subject and an explanation', () => {
    const m = compose(rowResult({ alertable: [{ kind: 'left-the-layer' }] }))
    expect(m.subject).toMatch(/no longer in denver’s records/)
    expect(m.body).toMatch(/subdivided or merged/)
  })

  it('⚠️ says a republished parcel map claims NOTHING about the parcel', () => {
    // The one message that must not read as news about the land. Diffing across a
    // rebase would report re-drawn boundaries as rezonings, so the checker refuses
    // to — and the copy has to say the same thing the code does.
    const m = compose(rowResult({ alertable: [{ kind: 'fabric-rebased', from: '2025', to: '2026' }] }))
    expect(m.body).toMatch(/Nothing about the parcel is claimed here/)
  })

  it('renders an unresolved value as a dash, never as zero', () => {
    const m = compose(rowResult({ alertable: [{ kind: 'field-changed', field: 'maxFAR', from: 0.5, to: null }] }))
    expect(m.body).toContain('Maximum FAR: 0.5 → —')
    expect(m.body).not.toContain('→ 0')
  })

  it('carries the same caveat the report does', () => {
    expect(compose(rowResult()).body).toMatch(/Check with the city before relying on it/)
  })
})
