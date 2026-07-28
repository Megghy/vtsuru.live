<script setup lang="ts">
import type { APIFileModel } from '@/api/api-models'
import type { CustomCodeIssue } from '@/apps/user-page/block/customHtmlRuntime'
import type { CustomHtmlAsset } from '@/apps/user-page/block/customHtmlContract'
import { configureMonacoEnvironment } from '@/apps/manage/components/monacoEnvironment'
import * as monaco from 'monaco-editor'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  html: string
  css: string
  activeLanguage: 'html' | 'css'
  theme: 'vs' | 'vs-dark'
  assets: CustomHtmlAsset[]
  resources: APIFileModel[]
  issues: CustomCodeIssue[]
}>()
const emit = defineEmits<{
  (event: 'update:html', value: string): void
  (event: 'update:css', value: string): void
}>()

configureMonacoEnvironment()
const container = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let htmlModel: monaco.editor.ITextModel | null = null
let cssModel: monaco.editor.ITextModel | null = null
let activeLanguage = props.activeLanguage
let htmlViewState: monaco.editor.ICodeEditorViewState | null = null
let cssViewState: monaco.editor.ICodeEditorViewState | null = null
let completions: monaco.IDisposable[] = []

const THEME_VARIABLES = [
  '--vtsuru-fg',
  '--vtsuru-fg-muted',
  '--vtsuru-bg',
  '--vtsuru-bg-elevated',
  '--vtsuru-border',
  '--vtsuru-primary',
  '--vtsuru-radius',
]

function currentAssetEntries() {
  const entries = new Map(props.assets.map(asset => [asset.key, asset.file]))
  props.resources.forEach(file => entries.set(`file-${file.id}`, file))
  return [...entries].map(([key, file]) => ({ key, file }))
}

function replaceRange(model: monaco.editor.ITextModel, position: monaco.Position) {
  const word = model.getWordUntilPosition(position)
  return new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
}

function registerCompletions() {
  completions = [
    monaco.languages.registerCompletionItemProvider('html', {
      triggerCharacters: ['"', "'", '-'],
      provideCompletionItems(model, position) {
        if (model.uri.scheme !== 'user-page-custom') return { suggestions: [] }
        const prefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
        const insideAsset = /data-vtsuru-asset\s*=\s*["'][^"']*$/.test(prefix)
        const range = replaceRange(model, position)
        const assetItems = currentAssetEntries().map(({ key, file }) => ({
          label: `${key} · ${file.name}`,
          detail: file.path,
          kind: monaco.languages.CompletionItemKind.File,
          insertText: insideAsset ? key : `<img data-vtsuru-asset="${key}" alt="">`,
          range,
        }))
        if (insideAsset) return { suggestions: assetItems }
        return {
          suggestions: [
            {
              label: 'data-vtsuru-asset',
              detail: '绑定已上传图片',
              kind: monaco.languages.CompletionItemKind.Property,
              insertText: `data-vtsuru-asset="\${1:file-id}"`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
            },
            ...assetItems,
          ],
        }
      },
    }),
    monaco.languages.registerCompletionItemProvider('css', {
      triggerCharacters: ['-', '('],
      provideCompletionItems(model, position) {
        if (model.uri.scheme !== 'user-page-custom') return { suggestions: [] }
        const range = replaceRange(model, position)
        return {
          suggestions: [
            ...THEME_VARIABLES.map(variable => ({
              label: variable,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: `var(${variable})`,
              range,
            })),
            ...currentAssetEntries().map(({ key, file }) => ({
              label: `--vtsuru-asset-${key}`,
              detail: file.name,
              kind: monaco.languages.CompletionItemKind.File,
              insertText: `var(--vtsuru-asset-${key})`,
              range,
            })),
          ],
        }
      },
    }),
  ]
}

function modelFor(language: 'html' | 'css') {
  return language === 'html' ? htmlModel : cssModel
}

function switchLanguage(language: 'html' | 'css') {
  if (!editor || language === activeLanguage) return
  if (activeLanguage === 'html') htmlViewState = editor.saveViewState()
  else cssViewState = editor.saveViewState()
  activeLanguage = language
  editor.setModel(modelFor(language))
  editor.restoreViewState(language === 'html' ? htmlViewState : cssViewState)
  editor.focus()
}

function setMarkers() {
  if (!htmlModel || !cssModel) return
  const mapMarkers = (field: 'html' | 'css') => props.issues
    .filter(item => item.field === field || (field === 'html' && item.field === 'assets'))
    .map(item => ({
      severity: monaco.MarkerSeverity.Error,
      message: item.message,
      startLineNumber: Math.max(1, item.line),
      startColumn: Math.max(1, item.column),
      endLineNumber: Math.max(1, item.line),
      endColumn: Math.max(2, item.column + 1),
    }))
  monaco.editor.setModelMarkers(htmlModel, 'vtsuru-custom-html', mapMarkers('html'))
  monaco.editor.setModelMarkers(cssModel, 'vtsuru-custom-html', mapMarkers('css'))
}

function insertText(value: string) {
  if (!editor) return
  const selection = editor.getSelection()
  if (!selection) return
  editor.executeEdits('vtsuru-resource', [{ range: selection, text: value, forceMoveMarkers: true }])
  editor.focus()
}

async function formatDocument() {
  await editor?.getAction('editor.action.formatDocument')?.run()
}

defineExpose({ insertText, formatDocument })

onMounted(() => {
  const instance = crypto.randomUUID()
  htmlModel = monaco.editor.createModel(props.html, 'html', monaco.Uri.parse(`user-page-custom://component/${instance}.html`))
  cssModel = monaco.editor.createModel(props.css, 'css', monaco.Uri.parse(`user-page-custom://component/${instance}.css`))
  editor = monaco.editor.create(container.value!, {
    model: modelFor(activeLanguage),
    theme: props.theme,
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: 'on',
    fontSize: 13,
    lineNumbersMinChars: 3,
    padding: { top: 12, bottom: 12 },
    scrollBeyondLastLine: false,
    tabSize: 2,
    insertSpaces: true,
  })
  htmlModel.onDidChangeContent(() => emit('update:html', htmlModel!.getValue()))
  cssModel.onDidChangeContent(() => emit('update:css', cssModel!.getValue()))
  registerCompletions()
  setMarkers()
})

watch(() => props.activeLanguage, switchLanguage)
watch(() => props.theme, value => monaco.editor.setTheme(value))
watch(() => props.html, value => {
  if (htmlModel && value !== htmlModel.getValue()) htmlModel.setValue(value)
})
watch(() => props.css, value => {
  if (cssModel && value !== cssModel.getValue()) cssModel.setValue(value)
})
watch(() => props.issues, setMarkers, { deep: true })

onBeforeUnmount(() => {
  completions.forEach(item => item.dispose())
  editor?.dispose()
  htmlModel?.dispose()
  cssModel?.dispose()
})
</script>

<template>
  <div ref="container" class="code-editor" />
</template>

<style scoped>
.code-editor {
  width: 100%;
  height: 100%;
  min-height: 320px;
}
</style>
