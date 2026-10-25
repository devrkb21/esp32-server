import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = fileURLToPath(new URL('./src', import.meta.url));
const DEMO_INDEX = path.normalize(path.join(SRC, 'apis', 'demo', 'index'));
const DEMO_STUB = '\0tb-demo-stub';
const STUB_CODE = [
  'export const DEMO = false;',
  "export const DEMO_TOKEN = '';",
  'export const DEMO_USER = null;',
  'export const demoReply = () => null;',
].join('\n');

// Real builds never carry the demo fixtures, token or user: every import of src/apis/demo/index
// (aliased or relative) resolves to this stub unless the build runs with --mode demo.
function demoStub(mode) {
  return {
    name: 'tb-demo-stub',
    enforce: 'pre',
    resolveId(source, importer) {
      if (mode === 'demo' || !/(^|\/)demo\/index(\.js)?$/.test(source)) return null;
      let target;
      if (source.startsWith('@/')) target = path.join(SRC, source.slice(2));
      else if (path.isAbsolute(source)) target = source; // already through the '@' alias
      else if (source.startsWith('.') && importer) target = path.resolve(path.dirname(importer.split('?')[0]), source);
      else return null;
      return path.normalize(target).replace(/\.js$/, '') === DEMO_INDEX ? DEMO_STUB : null;
    },
    load(id) {
      return id === DEMO_STUB ? STUB_CODE : null;
    },
  };
}

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
    plugins: [demoStub(mode), vue()],
    define,
    envPrefix: ['VUE_APP_', 'VITE_'],
    resolve: {
      alias: { '@': SRC },
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
