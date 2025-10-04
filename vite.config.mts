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
import { visualizer } from 'rollup-plugin-visualizer';

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
    visualizer({
      open: false, // 不自动打开浏览器，避免影响 CI/CD
      gzipSize: true, // 显示 Gzip 压缩后的大小
      brotliSize: true, // 显示 Brotli 压缩后的大小
      filename: 'dist/stats.html', // 分析报告的输出路径
      template: 'treemap', // 使用树图模式展示
      sourcemap: true, // 使用 sourcemap 进行更精确的分析
    }),
  ],
  server: { port: 51000 },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  define: {
    'process.env': {},
    'global': 'window',
    '__BUILD_TIME__': JSON.stringify(new Date().toISOString()),
  },
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      '@vueuse/core',
      'naive-ui',
      'date-fns',
      '@vicons/fluent',
      '@vicons/ionicons5',
    ],
    exclude: ['@tauri-apps/api', '@tauri-apps/plugin-autostart', '@tauri-apps/plugin-http'],
  },
  build: {
    sourcemap: true,
    target: 'esnext',
    minify: 'oxc',
    chunkSizeWarningLimit: 1600, // 调整警告阈值，gamepad-assets 会比较大
    cssCodeSplit: true,
    cssMinify: 'lightningcss',
    assetsInlineLimit: 4096, // 4KB，默认值，可根据需要调整
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            {
              name: (id: string) => {
                // 核心框架 - Vue 全家桶保持在一起，避免循环依赖
                /*if (id.includes('node_modules/vue/') || 
                    id.includes('node_modules/@vue/') ||
                    id.includes('node_modules/vue-router/') ||
                    id.includes('node_modules/pinia/') ||
                    id.includes('node_modules/@vueuse/')) {
                  return 'vue-vendor'
                }*/

                // UI 框架及相关
                if (id.includes('node_modules/naive-ui/') || id.includes('node_modules/vueuc/')) {
                  return 'naive-ui'
                }

                // 图标库
                if (id.includes('node_modules/@vicons/')) {
                  return 'icons'
                }

                // Gamepad 配置和资源（体积大，单独分离）
                if (id.includes('/gamepadConfigs') || id.includes('assets/controller/')) {
                  return 'gamepad-assets'
                }

                // 字典文件（拼音、假名等，按需加载）
                if (id.includes('/dictPinyin')) {
                  return 'dict-pinyin'
                }
                if (id.includes('/dictKana')) {
                  return 'dict-kana'
                }

                // Monaco Editor (代码编辑器，体积大)
                if (id.includes('node_modules/monaco-editor/') || id.includes('node_modules/@guolao/vue-monaco-editor/')) {
                  return 'monaco-editor'
                }

                // ECharts (图表库，体积大)
                if (id.includes('node_modules/echarts/') || id.includes('node_modules/vue-echarts/')) {
                  return 'echarts'
                }

                // 富文本编辑器
                if (id.includes('node_modules/@wangeditor/')) {
                  return 'wangeditor'
                }

                // SignalR 相关
                if (id.includes('node_modules/@microsoft/signalr')) {
                  return 'signalr'
                }

                // Tauri 相关（客户端专用）
                if (id.includes('node_modules/@tauri-apps/')) {
                  return 'tauri'
                }

                // B站直播弹幕客户端
                if (id.includes('node_modules/bilibili-live-danmaku/')) {
                  return 'bili-danmaku'
                }

                // 工具库
                if (id.includes('node_modules/lodash/')) {
                  return 'lodash'
                }
                if (id.includes('node_modules/date-fns/')) {
                  return 'date-fns'
                }

                // Excel 相关 (体积大)
                if (id.includes('node_modules/xlsx/')) {
                  return 'xlsx'
                }

                // 压缩和解压
                if (id.includes('node_modules/jszip/') || id.includes('node_modules/@oneidentity/zstd-js/')) {
                  return 'compression'
                }

                // 其他大型依赖
                if (id.includes('node_modules/html2canvas/')) {
                  return 'html2canvas'
                }
                if (id.includes('node_modules/cropperjs/') || id.includes('node_modules/vue-cropperjs/')) {
                  return 'cropper'
                }

                // 通用 node_modules 分离
                if (id.includes('node_modules/')) {
                  return 'vendor'
                }

                return null
              },
            },
          ],
        },
      },
    },
  },
})
