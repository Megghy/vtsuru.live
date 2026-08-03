<script setup lang="ts">
import { reactive } from 'vue'

import { copyToClipboard } from '@/shared/utils'

import type { ProposalEditItem, AssistantToolEvent } from '../api/assistant'
import type { AssistantMessage } from '../store/useAssistantStore'
import AssistantActionCard from './AssistantActionCard.vue'
import AssistantToolCallList from './AssistantToolCallList.vue'
import StreamingMarkdown from './StreamingMarkdown.vue'

defineProps<{ messages: AssistantMessage[]; busy?: boolean }>()
const emit = defineEmits<{
  (e: 'retry', messageId: string): void
  (e: 'rerun', messageId: string): void
  (e: 'edit-user', messageId: string, text: string): void
  (e: 'confirm', messageId: string, actionId: string): void
  (e: 'reject', messageId: string, actionId: string): void
  (e: 'save', messageId: string, actionId: string, items: ProposalEditItem[]): void
  (e: 'schedule', messageId: string, actionId: string, scheduledTime: number): void
  (e: 'cancel-schedule', messageId: string, actionId: string): void
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

/** 工作过程是否含思考文本 (无思考则不显示折叠头, 工具直接铺在时间轴上) */
function hasReasoning(msg: AssistantMessage): boolean {
  return msg.process.some((s) => s.kind === 'reasoning')
}

/** 折叠头标题: 思考中显示进行态; 完成后汇总本轮工具调用数 */
function thinkLabel(msg: AssistantMessage): string {
  if (!msg.reasoningDone) return '思考中…'
  const n = msg.process.reduce((acc, s) => acc + (s.kind === 'tool' ? 1 : 0), 0)
  return n ? `已深度思考 · 调用了 ${n} 个工具` : '已深度思考'
}

type ProcessBlock =
  | { type: 'reasoning'; id: number; text: string }
  | { type: 'tools'; id: number; tools: AssistantToolEvent[] }

/** 把有序片段合并成渲染块: 连续工具并为一组, 思考文本各自成块, 保留交错时序 */
function processBlocks(msg: AssistantMessage): ProcessBlock[] {
  const blocks: ProcessBlock[] = []
  for (const step of msg.process) {
    if (step.kind === 'tool') {
      const last = blocks[blocks.length - 1]
      if (last?.type === 'tools') last.tools.push(step.tool)
      else blocks.push({ type: 'tools', id: blocks.length, tools: [step.tool] })
    } else {
      blocks.push({ type: 'reasoning', id: blocks.length, text: step.text })
    }
  }
  return blocks
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
      <div
        class="msg-bubble"
        :class="`msg-bubble--${msg.role}`"
      >
        <!-- 答复前的工作过程: 思考与只读工具调用按时序交错, 共享一条时间轴 -->
        <div
          v-if="msg.process.length"
          class="msg-process"
          :class="{ 'is-thinking': hasReasoning(msg) && !msg.reasoningDone }"
        >
          <!-- 折叠头: 仅当有思考文本时出现, 控制思考片段的展开/收起 -->
          <div
            v-if="hasReasoning(msg)"
            class="msg-think__head"
            @click="toggleThinking(msg)"
          >
            <UIcon
              name="i-lucide-brain-circuit"
              class="msg-think__icon"
            />
            <span class="msg-think__title">{{ thinkLabel(msg) }}</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="msg-think__chevron"
              :class="{ 'is-open': isThinkingOpen(msg) }"
            />
          </div>

          <div class="msg-process__body">
            <template
              v-for="block in processBlocks(msg)"
              :key="block.id"
            >
              <!-- 思考片段: 随折叠头展开/收起 -->
              <Transition
                v-if="block.type === 'reasoning'"
                name="msg-collapse"
              >
                <p
                  v-if="isThinkingOpen(msg)"
                  class="msg-think__body"
                >
                  {{ block.text }}
                </p>
              </Transition>
              <!-- 工具调用: 始终常驻可见, 不随思考折叠 -->
              <AssistantToolCallList
                v-else
                :tools="block.tools"
              />
            </template>
          </div>
        </div>

        <div
          v-if="msg.role === 'assistant' && msg.status === 'sending' && !msg.text && !msg.process.length"
          class="msg-typing"
        >
          <span class="msg-typing__dot" />
          <span class="msg-typing__dot" />
          <span class="msg-typing__dot" />
        </div>

        <div
          v-if="msg.images?.length"
          class="msg-images"
        >
          <img
            v-for="(img, i) in msg.images"
            :key="i"
            :src="img"
            class="msg-image"
            alt="附件"
          />
        </div>
        <span
          v-else-if="msg.hasImage"
          class="msg-image-hint"
        >
          [图片]
        </span>

        <div
          v-if="isEditing(msg)"
          class="msg-editor"
        >
          <UTextarea
            v-model="editing[msg.id]"
            class="msg-editor__input"
            autoresize
            :rows="2"
            :maxrows="8"
            :disabled="busy"
          />
          <div class="msg-editor__actions">
            <UButton
              variant="soft"
              size="xs"
              icon="i-lucide-check"
              :disabled="busy || !canSubmitEdit(msg)"
              @click="submitEditing(msg)"
            >
              保存
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-x"
              :disabled="busy"
              @click="cancelEditing(msg)"
            >
              取消
            </UButton>
          </div>
        </div>

        <StreamingMarkdown
          v-if="msg.text && msg.role === 'assistant' && !isEditing(msg)"
          class="msg-text"
          :content="msg.text"
          :streaming="msg.status === 'sending'"
        />
        <p
          v-else-if="msg.text && !isEditing(msg)"
          class="msg-text"
        >
          {{ msg.text }}
        </p>

        <div
          v-if="msg.role === 'assistant' && msg.usage"
          class="msg-usage"
        >
          <span>输入 {{ formatTokens(msg.usage.inputTokens) }}</span>
          <span>输出 {{ formatTokens(msg.usage.outputTokens) }}</span>
          <span v-if="msg.usage.reasoningTokens">推理 {{ formatTokens(msg.usage.reasoningTokens) }}</span>
          <span>总计 {{ formatTokens(msg.usage.totalTokens) }}</span>
        </div>

        <div
          v-if="(msg.text || msg.images?.length || msg.hasImage) && !isEditing(msg)"
          class="msg-actions"
        >
          <UTooltip
            v-if="msg.text"
            text="复制"
          >
            <UButton
              variant="ghost"
              square
              size="xs"
              icon="i-lucide-copy"
              class="msg-action"
              @click="copyMessage(msg)"
            />
          </UTooltip>
          <UTooltip
            v-if="msg.role === 'user'"
            text="编辑"
          >
            <UButton
              variant="ghost"
              square
              size="xs"
              icon="i-lucide-pencil"
              class="msg-action"
              :disabled="busy || !canEditUser(msg)"
              @click="startEditing(msg)"
            />
          </UTooltip>
          <UTooltip
            v-if="msg.role === 'assistant'"
            text="重新生成"
          >
            <UButton
              variant="ghost"
              square
              size="xs"
              icon="i-lucide-refresh-cw"
              class="msg-action"
              :disabled="busy"
              @click="emit('rerun', msg.id)"
            />
          </UTooltip>
        </div>

        <div
          v-if="msg.status === 'error'"
          class="msg-error"
        >
          <span class="msg-error__text">
            {{ msg.error ?? '出错了' }}
          </span>
          <UButton
            size="xs"
            color="error"
            variant="soft"
            @click="emit('retry', msg.id)"
          >
            重试
          </UButton>
        </div>

        <AssistantActionCard
          v-for="action in msg.actions"
          :key="action.id"
          :action="action"
          @confirm="emit('confirm', msg.id, action.id)"
          @reject="emit('reject', msg.id, action.id)"
          @save="(patch) => emit('save', msg.id, action.id, patch)"
          @schedule="(ts) => emit('schedule', msg.id, action.id, ts)"
          @cancel-schedule="emit('cancel-schedule', msg.id, action.id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.msg-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px;
}
.msg-row {
  display: flex;
  animation: msg-row-in 0.26s ease both;
}
.msg-row--user {
  justify-content: flex-end;
}
.msg-row--assistant {
  justify-content: flex-start;
}
@keyframes msg-row-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.msg-bubble {
  --msg-bubble-bg: transparent;
  --msg-bubble-border: transparent;
  --msg-bubble-text: var(--vtsuru-fg, var(--vtsuru-fg));

  max-width: 88%;
  min-width: 0;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--msg-bubble-border);
  background: var(--msg-bubble-bg);
  color: var(--msg-bubble-text);
  display: flex;
  flex-direction: column;
  gap: 6px;
  word-break: break-word;
  overflow-wrap: anywhere;
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
.msg-text {
  margin: 0;
  color: inherit;
  font-size: 14px;
}
.msg-process {
  position: relative;
  padding-left: 16px;
  margin-bottom: 2px;
}
.msg-process::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  border-radius: 1px;
  background: var(--vtsuru-border, rgba(128, 128, 128, 0.2));
}
.msg-process.is-thinking::before {
  background: linear-gradient(var(--vtsuru-brand, #23ade5), var(--vtsuru-border, rgba(128, 128, 128, 0.2)));
}
.msg-process__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.msg-think__head {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  user-select: none;
  margin-bottom: 6px;
  color: var(--vtsuru-fg-muted, var(--vtsuru-fg-muted));
  font-size: 12px;
}
.msg-think__icon {
  flex: 0 0 auto;
}
.msg-process.is-thinking .msg-think__icon {
  color: var(--vtsuru-brand, #23ade5);
  animation: msg-think-pulse 1.6s ease-in-out infinite;
}
.msg-process.is-thinking .msg-think__title {
  color: var(--vtsuru-brand, #23ade5);
}
@keyframes msg-think-pulse {
  0%,
  100% {
    opacity: 0.5;
    transform: scale(0.96);
  }
  50% {
    opacity: 1;
    transform: scale(1.06);
  }
}
.msg-think__title {
  flex: 1 1 auto;
}
.msg-think__chevron {
  transition: transform 0.2s;
}
.msg-think__chevron.is-open {
  transform: rotate(180deg);
}
.msg-think__body {
  display: block;
  padding: 6px 9px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  background: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.05));
  border: 1px solid var(--vtsuru-border, rgba(128, 128, 128, 0.14));
  color: var(--vtsuru-fg-muted, var(--vtsuru-fg-muted));
}
.msg-collapse-enter-active,
.msg-collapse-leave-active {
  transition: opacity 0.15s ease;
}
.msg-collapse-enter-from,
.msg-collapse-leave-to {
  opacity: 0;
}
.msg-images {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.msg-image {
  max-width: 160px;
  max-height: 160px;
  border-radius: 8px;
  object-fit: cover;
}
.msg-image-hint {
  color: var(--vtsuru-fg-muted, var(--vtsuru-fg-muted));
  font-size: 13px;
}
.msg-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: min(360px, 72vw);
}
.msg-editor__input {
  min-width: 0;
}
.msg-editor__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}
.msg-usage {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 2px;
  padding-top: 6px;
  border-top: 1px dashed var(--vtsuru-border, rgba(128, 128, 128, 0.16));
  color: var(--vtsuru-fg-muted, var(--vtsuru-fg-muted));
  font-size: 11px;
  line-height: 1.4;
}
.msg-usage span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.msg-typing {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 2px;
}
.msg-typing__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--vtsuru-brand, #23ade5);
  opacity: 0.35;
  animation: msg-typing-bounce 1.3s ease-in-out infinite;
}
.msg-typing__dot:nth-child(2) {
  animation-delay: 0.18s;
}
.msg-typing__dot:nth-child(3) {
  animation-delay: 0.36s;
}
@keyframes msg-typing-bounce {
  0%,
  70%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  35% {
    opacity: 1;
    transform: translateY(-3px);
  }
}
.msg-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 24px;
  margin-top: -2px;
  opacity: 0.72;
}
.msg-row--user .msg-actions {
  justify-content: flex-end;
}
.msg-actions:hover {
  opacity: 1;
}
.msg-action {
  color: var(--vtsuru-fg-muted, var(--vtsuru-fg-muted));
}
.msg-error {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.msg-error__text {
  font-size: 13px;
  color: var(--vtsuru-error);
}
</style>
