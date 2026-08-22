import { useState } from 'react'

// "What would it take?" — the inverse query, on the parcel the reader is already
// looking at.
//
// ⚠️ THE DESIGN PROBLEM HERE IS NOT THE FORM, IT IS THE INCOMPLETE ANSWER.
//
// When a district's FAR cannot be read, the honest answer is "here is what binds
// among the things we could check, and one of the things we could not might be
// harder." That sentence is easy to write and easy to lose: put the
// recommendation in a headline and the caveat in grey underneath, and every
// reader takes the headline. So the unresolved dimensions are rendered INSIDE
// the same block as the recommendation, in the same weight, and the block is not
// styled as a success even when the binding constraint is mild.

// ⚠️ IMPORTED, NOT RESTATED. This was a hand-written copy of the union that
// `inverse.ts` produces, and adding a member to the producer left the consumer
// compiling happily against the old five. Two `Record<ReliefKind, …>` maps here
// only became exhaustiveness checks once they were checking the same union.
import type { ReliefKind } from '../types/parcel'
export type { ReliefKind }

export interface Constraint {
  dimension: 'use' | 'far' | 'height' | 'units'
  required: number | null
  allowed: number | null
  ratio: number | null
  relief: ReliefKind
  note: string
}

export interface InverseResponse {
  constraints: Constraint[]
  binding: Constraint | null
  unresolved: string[]
  derivation: string[]
  empty: boolean
  summary: string
}

const DIM_LABEL: Record<Constraint['dimension'], string> = {
  use: 'Use',
  far: 'Floor area',
  height: 'Height',
  units: 'Units',
}

const RELIEF_LABEL: Record<ReliefKind, string> = {
  none: 'Fits by right',
  'dimensional-variance': 'Variance',
  'beyond-variance': 'Rezoning',
  'no-limit': 'No limit here',
  unknown: 'Not known',
  // Not 'Not known'. The limit is known; the basis is the reader's to pick, and
  // the chip is the only place a skimmer learns there is a decision to make.
  'elective-basis': 'You choose',
}

// `unknown` deliberately does NOT get a calm grey that reads as "fine". It is
// the state most likely to be skimmed past and the one that invalidates the
// answer, so it carries the same weight as a real obstacle.
const RELIEF_CLS: Record<ReliefKind, string> = {
  none: 'bg-emerald-50 text-emerald-900 border-emerald-600/20',
  'dimensional-variance': 'bg-amber-50 text-amber-900 border-amber-600/25',
  'beyond-variance': 'bg-piranha-burgundy/[0.07] text-piranha-burgundy border-piranha-burgundy/25',
  'no-limit': 'bg-emerald-50 text-emerald-900 border-emerald-600/20',
  unknown: 'bg-piranha-charcoal/[0.06] text-piranha-charcoal border-piranha-charcoal/25',
  // Distinct from both: not the emerald that reads "fine" and not the grey that
  // reads "we failed to look". Something is required of the reader here.
  'elective-basis': 'bg-sky-50 text-sky-900 border-sky-600/25',
}

const inputCls =
  'w-full rounded-xl border border-piranha-charcoal/15 bg-white/70 px-4 py-2.5 text-piranha-charcoal placeholder:text-piranha-charcoal/35 focus:border-piranha-burgundy focus:outline-none focus:ring-1 focus:ring-piranha-burgundy'

export function WhatWouldItTake({ city, lat, lng }: { city: string; lat: number; lng: number }) {
  const [use, setUse] = useState('residential')
  const [units, setUnits] = useState('')
  const [stories, setStories] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [res, setRes] = useState<InverseResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function run(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    setErr(null)
    const q = new URLSearchParams({ city, lat: String(lat), lng: String(lng), use })
    if (units.trim()) q.set('units', units.trim())
    if (stories.trim()) q.set('stories', stories.trim())
    try {
      const r = await fetch(`/api/inverse?${q}`)
      const b = (await r.json()) as InverseResponse & { error?: string }
      if (!r.ok) {
        setErr(b.error ?? `The server answered ${r.status}.`)
        setState('error')
        return
      }
      setRes(b)
      setState('done')
    } catch {
      setErr('Could not reach the server.')
      setState('error')
    }
  }

  const shown = res?.constraints.filter((c) => c.relief !== 'none') ?? []

  return (
    <section className="rounded-2xl border border-piranha-charcoal/10 bg-white/60 p-6 sm:p-8">
      <h2 className="font-serif text-2xl tracking-tight text-piranha-charcoal">What would it take?</h2>
      <p className="mt-2 max-w-prose text-sm text-piranha-charcoal/65">
        Name what you want to build here and we will work backward: which limits bind, by how much,
        and what kind of relief each one needs.
      </p>

      <form onSubmit={run} className="mt-6 grid gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor="iq-use" className="block text-xs uppercase tracking-wider text-piranha-charcoal/50">Use</label>
          <select id="iq-use" value={use} onChange={(e) => setUse(e.target.value)} className={`mt-1.5 ${inputCls}`}>
            <option value="residential">Residential</option>
            <option value="mixed">Mixed-use</option>
            <option value="commercial">Commercial</option>
            <option value="institutional">Institutional</option>
          </select>
        </div>
        <div>
          <label htmlFor="iq-units" className="block text-xs uppercase tracking-wider text-piranha-charcoal/50">Units</label>
          <input id="iq-units" inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value)} placeholder="40" className={`mt-1.5 ${inputCls}`} />
        </div>
        <div>
          <label htmlFor="iq-stories" className="block text-xs uppercase tracking-wider text-piranha-charcoal/50">Storeys</label>
          <input id="iq-stories" inputMode="numeric" value={stories} onChange={(e) => setStories(e.target.value)} placeholder="6" className={`mt-1.5 ${inputCls}`} />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={state === 'loading' || (!units.trim() && !stories.trim())}
            className="w-full rounded-xl bg-piranha-burgundy px-5 py-2.5 text-white transition hover:bg-piranha-burgundy/90 disabled:opacity-40"
          >
            {state === 'loading' ? 'Working…' : 'Work it back'}
          </button>
        </div>
      </form>

      {state === 'error' ? <p className="mt-4 text-sm text-piranha-burgundy">{err}</p> : null}

      {state === 'done' && res ? (
        <div className="mt-8">
          {/* The recommendation and what it does NOT cover, in one block and one
              weight. A headline plus a grey caveat is how a partial answer gets
              read as a whole one. */}
          <div
            className={`rounded-xl border p-5 ${
              res.unresolved.length
                ? 'border-piranha-charcoal/25 bg-piranha-charcoal/[0.05]'
                : res.binding
                  ? 'border-amber-600/25 bg-amber-50'
                  : 'border-emerald-600/20 bg-emerald-50'
            }`}
          >
            <p className="text-piranha-charcoal">{res.summary}</p>
          </div>

          {shown.length ? (
            <ul className="mt-5 space-y-3">
              {shown.map((c) => (
                <li key={c.dimension} className="flex flex-wrap items-start gap-3 border-b border-piranha-charcoal/10 pb-3 last:border-0">
                  <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs ${RELIEF_CLS[c.relief]}`}>
                    {RELIEF_LABEL[c.relief]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-piranha-charcoal">
                      {DIM_LABEL[c.dimension]}
                      {c.ratio != null ? (
                        <span className="ml-2 font-normal text-piranha-charcoal/55">{c.ratio.toFixed(2)}× the limit</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-piranha-charcoal/70">{c.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {res.derivation.length ? (
            <div className="mt-6 rounded-xl bg-piranha-charcoal/[0.04] p-4">
              <p className="text-xs uppercase tracking-wider text-piranha-charcoal/45">How we got there</p>
              <ul className="mt-2 space-y-1">
                {res.derivation.map((d) => (
                  <li key={d} className="text-sm text-piranha-charcoal/70">{d}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-5 text-xs text-piranha-charcoal/45">
            Relief thresholds follow variance-practice doctrine, not this city’s ordinance: roughly
            1.5× for height and 1.2× for density. Which board hears it, and what it is called here,
            is a question for the city.
          </p>
        </div>
      ) : null}
    </section>
  )
}
