// Regenerate docs/NULL-INVENTORY.md from LIVE probes.
//
// WHY THIS IS A SCRIPT AND NOT A DOCUMENT
// The inventory is a measurement of the system, and a hand-written one drifts
// from it. Within a single session (2026-08-04 → 05) three entries went stale:
// Chicago was recorded unresolved while B3-2 resolves, San Diego's probe
// coordinate was a landmark rather than a parcel, and Philadelphia's RM
// districts began resolving once the FAR parser was fixed.
//
// That matters more than it sounds. The inventory determines what work is worth
// doing — a wrong entry misdirects the whole backlog. It is the same failure as
// measuring your probe instead of the pipeline (CLAUDE.md rule 11), one level up.
//
// Every entry carries the timestamp it was verified. An inventory without
// timestamps cannot tell you which parts of it you still trust.
//
//   npx vite-node scripts/null-inventory.ts          # print
//   npx vite-node scripts/null-inventory.ts --write  # rewrite the doc

import { writeFileSync } from 'node:fs'
import { getParcelInfo } from '../netlify/functions/lib/parcel'
import { buildDefaultSpec } from '../src/lib/defaultSpec'
import { assessFeasibility } from '../netlify/functions/lib/feasibility'
import { EXAMPLE_PARCELS } from '../src/config/exampleParcels'

/** Probe points for cities without a published example parcel. Chosen to land on
 *  a real parcel — a city landmark is often a street or a plaza (San Diego's
 *  first probe returned NO_PARCEL for exactly that reason). */
const EXTRA: Record<string, [number, number]> = {
  // Derived from a DOR_Parcel centroid, not guessed. The previous point
  // (39.97, -75.17) returned NO_PARCEL on two of three isolated re-probes and a
  // valid RSA-5 parcel on the third — an unstable probe reads as an upstream
  // defect when it is really a coordinate sitting off a parcel edge.
  philadelphia: [39.9208, -75.23192],
  miami: [25.7743, -80.1918],
  sandiego: [32.7157, -117.1611],
  sanjose: [37.3382, -121.8863],
  nashville: [36.1627, -86.7816],
}

const CITIES = [
  'boston', 'nyc', 'chicago', 'sf', 'seattle', 'dc', 'austin', 'la',
  'denver', 'minneapolis', 'philadelphia', 'miami', 'sandiego', 'sanjose', 'nashville',
]

interface Row {
  city: string
  district: string
  farBasis: string
  gfaBasis: string
  verdict: string
  outcome: string
  note: string
}

/** Rule 10: a single probe is not evidence. Retry in isolation before recording
 *  a failure — Chicago returned `Unknown` once under concurrent batch load and
 *  resolved to B3-2 on three consecutive isolated re-probes. */
async function probe(city: string, lat: number, lng: number, attempts = 3) {
  let last: unknown = null
  for (let i = 0; i < attempts; i++) {
    const r = await getParcelInfo(city, lat, lng)
    if (r.ok && r.info.zoning.districtCode !== 'Unknown') return r
    last = r
    await new Promise((res) => setTimeout(res, 400))
  }
  return last as Awaited<ReturnType<typeof getParcelInfo>>
}

;(async () => {
  const stamp = new Date().toISOString().slice(0, 10)
  const rows: Row[] = []

  for (const city of CITIES) {
    const ex = EXAMPLE_PARCELS[city]
    const [lat, lng] = ex ? [ex.lat, ex.lng] : EXTRA[city]
    const r = await probe(city, lat, lng)
    if (!r || !r.ok) {
      rows.push({ city, district: '—', farBasis: '—', gfaBasis: '—', verdict: '—',
        outcome: 'PROBE FAILED', note: 'not a pass — re-run before trusting' })
      continue
    }
    const env = r.info.envelope
    const spec = buildDefaultSpec(r.info, city)
    const verdict = spec ? assessFeasibility(r.info, spec).overall : 'n/a'
    const farBasis = env?.farBasis ?? 'null'
    const gfaBasis = spec?.gfaBasis ?? 'no-spec'

    const outcome =
      gfaBasis === 'envelope' ? 'RESOLVED'
      : gfaBasis === 'assumed-unconstrained' ? 'UNCONSTRAINED (an answer)'
      : 'GAP — verdict withheld'
    const note =
      gfaBasis === 'envelope' ? `FAR ${r.info.zoning.maxFAR ?? '(per-use)'} from published data`
      : gfaBasis === 'assumed-unconstrained' ? 'code affirmatively imposes no FAR; lot area is a placeholder'
      : 'no FAR resolvable; cost/timeline still estimated and disclosed'

    rows.push({ city, district: String(r.info.zoning.districtCode).slice(0, 22), farBasis, gfaBasis, verdict, outcome, note })
  }

  const resolved = rows.filter((r) => r.gfaBasis === 'envelope').length
  const unc = rows.filter((r) => r.gfaBasis === 'assumed-unconstrained').length
  const gaps = rows.filter((r) => r.gfaBasis === 'assumed-far-1.0').length
  const failed = rows.filter((r) => r.outcome === 'PROBE FAILED').length

  const md = `# Null inventory — what the tool actually knows

**GENERATED, not hand-written.** Run \`npx vite-node scripts/null-inventory.ts --write\`.
Every entry below was verified live on the date shown.

A hand-maintained version of this file drifted from the system inside a single
session: Chicago sat recorded as unresolved while \`B3-2\` resolves, San Diego's
probe coordinate was a landmark rather than a parcel, and Philadelphia's RM
districts started resolving once the FAR parser was corrected. **The inventory
determines what work is worth doing, so a stale entry misdirects the backlog** —
the same failure as measuring your probe instead of the pipeline (rule 11), one
level up.

**This is the artifact that says whether the tool is fit to ship — not the test
count.** 709 tests pass whether a city resolves a FAR or assumes one.

## Verified ${stamp}

| City | District probed | Outcome | Verdict | What it means |
|---|---|---|---|---|
${rows.map((r) => `| ${r.city} | \`${r.district}\` | **${r.outcome}** | ${r.verdict} | ${r.note} |`).join('\n')}

**${resolved} resolved from published data · ${unc} unconstrained (an answer) · ${gaps} gaps · ${failed} probe failures.**

## What a "gap" costs the user, post fail-closed audit

A gap no longer produces a confident claim. On \`assumed-far-1.0\`:

- **Verdict is withheld** — INDETERMINATE, not AS_OF_RIGHT. The tool will not
  assert legal permission derived from a size the code never stated.
- **Size-triggered required hurdles are downgraded to \`info\`**, with the doubt
  named rather than the hurdle deleted.
- **Cost and timeline are still produced**, disclosed at the assumptions panel.
  They claim what building that much would cost, not what the code allows.

\`assumed-unconstrained\` is NOT a gap: the code affirmatively imposes no FAR
(SF Planning Code §124(b), Denver's form-based DZC), so verdicts and hurdles
stand and the lot-area figure is a placeholder under a stated absence.

## Known remaining gaps, by fix cost

| Reason | Cities | What it needs |
|---|---|---|
| \`published-not-fetched\` | dc (D/NC/ARTS/CG/PDR + MU-11…14) · seattle (NR + non-NC/C) · miami (Art. 4 Table 2) · sandiego (LDC tables) | research + a table |
| \`fetched-not-mapped\` | dc (\`IZ_Designation\` — inclusionary, published per polygon, never fetched) | wiring |
| \`fetched-not-mapped\` | minneapolis (Corridor/Transit/Core/Production — base FAR + earned premiums) | wiring, once Table 540-2 is read |
| \`not-published\` | sanjose · nashville | code-text extraction, or it stays null |

### Permit timing: \`not-published\` in four cities, and the queries are already written

Filing→issuance is measured from the city's own open-data portal for **11 of 15
cities**. It is NOT measurable in **Boston, DC, Minneapolis and San Jose** — those
four publish only issue-side dates. This is a fact about municipal data
transparency, not a gap in this pipeline, and it is the kind of thing a user of
this tool would want to know.

Absence was established the right way — by asking whether the schema has a SLOT
for an application date, not whether a row was blank — and every tempting
substitute was tested and rejected rather than assumed unusable:

| city | what it publishes | substitute tested and rejected |
|---|---|---|
| boston | \`issued_date\`, \`expiration_date\` | none available; confirmed 3 ways (datastore schema, raw CSV header, full row dump) |
| dc | \`ISSUE_DATE\` across all 8 year layers | \`CREATED_DATE\` is an identical ETL stamp on every row; \`LASTMODIFIEDDATE\` post-dates issuance |
| minneapolis | \`issueDate\`, \`completeDate\` | \`completeDate\` falls AFTER \`issueDate\` in **409 of 409** sampled records — the far side of the leg |
| sanjose | \`ISSUEDATE\`, \`FINALDATE\` | \`FINALDATE\` is final inspection — same trap |

**Do not re-do the filter work.** In DC, Minneapolis and San Jose the
new-construction filter is already identified and correct
(\`PERMIT_SUBTYPE_NAME = 'NEW BUILDING'\`, \`workType = 'New'\`,
\`WORKDESCRIPTION = 'New Construction'\`). If any of those cities adds an
application date, this becomes a config change, not research.

### Highest-ranked open item: DC's RA and MU provenance

**44 DC districts publish a FAR whose only source is a code comment.** Subtitles
F (RA) and G (MU) were not read when Subtitles D and E were, so those numbers
stand exactly where DC's no-FAR claims stood before Title 11 was opened — by
assertion.

Nothing regressed and this is not a defect. It ranks above the unread-overlay
question for one reason: **it affects numbers the tool currently publishes,
rather than verdicts it currently withholds.** A wrong published FAR reaches
cost, unit counts and fees; a withheld verdict reaches nobody.

### Philadelphia's remaining blanks — still gaps, deliberately

Ten residential districts (RSD-1/2/3, RSA-1…5, RTA-1/2, RM-1) are now verified
stated absences against the Feb 2026 Quick Guide. The other ten — CMX-2,
CMX-2.5, CA-1, CA-2, I-P, SP-INS, SP-ENT, SP-STA, SP-PO-A/P, SP-AIR — are NOT,
because those pages were not read. Two successful classifications are not a
licence to generalise the pattern to a district nobody has looked at.

### Resolved: Philadelphia's residential blanks

The city's \`ZoningCodeCharacteristics\` table carries 36 districts. 13 publish a
numeric FAR, 3 publish prose the parser cannot reduce to a number (\`RMX-1\` and
\`RMX-2\` say "150% / 250% of District Area (excluding streets)" — a different
denominator, not a FAR; \`CMX-1\` defers to adjacent districts), and **20 publish
no value at all** — including every RSA/RSD rowhouse district and \`RM-1\`, while
\`RM-2/3/4\` carry 0.7 / 1.5 / 3.5.

Whether those 20 blanks are a stated absence (the code governs them by occupied
area instead — the table's own \`MinPercent\` field) or an unfilled column is
**unresolved, and it is not resolvable by reading this table.** It matters:
\`unconstrained\` restores an AS_OF_RIGHT verdict, \`null\` withholds one. Deciding
it from the shape of the data would be exactly the mechanism-without-a-
measurement that rule 1 forbids. It needs §14-701 itself.

**Chicago is NOT on that list, and the reason is worth recording.** It was, on the
strength of an enumeration reporting 1,528 unhandled zone classes. That number was
an artifact: the script read \`.maxFAR\` off a resolver returning \`{ far, heightFt }\`,
so every value scored unhandled. Chicago resolves **63 classes** — the full by-right
B/C/D/M/RM/RS/RT ladder. Of the remainder, 1,457 are PD/PMD planned developments
with no by-right FAR (a stated absence) and 5 are POS/T parks, open space and
transportation (likewise). A backlog entry sized off a broken instrument is the
most expensive kind of wrong — it buys research nobody needed.

## Method

- One real parcel per city; published example parcels where they exist.
- **Each probe retried up to 3× in isolation** before a failure is recorded
  (rule 10 — Chicago returned \`Unknown\` once under concurrent load and resolved
  to \`B3-2\` on three consecutive isolated re-probes).
- Exercises the REAL entry point (\`getParcelInfo\` → \`computeEnvelope\` →
  \`buildDefaultSpec\` → \`assessFeasibility\`). An earlier attempt called
  \`resolveZoningLimits\` with \`maxFAR: null\`, bypassed every provider-side
  resolver, and reported "11/65 resolved" — it measured the probe, not the
  pipeline.
- A single probed parcel does not characterise a whole city. This table says
  what the pipeline returned for one real address, which is enough to separate
  "resolves" from "falls back" and not enough to quantify coverage.
`

  if (process.argv.includes('--write')) {
    writeFileSync('docs/NULL-INVENTORY.md', md)
    console.log(`wrote docs/NULL-INVENTORY.md — ${resolved} resolved · ${unc} unconstrained · ${gaps} gaps · ${failed} failed`)
  } else {
    console.log(md)
  }
})()
