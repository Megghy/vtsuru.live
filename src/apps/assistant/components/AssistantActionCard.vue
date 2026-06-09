<script setup lang="ts">
import {
  NAlert, NButton, NCard, NFlex, NPopconfirm, NSpin, NTag, NText,
} from 'naive-ui'
import { computed, ref } from 'vue'
import type { AssistantAction } from '../store/useAssistantStore'
import type { ScheduleEditItem } from '../api/assistant'
import type { ActionStatus } from '../schemas/assistant'
import AssistantActionRenderer from './AssistantActionRenderer.vue'

const props = defineProps<{ action: AssistantAction }>()
const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'reject'): void
  (e: 'save', items: ScheduleEditItem[]): void
}>()

const STATUS_META: Record<ActionStatus, { label: string, type: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  draft: { label: '待确认', type: 'default' },
  requires_confirmation: { label: '需确认', type: 'warning' },
  running: { label: '执行中', type: 'info' },
  completed: { label: '已完成', type: 'success' },
  failed: { label: '失败', type: 'error' },
  rejected: { label: '已取消', type: 'default' },
}

const RISK_META: Record<string, { label: string, type: 'success' | 'warning' | 'error' }> = {
  low: { label: '低风险', type: 'success' },
  medium: { label: '中风险', type: 'warning' },
  high: { label: '高风险', type: 'error' },
}

const proposal = computed(() => props.action.proposal)
const editing = ref(false)
const scheduleDraft = ref<ScheduleEditItem[]>([])
const isPending = computed(() => proposal.value.status === 'draft' || proposal.value.status === 'requires_confirmation')
const isRunning = computed(() => proposal.value.status === 'running')
const isHighRisk = computed(() => proposal.value.risk === 'high')

function startEdit() {
  // 只把 add/modify 项放进可编辑草稿, 按 preview 下标对齐
  scheduleDraft.value = proposal.value.preview
    .map((it, index) => ({ it, index }))
    .filter(({ it }) => it.op !== 'delete')
    .map(({ it, index }) => ({ index, title: it.title, time: it.time ?? '' }))
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

function saveEdit() {
  emit('save', scheduleDraft.value)
  editing.value = false
}
</script>

<template>
  <NCard size="small" class="action-card" :bordered="true">
    <template #header>
      <NFlex align="center" :size="8" :wrap="false" class="action-card__header">
        <NText class="action-card__title">{{ proposal.title }}</NText>
        <NTag size="tiny" :type="RISK_META[proposal.risk]?.type" :bordered="false">
          {{ RISK_META[proposal.risk]?.label }}
        </NTag>
      </NFlex>
    </template>
    <template #header-extra>
      <NTag size="small" :type="STATUS_META[proposal.status].type" :bordered="false">
        {{ STATUS_META[proposal.status].label }}
      </NTag>
    </template>

    <NText v-if="proposal.summary" depth="3" class="action-card__summary">{{ proposal.summary }}</NText>

    <NSpin :show="isRunning" size="small">
      <AssistantActionRenderer :proposal="proposal" :editable="editing" v-model:draft="scheduleDraft" />
    </NSpin>

    <NAlert v-if="proposal.status === 'failed' && proposal.error" type="error" :show-icon="false" class="action-card__alert">
      {{ proposal.error }}
    </NAlert>
    <NAlert
      v-else-if="proposal.status === 'requires_confirmation' && isHighRisk && !editing"
      type="warning" :show-icon="false" class="action-card__alert"
    >
      高风险操作, 请确认后执行
    </NAlert>

    <template v-if="editing" #action>
      <NFlex justify="end" :size="8">
        <NButton size="small" tertiary @click="cancelEdit">放弃</NButton>
        <NButton size="small" type="primary" @click="saveEdit">保存</NButton>
      </NFlex>
    </template>
    <template v-else-if="isPending || proposal.status === 'failed'" #action>
      <NFlex justify="end" :size="8">
        <NButton size="small" tertiary @click="startEdit">修改</NButton>
        <NButton size="small" tertiary @click="emit('reject')">取消</NButton>
        <NPopconfirm v-if="isHighRisk" @positive-click="emit('confirm')">
          <template #trigger>
            <NButton size="small" type="error">{{ proposal.status === 'failed' ? '重试' : '确认执行' }}</NButton>
          </template>
          确认执行该高风险操作?
        </NPopconfirm>
        <NButton v-else size="small" type="primary" @click="emit('confirm')">
          {{ proposal.status === 'failed' ? '重试' : '确认执行' }}
        </NButton>
      </NFlex>
    </template>
  </NCard>
</template>

<style scoped>
.action-card { margin-top: 8px; }
.action-card__header { min-width: 0; }
.action-card__title { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.action-card__summary { font-size: 13px; display: block; margin-bottom: 6px; }
.action-card__alert { margin-top: 8px; font-size: 12px; }
</style>
