<script setup lang="ts">
import type { AutoActionItem } from '@/client/store/autoAction/types'
import TemplateEditor from './TemplateEditor.vue'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
  title: {
    type: String,
    default: '回复模板',
  },
  description: {
    type: String,
    default: '在这里编辑自动回复的模板，支持变量和JavaScript表达式',
  },
})

// Handle the update event from TemplateEditor
function handleTemplateUpdate(payload: { index: number, value: string }) {
  // This component edits the first template (index 0)
  // Assuming props.action.templates should be a single string based on type error
  if (payload.index === 0) {
    props.action.template = payload.value
  }
}
</script>

<template>
  <TemplateEditor
    :template="props.action"
    :template-index="0"
    :title="title"
    :description="description"
    @update:template="handleTemplateUpdate"
  />
</template>
