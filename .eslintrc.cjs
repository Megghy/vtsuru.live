module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    '@vue/typescript/recommended',
    'plugin:vue/vue3-essential',
    'prettier',
    '@vue/eslint-config-typescript',
    'plugin:oxlint/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'vue/component-name-in-template-casing': ['error', 'PascalCase'],
    'vue/no-mutating-props': ['off'],
    '@typescript-eslint/no-explicit-any': ['off'],
    '@typescript-eslint/no-var-requires': ['warn'],
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
        '@typescript-eslint/no-explicit-any': ['off'],
      },
    },
  ],
}
