// vite.config.ts
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import path from 'path';
import AutoImport from 'unplugin-auto-import/vite';
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers';
import Components from 'unplugin-vue-components/vite';
import Markdown from 'unplugin-vue-markdown/vite';
import { defineConfig } from 'vite';
import oxlintPlugin from 'vite-plugin-oxlint';
import svgLoader from 'vite-svg-loader';
import { VineVitePlugin } from 'vue-vine/vite';

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
      extensions: ['vue', 'md'],

      include: [/\.vue$/, /\.vue\?vue/, /\.md$/, /\.vine$/],
    }),
    oxlintPlugin(),
    VineVitePlugin(),
  ],
  server: { port: 51000 },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  define: { 'process.env': {}, global: 'window' },
  optimizeDeps: {
    include: ['@vicons/fluent', '@vicons/ionicons5', 'vue', 'vue-router']
  },
  build: {
    sourcemap: true,
  },
});
