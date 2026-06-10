import { describe, it, expect } from 'vitest'
import type { CheckStatus } from '../types/analysis'
import { VERDICT, CHECKLIST_LABEL, VERIFY_NOTE } from './verdictLabels'

const STATUSES: CheckStatus[] = ['AS_OF_RIGHT', 'NEEDS_RELIEF', 'PROHIBITED', 'INDETERMINATE']

describe('verdictLabels', () => {
  it('softens the PROHIBITED headline (WO-4.3)', () => {
    expect(VERDICT.PROHIBITED.headline).toBe('This likely can’t be built as proposed.')
    // The old flat "You can't build this here." must be gone.
    expect(VERDICT.PROHIBITED.headline).not.toContain('You can’t build this here')
  })

  it('pins the four canonical headlines', () => {
    expect(VERDICT.AS_OF_RIGHT.headline).toBe('You can likely build this.')
    expect(VERDICT.NEEDS_RELIEF.headline).toBe('Buildable, with the city’s permission.')
    expect(VERDICT.INDETERMINATE.headline).toBe('We can’t tell from the public data.')
  })

  it('pins the compact one-liners used by Compare / Admin', () => {
    expect(VERDICT.AS_OF_RIGHT.short).toBe('Likely buildable')
    expect(VERDICT.NEEDS_RELIEF.short).toBe('Needs city permission')
    expect(VERDICT.PROHIBITED.short).toBe('Likely not allowed')
    expect(VERDICT.INDETERMINATE.short).toBe('Can’t tell')
  })

  it('embeds the verify-with-the-city note in the at-risk sub-lines', () => {
    expect(VERDICT.PROHIBITED.sub).toContain(VERIFY_NOTE)
    expect(VERDICT.NEEDS_RELIEF.sub).toContain(VERIFY_NOTE)
    // Not added where the verdict is a clean pass or unknowable.
    expect(VERDICT.AS_OF_RIGHT.sub).not.toContain(VERIFY_NOTE)
    expect(VERDICT.INDETERMINATE.sub).not.toContain(VERIFY_NOTE)
  })

  it('defines every field for all four statuses', () => {
    for (const s of STATUSES) {
      expect(VERDICT[s].headline.length).toBeGreaterThan(0)
      expect(VERDICT[s].sub.length).toBeGreaterThan(0)
      expect(VERDICT[s].short.length).toBeGreaterThan(0)
      expect(VERDICT[s].word.length).toBeGreaterThan(0)
      expect(CHECKLIST_LABEL[s].length).toBeGreaterThan(0)
    }
  })

  it('preserves the per-dimension checklist vocabulary', () => {
    expect(CHECKLIST_LABEL.AS_OF_RIGHT).toBe('Within limits')
    expect(CHECKLIST_LABEL.NEEDS_RELIEF).toBe('Over the limit')
    expect(CHECKLIST_LABEL.PROHIBITED).toBe('Conflict')
    expect(CHECKLIST_LABEL.INDETERMINATE).toBe('No data')
  })
})
