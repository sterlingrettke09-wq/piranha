import type { AnalysisResult } from '../../../types/analysis'
import { formatEstimate } from '../../../lib/format'
import { useCountUp } from '../../../lib/countUp'
import { summarizeUnchecked } from '../../../lib/uncheckedHurdles'

interface Props {
  costs: AnalysisResult['costs']
  costUnavailable?: AnalysisResult['costUnavailable']
  timeline: AnalysisResult['timeline']
  hurdles: AnalysisResult['hurdles']
  /** The parcel's own area. Rendered ABOVE the estimates, always — see the
   *  comment on the lot row below for why it is unconditional. */
  lotSqFt: AnalysisResult['parcel']['lotSqFt']
  /** When the verdict couldn't be determined, the timeline is conditional. */
  indeterminate?: boolean
}

/** Three headline figures, editorial register — the first thing the eye lands on,
 *  under the lot the whole estimate stands on. */
export function KeyMetrics({ costs, timeline, hurdles, lotSqFt, indeterminate, costUnavailable }: Props) {
  // An `unchecked` row is a disclosure, not an approval. `summarizeUnchecked`
  // holds that rule for both surfaces that publish a count — see the module for
  // why it is not two inline filters.
  const { counted, unchecked, excludedMonths } = summarizeUnchecked(hurdles)
  const requiredCount = counted.filter((h) => h.status === 'required').length

  // Count-up animation, fired on mount (the band sits at the fold). Each numeral
  // animates from 0 to its value then holds; the displayed string is formatted
  // through the SAME util used at rest, so the settled figure is identical to
  // the static render. Reduced motion → instant (useCountUp returns the target).
  const hasMonths = timeline.months > 0
  const monthsAreFloor = hasMonths && excludedMonths > 0
  // A null total must not animate to 0 — a count-up landing on "$0" is the most
  // confident-looking wrong figure this component could produce.
  const hasCost = costs.total != null
  const costValue = useCountUp(costs.total ?? 0)
  const monthsValue = useCountUp(hasMonths ? timeline.months : 0)
  const hurdleValue = useCountUp(counted.length)
  const lotValue = useCountUp(lotSqFt ?? 0)

  const hurdleLabel =
    unchecked.length > 0
      ? `At least — ${unchecked.length} ${unchecked.length === 1 ? 'check' : 'checks'} unavailable`
      : counted.length === 0
        ? 'Approvals beyond zoning'
        : requiredCount > 0
          ? `Approvals to clear, ${requiredCount} required`
          : 'Approvals to weigh'

  const metrics = [
    {
      figure: hasCost ? formatEstimate(costValue) : 'N/A',
      // ⚠️ "Construction cost not estimated" said WHAT and never WHY, and it is
      // not a rare state: the live smoke sample puts it at 24% of answered
      // parcels and 45% in Atlanta. A bare "not estimated" beside three
      // populated tiles reads as a failure on this parcel — something we could
      // not work out here — when the truth is a gap in what anyone publishes,
      // identical for every 2–4 unit project in every city.
      //
      // Two causes exist and they must not share a sentence (rule 5, and the
      // reason the CostUnavailable type carries `kind` at all): 'unsourced' is a
      // product nobody prices, 'unpriced' is a quantity nobody publishes.
      label: hasCost
        ? 'Construction cost, excludes land'
        : costUnavailable?.kind === 'unsourced'
          ? 'No published rate for this building type'
          : costUnavailable?.kind === 'unpriced'
            ? 'Not priced — the figure this needs is unpublished'
            : 'Construction cost not estimated',
    },
    {
      figure: hasMonths ? `${Math.round(monthsValue)}` : 'N/A',
      suffix: hasMonths ? (timeline.months === 1 ? ' mo' : ' mos') : '',
      // The excluded months are named rather than added: the requirement they
      // belong to may well not apply here, and asserting it would invent time.
      // Saying which way the number is wrong is the point — a bare figure lets
      // the reader correct in the wrong direction.
      label: monthsAreFloor
        ? `At least — up to ${excludedMonths} more if the unchecked approvals apply`
        : indeterminate
          ? 'Est. months, if permittable'
          : 'From design to move-in',
      floor: monthsAreFloor,
    },
    {
      figure: String(Math.round(hurdleValue)),
      label: hurdleLabel,
      floor: unchecked.length > 0,
    },
  ]

  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-piranha-charcoal/10 bg-piranha-charcoal/10">
      {/* THE LOT COMES FIRST, ALWAYS — and with NO threshold attached.
          A 2 sq ft Las Vegas sliver published AS_OF_RIGHT and $482,996: real
          geometry, the right field, correct arithmetic, and an answer no reader
          would have asked for had they seen the lot. The fix is disclosure, not
          refusal — a cutoff would have to say where absurdity begins, and
          nothing here can defend a number for that.
          So there is no `lotSqFt < N` anywhere in this file: no tone change, no
          note, no suppression. The lot is simply rendered at the top of the band
          the estimates live in, at the same weight, so it is read BEFORE the cost
          on every parcel rather than only on the ones we thought to flag.
          Full-width rather than a fourth tile so a seven-figure lot area has
          somewhere to go. */}
      <div className="bg-piranha-bone px-6 py-7">
        <p className="font-serif text-5xl leading-none tracking-tight text-piranha-charcoal tabular-nums">
          {lotSqFt != null ? (
            <>
              {Math.round(lotValue).toLocaleString()}
              <span className="text-2xl text-piranha-charcoal/45"> sq ft</span>
            </>
          ) : (
            // Same wording as the report's "The site" section, and it is a GAP
            // (no area reached us), never a claim that the parcel has none.
            <span className="text-3xl">Not on file</span>
          )}
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.14em] text-piranha-charcoal/55">
          Lot size, from the public record
        </p>
      </div>
      <div className="grid gap-px bg-piranha-charcoal/10 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="bg-piranha-bone px-6 py-7">
            <p className="font-serif text-5xl leading-none tracking-tight text-piranha-charcoal tabular-nums">
              {m.figure}
              {/* The "+" sits on the figure itself, because the label under it is
                  the first thing skipped. A floor that only reads as a floor in
                  small caps is a floor nobody sees. */}
              {m.floor && <span className="text-piranha-charcoal/45">+</span>}
              {m.suffix && <span className="text-2xl text-piranha-charcoal/45">{m.suffix}</span>}
            </p>
            <p className="mt-3 text-xs uppercase tracking-[0.14em] text-piranha-charcoal/55">
              {m.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
