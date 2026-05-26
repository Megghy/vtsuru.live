<script setup lang="ts">
import type { QAInfo } from '@/api/api-models'
import QuestionItem from './QuestionItem.vue'

defineProps<{
  questions: QAInfo[]
  selectable?: boolean
  selectedIds?: number[]
}>()

const emit = defineEmits<{ (e: 'select', id: number): void }>()
</script>

<template>
  <div class="question-list">
    <QuestionItem
      v-for="item in questions"
      :key="item?.id"
      :item="item"
      :selectable="selectable"
      :selected="selectedIds?.includes(item.id)"
      @select="emit('select', $event)"
    >
      <template #footer>
        <slot name="footer" :item="item" />
      </template>
      <template #header-extra>
        <slot name="header-extra" :item="item" />
      </template>
    </QuestionItem>
  </div>
</template>

<style scoped>
.question-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
