// eslint.config.js
module.exports = [
  {
    name: 'base',
    root: true,
    env: {
      node: true,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      parser: '@typescript-eslint/parser',
      sourceType: 'module', // Assumed based on the usage of TypeScript and modules
    },
    globals: {}, // Define any global variables if needed
    linterOptions: {
      reportUnusedDisableDirectives: 'error', // Adjust based on preference
    },
    plugins: {
      vue: require('eslint-plugin-vue'),
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
      prettier: require('eslint-plugin-prettier'),
      oxlint: require('eslint-plugin-oxlint'),
    },
    settings: {}, // Add shared settings here if necessary
    ignores: [
      // Patterns for files to ignore, adjust as necessary
    ],
    files: ['**/*.js', '**/*.jsx'],
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/no-mutating-props': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-var-requires': 'warn',
    },
    extends: [
      '@vue/typescript/recommended',
      'plugin:vue/vue3-essential',
      'prettier',
      '@vue/eslint-config-typescript',
      'plugin:oxlint/recommended',
    ],
  },
  {
    name: 'TypeScript',
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: '@typescript-eslint/parser',
      sourceType: 'module', // Explicitly defined for TypeScript files
    },
    rules: {
      // TypeScript specific rules overwrites or additions
      '@typescript-eslint/no-explicit-any': 'off',
    },
    extends: [
      '@vue/typescript/recommended',
      // TypeScript specific extended configurations...
    ],
  },
]
