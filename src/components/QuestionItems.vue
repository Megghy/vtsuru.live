<script setup lang="ts">
import type { ResponseQAInfoToTarget } from '@/api/generated/model'

import QuestionItem from './QuestionItem.vue'

defineProps<{
  questions: ResponseQAInfoToTarget[]
  selectable?: boolean
  selectedIds?: number[]
}>()

const emit = defineEmits<{ (e: 'select', id: number): void }>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <QuestionItem
      v-for="item in questions"
      :key="item?.id"
      :item="item"
      :selectable="selectable"
      :selected="selectedIds?.includes(item.id)"
      @select="emit('select', $event)"
    >
      <template #footer>
        <slot
          name="footer"
          :item="item"
        />
      </template>
      <template #header-extra>
        <slot
          name="header-extra"
          :item="item"
        />
      </template>
    </QuestionItem>
  </div>
</template>
