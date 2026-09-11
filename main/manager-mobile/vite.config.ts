import path from 'node:path'
import process from 'node:process'
import Uni from '@dcloudio/vite-plugin-uni'
import Components from '@uni-helper/vite-plugin-uni-components'
// @see https://uni-helper.js.org/vite-plugin-uni-layouts
import UniLayouts from '@uni-helper/vite-plugin-uni-layouts'
// @see https://github.com/uni-helper/vite-plugin-uni-manifest
import UniManifest from '@uni-helper/vite-plugin-uni-manifest'
// @see https://uni-helper.js.org/vite-plugin-uni-pages
import UniPages from '@uni-helper/vite-plugin-uni-pages'
// @see https://github.com/uni-helper/vite-plugin-uni-platform
// Use together with @uni-helper/vite-plugin-uni-pages plugin
import UniPlatform from '@uni-helper/vite-plugin-uni-platform'
/**
 * Subpackage optimization, async cross-package calls
 * @see https://github.com/uni-ku/bundle-optimizer
 */
import Optimization from '@uni-ku/bundle-optimizer'
import dayjs from 'dayjs'
import { visualizer } from 'rollup-plugin-visualizer'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig, loadEnv } from 'vite'
import ViteRestart from 'vite-plugin-restart'

// https://vitejs.dev/config/
export default async ({ command, mode }) => {
  // @see https://unocss.dev/
  const UnoCSS = (await import('unocss/vite')).default
  // console.log(mode === process.env.NODE_ENV) // true

  // mode: distinguish production or development
  console.log('command, mode -> ', command, mode)
  // pnpm dev:h5 => serve development
  // pnpm build:h5 => build production
  // pnpm dev:mp-weixin => build development
  // pnpm build:mp-weixin => build production
  // pnpm dev:app => build development
  // pnpm build:app => build production
  // dev and build use .env.development and .env.production respectively

  const { UNI_PLATFORM } = process.env
  console.log('UNI_PLATFORM -> ', UNI_PLATFORM) // e.g. mp-weixin, h5, app

  const env = loadEnv(mode, path.resolve(process.cwd(), 'env'))
  const {
    VITE_APP_PORT,
    VITE_SERVER_BASEURL,
    VITE_DELETE_CONSOLE,
    VITE_SHOW_SOURCEMAP,
    VITE_APP_PUBLIC_BASE,
    VITE_APP_PROXY,
    VITE_APP_PROXY_PREFIX,
  } = env
  console.log('Environment env -> ', env)

  return defineConfig({
    envDir: './env', // Custom env directory
    base: VITE_APP_PUBLIC_BASE,
    plugins: [
      UniPages({
        exclude: ['**/components/**/**.*'],
        // homePage is configured via route-block type="home"
        // pages directory is src/pages, subpackages cannot be inside pages
        subPackages: ['src/pages-sub'], // Subpackage paths array
        dts: 'src/types/uni-pages.d.ts',
      }),
      UniLayouts(),
      UniPlatform(),
      UniManifest(),
      // UniXXX must be imported before Uni
      {
        // Compiler bug workaround for @dcloudio/uni-mp-compiler
        // Reference github issue: https://github.com/dcloudio/uni-app/issues/4952
        // Disable devToolsEnabled and force inline to true
        name: 'fix-vite-plugin-vue',
        configResolved(config) {
          const plugin = config.plugins.find(p => p.name === 'vite:vue')
          if (plugin && plugin.api && plugin.api.options) {
            plugin.api.options.devToolsEnabled = false
          }
        },
      },
      UnoCSS(),
      AutoImport({
        imports: ['vue', 'uni-app'],
        dts: 'src/types/auto-import.d.ts',
        dirs: ['src/hooks'], // Auto import hooks
        vueTemplate: true, // default false
      }),
      // Optimization plugin requires page.json, execute after UniPages
      Optimization({
        enable: {
          'optimization': true,
          'async-import': true,
          'async-component': true,
        },
        dts: {
          base: 'src/types',
        },
        logger: false,
      }),

      ViteRestart({
        // Reload configuration on vite.config.js modifications
        restart: ['vite.config.js'],
      }),
      // Add BUILD_TIME and BUILD_BRANCH for H5
      UNI_PLATFORM === 'h5' && {
        name: 'html-transform',
        transformIndexHtml(html) {
          return html.replace('%BUILD_TIME%', dayjs().format('YYYY-MM-DD HH:mm:ss'))
        },
      },
      // Bundle visualizer for H5 production build
      UNI_PLATFORM === 'h5'
      && mode === 'production'
      && visualizer({
        filename: './node_modules/.cache/visualizer/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
      // Enable copyNativeRes plugin on app platform only
      // UNI_PLATFORM === 'app' && copyNativeRes(),
      Components({
        extensions: ['vue'],
        deep: true, // Recursively scan subdirectories
        directoryAsNamespace: false, // Use directory name as namespace prefix
        dts: 'src/types/components.d.ts', // Auto-generated component type declarations
      }),
      Uni(),
    ],
    define: {
      __UNI_PLATFORM__: JSON.stringify(UNI_PLATFORM),
      __VITE_APP_PROXY__: JSON.stringify(VITE_APP_PROXY),
    },
    css: {
      postcss: {
        plugins: [
          // autoprefixer({
          //   // Specify target browsers
          //   overrideBrowserslist: ['> 1%', 'last 2 versions'],
          // }),
        ],
      },
    },

    resolve: {
      alias: {
        '@': path.join(process.cwd(), './src'),
        '@img': path.join(process.cwd(), './src/static/images'),
      },
    },
    server: {
      host: '0.0.0.0',
      hmr: true,
      port: Number.parseInt(VITE_APP_PORT, 10),
      // Only effective in H5 (other platforms use build, not devServer)
      proxy: JSON.parse(VITE_APP_PROXY)
        ? {
            [VITE_APP_PROXY_PREFIX]: {
              target: VITE_SERVER_BASEURL,
              changeOrigin: true,
              rewrite: path => path.replace(new RegExp(`^${VITE_APP_PROXY_PREFIX}`), ''),
            },
          }
        : undefined,
    },
    esbuild: {
      drop: VITE_DELETE_CONSOLE === 'true' ? ['console', 'debugger'] : ['debugger'],
    },
    build: {
      sourcemap: false,
      // Useful for debugging non-H5 targets
      // sourcemap: VITE_SHOW_SOURCEMAP === 'true', // Default false
      target: 'es6',
      // Do not minify in development
      minify: mode === 'development' ? false : 'esbuild',

    },
  })
}
