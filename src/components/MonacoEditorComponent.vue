<template>
  <div ref="editorContainer" :style="`height: ${height}px;`"></div>
</template>

<script setup lang="ts">
import { editor } from 'monaco-editor';	// 全部导入
import { ref, onMounted } from 'vue';

const value = defineModel<string>('value')

const { language, height = 400 } = defineProps<{
  language: string
  height?: number
}>()

const editorContainer = ref()

onMounted(() => {
  const e = editor.create(editorContainer.value, {
    value: value.value,
    language: language,
    minimap: {
      enabled: true
    },
    colorDecorators: true,
    automaticLayout: true
  })
  e.onDidChangeModelContent(() => {
    value.value = e.getValue()
  })
})
</script>