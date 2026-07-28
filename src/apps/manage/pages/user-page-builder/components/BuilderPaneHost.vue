<script setup lang="ts">
import type { BuilderColumnId } from '../useBuilderLayout'
import BuilderBlocksPane from './BuilderBlocksPane.vue'
import BuilderPagesPane from './BuilderPagesPane.vue'
import BuilderPreviewPane from './BuilderPreviewPane.vue'
import BuilderPropsPane from './BuilderPropsPane.vue'

defineProps<{
  paneId: BuilderColumnId
  pagesCollapsed: boolean
  pagesCollapsible: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-pages-collapse'): void
}>()
</script>

<template>
  <BuilderPagesPane
    v-if="paneId === 'pages'"
    :collapsed="pagesCollapsed"
    :collapsible="pagesCollapsible"
    @toggle-collapse="emit('toggle-pages-collapse')"
  />
  <BuilderBlocksPane v-else-if="paneId === 'blocks'" />
  <BuilderPreviewPane v-else-if="paneId === 'preview'" />
  <BuilderPropsPane v-else />
</template>
