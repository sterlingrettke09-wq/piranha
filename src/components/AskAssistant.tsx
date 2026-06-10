import { useEffect, useId, useRef, useState } from 'react'
import { Button } from './ui/Button'

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'answer'; text: string }
  | { status: 'error'; message: string }

interface AskAssistantProps {
  /** Override the textarea placeholder (e.g. a report-specific seed prompt).
   *  Defaults to the general zoning/permitting prompt. */
  placeholder?: string
}

export function AskAssistant({
  placeholder = "e.g. What's the difference between a variance and a special permit?",
}: AskAssistantProps = {}) {
  const [question, setQuestion] = useState('')
  const [state, setState] = useState<State>({ status: 'idle' })
  const labelId = useId()
  const hintId = useId()

  // Abort an in-flight question on unmount (navigation away mid-answer).
  const ctrlRef = useRef<AbortController | null>(null)
  useEffect(() => () => ctrlRef.current?.abort(), [])

  async function ask() {
    const q = question.trim()
    if (q === '' || state.status === 'loading') return
    setState({ status: 'loading' })
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
        signal: ctrl.signal,
      })
      const body = await res.json()
      if (ctrl.signal.aborted) return
      if (res.ok && typeof body.answer === 'string') {
        setState({ status: 'answer', text: body.answer })
      } else {
        setState({
          status: 'error',
          message: body?.message ?? 'The assistant is unavailable right now.',
        })
      }
    } catch {
      if (ctrl.signal.aborted) return
      setState({ status: 'error', message: 'Network error. Please try again.' })
    }
  }

  return (
    <section className="rounded-xl border border-piranha-charcoal/15 bg-white/60 p-5">
      <h2 className="font-serif text-xl tracking-tight text-piranha-charcoal">
        Ask the assistant
      </h2>
      <p id={labelId} className="mt-1 text-sm text-piranha-charcoal/60">
        A question about zoning, permitting, or what it takes to build? Ask in plain
        English.
      </p>
      <p className="mt-1 text-xs text-piranha-charcoal/40">Powered by AI.</p>

      <div className="mt-4 space-y-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') ask()
          }}
          rows={3}
          maxLength={1000}
          aria-labelledby={labelId}
          aria-describedby={hintId}
          placeholder={placeholder}
          className="w-full resize-y rounded-md border border-piranha-charcoal/20 bg-white px-3 py-2 text-piranha-charcoal focus:border-piranha-burgundy focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <span id={hintId} className="text-xs text-piranha-charcoal/40">
            ⌘/Ctrl + Enter to send
          </span>
          <Button
            size="sm"
            onClick={ask}
            disabled={state.status === 'loading' || question.trim() === ''}
          >
            {state.status === 'loading' ? 'Thinking…' : 'Ask'}
          </Button>
        </div>
      </div>

      {/* Live region: screen readers announce the answer (or error) when it
          arrives, instead of it appearing silently below the fold. */}
      <div aria-live="polite" role="status">
        {state.status === 'loading' && (
          <div className="mt-4 h-16 animate-pulse rounded-md bg-piranha-charcoal/5">
            <span className="sr-only">Thinking…</span>
          </div>
        )}

        {state.status === 'answer' && (
          <div className="mt-4 space-y-2">
            <p className="whitespace-pre-line leading-relaxed text-piranha-charcoal/85">
              {state.text}
            </p>
            <p className="text-xs text-piranha-charcoal/45">
              General information, not legal advice. Verify with the relevant city
              department.
            </p>
          </div>
        )}

        {state.status === 'error' && (
          <p className="mt-4 rounded-md border border-rose-600/30 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {state.message}
          </p>
        )}
      </div>
    </section>
  )
}
