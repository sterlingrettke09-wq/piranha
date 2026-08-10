#!/usr/bin/env node
// WO-7.1 — Milwaukee permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/milwaukee.mjs
//
// Pulls Milwaukee's "Residential and Commercial Permit Work Data" from the city
// CKAN portal and WOULD compute the median / 80th-percentile application ->
// issuance time for ground-up new construction, merging it into
// netlify/functions/lib/data/permitStats.json under milwaukee.
//
// ⚠️ IT DOES NOT. Read the halt section before changing anything here. This
// script's correct output today is *no output*. It computes every figure and
// prints them, so the refusal is inspectable rather than opaque — but it writes
// nothing, and `milwaukee` is deliberately absent from
// CITIES_WITH_MEASURED_PERMITS in src/config/cities.ts.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the app
// reads; this script only refreshes it (re-run quarterly).
//
// ── THE HALT — why nothing is written (verified 2026-08-08) ─────────────────
// Milwaukee is the GOOD case on dates and the bad case on population.
//
// GOOD: `Date Opened` and `Date Issued` are both real, both 100% populated on
// new-construction rows (0 nulls in 3,063), and the naive-vs-clean gap that
// wrecked Raleigh's and Boston's filters is present and large here too — so the
// filter work below is real and was worth doing.
//
// BAD, and this is the blocker: only PART of the population can be enumerated.
//   · RESIDENTIAL rows carry a CONTROLLED vocabulary in `Use of Building` —
//     exactly 9 values, stable across every year 2016..2026, 0.2% blank, no
//     singletons. One-family and two-family dwellings are cleanly separable.
//   · COMMERCIAL rows carry FREE TEXT in the same column: 287 distinct strings
//     over 745 rows, 206 of them appearing exactly once, 14.1% blank. Values
//     range over IBC occupancy letters ('E', 'R-2', 'A-3, B, M, S-2'), plain
//     English ('Elephant Barn', 'Beer Pod', 'Whitebox'), non-buildings
//     ('Parking Lot', 'Transmission Tower', 'Retaining Wall', 'Site Paving')
//     and one 300-character prose description of an aircraft hangar.
//
// Milwaukee files ALL 5+-unit multifamily as a Commercial New Construction
// Permit — 'Multi Family', 'Multi-family 5 or more', 'Apartments', 'NEW
// SORORITY-R-2' and so on — so the apartment tier lives entirely inside the free
// text. It cannot be separated from parking lots and cell towers without
// inventing a taxonomy over 287 hand-typed strings, and 14.1% of the rows say
// nothing at all. Per the standing rule: if a filter cannot be cleanly
// enumerated, do not publish a number.
//
// WHY THE RESIDENTIAL FIGURES ALONE ARE NOT SHIPPED EITHER. They are sound —
// single 2.3 mo (n=262), multi 5.3 mo (n=83) — but publishing a 1-2-family
// aggregate would have answered an APARTMENT query in Milwaukee with a number
// computed from a population containing no apartments, and every caveat
// explaining that would have sat in a string the user never sees. That is rule
// 18 exactly: a plausible answer gets less scrutiny than a gap, and this one
// would be invisible rather than merely wrong.
//
// ⚠️ UPDATED 2026-08-09 — THE WIRING HALF OF THAT BLOCKER IS CLOSED. What this
// comment used to say ("`measuredFor(city, tier)` falls back to
// `newConstruction` whenever the requested tier has no entry") is NO LONGER
// TRUE. permitStats.json now carries a `tierBreakdown` per city, and
// `measuredFor` returns undefined — not the aggregate — for any tier absent from
// a breakdown that was attempted; `src/lib/realityCheck.ts` renders that as a
// "Not measured for 5+ unit buildings" card rather than dropping the figure
// silently. The named product decision has been taken.
//
// What is NOT closed, and is why this script still writes nothing: the
// commercial/apartment stratum still cannot be enumerated (below), so
// refuseUnlessEnumerable() still throws before any write. Publishing Milwaukee's
// residential-only pair is now a WIRING-SAFE option that nobody has taken; it
// needs a live re-run and a decision, and neither is this file's to make.
//
// The halt is STRUCTURAL — see refuseUnlessEnumerable() — not an incidental side
// effect of some other failure. If Milwaukee ever converts `Use of Building` on
// the commercial side to a picklist like the one it already uses on the
// residential side, the gate passes and the rest of this file is correct as
// written. Code that did not run is not code that works, so it is written to be
// right on the day it starts running.
//
// ── A SECOND, INDEPENDENT LIMITATION (would survive the fix above) ──────────
// The feed is ISSUED-ONLY. Established as an ANSWER, not a gap: the dataset HAS
// a `Status` column and its entire domain is one value —
//   SELECT "Status", COUNT(*) ... GROUP BY "Status"  ->  [{Issued: 16685}]
// — so an application that never issued is not censored, it is absent. The
// issuance rate is NOT COMPUTABLE from this source and any median here is a
// FLOOR: a conditional median, time-to-issuance GIVEN issuance. That is the same
// known-acceptable gap Nashville carries, and it is not by itself a reason to
// withhold; the enumeration failure above is.
//
// ── Dataset ────────────────────────────────────────────────────────────────
// CKAN, City of Milwaukee open data, dataset `buildingpermits` — "Residential and
// Commercial Permit Work Data", Department of Neighborhood Services, licence
// CC-BY, stated update frequency Monthly.
//   Landing page: https://data.milwaukee.gov/dataset/buildingpermits
// The resource id below is resolved from the dataset record at run time rather
// than hard-coded, because CKAN mints a new resource id whenever the publisher
// re-uploads. Hard-coding it is how these pipelines rot silently.
const HOST = 'data.milwaukee.gov'
const DATASET = 'buildingpermits'

const OPENED_FIELD = 'Date Opened'
const ISSUED_FIELD = 'Date Issued'
const TYPE_FIELD = 'Permit Type'
const USE_FIELD = 'Use of Building'
const STATUS_FIELD = 'Status'

const SINCE = '2022-01-01'

// ── The new-construction filter ────────────────────────────────────────────
// `Permit Type` is a genuine controlled vocabulary — exactly four values over
// the whole feed (Commercial/Residential x Alteration/New Construction), and it
// agrees with the `Record ID` prefix (COM-NEW / RES-NEW / COM-ALT / RES-ALT) on
// every one of 16,685 rows. So selecting new construction is unambiguous.
//
// It is also NOT SUFFICIENT, in exactly the way the Raleigh and Boston filters
// were not. Measured 2026-08-08 over the whole feed:
//   Residential New Construction  n=2,318  of which 1,547 (66.7%) are NOT
//     buildings — 1,359 detached garages, 50 sheds, 30 carports, 21 gazebos,
//     10 decks, 77 'other'. Only 766 are dwellings.
//   The detached garages are over-the-counter: 27.5% same-day, median 0.33 mo.
//
// Effect on the headline, window 2022-01-01 onward:
//   naive `Permit Type` filter alone   1.59 mo   n=1,358   same-day 9.50%
//   dwellings only                     2.73 mo   n=  345   same-day  1.16%
// The naive filter nearly HALVES the measured duration and manufactures a
// same-day mass eight times the real one.
const NEW_CONSTRUCTION_TYPES = [
  'Residential New Construction Permit',
  'Commercial New Construction Permit',
]

// ── Residential `Use of Building` — a closed vocabulary, verified ──────────
// All 9 values observed 2016..2026, present in every year, no singletons.
// Tier mirrors buildingTier() in netlify/functions/lib/timeline.ts: single =
// 1 unit, multi = 2-4, apartment = 5+ AND all commercial/institutional.
//
// Admission criterion, same wording as nashville.mjs and raleigh.mjs: a permit
// is admitted iff it authorises a ROOFED STRUCTURE INTENDED FOR HUMAN OCCUPANCY
// OR THE STORAGE OF GOODS.
const RESIDENTIAL_TIER = {
  'One-family dwelling': 'single',
  'Two-family dwelling': 'multi',
}
// Excluded residential values, each measured over the whole feed (n / median mo):
//   Detached garage  1,358 / 0.33   Nashville and Austin exclude the same class
//   shed                50 / —      IBC Group U, utility and miscellaneous
//   carport             30 / —
//   gazebo              21 / —
//   deck                10 / —
//   other               77 / —      unlabelled by the filer; not classifiable
//   '' (blank)           5 / —
const RESIDENTIAL_NON_BUILDING = new Set([
  'Detached garage', 'shed', 'carport', 'gazebo', 'deck', 'other', '',
])

// ── The structural gate ────────────────────────────────────────────────────
// Thresholds a CONTROLLED vocabulary passes and free text does not. Calibrated
// against the residential column, which passes every one of them comfortably
// (9 distinct / 2,318 rows, 0 singletons, 0.2% blank). Measured on the
// commercial column 2026-08-08: 287 distinct, 27.7% singletons, 14.1% blank —
// it fails all three, by roughly an order of magnitude each.
const VOCAB_MAX_DISTINCT = 40
const VOCAB_MAX_SINGLETON_SHARE = 0.05
const VOCAB_MAX_BLANK_SHARE = 0.02

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)

import { readFile, writeFile } from 'node:fs/promises'
import { splitTiersAtFloor } from './lib/tierFloor.mjs'
import { feedCounts, logCohortRows, logFeedTotals, probeFeedTotal } from '../lib/feedCounts.mjs'

const norm = (s) => String(s ?? '').trim()

async function ckan(action, params) {
  const url = new URL(`https://${HOST}/api/3/action/${action}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(
      `Network error reaching ${HOST}: ${err.message}. Check connectivity; the portal may ` +
        `also be temporarily offline. permitStats.json left UNCHANGED.`,
    )
  }
  if (!res.ok) throw new Error(`${HOST} returned HTTP ${res.status} ${res.statusText}`)
  const json = await res.json()
  // CKAN answers some errors with HTTP 200 and success:false — a failed fetch
  // must never silently become a substantive answer (rule 5).
  if (!json.success) throw new Error(`CKAN ${action} failed: ${JSON.stringify(json.error)}`)
  return json.result
}

/** Resolve the CSV resource's datastore id from the dataset record, not a guess. */
async function resolveResourceId() {
  const pkg = await ckan('package_show', { id: DATASET })
  const csv = (pkg.resources ?? []).find((r) => norm(r.format).toUpperCase() === 'CSV')
  if (!csv) {
    throw new Error(
      `Dataset "${DATASET}" no longer publishes a CSV resource. Found formats: ` +
        `${(pkg.resources ?? []).map((r) => r.format).join(', ') || '(none)'}. ` +
        `permitStats.json left UNCHANGED.`,
    )
  }
  return { id: csv.id, modified: pkg.metadata_modified }
}

// Every row the datastore resource holds, UNFILTERED — the grew-vs-shrank
// number. Asked of the SERVER (datastore_search reports `total` for a limit-0
// query) rather than taken from pullAll()'s row array: the array is the pager's
// output, so using it would measure this script's pagination instead of the feed
// (rule 11), and a pager that silently stops short would report a shrunken feed.
// Goes through this script's own CKAN client; best-effort, never aborts the run.
async function feedTotal(resourceId) {
  return probeFeedTotal(`${HOST} datastore ${resourceId}`, async () => {
    const page = await ckan('datastore_search', { resource_id: resourceId, limit: '0' })
    return page.total
  })
}

async function pullAll(resourceId) {
  const rows = []
  for (let offset = 0; ; offset += 2000) {
    const page = await ckan('datastore_search', {
      resource_id: resourceId,
      limit: '2000',
      offset: String(offset),
    })
    const recs = page.records ?? []
    rows.push(...recs)
    if (recs.length < 2000) break
    if (rows.length > 500_000) throw new Error('Pagination did not terminate; aborting.')
  }
  return rows
}

/** 'YYYY-MM-DD HH:MM:SS' text -> epoch ms, or null. Every column in this
 *  datastore is typed `text`, including the two dates, so parsing is ours to do
 *  and a server-side date comparison would be a lexicographic one. */
function parseStamp(s) {
  const v = norm(s)
  if (!v) return null
  const t = Date.parse(`${v.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(t) ? null : t
}

function quantile(sortedDays, q) {
  if (sortedDays.length === 0) return null
  const idx = (sortedDays.length - 1) * q
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedDays[lo]
  return sortedDays[lo] + (sortedDays[hi] - sortedDays[lo]) * (idx - lo)
}

const daysToMonths = (days) => Math.round((days / 30.44) * 10) / 10
const pct = (a, b) => (b === 0 ? 0 : (a / b) * 100)

function durations(rows) {
  const out = []
  for (const r of rows) {
    const a = parseStamp(r[OPENED_FIELD])
    const i = parseStamp(r[ISSUED_FIELD])
    if (a == null || i == null) continue
    const d = (i - a) / 86_400_000
    if (d >= 0 && d <= 120 * 30.44) out.push(d)
  }
  return out.sort((x, y) => x - y)
}

function describe(label, days) {
  if (days.length === 0) {
    console.log(`    ${label.padEnd(34)} n=0`)
    return null
  }
  const zero = days.filter((d) => d < 0.5).length
  const within7 = days.filter((d) => d <= 7).length
  const stat = {
    medianMonths: daysToMonths(quantile(days, 0.5)),
    p80Months: daysToMonths(quantile(days, 0.8)),
    n: days.length,
  }
  console.log(
    `    ${label.padEnd(34)} n=${String(stat.n).padStart(5)}  median ${stat.medianMonths} mo  ` +
      `p80 ${stat.p80Months}  same-day ${pct(zero, days.length).toFixed(2)}%  ` +
      `<=7d ${pct(within7, days.length).toFixed(2)}%`,
  )
  return stat
}

/** Describe a column's vocabulary: distinct values, singletons, blanks. */
function vocabulary(rows, field) {
  const counts = new Map()
  for (const r of rows) {
    const v = norm(r[field])
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  const singletons = [...counts.values()].filter((n) => n === 1).length
  return {
    distinct: counts.size,
    rows: rows.length,
    singletonShare: pct(singletons, rows.length) / 100,
    blankShare: pct(counts.get('') ?? 0, rows.length) / 100,
    counts,
  }
}

/**
 * THE HALT. Returns only if the commercial `Use of Building` column has become a
 * controlled vocabulary; otherwise throws with the measured reason.
 *
 * This exists as a function, and is called before any write, so that the refusal
 * is a property of the script rather than an accident of ordering. Boston's
 * previous pipeline halted for the right reason by luck, on a missing column,
 * while its filter was 58% contaminated underneath — nothing but that accident
 * stood between a bad filter and a published number.
 */
function refuseUnlessEnumerable(vocab) {
  const reasons = []
  if (vocab.distinct > VOCAB_MAX_DISTINCT) {
    reasons.push(
      `${vocab.distinct} distinct values over ${vocab.rows} rows (a controlled vocabulary would ` +
        `have <= ${VOCAB_MAX_DISTINCT})`,
    )
  }
  if (vocab.singletonShare > VOCAB_MAX_SINGLETON_SHARE) {
    reasons.push(
      `${(vocab.singletonShare * 100).toFixed(1)}% of rows carry a value that appears exactly ` +
        `once (limit ${VOCAB_MAX_SINGLETON_SHARE * 100}%)`,
    )
  }
  if (vocab.blankShare > VOCAB_MAX_BLANK_SHARE) {
    reasons.push(
      `${(vocab.blankShare * 100).toFixed(1)}% of rows are blank (limit ` +
        `${VOCAB_MAX_BLANK_SHARE * 100}%)`,
    )
  }
  if (reasons.length === 0) return
  throw new Error(
    `Commercial "${USE_FIELD}" is FREE TEXT, so the commercial/apartment stratum cannot be ` +
      `enumerated:\n` +
      reasons.map((r) => `    · ${r}`).join('\n') +
      `\n\n  Milwaukee files all 5+-unit multifamily as a Commercial New Construction Permit, so ` +
      `the\n  apartment tier lives entirely inside that free text and cannot be separated from ` +
      `parking\n  lots, cell towers and retaining walls without inventing a taxonomy. Publishing ` +
      `the\n  residential figures alone is ALSO refused here — though note the reason CHANGED on ` +
      `2026-08-09:\n  measuredFor() no longer falls back to the aggregate for a tier a computed ` +
      `breakdown lacks\n  (see tierBreakdown in permitStats.json), so an apartment query would ` +
      `now correctly show\n  "not measured" instead of a 1-2-family number. Shipping the ` +
      `residential pair is therefore\n  a live product decision, not a wiring bug — and this ` +
      `script does not take it unattended.\n\n` +
      `  This is a GAP, not an answer. permitStats.json left UNCHANGED — by design.`,
  )
}

async function main() {
  console.log(`Milwaukee permit pipeline — ${HOST} dataset ${DATASET}`)

  const { id: resourceId, modified } = await resolveResourceId()
  console.log(`  resource ${resourceId} (dataset metadata_modified ${modified})`)

  // Feed row count, logged BEFORE the halt below. Milwaukee refuses to write, so
  // this is what a run here leaves behind — and it is what answers "has the feed
  // changed since the last extract?" without a re-derivation. It doubles as a
  // pagination cross-check: it should equal the pulled row count below.
  const totals = [await feedTotal(resourceId)]
  logFeedTotals(totals)

  const rows = await pullAll(resourceId)
  console.log(`  pulled ${rows.length} rows`)
  if (totals[0].totalRows != null && totals[0].totalRows !== rows.length) {
    console.warn(
      `  ⚠ the server reports ${totals[0].totalRows} rows but the pager returned ` +
        `${rows.length}. The extract is partial or the feed changed mid-run; every figure ` +
        `below is over whatever the pager happened to return.`,
    )
  }

  // 1. Confirm every field we read exists. If one is missing we refuse to
  //    fabricate a latency figure and leave the artifact untouched.
  const fields = new Set(Object.keys(rows[0] ?? {}))
  for (const f of [OPENED_FIELD, ISSUED_FIELD, TYPE_FIELD, USE_FIELD, STATUS_FIELD]) {
    if (!fields.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in the datastore schema; the resource may have ` +
          `changed. Found: ${[...fields].join(', ')}. Refusing to fabricate a latency figure; ` +
          `permitStats.json left UNCHANGED.`,
      )
    }
  }

  // 2. ISSUED-ONLY, established from the Status column's whole domain — the slot
  //    exists and holds exactly one value. That is positive evidence of an
  //    absence, not a reader failing to find something.
  const statuses = new Map()
  for (const r of rows) statuses.set(norm(r[STATUS_FIELD]), (statuses.get(norm(r[STATUS_FIELD])) ?? 0) + 1)
  console.log(`  ${STATUS_FIELD} domain: ${[...statuses].map(([s, n]) => `${s} (${n})`).join(', ')}`)
  if (statuses.size === 1 && statuses.has('Issued')) {
    console.log(
      '  → ISSUED-ONLY feed: an application that never issued is ABSENT, not censored. ' +
        'The issuance rate is not computable and any median here is a FLOOR — a conditional ' +
        'median, time-to-issuance GIVEN issuance.',
    )
  }

  const newRows = rows.filter((r) => NEW_CONSTRUCTION_TYPES.includes(norm(r[TYPE_FIELD])))
  const sinceMs = Date.parse(`${SINCE}T00:00:00Z`)
  const win = newRows.filter((r) => {
    const t = parseStamp(r[OPENED_FIELD])
    return t != null && t >= sinceMs
  })
  const nullOpened = newRows.filter((r) => parseStamp(r[OPENED_FIELD]) == null).length
  const nullIssued = newRows.filter((r) => parseStamp(r[ISSUED_FIELD]) == null).length
  console.log(
    `  new-construction rows: ${newRows.length} all-time, ${win.length} opened >= ${SINCE}; ` +
      `null ${OPENED_FIELD}: ${nullOpened}, null ${ISSUED_FIELD}: ${nullIssued}`,
  )

  const res = win.filter((r) => norm(r[TYPE_FIELD]).startsWith('Residential'))
  const com = win.filter((r) => norm(r[TYPE_FIELD]).startsWith('Commercial'))

  // 3. Everything this script CAN compute, printed so the refusal is inspectable.
  console.log('\n  what the naive filter would have said, vs the clean one:')
  describe('Permit Type alone (WRONG)', durations(win))

  const dwellings = res.filter((r) => norm(r[USE_FIELD]) in RESIDENTIAL_TIER)
  const resNovel = [...new Set(res.map((r) => norm(r[USE_FIELD])))].filter(
    (u) => !(u in RESIDENTIAL_TIER) && !RESIDENTIAL_NON_BUILDING.has(u),
  )
  if (resNovel.length) {
    console.warn(
      `  ⚠ residential ${USE_FIELD} value(s) not seen when this allowlist was built, EXCLUDED ` +
        `pending classification: ${resNovel.join(', ')}`,
    )
  }
  logCohortRows(
    dwellings.length,
    `${TYPE_FIELD} IN (new-construction types), ${OPENED_FIELD} >= ${SINCE}, residential ${USE_FIELD} allowlist`,
  )
  describe('residential dwellings only', durations(dwellings))
  for (const [use, tier] of Object.entries(RESIDENTIAL_TIER)) {
    describe(`  ${tier} (${use})`, durations(res.filter((r) => norm(r[USE_FIELD]) === use)))
  }
  describe('residential NON-buildings', durations(res.filter((r) => RESIDENTIAL_NON_BUILDING.has(norm(r[USE_FIELD])))))
  describe('commercial (unenumerable)', durations(com))

  // 4. Vocabulary check on both columns, then the halt.
  const resVocab = vocabulary(res, USE_FIELD)
  const comVocab = vocabulary(com, USE_FIELD)
  const fmt = (v) =>
    `${v.distinct} distinct / ${v.rows} rows, ${(v.singletonShare * 100).toFixed(1)}% singletons, ` +
    `${(v.blankShare * 100).toFixed(1)}% blank`
  console.log(`\n  residential ${USE_FIELD}: ${fmt(resVocab)}  (controlled)`)
  console.log(`  commercial  ${USE_FIELD}: ${fmt(comVocab)}`)

  refuseUnlessEnumerable(comVocab)

  // ── Nothing below here has ever run. It is written to be correct on the day
  //    the gate above starts passing, and it is deliberately NOT reachable by a
  //    caveat, a flag or an env var: there is no way to talk this script into
  //    publishing an unenumerable population.
  const byTier = { single: [], multi: [], apartment: [] }
  for (const r of dwellings) byTier[RESIDENTIAL_TIER[norm(r[USE_FIELD])]].push(...durations([r]))
  const all = durations(dwellings)
  const stamp = new Date().toISOString().slice(0, 10)
  const vintage =
    `opened ${SINCE} onward; computed ${stamp}; ${HOST} ${DATASET} "Residential and Commercial ` +
    `Permit Work Data" (Permit Type IN (${NEW_CONSTRUCTION_TYPES.join(', ')}), gated to building ` +
    `"${USE_FIELD}" only). ISSUED-ONLY FEED: the Status column's entire domain is 'Issued', so ` +
    `filings that never issued are absent rather than censored; the issuance rate is not ` +
    `computable and this is a FLOOR — a conditional median, time-to-issuance GIVEN issuance.`
  // The n<30 publication floor and the RECORD of every tier it withholds come out
  // of one call, so a tier can no longer be dropped silently — see
  // scripts/permits/lib/tierFloor.mjs. `tierBreakdown` is written beside `byTier`
  // and is what tells measuredFor() to fail closed rather than serve the
  // aggregate for a withheld tier.
  const { tiers, tierBreakdown } = splitTiersAtFloor(byTier, (rows) => ({
    medianMonths: daysToMonths(quantile(rows, 0.5)),
    p80Months: daysToMonths(quantile(rows, 0.8)),
    n: rows.length,
    vintage,
  }))
  const stats = {
    medianMonths: daysToMonths(quantile(all, 0.5)),
    p80Months: daysToMonths(quantile(all, 0.8)),
    n: all.length,
    vintage,
  }
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    milwaukee: {
      ...(existing.milwaukee ?? {}),
      newConstruction: stats,
      byTier: tiers,
      tierBreakdown,
      feed: feedCounts({
        totals,
        cohortRows: dwellings.length,
        basis:
          `totalRows: every row the ${HOST} ${DATASET} CSV datastore holds, unfiltered, as ` +
          `reported by the server rather than counted off this script's pager. cohortRows: ` +
          `${TYPE_FIELD} on the new-construction allowlist AND ${OPENED_FIELD} >= ${SINCE}, ` +
          `gated to residential rows whose ${USE_FIELD} is a known dwelling class — the ` +
          `commercial arm is excluded entirely (see the enumerability halt). The published n ` +
          `is smaller: it also drops rows without a parseable date pair. Like everything else ` +
          `below the halt, this has never executed.`,
      }),
    },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')
  console.log('  Wrote milwaukee.newConstruction:', stats)
}

main().catch((err) => {
  console.error(`\nmilwaukee.mjs halted: ${err.message}\n`)
  process.exitCode = 1
})
