import antfu from '@antfu/eslint-config'
import VueVine from '@vue-vine/eslint-config'

export default antfu(
  {
    // 项目类型: app (默认) 或 lib
    type: 'app',

    // 启用 TypeScript 支持 (自动检测)
    typescript: {
      tsconfigPath: 'tsconfig.json',
    },

    // 启用 Vue 支持 (自动检测)
    vue: true,

    // 启用格式化规则
    stylistic: {
      indent: 2,
      quotes: 'single',
      semi: false,
    },

    // 禁用某些文件类型的支持
    jsonc: true,
    yaml: true,
    markdown: true,

    // 忽略的文件
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/output',
      '**/.vitepress/cache',
      '**/.nuxt',
      '**/.next',
      '**/.vercel',
      '**/.changeset',
      '**/.idea',
      '**/.cache',
      '**/.output',
      '**/.vite-inspect',
      '**/CHANGELOG*.md',
      '**/*.min.*',
      '**/LICENSE*',
      '**/__snapshots__',
      '**/auto-import?(s).d.ts',
      '**/components.d.ts',
    ],
  },
  {
    // 自定义规则
    rules: {
      // Vue 相关规则
      'vue/multi-word-component-names': 'off',
      'vue/no-mutating-props': 'off',
      'vue/no-v-html': 'off',
      'vue/require-default-prop': 'off',

      // TypeScript 相关规则
      'ts/no-explicit-any': 'off',
      'ts/ban-ts-comment': 'off',

      // 通用规则
      'no-console': 'off',
      'unused-imports/no-unused-vars': 'warn',
      
      // 关闭一些过于严格的规则
      'antfu/if-newline': 'off',
      'style/brace-style': ['error', '1tbs'],
    },
  },
  // 集成 VueVine 配置
  ...VueVine(),
)
