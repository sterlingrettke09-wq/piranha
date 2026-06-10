import type { FeasibilityCheck, CheckStatus } from '../../../types/analysis'
import { CHECKLIST_LABEL } from '../../../lib/verdictLabels'

// Per-dimension words come from the shared verdictLabels module; only the
// dot/accent styling is local.
const STATUS: Record<CheckStatus, { word: string; dot: string; accent: string }> = {
  AS_OF_RIGHT: { word: CHECKLIST_LABEL.AS_OF_RIGHT, dot: 'bg-emerald-600', accent: 'text-emerald-700' },
  NEEDS_RELIEF: { word: CHECKLIST_LABEL.NEEDS_RELIEF, dot: 'bg-amber-500', accent: 'text-amber-700' },
  PROHIBITED: { word: CHECKLIST_LABEL.PROHIBITED, dot: 'bg-rose-600', accent: 'text-rose-700' },
  INDETERMINATE: { word: CHECKLIST_LABEL.INDETERMINATE, dot: 'bg-piranha-charcoal/30', accent: 'text-piranha-charcoal/55' },
}

const DIMENSION_LABEL: Record<FeasibilityCheck['dimension'], string> = {
  use: 'Use',
  far: 'Floor-area ratio (FAR)',
  height: 'Height',
  housing: 'Existing housing',
}

const DIMENSION_HINT: Partial<Record<FeasibilityCheck['dimension'], string>> = {
  far: 'How much total floor area you can build per square foot of land.',
}

export function FeasibilityChecklist({ checks }: { checks: FeasibilityCheck[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-piranha-charcoal/10 bg-white/60">
      {checks.map((c, i) => {
        const s = STATUS[c.status]
        return (
          <div
            key={c.dimension}
            className={`p-5 ${i > 0 ? 'border-t border-piranha-charcoal/10' : ''}`}
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-semibold text-piranha-charcoal">
                {DIMENSION_LABEL[c.dimension]}
              </span>
              <span className={`inline-flex items-center gap-2 text-sm font-medium ${s.accent}`}>
                <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                {s.word}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-piranha-charcoal/60">
              <span>
                Proposed{' '}
                <span className="font-medium text-piranha-charcoal/80">{c.proposed}</span>
              </span>
              <span>
                Allowed{' '}
                <span className="font-medium text-piranha-charcoal/80">{c.allowed}</span>
              </span>
            </div>
            {DIMENSION_HINT[c.dimension] && (
              <p className="mt-1.5 text-xs italic text-piranha-charcoal/45">
                {DIMENSION_HINT[c.dimension]}
              </p>
            )}
            {c.note && <p className="mt-2 text-sm leading-relaxed text-piranha-charcoal/65">{c.note}</p>}
          </div>
        )
      })}
    </div>
  )
}
