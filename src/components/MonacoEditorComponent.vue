<script setup lang="ts">
import { editor } from 'monaco-editor'	// 全部导入
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const { language, height = 400 } = defineProps<{
  language: string
  height?: number
}>()

const value = defineModel<string>('value')

const editorContainer = ref<HTMLElement>()
let editorInstance: editor.IStandaloneCodeEditor | null = null

onMounted(() => {
  if (!editorContainer.value) return

  editorInstance = editor.create(editorContainer.value, {
    value: value.value,
    language,
    minimap: {
      enabled: true,
    },
    colorDecorators: true,
    automaticLayout: true,
  })

  editorInstance.onDidChangeModelContent(() => {
    if (editorInstance) {
      const currentValue = editorInstance.getValue()
      if (currentValue !== value.value) {
        value.value = currentValue
      }
    }
  })
})

onBeforeUnmount(() => {
  if (editorInstance) {
    editorInstance.dispose()
    editorInstance = null
  }
})

watch(value, (newValue) => {
  if (editorInstance && newValue !== editorInstance.getValue()) {
    editorInstance.setValue(newValue ?? '')
  }
})

watch(() => language, (newLang) => {
  if (editorInstance) {
    const model = editorInstance.getModel()
    if (model) {
      editor.setModelLanguage(model, newLang)
    }
  }
})
</script>

<template>
  <div
    ref="editorContainer"
    :style="`height: ${height}px;`"
  />
</template>
