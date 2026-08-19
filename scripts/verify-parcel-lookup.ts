// Can the checker actually re-find a parcel by id, in each city?
//
//   npx vite-node scripts/verify-parcel-lookup.ts
//
// ⚠️ THIS IS THE ONLY THING THAT CAN CATCH A WRONG idField. The pairs in
// `parcelLookup.ts` are imported from the providers rather than transcribed, so
// nothing internal can disagree with them — the provider says `PIN_NUM` and the
// registry says `PIN_NUM` because it IS the provider's constant. That agreement
// is worth nothing on its own: if the provider reads a column the layer does not
// have, or reads one that is not unique, both sides are wrong together. Every
// defect this repo has found came from comparing to something OUTSIDE it.
//
// So, per city, three questions the live service answers and we do not:
//
//   1. does the layer publish that field at all?
//   2. take a REAL id off the layer — does `WHERE field = <that id>` find it?
//   3. does it find exactly ONE row?
//
// (3) is the one that matters most and the one nobody would think to ask. A
// watchlist keyed on a non-unique id silently watches whichever row the service
// returns first, and would report a "change" every time that ordering moved.

import { PARCEL_SOURCES } from '../netlify/functions/lib/parcelLookup'
import { CITIES } from '../src/config/cities'

/** Values that look like an id and are not one, as a SQL fragment. Enumerated
 *  from what the layers actually publish — LA's `' --'`, Miami's all-zero folio,
 *  Dallas's condominium placeholder — never pattern-matched, because a regex
 *  broad enough to catch them would eventually catch a real id. */
const PLACEHOLDER_WHERE = (f: string) =>
  ` OR ${f} = ' --' OR ${f} = '0000000000000' OR ${f} = 'MULTIPLE' OR ${f} = '-'`

interface Row {
  city: string
  /** False only when lookup by id is IMPOSSIBLE — a value that does not match
   *  itself, a missing field, an unreachable layer. Non-uniqueness is reported
   *  as a rate below and is not a pass/fail: it is handled at runtime. */
  ok: boolean
  /** Sampled ids that matched exactly one row. */
  unique: number
  sampled: number
  /** Rows carrying a value that looks like an id and is not one. -1 when the
   *  count could not be taken — never 0, which would read as "none". */
  placeholders: number
  /** The service would not answer enough of the sample to say anything. NOT a
   *  finding about the city, and not a pass either. */
  unmeasured?: boolean
  detail: string
}

async function json(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = (await res.json()) as Record<string, unknown> & { error?: { code: number; message: string } }
  if (j.error) throw new Error(`service ${j.error.code}: ${j.error.message}`)
  return j
}

async function check(city: string): Promise<Row> {
  const src = PARCEL_SOURCES[city]
  const idField = src.idField
  let layer: string
  try {
    layer = 'layer' in src ? src.layer : ((await src.resolveLayer()).layerUrl ?? '')
    if (!layer) return { city, ok: false, unique: 0, sampled: 0, placeholders: 0, detail: 'layer could not be resolved' }
  } catch (e) {
    return { city, ok: false, unique: 0, sampled: 0, placeholders: 0, detail: `layer resolution threw: ${String((e as Error).message).slice(0, 60)}` }
  }

  // 1. Does the field exist? Case-insensitively, because ArcGIS is.
  let oid = 'OBJECTID'
  try {
    const meta = await json(`${layer}?f=json`)
    if (typeof meta.objectIdField === 'string' && meta.objectIdField) oid = meta.objectIdField
    const names = ((meta.fields ?? []) as Array<{ name: string }>).map((f) => String(f.name))
    if (names.length === 0) return { city, ok: false, unique: 0, sampled: 0, placeholders: 0, detail: 'layer published no field list' }
    if (!names.some((n) => n.toLowerCase() === idField.toLowerCase())) {
      const near = names.filter((n) => n.toLowerCase().includes(idField.toLowerCase().slice(0, 3)))
      return { city, ok: false, unique: 0, sampled: 0, placeholders: 0, detail: `field ${idField} not on layer${near.length ? ` — has ${near.slice(0, 4).join(', ')}` : ''}` }
    }
  } catch (e) {
    return { city, ok: false, unique: 0, sampled: 0, placeholders: 0, detail: `metadata: ${String((e as Error).message).slice(0, 60)}` }
  }

  // 2 + 3. Take real ids from ACROSS the layer and look each one up.
  //
  // ⚠️ SAMPLE THE LAYER, NOT ITS FIRST PAGE — and this instrument got that wrong
  // in a way that produced a false finding and shipped it. Taking the first N
  // rows drew the same rows every run, and the top of a layer is exactly where
  // degenerate records collect: LA's first fourteen carry `APN = ' --'` with a
  // blank AIN, so the check reported that city as having NO unique ids among
  // those sampled. Spread across its 2,432,668 rows, LA's APN is unique on every
  // sample, and only 19 rows in the whole layer carry a placeholder.
  //
  // Miami read the same way for the same reason. Both were the sampler; neither
  // was the city (rule 25 — when a measurement implies a lot of work, the first
  // hypothesis is that the measurement is wrong, and this is the third time in
  // this repo that hypothesis has been right).
  //
  // Placeholders are still a REAL finding and are counted separately, because a
  // watch keyed on one can never resolve. They are simply not evidence about the
  // FIELD, which is what this check is for.
  // ⚠️ SAMPLE BY OBJECTID RANGE, NOT BY resultOffset. The offset version was
  // correct in principle and unusable in practice: an offset of 1.2 million with
  // an `orderByFields` makes the server sort the whole table, which timed out on
  // Milwaukee and returned nothing at all on Atlanta, DC, LA, NYC and
  // Philadelphia — five cities reported as having no id values when they have
  // millions. The OID is indexed, so a range scan is cheap everywhere.
  try {
    const total = Number(
      (await json(`${layer}/query?where=${encodeURIComponent('1=1')}&returnCountOnly=true&f=json`)).count ?? 0,
    )
    if (total === 0) return { city, ok: false, unique: 0, sampled: 0, placeholders: 0, detail: 'layer is empty' }

    const bad = `${idField} IS NULL OR ${idField} = ''${PLACEHOLDER_WHERE(idField)}`
    let placeholders = -1
    try {
      placeholders = Number((await json(`${layer}/query?where=${encodeURIComponent(bad)}&returnCountOnly=true&f=json`)).count ?? -1)
    } catch { placeholders = -1 }

    const stat = await json(
      `${layer}/query?where=${encodeURIComponent('1=1')}&outStatistics=${encodeURIComponent(
        JSON.stringify([
          { statisticType: 'min', onStatisticField: oid, outStatisticFieldName: 'lo' },
          { statisticType: 'max', onStatisticField: oid, outStatisticFieldName: 'hi' },
        ]),
      )}&f=json`,
    )
    const sa = ((stat.features ?? []) as Array<{ attributes?: Record<string, unknown> }>)[0]?.attributes ?? {}
    const pick = (k: string) => {
      const key = Object.keys(sa).find((x) => x.toLowerCase() === k)
      return key ? Number(sa[key]) : NaN
    }
    const lo = pick('lo'), hi = pick('hi')
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
      return { city, ok: false, unique: 0, sampled: 0, placeholders, detail: `could not bound ${oid} to sample from` }
    }

    const ids: string[] = []
    let windowErrors = 0
    for (let k = 0; k < 8; k++) {
      const from = Math.floor(lo + ((hi - lo) * k) / 8)
      const q =
        `${layer}/query?where=${encodeURIComponent(`${oid} >= ${from} AND NOT (${bad})`)}` +
        `&outFields=${encodeURIComponent(idField)}&returnGeometry=false&resultRecordCount=1&f=json`
      try {
        const r = await json(q)
        const at = ((r.features ?? []) as Array<{ attributes?: Record<string, unknown> }>)[0]?.attributes ?? {}
        const key = Object.keys(at).find((x) => x.toLowerCase() === idField.toLowerCase())
        const raw = key ? at[key] : null
        if (raw != null && String(raw).trim() !== '') ids.push(String(raw))
      } catch { windowErrors++ }
    }
    // ⚠️ AN EMPTY SAMPLE AFTER FAILED QUERIES IS "UNMEASURED", NOT "NO IDS".
    //
    // This distinction is the whole of rule 5 put inside the instrument, and it
    // was worth a correction: LA started answering HTTP 302 partway through a run
    // — throttling, after this script had queried it hard — and the check reported
    // it as a city whose rows carry no identifier. An isolated re-probe minutes
    // earlier had found APN unique on 8 of 8 samples across 2.4 million rows
    // (rule 10: re-probe before recording a live failure).
    //
    // So a run that could not ask says so. Only a run that ASKED and got nothing
    // is a finding about the city.
    if (ids.length === 0) {
      return windowErrors > 0
        ? { city, ok: true, unmeasured: true, unique: 0, sampled: 0, placeholders,
            detail: `service refused ${windowErrors}/8 sample queries — UNMEASURED, re-run in isolation` }
        : { city, ok: false, unique: 0, sampled: 0, placeholders, detail: 'the layer answered, and no row carried an id value' }
    }

    let unique = 0
    const notFound: string[] = []
    const duplicated: Array<{ id: string; n: number }> = []
    for (const id of [...new Set(ids)]) {
      const where = `${idField} = '${id.replace(/'/g, "''")}'`
      const hit = await json(`${layer}/query?where=${encodeURIComponent(where)}&returnCountOnly=true&f=json`)
      const n = Number(hit.count ?? -1)
      if (n === 0) notFound.push(id)
      else if (n === 1) unique++
      else duplicated.push({ id, n })
    }
    const sampled = new Set(ids).size

    if (notFound.length) {
      return {
        city, ok: false, unique, sampled, placeholders,
        detail: `${notFound.length}/${sampled} sampled ids do not match themselves (e.g. '${notFound[0]}') — lookup by id is impossible here`,
      }
    }

    // ⚠️ UNIQUENESS IS A MEASURED RATE, NOT A VERDICT. Nothing is decided from it
    // here: a lookup returning several rows answers `ambiguous` at runtime and the
    // checker refuses to diff it. An earlier version called a low duplicate count
    // "placeholder-like" and passed the city, which would have hidden Chicago's
    // genuine duplicate behind a reassuring word (rule 15).
    const worst = duplicated.length ? duplicated.sort((a, b) => b.n - a.n)[0] : null
    const ph = placeholders < 0 ? 'placeholders unmeasured' : `${placeholders} placeholder of ${total}`
    return {
      city, ok: true, unique, sampled, placeholders,
      detail:
        worst == null
          ? `${idField} unique for all ${sampled} sampled · ${ph}`
          : `${idField} unique for ${unique}/${sampled} — '${worst.id}' matches ${worst.n} · ${ph}`,
    }
  } catch (e) {
    return { city, ok: false, unique: 0, sampled: 0, placeholders: 0, detail: `query: ${String((e as Error).message).slice(0, 70)}` }
  }
}

async function main() {
  const cities = Object.keys(PARCEL_SOURCES).sort()
  if (cities.length === 0) {
    console.error('[lookup] no parcel sources registered — refusing to report over an empty set')
    process.exitCode = 1
    return
  }
  console.log(`[lookup] Can a watched parcel be re-found by id? ${cities.length} cities.`)
  console.log('[lookup] Field existence, a real round trip, and UNIQUENESS — the third is the')
  console.log('[lookup] one that decides whether a watch is even well-defined.\n')

  const rows: Row[] = []
  for (const c of cities) {
    const r = await check(c)
    rows.push(r)
    const mark = !r.ok ? 'FAIL' : r.unmeasured ? '????' : r.unique === r.sampled ? 'OK  ' : 'DUPS'
    console.log(`${mark} ${c.padEnd(13)} ${r.detail}`)
  }

  const live = CITIES.filter((x) => x.live).map((x) => x.slug)
  const missing = live.filter((c) => !(c in PARCEL_SOURCES)).sort()
  const bad = rows.filter((r) => !r.ok)
  const unmeasured = rows.filter((r) => r.unmeasured)
  const dups = rows.filter((r) => r.ok && !r.unmeasured && r.unique < r.sampled)
  console.log(`\n[lookup] ${rows.length - bad.length}/${rows.length} can be looked up by id · ${bad.length} cannot`)
  if (unmeasured.length) {
    console.log(`[lookup] ${unmeasured.length} UNMEASURED — the service would not answer, which says nothing`)
    console.log(`[lookup] about the city: ${unmeasured.map((u) => u.city).join(', ')}. Re-run those in isolation.`)
  }
  if (dups.length) {
    console.log(`[lookup] ⚠️ ${dups.length} carry ids that are NOT unique on the sample:`)
    for (const d of dups) console.log(`           ${d.city.padEnd(13)} unique ${d.unique}/${d.sampled} — ${d.detail}`)
    console.log('[lookup] That is not a build failure and it is not fine either. A lookup that')
    console.log('[lookup] returns more than one row answers `ambiguous`, and the checker refuses')
    console.log('[lookup] to diff an ambiguous parcel — it cannot know which row is the watched one.')
  }
  if (missing.length) {
    console.log(`[lookup] ${missing.length} live city/cities have NO by-id lookup at all: ${missing.join(', ')}`)
    console.log('[lookup] Their rows report `no-lookup` — nobody looked — rather than a failed check.')
  }
  if (bad.length) process.exitCode = 1
}

void main()
