<script setup lang="ts">
import ArrowReset24Regular from '@vicons/fluent/es/ArrowReset24Regular'
import Checkmark12Regular from '@vicons/fluent/es/Checkmark12Regular'
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import Dismiss16Filled from '@vicons/fluent/es/Dismiss16Filled'
import PeopleQueue24Filled from '@vicons/fluent/es/PeopleQueue24Filled'
import Search24Regular from '@vicons/fluent/es/Search24Regular'
import { isSameDay } from 'date-fns'
import {
  ArrowRight,
  Clock,
  Copy,
  Play,
  RefreshCw,
  RotateCcw,
  UserMinus,
  Users,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import type { ResponseQueueModel } from '@/api/client-types'
import { QueueFrom, QueueSortType, QueueStatus } from '@/api/generated/model'
import QueueItem from '@/apps/open-live/components/queue/QueueItem.vue'
import UserBadges from '@/apps/open-live/components/UserBadges.vue'
import { useQueue } from '@/composables/useQueue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { copyToClipboard } from '@/shared/utils'
import { formatListForCopy, normalizeTimestampMs } from '@/shared/utils/queue'

const store = useQueue()

const isAddingManual = ref(false)
const selectionMode = ref(false)
const selectedIds = ref<number[]>([])
const showCancelAllDialog = ref(false)
const showBatchCancelDialog = ref(false)
const refundOnCancelAll = ref(false)
const refundOnBatchCancel = ref(false)

const progressingItems = computed(() => store.queue.filter((s) => s.status === QueueStatus.Progressing))
const waitingItems = computed(() => store.queue.filter((s) => s.status === QueueStatus.Waiting))
const todayFinishedCount = computed(
  () =>
    store.historySongs.filter(
      (s) => s.status === QueueStatus.Finish && isSameDay(normalizeTimestampMs(s.finishAt), Date.now()),
    ).length,
)

const isTeamMode = computed(() => store.teamSize > 1)
const currentBatchNo = computed(() => {
  const nums = progressingItems.value.map((q) => q.batchNo ?? 0).filter((n) => n > 0)
  return nums.length > 0 ? Math.max(...nums) : null
})
const remainingTeamSlots = computed(() => Math.max(0, store.teamSize - store.progressingQueue.length))
const nextPullCount = computed(() => Math.min(remainingTeamSlots.value, store.waitingQueue.length))

interface WaitingCarGroup {
  carNumber: number
  startIndex: number
  items: ResponseQueueModel[]
}

const waitingCarGroups = computed<WaitingCarGroup[]>(() => {
  if (!isTeamMode.value || store.activeFilterName.trim()) return []
  const size = store.teamSize
  const groups: WaitingCarGroup[] = []
  for (let i = 0; i < waitingItems.value.length; i += size) {
    groups.push({
      carNumber: Math.floor(i / size) + 1,
      startIndex: i,
      items: waitingItems.value.slice(i, i + size),
    })
  }
  return groups
})

const hasRefundableActive = computed(() =>
  store.unfilteredQueue.some((q) => q.pointCost && q.pointCost > 0 && !q.pointRefunded),
)
const hasRefundableSelected = computed(() => {
  const idSet = new Set(selectedIds.value)
  return store.unfilteredQueue.some((q) => idSet.has(q.id) && q.pointCost && q.pointCost > 0 && !q.pointRefunded)
})

const sortOptions = [
  { label: '时间', value: QueueSortType.TimeFirst },
  { label: '付费', value: QueueSortType.PaymentFist },
  { label: '舰长', value: QueueSortType.GuardFirst },
  { label: '粉丝牌', value: QueueSortType.FansMedalFirst },
]

const teamSizePresets = [1, 2, 3, 4, 5]

function canMoveWaitingUp(index: number) {
  if (store.activeFilterName.trim() || index <= 0 || index >= waitingItems.value.length) return false
  return Boolean(waitingItems.value[index].isPinned) === Boolean(waitingItems.value[index - 1].isPinned)
}

function canMoveWaitingDown(index: number) {
  if (store.activeFilterName.trim() || index < 0 || index >= waitingItems.value.length - 1) return false
  return Boolean(waitingItems.value[index].isPinned) === Boolean(waitingItems.value[index + 1].isPinned)
}

async function handleAddManual() {
  if (isAddingManual.value || !store.newQueueName.trim()) return
  isAddingManual.value = true
  try {
    await store.addManual()
  } finally {
    isAddingManual.value = false
  }
}

async function handleTeamSizePreset(val: unknown) {
  if (!val || store.isLoading) return
  const next = Number(val)
  if (!Number.isFinite(next) || next < 1) return
  await store.setTeamSize(next)
}

async function handleSortTypeChange(val: unknown) {
  if (!val || store.isLoading) return
  const nextType = Number(val) as QueueSortType
  const prevType = store.settings.sortType
  if (prevType === nextType) return
  store.settings.sortType = nextType
  if (store.configCanEdit) {
    const ok = await store.saveSettings()
    if (!ok) {
      store.settings.sortType = prevType
    }
  } else {
    toast.success('本地排序规则已切换')
  }
}

async function handleReverseChange(val: boolean) {
  if (store.configCanEdit) {
    if (store.isLoading) return
    const prevReverse = store.settings.isReverse
    store.settings.isReverse = Boolean(val)
    const ok = await store.saveSettings()
    if (!ok) {
      store.settings.isReverse = prevReverse
    }
  } else {
    store.localIsReverse = Boolean(val)
  }
}

watch(
  () => store.unfilteredQueue.map((q) => q.id),
  (ids) => {
    if (selectedIds.value.length === 0) return
    const valid = new Set(ids)
    selectedIds.value = selectedIds.value.filter((id) => valid.has(id))
  },
)

function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  selectedIds.value = []
}

function toggleSelect(id: number, checked: boolean) {
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value = [...selectedIds.value, id]
  } else {
    selectedIds.value = selectedIds.value.filter((item) => item !== id)
  }
}

function selectAllWaiting() {
  selectedIds.value = waitingItems.value.map((q) => q.id)
}

async function handleBatchStart() {
  if (selectedIds.value.length === 0) return
  const ok = await store.batchUpdateStatus([...selectedIds.value], QueueStatus.Progressing)
  if (ok) {
    selectedIds.value = []
    selectionMode.value = false
  }
}

async function handleBatchFinish() {
  if (selectedIds.value.length === 0) return
  const ok = await store.batchUpdateStatus([...selectedIds.value], QueueStatus.Finish)
  if (ok) {
    selectedIds.value = []
    selectionMode.value = false
  }
}

function openBatchCancelDialog() {
  if (selectedIds.value.length === 0) return
  refundOnBatchCancel.value = hasRefundableSelected.value
  showBatchCancelDialog.value = true
}

async function confirmBatchCancel() {
  const ok = await store.batchUpdateStatus(
    [...selectedIds.value],
    QueueStatus.Cancel,
    hasRefundableSelected.value && refundOnBatchCancel.value,
  )
  showBatchCancelDialog.value = false
  if (ok) {
    selectedIds.value = []
    selectionMode.value = false
  }
}

function openCancelAllDialog() {
  refundOnCancelAll.value = hasRefundableActive.value
  showCancelAllDialog.value = true
}

async function confirmCancelAll() {
  await store.deactiveAllSongs(hasRefundableActive.value && refundOnCancelAll.value)
  showCancelAllDialog.value = false
  selectedIds.value = []
  selectionMode.value = false
}

async function copyQueueList(list: ResponseQueueModel[] = store.queue, label = '排队观众名单') {
  if (list.length === 0) {
    toast.info('当前列表为空')
    return
  }
  const text = formatListForCopy(
    list,
    (q) => q.user?.name ?? '未知用户',
    (q) => q.content,
  )
  await copyToClipboard(text, `已复制 ${list.length} 位${label}`)
}

async function copySingleNote(content: string | null | undefined) {
  const trimmed = content?.trim()
  if (!trimmed) return
  await copyToClipboard(trimmed, `已复制「${trimmed}」`)
}
</script>

<template>
  <div class="space-y-3">
    <Card>
      <CardContent class="p-3 space-y-2.5">
        <div class="flex-between gap-2.5 flex-wrap">
          <div class="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              class="gap-1 border-sky-500/40 text-sky-600 bg-sky-500/10"
            >
              <PeopleQueue24Filled class="size-3.5" />
              等待: {{ waitingItems.length }}
            </Badge>
            <Badge
              variant="success"
              class="gap-1"
            >
              <Checkmark12Regular class="size-3.5" />
              今日完成: {{ todayFinishedCount }}
            </Badge>
            <span class="text-xs text-muted-foreground">活跃 {{ store.unfilteredQueue.length }} 人</span>
            <Badge
              v-if="store.hasCustomOrder"
              variant="secondary"
              size="xs"
            >
              已手动调序
            </Badge>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-muted-foreground whitespace-nowrap">每车人数:</span>
              <ToggleGroup
                type="single"
                size="xs"
                :model-value="teamSizePresets.includes(store.teamSize) ? String(store.teamSize) : ''"
                :disabled="store.isLoading"
                @update:model-value="handleTeamSizePreset"
              >
                <ToggleGroupItem
                  v-for="preset in teamSizePresets"
                  :key="preset"
                  :value="String(preset)"
                >
                  {{ preset === 1 ? '单人' : `${preset}人` }}
                </ToggleGroupItem>
              </ToggleGroup>
              <Badge
                v-if="!teamSizePresets.includes(store.teamSize)"
                variant="secondary"
                size="xs"
              >
                {{ store.teamSize }}人车
              </Badge>
            </div>

            <Button
              variant="outline"
              :disabled="store.queue.length === 0"
              @click="copyQueueList(store.queue)"
            >
              <Copy24Regular class="size-3.5 mr-1" />
              复制名单
            </Button>

            <Button
              :variant="selectionMode ? 'default' : 'outline'"
              :disabled="!selectionMode && store.unfilteredQueue.length === 0"
              @click="toggleSelectionMode"
            >
              {{ selectionMode ? '退出批量' : '批量管理' }}
            </Button>

            <Button
              variant="outline"
              class="border-destructive/40 text-destructive hover:bg-destructive/10"
              :disabled="store.unfilteredQueue.length === 0"
              @click="openCancelAllDialog"
            >
              全部取消
            </Button>
          </div>
        </div>

        <!-- 手动添加 + 搜索与排序 -->
        <div class="flex-between gap-2.5 flex-wrap pt-2 border-t border-border/60">
          <div class="flex items-center gap-1.5 flex-nowrap shrink-0">
            <Input
              v-model="store.newQueueName"
              placeholder="手动添加观众昵称"
              class="w-[132px]"
              @keyup.enter="handleAddManual"
            />
            <Input
              v-model="store.newQueueContent"
              placeholder="可选：游戏 ID / 备注"
              class="w-[144px]"
              @keyup.enter="handleAddManual"
            />
            <Button
              class="shrink-0"
              :loading="isAddingManual"
              :disabled="isAddingManual || !store.newQueueName.trim()"
              @click="handleAddManual"
            >
              添加
            </Button>
          </div>

          <div class="flex items-center gap-2.5 flex-wrap">
            <div class="relative w-[190px] max-w-full">
              <Search24Regular
                class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <Input
                v-model="store.activeFilterName"
                placeholder="搜索用户或游戏 ID..."
                class="pl-7 pr-7"
              />
              <button
                v-if="store.activeFilterName"
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="清空搜索"
                @click="store.activeFilterName = ''"
              >
                <Dismiss16Filled class="size-3" />
              </button>
            </div>

            <ToggleGroup
              type="single"
              size="xs"
              :model-value="String(store.settings.sortType ?? QueueSortType.TimeFirst)"
              :disabled="store.isLoading"
              @update:model-value="handleSortTypeChange"
            >
              <ToggleGroupItem
                v-for="opt in sortOptions"
                :key="opt.value"
                :value="String(opt.value)"
              >
                {{ opt.label }}
              </ToggleGroupItem>
            </ToggleGroup>

            <label class="flex items-center gap-1.5 cursor-pointer text-xs select-none">
              <Checkbox
                :checked="store.configCanEdit ? Boolean(store.settings.isReverse) : store.localIsReverse"
                :disabled="store.isLoading"
                @update:checked="handleReverseChange"
              />
              <span>倒序</span>
            </label>

            <Button
              v-if="store.hasCustomOrder"
              size="xs"
              variant="outline"
              :disabled="store.isLoading"
              @click="store.resetOrder()"
            >
              <ArrowReset24Regular class="size-3.5 mr-1" />
              恢复规则排序
            </Button>
          </div>
        </div>

        <!-- 批量操作栏 -->
        <div
          v-if="selectionMode"
          class="flex-between gap-2 flex-wrap rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs"
        >
          <div class="flex items-center gap-2">
            <span class="font-medium text-foreground">已选择 {{ selectedIds.length }} 位观众</span>
            <Button
              size="xs"
              variant="ghost"
              @click="selectAllWaiting"
            >
              全选等待中 ({{ waitingItems.length }})
            </Button>
            <Button
              v-if="selectedIds.length > 0"
              size="xs"
              variant="ghost"
              @click="selectedIds = []"
            >
              清空选择
            </Button>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <Button
              size="xs"
              variant="default"
              :disabled="selectedIds.length === 0 || store.isLoading"
              @click="handleBatchStart"
            >
              <Play class="size-3.5 mr-1" />
              批量拉入本局
            </Button>
            <Button
              size="xs"
              class="bg-emerald-600 hover:bg-emerald-700 text-white"
              :disabled="selectedIds.length === 0 || store.isLoading"
              @click="handleBatchFinish"
            >
              批量标记已完成
            </Button>
            <Button
              size="xs"
              variant="outline"
              class="border-destructive/40 text-destructive hover:bg-destructive/10"
              :disabled="selectedIds.length === 0 || store.isLoading"
              @click="openBatchCancelDialog"
            >
              批量取消
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 本局车队 / 正在进行驾驶舱 -->
    <Card
      v-if="progressingItems.length > 0"
      class="border-emerald-500/40 bg-emerald-500/[0.03]"
    >
      <CardContent class="p-3.5 space-y-3">
        <div class="flex-between gap-2.5 flex-wrap">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span class="text-sm font-semibold text-foreground">
              {{ isTeamMode ? '本局车队' : '正在进行' }}
            </span>
            <Badge
              variant="success"
              size="xs"
            >
              {{ progressingItems.length }} / {{ store.teamSize }} 人
            </Badge>
            <Badge
              v-if="currentBatchNo"
              variant="outline"
              size="xs"
              class="border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
            >
              第 {{ currentBatchNo }} 车
            </Badge>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <Button
              size="xs"
              variant="outline"
              @click="copyQueueList(progressingItems, '本局成员名单')"
            >
              <Copy class="size-3.5 mr-1" />
              复制本队
            </Button>

            <Button
              v-if="nextPullCount > 0"
              size="xs"
              variant="outline"
              :disabled="store.isBatchLoading"
              @click="store.nextBatch()"
            >
              <Users class="size-3.5 mr-1" />
              补满本队 (+{{ nextPullCount }})
            </Button>

            <Button
              size="xs"
              class="bg-emerald-600 hover:bg-emerald-700 text-white"
              :loading="store.isBatchLoading"
              :disabled="store.isBatchLoading"
              @click="store.finishAndNextBatch()"
            >
              <Checkmark12Regular class="size-3.5 mr-1" />
              <template v-if="store.waitingQueue.length > 0">
                {{
                  isTeamMode
                    ? `结束本局并拉下一队 (${Math.min(store.teamSize, store.waitingQueue.length)}人)`
                    : '完成并切下一位'
                }}
              </template>
              <template v-else>
                {{ isTeamMode ? '全员标记完成' : '标记完成' }}
              </template>
            </Button>
          </div>
        </div>

        <div
          class="grid gap-2"
          :class="isTeamMode ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'"
        >
          <div
            v-for="(item, idx) in progressingItems"
            :key="`party-${item.id}`"
            class="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/25 bg-background px-3 py-2 shadow-2xs"
          >
            <div class="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
              <span class="inline-flex-center size-5 rounded-md bg-emerald-600 text-white text-xs font-mono font-bold shrink-0">
                {{ idx + 1 }}
              </span>
              <span class="font-semibold text-sm text-foreground truncate max-w-[140px]">
                {{ item.user?.name || '未知用户' }}
              </span>
              <UserBadges
                :user="item.user"
                :show-fan-medal="store.settings.showFanMadelInfo"
                size="tiny"
              />
              <Badge
                v-if="item.from === QueueFrom.Web"
                variant="outline"
                size="xs"
                class="border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
              >
                网页
              </Badge>
              <Badge
                v-else-if="item.from === QueueFrom.SC"
                variant="warning"
                size="xs"
              >
                SC
              </Badge>
              <button
                v-if="item.content"
                type="button"
                class="inline-flex items-center gap-1 max-w-[200px] rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 transition-colors cursor-pointer"
                title="点击复制游戏 ID / 备注"
                @click="copySingleNote(item.content)"
              >
                <span class="truncate">{{ item.content }}</span>
                <Copy class="size-3 shrink-0" />
              </button>
            </div>

            <TooltipProvider>
              <div class="flex items-center gap-1 shrink-0">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      class="text-amber-600 hover:bg-amber-500/10"
                      :disabled="store.isBatchLoading || store.isQueueOperating(item.id)"
                      aria-label="暂离顺延并补位"
                      @click="store.replaceMember(item, 'defer', false, true)"
                    >
                      <Clock class="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>暂离顺延到下一车后，并自动补位</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      class="text-destructive hover:bg-destructive/10"
                      :disabled="store.isBatchLoading || store.isQueueOperating(item.id)"
                      aria-label="取消并补位"
                      @click="store.replaceMember(item, 'cancel', false, true)"
                    >
                      <UserMinus class="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>踢出/取消本席位并自动补位</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      :disabled="store.isBatchLoading || store.isQueueOperating(item.id)"
                      aria-label="退回等待"
                      @click="store.updateStatus(item, QueueStatus.Waiting)"
                    >
                      <RotateCcw class="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>退回等待队列</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      class="text-emerald-600 hover:bg-emerald-500/10"
                      :disabled="store.isBatchLoading || store.isQueueOperating(item.id)"
                      aria-label="单独标记完成"
                      @click="store.updateStatus(item, QueueStatus.Finish)"
                    >
                      <Checkmark12Regular class="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>单独标记完成</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 等待队列 -->
    <Card>
      <CardContent class="p-3 space-y-3">
        <div
          v-if="waitingItems.length > 0"
          class="flex-between gap-2 flex-wrap"
        >
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <span class="font-semibold text-foreground text-sm">等待队列</span>
            <span>共 {{ waitingItems.length }} 人</span>
            <span v-if="isTeamMode">
              · 预计 {{ Math.ceil(waitingItems.length / store.teamSize) }} 车
            </span>
          </div>

          <Button
            v-if="progressingItems.length === 0"
            size="xs"
            variant="default"
            :loading="store.isBatchLoading"
            :disabled="store.isBatchLoading"
            @click="store.nextBatch()"
          >
            <ArrowRight class="size-3.5 mr-1" />
            {{
              isTeamMode
                ? `拉下一队上车 (${Math.min(store.teamSize, waitingItems.length)}人)`
                : '开始处理首位'
            }}
          </Button>
        </div>

        <!-- 组队模式按车次分组 -->
        <div
          v-if="waitingItems.length > 0 && isTeamMode && !store.activeFilterName.trim()"
          class="space-y-3"
        >
          <div
            v-for="group in waitingCarGroups"
            :key="`car-${group.carNumber}`"
            class="space-y-2 rounded-lg p-2.5 border transition-colors"
            :class="
              group.carNumber === 1
                ? 'border-sky-500/35 bg-sky-500/[0.03]'
                : 'border-border/60 bg-muted/15'
            "
          >
            <div class="flex-between gap-2 text-xs px-0.5">
              <div class="flex items-center gap-2">
                <Badge
                  :variant="group.carNumber === 1 ? 'default' : 'secondary'"
                  size="xs"
                >
                  {{ group.carNumber === 1 ? '下一车准备中' : `第 ${group.carNumber} 车` }}
                </Badge>
                <span class="text-muted-foreground font-mono tabular-nums">
                  {{ group.items.length }} / {{ store.teamSize }} 人
                </span>
              </div>

              <div class="flex items-center gap-1.5">
                <Button
                  size="xs"
                  variant="ghost"
                  @click="copyQueueList(group.items, `第 ${group.carNumber} 车名单`)"
                >
                  <Copy class="size-3 mr-1" />
                  复制本车
                </Button>
                <Button
                  v-if="group.carNumber === 1 && progressingItems.length === 0"
                  size="xs"
                  variant="outline"
                  :disabled="store.isBatchLoading"
                  @click="store.nextBatch()"
                >
                  <RefreshCw class="size-3 mr-1" />
                  整车拉上车
                </Button>
              </div>
            </div>

            <div class="space-y-1.5">
              <QueueItem
                v-for="(queueData, localIdx) in group.items"
                :key="queueData.id"
                :queue-data="queueData"
                :index="group.startIndex + localIdx + 1"
                :can-move-up="canMoveWaitingUp(group.startIndex + localIdx)"
                :can-move-down="canMoveWaitingDown(group.startIndex + localIdx)"
                :selection-mode="selectionMode"
                :selected="selectedIds.includes(queueData.id)"
                @toggle-select="(checked) => toggleSelect(queueData.id, checked)"
              />
            </div>
          </div>
        </div>

        <!-- 单人模式或搜索过滤结果 -->
        <div
          v-else-if="waitingItems.length > 0"
          class="space-y-2"
        >
          <QueueItem
            v-for="(queueData, index) in waitingItems"
            :key="queueData.id"
            :queue-data="queueData"
            :index="index + 1"
            :can-move-up="canMoveWaitingUp(index)"
            :can-move-down="canMoveWaitingDown(index)"
            :selection-mode="selectionMode"
            :selected="selectedIds.includes(queueData.id)"
            @toggle-select="(checked) => toggleSelect(queueData.id, checked)"
          />
        </div>

        <div
          v-else-if="progressingItems.length > 0"
          class="text-center py-6 text-xs text-muted-foreground"
        >
          当前暂无其他等待排队的观众
        </div>
        <Empty
          v-else
          :description="
            store.activeFilterName ? '没有匹配当前关键词的排队观众' : '当前排队队列为空，等待观众发送弹幕或送礼加入'
          "
          class="py-12"
        >
          <Button
            v-if="store.activeFilterName"
            variant="outline"
            @click="store.activeFilterName = ''"
          >
            清除筛选
          </Button>
        </Empty>
      </CardContent>
    </Card>

    <!-- 全部取消确认弹窗 -->
    <AlertDialog v-model:open="showCancelAllDialog">
      <AlertDialogContent class="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>取消全部当前排队？</AlertDialogTitle>
          <AlertDialogDescription class="text-xs">
            确定取消当前排队中的 {{ store.unfilteredQueue.length }} 位观众吗？记录将进入历史列表。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label
          v-if="hasRefundableActive"
          class="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-xs cursor-pointer select-none"
        >
          <Checkbox v-model:checked="refundOnCancelAll" />
          <span>同时退回尚未退款的积分消费</span>
        </label>

        <AlertDialogFooter>
          <AlertDialogCancel>保留</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="confirmCancelAll"
          >
            确认取消全部
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <!-- 批量取消确认弹窗 -->
    <AlertDialog v-model:open="showBatchCancelDialog">
      <AlertDialogContent class="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>批量取消选中的排队？</AlertDialogTitle>
          <AlertDialogDescription class="text-xs">
            确定将选中的 {{ selectedIds.length }} 条排队记录标记为「已取消」吗？
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label
          v-if="hasRefundableSelected"
          class="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-xs cursor-pointer select-none"
        >
          <Checkbox v-model:checked="refundOnBatchCancel" />
          <span>同时退回选中记录中已消费的积分</span>
        </label>

        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="confirmBatchCancel"
          >
            确认取消 ({{ selectedIds.length }})
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
