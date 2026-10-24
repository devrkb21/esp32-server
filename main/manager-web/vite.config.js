import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

// The code still reads process.env.VUE_APP_* (and NODE_ENV / BASE_URL) as it did under vue-cli:
// those names are replaced at build time, so the .env files keep working unchanged.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VUE_APP_', 'VITE_']);
  const define = {
    'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
    'process.env.BASE_URL': JSON.stringify(env.VUE_APP_PUBLIC_PATH || '/'),
  };
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('VUE_APP_')) define[`process.env.${key}`] = JSON.stringify(value);
  }
  return {
    base: env.VUE_APP_PUBLIC_PATH || '/',
    plugins: [vue()],
    define,
    envPrefix: ['VUE_APP_', 'VITE_'],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
      extensions: ['.mjs', '.js', '.json', '.vue'],
    },
    server: {
      port: 8001,
      proxy: {
        // Override with DEV_PROXY_TARGET, e.g. the Docker manager-api on http://127.0.0.1:18002
        '/xiaozhi': { target: process.env.DEV_PROXY_TARGET || 'http://127.0.0.1:8002', changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 900,
    },
  };
});
