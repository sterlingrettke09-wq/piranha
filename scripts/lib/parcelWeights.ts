// Stored parcel-weight fixtures: the shape, and how to read them. No live
// queries, no top-level effects — importable from a test.

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import type { Target } from './parserDomains'

export const WEIGHTS_DIR = join(resolve(__dirname, '../..'), 'scripts/__fixtures__/parcelWeights')

export interface Weights {
  city: string
  what: string
  layer: string
  field: string
  capturedOn: string
  /** The layer's own name, from its metadata — states what a feature IS. */
  layerName: string
  /** "Feature Layer" or "Table", from the layer's metadata. A TABLE has no
   *  geography, so its rows are code-table entries and its counts are NOT a
   *  parcel weight. Recorded rather than inferred from the row count. */
  layerType: string
  /** "esriGeometryPolygon" etc, or empty on a table. */
  geometryType: string
  /** False when the layer refused its own metadata request. The counts are still
   *  good — every /query succeeded — but the descriptors and the area column are
   *  unavailable rather than absent, and a null areaField must not read as "this
   *  layer publishes no area". */
  metadataAvailable: boolean
  /** count(1=1) on the layer. The denominator. */
  totalFeatures: number
  /** MEASURED count of features whose code field is null or blank. Never
   *  derived by subtraction — a subtraction always balances the books. */
  blankOrNull: number
  /** Which predicate answered. `null-only` did NOT check for empty strings —
   *  a narrower check must not read as the wider one. */
  blankBasis: 'null-or-empty' | 'null-only' | 'unmeasured'
  /** Features whose code is whitespace only: not a value, not a null, and
   *  invisible to both. -1 when the counting method cannot see them. */
  whitespaceOnly: number
  /** How the counts were obtained. `per-value` is the fallback for a service
   *  that refuses grouped statistics. */
  method: 'grouped' | 'per-value'
  /** When the grouped aggregate disagreed with the layer's own count and this
   *  fell back to per-value, how many features the grouped result was missing.
   *  Kept so a silent repair cannot delete the finding that caused it. */
  groupedShortBy: number | null
  /** Trimmed code → feature count. Keyed the way the sweep keys values. */
  counts: Record<string, number>
  /** The layer's own area column, or null when it publishes none. */
  areaField: string | null
  /** Area per trimmed code, in the layer's own projected units. Null when the
   *  layer has no area column, or when the grouped area query could not be
   *  reconciled against the counts — a plausible area share is worse than none.
   *
   *  ⚠️ ONLY WITHIN-CITY SHARES ARE MEANINGFUL. The unit differs per layer and is
   *  never converted; a share is unit-free and a conversion would be invented. */
  areaByCode: Record<string, number> | null
  /** Codes whose direct query returned a definite zero. An answer, not a gap. */
  confirmedZero: string[]
  /** Codes whose weight could not be established. NOT zero — unknown. */
  unmeasured: Array<{ code: string; why: string }>
  /** true when the grouped query reported more than it returned and pagination
   *  did not close the gap. A truncated table must not render as a whole one. */
  truncated: boolean
  reconciles: boolean
  /** sum(counts) + blankOrNull - totalFeatures. Zero when it reconciles. */
  residual: number
}


/** Fixture key. One target, one file — a city can have two targets. */
export const weightKey = (t: Target) => `${t.city}__${t.field}`
export const weightsPath = (k: string) => join(WEIGHTS_DIR, `${k}.json`)

export function readWeights(k: string): Weights | null {
  const p = weightsPath(k)
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Weights) : null
}

export function allWeights(): Weights[] {
  if (!existsSync(WEIGHTS_DIR)) return []
  return readdirSync(WEIGHTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(WEIGHTS_DIR, f), 'utf8')) as Weights)
}

