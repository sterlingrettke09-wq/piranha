import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import Home from './routes/Home'

// Home stays eager so the landing page + intro paint instantly. Everything else
// is code-split, so the heavy map bundle (mapbox-gl) only loads on /boston.
const BostonDashboard = lazy(() => import('./routes/BostonDashboard'))
const BostonWizard = lazy(() => import('./routes/BostonWizard'))
const BostonResult = lazy(() => import('./routes/BostonResult'))
const Ask = lazy(() => import('./routes/Ask'))
const About = lazy(() => import('./routes/About'))
const News = lazy(() => import('./routes/News'))
const Admin = lazy(() => import('./routes/Admin'))
const NotFound = lazy(() => import('./routes/NotFound'))

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-piranha-charcoal/20 border-t-piranha-burgundy" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
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
            {/* Hidden owner-only search log. Not linked from nav or sitemap. */}
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  )
}
