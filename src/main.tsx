import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { installGlobalErrorReporting } from './lib/reportClientErrors'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Beacon uncaught errors / rejections to the client-error function (Netlify
// logs). Best-effort and failure-swallowing; installed after render setup.
installGlobalErrorReporting()
