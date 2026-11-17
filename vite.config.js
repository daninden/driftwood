import { defineConfig } from 'vite';
import { availableParallelism } from 'node:os';
import { configDefaults } from 'vitest/config';

// One JS bundle, no code splitting, so scripts/inline.js can put the whole
// game into a single HTML file (that is what gets published).
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 2000, assetsInlineLimit: 100000000, rollupOptions: { output: { inlineDynamicImports: true } } },
  // 0.30.5 "Quicker": the tests import the game's modules natively (no Vite module runner: its rewritten imports made the long simulations about a third slower; the tests use no vi.mock),
  // on every core of the machine (Vitest uses one fewer than the cores by default; measured on four).
  // 0.37.1: '.claude/**' is left out: a worktree a subagent left there holds a whole copy of the tests (two such copies made the suite three times as long, 0.36.7 to 0.37.0).
  test: { environment: 'node', exclude: [...configDefaults.exclude, '.claude/**'], testTimeout: 120000, hookTimeout: 120000, maxWorkers: availableParallelism(), experimental: { viteModuleRunner: false } },
});
