import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/api/ventas': {
        target: process.env.SALES_API_TARGET || 'http://127.0.0.1:3002',
        changeOrigin: true
      },
      '/api/reportes': {
        target: process.env.REPORTS_API_TARGET || 'http://127.0.0.1:3003',
        changeOrigin: true
      },
      '/api': {
        target: process.env.INVENTORY_API_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: true
      }
    }
  }
})
