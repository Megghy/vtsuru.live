// vite.config.ts
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import path, { resolve } from 'path';
import Markdown from 'unplugin-vue-markdown/vite';
import { defineConfig } from 'vite';
import monacoEditorPluginModule from 'vite-plugin-monaco-editor';
import caddyTls from './plugins/vite-plugin-caddy';
import { VineVitePlugin } from 'vue-vine/vite';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';
import oxlintPlugin from 'vite-plugin-oxlint';
import svgLoader from 'vite-svg-loader'

const isObjectWithDefaultFunction = (
  module: unknown
): module is { default: typeof monacoEditorPluginModule; } =>
  module != null &&
  typeof module === 'object' &&
  'default' in module &&
  typeof module.default === 'function';

const monacoEditorPlugin = isObjectWithDefaultFunction(monacoEditorPluginModule)
  ? monacoEditorPluginModule.default
  : monacoEditorPluginModule;

export default defineConfig({
  plugins: [
    vue({
      script: { propsDestructure: true, defineModel: true },
      include: [/\.vue$/, /\.md$/],
      template: {
        compilerOptions: { isCustomElement: (tag) => tag.startsWith('yt-') }
      }
    }),
    vueJsx(),
    svgLoader(),
    Markdown({
      /* options */
    }),
    caddyTls(),
    AutoImport({
      imports: ['vue', 'vue-router', '@vueuse/core', 'pinia', 'date-fns', {
        'naive-ui': [
          'useDialog',
          'useMessage',
          'useNotification',
          'useLoadingBar'
        ]
      }],
      dts: 'src/auto-imports.d.ts'
    }),
    Components({
      resolvers: [NaiveUiResolver()],
      dts: 'src/components.d.ts',
      // allow auto load markdown components under `./src/components/`
      extensions: ['vue', 'md'],

      // allow auto import and register components used in markdown
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
    }),
    monacoEditorPlugin({ languageWorkers: ['css'] }),
    oxlintPlugin(),
    VineVitePlugin()
  ],
  server: { port: 51000 },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  define: { 'process.env': {}, global: 'window' },
  optimizeDeps: {
    include: ['@vicons/fluent', '@vicons/ionicons5', 'vue', 'vue-router']
  },
  build: { sourcemap: true },
});
