// Maps BPDA's zoning `Use_` subdistrict category to our project use vocabulary.
// Keyword-matched (case-insensitive) so it tolerates the many specific category
// strings BPDA uses (e.g. "Multifamily Residential", "Neighborhood Shopping").
// Returns null when the category is absent or unrecognized, so the caller falls
// back to the district-code heuristics in zoningLimits.ts rather than guessing.
import type { Use } from '../../../src/types/analysis'

export function mapZoningUse(use_: string | null | undefined): Use[] | null {
  if (use_ == null) return null
  const s = use_.trim().toLowerCase()
  if (s === '') return null

  // Order matters: "mixed-use" must be checked before the residential/commercial
  // keywords it contains conceptually.
  if (s.includes('mixed')) return ['mixed', 'residential', 'commercial']
  if (s.includes('institutional') || s.includes('community') || s.includes('civic') || s.includes('education') || s.includes('open space')) {
    return ['institutional']
  }
  if (s.includes('industrial')) return ['commercial', 'institutional']
  if (s.includes('residential') || s.includes('dwelling') || s.includes('family') || s.includes('housing')) {
    return ['residential']
  }
  if (s.includes('commercial') || s.includes('business') || s.includes('shopping') || s.includes('retail') || s.includes('office')) {
    return ['commercial', 'mixed']
  }
  return null
}
