// CLI for the parser-domain sweep — the instrument that finds values a parser
// does not handle. Targets, predicates and the gap classification live in
// scripts/lib/parserDomains.ts, which has no top-level effects.
//
//   npx vite-node scripts/enumerate-parser-domains.ts
//
// For what each gap is WORTH — the share of a city's zoning layer it covers —
// see scripts/parcel-weight.ts, which classifies with the same classify().

import { TARGETS, distinctValues, classify } from './lib/parserDomains'

async function main() {
  let surprises = 0
  let unreachable = 0
  for (const t of TARGETS) {
    const vals = await distinctValues(t.url, t.field)
    if (vals == null) {
      console.log(`\n${t.city}/${t.field}  — LAYER UNREACHABLE (not a pass; re-run)`)
      unreachable++
      continue
    }
    const c = classify(t, vals)
    const unhandled = [...c.excused, ...c.gaps]
    const pct = vals.length ? (100 * unhandled.length) / vals.length : 0
    console.log(`\n${t.city}/${t.field} — ${t.what}`)
    console.log(`  ${vals.length} distinct values · ${unhandled.length} unhandled (${pct.toFixed(1)}%)${t.scopedTo ? `  [scoped: ${t.scopedTo}]` : ''}`)
    if (unhandled.length) {
      console.log(`  unhandled: ${unhandled.slice(0, 24).join(' · ')}${unhandled.length > 24 ? ` …+${unhandled.length - 24}` : ''}`)
      if (!t.scopedTo) {
        // A PARTIAL scope subtracts only the values it names, and SAYS how many
        // — the composition, never a quietly smaller number (rule 26). A whole
        // target vanishing from the total is what the coarse flag above did.
        const ps = t.partiallyScoped
        const excused = c.excused
        if (ps) {
          console.log(
            `  of which ${excused.length} are declared out of scope (${ps.label}); ${unhandled.length - excused.length} count as gaps`,
          )
          // rule 20: a partial scope that stops matching would silently return
          // the target to its full count, which reads as a regression that never
          // happened. An empty exclusion means the predicate broke or the field
          // changed — either way it is not something to pass over in silence.
          if (excused.length === 0) {
            console.log(`  ⚠️ that partial scope matched NOTHING — the predicate or the field has drifted`)
            process.exitCode = 1
          }
        }
        surprises += unhandled.length - excused.length
      }
    }
  }
  console.log(`\n${'='.repeat(70)}`)
  // ⚠️ A TOTAL OVER A PARTIAL SET READS AS COMPLETE. Charlotte hit a transient
  // UNREACHABLE on one run and was silently dropped, so the total printed 715
  // instead of 751 — and the next run, with Charlotte back and Denver 16 codes
  // BETTER, printed 735. The number appeared to go UP after a fix. Nothing was
  // wrong except that a partial total wore the same format as a full one.
  //
  // Refuse to print it rather than footnote it: a figure that is only sometimes
  // the whole thing is worse than no figure, because the reader cannot tell
  // which run they are looking at (rule 20 — an empty or partial result and a
  // clean one must not render the same).
  if (unreachable > 0) {
    console.log(
      `NO TOTAL — ${unreachable} target(s) were unreachable this run, so any sum would be over a PARTIAL set.`,
    )
    console.log(`Re-probe those in isolation (rule 10) and re-run; transients have twice looked like findings.`)
    process.exitCode = 1
  } else {
    // ⚠️ NOT A DEFECT COUNT. It counts values the sweep cannot presently EXPLAIN,
  // which is a different quantity. This total has moved 2,294 → 1,009 → 1,010 →
  // 717 → 734 → 753 and NOT ONE movement was a code change — every one corrected
  // how the sweep counts. Until a parser fix moves it, the number measures the
  // instrument's correctness rather than the system's (rule 26).
  console.log(`UNEXPLAINED values (NOT a defect count — rule 26): ${surprises}`)
  console.log(`Reconcile the largest contributor against a known-good before acting on it.`)
  }
  console.log('Scoped parsers are EXPECTED to reject out-of-scope values — those')
  console.log('are gaps the null inventory already discloses, not parse failures.')
}

// ⚠️ GUARDED. This file used to run its whole live sweep as a side effect of
// being imported. parcel-weight.ts imports TARGETS and classify() from here —
// without this guard, importing the definitions would fire 23 live layer queries
// and print a second sweep in the middle of another tool's output.
void main()
