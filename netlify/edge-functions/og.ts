// Netlify Edge Function: inject route-specific <title> and OG/Twitter meta into
// the served HTML. A client-rendered SPA can't do this for crawlers (they don't
// run JS), so shared links and search engines would otherwise see only the
// generic homepage card. Real users also get client-side titles on SPA nav.

const BASE = 'The Piranha Project'

const CITY: Record<string, string> = {
  boston: 'Boston',
  nyc: 'New York City',
  chicago: 'Chicago',
  sf: 'San Francisco',
  seattle: 'Seattle',
  dc: 'Washington, DC',
  austin: 'Austin',
  la: 'Los Angeles',
  denver: 'Denver',
  minneapolis: 'Minneapolis',
}

function cityName(slug: string | null): string {
  return CITY[slug ?? 'boston'] ?? 'your city'
}

function metaFor(pathname: string, params: URLSearchParams): { title: string; desc: string } | null {
  if (pathname === '/map' || pathname === '/boston') {
    const c = cityName(params.get('city'))
    return {
      title: `Explore ${c} · ${BASE}`,
      desc: `What it takes to build in ${c}: zoning, cost, timeline, and the red tape, drawn from public records.`,
    }
  }
  if (pathname === '/result' || pathname === '/boston/result') {
    const c = cityName(params.get('city'))
    return {
      title: `Feasibility report · ${c} · ${BASE}`,
      desc: 'A parcel-level read on what it takes to build here: feasibility, cost, and timeline, from public records.',
    }
  }
  if (pathname === '/start' || pathname === '/boston/start') {
    const c = cityName(params.get('city'))
    return {
      title: `Plan a project · ${c} · ${BASE}`,
      desc: `Describe what you want to build in ${c} and get a parcel-level feasibility read: zoning, cost, and timeline.`,
    }
  }
  if (pathname === '/compare') {
    return {
      title: `Compare parcels · ${BASE}`,
      desc: 'Two parcels side by side: feasibility, cost, and timeline, drawn from public records.',
    }
  }
  if (pathname === '/about') return { title: `About · ${BASE}`, desc: 'Why the Piranha Project exists and how it reads each city’s public records.' }
  if (pathname === '/math') return { title: `Methodology · ${BASE}`, desc: 'Exactly how the verdict, cost, and timeline are calculated, with the tables we use.' }
  if (pathname === '/red-tape') return { title: `The Red Tape Index · ${BASE}`, desc: 'Ten cities ranked by the cost of permission: months of process and fees per square foot for one reference project, computed from public data.' }
  if (pathname === '/ask') return { title: `Ask · ${BASE}`, desc: 'Questions about building, zoning, and the red tape, answered in plain English.' }
  if (pathname === '/cities') return { title: `Cities · ${BASE}`, desc: 'The cities we cover, each read from its own public zoning and parcel records.' }
  if (pathname === '/request-city') return { title: `Request a city · ${BASE}`, desc: 'Tell us where you want to build and we’ll try to add it to our database.' }
  if (pathname === '/privacy') return { title: `Privacy · ${BASE}`, desc: 'What we collect and where it goes, in plain English: searches, request-city emails, and the services we use.' }
  if (pathname === '/terms') return { title: `Terms · ${BASE}`, desc: 'The plain-English terms of use: estimates not advice, verify with the city, no warranty, acceptable use.' }
  return null // home and everything else keep the default index.html meta
}

// Canonical URL for a route. The city param changes page content on the map /
// wizard / result routes, so it's kept; every other query param is stripped so
// crawlers don't index tracking-or-state variants as separate pages.
function canonicalFor(url: URL): string {
  const keepCity = ['/map', '/boston', '/result', '/boston/result', '/start', '/boston/start']
  const city = url.searchParams.get('city')
  const suffix = keepCity.includes(url.pathname) && city ? `?city=${encodeURIComponent(city)}` : ''
  return `${url.origin}${url.pathname}${suffix}`
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Mirror of the route table in src/App.tsx — keep the two in sync. Unknown
// paths still serve the SPA shell (React renders NotFound) but with HTTP 404,
// so crawlers stop indexing junk URLs as soft-200s.
const KNOWN_ROUTES = new Set([
  '/',
  '/map',
  '/start',
  '/result',
  '/boston',
  '/boston/start',
  '/boston/result',
  '/ask',
  '/about',
  '/math',
  '/red-tape',
  '/compare',
  '/request-city',
  '/cities',
  '/privacy',
  '/terms',
  '/admin',
])

export function isKnownRoute(pathname: string): boolean {
  // Normalize a single trailing slash ("/about/" → "/about").
  const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return KNOWN_ROUTES.has(p)
}

// Attribute-order-tolerant replacers. `[^>]*?` between the identifying
// attribute and `content` tolerates extra attributes and whitespace; a second
// pattern handles `content` appearing BEFORE the identifying attribute, so a
// reformat of index.html can't silently disable the rewrite.
function setMeta(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const after = new RegExp(`(<meta\\b[^>]*?${attr}="${key}"[^>]*?content=")[^"]*(")`)
  if (after.test(html)) return html.replace(after, `$1${value}$2`)
  const before = new RegExp(`(<meta\\b[^>]*?content=")[^"]*("[^>]*?${attr}="${key}")`)
  return html.replace(before, `$1${value}$2`)
}

export default async function (request: Request, context: { next: () => Promise<Response> }): Promise<Response> {
  const res = await context.next()
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res

  const url = new URL(request.url)
  const m = metaFor(url.pathname, url.searchParams)
  const canonical = esc(canonicalFor(url))

  let html = await res.text()

  // Every HTML route gets a correct self-referencing canonical + og:url. The
  // shipped index.html hardcodes the homepage URL, which told crawlers every
  // page was a duplicate of "/".
  html = html.replace(/(<link\b[^>]*?rel="canonical"[^>]*?href=")[^"]*(")/, `$1${canonical}$2`)
  html = setMeta(html, 'property', 'og:url', canonical)

  // The owner-only search log should never be indexed.
  if (url.pathname === '/admin') {
    html = html.replace('</head>', '    <meta name="robots" content="noindex, nofollow" />\n  </head>')
  }

  if (m) {
    const t = esc(m.title)
    const d = esc(m.desc)
    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    html = setMeta(html, 'name', 'description', d)
    html = setMeta(html, 'property', 'og:title', t)
    html = setMeta(html, 'property', 'og:description', d)
    html = setMeta(html, 'name', 'twitter:title', t)
    html = setMeta(html, 'name', 'twitter:description', d)
  }

  // Real 404 status for unknown SPA routes (the body is still the shell, and
  // React renders the NotFound page). Without this, every junk URL was a
  // soft-200 that crawlers happily indexed.
  const status = res.status === 200 && !isKnownRoute(url.pathname) ? 404 : res.status

  return new Response(html, { status, headers: res.headers })
}
