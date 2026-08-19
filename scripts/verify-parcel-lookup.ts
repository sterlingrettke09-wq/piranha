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

interface Row {
  city: string
  /** False only when lookup by id is IMPOSSIBLE — a value that does not match
   *  itself, a missing field, an unreachable layer. Non-uniqueness is reported
   *  as a rate below and is not a pass/fail: it is handled at runtime. */
  ok: boolean
  /** Sampled ids that matched exactly one row. */
  unique: number
  sampled: number
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
    if (!layer) return { city, ok: false, unique: 0, sampled: 0, detail: 'layer could not be resolved' }
  } catch (e) {
    return { city, ok: false, unique: 0, sampled: 0, detail: `layer resolution threw: ${String((e as Error).message).slice(0, 60)}` }
  }

  // 1. Does the field exist? Case-insensitively, because ArcGIS is.
  try {
    const meta = await json(`${layer}?f=json`)
    const names = ((meta.fields ?? []) as Array<{ name: string }>).map((f) => String(f.name))
    if (names.length === 0) return { city, ok: false, unique: 0, sampled: 0, detail: 'layer published no field list' }
    if (!names.some((n) => n.toLowerCase() === idField.toLowerCase())) {
      const near = names.filter((n) => n.toLowerCase().includes(idField.toLowerCase().slice(0, 3)))
      return { city, ok: false, unique: 0, sampled: 0, detail: `field ${idField} not on layer${near.length ? ` — has ${near.slice(0, 4).join(', ')}` : ''}` }
    }
  } catch (e) {
    return { city, ok: false, unique: 0, sampled: 0, detail: `metadata: ${String((e as Error).message).slice(0, 60)}` }
  }

  // 2 + 3. Take REAL ids off the layer and look each one up.
  //
  // ⚠️ SEVERAL SAMPLES, NOT ONE. The first version took a single row and reported
  // three cities as having non-unique ids. Two of those were the sampler's fault:
  // the first row it drew for LA carried the placeholder APN `' --'` (14 rows) and
  // for Miami `FOLIO 0000000000000` (4 rows). A single probe is not evidence
  // (rule 10), and a measurement that implies a lot of work is the instrument's
  // problem until proven otherwise (rule 25).
  //
  // The placeholders are a REAL finding and are reported separately — they are
  // Dallas's `MULTIPLE` in another city's spelling, and a watch keyed on one
  // would be ambiguous forever. But they are not evidence that the FIELD is
  // non-unique, which is a different claim about a different thing.
  const SAMPLES = 8
  try {
    const sample = await json(
      `${layer}/query?where=${encodeURIComponent(`${idField} IS NOT NULL`)}&outFields=${encodeURIComponent(idField)}&returnGeometry=false&resultRecordCount=${SAMPLES}&f=json`,
    )
    const feats = (sample.features ?? []) as Array<{ attributes?: Record<string, unknown> }>
    // rule 20: no sample means every assertion below is vacuous. RED, not green.
    if (feats.length === 0) return { city, ok: false, unique: 0, sampled: 0, detail: 'layer returned no sample row to test with' }

    const ids: string[] = []
    for (const f of feats) {
      const attrs = f.attributes ?? {}
      const key = Object.keys(attrs).find((k) => k.toLowerCase() === idField.toLowerCase())
      const raw = key ? attrs[key] : null
      if (raw != null && String(raw).trim() !== '') ids.push(String(raw))
    }
    if (ids.length === 0) return { city, ok: false, unique: 0, sampled: 0, detail: 'no sample row carried an id value' }

    let unique = 0
    const notFound: string[] = []
    const duplicated: Array<{ id: string; n: number }> = []
    for (const id of ids) {
      const where = `${idField} = '${id.replace(/'/g, "''")}'`
      const hit = await json(`${layer}/query?where=${encodeURIComponent(where)}&returnCountOnly=true&f=json`)
      const n = Number(hit.count ?? -1)
      if (n === 0) notFound.push(id)
      else if (n === 1) unique++
      else duplicated.push({ id, n })
    }

    // A value the layer HANDED US that does not match itself through an equality
    // filter is the one fatal outcome: trailing whitespace, a numeric column
    // quoted as a string, or a collation. It means NO lookup by that id can work.
    if (notFound.length) {
      return {
        city, ok: false, unique, sampled: ids.length,
        detail: `${notFound.length}/${ids.length} sampled ids do not match themselves (e.g. '${notFound[0]}') — lookup by id is impossible here`,
      }
    }

    // ⚠️ UNIQUENESS IS A MEASURED RATE, NOT A VERDICT, and an earlier version of
    // this file got that wrong. It classified "most samples unique" as a
    // placeholder problem and passed the city — which would have laundered
    // Chicago's genuine duplicate (`1716405037`, two rows, a real-looking PIN
    // where two polygons share a ten-digit land id) into an OK. That is rule 15
    // exactly: a well-explained interpretation defending the wrong conclusion.
    //
    // So the rate is reported and nothing is decided from it here. A lookup that
    // returns more than one row is handled where it happens — `findParcelById`
    // answers `ambiguous`, and the checker refuses to diff an ambiguous parcel,
    // because it cannot know which of the rows is the one being watched.
    const worst = duplicated.length ? duplicated.sort((a, b) => b.n - a.n)[0] : null
    return {
      city,
      ok: true,
      unique,
      sampled: ids.length,
      detail:
        worst == null
          ? `${idField} unique for all ${ids.length} sampled ids`
          : `${idField} unique for ${unique}/${ids.length} — worst '${worst.id}' matches ${worst.n} rows`,
    }
  } catch (e) {
    return { city, ok: false, unique: 0, sampled: 0, detail: `query: ${String((e as Error).message).slice(0, 70)}` }
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
    const mark = !r.ok ? 'FAIL' : r.unique === r.sampled ? 'OK  ' : 'DUPS'
    console.log(`${mark} ${c.padEnd(13)} ${r.detail}`)
  }

  const live = CITIES.filter((x) => x.live).map((x) => x.slug)
  const missing = live.filter((c) => !(c in PARCEL_SOURCES)).sort()
  const bad = rows.filter((r) => !r.ok)
  const dups = rows.filter((r) => r.ok && r.unique < r.sampled)
  console.log(`\n[lookup] ${rows.length - bad.length}/${rows.length} can be looked up by id · ${bad.length} cannot`)
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
