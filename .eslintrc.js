module.exports = {
  root: true,
  env: {
    node: true,
    'vite/config': true, // 添加Vite环境支持
  },
  extends: [
    '@vue/typescript/recommended',
    'plugin:vue/vue3-essential',
    'prettier',
    '@vue/eslint-config-typescript',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'vue/component-name-in-template-casing': ['error', 'PascalCase'],
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      extends: [
        '@vue/typescript/recommended',
        // other TypeScript specific configurations...
      ],
      rules: {
        // TypeScript specific rules...
      },
    },
  ],
}
