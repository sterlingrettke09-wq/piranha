import { useEffect, useRef, useState } from 'react'

// Count-up numerals (the "holy shit" polish). A small rAF hook that animates a
// figure from 0 → target with an ease-out curve, then holds. It runs ONCE when
// `enabled` flips true (e.g. the result data loads above the fold). Reduced
// motion → the value is the target immediately, no animation.
//
// The easing/termination logic is factored into a pure `countUpStep` so it can
// be unit-tested under the node vitest env (the hook itself touches `window`
// and rAF, which the test environment doesn't provide).

/** Ease-out cubic: fast start, gentle settle. progress in [0,1] → eased [0,1]. */
export function easeOutCubic(progress: number): number {
  const p = progress < 0 ? 0 : progress > 1 ? 1 : 1 - Math.pow(1 - progress, 3)
  return p
}

export interface CountUpFrame {
  /** The displayed value at this timestamp. */
  value: number
  /** True once the animation has reached (or passed) its end — caller stops. */
  done: boolean
}

/**
 * Pure stepper: given the target, total duration, and how much time has elapsed
 * since the animation started, return the eased value and whether it's finished.
 *
 *   countUpStep(100, 900, 0)    → { value: 0,   done: false }
 *   countUpStep(100, 900, 900)  → { value: 100, done: true }
 *   countUpStep(100, 900, 1000) → { value: 100, done: true }  // clamped past end
 *
 * Always lands EXACTLY on `target` at/after `durationMs` (no rounding drift),
 * which is why the hook can render the formatted target verbatim at rest.
 */
export function countUpStep(target: number, durationMs: number, elapsedMs: number): CountUpFrame {
  if (durationMs <= 0 || elapsedMs >= durationMs) {
    return { value: target, done: true }
  }
  if (elapsedMs <= 0) {
    return { value: 0, done: false }
  }
  const eased = easeOutCubic(elapsedMs / durationMs)
  return { value: target * eased, done: false }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

interface CountUpOptions {
  durationMs?: number
  /** The animation only starts (once) after this flips true. Defaults to true. */
  enabled?: boolean
}

/**
 * Animate from 0 to `target` once `enabled` is true. Returns the live value;
 * format it through the same util used at rest so the displayed figure is
 * unchanged once settled. Reduced motion → returns `target` immediately.
 */
export function useCountUp(target: number, opts: CountUpOptions = {}): number {
  const { durationMs = 900, enabled = true } = opts
  const reduced = prefersReducedMotion()
  // Start settled when motion is suppressed or the figure isn't a finite number.
  const settled = reduced || !Number.isFinite(target)
  const [value, setValue] = useState(settled ? target : 0)
  // Guard so the count-up fires exactly once across re-renders.
  const ranRef = useRef(false)

  useEffect(() => {
    if (!enabled || settled || ranRef.current) return
    ranRef.current = true
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const { value: v, done } = countUpStep(target, durationMs, now - start)
      setValue(v)
      if (!done) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled, settled, target, durationMs])

  return value
}
