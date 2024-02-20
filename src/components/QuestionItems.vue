<script setup lang="ts">
import { QAInfo } from '@/api/api-models'
import { NCard, NDivider, NFlex, NImage, NList, NListItem, NTag, NText, NTime, NTooltip } from 'naive-ui'
import QuestionItem from './QuestionItem.vue'

const props = defineProps<{
  questions: QAInfo[]
}>()
</script>

<template>
  <NList bordered>
    <NListItem v-for="item in questions" :key="item?.id">
      <QuestionItem :item="item">
        <template #footer>
          <slot name="footer" :item="item"></slot>
        </template>
        <template #header-extra>
          <slot name="header-extra" :item="item"></slot>
        </template>
      </QuestionItem>
    </NListItem>
  </NList>
</template>
