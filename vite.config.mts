// vite.config.ts
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import path from 'path';
import { defineConfig } from 'vite';
import svgLoader from 'vite-svg-loader';

export default defineConfig({
  plugins: [
    vue({
      script: {
        propsDestructure: true,
        defineModel: true,
      },
    }),
    svgLoader(),
    vueJsx(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    'process.env': {},
  },
})
