import path from 'node:path'
import { fileURLToPath } from 'node:url'

import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import { configDefaults, defineConfig } from 'vitest/config'

import { customHtmlSandboxLibsPlugin } from './customHtmlSandboxLibsPlugin.ts'

const root = path.dirname(fileURLToPath(import.meta.url))

const NODE_TEST_INCLUDE = [
  'packages/**/*.test.ts',
  'src/apps/client/api/__tests__/*.test.ts',
  'src/apps/client/data/__tests__/*.test.ts',
  'src/apps/client/store/autoAction/__tests__/{actionUtils,evaluateExpression,expressionEvaluator,pointRedeem,rateLimiter,triggers}.test.ts',
  'src/apps/live-dashboard/core/__tests__/*.test.ts',
  'src/apps/live-dashboard/store/__tests__/*.test.ts',
  'src/apps/user-page/block/__tests__/{buttonAppearance,customHtmlCompile,embed,propertyCapabilities,registry,schema,visibility}.test.ts',
  'src/shared/__tests__/*.test.ts',
  'src/shared/config/__tests__/*.test.ts',
  'src/shared/config/theme/__tests__/*.test.ts',
  'src/shared/obs/__tests__/*.test.ts',
  'src/shared/services/DanmakuClients/__tests__/*.test.ts',
  'src/apps/open-live/voice-providers/*.test.ts',
  'src/apps/user-page/__tests__/pageThemePrimary.test.ts',
]

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      '@vtsuru/danmaku': path.resolve(root, 'packages/danmaku/src/index.ts'),
    },
  },
  plugins: [
    customHtmlSandboxLibsPlugin(),
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', '@vueuse/core', 'pinia', 'date-fns'],
      dts: false,
    }),
  ],
  test: {
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    server: { deps: { inline: ['@vtsuru/danmaku'] } },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: NODE_TEST_INCLUDE,
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.{test,spec}.ts'],
          exclude: [...configDefaults.exclude, ...NODE_TEST_INCLUDE.filter((p) => !p.startsWith('packages/'))],
        },
      },
    ],
  },
})
