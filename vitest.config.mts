import path from 'node:path'
import { fileURLToPath } from 'node:url'

import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import { defineConfig } from 'vitest/config'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      '@vtsuru/danmaku': path.resolve(root, 'packages/danmaku/src/index.ts'),
    },
  },
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', '@vueuse/core', 'pinia', 'date-fns'],
      dts: false,
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.ts', 'packages/**/*.test.ts'],
    server: { deps: { inline: ['@vtsuru/danmaku'] } },
  },
})
