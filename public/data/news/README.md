# Policy feed — how to add an item

The News page reads `feed.json` in this folder. It's a JSON **array** of items.

- **Empty array (`[]`) →** the page shows a "Coming soon" state.
- **One or more items →** the page shows them, newest first, with jurisdiction/topic filters.

To add an article you found, paste a new object into the array. Copy this template
and fill it in (write the headline/summary in your **own words** — never paste the
article's text):

```json
{
  "id": "unique-slug-2026",
  "date": "2026-05-01",
  "jurisdiction": "nyc",
  "category": "zoning",
  "headline": "Short headline in your own words",
  "summary": "Two or three sentences, in your own words, on what changed.",
  "why_it_matters": "One sentence: why this changes what you can build.",
  "source_name": "Publication or agency name",
  "source_url": "https://link-to-the-original",
  "published_date": "2026-05-29"
}
```

Field notes:

- `id` — any unique string (used as the React key).
- `date` — `YYYY-MM-DD`, when the event happened. Drives sort order (newest first) and the date shown on the card.
- `jurisdiction` — one of: `federal`, `state`, `boston`, `nyc`, `sf`, `seattle`, `chicago`.
- `category` — one of: `zoning`, `permitting`, `tax`, `incentive`, `tenant`, `other`.
- `published_date` — `YYYY-MM-DD`, the day you added it.

Multiple items are comma-separated inside the `[ ... ]`. Example with two:

```json
[
  { "id": "a", "date": "2026-05-01", "jurisdiction": "nyc", "category": "zoning", "headline": "...", "summary": "...", "why_it_matters": "...", "source_name": "...", "source_url": "https://...", "published_date": "2026-05-29" },
  { "id": "b", "date": "2026-04-15", "jurisdiction": "sf", "category": "permitting", "headline": "...", "summary": "...", "why_it_matters": "...", "source_name": "...", "source_url": "https://...", "published_date": "2026-05-29" }
]
```

Tip: validate your JSON (a trailing comma or missing quote will break the feed) at jsonlint.com before saving.
