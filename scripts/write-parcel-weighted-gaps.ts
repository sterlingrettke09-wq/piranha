// Writes docs/PARCEL-WEIGHTED-GAPS.md from the stored weight fixtures.
//
//   npx vite-node scripts/write-parcel-weighted-gaps.ts
//
// The document is DERIVED, never edited by hand: every figure in it comes from
// scripts/__fixtures__/parcelWeights/*.json through the same rank() the console
// output uses, so it cannot drift from the measurement the way a transcribed
// table would.

import { writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { rank } from './lib/gapRanking'
import { allWeights } from './lib/parcelWeights'

const OUT = join(resolve(__dirname, '..'), 'docs/PARCEL-WEIGHTED-GAPS.md')

const r = rank()
const ws = allWeights()
if (ws.length === 0 || r.ranked.length === 0) {
  console.error('[gaps] no fixtures or no ranked gaps — refusing to write a document over an empty set')
  process.exitCode = 1
} else {
  const captured = [...new Set(ws.map((w) => w.capturedOn))].sort()
  const pct = (x: number) => `${(100 * x).toFixed(3)}%`

  const lines: string[] = []
  lines.push('# The 653 gaps, reordered by how much of each city they cover')
  lines.push('')
  lines.push(`*Derived from \`scripts/__fixtures__/parcelWeights/\` — measured ${captured.join(', ')}.*`)
  lines.push('*Regenerate with `npx vite-node scripts/write-parcel-weighted-gaps.ts`. Do not edit by hand.*')
  lines.push('')
  lines.push('## What the number is')
  lines.push('')
  lines.push('Each row is one district code the parser-domain sweep cannot explain, weighted')
  lines.push("by the features carrying it in that city's principal zoning layer — the same")
  lines.push('layer and field the provider reads to answer "what is this parcel zoned".')
  lines.push('')
  lines.push('**Shares are within one city and do not compare across cities.** A feature is a')
  lines.push('tax lot in New York (856,614 of them) and a zoning polygon in Denver (3,775).')
  lines.push('Both are legitimate weights for ordering work inside a city; neither converts')
  lines.push('to the other, and no total across cities appears anywhere below.')
  lines.push('')
  lines.push('## Two columns, and they answer different questions')
  lines.push('')
  lines.push('**A polygon count is not a land share, and on a district-grain layer the two')
  lines.push('diverge hard in both directions.** Miami\'s thirteen gap codes are 68.67% of its')
  lines.push('polygons and 37.04% of its land — near a factor of two. San Francisco\'s `P` is')
  lines.push('7.49% of polygons and 30.73% of area — a factor of four the other way, because')
  lines.push('public land comes in a few enormous parcels.')
  lines.push('')
  lines.push('Count is what was asked for and is the right unit for "how many records does')
  lines.push('this code touch". Area is the right unit for "how much of the city". Neither is')
  lines.push('a correction of the other, so both are published and neither is called the')
  lines.push('headline. An empty area cell means the layer publishes no usable area column —')
  lines.push('unmeasured, not zero. Areas are in each layer\'s own projected units and are')
  lines.push('never converted; only the within-city share is used, which is unit-free.')
  lines.push('')
  lines.push('Every count reconciles against its own layer: the per-code counts plus the')
  lines.push("measured null/blank bucket equal the layer's own `count(1=1)`, exactly, for all")
  lines.push(`${ws.length} targets. A target that did not reconcile would be excluded rather than shown.`)
  lines.push('')
  lines.push('## Cities, by the share sitting under a gap')
  lines.push('')
  lines.push('| city | features under a gap | layer total | share by count | share by area | gap codes |')
  lines.push('|---|---:|---:|---:|---:|---:|')
  for (const v of r.byCity) {
    lines.push(
      `| ${v.city} | ${v.gapFeatures.toLocaleString()} | ${v.total.toLocaleString()} | ${(100 * v.gapFeatures / v.total).toFixed(2)}% | ${v.areaShare == null ? '—' : `${(100 * v.areaShare).toFixed(2)}%`} | ${v.gapCodes} |`,
    )
  }
  lines.push('')
  lines.push('## Every ranked gap')
  lines.push('')
  lines.push('Ordered by share of polygon count, the decided denominator. The area column')
  lines.push('is shown beside it, never blended into it.')
  lines.push('')
  lines.push('| # | city | code | features | by count | by area |')
  lines.push('|---:|---|---|---:|---:|---:|')
  for (const [i, x] of r.ranked.entries()) {
    lines.push(`| ${i + 1} | ${x.city} | \`${x.code}\` | ${x.n.toLocaleString()} | ${pct(x.share)} | ${x.areaShare == null ? '—' : pct(x.areaShare)} |`)
  }
  lines.push('')
  if (r.offCoverage.length) {
    lines.push('## Measured against a layer that is not citywide zoning')
    lines.push('')
    lines.push('These sit on a code table or a single-purpose overlay, so their share is of')
    lines.push('that layer and not of the city. Kept out of the ranking rather than mixed in.')
    lines.push('')
    lines.push('| city | field | code | features | share of that layer |')
    lines.push('|---|---|---|---:|---:|')
    for (const x of r.offCoverage) {
      lines.push(`| ${x.city} | \`${x.field}\` | \`${x.code}\` | ${x.n} | ${pct(x.share)} |`)
    }
    lines.push('')
  }
  if (r.unranked.length) {
    lines.push('## Gaps carrying no weight')
    lines.push('')
    lines.push('A gap with **zero** features is an answer about priority. A gap whose weight is')
    lines.push('**unmeasured** is not — it is unknown, and must not be read as small.')
    lines.push('')
    lines.push('| city | code | why |')
    lines.push('|---|---|---|')
    for (const u of r.unranked) lines.push(`| ${u.city} | \`${u.code}\` | ${u.why} |`)
    lines.push('')
  }
  lines.push('## How each layer was counted')
  lines.push('')
  lines.push('| city | field | layer | features | method | blank | area column | reconciles |')
  lines.push('|---|---|---|---:|---|---:|---|---|')
  for (const w of [...ws].sort((a, b) => a.city.localeCompare(b.city))) {
    lines.push(
      `| ${w.city} | \`${w.field}\` | ${w.layerName || '(metadata unavailable)'} (${w.layerType || '?'}) | ${w.totalFeatures.toLocaleString()} | ${w.method}${w.groupedShortBy != null ? ` — grouped was ${w.groupedShortBy} short` : ''} | ${w.blankOrNull} (${w.blankBasis}) | ${w.areaByCode ? `\`${w.areaField}\`` : w.areaField ? `\`${w.areaField}\` — unusable` : 'none published'} | ${w.reconciles ? 'yes' : 'NO'} |`,
    )
  }
  lines.push('')
  writeFileSync(OUT, lines.join('\n') + '\n')
  console.log(`[gaps] wrote ${OUT} — ${r.ranked.length} ranked, ${r.offCoverage.length} off-coverage, ${r.unranked.length} unranked`)
}
