import { fileURLToPath } from 'node:url';

// Deliberately no `defineConfig` import from 'vitest/config'. That entry point
// is CJS and requiring vite's ESM build fails on Node before 20.19. A plain
// object is the same config with none of that risk. See README.
const config = {
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
};

export default config;
