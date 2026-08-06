#!/usr/bin/env node
// WO-7.1 — San Francisco permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/sf.mjs
//
// Pulls San Francisco's "Building Permits" dataset from data.sfgov.org (Socrata),
// filters to new-construction permit types, computes the median and 80th-
// percentile filing -> issuance time in months, and MERGES the result into
// netlify/functions/lib/data/permitStats.json under sf.newConstruction.
// Idempotent: safe to run repeatedly; never touches other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── Two defects CORRECTED 2026-08-06 ────────────────────────────────────────
// An audit of the published figure (n=165, median 11.8) found the sampled
// population was BOTH duplicated and contaminated. Both corrections push the
// median UP, so the shipped number was too LOW. Measurements below are against
// the live window pulled 2026-08-06 (177 rows under the old filter).
//
// (1) ADDRESS FAN-OUT — 18.1% of rows were not permits.
//     This dataset emits ONE ROW PER ADDRESS, not one row per permit. A permit
//     covering a corner lot or a two-address building appears 2-3 times, and
//     `permit_number`, `filed_date` and `issued_date` are IDENTICAL on every
//     copy. 177 rows carried only 145 distinct permit numbers.
//
//     DIAGNOSIS MATTERS — this is a join-style fan-out, NOT the Austin pattern
//     of one project filing many permits. The discriminator is the date legs: in
//     all 30 duplicated groups the copies share the same filed_date AND the same
//     issued_date (0 groups differ), so they are re-emissions of one permit
//     rather than distinct filings, and the correction is a DEDUPE, not a
//     re-weighting. (SF does also show a little of the Austin pattern — "bldg
//     a"/"bldg b" pairs on one lot — but those carry DIFFERENT permit numbers
//     and are genuinely separate permits, so they are left alone.)
//
//     Fix: `primary_address_flag = 'Y'`. Verified dataset-wide, not just in the
//     window: over the whole permit_type 1,2 slice that predicate yields 12,836
//     rows carrying 12,836 distinct permit numbers — exactly one row per permit.
//
//     SIGN: the duplicate rows were FAST. Removed set n=32, median 9.1 mo,
//     against 11.8 for the retained permits — multi-address permits run 9.1 mo
//     vs 12.0 for single-address ones, so the duplication was over-weighting the
//     quick end of the distribution. Deduping alone moves 11.5 -> 11.8.
//
// (2) NON-BUILDING CONTAMINATION — 9.0% (13 of the 145 deduped permits).
//     `permit_type` 1/2 says the WORK is new construction. It says nothing about
//     whether the thing is a BUILDING. The admitted set included two greenhouses,
//     two storage sheds, two detached garages, a play structure's footings, two
//     bare modular-foundation permits, an accessory office/gym shed, and two
//     "accessory to dwelling" outbuildings ($25k and $85k).
//
//     SIGN: the contamination was FAST. Removed set n=13, median 7.7 mo, against
//     12.5 for the retained buildings.
//
// NET: median 11.5 -> 12.5, p80 24.0 -> 25.3, n 177 -> 132. Both corrections
// point the same way; the published 11.8 was biased LOW.
//
// ⚠️ NOT corrected here: right-censoring. This median is conditional on eventual
// issuance — permits filed and never issued are absent from the sample entirely,
// which biases the figure DOWN for recent cohorts. That is a separate pass (see
// docs/VERIFICATION-LEDGER.md), and applying it on top of this correction is the
// right order, not the reverse.
//
// ── Dataset resource id ──────────────────────────────────────────────────────
// Socrata 4x4 resource id for "Building Permits" on data.sfgov.org.
// Verify the schema by probing:
//   curl -s "https://data.sfgov.org/resource/i98e-djp9.json?\$limit=1"
// The dataset carries filed_date + issued_date + permit_type + the human-readable
// permit_type_definition. Re-find the id from the dataset's API docs page if it
// ever rotates.
const RESOURCE_ID = 'i98e-djp9'
const HOST = 'data.sfgov.org'

// New-construction permit types in this dataset (verified against the distinct
// permit_type / permit_type_definition histogram):
//   1 = "new construction"            (~2.5k records)
//   2 = "new construction wood frame" (~13k records)
const NEW_CONSTRUCTION_TYPES = ['1', '2']

// ── The building gate — ALLOWLIST, never a denylist ─────────────────────────
// A `proposed_use` we have never seen is EXCLUDED rather than admitted, so a new
// SF category cannot quietly re-contaminate this. The vocabulary was read off the
// portal (79 distinct values under permit_type 1,2), not guessed.
//
// Two kinds of admitted use, because they need different tests:
//
//   DWELLING_UNIT_USES — uses whose NAME asserts a dwelling count. For these,
//   `proposed_units >= 1` is REQUIRED. This is what catches the two "accessory to
//   dwelling" outbuildings: they carry proposed_use = '1 family dwelling' but
//   proposed_units = 0, i.e. the use field describes the parcel's dwelling, not
//   the structure being built. A residential use proposing zero dwellings is an
//   accessory structure.
//
//   OTHER_BUILDING_USES — occupiable buildings with no per-unit count, where
//   proposed_units is legitimately 0/null (schools, warehouses, rec centres). A
//   units test here would wrongly drop them; it wrongly dropped a residential
//   care facility ('misc group residns.', 23.4 mo) on the first pass.
//
// Deliberately EXCLUDED, with what each cost in the current window: greenhouse
// (2), storage shed (2), prkng garage/private (1), and null use (6). The
// vocabulary's other non-buildings — parking lot, fence/retaining wall, swimming
// pool, tower, antenna, storage tanks, vacant lot, not applicable — do not occur
// in the window but are excluded by the same allowlist.
//
// KNOWN COST, stated rather than hidden: the null-use exclusion also drops two
// legitimate buildings ("site permit 2 of 4" and "3 of 4" of a fire-department
// training facility, 5.6 and 7.7 mo). An allowlist cannot admit a row with no
// category without becoming a denylist, and rule 5 says a missing lookup must not
// render as an answer. Their sibling "4 of 4" carries a real use and is retained.
const DWELLING_UNIT_USES = new Set([
  '1 family dwelling',
  '2 family dwelling',
  'apartments',
  // Present in the portal's vocabulary but not in the current window, so adding
  // them changes today's output by exactly ZERO rows (verified). They are listed
  // so a future refresh does not silently drop real housing.
  'artist live/work',
  'residential hotel',
  'accessory cottage',
])

const OTHER_BUILDING_USES = new Set([
  'misc group residns.',
  'school',
  'day care center',
  'recreation bldg',
  'office',
  'sfpd or sffd station',
  'warehouse,no frnitur',
  'warehouse, furniture',
  'moving & storage',
  'food/beverage hndlng',
])

/** Proposed dwelling count as a number, or null when absent/unparseable. */
function proposedUnits(row) {
  const n = Number(row.proposed_units)
  return Number.isFinite(n) ? n : null
}

/** The subset of rows that are buildings. */
function selectBuildings(rows) {
  return rows.filter(isBuilding)
}

/** Is this permit for a BUILDING (as opposed to a shed, garage, greenhouse…)? */
function isBuilding(row) {
  const use = String(row.proposed_use)
  if (DWELLING_UNIT_USES.has(use)) {
    const n = proposedUnits(row)
    return n !== null && n >= 1
  }
  return OTHER_BUILDING_USES.has(use)
}

// Which building tier a row belongs to. Mirrors buildingTier() in
// netlify/functions/lib/timeline.ts: single = 1 unit, multi = 2-4, apartment =
// 5+ AND all commercial/institutional.
function tierOf(row) {
  if (!DWELLING_UNIT_USES.has(String(row.proposed_use))) return 'apartment'
  const n = proposedUnits(row)
  if (n >= 5) return 'apartment'
  if (n >= 2) return 'multi'
  return 'single'
}

// Filter to permits FILED on/after this date (keeps the vintage recent). If the
// resulting n is small we widen the window below.
const SINCE = '2022-01-01'
const SINCE_WIDE = '2018-01-01'

// Required date columns. If either is missing from the live schema we refuse to
// fabricate a latency figure and leave the artifact untouched (the Boston lesson).
const FILED_DATE_FIELD = 'filed_date'
const ISSUED_DATE_FIELD = 'issued_date'
const TYPE_FIELD = 'permit_type'
const PERMIT_NUMBER_FIELD = 'permit_number'
const PRIMARY_ADDRESS_FIELD = 'primary_address_flag'
const PROPOSED_USE_FIELD = 'proposed_use'
const PROPOSED_UNITS_FIELD = 'proposed_units'

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME =
  'data.sfgov.org Building Permits (permit_type 1,2 = new construction; ' +
  'primary_address_flag = Y to collapse the one-row-per-address fan-out; ' +
  'proposed_use allowlist = buildings only)'

import { readFile, writeFile } from 'node:fs/promises'

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

// Column names from the dataset METADATA, not from a sample row. A `$limit=1`
// probe omits any field that happens to be null on that row, so it reports a
// present column as missing — measuring the probe rather than the schema.
async function fieldNames() {
  const url = new URL(`https://${HOST}/api/views/${RESOURCE_ID}.json`)
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`${HOST} metadata returned HTTP ${res.status} ${res.statusText}`)
  const meta = await res.json()
  return new Set((meta.columns ?? []).map((c) => c.fieldName))
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

// Pull filed/issued pairs for new-construction permits filed since `since`.
async function pull(since) {
  const typeList = NEW_CONSTRUCTION_TYPES.map((t) => `'${t}'`).join(',')
  // `primary_address_flag = 'Y'` collapses the one-row-per-address fan-out
  // server-side — see the header. The client-side dedupe below is a guard, not
  // the mechanism.
  const where =
    `${TYPE_FIELD} IN (${typeList}) ` +
    `AND ${PRIMARY_ADDRESS_FIELD} = 'Y' ` +
    `AND ${FILED_DATE_FIELD} >= '${since}T00:00:00.000' ` +
    `AND ${FILED_DATE_FIELD} IS NOT NULL ` +
    `AND ${ISSUED_DATE_FIELD} IS NOT NULL`
  const rows = await socrata('json', {
    $select:
      `${FILED_DATE_FIELD} AS filed, ${ISSUED_DATE_FIELD} AS issued, ` +
      `${PERMIT_NUMBER_FIELD} AS permit, ${PROPOSED_USE_FIELD} AS proposed_use, ` +
      `${PROPOSED_UNITS_FIELD} AS proposed_units`,
    $where: where,
    $limit: '50000',
  })
  return rows
}

async function main() {
  console.log(`SF permit pipeline — resource ${RESOURCE_ID}`)

  // 1. Confirm every field we depend on exists in the live schema.
  const fieldIds = await fieldNames()
  for (const f of [
    FILED_DATE_FIELD,
    ISSUED_DATE_FIELD,
    TYPE_FIELD,
    PERMIT_NUMBER_FIELD,
    PRIMARY_ADDRESS_FIELD,
    PROPOSED_USE_FIELD,
    PROPOSED_UNITS_FIELD,
  ]) {
    if (!fieldIds.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in dataset schema; the resource may have ` +
          `changed. Found: ${[...fieldIds].join(', ')}. ` +
          `Refusing to fabricate a latency figure; permitStats.json left UNCHANGED.`,
      )
    }
  }

  // 2. Pull the sample. Widen the window if the usable slice is thin (< 50).
  //    The threshold is checked on the count that SURVIVES the building gate,
  //    not on the raw row count — a window that is only wide enough before
  //    filtering is not wide enough.
  let since = SINCE
  let rows = await pull(since)
  if (selectBuildings(rows).length < 50) {
    console.warn(`  Only ${rows.length} rows since ${SINCE}; widening to ${SINCE_WIDE}.`)
    since = SINCE_WIDE
    rows = await pull(since)
  }

  // 3. Dedupe guard. `primary_address_flag = 'Y'` is verified to be one row per
  //    permit across the whole permit_type 1,2 slice (12,836 rows / 12,836
  //    permit numbers), so this should never fire — it exists so that if SF ever
  //    changes the flag's semantics, the fan-out cannot silently return.
  const seen = new Set()
  const unique = []
  for (const row of rows) {
    if (row.permit != null && seen.has(row.permit)) continue
    if (row.permit != null) seen.add(row.permit)
    unique.push(row)
  }
  if (unique.length !== rows.length) {
    console.warn(
      `  ${rows.length - unique.length} duplicate permit_number rows survived ` +
        `${PRIMARY_ADDRESS_FIELD}='Y' — the flag's meaning may have changed. Deduped.`,
    )
  }

  // 4. The building gate. Anything not on the allowlist is DROPPED, never
  //    bucketed — an unrecognised category must not fall through into the
  //    aggregate. Excluded uses are logged BY NAME so a legitimate new category
  //    surfaces loudly instead of vanishing.
  const kept = selectBuildings(unique)
  const excluded = unique.filter((r) => !isBuilding(r))
  if (excluded.length > 0) {
    const byUse = {}
    for (const r of excluded) {
      const label = r.proposed_use == null ? '(no proposed_use)' : String(r.proposed_use)
      byUse[label] = (byUse[label] ?? 0) + 1
    }
    const pct = ((excluded.length / unique.length) * 100).toFixed(1)
    console.log(`  excluded ${excluded.length} non-building permits (${pct}%):`)
    for (const [use, n] of Object.entries(byUse).sort((a, b) => b[1] - a[1])) {
      console.log(`     ${String(n).padStart(4)}  ${use}`)
    }
  }

  // 5. Compute durations, dropping negatives and absurd outliers (> 120 months).
  const days = []
  const byTier = { single: [], multi: [], apartment: [] }
  for (const row of kept) {
    const a = Date.parse(row.filed)
    const i = Date.parse(row.issued)
    if (Number.isNaN(a) || Number.isNaN(i)) continue
    const d = (i - a) / 86_400_000
    if (d >= 0 && d <= 120 * 30.44) {
      days.push(d)
      byTier[tierOf(row)].push(d)
    }
  }

  if (days.length === 0) {
    console.warn('  No usable filed/issued pairs returned; leaving permitStats.json unchanged.')
    return
  }

  days.sort((x, y) => x - y)
  const medianMonths = daysToMonths(quantile(days, 0.5))
  const p80Months = daysToMonths(quantile(days, 0.8))

  // 6. Sanity gate. A median under half a month or a tiny n is not trustworthy.
  if (medianMonths < 0.5 || days.length < 30) {
    console.warn(
      `  Result looks unreliable (median ${medianMonths} mo, n=${days.length}); ` +
        `not writing. Investigate the dataset before trusting this.`,
    )
    return
  }

  const vintage =
    `filed ${since} onward; computed ${new Date().toISOString().slice(0, 10)}; ${DATASET_NAME}`

  // 7. Per-tier figures. The aggregate is kept for compatibility but is the
  //    WEAKER number — a consumer that knows the project's tier should always
  //    prefer byTier (see measuredFor()).
  //
  //    SF does NOT reproduce Austin's monotonic ordering. Measured 2026-08-06:
  //    single 13.1 (n=50), multi 17.9 (n=34), apartment 10.5 (n=48) — the 2-4
  //    unit tier is the SLOWEST and the 5+/commercial tier the fastest, so an
  //    aggregate median is doubly misleading here. No mechanism is asserted for
  //    that inversion: the obvious candidate (expedited 100%-affordable and
  //    mayoral-directive projects dominating the apartment tier) was tested and
  //    does NOT explain it — flagged 10.5 (n=30) vs unflagged 10.8 (n=18).
  const tiers = {}
  for (const [tier, arr] of Object.entries(byTier)) {
    if (arr.length < 30) {
      console.warn(`  tier ${tier}: n=${arr.length} < 30 — omitted rather than published thin`)
      continue
    }
    arr.sort((x, y) => x - y)
    tiers[tier] = {
      medianMonths: daysToMonths(quantile(arr, 0.5)),
      p80Months: daysToMonths(quantile(arr, 0.8)),
      n: arr.length,
      vintage,
    }
  }
  console.log(
    '  by tier:',
    Object.fromEntries(
      Object.entries(tiers).map(([k, v]) => [k, `${v.medianMonths}mo n=${v.n}`]),
    ),
  )

  const stats = { medianMonths, p80Months, n: days.length, vintage }

  // 8. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    sf: { ...(existing.sf ?? {}), newConstruction: stats, byTier: tiers },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote sf.newConstruction:', stats)
}

main().catch((err) => {
  console.error(`\nsf.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
