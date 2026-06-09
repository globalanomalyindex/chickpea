/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from a GitHub Pages project subpath (globalanomalyindex.github.io/chickpea/), so the
// production build is based at '/chickpea/'. Dev/preview stay at '/' so local QA is unaffected.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/chickpea/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
}))
