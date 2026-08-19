// PARCEL-WEIGHTED COVERAGE — how much of each city the sweep's gaps actually
// cover, measured rather than assumed.
//
// ── WHY ──────────────────────────────────────────────────────────────────────
//
// The enumeration sweep counts DISTINCT CODES. That is the right unit for
// finding wrong values and the wrong unit for deciding what to fix, because it
// weights a code applied to one feature exactly like a code applied to sixty
// thousand. Atlanta's own module already knew this — it records its uncurated
// families by ACREAGE ("SPI 6,566 ac · HC-20 884 ac · …") — but nothing else
// here did, so the backlog has been ordered alphabetically by accident.
//
// This attaches a weight to every value the sweep classifies, using the sweep's
// OWN entry point: it imports TARGETS and classify() from
// enumerate-parser-domains.ts rather than re-deriving what counts as a gap. Two
// implementations of "unhandled" would drift and both would print plausible
// totals (rule 11).
//
//   npx vite-node scripts/parcel-weight.ts --counts   # live, writes fixtures
//   npx vite-node scripts/parcel-weight.ts            # offline, ranks the gaps
//
// ── THE DENOMINATOR, DECIDED BEFORE MEASURING ────────────────────────────────
//
// All live features in the city's zoning layer — the same layer and field the
// sweep reads, so weight and gap are measured on one population. Chosen in
// advance specifically so it could not be chosen afterwards to make a number
// look better.
//
// ⚠️ A FEATURE IS NOT ALWAYS A PARCEL, and this is the finding the reconciliation
// surfaces rather than hides. NYC's layer is MapPLUTO — 856,614 features, one
// per tax lot, so a feature IS a parcel. Philadelphia's Zoning_BaseDistricts has
// 29,205 features across a city with roughly 580,000 parcels, so a feature is a
// zoning POLYGON covering many parcels. Both are legitimate weights; they are
// not the same weight, and a share computed from one must never be compared to a
// share computed from the other. Each fixture records the layer's own name and
// its feature count so the grain is visible at the point of use, and the ranking
// output is WITHIN a city, never across.
//
// ── RECONCILIATION IS THE POINT, NOT A PRELIMINARY ───────────────────────────
//
// Before any share is published, the sum of the per-code counts is checked
// against the layer's own count(1=1). A disagreement is a finding: it means
// features carry a null or blank code, or the grouped query silently truncated.
// The first probe found it immediately — NYC totals 856,614 and groups to
// 856,601, a residual of 13. That residual is MEASURED (a count of null/blank),
// never inferred by subtraction, because a subtraction can only ever produce the
// number that makes the books balance.
//
// ── ZERO IS NOT THE SAME AS MISSED (rule 5, inside the instrument) ───────────
//
// A grouped query returns only values that have at least one feature. So a code
// the sweep knows about but the count table lacks is ambiguous, and the two
// readings point opposite ways: it is either a retired code that now applies to
// nothing (weight 0 — deprioritise it) or a value the query failed to reach
// (weight UNKNOWN — do not rank it at all). This resolves it rather than
// guessing: each such code gets a direct `where field='CODE'` count. A definite
// 0 from a query that ran is an established absence. A query that errored is a
// gap in the measurement and is reported as one.

import { writeFileSync, mkdirSync } from 'node:fs'
import { TARGETS, type Target } from './lib/parserDomains'
import { WEIGHTS_DIR as FIXTURES, weightsPath, allWeights, weightKey, type Weights } from './lib/parcelWeights'
import { rank } from './lib/gapRanking'

interface ArcgisResponse {
  error?: { code: number; message: string }
  fields?: Array<{ name: string; type?: string }>
  objectIdField?: string
  name?: string
  type?: string
  geometryType?: string
  count?: number
  features?: Array<{ attributes?: Record<string, unknown> }>
  exceededTransferLimit?: boolean
}

/** ⚠️ THREE ATTEMPTS, AND STILL THROWS AFTER THEM. Charlotte 500s on its own
 *  layer-info request while every query against that layer succeeds; Raleigh 500s
 *  on a plain grouped count while the SAME grouped query with an area statistic
 *  added returns fine. Both are reproducible on one probe and gone on the next —
 *  the shape rule 10 was written for. Retrying is not papering over a defect: a
 *  failure that survives three attempts is still a failure and still stops the
 *  target, which is what keeps this from becoming "keep asking until it agrees". */
async function arcgis(url: string, params: Record<string, string>): Promise<ArcgisResponse> {
  let last: Error | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${url}?${new URLSearchParams(params)}`, {
        headers: { accept: 'application/json', 'user-agent': 'piranha-sweep' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = (await res.json()) as ArcgisResponse
      if (j.error) throw new Error(`service ${j.error.code}: ${j.error.message}`)
      return j
    } catch (e) {
      last = e as Error
    }
  }
  throw last ?? new Error('unreachable')
}

/** ⚠️ ArcGIS decides the case of an outStatisticFieldName for itself. Chicago
 *  returns `N` for a field requested as `n`; Philadelphia returns `n`. Reading
 *  the requested spelling threw on Chicago — which was lucky, because the same
 *  mistake against a permissive reader returns undefined and sums to zero. */
function attr(a: Record<string, unknown>, name: string): unknown {
  const k = Object.keys(a).find((x) => x.toLowerCase() === name.toLowerCase())
  return k == null ? undefined : a[k]
}

const esc = (v: string) => v.replace(/'/g, "''")

/** Distinct values AS STORED — no trimming.
 *
 *  ⚠️ THE SWEEP'S distinctValues() TRIMS, AND COUNTING THE TRIMMED FORM ASKS THE
 *  WRONG QUESTION. Chicago stores four codes with a trailing space: 'PD 20 ',
 *  'PD 9 ', 'PD 288 ', 'PD 194 '. `WHERE ZONE_CLASS = 'PD 194'` returns 0 on
 *  that backend, and 0 from a query that RAN is precisely what this tool treats
 *  as an established absence — so the first per-value run recorded four codes as
 *  having no features when each has one. Rule 5's own failure mode, committed by
 *  the instrument built to avoid it: the query was well-formed, it ran, it
 *  answered, and it answered about a value that is not in the layer.
 *
 *  So count the RAW variants and sum them into the trimmed key the sweep uses. */
async function rawDistinctValues(url: string, field: string): Promise<string[]> {
  const j = await arcgis(`${url}/query`, {
    where: '1=1', outFields: field, returnDistinctValues: 'true', returnGeometry: 'false', f: 'json',
  })
  const out = new Set<string>()
  for (const f of j.features ?? []) {
    const v = f.attributes?.[field]
    if (v != null && String(v).trim() !== '') out.add(String(v))
  }
  return [...out]
}

async function groupedCounts(
  url: string,
  field: string,
  oidField: string,
): Promise<{ counts: Record<string, number>; whitespaceOnly: number; truncated: boolean } | null> {
  const counts: Record<string, number> = {}
  let whitespaceOnly = 0
  let offset = 0
  let statCol = oidField
  for (let page = 0; page < 40; page++) {
    const params: Record<string, string> = {
      where: '1=1',
      groupByFieldsForStatistics: field,
      outStatistics: JSON.stringify([
        // ⚠️ COUNT THE ROW, NOT THE COLUMN. Raleigh answers HTTP 500 to
        // `count(ZONING)` grouped by ZONING and returns all 268 groups summing to
        // its exact layer total for `count(OBJECTID)` — the same query, a
        // different statistic column. It is also the more correct one: counting
        // the OID counts rows, while counting the grouped column excludes nulls
        // inside a group. `statCol` falls back to the field for services that
        // reject an OID statistic.
        { statisticType: 'count', onStatisticField: statCol, outStatisticFieldName: 'n' },
      ]),
      returnGeometry: 'false',
      f: 'json',
    }
    if (offset > 0) params.resultOffset = String(offset)
    let j: ArcgisResponse
    try {
      j = await arcgis(`${url}/query`, params)
    } catch {
      if (statCol !== field) { statCol = field; page--; continue }
      // Atlanta's MapServer answers 400 to any groupByFieldsForStatistics on
      // this layer — reproducibly, re-probed in isolation (rule 10), and with an
      // unhelpful "Unable to complete operation". Not a transient and not a
      // reason to drop the city: null here routes it to per-value counting,
      // which is slower and measures the same thing.
      return null
    }
    const feats = j.features ?? []
    for (const f of feats) {
      const raw = attr(f.attributes ?? {}, field)
      const n = Number(attr(f.attributes ?? {}, 'n') ?? 0)
      if (raw == null) continue
      const k = String(raw).trim()
      // ⚠️ A WHITESPACE-ONLY CODE IS NEITHER A VALUE NOR A NULL, and dropping it
      // silently is what made Chicago miss 58 features on the first run. The
      // sweep's own distinctValues() discards these too, so they can never be
      // ranked — but they have to be COUNTED, or the reconciliation blames the
      // shortfall on something else. `ZONE_CLASS IS NULL` and `ZONE_CLASS = ''`
      // both answer 0 there, so the server does not consider them blank either;
      // this is the only place the 58 are visible.
      if (k === '') { whitespaceOnly += n; continue }
      // Trimming can MERGE two raw variants differing only in whitespace. Sum
      // rather than overwrite — the sweep keys on the trimmed form, so the
      // weight has to cover every raw feature that reaches it.
      counts[k] = (counts[k] ?? 0) + n
    }
    if (j.exceededTransferLimit !== true || feats.length === 0) {
      return { counts, whitespaceOnly, truncated: false }
    }
    offset += feats.length
  }
  return { counts, whitespaceOnly, truncated: true }
}

/** A direct count for one value. Returns a number when the query RAN, so a 0
 *  here is an established absence and not a failure wearing a zero. */
async function countOf(url: string, field: string, value: string): Promise<number> {
  const j = await arcgis(`${url}/query`, {
    where: `${field} = '${esc(value)}'`,
    returnCountOnly: 'true',
    f: 'json',
  })
  if (typeof j.count !== 'number') throw new Error('service answered without a count')
  return j.count
}

/** How many features carry no code. MEASURED — the alternative, total minus the
 *  sum, cannot fail to balance and so cannot detect anything.
 *
 *  ⚠️ TWO PREDICATES, BECAUSE THE FIELD IS NOT ALWAYS TEXT. `MaxHeight = ''` is
 *  invalid against Philadelphia's numeric column and the layer answers 400, so
 *  the first run recorded "unmeasured" and a residual of −11 for a value that
 *  `MaxHeight IS NULL` returns exactly. Which predicate answered is recorded, so
 *  a null-only basis cannot be mistaken for a check that also covered empties. */
async function blankCount(
  url: string,
  field: string,
): Promise<{ n: number; basis: 'null-or-empty' | 'null-only' | 'unmeasured' }> {
  for (const [where, basis] of [
    [`${field} IS NULL OR ${field} = ''`, 'null-or-empty'],
    [`${field} IS NULL`, 'null-only'],
  ] as const) {
    try {
      const b = await arcgis(`${url}/query`, { where, returnCountOnly: 'true', f: 'json' })
      if (typeof b.count === 'number') return { n: b.count, basis }
    } catch { /* try the narrower predicate */ }
  }
  return { n: -1, basis: 'unmeasured' }
}

/** One query per distinct value. Slower by ~1,500 round trips on Chicago, and
 *  it agrees with the layer's own count where the grouped aggregate does not. */
async function perValueCounts(
  url: string,
  field: string,
  raws: string[],
): Promise<{ counts: Record<string, number>; unmeasured: Array<{ code: string; why: string }> }> {
  const counts: Record<string, number> = {}
  const unmeasured: Array<{ code: string; why: string }> = []
  for (const raw of raws) {
    const k = raw.trim()
    try {
      counts[k] = (counts[k] ?? 0) + (await countOf(url, field, raw))
    } catch (e) {
      unmeasured.push({ code: k, why: String((e as Error).message).slice(0, 120) })
    }
  }
  return { counts, unmeasured }
}

/** The layer's own area column, whatever it is called. Not guessed at from a
 *  pattern — read off the published field list and matched against the spellings
 *  ArcGIS actually emits. Returns null when the layer publishes none, which is
 *  an answer, not a failure. */
function areaFieldOf(meta: ArcgisResponse): string | null {
  const names = (meta.fields ?? []).map((f) => String(f.name))
  // `Shape__Area`, `SHAPE__Area`, `SHAPE.AREA`, `Shape.STArea()`, `shape_Area`,
  // `SHAPE_Area` — six spellings across 23 layers, and a seventh will turn up.
  // A single-underscore pattern found 11 of them and silently missed NYC's
  // `Shape__Area`, Austin's `SHAPE__Area` and Minneapolis's — which is why this
  // reads the published field list rather than assuming a name.
  return names.find((n) => /^(shape[._]*(st)?area(\(\))?|st_area\(shape\))$/i.test(n)) ?? null
}

/** Area per code, in whatever unit the layer's projection uses.
 *
 *  ⚠️ THE UNIT IS NEVER CONVERTED AND NEVER COMPARED ACROSS CITIES. Only the
 *  within-city SHARE is used, which is unit-free. Converting a projected area to
 *  acres would need each layer's spatial reference and a factor per city — an
 *  invented conversion wearing a citation (rule 4) — and nothing here needs it.
 *
 *  Discarded unless its own count column reproduces the reconciled counts
 *  exactly. Chicago's grouped aggregate undercounts, so its grouped AREA would
 *  undercount the same way, and a plausible area share is worse than none. */
async function areaByCode(
  url: string,
  field: string,
  areaField: string,
  counts: Record<string, number>,
): Promise<Record<string, number> | null> {
  let j: ArcgisResponse
  try {
    j = await arcgis(`${url}/query`, {
      where: '1=1',
      groupByFieldsForStatistics: field,
      outStatistics: JSON.stringify([
        { statisticType: 'sum', onStatisticField: areaField, outStatisticFieldName: 'a' },
        { statisticType: 'count', onStatisticField: field, outStatisticFieldName: 'n' },
      ]),
      returnGeometry: 'false',
      f: 'json',
    })
  } catch {
    return null
  }
  if (j.exceededTransferLimit === true) return null
  const area: Record<string, number> = {}
  const seen: Record<string, number> = {}
  for (const f of j.features ?? []) {
    const raw = attr(f.attributes ?? {}, field)
    if (raw == null) continue
    const k = String(raw).trim()
    if (k === '') continue
    area[k] = (area[k] ?? 0) + Number(attr(f.attributes ?? {}, 'a') ?? 0)
    seen[k] = (seen[k] ?? 0) + Number(attr(f.attributes ?? {}, 'n') ?? 0)
  }
  const keys = new Set([...Object.keys(counts), ...Object.keys(seen)])
  for (const k of keys) if ((counts[k] ?? 0) !== (seen[k] ?? 0)) return null
  return area
}

/** The layer's own description. Retried, and DEGRADED rather than fatal.
 *
 *  ⚠️ Charlotte's MapServer answers `{"error":{"code":500,"message":"json"}}` to
 *  a plain layer-info request while every /query against the same layer succeeds
 *  — intermittently, since earlier runs got it. Metadata supplies the layer's
 *  name, its type and its area column; none of those is the measurement. Killing
 *  a whole city's counts because the label was unavailable would be the transient
 *  masquerading as a finding that rule 10 exists to stop. It is recorded as
 *  unavailable, so the missing area share reads as unmeasured and not as absent. */
async function layerMeta(url: string): Promise<ArcgisResponse | null> {
  try {
    return await arcgis(url, { f: 'json' })
  } catch {
    return null
  }
}

async function measure(t: Target): Promise<Weights> {
  const meta = (await layerMeta(t.url)) ?? {}
  const total = await arcgis(`${t.url}/query`, { where: '1=1', returnCountOnly: 'true', f: 'json' })
  if (typeof total.count !== 'number') throw new Error('layer answered without a count')

  const raws = await rawDistinctValues(t.url, t.field)
  const vals = [...new Set(raws.map((r) => r.trim()))].sort()
  // rule 20: weighting an empty set would report 0% gap coverage for a city and
  // read as excellent news.
  if (vals.length === 0) throw new Error('layer produced no distinct values — refusing to weight an empty set')
  const rawByTrim = new Map<string, string[]>()
  for (const r of raws) rawByTrim.set(r.trim(), [...(rawByTrim.get(r.trim()) ?? []), r])

  const blank = await blankCount(t.url, t.field)
  const sumOf = (c: Record<string, number>) => Object.values(c).reduce((a, b) => a + b, 0)

  let counts: Record<string, number> = {}
  let whitespaceOnly = 0
  let truncated = false
  let method: Weights['method'] = 'grouped'
  let groupedShortBy: number | null = null
  let unmeasured: Array<{ code: string; why: string }> = []

  const oidField = String(meta.objectIdField ?? 'OBJECTID')
  const grouped = await groupedCounts(t.url, t.field, oidField)
  if (grouped) {
    counts = grouped.counts
    whitespaceOnly = grouped.whitespaceOnly
    truncated = grouped.truncated
  }

  // ── THE RECONCILIATION GATES THE METHOD, it does not merely annotate it ────
  //
  // Chicago's grouped aggregate UNDERCOUNTS, and not at a page boundary: RT-4
  // groups to 1,954 where a direct `where ZONE_CLASS = 'RT-4'` returns 1,967,
  // B2-3 to 601 against 614, and ten PD codes the distinct-values query returns
  // are absent from the grouped result entirely while two codes it returns are
  // absent from distinct-values. `exceededTransferLimit` is false, maxRecordCount
  // is 2,000 against 1,520 groups, and five consecutive probes give the identical
  // numbers — so it is neither truncation nor a transient (rule 10). Two
  // server-side aggregations over one layer disagree, in both directions.
  //
  // Falling back is right; falling back SILENTLY would delete the finding, so
  // the shortfall is recorded. Sixty-eight features — 0.45% of Chicago — would
  // otherwise have been quietly missing from every share computed here, and
  // nothing downstream could have seen it.
  const groupedResidual = grouped ? sumOf(counts) + Math.max(blank.n, 0) + Math.max(whitespaceOnly, 0) - total.count : null
  if (grouped == null || groupedResidual !== 0) {
    if (grouped != null) groupedShortBy = -(groupedResidual as number)
    method = 'per-value'
    whitespaceOnly = -1 // unreachable this way; stated, never assumed zero
    const pv = await perValueCounts(t.url, t.field, raws)
    counts = pv.counts
    unmeasured = pv.unmeasured
  }

  const confirmedZero: string[] = []
  for (const v of vals) {
    if (counts[v] != null) {
      // A zero from a query that RAN is an established absence (rule 5). Move it
      // out of the weight table so nothing ranks it, and record it as an answer.
      if (counts[v] === 0) { confirmedZero.push(v); delete counts[v] }
      continue
    }
    if (unmeasured.some((u) => u.code === v)) continue
    try {
      let n = 0
      for (const raw of rawByTrim.get(v) ?? [v]) n += await countOf(t.url, t.field, raw)
      if (n === 0) confirmedZero.push(v)
      else counts[v] = n
    } catch (e) {
      unmeasured.push({ code: v, why: String((e as Error).message).slice(0, 120) })
    }
  }

  const residual = sumOf(counts) + Math.max(blank.n, 0) + Math.max(whitespaceOnly, 0) - total.count

  // ⚠️ A SECOND WEIGHT, BECAUSE THE FIRST ONE MEANS SOMETHING NARROWER THAN IT
  // READS. Polygon count is what was asked for and it is the right unit for "how
  // many records does this code touch". It is NOT "how much of the city", and on
  // a district-grain layer the two diverge hard: Miami's thirteen gap codes are
  // 68.67% of its polygons and 37.04% of its land — near a factor of two.
  // Measured before saying so (rule 1), and stored so the reader can see both
  // rather than being told which to trust.
  const areaField = areaFieldOf(meta)
  const area = areaField && residual === 0 ? await areaByCode(t.url, t.field, areaField, counts) : null

  return {
    city: t.city,
    what: t.what,
    layer: t.url,
    field: t.field,
    capturedOn: new Date().toISOString().slice(0, 10),
    layerName: String(meta.name ?? ''),
    layerType: String(meta.type ?? ''),
    geometryType: String(meta.geometryType ?? ''),
    metadataAvailable: meta.name != null,
    totalFeatures: total.count,
    blankOrNull: blank.n,
    blankBasis: blank.basis,
    whitespaceOnly,
    method,
    groupedShortBy,
    counts,
    confirmedZero,
    unmeasured,
    areaField,
    areaByCode: area,
    truncated,
    reconciles: residual === 0 && blank.n >= 0 && !truncated && unmeasured.length === 0,
    residual,
  }
}

async function runCounts(only?: string) {
  const targets = only ? TARGETS.filter((t) => t.city === only) : TARGETS
  if (targets.length === 0) {
    console.error('[weight] no target matched — refusing to report over an empty set')
    process.exitCode = 1
    return
  }
  mkdirSync(FIXTURES, { recursive: true })
  console.log('[weight] Measuring per-code feature counts against each layer\'s own total.')
  console.log('[weight] A disagreement between the two is the finding, not a nuisance.\n')
  const failures: string[] = []
  for (const t of targets) {
    try {
      const w = await measure(t)
      writeFileSync(weightsPath(weightKey(t)), JSON.stringify(w, null, 2) + '\n')
      const flag = w.reconciles ? 'OK  ' : '⚠️  '
      console.log(
        `${flag}${t.city.padEnd(13)} ${t.field.padEnd(15)} ${String(w.totalFeatures).padStart(7)} features · ` +
          `${String(Object.keys(w.counts).length).padStart(4)} codes · blank ${w.blankOrNull} (${w.blankBasis}) · ${w.method}` +
          `${w.groupedShortBy != null ? ` (grouped was ${w.groupedShortBy} short)` : ''} · residual ${w.residual}` +
          `${w.truncated ? ' · TRUNCATED' : ''}${w.confirmedZero.length ? ` · ${w.confirmedZero.length} confirmed-zero` : ''}` +
          `${w.unmeasured.length ? ` · ${w.unmeasured.length} UNMEASURED` : ''}`,
      )
    } catch (e) {
      failures.push(`${t.city}/${t.field}: ${String((e as Error).message).slice(0, 100)}`)
      console.log(`FAIL ${t.city.padEnd(13)} ${t.field.padEnd(15)} ${String((e as Error).message).slice(0, 90)}`)
    }
  }
  if (failures.length) {
    console.log(`\n[weight] ${failures.length} target(s) failed. Re-probe in ISOLATION before recording (rule 10).`)
    process.exitCode = 1
  }
}

function runRanking() {
  // rule 20: ranking over an empty set prints a clean-looking report.
  if (allWeights().length === 0) {
    console.error('[weight] no fixtures — run with --counts first. Refusing to rank over an empty set.')
    process.exitCode = 1
    return
  }
  const r = rank()
  for (const nr of r.notReconciled) console.log(`  ⚠️ ${nr} — DOES NOT RECONCILE; excluded from every share below`)

  console.log("[weight] Gaps ranked by the share of the city's principal zoning layer they cover.")
  console.log('[weight] Shares are WITHIN a city. A feature is a tax lot in NYC (856,614) and a')
  console.log('[weight] zoning polygon in Philadelphia — the two are not the same unit.\n')

  console.log('  rank  city          code                              features   by count    by area')
  for (const [i, x] of r.ranked.slice(0, 40).entries()) {
    console.log(
      `  ${String(i + 1).padStart(4)}  ${x.city.padEnd(13)} ${x.code.slice(0, 31).padEnd(33)} ${String(x.n).padStart(7)}   ` +
        `${(100 * x.share).toFixed(3)}%`.padStart(8) +
        `   ${x.areaShare == null ? '     —' : `${(100 * x.areaShare).toFixed(3)}%`.padStart(8)}`,
    )
  }
  if (r.ranked.length > 40) console.log(`  … ${r.ranked.length - 40} further ranked gaps — full list in docs/PARCEL-WEIGHTED-GAPS.md`)

  console.log("\n  Share of each city's principal zoning layer sitting under a gap:")
  for (const v of r.byCity) {
    console.log(
      `    ${v.city.padEnd(13)} ${String(v.gapFeatures).padStart(7)} / ${String(v.total).padStart(7)}  ` +
        `${(100 * v.gapFeatures / v.total).toFixed(2)}% by count` +
        `${v.areaShare == null ? '  (no area column)' : `, ${(100 * v.areaShare).toFixed(2)}% by area`}` +
        `   (${v.gapCodes} gap codes)`,
    )
  }
  console.log('\n  ⚠️ The two columns answer different questions and can differ by nearly 2x')
  console.log('  (Miami: 68.67% of polygons, 37.04% of land). Count is what was asked for and')
  console.log('  is the right unit for "how many records"; area is the right one for "how much')
  console.log('  of the city". Neither is a correction of the other. A dash means the layer')
  console.log('  publishes no usable area column — unmeasured, not zero.')

  if (r.offCoverage.length) {
    console.log(`\n  ${r.offCoverage.length} gap(s) measured against a layer that is NOT the city's principal zoning`)
    console.log('  coverage — a code TABLE or a single-purpose overlay. Listed apart rather than')
    console.log('  ranked against the rest, because the denominator is a different population:')
    for (const x of r.offCoverage.slice(0, 15)) {
      console.log(`    ${x.city.padEnd(13)} ${x.field.padEnd(12)} ${x.code.slice(0, 24).padEnd(26)} ${String(x.n).padStart(5)}   ${(100 * x.share).toFixed(1)}% of that layer`)
    }
  }

  if (r.unranked.length) {
    console.log(`\n  ${r.unranked.length} gap(s) carry no weight and are deliberately absent from the ranking:`)
    for (const u of r.unranked.slice(0, 20)) console.log(`    ${u.city.padEnd(13)} ${u.code.padEnd(28)} ${u.why}`)
  }

  console.log(`\n  ${r.totalGaps} gaps · ${r.ranked.length} ranked · ${r.offCoverage.length} off-coverage · ${r.unranked.length} unranked`)
  if (r.missingWeights.length) console.log(`  ⚠️ no stored weights: ${r.missingWeights.join(', ')}`)
  if (r.missingWeights.length || r.notReconciled.length) process.exitCode = 1
}

async function main() {
  const argv = process.argv.slice(2)
  const only = argv.find((a) => a.startsWith('--city='))?.split('=')[1]
  if (argv.includes('--counts')) await runCounts(only)
  else runRanking()
}

void main()
