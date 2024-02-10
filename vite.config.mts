// vite.config.ts
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import path from 'path'
import { defineConfig } from 'vite'
import svgLoader from 'vite-svg-loader'
import Markdown from 'unplugin-vue-markdown/vite'

export default defineConfig({
  plugins: [
    vue({
      script: {
        propsDestructure: true,
        defineModel: true,
      },
      include: [/\.vue$/, /\.md$/],
    }),
    svgLoader(),
    vueJsx(),
    Markdown({
      /* options */
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    'process.env': {},
  },
  optimizeDeps: {
    include: ['@vicons/fluent', '@vicons/ionicons5', 'vue', 'vue-router'],
  },
})
