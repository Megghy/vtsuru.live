<script setup lang="ts">
import {
  ArrowRight,
  ArrowUpToLine,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  UserMinus,
  Users,
  X,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { QueueFrom, QueueStatus } from '@/api/generated/model'
import { useObsRealtimeSync } from '@/apps/obs/composables/useObsRealtimeSync'
import { useQueue } from '@/composables/useQueue'
import { CURRENT_HOST, isTauri } from '@/shared/config'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { copyToClipboard } from '@/shared/utils'
import { formatListForCopy } from '@/shared/utils/queue'

import IconAction from './IconAction.vue'
import PanelShell from './PanelShell.vue'

defineProps<{ blurred?: boolean }>()

const account = useAccount()
const queue = useQueue()
const quickName = ref('')
const quickNote = ref('')
const isAdding = ref(false)
const isSwitching = ref(false)

const progressing = computed(() => queue.progressingQueue)
const waiting = computed(() => queue.waitingQueue)
const isTeamMode = computed(() => queue.teamSize > 1)
const remainingSlots = computed(() => Math.max(0, queue.teamSize - progressing.value.length))
const nextPullCount = computed(() => Math.min(remainingSlots.value, waiting.value.length))

const { on: onRealtime } = useObsRealtimeSync({
  topic: () => (account.value?.id ? `obs:display:queue:${account.value.id}` : ''),
  active: () => Boolean(account.value?.id),
  onSync: () => {
    void queue.updateActive()
  },
})
onRealtime('Changed', () => {
  void queue.updateActive()
})

async function handleFinishAndNext() {
  if (isSwitching.value) return
  isSwitching.value = true
  try {
    await queue.finishAndNextBatch()
  } finally {
    isSwitching.value = false
  }
}

async function handleNextBatch() {
  if (isSwitching.value) return
  isSwitching.value = true
  try {
    await queue.nextBatch()
  } finally {
    isSwitching.value = false
  }
}

async function handleQuickAdd() {
  const name = quickName.value.trim()
  if (!name || isAdding.value) return
  isAdding.value = true
  try {
    const added = await queue.addManual(name, quickNote.value.trim() || undefined)
    if (added) {
      quickName.value = ''
      quickNote.value = ''
    }
  } finally {
    isAdding.value = false
  }
}

async function copyParty() {
  if (progressing.value.length === 0) {
    toast.info('当前本局暂无成员')
    return
  }
  const text = formatListForCopy(
    progressing.value,
    (q) => q.user?.name ?? '未知用户',
    (q) => q.content,
  )
  await copyToClipboard(text, `已复制本局 ${progressing.value.length} 人名单`)
}

async function copyNote(content: string | null | undefined) {
  const trimmed = content?.trim()
  if (!trimmed) return
  await copyToClipboard(trimmed, `已复制「${trimmed}」`)
}

async function openManage() {
  const url = `${CURRENT_HOST}manage/queue`
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank')
  }
}

function getSourceTag(from: QueueFrom | number | undefined): string | null {
  if (from === QueueFrom.SC) return 'SC'
  if (from === QueueFrom.Gift) return '礼物'
  if (from === QueueFrom.Web) return '网页'
  return null
}

onMounted(() => {
  void queue.updateActive()
})
</script>

<template>
  <PanelShell
    title="排队"
    :blurred="blurred"
  >
    <template #actions>
      <Badge
        variant="secondary"
        size="xs"
        class="tabular-nums"
      >
        {{ waiting.length }} 等待
      </Badge>
      <Badge
        v-if="isTeamMode"
        variant="outline"
        size="xs"
        class="tabular-nums"
      >
        {{ queue.teamSize }}人车
      </Badge>
      <IconAction
        :icon="RefreshCw"
        tip="刷新排队队列"
        @click="queue.updateActive()"
      />
      <IconAction
        :icon="ExternalLink"
        tip="打开完整排队管理页"
        @click="openManage"
      />
    </template>

    <div class="flex flex-col gap-2.5 box-border h-full p-2.5 overflow-y-auto scrollbar-thin text-[13px]">
      <!-- 本局车队 / 正在进行 -->
      <section class="rounded-md border border-border bg-card p-2.5 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Users class="size-3.5 text-emerald-600" />
            {{ isTeamMode ? `本局车队（${progressing.length}/${queue.teamSize}）` : '正在进行' }}
          </span>
          <div class="flex items-center gap-1">
            <Button
              v-if="progressing.length > 0"
              size="icon-xs"
              variant="ghost"
              title="复制本队名单"
              @click="copyParty"
            >
              <Copy class="size-3" />
            </Button>
          </div>
        </div>

        <template v-if="progressing.length > 0">
          <div class="space-y-1.5">
            <div
              v-for="item in progressing"
              :key="`dash-party-${item.id}`"
              class="flex items-center justify-between gap-1.5 rounded border border-emerald-500/25 bg-emerald-500/5 px-2 py-1.5"
            >
              <div class="min-w-0 flex-1">
                <div class="font-medium text-foreground text-xs truncate">
                  {{ item.user?.name || '未知用户' }}
                </div>
                <button
                  v-if="item.content"
                  type="button"
                  class="inline-flex items-center gap-1 max-w-full text-[11px] text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                  title="点击复制游戏 ID / 备注"
                  @click="copyNote(item.content)"
                >
                  <span class="truncate">{{ item.content }}</span>
                  <Copy class="size-2.5 shrink-0" />
                </button>
              </div>
              <div class="flex items-center gap-0.5 shrink-0">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  class="text-amber-600"
                  title="暂离顺延并补位"
                  @click="queue.replaceMember(item, 'defer', false, true)"
                >
                  <Clock class="size-3" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  class="text-destructive"
                  title="取消并补位"
                  @click="queue.replaceMember(item, 'cancel', false, true)"
                >
                  <UserMinus class="size-3" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  title="退回等待"
                  @click="queue.updateStatus(item, QueueStatus.Waiting)"
                >
                  <RotateCcw class="size-3" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  class="text-emerald-600"
                  title="单独标记完成"
                  @click="queue.updateStatus(item, QueueStatus.Finish)"
                >
                  <Check class="size-3" />
                </Button>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 flex-wrap">
            <Button
              size="xs"
              class="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              :loading="isSwitching"
              @click="handleFinishAndNext"
            >
              <ArrowRight class="size-3.5" />
              <template v-if="waiting.length > 0">
                {{ isTeamMode ? '结束并拉下一队' : '完成并切下一位' }}
              </template>
              <template v-else>
                {{ isTeamMode ? '全员完成' : '标记完成' }}
              </template>
            </Button>
            <Button
              v-if="nextPullCount > 0"
              size="xs"
              variant="outline"
              :disabled="isSwitching"
              @click="handleNextBatch"
            >
              补位 +{{ nextPullCount }}
            </Button>
          </div>
        </template>

        <div
          v-else
          class="flex-between gap-2 py-1 text-xs text-muted-foreground"
        >
          <span>当前空闲</span>
          <Button
            v-if="waiting.length > 0"
            size="xs"
            variant="secondary"
            class="gap-1"
            :loading="isSwitching"
            @click="handleNextBatch"
          >
            <Play class="size-3" />
            {{ isTeamMode ? `拉下一队 (${Math.min(queue.teamSize, waiting.length)}人)` : '开始队首' }}
          </Button>
        </div>
      </section>

      <!-- 快速添加 -->
      <div class="flex items-center gap-1.5">
        <Input
          v-model="quickName"
          placeholder="观众昵称…"
          class="flex-1 min-w-0"
          @keydown.enter="handleQuickAdd"
        />
        <Input
          v-model="quickNote"
          placeholder="备注/ID"
          class="w-24 shrink-0"
          @keydown.enter="handleQuickAdd"
        />
        <Button
          size="icon"
          variant="outline"
          class="shrink-0"
          :loading="isAdding"
          :disabled="!quickName.trim()"
          title="加入排队队列"
          @click="handleQuickAdd"
        >
          <Plus class="size-3.5" />
        </Button>
      </div>

      <!-- 等待队列 -->
      <section class="space-y-1.5 flex-1 min-h-0">
        <div class="flex-between text-xs text-muted-foreground">
          <span class="font-medium">等待排队（{{ waiting.length }}）</span>
          <span
            v-if="isTeamMode && waiting.length > 0"
            class="font-mono tabular-nums"
          >
            约 {{ Math.ceil(waiting.length / queue.teamSize) }} 车
          </span>
        </div>

        <div
          v-if="waiting.length > 0"
          class="space-y-1"
        >
          <div
            v-for="(item, idx) in waiting"
            :key="item.id"
            class="flex items-center gap-1.5 rounded-md border px-2 py-1.5"
            :class="
              isTeamMode && idx < queue.teamSize
                ? 'border-sky-500/35 bg-sky-500/[0.04]'
                : 'border-border/70 bg-card/60'
            "
          >
            <span class="text-[11px] font-mono tabular-nums text-muted-foreground w-4 shrink-0">
              {{ idx + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1 min-w-0">
                <span class="font-medium text-foreground truncate text-xs">{{ item.user?.name || '未知用户' }}</span>
                <Badge
                  v-if="isTeamMode && idx < queue.teamSize"
                  variant="outline"
                  size="xs"
                  class="border-sky-500/40 text-sky-600"
                >
                  下一车
                </Badge>
                <Badge
                  v-else-if="(item.priorityLevel ?? 0) > 0"
                  variant="warning"
                  size="xs"
                >
                  插队
                </Badge>
                <Badge
                  v-else-if="getSourceTag(item.from)"
                  variant="secondary"
                  size="xs"
                >
                  {{ getSourceTag(item.from) }}
                </Badge>
              </div>
              <button
                v-if="item.content"
                type="button"
                class="text-[11px] text-muted-foreground hover:text-foreground truncate block max-w-full cursor-pointer text-left"
                title="点击复制备注"
                @click="copyNote(item.content)"
              >
                {{ item.content }}
              </button>
            </div>

            <div class="flex items-center gap-0.5 shrink-0">
              <Button
                size="icon-xs"
                variant="ghost"
                class="text-primary hover:bg-primary/10"
                :disabled="remainingSlots <= 0"
                :title="remainingSlots <= 0 ? '当前车队已满' : '拉入本局'"
                @click="queue.updateStatus(item, QueueStatus.Progressing)"
              >
                <Play class="size-3" />
              </Button>
              <Button
                v-if="idx > 0"
                size="icon-xs"
                variant="ghost"
                class="text-muted-foreground"
                title="置顶至队首"
                @click="queue.pinQueue(item)"
              >
                <ArrowUpToLine class="size-3" />
              </Button>
              <Button
                size="icon-xs"
                variant="ghost"
                class="text-muted-foreground hover:text-destructive"
                title="取消排队"
                @click="queue.updateStatus(item, QueueStatus.Cancel)"
              >
                <X class="size-3" />
              </Button>
            </div>
          </div>
        </div>

        <div
          v-else
          class="py-6 text-center text-xs text-muted-foreground"
        >
          等待队列为空
        </div>
      </section>
    </div>
  </PanelShell>
</template>
