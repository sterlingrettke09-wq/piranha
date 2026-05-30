import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import { Layout } from './components/Layout'
import Home from './routes/Home'
import BostonDashboard from './routes/BostonDashboard'
import BostonWizard from './routes/BostonWizard'
import BostonResult from './routes/BostonResult'
import Ask from './routes/Ask'
import About from './routes/About'
import News from './routes/News'
import NotFound from './routes/NotFound'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/boston" element={<BostonDashboard />} />
          <Route path="/boston/start" element={<BostonWizard />} />
          <Route path="/boston/result" element={<BostonResult />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/news" element={<News />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </StrictMode>,
)
