<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { APIFileModel } from '@/api/generated/model'
import { configureMonacoEnvironment } from '@/apps/manage/components/monacoEnvironment'
import type { CustomHtmlAsset } from '@/apps/user-page/block/customHtmlContract'
import type { CustomCodeIssue } from '@/apps/user-page/block/customHtmlRuntime'

import { registerCustomHtmlEditorProviders } from './customHtmlEditorLanguage'
import { registerCustomHtmlHighlighter } from '../monaco-vue/highlight'
import { activateCustomHtmlVolar } from '../monaco-vue/volar'

const props = defineProps<{
  source: string
  theme: 'vs' | 'vs-dark'
  assets: CustomHtmlAsset[]
  resources: APIFileModel[]
  issues: CustomCodeIssue[]
  language?: 'vue' | 'css'
}>()
const emit = defineEmits<{
  (event: 'update:source', value: string): void
}>()

configureMonacoEnvironment()
const container = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let model: monaco.editor.ITextModel | null = null
let providers: monaco.IDisposable[] = []
let widgetsHost: HTMLDivElement | null = null
let shikiThemes = { light: 'light-plus', dark: 'dark-plus' }

function editorTheme() {
  return props.theme === 'vs-dark' ? shikiThemes.dark : shikiThemes.light
}

function monacoThemeClass() {
  return props.theme === 'vs-dark' ? 'vs-dark' : 'vs'
}

function syncWidgetsHostTheme() {
  if (!widgetsHost) return
  widgetsHost.className = `monaco-editor ${monacoThemeClass()}`
}

function setMarkers() {
  if (!model) return
  monaco.editor.setModelMarkers(
    model,
    'vtsuru-custom-html',
    props.issues.map((item) => ({
      severity: monaco.MarkerSeverity.Error,
      message: item.message,
      startLineNumber: Math.max(1, item.line),
      startColumn: Math.max(1, item.column),
      endLineNumber: Math.max(1, item.line),
      endColumn: Math.max(2, item.column + 1),
    })),
  )
}

function insertText(value: string) {
  if (!editor) return
  const current = editor.getModel()
  const selection = editor.getSelection()
  const range =
    selection ??
    (current
      ? new monaco.Range(
          current.getLineCount(),
          current.getLineMaxColumn(current.getLineCount()),
          current.getLineCount(),
          current.getLineMaxColumn(current.getLineCount()),
        )
      : null)
  if (!range) return
  editor.executeEdits('vtsuru-custom-html', [{ range, text: value, forceMoveMarkers: true }])
  editor.focus()
}

function setContent(value: string) {
  const current = editor?.getModel()
  if (!editor || !current) return
  editor.executeEdits('vtsuru-custom-html', [{ range: current.getFullModelRange(), text: value, forceMoveMarkers: true }])
  editor.setPosition({ lineNumber: 1, column: 1 })
  editor.revealPosition({ lineNumber: 1, column: 1 })
  editor.focus()
}

function clearContent() {
  setContent('')
}

function focus() {
  editor?.focus()
}

async function formatDocument() {
  await editor?.getAction('editor.action.formatDocument')?.run()
}

defineExpose({ insertText, setContent, clearContent, formatDocument, focus })

onMounted(() => {
  shikiThemes = registerCustomHtmlHighlighter()
  const monacoLanguage = props.language === 'css' ? 'css' : 'vue'
  if (monacoLanguage === 'vue') void activateCustomHtmlVolar()
  widgetsHost = document.createElement('div')
  widgetsHost.style.cssText =
    'position:absolute;inset:0;z-index:2147483647;overflow:visible;background:transparent;pointer-events:none'
  const widgetStyle = document.createElement('style')
  widgetStyle.textContent =
    '.monaco-hover,.suggest-widget,.parameter-hints-widget{pointer-events:auto;user-select:text}'
  widgetsHost.append(widgetStyle)
  syncWidgetsHostTheme()
  document.body.append(widgetsHost)
  model = monaco.editor.createModel(
    props.source,
    monacoLanguage,
    monaco.Uri.parse(
      props.language === 'css'
        ? `file:///style-${crypto.randomUUID()}.css`
        : `file:///App-${crypto.randomUUID()}.vue`,
    ),
  )
  editor = monaco.editor.create(container.value!, {
    model,
    theme: editorTheme(),
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: 'on',
    fontSize: 13,
    lineNumbersMinChars: 3,
    padding: { top: 12, bottom: 12 },
    scrollBeyondLastLine: false,
    tabSize: 2,
    insertSpaces: true,
    fixedOverflowWidgets: true,
    overflowWidgetsDomNode: widgetsHost,
    quickSuggestions: { other: 'on', comments: 'on', strings: 'on' },
    suggestOnTriggerCharacters: true,
    snippetSuggestions: 'inline',
    wordBasedSuggestions: 'currentDocument',
    tabCompletion: 'on',
    parameterHints: { enabled: true },
    hover: { enabled: 'on', sticky: true, delay: 150, hidingDelay: 400 },
  })
  model.onDidChangeContent(() => emit('update:source', model!.getValue()))
  providers = registerCustomHtmlEditorProviders(monaco, monacoLanguage, () => props)
  setMarkers()
})

watch(
  () => props.theme,
  () => {
    monaco.editor.setTheme(editorTheme())
    syncWidgetsHostTheme()
  },
)
watch(
  () => props.source,
  (value) => {
    if (model && value !== model.getValue()) model.setValue(value)
  },
)
watch(() => props.issues, setMarkers, { deep: true })

onBeforeUnmount(() => {
  providers.forEach((item) => item.dispose())
  editor?.dispose()
  model?.dispose()
  widgetsHost?.remove()
})
</script>

<template>
  <div
    ref="container"
    class="code-editor"
    @click="focus"
  />
</template>
