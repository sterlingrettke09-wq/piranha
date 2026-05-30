import type { AnalysisResult } from '../../../types/analysis'

type Existing = NonNullable<AnalysisResult['parcel']['existing']>

/** True when the public record has a meaningful existing structure to show. */
export function hasExisting(existing: Existing | undefined): boolean {
  if (!existing) return false
  return Boolean(
    existing.landUse ||
      existing.yearBuilt ||
      existing.stories ||
      existing.units ||
      existing.buildingAreaSqFt ||
      (existing.numBuildings && existing.numBuildings > 1),
  )
}
