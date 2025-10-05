import path from 'node:path'
// vite.config.ts
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import { defineConfig } from 'vite'
import svgLoader from 'vite-svg-loader'
import { VineVitePlugin } from 'vue-vine/vite'
// import MonacoEditorNlsPlugin, { esbuildPluginMonacoEditorNls, Languages } from 'vite-plugin-monaco-editor-nls'

// 自定义SVGO插件，删除所有名称以sodipodi:和inkscape:开头的元素
const removeSodipodiInkscape = {
  name: 'removeSodipodiInkscape',
  description: '删除所有名称以sodipodi:和inkscape:开头的元素',
  fn: () => {
    return {
      element: {
        enter: (node: any, parentNode: any) => {
          // 检查元素名称是否以sodipodi:或inkscape:开头
          if (node.name && (node.name.startsWith('sodipodi:') || node.name.startsWith('inkscape:'))) {
            // 从父节点的children数组中过滤掉当前节点
            parentNode.children = parentNode.children.filter((child: any) => child !== node)
          }
        },
      },
    }
  },
}

export default defineConfig({
  plugins: [
    vue({
      script: { propsDestructure: true, defineModel: true },
      include: [/\.vue$/, /\.md$/],
      template: {
        compilerOptions: {
          isCustomElement: (tag) => {
            return tag.includes(':') || tag.startsWith('yt-')
          },
        },
      },
    }),
    vueJsx(),
    svgLoader({
      svgoConfig: {
        plugins: [
          {
            name: 'preset-default',
            params: {
              overrides: {
                removeEditorsNSData: false,
              },
            },
          },
          removeSodipodiInkscape,
          'convertStyleToAttrs',
          'removeUselessDefs',
          'removeUselessStrokeAndFill',
          'removeUnusedNS',
          'removeEmptyText',
          'removeEmptyContainers',
          'removeViewBox',
          'cleanupIds',
        ],
      },
    }),
    Markdown({
      /* options */
    }),
    AutoImport({
      imports: ['vue', 'vue-router', '@vueuse/core', 'pinia', 'date-fns', {
        'naive-ui': [
          'useDialog',
          'useMessage',
          'useNotification',
          'useLoadingBar',
        ],
      }],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [NaiveUiResolver()],
      dts: 'src/components.d.ts',
      extensions: ['vue', 'md'],
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/, /\.vine$/],
    }),
    VineVitePlugin(),
    // Monaco 中文本地化
    // MonacoEditorNlsPlugin({ locale: Languages.zh_hans }),
  ],
  server: { port: 51000 },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  define: {
    'process.env': {},
    'global': 'window',
    '__BUILD_TIME__': JSON.stringify(new Date().toISOString()),
  },
  optimizeDeps: {
    include: ['@vicons/fluent', '@vicons/ionicons5', 'vue', 'vue-router'],
    esbuildOptions: {
      // plugins: [
      //   esbuildPluginMonacoEditorNls({ locale: Languages.zh_hans }),
      // ],
    },
  },
  build: {
    // 生产环境建议关闭以减少产物体积与网络请求
    sourcemap: false,
    target: 'esnext',
    minify: 'oxc',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: { // @ts-ignore
        advancedChunks: {
          groups: [
            {
              name: 'vue-vendor',
              test: /[\\/]node_modules[\\/](vue|vue-router|pinia)[\\/]/,
              priority: -10,
            },
            {
              name: 'ui-vendor',
              test: /[\\/]node_modules[\\/](naive-ui|@vueuse[\\/]core)[\\/]/,
              priority: -10,
            },
            // 精细化切分大体积依赖，提升缓存与首屏体积可控性
            {
              name: 'echarts-vendor',
              test: /[\\/]node_modules[\\/](echarts|zrender|vue-echarts)[\\/]/,
              priority: -20,
            },
            {
              name: 'wangeditor-vendor',
              test: /[\\/]node_modules[\\/]@wangeditor[\\/]/,
              priority: -20,
            },
            {
              name: 'hyperdx-vendor',
              test: /[\\/]node_modules[\\/]@hyperdx[\\/]/,
              priority: -20,
            },
            {
              name: 'xlsx-vendor',
              test: /[\\/]node_modules[\\/]xlsx[\\/]/,
              priority: -20,
            },
            {
              name: 'jszip-vendor',
              test: /[\\/]node_modules[\\/]jszip[\\/]/,
              priority: -20,
            },
            {
              name: 'html2canvas-vendor',
              test: /[\\/]node_modules[\\/]html2canvas[\\/]/,
              priority: -20,
            },
          ],
        },
      },
    },
  },
})
