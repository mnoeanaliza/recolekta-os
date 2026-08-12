import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          charts: ['recharts'],
          pdf: ['jspdf', 'jspdf-autotable'],
          maps: ['leaflet', 'react-leaflet']
        }
      }
    }
  },
  server: {
    port: 3000,
    host: '127.0.0.1',
    strictPort: false
  }
})
