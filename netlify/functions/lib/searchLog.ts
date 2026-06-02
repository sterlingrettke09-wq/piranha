import { getStore } from '@netlify/blobs'
import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const STORE = 'search-log'
// Local fallback for `netlify dev` (unlinked), where Blobs has no environment.
// On a deployed Netlify site, Blobs is configured automatically and this is never used.
const FALLBACK_DIR = join(tmpdir(), 'tpp-search-log')

export interface SearchEntry {
  ts: string // ISO timestamp
  city: string
  address: string
  kind?: 'lookup' | 'analysis' // 'lookup' = map search/click; 'analysis' = full run
  use?: string
  projectType?: string
  gfa?: number
  units?: number
  verdict?: string
  months?: number
}

// One record per entry, keyed by a sortable millisecond timestamp + uuid so keys
// stay in chronological order lexicographically.
export async function logSearch(entry: SearchEntry): Promise<void> {
  const key = `${Date.now()}-${randomUUID()}`
  try {
    const store = getStore(STORE)
    await store.setJSON(key, entry)
  } catch (blobErr) {
    // Surface WHY Blobs failed (e.g. environment not configured) — this is the
    // one line that tells us if the production store is the problem.
    console.log({ event: 'searchlog.blobs_write_fail', message: String(blobErr) })
    try {
      await mkdir(FALLBACK_DIR, { recursive: true })
      await writeFile(join(FALLBACK_DIR, `${key}.json`), JSON.stringify(entry))
    } catch (err) {
      // Logging must never break the analysis.
      console.log({ event: 'searchlog.write_fail', message: String(err) })
    }
  }
}

// Reports whether the production Blobs store is actually reachable, so the admin
// page can say "storage error: X" instead of a misleading empty list.
export async function searchStorageStatus(): Promise<{ backend: 'blobs' | 'fallback'; error?: string }> {
  try {
    const store = getStore(STORE)
    await store.list({ prefix: 'zzz-health-check-no-match' })
    return { backend: 'blobs' }
  } catch (err) {
    return { backend: 'fallback', error: String(err) }
  }
}

export async function readSearches(limit = 500): Promise<SearchEntry[]> {
  try {
    const store = getStore(STORE)
    const { blobs } = await store.list()
    const keys = blobs
      .map((b) => b.key)
      .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
      .slice(0, limit)
    const entries = await Promise.all(
      keys.map((k) => store.get(k, { type: 'json' }).catch(() => null)),
    )
    return entries.filter((e): e is SearchEntry => e != null)
  } catch (blobErr) {
    console.log({ event: 'searchlog.blobs_read_fail', message: String(blobErr) })
    return readFallback(limit)
  }
}

async function readFallback(limit: number): Promise<SearchEntry[]> {
  try {
    const files = (await readdir(FALLBACK_DIR))
      .filter((f) => f.endsWith('.json'))
      .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
      .slice(0, limit)
    const entries = await Promise.all(
      files.map((f) =>
        readFile(join(FALLBACK_DIR, f), 'utf8')
          .then((s) => JSON.parse(s) as SearchEntry)
          .catch(() => null),
      ),
    )
    return entries.filter((e): e is SearchEntry => e != null)
  } catch {
    return []
  }
}
