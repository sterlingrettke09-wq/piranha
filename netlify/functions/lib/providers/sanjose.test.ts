import { describe, it, expect } from 'vitest'
import { parseSanJoseHeightFt, sanJoseUsesForZone } from './sanjose'

// San Jose publishes HEIGHTLIMIT as free text on the height-limit layer. The
// prose strings below are verbatim from the live layer (recon 2026-08-03).
describe('parseSanJoseHeightFt', () => {
  it('parses a plain numeric height', () => {
    expect(parseSanJoseHeightFt('120')).toBe(120)
    expect(parseSanJoseHeightFt('150')).toBe(150)
    expect(parseSanJoseHeightFt(' 65 ft ')).toBe(65)
    expect(parseSanJoseHeightFt('45 feet')).toBe(45)
  })

  it('returns null for airport/FAA prose rather than inventing a limit', () => {
    // Downtown San Jose sits under the airport approach; these are the real
    // values the layer returns there.
    expect(parseSanJoseHeightFt('Determined by FAA')).toBeNull()
    expect(parseSanJoseHeightFt('Defined by Airspace Req')).toBeNull()
    expect(parseSanJoseHeightFt('Varies by district')).toBeNull()
    expect(parseSanJoseHeightFt('See Council Policy')).toBeNull()
    expect(parseSanJoseHeightFt('Per approved PD permit')).toBeNull()
  })

  it('returns null for empty / missing / absurd values', () => {
    expect(parseSanJoseHeightFt('')).toBeNull()
    expect(parseSanJoseHeightFt('   ')).toBeNull()
    expect(parseSanJoseHeightFt(null)).toBeNull()
    expect(parseSanJoseHeightFt(undefined)).toBeNull()
    expect(parseSanJoseHeightFt('0')).toBeNull()
    expect(parseSanJoseHeightFt('99999')).toBeNull()
  })
})

describe('sanJoseUsesForZone', () => {
  it('maps the codes seen live', () => {
    expect(sanJoseUsesForZone('R-1-8')).toEqual(['residential'])
    expect(sanJoseUsesForZone('A(PD)')).toContain('mixed')
    expect(sanJoseUsesForZone('CN')).toContain('commercial')
    expect(sanJoseUsesForZone('LI')).toContain('institutional')
    expect(sanJoseUsesForZone(null)).toBeNull()
  })
  it('treats Public/Quasi-Public as institutional (San Jose City Hall reads PQP)', () => {
    expect(sanJoseUsesForZone('PQP')).toEqual(['institutional'])
  })
})
