import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    // The MapLibre vendor chunk is ~1.07 MB minified on its own and is needed to
    // paint the map at all, so it cannot be deferred. Everything else stays well
    // under the default limit.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        // MapLibre is by far the largest dependency and changes far less often
        // than app code, so it gets its own long-lived cache entry.
        manualChunks: {
          maplibre: ['maplibre-gl'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
  },
});