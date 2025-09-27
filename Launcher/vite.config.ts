import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const r = (p: string) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), p)
const monorepoRoot = r('..')

// Auto-port detection: PORT env > Replit default 5000 > general default 3000
const isReplit = !!process.env.REPL_ID || !!process.env.REPL_SLUG || !!process.env.REPLIT_DB_URL
const DEFAULT_PORT = isReplit ? 5000 : 3000
const PORT = Number(process.env.PORT) || DEFAULT_PORT

// Vite 7, ESM. Enhanced configuration with auto-port detection and better asset management.
export default defineConfig({
  root: r('.'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': r('./src'),
      '@shared': path.resolve(monorepoRoot, 'shared')
    },
    // Avoid multiple Pixi instances when HMR/monorepo linking
    dedupe: ['pixi.js']
  },
  optimizeDeps: {
    // Ensure Pixi is pre-bundled for faster dev startup
    include: ['pixi.js']
  },
  define: {
    __SHARED_ASSETS_PATH__: JSON.stringify(path.resolve(monorepoRoot, 'shared/asset'))
  },
  publicDir: false,
  server: {
    host: '0.0.0.0',
    port: PORT,
    strictPort: true,
    allowedHosts: true,
    fs: {
      allow: [r('.'), path.resolve(monorepoRoot, 'shared')]
    }
  },
  preview: {
    host: '0.0.0.0',
    port: PORT
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          pixi: ['pixi.js']
        }
      }
    }
  },
  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.svg']
})

