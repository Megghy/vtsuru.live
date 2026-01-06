import antfu from '@antfu/eslint-config'
import VueVine from '@vue-vine/eslint-config'
import oxlint from 'eslint-plugin-oxlint'

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

    // 格式化规则过于“强约束”，会导致大量无意义报错；保留代码质量规则即可
    stylistic: false,

    // 禁用某些文件类型的支持
    jsonc: true,
    yaml: true,
    markdown: true,

    // 忽略的文件
    ignores: [
      '.oxlintrc.json',
      'docs/**',
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
      'ts/no-floating-promises': 'off', // 允许不 await Promise
      'ts/no-misused-promises': 'off', // 允许在条件表达式中使用 Promise
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      'ts/no-use-before-define': 'off',
      '@typescript-eslint/no-use-before-define': 'off',

      // 通用规则
      'no-console': 'off',
      'unused-imports/no-unused-vars': 'warn',
      'eqeqeq': 'off', // 允许使用 == 和 !=
      'no-eq-null': 'off', // 允许使用 == null
      '@typescript-eslint/strict-boolean-expressions': 'off', // 允许宽松的布尔表达式
      'prefer-template': 'off',

      // 关闭一些过于严格的规则
      'antfu/if-newline': 'off',
      'prefer-promise-reject-errors': 'off', // 允许 reject 任何值
      'no-throw-literal': 'off', // 允许 throw 任何值
      'ts/no-unsafe-assignment': 'off', // 允许不安全的赋值
      'ts/no-unsafe-member-access': 'off', // 允许不安全的成员访问
      'ts/no-unsafe-call': 'off', // 允许不安全的调用
      'ts/switch-exhaustiveness-check': 'off',
      'ts/restrict-template-expressions': 'off', // 允许模板字符串表达式不受限制

      'perfectionist/sort-imports': 'off',
      'perfectionist/sort-named-imports': 'off',
      'ts/no-unsafe-argument': 'off', // 允许不安全的参数传递

      // JSON 相关规则
      'jsonc/sort-keys': 'off', // 关闭 JSON key 排序要求
    },
  },
  // 集成 VueVine 配置
  ...VueVine(),
  // 集成 oxlint 配置 - 必须放在最后以禁用与 oxlint 冲突的 ESLint 规则
  oxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
)
