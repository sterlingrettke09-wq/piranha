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
  lines.push('# The 653 gaps, ranked by how much of each city they cover')
  lines.push('')
  lines.push(`*Derived from \`scripts/__fixtures__/parcelWeights/\` — measured ${captured.join(', ')}.*`)
  lines.push('*Regenerate with `npx vite-node scripts/write-parcel-weighted-gaps.ts`. Do not edit by hand.*')
  lines.push('')
  lines.push('## What the number is')
  lines.push('')
  lines.push('Each row is one district code the parser-domain sweep cannot explain, weighted')
  lines.push("against that city's principal zoning layer — the same layer and field the")
  lines.push('provider reads to answer "what is this parcel zoned".')
  lines.push('')
  lines.push('**The order is LAND AREA.** Polygon count is published beside it and never breaks')
  lines.push('a tie, so the two cannot quietly swap roles.')
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
  lines.push('polygons and 37.04% of its land — near a factor of two down. San Francisco\'s 33')
  lines.push('are 12.82% of polygons and 41.91% of area — over three times the other way,')
  lines.push('because public land arrives in a few enormous parcels. The single largest gap in')
  lines.push('the file, SF\'s `P`, is 30.7% of the city\'s land and 7.5% of its polygons.')
  lines.push('')
  lines.push('Area orders this document. Count answers a different and still useful question —')
  lines.push('"how many records does this code touch" — so it is published in every table and')
  lines.push('never used to sort. Neither corrects the other.')
  lines.push('')
  lines.push('Areas are in each layer\'s own projected units and are **never converted**. Only')
  lines.push('the within-city share is used, which is unit-free; a conversion to acres would')
  lines.push('need a factor per city that nothing here sources.')
  lines.push('')
  lines.push('## ⚠️ Ten of the 23 layers publish no area column, and those gaps are UNRANKED')
  lines.push('')
  lines.push('Not last, and not zero — both of those assert something. Nine cities are')
  lines.push('affected (Philadelphia contributes two targets), and **two of them have gaps:')
  lines.push('LA with 440 and Phoenix with 8**, together 448 of the 653. So the ranked list')
  lines.push('below covers 204 gaps, and the largest single contributor to the sweep total is')
  lines.push('not in it.')
  lines.push('')
  lines.push('This is an established absence rather than a missing lookup: seven area-column')
  lines.push('spellings were queried against each service — `SHAPE.STArea()`, `Shape.STArea()`,')
  lines.push('`SHAPE.AREA`, `ST_Area(SHAPE)`, `Shape__Area`, `SHAPE_Area`, `Shape.area` — and')
  lines.push('all seven were rejected. LA, Phoenix and Seattle publish geometry with no')
  lines.push('summable area statistic.')
  lines.push('')
  lines.push('Every count reconciles against its own layer: the per-code counts plus the')
  lines.push("measured null/blank bucket equal the layer's own `count(1=1)`, exactly, for all")
  lines.push(`${ws.length} targets. A target that did not reconcile would be excluded rather than shown.`)
  lines.push('')
  lines.push('## Cities, by the share sitting under a gap')
  lines.push('')
  lines.push('| city | share by area | share by count | gap codes | features under a gap | layer total |')
  lines.push('|---|---:|---:|---:|---:|---:|')
  for (const v of r.byCity) {
    lines.push(
      `| ${v.city} | ${v.areaShare == null ? '**unranked**' : `**${(100 * v.areaShare).toFixed(2)}%**`} | ${(100 * v.gapFeatures / v.total).toFixed(2)}% | ${v.gapCodes} | ${v.gapFeatures.toLocaleString()} | ${v.total.toLocaleString()} |`,
    )
  }
  lines.push('')
  lines.push('## Every ranked gap')
  lines.push('')
  lines.push(`Ordered by land area. ${r.ranked.length} of the 653 — the rest are unranked below.`)
  lines.push('')
  lines.push('| # | city | code | features | by area | by count |')
  lines.push('|---:|---|---|---:|---:|---:|')
  for (const [i, x] of r.ranked.entries()) {
    lines.push(`| ${i + 1} | ${x.city} | \`${x.code}\` | ${x.n.toLocaleString()} | **${pct(x.areaShare!)}** | ${pct(x.share)} |`)
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
    lines.push('## Unranked')
    lines.push('')
    lines.push('These have no land share, so they are not placed in the order above. **Unranked')
    lines.push('is not last and it is not zero.** The count column is still shown, and is still')
    lines.push('the only thing measured about them.')
    lines.push('')
    lines.push('| city | code | features | by count | why |')
    lines.push('|---|---|---:|---:|---|')
    for (const u of r.unranked) {
      lines.push(`| ${u.city} | \`${u.code}\` | ${u.n == null ? '—' : u.n.toLocaleString()} | ${u.share == null ? '—' : pct(u.share)} | ${u.why} |`)
    }
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
