<script setup lang="ts">
import type { AssistantProposal, ScheduleEditItem } from '../api/assistant'
import GenericSchemaActionCard from './actions/GenericSchemaActionCard.vue'
import ScheduleActionCard from './actions/ScheduleActionCard.vue'

defineProps<{ proposal: AssistantProposal, editable?: boolean }>()

/** 日程提案的编辑草稿 (按预览下标改安全字段) */
const draft = defineModel<ScheduleEditItem[]>('draft')
</script>

<template>
  <ScheduleActionCard
    v-if="proposal.kind === 'schedule.change'"
    v-model:draft="draft"
    :preview="proposal.preview"
    :editable="editable"
  />
  <GenericSchemaActionCard
    v-else
    :preview="proposal.preview"
  />
</template>
