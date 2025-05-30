import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      'tank.amsoft.am',
      'localhost',
      '127.0.0.1'
    ],
    cors: true
  }
}) 