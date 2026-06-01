import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useSearchParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import { getCity } from './config/cities'
import Home from './routes/Home'

// Home stays eager so the landing page + intro paint instantly. Everything else
// is code-split, so the heavy map bundle (mapbox-gl) only loads on /boston.
const BostonDashboard = lazy(() => import('./routes/BostonDashboard'))
const BostonWizard = lazy(() => import('./routes/BostonWizard'))
const BostonResult = lazy(() => import('./routes/BostonResult'))
const Ask = lazy(() => import('./routes/Ask'))
const About = lazy(() => import('./routes/About'))
const News = lazy(() => import('./routes/News'))
const Methodology = lazy(() => import('./routes/Methodology'))
const Admin = lazy(() => import('./routes/Admin'))
const NotFound = lazy(() => import('./routes/NotFound'))

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-piranha-charcoal/20 border-t-piranha-burgundy" />
    </div>
  )
}

// Sets the tab title per route on client-side navigation. Static routes are
// handled here by path; /result returns false so the result page can own its
// title (the parcel address, set once the analysis loads).
function RouteTitle() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  let title: string | false | undefined
  if (pathname === '/') title = undefined
  else if (pathname === '/map' || pathname === '/boston') title = getCity(params.get('city') ?? 'boston').name
  else if (pathname === '/start' || pathname === '/boston/start') title = 'Define your project'
  else if (pathname === '/result' || pathname === '/boston/result') title = false
  else if (pathname === '/ask') title = 'Ask'
  else if (pathname === '/news') title = 'News'
  else if (pathname === '/about') title = 'About'
  else if (pathname === '/math') title = 'Methodology'
  else if (pathname === '/admin') title = 'Search log'
  else title = 'Page not found'
  useDocumentTitle(title)
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <RouteTitle />
      <Layout>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/map" element={<BostonDashboard />} />
            <Route path="/start" element={<BostonWizard />} />
            <Route path="/result" element={<BostonResult />} />
            {/* Legacy aliases so older shared links still resolve. */}
            <Route path="/boston" element={<BostonDashboard />} />
            <Route path="/boston/start" element={<BostonWizard />} />
            <Route path="/boston/result" element={<BostonResult />} />
            <Route path="/ask" element={<Ask />} />
            <Route path="/news" element={<News />} />
            <Route path="/about" element={<About />} />
            <Route path="/math" element={<Methodology />} />
            {/* Hidden owner-only search log. Not linked from nav or sitemap. */}
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  )
}
