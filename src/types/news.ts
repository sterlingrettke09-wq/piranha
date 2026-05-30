export type Jurisdiction =
  | 'federal'
  | 'state'
  | 'boston'
  | 'nyc'
  | 'sf'
  | 'seattle'
  | 'chicago'

export type NewsCategory = 'zoning' | 'permitting' | 'tax' | 'incentive' | 'tenant' | 'other'

export interface NewsItem {
  id: string
  date: string // YYYY-MM-DD — when the event happened
  jurisdiction: Jurisdiction
  category: NewsCategory
  headline: string // original wording, never copied
  summary: string // 2-3 sentences, original wording
  why_it_matters: string // 1 sentence
  source_name: string
  source_url: string
  published_date: string // when we added it
}
