// https://www.npmjs.com/package/@uni-helper/unocss-preset-uni
import { presetUni } from '@uni-helper/unocss-preset-uni'
import {
  defineConfig,
  presetAttributify,
  presetIcons,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  presets: [
    presetUni({
      attributify: {
        // prefix: 'fg-', // Prefix for unocss attributes
        prefixedOnly: true,
      },
    }),
    presetIcons({
      scale: 1.2,
      warn: true,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
    // Support CSS class attibutify
    presetAttributify(),
  ],
  transformers: [
    // Enable directives: supports @apply, @screen, and theme()
    transformerDirectives(),
    // Enable () grouping
    // Support CSS class combination, e.g. `<div class="hover:(bg-gray-400 font-medium) font-(light mono)">test unocss</div>`
    transformerVariantGroup(),
  ],
  shortcuts: [
    {
      center: 'flex justify-center items-center',
    },
  ],
  safelist: [],
  rules: [
    [
      'p-safe',
      {
        padding:
          'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
      },
    ],
    ['pt-safe', { 'padding-top': 'env(safe-area-inset-top)' }],
    ['pb-safe', { 'padding-bottom': 'env(safe-area-inset-bottom)' }],
  ],
  theme: {
    colors: {
      /** Theme color, e.g.: text-primary */
      primary: 'var(--nx-accent, #E2603A)',
      // Nobix tokens (style/nobix.scss): bg-nx-surface, text-nx-text-2, …
      nx: {
        'bg': 'var(--nx-bg)',
        'surface': 'var(--nx-surface)',
        'surface-2': 'var(--nx-surface-2)',
        'surface-3': 'var(--nx-surface-3)',
        'border': 'var(--nx-border)',
        'text': 'var(--nx-text)',
        'text-2': 'var(--nx-text-2)',
        'text-3': 'var(--nx-text-3)',
        'accent': 'var(--nx-accent)',
        'accent-soft': 'var(--nx-accent-soft)',
        'on-accent': 'var(--nx-on-accent)',
        'success': 'var(--nx-success)',
        'success-soft': 'var(--nx-success-soft)',
        'warning': 'var(--nx-warning)',
        'warning-soft': 'var(--nx-warning-soft)',
        'danger': 'var(--nx-danger)',
        'danger-soft': 'var(--nx-danger-soft)',
        'info': 'var(--nx-info)',
        'info-soft': 'var(--nx-info-soft)',
      },
    },
    fontSize: {
      /** Smaller font size, e.g.: text-2xs */
      '2xs': ['20rpx', '28rpx'],
      '3xs': ['18rpx', '26rpx'],
    },
  },
})
