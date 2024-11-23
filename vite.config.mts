// vite.config.ts
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import path from 'path'
import { defineConfig } from 'vite'
import svgLoader from 'vite-svg-loader'
import Markdown from 'unplugin-vue-markdown/vite'
import caddyTls from './plugins/vite-plugin-caddy'
import ViteMonacoPlugin from 'vite-plugin-monaco-editor'

export default defineConfig({
  plugins: [
    vue({
      script: {
        propsDestructure: true,
        defineModel: true
      },
      include: [/\.vue$/, /\.md$/],
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('yt-')
        }
      }
    }),
    svgLoader(),
    vueJsx(),
    Markdown({
      /* options */
    }),
    caddyTls(),
    ViteMonacoPlugin({ languageWorkers: ['css'] })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  define: {
    'process.env': {},
    global: 'window'
  },
  optimizeDeps: {
    include: ['@vicons/fluent', '@vicons/ionicons5', 'vue', 'vue-router']
  }
})
