import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    'process.env.VUE_APP_API_BASE_URL': JSON.stringify('/xiaozhi'),
    'process.env.VUE_APP_TITLE': JSON.stringify('TinyBot'),
    'process.env.VUE_APP_DEMO': JSON.stringify('false'),
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/**/*.test.{js,mjs}', 'src/**/*.test.{js,mjs}'],
    exclude: ['tests/*Contract.test.mjs', 'tests/legacy/**', 'node_modules/**', 'src/**/*Api.test.mjs', 'src/components/agentSnapshotDisplayUtils.test.mjs'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/utils/**', 'src/store/**'],
    },
  },
});
