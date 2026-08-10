import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import {
  findOutcomeSelections,
  readPermitScripts,
  auditOutcomeSelection,
  formatAudit,
  stripComments,
  constBindings,
  OUTCOME_SELECTION_EXEMPTIONS,
} from './outcome-selection'

const PERMITS_DIR = dirname(fileURLToPath(import.meta.url))

// WHAT THIS TEST DEFENDS
//
// A permit script measures application -> issuance. If its cohort query carries
// `issued_date IS NOT NULL`, the server hands back only applications that issued,
// and "this city permits everything" is indistinguishable from "we only asked
// about permits". Three cities shipped a withdrawn figure behind that predicate.
//
// Nothing else in the repo can see it. It is a runtime template literal inside
// `.mjs`, so tsc never type-checks it, the linter has no view on string contents,
// and adding a city means copying the nearest script — so city 24 inherits
// whatever city 23 was carrying. This is the only check standing between the two.

describe('the detector catches the shape, not the spelling', () => {
  const at = (src: string) => findOutcomeSelections('x.mjs', src)

  it('catches both verbatim spellings that exist in this directory today', () => {
    // The two-line form (austin/miami; seattle and chicago carried it until
    // their 2026-08-09 removals) …
    const twoLine = [
      'const ISSUED_DATE_FIELD = "issue_date"',
      'const where =',
      '  `${TYPE_FIELD} = \'X\' ` +',
      '  `AND ${APPLIED_DATE_FIELD} IS NOT NULL ` +',
      '  `AND ${ISSUED_DATE_FIELD} IS NOT NULL`',
    ].join('\n')
    // … and the one-line form (dc/denver/minneapolis), same split, different keystrokes.
    const oneLine = [
      'const ISSUED_DATE_FIELD = "DATE_ISSUED"',
      'const where = `AND ${appliedField} IS NOT NULL AND ${ISSUED_DATE_FIELD} IS NOT NULL`',
    ].join('\n')

    expect(at(twoLine).map((f) => f.token)).toEqual(['ISSUED_DATE_FIELD'])
    expect(at(oneLine).map((f) => f.token)).toEqual(['ISSUED_DATE_FIELD'])
    // The applied-date limb is not the defect and must not be swept up with it.
    expect(at(twoLine)).toHaveLength(1)
  })

  it.each([
    ['bare snake_case', "const w = `AND issued_date IS NOT NULL`"],
    ['singular', "const w = `AND issue_date IS NOT NULL`"],
    ['no separator', "const w = `AND issueddate IS NOT NULL`"],
    ['prefixed literal', "const w = `AND permitissuedate IS NOT NULL`"],
    ['SCREAMING ArcGIS field', "const w = `AND ISSUE_DATE IS NOT NULL`"],
    ['camelCase', "const w = `AND issuedDate IS NOT NULL`"],
    ['issuance, not issued', "const w = `AND issuance_date IS NOT NULL`"],
    ['double-quoted CKAN identifier', 'const w = `AND "issued_date" IS NOT NULL`'],
    ['lower-case sql', "const w = `AND issue_date is not null`"],
    ['odd whitespace', "const w = `AND issue_date   IS    NOT   NULL`"],
  ])('catches the %s variant', (_name, src) => {
    expect(at(src)).toHaveLength(1)
  })

  it('follows a RENAMED constant to the literal it resolves to', () => {
    // The failure mode a literal-matching test has: rename the constant and the
    // guard goes quiet while the query is unchanged. Neither the identifier nor
    // the surrounding text says "issued" here.
    const renamed = [
      "const OUTCOME_STAMP = 'issue_date'",
      'const where = `AND ${OUTCOME_STAMP} IS NOT NULL`',
    ].join('\n')
    const found = at(renamed)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ token: 'OUTCOME_STAMP', resolved: 'issue_date' })

    // …and through a second hop, since aliasing is the obvious next move.
    const aliased = [
      "const ISSUED_DATE_FIELD = 'issueddate'",
      'const OUTCOME = ISSUED_DATE_FIELD',
      'const where = `AND ${OUTCOME} IS NOT NULL`',
    ].join('\n')
    expect(at(aliased)).toHaveLength(1)
  })

  it('does not fire on the application-side limb, which is legitimate', () => {
    expect(at('const w = `AND applieddate IS NOT NULL`')).toEqual([])
    expect(at('const w = `AND ${FILED_DATE_FIELD} IS NOT NULL`')).toEqual([])
    expect(at('const w = `AND application_start_date IS NOT NULL`')).toEqual([])
  })

  it('does not fire on IS NULL, which is how a denominator gets measured', () => {
    // la.mjs asks the feed `issue_date IS NULL` precisely to find the rows the
    // old predicate was hiding. Flagging that would punish the fix.
    expect(at('const w = `${ISSUED_DATE_FIELD} IS NULL`')).toEqual([])
  })

  it('does not fire on the retraction notes that quote the predicate', () => {
    // sf.mjs, la.mjs, nyc.mjs and chicago.mjs all carry a comment naming
    // `issue_date IS NOT NULL` to record that it was REMOVED. A detector that
    // flagged those would make writing the retraction the thing that fails.
    const withNote = [
      '// ⚠️ NOTE WHAT IS *NOT* IN THIS WHERE CLAUSE: `issue_date IS NOT NULL`. It used',
      '// to be, and that is why this script could not see its own disqualifier.',
      '/* issued_date IS NOT NULL was here until 2026-08-09 */',
      'const where = `AND ${APPLIED_DATE_FIELD} IS NOT NULL`',
    ].join('\n')
    expect(at(withNote)).toEqual([])
  })

  it('strips comments without moving any line number', () => {
    const src = [
      '// a',
      "const KEPT = 'issue_date' /* b */",
      "// const COMMENTED = 'issue_date'",
      'const w = `AND issue_date IS NOT NULL`',
    ].join('\n')
    expect(stripComments(src)).toHaveLength(src.length)
    expect(at(src)[0].line).toBe(4)
    // A binding in live code is read; one inside a comment is not, or a
    // commented-out constant could quietly re-arm the resolver.
    expect(constBindings(src).get('KEPT')).toBe('issue_date')
    expect(constBindings(src).has('COMMENTED')).toBe(false)
  })

  it('reports the line of the real source, not of the glued text', () => {
    const src = [
      '#!/usr/bin/env node',
      "const ISSUED_DATE_FIELD = 'issue_date'",
      'const where =',
      '  `A ` +',
      '  `AND ${ISSUED_DATE_FIELD} IS NOT NULL`',
    ].join('\n')
    expect(at(src)[0].line).toBe(5)
  })
})

describe('the exemption registry is an explanation, not a mute button', () => {
  const entries = Object.entries(OUTCOME_SELECTION_EXEMPTIONS)

  it('demands a written reason on every entry', () => {
    for (const [file, ex] of entries) {
      // Long enough that "issued-only" alone cannot pass for one.
      expect(ex.reason.length, `${file}: reason too short to be a reason`).toBeGreaterThan(200)
      // When was this established? An undated claim cannot go stale, which is
      // exactly what makes it dangerous (ledger rule 7).
      expect(ex.reason, `${file}: reason cites no date`).toMatch(/20\d\d-\d\d-\d\d/)
    }
  })

  it('demands a measured share on a known-defect entry, so a defect cannot hide as a clearance', () => {
    for (const [file, ex] of entries.filter(([, e]) => e.basis === 'known-defect')) {
      expect(ex.reason, `${file}: a known defect must carry its measured size`).toMatch(/\d+(\.\d+)?%/)
      expect(ex.reason, `${file}: a known defect must say it is not a clearance`).toMatch(/NOT A CLEARANCE/)
    }
  })

  it('demands a perturbation, not a dataset title, behind an issued-only claim', () => {
    // Rule 2: a title argues, a with/without count discriminates. Every
    // issued-only entry has to show it ran the cohort filter both ways.
    for (const [file, ex] of entries.filter(([, e]) => e.basis === 'issued-only-feed')) {
      expect(ex.reason, `${file}: no measured with/without comparison`).toMatch(
        /both ways|with (?:it|the limb) and|with the limb and|vs |hides 0|hidden/i,
      )
      expect(ex.reason, `${file}: no row counts`).toMatch(/\d{2,}/)
    }
  })

  it('rejects an exemption whose file no longer carries the predicate', () => {
    // A licence outliving the thing it licensed is how the next clone inherits
    // permission. Removing a predicate must force removing its exemption.
    const clean = [{ file: 'ghost.mjs', source: 'const w = `AND applieddate IS NOT NULL`\n' }]
    const audit = auditOutcomeSelection(clean, {
      'ghost.mjs': { basis: 'unreachable', reason: 'x'.repeat(300) + ' 2026-08-09' },
    })
    expect(audit.stale).toEqual(['ghost.mjs (no longer carries it)'])
    expect(formatAudit(audit)).toContain('stale exemption')
  })

  it('fails an unexplained new carrier — city 24 inheriting the clone', () => {
    const city24 = [
      { file: 'dallas.mjs', source: "const w = `AND ${ISSUED_DATE_FIELD} IS NOT NULL`\n" },
    ]
    const audit = auditOutcomeSelection(city24, {})
    expect(audit.unexempted).toHaveLength(1)
    expect(formatAudit(audit)).toContain('dallas.mjs:1')
  })
})

describe('the real scripts/permits tree', () => {
  const files = readPermitScripts(PERMITS_DIR)

  it('reads every .mjs in the directory, so nothing is scanned by hope', () => {
    // A sweep that silently globbed nothing would pass forever. Rule 11: the
    // instrument gets measured before its answer is believed.
    expect(files.length).toBeGreaterThanOrEqual(15)
    expect(files.map((f) => f.file)).toContain('chicago.mjs')
    expect(files.every((f) => f.source.length > 0)).toBe(true)
  })

  it('has no query selecting on the outcome it measures, and no stale exemption', () => {
    // Everything is collected before asserting: the point of this check is to
    // show the SPREAD, and a report that stopped at the first offender would
    // make a directory-wide pattern look like one file's mistake.
    expect(formatAudit(auditOutcomeSelection(files))).toBe('')
  })

  it('keeps chicago.mjs clean — the removal this guard was built around', () => {
    const chicago = files.find((f) => f.file === 'chicago.mjs')!
    expect(findOutcomeSelections(chicago.file, chicago.source)).toEqual([])
    // The retraction note stays. Rule 17: a removal that is not written down
    // where the next reader lands gets re-added by the next clone.
    expect(chicago.source).toContain('NOTE WHAT IS *NOT* IN THIS WHERE CLAUSE')
  })

  it('keeps every city whose predicate was removed clean', () => {
    // sf/la were fixed before this guard existed; nyc and seattle were removed
    // 2026-08-09 with their withdrawals — seattle by this guard's own exemption
    // measurement. Each must stay clean AND carry its retraction note (rule 17:
    // a removal that is not written down where the next reader lands gets
    // re-added by the next clone).
    for (const name of ['sf.mjs', 'la.mjs', 'nyc.mjs', 'seattle.mjs']) {
      const f = files.find((x) => x.file === name)!
      expect(findOutcomeSelections(f.file, f.source), name).toEqual([])
    }
    const seattle = files.find((x) => x.file === 'seattle.mjs')!
    expect(seattle.source).toContain('NOTE WHAT IS *NOT* IN THIS WHERE CLAUSE')
  })
})
