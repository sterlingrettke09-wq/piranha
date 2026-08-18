#!/usr/bin/env node
// WO-7.1 — Austin permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/austin.mjs
//
// Pulls Austin's "Issued Construction Permits" dataset from data.austintexas.gov
// (Socrata), filters to new-construction building permits, computes the median
// and 80th-percentile application -> issuance time in months, and MERGES the
// result into netlify/functions/lib/data/permitStats.json under
// austin.newConstruction. Idempotent: safe to run repeatedly; never touches
// other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── Dataset resource id ──────────────────────────────────────────────────────
// Socrata 4x4 resource id for "Issued Construction Permits" on
// data.austintexas.gov. Verify the schema by probing:
//   curl -s "https://data.austintexas.gov/resource/3syk-w9eu.json?\$limit=1"
// The dataset carries applieddate + issue_date + permittype + work_class. Re-find
// the id from the dataset's API docs page if it ever rotates.
const RESOURCE_ID = '3syk-w9eu'
const HOST = 'data.austintexas.gov'

// New-construction *building* permits: permittype = "BP" (building permit, as
// opposed to EP/PP/MP/DS electrical/plumbing/mechanical/site sub-permits) AND
// work_class = "New" (verified against the distinct histograms; "New" is the
// ground-up class, ~192k BP records).
const PERMITTYPE_FIELD = 'permittype'
const PERMITTYPE_BUILDING = 'BP'
const WORKCLASS_FIELD = 'work_class'
const PERMITCLASS_FIELD = 'permit_class'
const WORKCLASS_NEW = 'New'

// Filter to permits APPLIED on/after this date (keeps the vintage recent). If
// the resulting n is small we widen the window below.
const SINCE = '2022-01-01'
const SINCE_WIDE = '2020-01-01'

// Required date columns. If either is missing from the live schema we refuse to
// fabricate a latency figure and leave the artifact untouched (the Boston lesson).
const APPLIED_DATE_FIELD = 'applieddate'
const ISSUED_DATE_FIELD = 'issue_date'

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME =
  'data.austintexas.gov Issued Construction Permits ' +
  "(permittype = BP, work_class IN (New, Shell), building permit_class only)"

// ── permit_class gate — ADDED 2026-08-06 ────────────────────────────────────
// `work_class = 'New'` says the work is new. It says NOTHING about whether the
// thing is a BUILDING — that is carried by `permit_class`. An audit found 37.0%
// of the old admitted set was not a building: 3,599 swimming pools and spas,
// plus decks, patio covers, retaining walls, dumpster enclosures, EV chargers,
// telecom towers, boat docks and SXSW/ACL event tents.
//
// It survived because the contamination's duration (median 2.4 mo) is close to
// the clean set's (2.1) — it barely moved the headline while silently redefining
// what the headline was ABOUT.
//
// ALLOWLIST, not a denylist: a permit_class we have never seen is EXCLUDED
// rather than admitted, so a new Austin category cannot quietly re-contaminate
// this. Codes are the Census building-use series the portal uses; the excluded
// neighbours are 329 (Structures Other Than Bldg), 330 (Accessory Use to
// Primary), 437 (Boat Dock) and 438 (Garage/Carport Addn, Retaining Wall).
const BUILDING_CLASS_CODES = new Set([
  '101', // Single Family Houses
  '102', // Secondary Apartment (ADU)
  '103', // Two Family Bldgs
  '104', // Three and Four Family Bldgs
  '105', // Five or More Family Bldgs
  '106', // Mixed Use
  '213', // Hotels/Motels
  '318', '319', '320', '321', '322', '323', '324', '325', '326', '327', '328',
])

// Which building tier each class belongs to. Mirrors buildingTier() in
// netlify/functions/lib/timeline.ts: single = 1 unit, multi = 2-4, apartment =
// 5+ AND all commercial/institutional.
//
// WHY THIS EXISTS: one median over Austin's new-construction population answers
// no question anyone asked. That population is 49% single-family houses at 1.64
// months and 3% multifamily at 10.0 months — a 6x spread. Publishing 2.2 months
// to someone testing a multifamily parcel is wrong by 4.5x.
const TIER_BY_CLASS = {
  '101': 'single',
  '102': 'multi', '103': 'multi', '104': 'multi',
  '105': 'apartment', '106': 'apartment',
  '213': 'apartment',
  '318': 'apartment', '319': 'apartment', '320': 'apartment', '321': 'apartment',
  '322': 'apartment', '323': 'apartment', '324': 'apartment', '325': 'apartment',
  '326': 'apartment', '327': 'apartment', '328': 'apartment',
}

/** Census use code out of a permit_class like "R- 101 Single Family Houses". */
function classCode(permitClass) {
  const m = /\b(\d{3})\b/.exec(String(permitClass ?? ''))
  return m ? m[1] : null
}

import { readFile, writeFile } from 'node:fs/promises'
import { splitTiersAtFloor } from './lib/tierFloor.mjs'
import { feedCounts, logFeedTotals, probeFeedTotal } from '../lib/feedCounts.mjs'

async function socrata(path, params) {
  const url = new URL(`https://${HOST}/resource/${RESOURCE_ID}.${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(`Network error reaching ${HOST}: ${err.message}. ` +
      `Check connectivity; the dataset may also be temporarily offline.`)
  }
  if (res.status === 429) {
    throw new Error(`${HOST} returned HTTP 429 (rate limited). Wait a minute and re-run, ` +
      `or set an app token via the X-App-Token header to raise the throttle.`)
  }
  if (!res.ok) throw new Error(`${HOST} returned HTTP ${res.status} ${res.statusText}`)
  return res.json()
}

function quantile(sortedDays, q) {
  // Linear-interpolation percentile over an ascending array.
  if (sortedDays.length === 0) return null
  const idx = (sortedDays.length - 1) * q
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedDays[lo]
  return sortedDays[lo] + (sortedDays[hi] - sortedDays[lo]) * (idx - lo)
}

const daysToMonths = (days) => Math.round((days / 30.44) * 10) / 10

// Pull applied/issued pairs for new-construction building permits applied since `since`.
async function pull(since) {
  // work_class IN ('New','Shell') — 'Shell' is ground-up construction and was
  // being EXCLUDED: 202 records at median 11.1 mo / p80 17.4, i.e. the largest
  // multifamily, office, hotel and parking-garage projects in the city, which is
  // exactly the cohort a feasibility tool is consulted about. Dropping them was
  // 1.7% of the count and the entire upper tail.
  // ⚠️ RETRACTION, 2026-08-18. A comment here asserted that this query's
  // `issue_date IS NOT NULL` limb was selecting on the outcome and that Austin's
  // published figure was therefore a conditional median, by analogy with the
  // predicate nyc.mjs removed. That assertion was WRONG and is withdrawn.
  //
  // The limb is a measured NO-OP. Socrata 3syk-w9eu is an issued-only feed, so
  // there are no un-issued rows for it to select away. Verified independently
  // 2026-08-18, server-side, on this script's own cohort filter:
  //
  //     without the limb   18,409
  //     with the limb      18,409
  //     feed-wide issue_date IS NULL   0 of ~2.37M
  //
  // which reproduces the 2026-08-09 measurement already recorded in
  // scripts/permits/outcome-selection.ts under OUTCOME_SELECTION_EXEMPTIONS,
  // basis 'issued-only-feed'. That registry existed, said exactly this, and was
  // not read before the claim was written.
  //
  // WHAT THIS DOES AND DOES NOT SETTLE. It settles that no censoring is hidden
  // HERE: nothing is being filtered out, so the median is not conditional in the
  // NYC sense. It does NOT make the figure unconditional in every sense — an
  // issued-only feed cannot show applications that never issued at all, so the
  // issuance RATE is unobservable from this source rather than adverse. That is
  // a property of the feed, is why Kaplan-Meier is undefined here (no censored
  // observations means no risk set), and is a different statement from "45% of
  // filings never carried an issue date", which is what NYC's feed could show.
  const where =
    `${PERMITTYPE_FIELD} = '${PERMITTYPE_BUILDING}' ` +
    `AND ${WORKCLASS_FIELD} IN ('New', 'Shell') ` +
    `AND ${APPLIED_DATE_FIELD} >= '${since}T00:00:00.000' ` +
    `AND ${APPLIED_DATE_FIELD} IS NOT NULL ` +
    `AND ${ISSUED_DATE_FIELD} IS NOT NULL`
  return socrata('json', {
    $select: `${APPLIED_DATE_FIELD} AS applied, ${ISSUED_DATE_FIELD} AS issued, ${PERMITCLASS_FIELD} AS pclass`,
    $where: where,
    $limit: '50000',
  })
}

// Every row the resource holds, UNFILTERED — the grew-vs-shrank number. Goes
// through this script's own Socrata client so the count travels the same
// transport and error handling as the rows (rule 11: measure the pipeline, not
// your probe). Best-effort: a failed count is recorded as an unknown and never
// aborts a run that would otherwise produce a legitimate figure.
async function feedTotal() {
  return probeFeedTotal(`${HOST}/resource/${RESOURCE_ID}`, async () => {
    const rows = await socrata('json', { $select: 'count(1) AS n' })
    return rows[0]?.n
  })
}

async function main() {
  console.log(`Austin permit pipeline — resource ${RESOURCE_ID}`)

  // 1. Probe the schema (one tiny request) and confirm the fields we need exist.
  const probe = await socrata('json', { $limit: '1' })
  const fieldIds = new Set(Object.keys(probe[0] ?? {}))
  for (const f of [APPLIED_DATE_FIELD, ISSUED_DATE_FIELD, PERMITTYPE_FIELD, WORKCLASS_FIELD]) {
    if (!fieldIds.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in dataset schema; the resource may have ` +
          `changed. Found: ${[...fieldIds].join(', ')}. ` +
          `Refusing to fabricate a latency figure; permitStats.json left UNCHANGED.`,
      )
    }
  }

  // 1b. Feed row count, logged BEFORE any gate so it is on the record whatever
  //     this run goes on to do.
  const totals = [await feedTotal()]
  logFeedTotals(totals)

  // 2. Pull the sample. Widen the window if the recent slice is thin (< 50).
  let since = SINCE
  let rows = await pull(since)
  if (rows.length < 50) {
    console.warn(`  Only ${rows.length} rows since ${SINCE}; widening to ${SINCE_WIDE}.`)
    since = SINCE_WIDE
    rows = await pull(since)
  }

  // 3. Compute durations, dropping negatives and absurd outliers (> 120 months).
  //    Also watch the NYC failure mode (same-day OTC artifact).
  const days = []
  const byTier = { single: [], multi: [], apartment: [] }
  let sameDay = 0
  let notABuilding = 0
  for (const row of rows) {
    // The permit_class gate. A row whose class is unknown or not on the
    // allowlist is DROPPED, not bucketed — an unrecognised category must never
    // fall through into the aggregate.
    const code = classCode(row.pclass)
    if (code == null || !BUILDING_CLASS_CODES.has(code)) {
      notABuilding++
      continue
    }
    const a = Date.parse(row.applied)
    const i = Date.parse(row.issued)
    if (Number.isNaN(a) || Number.isNaN(i)) continue
    const d = (i - a) / 86_400_000
    if (Math.abs(d) < 0.5) sameDay++
    if (d >= 0 && d <= 120 * 30.44) {
      days.push(d)
      byTier[TIER_BY_CLASS[code]].push(d)
    }
  }
  console.log(`  excluded ${notABuilding} non-building rows (pools, decks, docks, event tents…)`)
  const cohortRows = rows.length - notABuilding

  if (days.length === 0) {
    console.warn('  No usable applied/issued pairs returned; leaving permitStats.json unchanged.')
    return
  }

  const sameDayPct = (sameDay / rows.length) * 100
  if (sameDayPct > 50) {
    console.warn(
      `  ${sameDayPct.toFixed(1)}% of rows are same-day (applied == issued) — an OTC ` +
        `recording artifact, not a real review time. Not writing austin.`,
    )
    return
  }

  days.sort((x, y) => x - y)
  const medianMonths = daysToMonths(quantile(days, 0.5))
  const p80Months = daysToMonths(quantile(days, 0.8))

  // 4. Sanity gate. A median under half a month or a tiny n is not trustworthy.
  if (medianMonths < 0.5 || days.length < 30) {
    console.warn(
      `  Result looks unreliable (median ${medianMonths} mo, n=${days.length}); ` +
        `not writing. Investigate the dataset before trusting this.`,
    )
    return
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const vintage = `applied ${since} onward; computed ${stamp}; ${DATASET_NAME}`

  // Per-tier figures. The aggregate is kept for compatibility but is the WEAKER
  // number — it is dominated by single-family volume, so a consumer that knows
  // the project's tier should always prefer byTier (see measuredFor()).
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
  console.log('  by tier:', Object.fromEntries(
    Object.entries(tiers).map(([k, v]) => [k, `${v.medianMonths}mo n=${v.n}`]),
  ))

  const stats = { medianMonths, p80Months, n: days.length, vintage }

  // 5. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    austin: {
      ...(existing.austin ?? {}),
      newConstruction: stats,
      byTier: tiers,
      tierBreakdown,
      feed: feedCounts({
        totals,
        cohortRows,
        basis:
          `totalRows: every row Socrata resource ${RESOURCE_ID} holds, unfiltered. ` +
          `cohortRows: ${PERMITTYPE_FIELD}='${PERMITTYPE_BUILDING}' AND ${WORKCLASS_FIELD} IN ` +
          `('New','Shell') AND ${APPLIED_DATE_FIELD} >= ${since} with both dates non-null ` +
          `(server-side), then gated to the building ${PERMITCLASS_FIELD} allowlist client-side. ` +
          `The published n is smaller than cohortRows: it also drops rows whose applied→issued ` +
          `duration is negative or over 120 months.`,
      }),
    },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote austin.newConstruction:', stats)
}

main().catch((err) => {
  console.error(`\naustin.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
