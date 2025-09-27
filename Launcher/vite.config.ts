import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const r = (p: string) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), p)
const monorepoRoot = r('..')

// Vite 7, ESM. Alias @shared -> root/shared.
// Force port: 5000, host 0.0.0.0, strictPort ON, allowedHosts sesuai contohmu.
export default defineConfig({
  root: r('.'),
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(monorepoRoot, 'shared')
    },
    // Avoid multiple Pixi instances when HMR/monorepo linking
    dedupe: ['pixi.js']
  },
  optimizeDeps: {
    // Ensure Pixi is pre-bundled for faster dev startup
    include: ['pixi.js']
  },
  
  publicDir: false,
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    allowedHosts: true,
    fs: {
      allow: ['..']
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5000
  },
  build: {
    target: 'es2020',
    sourcemap: false
  }
})

