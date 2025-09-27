/* eslint-env node */
// vite.config.ts
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const resolveFromConfig = (relativePath: string) =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), relativePath);

// Auto-port:
// - PORT env menang
// - Replit default 5000
// - Lainnya default 3000
const isReplit =
  !!process.env.REPL_ID || !!process.env.REPL_SLUG || !!process.env.REPLIT_DB_URL;

const DEFAULT_PORT = isReplit ? 5000 : 3000;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;

export default defineConfig({
  root: resolveFromConfig("."),
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolveFromConfig("./src"),
      "@shared": resolveFromConfig("../shared"),
    },
  },
  define: {
    __SHARED_ASSETS_PATH__: JSON.stringify(resolveFromConfig("../shared/Asset")),
  },
  server: {
    host: "0.0.0.0",
    port: PORT,
    strictPort: true,
    allowedHosts: true,
    fs: {
      allow: [resolveFromConfig("."), resolveFromConfig("../shared")],
    },
  },
  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.svg'],
  preview: {
    host: "0.0.0.0",
    port: PORT,
  },
  build: {
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
        },
      },
    },
  },
});
