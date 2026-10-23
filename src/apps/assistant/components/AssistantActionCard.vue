<script setup lang="ts">
import { computed, ref } from 'vue'

import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Spin } from '@/shared/ui/spin'
import { toast } from '@/shared/utils'

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

const STATUS_META: Record<
  ActionStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  draft: { label: '待确认', variant: 'secondary' },
  requires_confirmation: { label: '需确认', variant: 'outline' },
  scheduled: { label: '已定时', variant: 'secondary' },
  running: { label: '执行中', variant: 'secondary' },
  completed: { label: '已完成', variant: 'default' },
  failed: { label: '失败', variant: 'destructive' },
  rejected: { label: '已取消', variant: 'outline' },
}

const RISK_META: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  low: { label: '低风险', variant: 'secondary' },
  medium: { label: '中风险', variant: 'secondary' },
  high: { label: '高风险', variant: 'destructive' },
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

/** 定时选择器: 弹层显隐与待选时间字符串 (默认 1 小时后) */
const schedulePicker = ref(false)
const scheduleDateTimeStr = ref('')

function openSchedulePicker() {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  // 转换为 local ISO 字符串供 datetime-local 使用
  const pad = (n: number) => String(n).padStart(2, '0')
  scheduleDateTimeStr.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  schedulePicker.value = true
}

function confirmSchedule() {
  const ts = new Date(scheduleDateTimeStr.value).getTime()
  if (!ts || isNaN(ts) || ts <= Date.now()) {
    toast.warning('请选择一个将来的时间')
    return
  }
  emit('schedule', ts)
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
</script>

<template>
  <Card class="w-full mt-2 shadow-xs">
    <CardHeader class="p-3 pb-2 flex flex-row items-center justify-between space-y-0 border-b border-border/50">
      <div class="flex items-center gap-2 min-w-0">
        <strong class="action-card__title text-xs font-semibold truncate">{{ proposal.title }}</strong>
        <Badge
          :variant="RISK_META[proposal.risk]?.variant || 'secondary'"
          class="text-[10px] h-4.5 px-1 font-normal"
        >
          {{ RISK_META[proposal.risk]?.label }}
        </Badge>
      </div>

      <Badge
        :variant="STATUS_META[proposal.status].variant"
        class="text-[10px] h-4.5 px-1 font-normal"
      >
        {{ STATUS_META[proposal.status].label }}
      </Badge>
    </CardHeader>

    <CardContent class="p-3 text-xs space-y-2">
      <p
        v-if="proposal.summary"
        class="action-card__summary text-muted-foreground text-xs leading-relaxed"
      >
        {{ proposal.summary }}
      </p>

      <div class="relative">
        <div
          v-if="isRunning"
          class="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-10"
        >
          <Spin />
        </div>
        <AssistantActionRenderer
          v-model:draft="editDraft"
          :proposal="proposal"
          :editable="editing"
        />
      </div>

      <Alert
        v-if="proposal.status === 'failed' && proposal.error"
        variant="destructive"
        class="py-2 px-3 text-xs"
      >
        <AlertDescription>{{ proposal.error }}</AlertDescription>
      </Alert>
      <Alert
        v-else-if="isScheduled"
        class="py-2 px-3 text-xs border-primary/30 bg-primary/5 text-foreground"
      >
        <AlertDescription>已设定 {{ scheduledText }} 自动执行</AlertDescription>
      </Alert>
      <Alert
        v-else-if="proposal.status === 'requires_confirmation' && isHighRisk && !editing"
        class="py-2 px-3 text-xs border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      >
        <AlertDescription>高风险操作, 请确认后执行</AlertDescription>
      </Alert>
    </CardContent>

    <CardFooter
      v-if="editing || isScheduled || isPending || proposal.status === 'failed'"
      class="p-2.5 pt-0 flex justify-end gap-1.5"
    >
      <template v-if="editing">
        <Button
          variant="outline"
          @click="cancelEdit"
        >
          放弃
        </Button>
        <Button @click="saveEdit"> 保存 </Button>
      </template>

      <template v-else-if="isScheduled">
        <Button
          variant="outline"
          @click="emit('cancel-schedule')"
        >
          取消定时
        </Button>
        <Button @click="emit('confirm')"> 立即执行 </Button>
      </template>

      <template v-else-if="isPending || proposal.status === 'failed'">
        <Button
          v-if="canEdit"
          variant="outline"
          @click="startEdit"
        >
          修改
        </Button>
        <Button
          variant="outline"
          @click="emit('reject')"
        >
          取消
        </Button>

        <Popover
          :open="schedulePicker"
          @update:open="schedulePicker = $event"
        >
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              @click="openSchedulePicker"
            >
              定时
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-64 p-3 space-y-2.5 text-xs">
            <span class="text-muted-foreground block text-[11px]">选择自动执行时间</span>
            <Input
              size="xs"
              v-model="scheduleDateTimeStr"
              type="datetime-local"
              class="font-mono"
            />
            <div class="flex justify-end gap-1.5">
              <Button
                variant="outline"
                class="h-6 text-[11px] px-2"
                @click="schedulePicker = false"
              >
                取消
              </Button>
              <Button
                class="h-6 text-[11px] px-2"
                @click="confirmSchedule"
              >
                确定
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Popconfirm
          v-if="isHighRisk"
          title="确认执行该高风险操作?"
          positive-text="确认执行"
          negative-text="取消"
          @positive-click="emit('confirm')"
        >
          <template #trigger>
            <Button variant="destructive">
              {{ proposal.status === 'failed' ? '重试' : '确认执行' }}
            </Button>
          </template>
          确认执行该高风险操作?
        </Popconfirm>

        <Button
          v-else
          @click="emit('confirm')"
        >
          {{ proposal.status === 'failed' ? '重试' : '确认执行' }}
        </Button>
      </template>
    </CardFooter>
  </Card>
</template>
