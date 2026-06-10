// ---- Estimate formatting (WO-4.4) ----
// The cost model is an order-of-magnitude estimate, so rendering numbers to the
// dollar ("$4,182,400") implies a precision we don't have. formatEstimate
// collapses any figure to three significant figures with a magnitude suffix,
// e.g. $4.18M / $425k / $62.5k / $1.25B. Used everywhere costs render.

const SIG = 3

/** Round a positive number to `sig` significant figures. */
function toSignificant(n: number, sig: number): number {
  if (n === 0) return 0
  const digits = Math.ceil(Math.log10(n))
  const factor = Math.pow(10, sig - digits)
  return Math.round(n * factor) / factor
}

/** Render `value` with just enough decimals to show `sig` significant figures,
 *  then drop trailing zeros (425.0 → "425", 4.18 → "4.18", 1.00 → "1"). */
function trimToSignificant(value: number, sig: number): string {
  const intDigits = value >= 1 ? Math.floor(Math.log10(value)) + 1 : 1
  const decimals = Math.max(0, sig - intDigits)
  return value
    .toFixed(decimals)
    .replace(/\.?0+$/, '') // drop trailing zeros (and a bare trailing dot)
}

/**
 * Format a dollar estimate to 3 significant figures with a magnitude suffix.
 *
 *   formatEstimate(4_182_400)     === '$4.18M'
 *   formatEstimate(425.4)         === '$425'
 *   formatEstimate(62_500)        === '$62.5k'
 *   formatEstimate(1_250_000_000) === '$1.25B'
 *   formatEstimate(999)           === '$999'
 *   formatEstimate(1000)          === '$1k'
 *   formatEstimate(0)             === '$0'
 *
 * Convention: the k/M/B boundary is at 1,000 / 1,000,000 / 1,000,000,000, so
 * 1000 → "$1k" (not "$1000"). Trailing zeros are dropped, so the suffix'd value
 * shows up to 3 significant figures ("$1.25M", "$4M", "$62.5k").
 */
export function formatEstimate(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)

  const rounded = toSignificant(abs, SIG)

  let suffix = ''
  let scaled = rounded
  if (rounded >= 1_000_000_000) {
    suffix = 'B'
    scaled = rounded / 1_000_000_000
  } else if (rounded >= 1_000_000) {
    suffix = 'M'
    scaled = rounded / 1_000_000
  } else if (rounded >= 1_000) {
    suffix = 'k'
    scaled = rounded / 1_000
  }

  // Below 1k: whole dollars, no suffix ("$999", "$425", "$0").
  if (suffix === '') {
    return `${sign}$${Math.round(scaled).toLocaleString('en-US')}`
  }
  return `${sign}$${trimToSignificant(scaled, SIG)}${suffix}`
}
