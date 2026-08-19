/**
 * Cumming Group Market Analysis Q4 2025 — "Location Cost Impact" per-city
 * construction cost ranges, stored as DATA.
 *
 * ⚠️ WHY THIS FILE EXISTS. The 2026-08-05 corroboration of the cost constants
 * recorded its CONCLUSION — "inside Cumming's published range for 3 of 9 cities"
 * — and not the ranges it was drawn from. When the constants were re-keyed by
 * product on 2026-08-19 and the check needed re-running, it could not be: the
 * only way to re-examine the claim was to re-obtain the source. A corroboration
 * whose data was never stored is a claim, not a check.
 *
 * So: the ranges, not the verdict. Anything derived from them is computed at test
 * time from these numbers.
 *
 * SOURCE, verified 2026-08-19:
 *   Cumming Group, Market Analysis Q4 2025, "Location Cost Impact — Typical
 *   Construction Cost Range, Cost Per Unit 2025".
 *   https://cumming-group.com/wp-content/uploads/2025/12/CummingGroup_Q4_2025_MarketingAnalysis_2.13.26.pdf
 *   (2,247,549 bytes, byte-identical to Content-Length at download.)
 *
 * SCOPE, quoted from the table's own notes — this is what makes it comparable to
 * our `hard` line and nothing else:
 *   "Costs represent current construction costs only. Land acquisition,
 *    professional fees, permits, FF&E and soft costs are not included."
 *   "Costs represent new-build projects for complete structure shell and interior
 *    build-out to five feet out and excludes sitework."
 *   "Costs represent typical specifications for the region identified, and do not
 *    account for unique site conditions."
 *
 * ⚠️ TEN CITIES, NOT NINE. The earlier note said "9 cities" throughout. The table
 * carries ten; Washington DC was the one missing from the count. The recorded
 * percentages were otherwise accurate — Denver's worst-case shortfall reproduces
 * at −9.0% — so the old summary was right and merely un-re-runnable.
 */

/** City slugs as used by `cityCostIndex`, in the table's own column order. */
export const CUMMING_Q4_2025_CITIES = [
  'boston',
  'chicago',
  'dallas',
  'denver',
  'la',
  'nashville',
  'nyc',
  'sf',
  'seattle',
  'dc',
] as const

export type CummingCity = (typeof CUMMING_Q4_2025_CITIES)[number]

/** [low, high] $/sq ft, in the column order above. Transcribed 2026-08-19. */
export const CUMMING_Q4_2025_RANGES: Readonly<Record<string, readonly (readonly [number, number])[]>> =
  Object.freeze({
    // "Residential — Market Grade Apartment". The row `apartment` is checked against.
    apartment: [
      [400, 590], [410, 590], [310, 450], [340, 490], [380, 560],
      [280, 410], [450, 650], [430, 620], [390, 560], [340, 500],
    ],
    // "Office — Shell & Core". The row `office` is checked against; a
    // complete-building rate is expected to sit between this and S&C + Tenant
    // Improvement, not inside S&C alone.
    officeShellCore: [
      [380, 470], [380, 470], [290, 360], [320, 390], [360, 450],
      [260, 330], [420, 520], [400, 500], [360, 450], [320, 400],
    ],
    // "Education — K-12 School". The row `institutional` is checked against.
    // Hospitals run far higher and are a known limitation of one bucket.
    k12School: [
      [480, 860], [480, 870], [370, 670], [400, 720], [450, 820],
      [330, 600], [530, 960], [500, 910], [460, 830], [400, 740],
    ],
    // "Office — Tenant Improvement". Stored so the "sits between Shell & Core and
    // S&C + Tenant Improvement" claim is recomputable too — it was previously
    // recorded as a conclusion with no numbers behind it, the same gap this file
    // exists to close.
    officeTenantImprovement: [
      [220, 450], [220, 450], [160, 340], [180, 370], [210, 430],
      [150, 310], [240, 500], [230, 470], [210, 430], [180, 380],
    ],
    // "Residential — Condominium". Not currently checked against anything; kept
    // because it was on the same row group and transcribing it once is cheaper
    // than re-obtaining the report to add it later.
    condominium: [
      [540, 820], [550, 830], [420, 630], [450, 690], [520, 780],
      [370, 570], [600, 910], [570, 870], [520, 790], [460, 700],
    ],
  })

/** The range for one city and product, or null if either is not in the table. */
export function cummingRange(product: string, city: string): readonly [number, number] | null {
  const i = (CUMMING_Q4_2025_CITIES as readonly string[]).indexOf(city)
  const row = CUMMING_Q4_2025_RANGES[product]
  if (i < 0 || !row) return null
  return row[i] ?? null
}
