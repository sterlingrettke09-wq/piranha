import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Allow the Cloudflare quick-tunnel host (and localhost) so the dev server
    // can be previewed through a public https://<id>.trycloudflare.com URL.
    allowedHosts: ['.trycloudflare.com', 'localhost'],
  },
})
