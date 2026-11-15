/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve('./src') } },
  server: {
    // In development the API runs on :8000; in production a web server serves both on one origin.
    proxy: { '/api': process.env.API_PROXY ?? 'http://localhost:8000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    exclude: ['e2e/**', '**/node_modules/**', 'dist/**'], // e2e runs with Playwright (npm run e2e)
  },
})
