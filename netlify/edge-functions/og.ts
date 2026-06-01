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
  if (pathname === '/about') return { title: `About · ${BASE}`, desc: 'Why the Piranha Project exists and how it reads each city’s public records.' }
  if (pathname === '/math') return { title: `Methodology · ${BASE}`, desc: 'Exactly how the verdict, cost, and timeline are calculated, with the tables we use.' }
  if (pathname === '/ask') return { title: `Ask · ${BASE}`, desc: 'Questions about building, zoning, and the red tape, answered in plain English.' }
  if (pathname === '/news') return { title: `News · ${BASE}`, desc: 'What’s moving in housing and land-use policy across our cities.' }
  return null // home and everything else keep the default index.html meta
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export default async function (request: Request, context: { next: () => Promise<Response> }): Promise<Response> {
  const res = await context.next()
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res

  const url = new URL(request.url)
  const m = metaFor(url.pathname, url.searchParams)
  if (!m) return res

  const html = await res.text()
  const t = esc(m.title)
  const d = esc(m.desc)
  const out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, `$1${t}$2`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${d}$2`)
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${esc(url.href)}$2`)

  return new Response(out, { status: res.status, headers: res.headers })
}
