import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // Vite serves public fonts at /fonts; Vitest needs a filesystem alias.
    alias: { '/fonts': fileURLToPath(new URL('./public/fonts', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
  },
});