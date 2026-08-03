<script setup lang="ts">
import { computed, ref } from 'vue'

import { showWarningToast } from '@/shared/services/toast'

import type { ProposalEditItem } from '../api/assistant'
import type { ActionStatus } from '../schemas/assistant'
import type { AssistantAction } from '../store/useAssistantStore'
import AssistantActionRenderer from './AssistantActionRenderer.vue'

const props = defineProps<{ action: AssistantAction }>()
const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'reject'): void
  (e: 'save', items: ProposalEditItem[]): void
  (e: 'schedule', scheduledTime: number): void
  (e: 'cancel-schedule'): void
}>()

const STATUS_META: Record<ActionStatus, { label: string; type: 'default' | 'info' | 'warning' | 'success' | 'error' }> =
  {
    draft: { label: '待确认', type: 'default' },
    requires_confirmation: { label: '需确认', type: 'warning' },
    scheduled: { label: '已定时', type: 'info' },
    running: { label: '执行中', type: 'info' },
    completed: { label: '已完成', type: 'success' },
    failed: { label: '失败', type: 'error' },
    rejected: { label: '已取消', type: 'default' },
  }

const RISK_META: Record<string, { label: string; type: 'success' | 'warning' | 'error' }> = {
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
const canEdit = computed(() => proposal.value.preview.some((it) => it.fields?.length))

/** 定时选择器: 弹层显隐与待选时间戳 (默认 1 小时后) */
const schedulePicker = ref(false)
const scheduleTs = ref<number | null>(null)
const confirmHighRisk = ref(false)
const scheduleInput = computed({
  get: () =>
    scheduleTs.value
      ? new Date(scheduleTs.value - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
      : '',
  set: (value: string) => {
    scheduleTs.value = value ? new Date(value).getTime() : null
  },
})
function openSchedulePicker() {
  scheduleTs.value = Date.now() + 60 * 60 * 1000
  schedulePicker.value = true
}
function confirmSchedule() {
  if (!scheduleTs.value || scheduleTs.value <= Date.now()) {
    showWarningToast('请选择一个将来的时间')
    return
  }
  emit('schedule', scheduleTs.value)
  schedulePicker.value = false
}

const scheduledText = computed(() => {
  if (!proposal.value.scheduledTime) return ''
  return new Date(proposal.value.scheduledTime).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})

function startEdit() {
  // 为每个含可编辑字段的预览项建草稿: index 对齐下标, values 用字段当前值初始化
  editDraft.value = proposal.value.preview
    .map((it, index) => ({ it, index }))
    .filter(({ it }) => it.fields?.length)
    .map(({ it, index }) => ({
      index,
      values: Object.fromEntries(it.fields!.map((f) => [f.key, f.value])),
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

function confirmAction() {
  emit('confirm')
  confirmHighRisk.value = false
}
</script>

<template>
  <div class="action-card">
    <header class="action-card__header">
      <span class="action-card__title">{{ proposal.title }}</span>
      <UBadge
        size="sm"
        :color="RISK_META[proposal.risk]?.type"
        variant="subtle"
      >
        {{ RISK_META[proposal.risk]?.label }}
      </UBadge>
      <UBadge
        size="sm"
        :color="STATUS_META[proposal.status].type === 'default' ? 'neutral' : STATUS_META[proposal.status].type"
        variant="subtle"
        class="action-card__status"
      >
        {{ STATUS_META[proposal.status].label }}
      </UBadge>
    </header>

    <p
      v-if="proposal.summary"
      class="action-card__summary"
    >
      {{ proposal.summary }}
    </p>

    <div class="action-card__content">
      <UIcon
        v-if="isRunning"
        name="i-lucide-loader-circle"
        class="action-card__spinner animate-spin"
      />
      <AssistantActionRenderer
        v-model:draft="editDraft"
        :proposal="proposal"
        :editable="editing"
      />
    </div>

    <UAlert
      v-if="proposal.status === 'failed' && proposal.error"
      color="error"
      variant="subtle"
      :description="proposal.error"
      class="action-card__alert"
    />
    <UAlert
      v-else-if="isScheduled"
      color="info"
      variant="subtle"
      :description="`已设定 ${scheduledText} 自动执行`"
      class="action-card__alert"
    />
    <UAlert
      v-else-if="proposal.status === 'requires_confirmation' && isHighRisk && !editing"
      color="warning"
      variant="subtle"
      description="高风险操作, 请确认后执行"
      class="action-card__alert"
    />

    <footer
      v-if="editing"
      class="action-card__actions"
    >
      <UButton
        size="sm"
        color="neutral"
        variant="ghost"
        @click="cancelEdit"
      >
        放弃
      </UButton>
      <UButton
        size="sm"
        @click="saveEdit"
      >
        保存
      </UButton>
    </footer>
    <footer
      v-else-if="isScheduled"
      class="action-card__actions"
    >
      <UButton
        size="sm"
        color="neutral"
        variant="ghost"
        @click="emit('cancel-schedule')"
      >
        取消定时
      </UButton>
      <UButton
        size="sm"
        @click="emit('confirm')"
      >
        立即执行
      </UButton>
    </footer>
    <footer
      v-else-if="isPending || proposal.status === 'failed'"
      class="action-card__actions"
    >
      <UButton
        v-if="canEdit"
        size="sm"
        color="neutral"
        variant="ghost"
        @click="startEdit"
      >
        修改
      </UButton>
      <UButton
        size="sm"
        color="neutral"
        variant="ghost"
        @click="emit('reject')"
      >
        取消
      </UButton>
      <UPopover v-model:open="schedulePicker">
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          @click="openSchedulePicker"
        >
          定时
        </UButton>
        <template #content>
          <div class="action-card__schedule">
            <span class="action-card__schedule-label"> 选择自动执行时间 </span>
            <UInput
              v-model="scheduleInput"
              type="datetime-local"
            />
            <div class="action-card__schedule-actions">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                @click="schedulePicker = false"
              >
                取消
              </UButton>
              <UButton
                size="xs"
                @click="confirmSchedule"
              >
                确定
              </UButton>
            </div>
          </div>
        </template>
      </UPopover>
      <UButton
        v-if="isHighRisk"
        size="sm"
        color="error"
        @click="confirmHighRisk = true"
      >
        {{ proposal.status === 'failed' ? '重试' : '确认执行' }}
      </UButton>
      <UButton
        v-else
        size="sm"
        @click="emit('confirm')"
      >
        {{ proposal.status === 'failed' ? '重试' : '确认执行' }}
      </UButton>
    </footer>

    <UModal
      v-model:open="confirmHighRisk"
      title="确认执行"
      description="该操作风险较高，执行后可能无法撤销。"
    >
      <template #footer>
        <div class="action-card__actions">
          <UButton
            color="neutral"
            variant="ghost"
            @click="confirmHighRisk = false"
          >
            取消
          </UButton>
          <UButton
            color="error"
            @click="confirmAction"
          >
            确认执行
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.action-card {
  margin-top: 8px;
  padding: 10px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  background: var(--vtsuru-bg-elevated);
}
.action-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.action-card__title {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.action-card__summary {
  font-size: 13px;
  display: block;
  margin: 6px 0;
  color: var(--vtsuru-fg-muted);
}
.action-card__alert {
  margin-top: 8px;
  font-size: 12px;
}
.action-card__schedule {
  display: flex;
  width: 240px;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}

.action-card__schedule-label {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.action-card__status {
  margin-left: auto;
}

.action-card__content {
  position: relative;
}

.action-card__spinner {
  position: absolute;
  z-index: 1;
  top: 4px;
  right: 4px;
}

.action-card__actions,
.action-card__schedule-actions {
  display: flex;
  width: 100%;
  justify-content: flex-end;
  gap: 8px;
}

.action-card__actions {
  margin-top: 10px;
}
</style>
