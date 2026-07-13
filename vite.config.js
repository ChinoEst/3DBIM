import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/3DBMI/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['web-ifc'],
    include: ['@thatopen/fragments', '@thatopen/components']
  },
  build: {
    target: 'esnext'
  },
  test: {
    exclude: [
      '**/node_modules/**',
      '**/tests/e2e/**'
    ]
  }
})