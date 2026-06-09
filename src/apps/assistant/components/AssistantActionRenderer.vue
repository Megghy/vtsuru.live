<script setup lang="ts">
import type { AssistantProposal, ProposalEditItem } from '../api/assistant'
import GenericSchemaActionCard from './actions/GenericSchemaActionCard.vue'

defineProps<{ proposal: AssistantProposal, editable?: boolean }>()

/** 通用编辑草稿: 按预览下标承载各字段新值 */
const draft = defineModel<ProposalEditItem[]>('draft')
</script>

<template>
  <GenericSchemaActionCard
    v-model:draft="draft"
    :preview="proposal.preview"
    :editable="editable"
  />
</template>
