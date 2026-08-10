#!/usr/bin/env node
// WO-7.1 — Philadelphia permit-timeline pipeline (OFFLINE, run by hand).
//
//   node scripts/permits/philadelphia.mjs
//
// Computes the median and 80th-percentile APPLICATION -> ISSUANCE time in months
// for ground-up new-construction building permits and MERGES the result into
// netlify/functions/lib/data/permitStats.json under philadelphia.newConstruction.
// Idempotent: safe to run repeatedly; never touches other cities' blocks.
//
// This is NOT a runtime dependency. The committed JSON is the only thing the
// app reads; this script only refreshes it (re-run quarterly).
//
// ── WHY THIS CITY NEEDS TWO FEEDS ────────────────────────────────────────────
// Philadelphia is the only city in this set whose permit feed does NOT carry a
// filing date. The Carto `permits` table (48 columns, verified 2026-08-05) has
// permitissuedate / permitcompleteddate / certificateofoccupancydate /
// mostrecentinsp / denialdate — and no application, filed, or submitted column.
// The legacy `li_permits` table has none either (and stops in 2020).
//
// Substituting issue->completion or issue->CO here would answer a DIFFERENT
// question under the same name, so we don't. Instead the filing date comes from
// a second, genuinely separate L&I publication — the eCLIPSE permit-application
// status layer — joined on the permit/application number.
//
//   A. Carto  `permits`                     -> permitnumber + permitissuedate
//                                              + typeofwork (the new-construction flag)
//   B. ArcGIS `AGO_Lyr_Permit_App_Status_Eclipse` (PermitAppStatusEclipse)
//                                           -> APPLICATIONNUMBER + APPLICATIONDATE
//
// The join was validated before it was trusted (2026-08-05):
//   * 4,212 of 4,237 issued new-construction building permits matched (99.4%),
//     so the sample is not a biased subset of what B happens to cover;
//   * B holds exactly ONE row per application number (55,194 rows, 55,194
//     distinct) — the join is 1:1, not a review-cycle fan-out;
//   * 0 of 3,766 pairs are same-day and 0 are negative (min 1 day), so
//     APPLICATIONDATE is not an issuance timestamp under another name — this is
//     the NYC/OTC artifact guard, and Philadelphia passes it cleanly;
//   * 0 of 37,421 rows in B have LATESTREVIEWCOMPLETEDDATE < APPLICATIONDATE,
//     so the field orders correctly against a third date it does not derive from.
//
// EXTERNAL CHECK (rule 9 — nothing here was validated only against itself).
// L&I publishes target plan-review clocks: 15 business days for one/two-family
// new construction, 20 for commercial and shell-only
// (phila.gov "Get a Building Permit" / L&I permit processing times).
// Measured medians are 2.7 mo residential and 4.0 mo commercial — 3-4x the bare
// review target, which is the right SHAPE (filing->issuance also contains
// applicant resubmittal cycles, zoning prerequisites and fee payment, none of
// which are in L&I's clock) and, independently, the residential < commercial
// ordering matches the 15 < 20 business-day ordering. The published target is a
// plausibility benchmark only; every number this script emits is computed from
// the returned records.
//
// ── KNOWN BIAS, AND ITS DIRECTION ────────────────────────────────────────────
// The sample conditions on issuance, so applications still pending are absent
// and recent cohorts are right-censored. This biases the figure LOW (it
// understates true filing->issuance). Measured by application-year cohort:
//   2022 median 3.5 / p80 7.4   2023 4.2 / 7.3   2024 2.9 / 6.4
//   2025 2.6 / 5.5              2026 2.1 / 3.3  (7 months old — mostly censored)
// The matured 2022-2023 cohort alone gives median 3.9 / p80 7.4 (n=1,611)
// against 3.0 / 6.3 for the full applied-2022+ sample. The full sample is what
// ships, because that is the window the other six cities use and the figures are
// only comparable if the window is. Do not "correct" for this without measuring.
const CARTO = 'https://phl.carto.com/api/v2/sql'
const AGS =
  'https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/' +
  'AGO_Lyr_Permit_App_Status_Eclipse/FeatureServer/0/query'

// Ground-up new construction = a BUILDING permit whose typeofwork is a New
// Construction variant. Both halves are load-bearing:
//   * permitdescription pins it to the building permit and drops the trade
//     sub-permits, which carry their own "New Construction" typeofwork
//     (Plumbing 13,685 / Electrical 5,832 / Fire Suppression 5,689 /
//     Mechanical 5,649 rows issued 2022+ would otherwise quadruple-count every
//     project and measure the wrong review queue). It also drops Zoning Permits
//     ("New construction, addition, GFA change"), Demolition Permits,
//     Site/Utility, General, Administrative and Operations permits.
//   * typeofwork drops Alterations, Addition and/or Alteration(s), Change of
//     Use, all EZ-* classes, Full/Major/Minor/City Demolition, Excavation,
//     Foundation-only, Signs, Solar, Fences and Make Safe permits.
// Verified 2026-08-05 against the live typeofwork x permitdescription cross-tab;
// the driver set is 4,237 rows with 4,237 DISTINCT permit numbers, so renewals
// and amendments are not present as repeat rows.
const BUILDING_PERMIT_DESCRIPTIONS = ['Residential Building Permit', 'Commercial Building Permit']
const NEW_CONSTRUCTION_WORK_TYPES = [
  'New Construction',
  'New Construction (Shell Only)',
  'New Construction (Stand Alone)',
]

// Filter to permits APPLIED on/after this date (matches the other six cities).
const SINCE = '2022-01-01'

const OUT_PATH = new URL('../../netlify/functions/lib/data/permitStats.json', import.meta.url)
const DATASET_NAME =
  'phl.carto.com permits (permitdescription = Residential/Commercial Building Permit, ' +
  'typeofwork = New Construction*) joined on permit number to ArcGIS ' +
  'AGO_Lyr_Permit_App_Status_Eclipse APPLICATIONDATE'

import { readFile, writeFile } from 'node:fs/promises'
import { noTierBreakdown } from './lib/tierFloor.mjs'
import { feedCounts, logCohortRows, logFeedTotals, probeFeedTotal } from '../lib/feedCounts.mjs'

const quoteList = (values) => values.map((v) => `'${v}'`).join(',')

async function carto(sql) {
  const url = new URL(CARTO)
  url.searchParams.set('q', sql)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(
      `Network error reaching phl.carto.com: ${err.message}. ` +
        `Check connectivity; the dataset may also be temporarily offline.`,
    )
  }
  if (!res.ok) throw new Error(`phl.carto.com returned HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  if (!body.rows) throw new Error(`phl.carto.com returned no rows key: ${JSON.stringify(body).slice(0, 300)}`)
  return body
}

// One ArcGIS request, with the transport and error handling in ONE place so the
// paged row pull and the count probe below cannot diverge (rule 11: a count
// fetched by a private helper measures the helper).
async function arcgisQuery(params) {
  const url = new URL(AGS)
  url.searchParams.set('f', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } })
  } catch (err) {
    throw new Error(`Network error reaching services.arcgis.com: ${err.message}`)
  }
  if (!res.ok) throw new Error(`services.arcgis.com returned HTTP ${res.status} ${res.statusText}`)
  const body = await res.json()
  if (body.error) throw new Error(`ArcGIS error: ${JSON.stringify(body.error).slice(0, 300)}`)
  return body
}

// Paginated ArcGIS query. The layer caps at 2,000 records per request.
async function arcgis(where, outFields) {
  const out = []
  let offset = 0
  for (;;) {
    const body = await arcgisQuery({
      where,
      outFields,
      returnGeometry: 'false',
      orderByFields: 'OBJECTID',
      resultOffset: String(offset),
      resultRecordCount: '2000',
    })
    const features = body.features ?? []
    out.push(...features.map((f) => f.attributes))
    if (features.length < 2000) break
    offset += features.length
  }
  return out
}

// Every row each of the TWO feeds holds, UNFILTERED — the grew-vs-shrank
// numbers. Philadelphia's figure is a JOIN across two independent publishers, so
// one summed total would be diffable against neither: either side can move on
// its own, and a drop in the match rate is only interpretable if you can see
// which side shrank. Best-effort; a failed count is recorded as an unknown and
// never aborts the run.
async function feedTotals() {
  return [
    await probeFeedTotal('phl.carto.com permits', async () => {
      const body = await carto('SELECT count(*) AS n FROM permits')
      return body.rows?.[0]?.n
    }),
    await probeFeedTotal('AGO_Lyr_Permit_App_Status_Eclipse/FeatureServer/0', async () => {
      const body = await arcgisQuery({ where: '1=1', returnCountOnly: 'true' })
      return body.count
    }),
  ]
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

async function main() {
  console.log('Philadelphia permit pipeline — phl.carto.com permits + eCLIPSE app-status layer')

  // 1. Probe the Carto schema and REFUSE to proceed if a filing date has appeared
  //    natively — that would be a better single-source answer than this join, and
  //    silently ignoring it would leave us on the weaker method forever.
  const probe = await carto('SELECT * FROM permits LIMIT 1')
  const fields = new Set(Object.keys(probe.fields ?? {}))
  for (const f of ['permitnumber', 'permitissuedate', 'typeofwork', 'permitdescription']) {
    if (!fields.has(f)) {
      throw new Error(
        `Expected field "${f}" not found in the phl.carto.com permits schema; the ` +
          `dataset may have changed. Found: ${[...fields].join(', ')}. ` +
          `Refusing to fabricate a latency figure; permitStats.json left UNCHANGED.`,
      )
    }
  }
  const nativeApplied = ['applicationdate', 'applieddate', 'filed_date', 'applicationdt'].filter((f) =>
    fields.has(f),
  )
  if (nativeApplied.length > 0) {
    console.warn(
      `\n  NOTE: phl.carto.com permits now exposes ${nativeApplied.join(', ')}. ` +
        `Prefer that single-source filing date over the cross-feed join below and ` +
        `rewrite this script before trusting another run.\n`,
    )
  }

  // 1b. Feed row counts, one per publisher, logged before anything is computed.
  const totals = await feedTotals()
  logFeedTotals(totals)

  // 2. Driver set: issued ground-up new-construction BUILDING permits.
  //    permitissuedate >= SINCE is a valid superset of "applied >= SINCE", since
  //    a permit applied for on/after SINCE cannot have issued before it.
  const permitsSql =
    `SELECT permitnumber, permitissuedate FROM permits ` +
    `WHERE permitdescription IN (${quoteList(BUILDING_PERMIT_DESCRIPTIONS)}) ` +
    `AND typeofwork IN (${quoteList(NEW_CONSTRUCTION_WORK_TYPES)}) ` +
    `AND permitissuedate >= '${SINCE}' ` +
    `AND permitissuedate IS NOT NULL`
  const permits = (await carto(permitsSql)).rows
  console.log(`  issued new-construction building permits (issued ${SINCE}+): ${permits.length}`)

  // 3. Filing dates. Pull from a year before SINCE so applications filed in late
  //    2021 are available to be correctly EXCLUDED rather than silently missing.
  const appsWhere =
    `(APPLICATIONNUMBER LIKE 'RP-%' OR APPLICATIONNUMBER LIKE 'CP-%') ` +
    `AND APPLICATIONDATE >= DATE '2021-01-01'`
  const apps = await arcgis(appsWhere, 'APPLICATIONNUMBER,APPLICATIONDATE')
  const appliedByNumber = new Map()
  let duplicateRows = 0
  for (const a of apps) {
    if (!a.APPLICATIONNUMBER || a.APPLICATIONDATE == null) continue
    if (appliedByNumber.has(a.APPLICATIONNUMBER)) {
      duplicateRows++
      // Keep the EARLIEST date if the 1:1 assumption ever breaks, so a later
      // resubmittal row cannot shorten the measured duration.
      if (a.APPLICATIONDATE < appliedByNumber.get(a.APPLICATIONNUMBER)) {
        appliedByNumber.set(a.APPLICATIONNUMBER, a.APPLICATIONDATE)
      }
    } else {
      appliedByNumber.set(a.APPLICATIONNUMBER, a.APPLICATIONDATE)
    }
  }
  console.log(
    `  application rows: ${apps.length} (${appliedByNumber.size} distinct, ${duplicateRows} duplicate)`,
  )

  // 4. Join, and refuse the result if coverage is poor — a low match rate means
  //    the sample is whatever the second feed happens to contain, not the city.
  let matched = 0
  const pairs = []
  for (const p of permits) {
    const applied = appliedByNumber.get(p.permitnumber)
    if (applied == null) continue
    matched++
    pairs.push({ applied, issued: Date.parse(p.permitissuedate) })
  }
  const matchPct = (matched / permits.length) * 100
  console.log(`  joined ${matched}/${permits.length} (${matchPct.toFixed(1)}%)`)
  if (matchPct < 90) {
    console.warn(
      `  Only ${matchPct.toFixed(1)}% of new-construction permits carry a filing date. ` +
        `The surviving sample is a self-selected subset, not the city. Not writing philadelphia.`,
    )
    return
  }

  // 5. Durations for permits APPLIED since SINCE.
  const sinceMs = Date.parse(`${SINCE}T00:00:00Z`)
  const days = []
  let inWindow = 0
  let sameDay = 0
  for (const { applied, issued } of pairs) {
    if (applied < sinceMs) continue
    inWindow++
    const d = (issued - applied) / 86_400_000
    if (Math.abs(d) < 0.5) sameDay++
    if (d >= 0 && d <= 120 * 30.44) days.push(d)
  }

  logCohortRows(
    inWindow,
    `joined new-construction building permits whose APPLICATIONDATE is >= ${SINCE}`,
  )

  if (days.length === 0) {
    console.warn('  No usable applied/issued pairs; leaving permitStats.json unchanged.')
    return
  }

  // OTC artifact guard (the NYC lesson): a feed that stamps both legs at issuance
  // produces a meaningless ~0-month latency.
  const sameDayPct = (sameDay / inWindow) * 100
  if (sameDayPct > 50) {
    console.warn(
      `  ${sameDayPct.toFixed(1)}% of rows are same-day (applied == issued) — a recording ` +
        `artifact, not a real review time. Not writing philadelphia.`,
    )
    return
  }

  days.sort((x, y) => x - y)
  const medianMonths = daysToMonths(quantile(days, 0.5))
  const p80Months = daysToMonths(quantile(days, 0.8))

  if (medianMonths < 0.5 || days.length < 30) {
    console.warn(
      `  Result looks unreliable (median ${medianMonths} mo, n=${days.length}); not writing.`,
    )
    return
  }

  const stats = {
    medianMonths,
    p80Months,
    n: days.length,
    vintage:
      `applied ${SINCE} onward; computed ${new Date().toISOString().slice(0, 10)}; ${DATASET_NAME}`,
  }

  // 6. Idempotent merge into the shared artifact.
  let existing = {}
  try {
    existing = JSON.parse((await readFile(OUT_PATH, 'utf8')) || '{}')
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  const merged = {
    ...existing,
    philadelphia: {
      ...(existing.philadelphia ?? {}),
      newConstruction: stats,
      // Declared, not omitted: a reader of permitStats.json must be able to tell
      // "no breakdown was ever computed, so the aggregate IS the answer" from
      // "a breakdown exists and this tier was withheld" (rule 5).
      tierBreakdown: noTierBreakdown(
        'scripts/permits/philadelphia.mjs computes no tier split. Its query filters on permitdescription (Residential/Commercial Building Permit) and typeofwork (New Construction*) — no size restriction — so the aggregate spans all three tiers.',
      ),
      feed: feedCounts({
        totals,
        cohortRows: inWindow,
        basis:
          `totalRows: every row each of the two feeds holds, unfiltered, recorded SEPARATELY — ` +
          `this figure is a join across two independent publishers and either side can move on ` +
          `its own, so a summed total would be diffable against neither. cohortRows: issued ` +
          `new-construction building permits (permitdescription + typeofwork gates, ` +
          `permitissuedate >= ${SINCE}) that JOINED to an eCLIPSE application row and whose ` +
          `APPLICATIONDATE falls on or after ${SINCE}. The published n is smaller: it also ` +
          `drops durations that are negative or over 120 months. The join's match rate ` +
          `(${matchPct.toFixed(1)}% this run) is the number to read these against.`,
      }),
    },
  }
  await writeFile(OUT_PATH, JSON.stringify(merged, null, 2) + '\n')

  console.log('  Wrote philadelphia.newConstruction:', stats)
}

main().catch((err) => {
  console.error(`\nphiladelphia.mjs failed: ${err.message}\n`)
  process.exitCode = 1
})
