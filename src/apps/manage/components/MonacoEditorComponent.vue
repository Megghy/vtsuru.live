<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

const { language, height = 400, theme = 'vs-dark', options, path } = defineProps<{
  language: string
  height?: number
  theme?: string
  options?: Record<string, any>
  path?: string
}>()

const value = defineModel<string>('value')

// 在创建编辑器前确保容器存在
const ready = ref(false)
const initError = ref<string | null>(null)
const containerRef = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let model: monaco.editor.ITextModel | null = null
let createdModel = false

// 配置 Monaco Environment
;(globalThis as any).MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'json') {
      return new JsonWorker()
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new CssWorker()
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new HtmlWorker()
    }
    if (label === 'typescript' || label === 'javascript') {
      return new TsWorker()
    }
    return new EditorWorker()
  },
}

onMounted(async () => {
  try {
    const uri = monaco.Uri.parse(
      path ?? `inmemory://model/${crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}.${language ?? 'txt'}`,
    )
    model = monaco.editor.getModel(uri)
    if (!model) {
      model = monaco.editor.createModel(value?.value ?? '', language, uri)
      createdModel = true
    }

    editor = monaco.editor.create(containerRef.value!, {
      model,
      theme,
      automaticLayout: true,
      ...(options ?? {}),
    })

    // 同步 model -> v-model
    editor.onDidChangeModelContent(() => {
      const current = model!.getValue()
      if (current !== value.value) value.value = current
    })

    ready.value = true
  } catch (err) {
    console.error('Monaco 初始化失败:', err)
    initError.value = (err as Error)?.message ?? String(err)
  }
})

// v-model 变更 -> model
watch(value, (nv) => {
  if (model && typeof nv === 'string' && nv !== model.getValue()) {
    model.setValue(nv)
  }
})

// 语言切换
watch(() => language, (lang) => {
  if (model && lang) {
    monaco.editor.setModelLanguage(model, lang)
  }
})

// 主题切换
watch(() => theme, (t) => {
  if (editor && t) {
    editor.updateOptions({ theme: t })
  }
})

onBeforeUnmount(() => {
  try {
    editor?.dispose()
    // 仅销毁我们创建的临时 model，避免复用路径时把共享 model 误删
    if (createdModel && model) {
      model.dispose()
    }
  } catch {}
})
</script>

<template>
  <div :style="`height: ${height}px; width: 100%; position: relative;`">
    <div v-if="!ready" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color: var(--text-color, #888); text-align:center; padding:8px;">
      <div>
        <div>正在加载编辑器…</div>
        <div v-if="initError" style="margin-top:6px; color:#d9534f; font-size:12px;">
          {{ initError }}
        </div>
      </div>
    </div>
    <div ref="containerRef" :style="`height: ${height}px; width: 100%;`" />
  </div>
</template>
