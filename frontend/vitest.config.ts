import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Config dedicado para testes (Vitest) - separado do vite.config.ts usado no
// build/dev, para não misturar o plugin do Tailwind (desnecessário em testes)
// nem o tipo `test:` (não reconhecido pelo `defineConfig` puro do vite).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // e2e/ tem seus próprios *.spec.ts (Playwright, não Vitest) - sem isso o
    // Vitest tenta coletá-los também e quebra em test.describe.configure().
    exclude: ['**/node_modules/**', '**/dist/**', './e2e/**'],
  },
})
