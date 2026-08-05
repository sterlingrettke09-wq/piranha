# Cited sources — liveness check

**GENERATED.** `npx vite-node scripts/check-citations.ts --write`

Every URL this repo cites **in a comment**, fetched on the date below. A citation
is a claim about the current state of an external document, and it decays: NYC's
module cited ZR 23-662 for nine height values after City of Yes repealed that
section on 2024-12-05, and the URL had been returning 404 ever since.

**This check catches REPEALED and MOVED, not AMENDED.** A section edited in place
still returns 200 while the text underneath changes. A green run means the
documents we cite still exist — never that the numbers we cite are current.

## Checked 2026-08-05

| Status | URL | Cited at |
|---|---|---|
| ✅ 200 | https://www.rsmeans.com/media/wysiwyg/quarterly_updates/2021-CCI-LocationFactors-V2.pdf | `src/config/estimates.ts:185` |
| ✅ 200 | https://www.rsmeans.com/media/wysiwyg/quarterly_updates/2024-Square-Foot-Project-Size-Modifiers.pdf | `src/config/estimates.ts:128` |
| 📓 recorded 404 | https://zr.planning.nyc.gov/article-ii/chapter-3/23-662 | `netlify/functions/lib/zoning/nyc.ts:11` |

**2 live · 0 dead · 0 unreachable.**

Unreachable is NOT a failure: an offline machine or a rate-limited host must not
be indistinguishable from a repealed statute. Only a definite 4xx/5xx fails.
