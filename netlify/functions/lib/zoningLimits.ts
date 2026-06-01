// SEED HEURISTICS — Boston zoning, labeled estimates. Tune here.
// Boston subdistrict codes often encode the height limit as the trailing
// number, e.g. "B-2-65" => 65 ft. Family (leading letters) maps to seed
// FAR and allowed uses. Unknowns return null -> feasibility INDETERMINATE.
import type { Use } from '../../../src/types/analysis'

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
  if (c.startsWith('OS')) return 'OS'
  const m = c.match(/^[A-Z]/)
  return m ? m[0] : null
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
  const boston = city === 'boston'
  const fam = boston ? family(zoning.districtCode) : null
  return {
    maxFAR: zoning.maxFAR ?? (fam ? FAMILY_FAR[fam] ?? null : null),
    maxHeightFt: zoning.maxHeightFt ?? (boston ? parseHeight(zoning.districtCode) : null),
    allowedUses: (zoning.allowedUses as Use[] | null) ?? (fam ? FAMILY_USES[fam] ?? null : null),
  }
}
