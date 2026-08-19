// DELIVERY — and the gate that decides whether anything may be sent at all.
//
// Everything upstream of this file produces `alertable` events. This is the only
// place that turns one into a message, and it is deliberately the smallest,
// dullest file in the feature: composing an email is easy, and deciding that an
// email is WARRANTED is the part that has been wrong everywhere else.
//
// ── THE GATE IS A DATE, AND IT IS NOT A REMINDER ────────────────────────────
//
// Nothing sends before 2026-08-26. That is not a placeholder or a TODO — it is
// the date the stability register can first be re-observed over a twelve-day
// interval, and until that has happened eighteen of the nineteen "diffable"
// verdicts rest on TWO DAYS. A two-day interval on a near-static source is close
// to vacuous: a zoning roster barely moves in two days whether the feed is sound
// or quietly serving a cached snapshot.
//
// So the gate is enforced in code rather than trusted to whoever runs the
// checker, and it is one condition among several — passing the date alone does
// not open it.

import type { RunReport, RowResult } from './watchRunner'
import type { WatchEvent } from './watchCheck'

/** The earliest date any alert may be delivered. See the header: this is the
 *  first date the register can carry a twelve-day interval, not a guess. */
export const DELIVERY_NOT_BEFORE = '2026-08-26'

export type DeliveryRefusal =
  | { reason: 'before-gate'; detail: string }
  | { reason: 'not-enabled'; detail: string }
  | { reason: 'register-too-weak'; detail: string }
  | { reason: 'nothing-compared'; detail: string }
  | { reason: 'run-had-errors'; detail: string }

export type DeliveryDecision =
  | { send: true; messages: Message[] }
  | { send: false; refusal: DeliveryRefusal }

export interface Message {
  city: string
  parcelId: string
  subject: string
  body: string
}

export interface DeliveryContext {
  now: Date
  /** Explicit opt-in. Absent or false means no. There is no default-on path. */
  enabled: boolean
  /** The longest interval, in days, over which the stability register has
   *  observed the sources being diffed. Supplied by the caller from the register
   *  — this file does not compute it and must not guess it. */
  registerSpanDays: number
  /** The bar the register must clear. Twelve days, because that is the Austin
   *  interval — a measurement, not a round number. */
  requiredSpanDays?: number
}

const DEFAULT_REQUIRED_SPAN = 12

/** ⚠️ EVERY CONDITION, EVERY TIME, AND THE FIRST FAILURE IS REPORTED.
 *
 *  The refusals are separate values rather than one boolean because the fixes
 *  differ completely: "the gate date has not passed" resolves itself, "delivery
 *  is not enabled" is a switch, "the register is too weak" needs someone to
 *  re-observe, and "nothing was compared" means the run said nothing at all. A
 *  single `false` would send all four to the same place. */
export function decideDelivery(report: RunReport, ctx: DeliveryContext): DeliveryDecision {
  const required = ctx.requiredSpanDays ?? DEFAULT_REQUIRED_SPAN
  const today = ctx.now.toISOString().slice(0, 10)

  if (today < DELIVERY_NOT_BEFORE) {
    return {
      send: false,
      refusal: {
        reason: 'before-gate',
        detail: `delivery opens ${DELIVERY_NOT_BEFORE}; today is ${today}. Until the stability register has been re-observed over a real interval, most of its diffable verdicts rest on two days.`,
      },
    }
  }
  if (!ctx.enabled) {
    return { send: false, refusal: { reason: 'not-enabled', detail: 'delivery is not switched on' } }
  }
  // ⚠️ THE DATE IS NECESSARY AND NOT SUFFICIENT. Waiting until 2026-08-26 does
  // not re-observe the register — someone has to run it. If nobody did, the
  // evidence is exactly as thin on the 27th as it was on the 19th, and the date
  // alone would let that through.
  if (ctx.registerSpanDays < required) {
    return {
      send: false,
      refusal: {
        reason: 'register-too-weak',
        detail: `the register spans ${ctx.registerSpanDays} day(s); ${required} are required. The gate date has passed but nobody re-observed — run scripts/source-stability.ts --observe.`,
      },
    }
  }
  if (report.errors.length > 0) {
    return {
      send: false,
      refusal: {
        reason: 'run-had-errors',
        detail: `the run reported ${report.errors.length} error(s), so its silence about other rows means nothing: ${report.errors[0]}`,
      },
    }
  }
  // A run that compared nothing has said nothing, and must not send — including
  // when it has alerts, which at that point came from somewhere other than a
  // comparison and should be impossible.
  if (report.compared === 0) {
    return {
      send: false,
      refusal: { reason: 'nothing-compared', detail: 'no row was compared, so this run establishes nothing to report' },
    }
  }
  return { send: true, messages: report.alerts.map(compose) }
}

const FIELD_LABEL: Record<string, string> = {
  districtCode: 'Zoning district',
  maxHeightFt: 'Maximum height',
  maxFAR: 'Maximum FAR',
  lotSqFt: 'Lot size',
  developable: 'Developability',
}

function describe(e: WatchEvent): string {
  switch (e.kind) {
    case 'field-changed':
      return `${FIELD_LABEL[e.field] ?? e.field}: ${String(e.from ?? '—')} → ${String(e.to ?? '—')}`
    case 'left-the-layer':
      return 'This parcel is no longer in the city’s records. That usually means it was subdivided or merged into another lot.'
    case 'fabric-rebased':
      return `The city republished its parcel map (${e.from ?? '—'} → ${e.to ?? '—'}). Nothing about the parcel is claimed here; the next check compares on the new map.`
    // ⚠️ These two are never alertable and cannot reach here. They are listed so
    // adding a sixth event kind is a compile error rather than a silent default —
    // a default in this function would mail whatever it did not recognise.
    case 'became-unavailable':
      return `${FIELD_LABEL[e.field] ?? e.field} could not be read`
    case 'became-available':
      return `${FIELD_LABEL[e.field] ?? e.field} is now available`
  }
}

export function compose(r: RowResult): Message {
  const lines = r.outcome.alertable.map(describe)
  const left = r.outcome.alertable.some((e) => e.kind === 'left-the-layer')
  return {
    city: r.city,
    parcelId: r.parcelId,
    subject: left
      ? `A parcel you watch is no longer in ${r.city}’s records`
      : `Something changed on a parcel you watch in ${r.city}`,
    body: [
      `Parcel ${r.parcelId}, ${r.city}.`,
      '',
      ...lines,
      '',
      'This is drawn from the city’s own published records. Check with the city before relying on it.',
    ].join('\n'),
  }
}
