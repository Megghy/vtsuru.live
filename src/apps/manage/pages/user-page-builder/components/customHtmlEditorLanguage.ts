import type * as monaco from 'monaco-editor'

import type { APIFileModel } from '@/api/generated/model'
import type { CustomHtmlAsset } from '@/apps/user-page/block/customHtmlContract'

const THEME_VARIABLES = [
  '--foreground',
  '--muted-foreground',
  '--background',
  '--popover',
  '--border',
  '--primary',
  '--radius',
  '--border-width',
  '--border-style',
  '--ui-shadow',
]
const VUE_DIRECTIVES = [
  'v-if',
  'v-else',
  'v-else-if',
  'v-for',
  'v-show',
  'v-model',
  'v-bind',
  'v-on',
  'v-html',
  'v-text',
  'v-slot',
  'v-once',
  'v-memo',
]
const VTSURU_APIS = [
  { name: 'getContext', args: '', await: true, doc: '当前主播、公开 B 站资料、主题与页面信息。' },
  { name: 'getSongs', args: 'filter?', await: true, doc: '主播歌单，默认最多 50 首，limit 最大 100。' },
  { name: 'getSongRequestState', args: '', await: true, doc: '当前点歌队列及公开点歌设置。' },
  { name: 'getSchedule', args: 'options?', await: true, doc: '主播日程与 B 站直播预约。' },
  { name: 'getCheckInRanking', args: 'options?', await: true, doc: '签到排行，count 范围 1 至 100。' },
  { name: 'getQuestions', args: 'options?', await: true, doc: '公开问答；匿名邮箱与认证身份不会返回。' },
  { name: 'getPointGoods', args: '', await: true, doc: '公开积分商品。' },
  { name: 'getVideoCollects', args: '', await: true, doc: '进行中的视频征集活动。' },
  { name: 'getAssetUrl', args: 'key', await: false, doc: '读取已绑定资源 URL，找不到时返回 null。' },
  { name: 'requestSong', args: 'keyOrName', await: true, doc: '宿主确认后提交网页点歌；仅指令点歌时复制指令。' },
  { name: 'openQuestionBox', args: 'defaultTag?', await: true, doc: '打开带验证码的原生提问箱。' },
  { name: 'navigate', args: 'target', await: true, doc: '跳转当前主播主页、子页面或指定站内功能。' },
  { name: 'copyText', args: 'text', await: true, doc: '复制最多 500 字符并展示宿主提示。' },
  { name: 'toast', args: "message, type?", await: true, doc: '宿主提示。' },
  { name: 'onThemeChange', args: 'callback', await: false, doc: '监听站点主题变化。' },
  { name: 'reportHeight', args: 'height', await: false, doc: '通知宿主更新当前沙盒的内容高度。' },
]

type AssetEntry = { key: string; file: APIFileModel }
type Region = 'script' | 'template' | 'style' | 'other'

export function hoverMarkdown(word: string) {
  if (word === 'vtsuru') return '**vtsuru**\n\n沙盒宿主 SDK。在 `<script setup>` 中调用，例如 `await vtsuru.getSongs()`。'
  const api = VTSURU_APIS.find((item) => item.name === word)
  if (api) return `**vtsuru.${api.name}(${api.args})**\n\n${api.doc}`
  if (VUE_DIRECTIVES.includes(word)) return `**${word}**\n\nVue 指令`
  const theme = THEME_VARIABLES.find((item) => item === word || item.slice(2) === word)
  if (theme) return `**${theme}**\n\n主题 CSS 变量，使用 \`var(${theme})\``
  return null
}

export function detectSfcRegion(text: string, offset: number, language?: 'vue' | 'css'): Region {
  if (language === 'css') return 'style'
  const re = /<(script|template|style)\b[^>]*>([\s\S]*?)<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    const innerStart = match.index + match[0].indexOf('>') + 1
    if (offset >= innerStart && offset <= innerStart + match[2].length) {
      return match[1].toLowerCase() as Region
    }
  }
  return 'other'
}

function item(
  monacoApi: typeof monaco,
  range: monaco.IRange,
  label: string,
  insertText: string,
  kind: monaco.languages.CompletionItemKind,
  detail: string,
  snippet = false,
): monaco.languages.CompletionItem {
  return {
    label,
    kind,
    insertText,
    detail,
    documentation: detail,
    range,
    insertTextRules: snippet ? monacoApi.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
    sortText: `0_${label}`,
  }
}

function assetEntries(assets: CustomHtmlAsset[], resources: APIFileModel[]): AssetEntry[] {
  const entries = new Map(assets.map((asset) => [asset.key, asset.file]))
  resources.forEach((file) => entries.set(`file-${file.id}`, file))
  return [...entries].map(([key, file]) => ({ key, file }))
}

function assetSuggestions(
  monacoApi: typeof monaco,
  range: monaco.IRange,
  assets: AssetEntry[],
  region: Region,
  prefix: string,
) {
  const bound = /data-vtsuru-asset\s*=\s*["'][^"']*$/.test(prefix)
  return assets.map(({ key, file }) =>
    item(
      monacoApi,
      range,
      `${key} · ${file.name}`,
      bound
        ? key
        : region === 'style'
          ? `var(--vtsuru-asset-${key})`
          : region === 'script'
            ? `vtsuru.getAssetUrl('${key}')`
            : `<img data-vtsuru-asset="${key}" alt="">`,
      monacoApi.languages.CompletionItemKind.File,
      file.path,
    ),
  )
}

function scriptSuggestions(monacoApi: typeof monaco, range: monaco.IRange, prefix: string, assets: AssetEntry[]) {
  if (/\bvtsuru\.\w*$/.test(prefix)) {
    return VTSURU_APIS.map((api) =>
      item(
        monacoApi,
        range,
        api.name,
        `${api.name}(${api.args ? '$0' : ''})`,
        monacoApi.languages.CompletionItemKind.Method,
        api.doc,
        true,
      ),
    )
  }
  return [
    item(monacoApi, range, 'vtsuru', 'vtsuru', monacoApi.languages.CompletionItemKind.Variable, '沙盒宿主 SDK'),
    ...VTSURU_APIS.map((api) =>
      item(
        monacoApi,
        range,
        `vtsuru.${api.name}`,
        `${api.await ? 'await ' : ''}vtsuru.${api.name}(${api.args ? '$0' : ''})`,
        monacoApi.languages.CompletionItemKind.Method,
        api.doc,
        true,
      ),
    ),
    ...assetSuggestions(monacoApi, range, assets, 'script', prefix),
  ]
}

function templateSuggestions(monacoApi: typeof monaco, range: monaco.IRange, prefix: string, assets: AssetEntry[]) {
  if (/data-vtsuru-asset\s*=\s*["'][^"']*$/.test(prefix)) return assetSuggestions(monacoApi, range, assets, 'template', prefix)
  return [
    ...VUE_DIRECTIVES.map((name) =>
      item(monacoApi, range, name, name, monacoApi.languages.CompletionItemKind.Keyword, 'Vue 指令'),
    ),
    item(
      monacoApi,
      range,
      'data-vtsuru-asset',
      'data-vtsuru-asset="${1:file-id}"',
      monacoApi.languages.CompletionItemKind.Property,
      '绑定已上传图片',
      true,
    ),
    ...assetSuggestions(monacoApi, range, assets, 'template', prefix),
  ]
}

function styleSuggestions(monacoApi: typeof monaco, range: monaco.IRange, assets: AssetEntry[]) {
  return [
    ...THEME_VARIABLES.map((variable) =>
      item(
        monacoApi,
        range,
        variable,
        `var(${variable})`,
        monacoApi.languages.CompletionItemKind.Variable,
        '主题变量',
      ),
    ),
    ...assetSuggestions(monacoApi, range, assets, 'style', ''),
  ]
}

export function registerCustomHtmlEditorProviders(
  monacoApi: typeof monaco,
  language: 'vue' | 'css',
  getContext: () => {
    language?: 'vue' | 'css'
    assets: CustomHtmlAsset[]
    resources: APIFileModel[]
  },
) {
  const wordRange = (model: monaco.editor.ITextModel, position: monaco.Position) => {
    const word = model.getWordUntilPosition(position)
    return new monacoApi.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
  }
  const regionAt = (model: monaco.editor.ITextModel, position: monaco.Position) =>
    detectSfcRegion(model.getValue(), model.getOffsetAt(position), getContext().language)

  return [
    monacoApi.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ['.', '"', "'", '-', 'v', '@', ' ', '('],
      provideCompletionItems(model, position) {
        if (model.getLanguageId() !== language) return { suggestions: [] }
        const range = wordRange(model, position)
        const region = regionAt(model, position)
        const prefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
        const assets = assetEntries(getContext().assets, getContext().resources)
        const suggestions =
          region === 'style'
            ? styleSuggestions(monacoApi, range, assets)
            : region === 'script'
              ? scriptSuggestions(monacoApi, range, prefix, assets)
              : templateSuggestions(monacoApi, range, prefix, assets)
        return { suggestions }
      },
    }),
    monacoApi.languages.registerHoverProvider(language, {
      provideHover(model, position) {
        if (model.getLanguageId() !== language) return null
        const word = model.getWordAtPosition(position)?.word
        const text = word ? hoverMarkdown(word) : null
        return text ? { contents: [{ value: text }] } : null
      },
    }),
    monacoApi.languages.registerSignatureHelpProvider(language, {
      signatureHelpTriggerCharacters: ['(', ','],
      provideSignatureHelp(model, position) {
        if (model.getLanguageId() !== language) return null
        const prefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
        const match = prefix.match(/vtsuru\.(\w+)\s*\($/)
        const api = VTSURU_APIS.find((item) => item.name === match?.[1])
        if (!api) return null
        return {
          dispose() {},
          value: {
            activeSignature: 0,
            activeParameter: 0,
            signatures: [
              {
                label: `vtsuru.${api.name}(${api.args})`,
                documentation: api.doc,
                parameters: api.args ? [{ label: api.args }] : [],
              },
            ],
          },
        }
      },
    }),
  ]
}
