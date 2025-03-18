// vite.config.ts
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import path from 'path'
import Markdown from 'unplugin-vue-markdown/vite'
import { defineConfig } from 'vite'
import monacoEditorPluginModule from 'vite-plugin-monaco-editor'
import svgLoader from 'vite-svg-loader'
import caddyTls from './plugins/vite-plugin-caddy'

const isObjectWithDefaultFunction = (
  module: unknown
): module is { default: typeof monacoEditorPluginModule } =>
  module != null &&
  typeof module === 'object' &&
  'default' in module &&
  typeof module.default === 'function'

const monacoEditorPlugin = isObjectWithDefaultFunction(monacoEditorPluginModule)
  ? monacoEditorPluginModule.default
  : monacoEditorPluginModule

export default defineConfig({
  plugins: [
    vue({
      script: { propsDestructure: true, defineModel: true },
      include: [/\.vue$/, /\.md$/],
      template: {
        compilerOptions: { isCustomElement: (tag) => tag.startsWith('yt-') }
      }
    }),
    svgLoader(),
    vueJsx(),
    Markdown({
      /* options */
    }),
    caddyTls(),
    monacoEditorPlugin({ languageWorkers: ['css'] })
  ],
  server: { port: 51000 },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  define: { 'process.env': {}, global: 'window' },
  optimizeDeps: {
    include: ['@vicons/fluent', '@vicons/ionicons5', 'vue', 'vue-router']
  },
  build: { sourcemap: true }
})
