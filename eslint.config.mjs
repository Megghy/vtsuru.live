import oxlint from 'eslint-plugin-oxlint';
import vue from 'eslint-plugin-vue';
import ts from 'typescript-eslint';

// `VueVine()` 返回一个 ESLint flat config
import VueVine from '@vue-vine/eslint-config'

export default [
  {
    languageOptions: {
      ecmaVersion: 'latest',
    },
  },
  ...vue.configs['flat/recommended'],
  {
    // files: ['*.vue', '**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
    },
    rules: {
      "vue/no-mutating-props": "off",
    },
  },
  ...VueVine(),
  ...oxlint.configs['flat/recommended'], // oxlint should be the last one
]
