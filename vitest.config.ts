import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

/**
 * Vitest config kept separate from `vite.config.ts` so the dev server's
 * plugin chain (Tailwind, figma asset resolver) doesn't have to load
 * during tests. Aliases mirror the vite config so import paths work
 * consistently in both runtimes.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@nivaran/shared': path.resolve(__dirname, './shared/src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'shared/**/*.{test,spec}.ts', 'server/src/**/*.{test,spec}.ts'],
    css: false,
  },
});
