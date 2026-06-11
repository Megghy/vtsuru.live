<script setup lang="ts">
import {
  NAlert, NButton, NCard, NDatePicker, NFlex, NPopconfirm, NPopover, NSpin, NTag, NText,
} from 'naive-ui'
import { computed, ref } from 'vue'
import type { AssistantAction } from '../store/useAssistantStore'
import type { ProposalEditItem } from '../api/assistant'
import type { ActionStatus } from '../schemas/assistant'
import AssistantActionRenderer from './AssistantActionRenderer.vue'

const props = defineProps<{ action: AssistantAction }>()
const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'reject'): void
  (e: 'save', items: ProposalEditItem[]): void
  (e: 'schedule', scheduledTime: number): void
  (e: 'cancel-schedule'): void
}>()

const STATUS_META: Record<ActionStatus, { label: string, type: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  draft: { label: '待确认', type: 'default' },
  requires_confirmation: { label: '需确认', type: 'warning' },
  scheduled: { label: '已定时', type: 'info' },
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
const editDraft = ref<ProposalEditItem[]>([])
const isPending = computed(() => proposal.value.status === 'draft' || proposal.value.status === 'requires_confirmation')
const isRunning = computed(() => proposal.value.status === 'running')
const isHighRisk = computed(() => proposal.value.risk === 'high')
const isScheduled = computed(() => proposal.value.status === 'scheduled')
/** 任一预览项含可编辑字段才允许修改 */
const canEdit = computed(() => proposal.value.preview.some(it => it.fields?.length))

/** 定时选择器: 弹层显隐与待选时间戳 (默认 1 小时后) */
const schedulePicker = ref(false)
const scheduleTs = ref<number | null>(null)
/** 禁用过去时间 */
function disablePastDate(ts: number) {
  return ts < Date.now() - 60_000
}
function openSchedulePicker() {
  scheduleTs.value = Date.now() + 60 * 60 * 1000
  schedulePicker.value = true
}
function confirmSchedule() {
  if (!scheduleTs.value || scheduleTs.value <= Date.now()) {
    window.$message?.warning('请选择一个将来的时间')
    return
  }
  emit('schedule', scheduleTs.value)
  schedulePicker.value = false
}

const scheduledText = computed(() => {
  if (!proposal.value.scheduledTime) return ''
  return new Date(proposal.value.scheduledTime).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
})

function startEdit() {
  // 为每个含可编辑字段的预览项建草稿: index 对齐下标, values 用字段当前值初始化
  editDraft.value = proposal.value.preview
    .map((it, index) => ({ it, index }))
    .filter(({ it }) => it.fields?.length)
    .map(({ it, index }) => ({
      index,
      values: Object.fromEntries(it.fields!.map(f => [f.key, f.value])),
    }))
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

function saveEdit() {
  emit('save', editDraft.value)
  editing.value = false
}
</script>

<template>
  <NCard size="small" class="action-card" :bordered="true">
    <template #header>
      <NFlex align="center" :size="8" :wrap="false" class="action-card__header">
        <NText class="action-card__title">
          {{ proposal.title }}
        </NText>
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

    <NText v-if="proposal.summary" depth="3" class="action-card__summary">
      {{ proposal.summary }}
    </NText>

    <NSpin :show="isRunning" size="small">
      <AssistantActionRenderer v-model:draft="editDraft" :proposal="proposal" :editable="editing" />
    </NSpin>

    <NAlert v-if="proposal.status === 'failed' && proposal.error" type="error" :show-icon="false" class="action-card__alert">
      {{ proposal.error }}
    </NAlert>
    <NAlert
      v-else-if="isScheduled"
      type="info" :show-icon="false" class="action-card__alert"
    >
      已设定 {{ scheduledText }} 自动执行
    </NAlert>
    <NAlert
      v-else-if="proposal.status === 'requires_confirmation' && isHighRisk && !editing"
      type="warning" :show-icon="false" class="action-card__alert"
    >
      高风险操作, 请确认后执行
    </NAlert>

    <template v-if="editing" #action>
      <NFlex justify="end" :size="8">
        <NButton size="small" tertiary @click="cancelEdit">
          放弃
        </NButton>
        <NButton size="small" type="primary" @click="saveEdit">
          保存
        </NButton>
      </NFlex>
    </template>
    <template v-else-if="isScheduled" #action>
      <NFlex justify="end" :size="8">
        <NButton size="small" tertiary @click="emit('cancel-schedule')">
          取消定时
        </NButton>
        <NButton size="small" type="primary" @click="emit('confirm')">
          立即执行
        </NButton>
      </NFlex>
    </template>
    <template v-else-if="isPending || proposal.status === 'failed'" #action>
      <NFlex justify="end" :size="8">
        <NButton v-if="canEdit" size="small" tertiary @click="startEdit">
          修改
        </NButton>
        <NButton size="small" tertiary @click="emit('reject')">
          取消
        </NButton>
        <NPopover v-model:show="schedulePicker" trigger="manual" placement="top">
          <template #trigger>
            <NButton size="small" tertiary @click="openSchedulePicker">
              定时
            </NButton>
          </template>
          <NFlex vertical :size="8" class="action-card__schedule">
            <NText depth="3" style="font-size: 12px;">
              选择自动执行时间
            </NText>
            <NDatePicker
              v-model:value="scheduleTs"
              type="datetime"
              :is-date-disabled="disablePastDate"
              clearable
            />
            <NFlex justify="end" :size="8">
              <NButton size="tiny" tertiary @click="schedulePicker = false">
                取消
              </NButton>
              <NButton size="tiny" type="primary" @click="confirmSchedule">
                确定
              </NButton>
            </NFlex>
          </NFlex>
        </NPopover>
        <NPopconfirm v-if="isHighRisk" @positive-click="emit('confirm')">
          <template #trigger>
            <NButton size="small" type="error">
              {{ proposal.status === 'failed' ? '重试' : '确认执行' }}
            </NButton>
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
.action-card__schedule { width: 240px; }
</style>
