import { describe, it, expect } from 'vitest'
import { CITIES, CITIES_WITH_SPECIFIC_HURDLES, CITIES_WITH_MEASURED_PERMITS } from './cities'
// Vite-native rather than node:fs — `src` is typechecked without @types/node,
// and this is the same mechanism the ledger guard uses to read its own source.
import SRC from './cities.ts?raw'
const PERMIT_SCRIPTS = import.meta.glob('../../scripts/permits/*.mjs')

// ─── The deliberate-absence notes, anchored ─────────────────────────────────
//
// `cities.ts` carries prose notes above CITIES_WITH_SPECIFIC_HURDLES and
// CITIES_WITH_MEASURED_PERMITS naming cities that are DELIBERATELY absent, and
// saying why. They exist for a good reason — "absent from this list" would
// otherwise read as "checked and rejected" (rule 5) — but a note is a claim, and
// nothing was checking it.
//
// It went stale exactly the way every unanchored claim in this repo has. The
// permits note read "dallas, lasvegas and phoenix ... were not investigated at
// all. No permit feed was opened for any of them" AFTER all three had been
// investigated: Dallas has a pipeline that computes and refuses, Las Vegas and
// Phoenix are verified NOs from enumerated catalogues. The note was true when
// written and false by the time anyone read it.
//
// So: a city named in one of these notes must actually be absent from the list
// it sits above, and — for permits — must not have a script, because a script's
// existence is proof somebody investigated. Encoding a city FORCES the note to
// be rewritten in the same change. That is the same move as the coverage
// matrix's reason codes and `feedCounts.mjs`: replace an agreement between two
// places with something neither can disagree with.
const SLUGS = CITIES.map((c) => c.slug)

/** The `// ⚠️ …` comment block immediately preceding a given export. */
function noteAbove(exportName: string): string {
  const at = SRC.indexOf(`export const ${exportName}`)
  expect(at, `${exportName} not found`).toBeGreaterThan(-1)
  const before = SRC.slice(0, at)
  // Walk back over the contiguous run of `//` lines that ends at the export.
  const lines = before.split('\n')
  const out: string[] = []
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim()
    if (l === '' && out.length === 0) continue
    if (!l.startsWith('//')) break
    out.unshift(l)
  }
  return out.join('\n')
}

/**
 * Slugs named as DELIBERATELY ABSENT — i.e. appearing in a sentence that says
 * they are absent, not in the surrounding history. Scoped to the `⚠️` paragraph
 * that makes the absence claim, so the retained record of a city that USED to be
 * absent ("DALLAS WAS THE THIRD CITY IN THIS NOTE UNTIL …") does not count.
 */
function claimedAbsent(note: string): string[] {
  const paras = note.split(/\n\s*\/\/\s*\n/)
  const claiming = paras.filter(
    (p) => /⚠️/.test(p) && /\babsent\b|\bABSENT\b/.test(p) && !/UNTIL \d{4}-\d{2}-\d{2}/.test(p),
  )
  const hay = claiming.join('\n')
  return SLUGS.filter((s) => new RegExp(`\\b${s}\\b`).test(hay))
}

describe('the deliberate-absence notes cannot go stale', () => {
  it('every city the hurdles note calls absent is absent from the list', () => {
    const named = claimedAbsent(noteAbove('CITIES_WITH_SPECIFIC_HURDLES'))
    const contradictions = named.filter((s) =>
      (CITIES_WITH_SPECIFIC_HURDLES as readonly string[]).includes(s),
    )
    expect(
      contradictions,
      contradictions.length
        ? `\nThe note above CITIES_WITH_SPECIFIC_HURDLES still calls these cities ` +
          `deliberately absent, but they are ON the list: ${contradictions.join(', ')}.\n` +
          `Encoding a city's hurdles means rewriting that note in the same change — ` +
          `keep the record of why it was absent, but stop asserting it.`
        : '',
    ).toEqual([])
  })

  it('every city the permits note calls absent is absent from the list', () => {
    const named = claimedAbsent(noteAbove('CITIES_WITH_MEASURED_PERMITS'))
    const contradictions = named.filter((s) =>
      (CITIES_WITH_MEASURED_PERMITS as readonly string[]).includes(s),
    )
    expect(contradictions, `still called absent while on the list: ${contradictions.join(', ')}`).toEqual([])
  })

  // The sharper one, and the check that would have caught the live staleness:
  // the permits note's claim is not merely "absent" but "NOT INVESTIGATED — no
  // permit feed was opened". A script's existence disproves that directly.
  // Dallas's pipeline computes figures and refuses to write them; that is an
  // investigation with a finding, and the strongest possible contradiction of
  // "no slot test has been run".
  it('no city called UNINVESTIGATED has a permit script proving otherwise', () => {
    const note = noteAbove('CITIES_WITH_MEASURED_PERMITS')
    // Scope to the PARAGRAPH making the uninvestigated claim, not the whole
    // note. The note's other ⚠️ paragraphs record WITHDRAWALS — nyc, chicago,
    // sf, la — which are absent AND investigated, so matching note-wide reports
    // four false positives and buries the one real hit. That over-broad first
    // version is why this comment exists: a guard that flags everything gets
    // read as broken and then ignored.
    // Blocks are delimited by the ⚠️ marker itself, NOT by blank comment lines —
    // they run contiguously. Splitting on `//\n` matched the whole note as one
    // block and reported nyc (a withdrawal) alongside dallas (the real hit).
    const paras = note.split(/(?=\/\/ ⚠️)/)
    const uninvestigated = paras.filter((p) =>
      /not investigated|no permit feed was opened|no slot test/i.test(p),
    )
    if (uninvestigated.length === 0) return

    const hay = uninvestigated.join('\n')
    const named = SLUGS.filter((s) => new RegExp(`\\b${s}\\b`).test(hay))
    const haveScripts = new Set(
      Object.keys(PERMIT_SCRIPTS).map((f) => f.split('/').pop()!.replace(/\.mjs$/, '')),
    )
    const scripted = named.filter((s) => haveScripts.has(s))
    expect(
      scripted,
      scripted.length
        ? `\nThe note above CITIES_WITH_MEASURED_PERMITS says these cities were never ` +
          `investigated, but scripts/permits/<city>.mjs exists for: ${scripted.join(', ')}.\n` +
          `A script IS the investigation — one that refuses to publish is still a finding. ` +
          `Rewrite the note to say what was found.`
        : '',
    ).toEqual([])
  })

  // Rule 11 — the guard must not pass by finding nothing. If the notes stop
  // naming any city (because coverage reached 23/23 and they were removed), this
  // test should be deleted deliberately rather than sitting green and inert.
  it('the notes still name at least one city, or this guard is inert', () => {
    const named = [
      ...claimedAbsent(noteAbove('CITIES_WITH_SPECIFIC_HURDLES')),
      ...claimedAbsent(noteAbove('CITIES_WITH_MEASURED_PERMITS')),
    ]
    expect(
      named.length,
      'Neither note names a deliberately-absent city. If that is because every ' +
        'city is now covered, delete this describe block on purpose — do not ' +
        'leave a guard that can only pass.',
    ).toBeGreaterThan(0)
  })
})
