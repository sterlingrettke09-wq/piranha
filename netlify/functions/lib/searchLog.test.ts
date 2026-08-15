import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// WHAT THIS FILE DEFENDS
//
// The search log is the ONLY evidence this project has about whether anyone
// uses it. Its schema has ten fields and both writers matter, so the failure
// worth guarding is not "the log is empty" — it is a field that quietly stops
// being written while the log keeps looking healthy.
//
// The concrete instance: `analyze.ts` wrote nine of the ten fields but never
// stamped `kind`, while `log-search.ts` stamped `kind: 'lookup'`. A full
// analysis was therefore distinguishable from a map lookup only by noticing
// that `verdict` happened to be present — an inference, not a record. The
// question "how many people ran an analysis" had no direct answer.
//
// These are SOURCE-TEXT assertions on purpose. The writers are handler
// internals reached only through a live Netlify Blobs store, and a test that
// mocked its way to them would be asserting against the mock.

const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

const SCHEMA = read('./searchLog.ts')
const ANALYZE = read('../analyze.ts')
const LOOKUP = read('../log-search.ts')
const ADMIN = read('../../../src/routes/Admin.tsx')

/** Every field the schema declares. Parsed from the interface rather than
 *  listed, so a field added tomorrow is covered without anyone enrolling it. */
const SCHEMA_FIELDS = (() => {
  const body = /export interface SearchEntry \{([\s\S]*?)\n\}/.exec(SCHEMA)?.[1] ?? ''
  return [...body.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1])
})()

describe('the schema is readable and non-empty (rule 20)', () => {
  it('parses every declared field', () => {
    // If this regex ever stops matching, every assertion below would pass over
    // an empty set — the exact shape rule 20 is about.
    expect(SCHEMA_FIELDS.length).toBe(10)
    expect(SCHEMA_FIELDS).toEqual([
      'ts', 'city', 'address', 'kind', 'use', 'projectType', 'gfa', 'units', 'verdict', 'months',
    ])
  })
})

describe('both writers stamp `kind`, so the two paths stay separable', () => {
  it('the analysis path records kind: analysis', () => {
    expect(ANALYZE).toContain("kind: 'analysis'")
  })

  it('the lookup path records a kind too', () => {
    expect(LOOKUP).toMatch(/kind/)
  })

  it('the two paths use different values', () => {
    // Both stamping the same string would satisfy the assertions above while
    // leaving the question they exist to answer unanswerable.
    expect(ANALYZE).toContain("'analysis'")
    expect(LOOKUP).not.toContain("kind: 'analysis'")
  })
})

describe('the analysis writer records the fields it has', () => {
  // `kind` aside, these are the fields only the analysis path can know. A
  // regression here is silent: the log keeps writing rows and the columns just
  // go blank.
  it.each(['use', 'projectType', 'gfa', 'units', 'verdict', 'months'])('writes %s', (field) => {
    const call = /await logSearch\(\{([\s\S]*?)\n {2}\}\)/.exec(ANALYZE)?.[1] ?? ''
    expect(call.length, 'the logSearch call could not be located').toBeGreaterThan(50)
    expect(call).toContain(`${field}`)
  })
})

describe('the admin export carries every field the log can hold', () => {
  // The log is only worth writing if it can be read. A field that is recorded
  // but never exported is invisible to the only person who looks at it.
  it.each(['ts', 'city', 'address', 'use', 'projectType', 'gfa', 'units', 'verdict', 'months'])(
    'exports %s',
    (field) => {
      expect(ADMIN).toContain(`e.${field}`)
    },
  )

  // `kind` is the column the whole fix exists for: without it the download
  // cannot answer how many people ran an analysis rather than a lookup.
  it('exports kind, and names it in the header row', () => {
    expect(ADMIN).toContain('e.kind')
    expect(ADMIN).toMatch(/head = \[[^\]]*'kind'/)
  })
})
