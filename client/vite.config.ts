import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Dev only: the game server (npm run dev in ../server) listens on 3090
const serverUrl = process.env.DEV_SERVER_URL || 'http://localhost:3090'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  build: {
    sourcemap: false,
    // Fonts stay separate files: the CSP allows fonts only from 'self', not data: URLs
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
  },
  server: {
    port: 5173,
    fs: {
      allow: ['..'],
      deny: ['**/.*'],
    },
    proxy: {
      '/socket.io': { target: serverUrl, ws: true },
      '/api': { target: serverUrl },
    },
  },
})
