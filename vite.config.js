import { defineConfig } from 'vite';

// One JS bundle, no code splitting, so scripts/inline.js can put the whole
// game into a single HTML file (that is what gets published).
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 2000, assetsInlineLimit: 100000000, rollupOptions: { output: { inlineDynamicImports: true } } },
  test: { environment: 'node', testTimeout: 120000, hookTimeout: 120000 },
});
