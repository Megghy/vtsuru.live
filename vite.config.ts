// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import svgLoader from 'vite-svg-loader'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  server: {
    https: true, // 需要开启https服务
  },
  plugins: [vue(), svgLoader(), mkcert({
    source: 'coding'
  })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    'process.env': {},
  },
})
