import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    // Workspace UI source imports `react` without depending on it: resolve it
    // from this app so raw @zivoe/ui TSX transforms in suites that render it.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Behavior tests run outside a React Server Components bundler
      'server-only': fileURLToPath(new URL('./src/test/server-only-stub.ts', import.meta.url))
    }
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts']
  }
});
