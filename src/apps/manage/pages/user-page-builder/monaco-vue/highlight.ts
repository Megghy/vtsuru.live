import { shikiToMonaco } from '@shikijs/monaco'
import * as monaco from 'monaco-editor'
import { createHighlighterCoreSync } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import langCss from 'shiki/langs/css.mjs'
import langJsx from 'shiki/langs/jsx.mjs'
import langTsx from 'shiki/langs/tsx.mjs'
import langVue from 'shiki/langs/vue.mjs'
import themeDark from 'shiki/themes/dark-plus.mjs'
import themeLight from 'shiki/themes/light-plus.mjs'

const vueLanguageConfig: monaco.languages.LanguageConfiguration = {
  comments: { blockComment: ['<!--', '-->'] },
  brackets: [
    ['<!--', '-->'],
    ['<', '>'],
    ['{', '}'],
    ['(', ')'],
    ['[', ']'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: "'", close: "'" },
    { open: '"', close: '"' },
    { open: '`', close: '`' },
    { open: '<!--', close: '-->', notIn: ['comment', 'string'] },
  ],
  surroundingPairs: [
    { open: "'", close: "'" },
    { open: '"', close: '"' },
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '<', close: '>' },
  ],
  onEnterRules: [
    {
      beforeText: /<(?!area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)([A-Za-z][\w:-]*)([^>]*?)(?<!\/)>[^<]*$/i,
      afterText: /^<\/([A-Za-z][\w:-]*)\s*>/i,
      action: { indentAction: monaco.languages.IndentAction.IndentOutdent },
    },
    {
      beforeText: /<(?!area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)([A-Za-z][\w:-]*)([^>]*?)(?<!\/)>[^<]*$/i,
      action: { indentAction: monaco.languages.IndentAction.Indent },
    },
  ],
  wordPattern: /(-?\d*\.\d\w*)|([^\s`~!@$^&*()=+[{\]}\\|;:'",.<>/?]+)/g,
}

let registered = false

export function registerCustomHtmlHighlighter() {
  if (!registered) {
    monaco.languages.register({ id: 'vue', extensions: ['.vue'], aliases: ['Vue'] })
    monaco.languages.setLanguageConfiguration('vue', vueLanguageConfig)
    const highlighter = createHighlighterCoreSync({
      themes: [themeDark, themeLight],
      langs: [langVue, langTsx, langJsx, langCss],
      engine: createJavaScriptRegexEngine(),
    })
    shikiToMonaco(highlighter, monaco)
    registered = true
  }
  return {
    light: themeLight.name ?? 'light-plus',
    dark: themeDark.name ?? 'dark-plus',
  }
}
