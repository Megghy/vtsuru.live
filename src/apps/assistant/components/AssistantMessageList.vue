<script setup lang="ts">
import { NButton, NCollapseTransition, NIcon, NInput, NSpin, NText, NTooltip } from 'naive-ui'
import { reactive } from 'vue'
import {
  ArrowClockwise16Regular,
  BrainCircuit20Regular,
  ChevronDown12Regular,
  Checkmark16Regular,
  Copy16Regular,
  Dismiss16Regular,
  Edit16Regular,
} from '@vicons/fluent'
import { copyToClipboard } from '@/shared/utils'
import type { ScheduleEditItem } from '../api/assistant'
import type { AssistantMessage } from '../store/useAssistantStore'
import AssistantActionCard from './AssistantActionCard.vue'
import AssistantToolCallList from './AssistantToolCallList.vue'
import StreamingMarkdown from './StreamingMarkdown.vue'

defineProps<{ messages: AssistantMessage[], busy?: boolean }>()
const emit = defineEmits<{
  (e: 'retry', messageId: string): void
  (e: 'rerun', messageId: string): void
  (e: 'edit-user', messageId: string, text: string): void
  (e: 'confirm', messageId: string, actionId: string): void
  (e: 'reject', messageId: string, actionId: string): void
  (e: 'save', messageId: string, actionId: string, items: ScheduleEditItem[]): void
}>()

// 用户手动展开/收起的覆盖状态; 未操作时跟随 reasoningDone (思考中展开, 完成收起)
const expanded = reactive<Record<string, boolean>>({})
const editing = reactive<Record<string, string>>({})
function isThinkingOpen(msg: AssistantMessage): boolean {
  return expanded[msg.id] ?? !msg.reasoningDone
}
function toggleThinking(msg: AssistantMessage) {
  expanded[msg.id] = !isThinkingOpen(msg)
}

function copyMessage(msg: AssistantMessage) {
  if (msg.text) copyToClipboard(msg.text)
}

function canEditUser(msg: AssistantMessage): boolean {
  return msg.role === 'user' && msg.id.startsWith('s_')
}

function isEditing(msg: AssistantMessage): boolean {
  return editing[msg.id] !== undefined
}

function startEditing(msg: AssistantMessage) {
  editing[msg.id] = msg.text
}

function cancelEditing(msg: AssistantMessage) {
  delete editing[msg.id]
}

function submitEditing(msg: AssistantMessage) {
  const next = editing[msg.id]?.trim() ?? ''
  if (next === msg.text.trim()) {
    cancelEditing(msg)
    return
  }
  emit('edit-user', msg.id, next)
  cancelEditing(msg)
}

function canSubmitEdit(msg: AssistantMessage): boolean {
  return !!editing[msg.id]?.trim() || !!msg.images?.length || !!msg.hasImage
}

function formatTokens(value?: number): string {
  const n = value ?? 0
  if (n >= 10000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}
</script>

<template>
  <div class="msg-list">
    <div
      v-for="msg in messages"
      :key="msg.id"
      class="msg-row"
      :class="`msg-row--${msg.role}`"
    >
      <div class="msg-bubble" :class="`msg-bubble--${msg.role}`">
        <!-- 思考过程: 可折叠, 思考中默认展开, 完成自动收起 -->
        <div v-if="msg.reasoning" class="msg-think">
          <div class="msg-think__head" @click="toggleThinking(msg)">
            <NIcon :component="BrainCircuit20Regular" size="14" />
            <span class="msg-think__title">{{ msg.reasoningDone ? '已深度思考' : '思考中…' }}</span>
            <NIcon
              :component="ChevronDown12Regular" size="12"
              class="msg-think__chevron" :class="{ 'is-open': isThinkingOpen(msg) }"
            />
          </div>
          <NCollapseTransition :show="isThinkingOpen(msg)">
            <NText depth="3" class="msg-think__body">
              {{ msg.reasoning }}
            </NText>
          </NCollapseTransition>
        </div>

        <AssistantToolCallList v-if="msg.tools.length" :tools="msg.tools" />

        <NSpin v-if="msg.role === 'assistant' && msg.status === 'sending' && !msg.text && !msg.reasoning && !msg.tools.length" size="small" />

        <div v-if="msg.images?.length" class="msg-images">
          <img v-for="(img, i) in msg.images" :key="i" :src="img" class="msg-image" alt="附件">
        </div>
        <NText v-else-if="msg.hasImage" depth="3" class="msg-image-hint">
          [图片]
        </NText>

        <div v-if="isEditing(msg)" class="msg-editor">
          <NInput
            v-model:value="editing[msg.id]"
            type="textarea"
            class="msg-editor__input"
            :autosize="{ minRows: 2, maxRows: 8 }"
            :disabled="busy"
          />
          <div class="msg-editor__actions">
            <NButton
              tertiary
              size="tiny"
              :disabled="busy || !canSubmitEdit(msg)"
              @click="submitEditing(msg)"
            >
              <template #icon>
                <NIcon :component="Checkmark16Regular" />
              </template>
              保存
            </NButton>
            <NButton quaternary size="tiny" :disabled="busy" @click="cancelEditing(msg)">
              <template #icon>
                <NIcon :component="Dismiss16Regular" />
              </template>
              取消
            </NButton>
          </div>
        </div>

        <StreamingMarkdown
          v-if="msg.text && msg.role === 'assistant' && !isEditing(msg)"
          class="msg-text"
          :content="msg.text"
          :streaming="msg.status === 'sending'"
        />
        <NText v-else-if="msg.text && !isEditing(msg)" class="msg-text">
          {{ msg.text }}
        </NText>

        <div v-if="msg.role === 'assistant' && msg.usage" class="msg-usage">
          <span>输入 {{ formatTokens(msg.usage.inputTokens) }}</span>
          <span>输出 {{ formatTokens(msg.usage.outputTokens) }}</span>
          <span v-if="msg.usage.reasoningTokens">推理 {{ formatTokens(msg.usage.reasoningTokens) }}</span>
          <span>总计 {{ formatTokens(msg.usage.totalTokens) }}</span>
        </div>

        <div
          v-if="msg.role === 'assistant' && msg.status === 'sending' && (msg.text || msg.reasoning || msg.tools.length)"
          class="msg-streaming"
        >
          <NSpin size="small" />
        </div>

        <div v-if="(msg.text || msg.images?.length || msg.hasImage) && !isEditing(msg)" class="msg-actions">
          <NTooltip v-if="msg.text">
            <template #trigger>
              <NButton quaternary circle size="tiny" class="msg-action" @click="copyMessage(msg)">
                <template #icon>
                  <NIcon :component="Copy16Regular" />
                </template>
              </NButton>
            </template>
            复制
          </NTooltip>
          <NTooltip v-if="msg.role === 'user'">
            <template #trigger>
              <NButton quaternary circle size="tiny" class="msg-action" :disabled="busy || !canEditUser(msg)" @click="startEditing(msg)">
                <template #icon>
                  <NIcon :component="Edit16Regular" />
                </template>
              </NButton>
            </template>
            编辑
          </NTooltip>
          <NTooltip v-if="msg.role === 'assistant'">
            <template #trigger>
              <NButton quaternary circle size="tiny" class="msg-action" :disabled="busy" @click="emit('rerun', msg.id)">
                <template #icon>
                  <NIcon :component="ArrowClockwise16Regular" />
                </template>
              </NButton>
            </template>
            重新生成
          </NTooltip>
        </div>

        <div v-if="msg.status === 'error'" class="msg-error">
          <NText type="error" class="msg-error__text">
            {{ msg.error ?? '出错了' }}
          </NText>
          <NButton size="tiny" type="error" tertiary @click="emit('retry', msg.id)">
            重试
          </NButton>
        </div>

        <AssistantActionCard
          v-for="action in msg.actions"
          :key="action.id"
          :action="action"
          @confirm="emit('confirm', msg.id, action.id)"
          @reject="emit('reject', msg.id, action.id)"
          @save="patch => emit('save', msg.id, action.id, patch)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.msg-list { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
.msg-row { display: flex; }
.msg-row--user { justify-content: flex-end; }
.msg-row--assistant { justify-content: flex-start; }
.msg-bubble {
  --msg-bubble-bg: transparent;
  --msg-bubble-border: transparent;
  --msg-bubble-text: var(--vtsuru-fg, var(--n-text-color));

  max-width: 88%; min-width: 0;
  padding: 8px 12px; border-radius: 10px;
  border: 1px solid var(--msg-bubble-border);
  background: var(--msg-bubble-bg);
  color: var(--msg-bubble-text);
  display: flex; flex-direction: column; gap: 6px;
  word-break: break-word; overflow-wrap: anywhere;
}
.msg-bubble--user {
  --msg-bubble-bg: var(--vtsuru-brand-soft, rgba(35, 173, 229, 0.1));
  --msg-bubble-border: var(--vtsuru-brand-tint, rgba(35, 173, 229, 0.16));
  --msg-bubble-text: var(--vtsuru-fg, #09090b);
}
.msg-bubble--assistant {
  --msg-bubble-bg: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.08));
  --msg-bubble-border: var(--vtsuru-border, rgba(128, 128, 128, 0.14));
  width: 100%;
}
.msg-text { color: inherit; font-size: 14px; }
.msg-think {
  border: 1px solid var(--vtsuru-border, rgba(128, 128, 128, 0.16));
  border-radius: 8px; padding: 4px 8px;
  background: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.05));
}
.msg-think__head {
  display: flex; align-items: center; gap: 5px;
  cursor: pointer; user-select: none;
  color: var(--vtsuru-fg-muted, var(--n-text-color-3));
  font-size: 12px;
}
.msg-think__title { flex: 1 1 auto; }
.msg-think__chevron { transition: transform 0.2s; }
.msg-think__chevron.is-open { transform: rotate(180deg); }
.msg-think__body {
  display: block; margin-top: 6px;
  font-size: 12px; line-height: 1.6; white-space: pre-wrap;
  color: var(--vtsuru-fg-muted, var(--n-text-color-3));
}
.msg-images { display: flex; flex-wrap: wrap; gap: 6px; }
.msg-image {
  max-width: 160px; max-height: 160px;
  border-radius: 8px; object-fit: cover;
}
.msg-image-hint { color: var(--vtsuru-fg-muted, var(--n-text-color-3)); font-size: 13px; }
.msg-editor { display: flex; flex-direction: column; gap: 6px; min-width: min(360px, 72vw); }
.msg-editor__input { min-width: 0; }
.msg-editor__actions {
  display: flex; align-items: center; justify-content: flex-end; gap: 6px;
}
.msg-usage {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  color: var(--vtsuru-fg-muted, var(--n-text-color-3));
  font-size: 11px; line-height: 1.4;
}
.msg-streaming {
  width: 20px; height: 20px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--vtsuru-fg-muted, var(--n-text-color-3));
}
.msg-actions {
  display: flex; align-items: center; gap: 2px;
  min-height: 24px; margin-top: -2px;
  opacity: 0.72;
}
.msg-row--user .msg-actions { justify-content: flex-end; }
.msg-actions:hover { opacity: 1; }
.msg-action { color: var(--vtsuru-fg-muted, var(--n-text-color-3)); }
.msg-error { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.msg-error__text { font-size: 13px; }
</style>
