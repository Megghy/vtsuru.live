<script setup lang="ts">
import {
  ArrowClockwise16Regular,
  BrainCircuit20Regular,
  Checkmark16Regular,
  ChevronDown12Regular,
  Copy16Regular,
  Dismiss16Regular,
  Edit16Regular,
} from '@vicons/fluent'
import { reactive } from 'vue'

import { Button } from '@/shared/ui/button'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { copyToClipboard } from '@/shared/utils'

import type { AssistantToolEvent, ProposalEditItem } from '../api/assistant'
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
  (e: 'confirm-all', messageId: string): void
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

function isPendingStatus(status: string): boolean {
  return status === 'draft' || status === 'requires_confirmation'
}

function batchActions(msg: AssistantMessage) {
  return msg.actions.filter(
    (action) => isPendingStatus(action.proposal.status) || action.proposal.status === 'running',
  )
}

function batchRunning(msg: AssistantMessage): boolean {
  return msg.actions.some((action) => action.proposal.status === 'running')
}

function batchHighRisk(msg: AssistantMessage): boolean {
  return msg.actions.some((action) => isPendingStatus(action.proposal.status) && action.proposal.risk === 'high')
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
  <TooltipProvider>
    <div class="msg-list flex flex-col gap-3 p-1">
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="msg-row flex"
        :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="msg-bubble max-w-[88%] min-w-0 p-3 rounded-xl border flex flex-col gap-1.5 break-words overflow-wrap-anywhere text-xs"
          :class="
            msg.role === 'user'
              ? 'bg-primary/10 border-primary/20 text-foreground'
              : 'bg-muted/40 border-border text-foreground w-full'
          "
        >
          <!-- 答复前的工作过程: 思考与只读工具调用按时序交错, 共享一条时间轴 -->
          <div
            v-if="msg.process.length"
            class="msg-process relative pl-4 mb-0.5"
            :class="{ 'is-thinking': hasReasoning(msg) && !msg.reasoningDone }"
          >
            <!-- 折叠头: 仅当有思考文本时出现, 控制思考片段的展开/收起 -->
            <div
              v-if="hasReasoning(msg)"
              class="msg-think__head flex items-center gap-1.5 cursor-pointer select-none mb-1.5 text-muted-foreground text-xs"
              @click="toggleThinking(msg)"
            >
              <component
                :is="BrainCircuit20Regular"
                class="size-3.5 shrink-0"
              />
              <span class="msg-think__title flex-1 font-medium">{{ thinkLabel(msg) }}</span>
              <component
                :is="ChevronDown12Regular"
                class="size-3 transition-transform duration-200"
                :class="{ 'rotate-180': isThinkingOpen(msg) }"
              />
            </div>

            <div class="msg-process__body flex flex-col gap-1.5">
              <template
                v-for="block in processBlocks(msg)"
                :key="block.id"
              >
                <!-- 思考片段: 随折叠头展开/收起 -->
                <div
                  v-if="block.type === 'reasoning' && isThinkingOpen(msg)"
                  class="msg-think__body p-2 rounded-lg bg-muted/60 border border-border/60 text-muted-foreground whitespace-pre-wrap leading-relaxed text-[11px]"
                >
                  {{ block.text }}
                </div>
                <!-- 工具调用: 始终常驻可见, 不随思考折叠 -->
                <AssistantToolCallList
                  v-else-if="block.type === 'tools'"
                  :tools="block.tools"
                />
              </template>
            </div>
          </div>

          <div
            v-if="msg.role === 'assistant' && msg.status === 'sending' && !msg.text && !msg.process.length"
            class="msg-typing inline-flex items-center gap-1 h-5 px-0.5"
          >
            <span class="msg-typing__dot size-1.5 rounded-full bg-primary" />
            <span class="msg-typing__dot size-1.5 rounded-full bg-primary" />
            <span class="msg-typing__dot size-1.5 rounded-full bg-primary" />
          </div>

          <div
            v-if="msg.images?.length"
            class="msg-images flex flex-wrap gap-1.5"
          >
            <img
              v-for="(img, i) in msg.images"
              :key="i"
              :src="img"
              class="msg-image max-w-40 max-h-40 rounded-lg object-cover"
              alt="附件"
            />
          </div>
          <span
            v-else-if="msg.hasImage"
            class="msg-image-hint text-muted-foreground text-xs"
          >
            [图片]
          </span>

          <div
            v-if="isEditing(msg)"
            class="msg-editor flex flex-col gap-1.5 min-w-[min(360px,72vw)]"
          >
            <Textarea
              v-model="editing[msg.id]"
              rows="2"
              class="msg-editor__input text-xs resize-none"
              :disabled="busy"
            />
            <div class="msg-editor__actions flex items-center justify-end gap-1.5">
              <Button
                variant="outline"
                size="sm"
                class="h-7 text-xs flex items-center gap-1"
                :disabled="busy || !canSubmitEdit(msg)"
                @click="submitEditing(msg)"
              >
                <component :is="Checkmark16Regular" class="size-3.5" />
                保存
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="h-7 text-xs flex items-center gap-1"
                :disabled="busy"
                @click="cancelEditing(msg)"
              >
                <component :is="Dismiss16Regular" class="size-3.5" />
                取消
              </Button>
            </div>
          </div>

          <StreamingMarkdown
            v-if="msg.text && msg.role === 'assistant' && !isEditing(msg)"
            class="msg-text text-sm leading-relaxed"
            :content="msg.text"
            :streaming="msg.status === 'sending'"
          />
          <p
            v-else-if="msg.text && !isEditing(msg)"
            class="msg-text text-xs leading-relaxed m-0"
          >
            {{ msg.text }}
          </p>

          <div
            v-if="msg.role === 'assistant' && msg.usage"
            class="msg-usage flex items-center gap-2.5 flex-wrap mt-0.5 pt-1.5 border-t border-dashed border-border/60 text-muted-foreground text-[10px]"
          >
            <span>输入 {{ formatTokens(msg.usage.inputTokens) }}</span>
            <span>输出 {{ formatTokens(msg.usage.outputTokens) }}</span>
            <span v-if="msg.usage.reasoningTokens">推理 {{ formatTokens(msg.usage.reasoningTokens) }}</span>
            <span>总计 {{ formatTokens(msg.usage.totalTokens) }}</span>
          </div>

          <div
            v-if="(msg.text || msg.images?.length || msg.hasImage) && !isEditing(msg)"
            class="msg-actions flex items-center gap-0.5 min-h-6 -mt-0.5 opacity-70 hover:opacity-100 transition"
            :class="{ 'justify-end': msg.role === 'user' }"
          >
            <Tooltip v-if="msg.text">
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="msg-action size-6 rounded-full text-muted-foreground hover:text-foreground"
                  @click="copyMessage(msg)"
                >
                  <component :is="Copy16Regular" class="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制</TooltipContent>
            </Tooltip>

            <Tooltip v-if="msg.role === 'user'">
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="msg-action size-6 rounded-full text-muted-foreground hover:text-foreground"
                  :disabled="busy || !canEditUser(msg)"
                  @click="startEditing(msg)"
                >
                  <component :is="Edit16Regular" class="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>编辑</TooltipContent>
            </Tooltip>

            <Tooltip v-if="msg.role === 'assistant'">
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="msg-action size-6 rounded-full text-muted-foreground hover:text-foreground"
                  :disabled="busy"
                  @click="emit('rerun', msg.id)"
                >
                  <component :is="ArrowClockwise16Regular" class="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>重新生成</TooltipContent>
            </Tooltip>
          </div>

          <div
            v-if="msg.status === 'error'"
            class="msg-error flex items-center justify-between gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs"
          >
            <span class="msg-error__text flex-1">{{ msg.error ?? '出错了' }}</span>
            <Button
              variant="outline"
              size="sm"
              class="h-6 text-[11px] border-destructive/30 hover:bg-destructive/20"
              @click="emit('retry', msg.id)"
            >
              重试
            </Button>
          </div>

          <div
            v-if="batchActions(msg).length >= 2"
            class="msg-batch mt-1 flex justify-end"
          >
            <Popconfirm
              v-if="batchHighRisk(msg) && !batchRunning(msg)"
              title="其中包含高风险操作，确认全部执行？"
              positive-text="确认全部执行"
              negative-text="取消"
              @positive-click="emit('confirm-all', msg.id)"
            >
              <template #trigger>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 text-xs border-primary text-primary"
                >
                  全部执行 {{ batchActions(msg).length }} 项
                </Button>
              </template>
              其中包含高风险操作，确认全部执行？
            </Popconfirm>
            <Button
              v-else
              variant="outline"
              size="sm"
              class="h-7 text-xs border-primary text-primary"
              :disabled="batchRunning(msg)"
              @click="emit('confirm-all', msg.id)"
            >
              全部执行 {{ batchActions(msg).length }} 项
            </Button>
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
  </TooltipProvider>
</template>

<style scoped>
.msg-process::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  border-radius: 1px;
  background: var(--border, rgba(128, 128, 128, 0.2));
}
.msg-process.is-thinking::before {
  background: linear-gradient(var(--brand, #23ade5), var(--border, rgba(128, 128, 128, 0.2)));
}
.msg-process.is-thinking .msg-think__icon {
  color: var(--brand, #23ade5);
  animation: msg-think-pulse 1.6s ease-in-out infinite;
}
.msg-process.is-thinking .msg-think__title {
  color: var(--brand, #23ade5);
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
.msg-typing__dot {
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
</style>
