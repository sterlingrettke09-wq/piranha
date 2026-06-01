import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split the heavy map libraries into their own long-lived vendor chunks
        // so dashboard app-code changes don't force users to re-download them.
        manualChunks(id: string) {
          if (id.includes('node_modules/mapbox-gl')) return 'mapbox-gl'
          if (id.includes('@mapbox/search-js')) return 'mapbox-search'
          return undefined
        },
      },
    },
  },
  server: {
    // Allow the Cloudflare quick-tunnel host (and localhost) so the dev server
    // can be previewed through a public https://<id>.trycloudflare.com URL.
    allowedHosts: ['.trycloudflare.com', 'localhost'],
  },
})
