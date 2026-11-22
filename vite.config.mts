// vite.config.ts

import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import { defineConfig } from 'vite'
import checker from 'vite-plugin-checker'
import svgLoader from 'vite-svg-loader'

import { customHtmlSandboxLibsPlugin } from './customHtmlSandboxLibsPlugin.ts'

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
  appType: 'spa',
  plugins: [
    customHtmlSandboxLibsPlugin(),
    checker({
      enableBuild: false,
      vueTsc: {
        tsconfigPath: 'tsconfig.json',
        // 并行模式减少检查时间
        root: import.meta.dirname,
      },
      // 仅在 build 时启用 overlay，避免开发时过多干扰
      overlay: { initialIsOpen: false },
    }),
    UnoCSS(),
    {
      name: 'drop-ort-wasm',
      generateBundle(_, bundle) {
        for (const key of Object.keys(bundle)) {
          if (key.includes('ort-wasm') && key.endsWith('.wasm')) {
            delete bundle[key]
          }
        }
      },
    },
    vue({
      script: { propsDestructure: true, defineModel: true },
      include: [/\.vue$/, /\.md$/],
      template: {
        compilerOptions: {
          isCustomElement: (tag) => {
            return tag.includes(':') || tag.startsWith('yt-') || tag.startsWith('cap-')
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
          'cleanupIds',
        ],
      },
    }),
    Markdown({}),
    AutoImport({
      imports: ['vue', 'vue-router', '@vueuse/core', 'pinia', 'date-fns'],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [],
      dts: 'src/components.d.ts',
      extensions: ['vue', 'md'],
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
    }),
  ],
  server: { host: '0.0.0.0', port: 5100 },
  resolve: {
    alias: {
      '@': import.meta.dirname + '/src',
      '@vtsuru/danmaku': import.meta.dirname + '/packages/danmaku/src/index.ts',
    },
  },
  define: {
    'process.env': {},
    // 用 globalThis 而非 window：主线程/Web Worker/Node 均存在，避免 worker 内 window 未定义报错
    global: 'globalThis',
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  optimizeDeps: {
    include: ['@vicons/fluent', '@vicons/ionicons5', 'vue', 'vue-router'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: ['chrome90', 'edge90', 'firefox90', 'safari15'],
    manifest: true,
    // 生产环境建议关闭以减少产物体积与网络请求
    sourcemap: false,
    minify: 'oxc',
    // 当前存在 Monaco 与部分按页面懒加载的大块产物，保留告警会持续产生已知噪音。
    chunkSizeWarningLimit: 4000,
    rolldownOptions: {
      onLog(level, log, defaultHandler) {
        const logId = log.id ?? log.loc?.file ?? ''
        if (level === 'warn' && log.code === 'EVAL' && logId.includes('@protobufjs/inquire/index.js')) {
          return
        }
        defaultHandler(level, log)
      },
      output: {
        // @ts-ignore
        codeSplitting: {
          groups: [
            {
              // 基础运行时 helper 单独归组，避免被 echarts 等重型依赖吸纳导致非图表页反向引入
              name: 'runtime-vendor',
              test: /[\\/]node_modules[\\/](@babel[\\/]runtime|tslib|@swc[\\/]helpers)[\\/]/,
              priority: -3,
            },
            {
              // 优先级高于 sfc-compiler-vendor，防止编译器组递归吸纳 @vue/shared 导致首屏反向依赖编译器
              name: 'vue-vendor',
              test: /[\\/]node_modules[\\/](vue[\\/](dist|index)|@vue[\\/](runtime-core|runtime-dom|reactivity|shared)|vue-router|pinia)[\\/]/,
              priority: -4,
            },
            {
              // 自定义 HTML CSS 校验/重写与源码编译共享依赖，优先级高于编译器组以避免拉取 compiler-sfc
              name: 'css-tree-vendor',
              test: /[\\/]node_modules[\\/](css-tree|mdn-data|source-map-js)[\\/]/,
              priority: -5,
            },
            {
              // 自定义 HTML 编译专用依赖，严禁混入 vue-vendor 污染常规页面首屏
              name: 'sfc-compiler-vendor',
              test: /[\\/]node_modules[\\/](@vue[\\/]compiler-\w+|vue[\\/]compiler-sfc|sucrase|@babel[\\/]parser|estree-walker)[\\/]/,
              priority: -6,
            },
            {
              name: 'ui-vendor',
              test: /(?:[\\/]node_modules[\\/](@vueuse[\\/](core|router)|reka-ui|lucide-vue-next|vue-sonner|class-variance-authority|clsx|tailwind-merge|date-fns)[\\/]|[\\/]src[\\/]shared[\\/](ui[\\/](accordion|alert|badge|button|card|checkbox|dialog|dropdown-menu|empty|form-field|input|label|number-field|popover|progress|radio-group|select|separator|sheet|spin|switch|tabs|tag|textarea|toggle-group|tooltip)[\\/]|utils[\\/]cn\.ts|config[\\/]theme[\\/]scope\.ts))/,
              priority: -10,
            },
            {
              // 聚合零碎 @vicons 图标模块，大幅削减静态 HTTP 请求数
              name: 'icons-vendor',
              test: /[\\/]node_modules[\\/]@vicons[\\/]/,
              priority: -15,
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
              name: 'sentry-vendor',
              test: /[\\/]node_modules[\\/](@sentry|@fingerprintjs)[\\/]/,
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
              name: 'snapdom-vendor',
              test: /[\\/]node_modules[\\/]@zumer[\\/]snapdom[\\/]/,
              priority: -20,
            },
            {
              name: 'three-vendor',
              test: /[\\/]node_modules[\\/]three[\\/]/,
              priority: -20,
            },
          ],
        },
      },
    },
  },
})
