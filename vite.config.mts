// vite.config.ts
import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import { defineConfig, type Plugin } from 'vite'
import svgLoader from 'vite-svg-loader'

const nInputNumberFrom = '@/shared/ui/NInputNumber.vue'

function rewriteNInputNumberImports(): Plugin {
  return {
    name: 'rewrite-n-input-number-imports',
    // naive-ui 2.45 仍用 document mouseup 停长按，丢失后会连加；业务侧统一换包装组件。
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0].replaceAll('\\', '/')
      if (!/\.(vue|ts|tsx|js|mjs)$/.test(file)) return
      if (file.includes('/node_modules/')) return
      if (file.endsWith('/shared/ui/NInputNumber.vue')) return
      if (!code.includes('NInputNumber') || !code.includes('naive-ui')) return

      const next = code.replace(
        /import\s*\{([^}]*)\}\s*from\s*(['"])naive-ui\2/g,
        (full, spec: string, quote: string) => {
          const names = spec
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
          if (!names.some((name) => name === 'NInputNumber' || name.startsWith('NInputNumber '))) return full
          const rest = names.filter((name) => name !== 'NInputNumber' && !name.startsWith('NInputNumber '))
          const local = `import NInputNumber from ${quote}${nInputNumberFrom}${quote}`
          if (rest.length === 0) return local
          return `import { ${rest.join(', ')} } from ${quote}naive-ui${quote}\n${local}`
        },
      )
      if (next === code) return
      return { code: next, map: null }
    },
  }
}

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
    rewriteNInputNumberImports(),
    vue({
      script: { propsDestructure: true, defineModel: true },
      include: [/\.vue$/, /\.md$/],
      template: {
        compilerOptions: {
          isCustomElement: (tag) => {
            return tag.includes(':') || tag.startsWith('yt-') || tag.startsWith('altcha-')
          },
        },
      },
    }),
    vueJsx(),
    legacy({
      modernTargets: ['Chrome >= 90'],
      modernPolyfills: true,
      renderLegacyChunks: false,
    }),
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
    Markdown(),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        '@vueuse/core',
        'pinia',
        'date-fns',
        {
          'naive-ui': ['useDialog', 'useMessage', 'useNotification', 'useLoadingBar'],
        },
      ],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [
        (name) => {
          if (name === 'NInputNumber') return { from: nInputNumberFrom }
        },
        NaiveUiResolver(),
      ],
      dts: 'src/components.d.ts',
      extensions: ['vue', 'md'],
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
    }),
  ],
  server: { host: '0.0.0.0', port: 51000 },
  resolve: { alias: { '@': import.meta.dirname + '/src' } },
  define: {
    'process.env': {},
    // 用 globalThis 而非 window：主线程/Web Worker/Node 均存在，避免 worker 内 window 未定义报错
    global: 'globalThis',
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  optimizeDeps: {
    include: ['@vicons/fluent', '@vicons/ionicons5', 'vue', 'vue-router'],
  },
  build: {
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
              name: 'snapdom-vendor',
              test: /[\\/]node_modules[\\/]@zumer[\\/]snapdom[\\/]/,
              priority: -20,
            },
          ],
        },
      },
    },
  },
})
