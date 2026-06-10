// SEED HEURISTICS — Boston zoning, labeled estimates. Tune here.
// Boston subdistrict codes often encode the height limit as the trailing
// number, e.g. "B-2-65" => 65 ft. Family (leading letters) maps to seed
// FAR and allowed uses. Unknowns return null -> feasibility INDETERMINATE.
import type { Use } from '../../../src/types/analysis'
import { resolveChicago } from './zoning/chicago'
import { resolveDenver } from './zoning/denver'
import { resolveNyc } from './zoning/nyc'
import { resolveSeattle } from './zoning/seattle'

export interface ResolvedLimits {
  maxFAR: number | null
  maxHeightFt: number | null
  allowedUses: Use[] | null
}

const FAMILY_FAR: Record<string, number> = {
  R: 1.0, // residential
  S: 0.5, // single-family / suburban
  B: 2.0, // business
  C: 4.0, // commercial / downtown
  I: 2.0, // industrial
  OS: 0.1, // open space
}

const FAMILY_USES: Record<string, Use[]> = {
  R: ['residential'],
  S: ['residential'],
  B: ['commercial', 'mixed', 'residential'],
  C: ['commercial', 'mixed', 'residential', 'institutional'],
  I: ['commercial', 'institutional'],
  OS: ['institutional'],
}

function family(code: string): string | null {
  const c = code.toUpperCase().trim()
  if (/^OS(-|\b|$)/.test(c)) return 'OS'
  // Only treat this as a Boston zoning code (e.g. "B-2-65", "C-3", "R-1") when a
  // known family letter is followed by a dash, digit, or end. Otherwise a
  // word-named subdistrict like "CHARLESTOWN NAVY YARD SUBDISTRICT" would match
  // its first letter ("C") and fabricate a FAR + use list out of nothing.
  const m = c.match(/^([RSBCI])(?:[-\d]|$)/)
  return m ? m[1] : null
}

function parseHeight(code: string): number | null {
  const m = code.match(/-(\d{2,3})(?:\D|$)/)
  if (!m) return null
  const n = Number(m[1])
  return n >= 20 && n <= 700 ? n : null
}

export function resolveZoningLimits(
  zoning: {
    districtCode: string
    maxFAR: number | null
    maxHeightFt: number | null
    allowedUses: string[] | null
  },
  // The family/height heuristics below are Boston district-code conventions, so
  // they only apply to Boston. Other cities supply their own values via their
  // provider (or leave them null → honestly "not in public data").
  city: string = 'boston',
): ResolvedLimits {
  // Per-city curated district tables (WO-8.8 depth program) sit BETWEEN provider
  // data (which always wins when non-null) and the Boston family heuristics.
  // They only contribute FAR/height the provider left null — sourced municipal
  // figures, never guesses (see netlify/functions/lib/zoning/<city>.ts).
  const table = cityTableLimits(city, zoning.districtCode)

  const boston = city === 'boston'
  const fam = boston ? family(zoning.districtCode) : null
  return {
    maxFAR: zoning.maxFAR ?? table.far ?? (fam ? FAMILY_FAR[fam] ?? null : null),
    maxHeightFt: zoning.maxHeightFt ?? table.heightFt ?? (boston ? parseHeight(zoning.districtCode) : null),
    allowedUses: (zoning.allowedUses as Use[] | null) ?? (fam ? FAMILY_USES[fam] ?? null : null),
  }
}

// Consult the per-city curated zoning table for FAR/height. Returns nulls for
// any city without a table (or any district not in it) so the resolver falls
// through to the next layer unchanged.
function cityTableLimits(
  city: string,
  districtCode: string,
): { far: number | null; heightFt: number | null } {
  switch (city) {
    case 'chicago':
      return resolveChicago(districtCode)
    case 'denver':
      return resolveDenver(districtCode)
    case 'nyc':
      // NYC: provider farByUse (MapPLUTO) wins for FAR; this only fills the
      // height left null by PLUTO, and only for contextual districts (ZR 23-662).
      return resolveNyc(districtCode)
    case 'seattle':
      // Seattle: provider derives height from the suffix; this only fills the
      // NC/C FAR left null by the zoning feed (SMC 23.47A.013 Table A).
      return resolveSeattle(districtCode)
    default:
      return { far: null, heightFt: null }
  }
}
