<script setup lang="ts">
import ArrowReset24Regular from '@vicons/fluent/es/ArrowReset24Regular'
import Checkmark12Regular from '@vicons/fluent/es/Checkmark12Regular'
import ClipboardTextLtr24Filled from '@vicons/fluent/es/ClipboardTextLtr24Filled'
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import Dismiss16Filled from '@vicons/fluent/es/Dismiss16Filled'
import PeopleQueue24Filled from '@vicons/fluent/es/PeopleQueue24Filled'
import Search24Regular from '@vicons/fluent/es/Search24Regular'
import { isSameDay } from 'date-fns'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { QueueFrom, QueueSortType, QueueStatus } from '@/api/generated/model'
import QueueItem from '@/apps/open-live/components/queue/QueueItem.vue'
import LiveActiveFocusCard from '@/apps/open-live/components/shared/LiveActiveFocusCard.vue'
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

function waitingIndex(id: number) {
  return waitingItems.value.findIndex((q) => q.id === id)
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

async function updateSortSetting() {
  if (store.configCanEdit) {
    await store.saveSettings()
  } else {
    toast.success('本地排序规则已切换')
  }
}

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
}

async function copyQueueList() {
  if (store.queue.length === 0) {
    toast.info('当前排队列表为空')
    return
  }
  const text = formatListForCopy(store.queue, (q) => q.user?.name ?? '未知用户')
  await copyToClipboard(text, `已复制 ${store.queue.length} 位排队观众名单`)
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
            <div class="flex items-center gap-1.5 w-[180px]">
              <Input
                v-model="store.newQueueName"
                placeholder="手动输入观众昵称"
                class="flex-1"
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

            <Button
              variant="outline"
              :disabled="store.queue.length === 0"
              @click="copyQueueList"
            >
              <Copy24Regular class="size-3.5 mr-1" />
              复制名单
            </Button>

            <Button
              :variant="selectionMode ? 'default' : 'outline'"
              :disabled="store.unfilteredQueue.length === 0"
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

        <!-- 搜索与排序 -->
        <div class="flex-between gap-2.5 flex-wrap pt-2 border-t border-border/60">
          <div class="relative w-[220px] max-w-full">
            <Search24Regular
              class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <Input
              v-model="store.activeFilterName"
              placeholder="搜索队列用户或留言..."
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

          <div class="flex items-center gap-2.5 flex-wrap">
            <ToggleGroup
              type="single"
              size="xs"
              :model-value="String(store.settings.sortType ?? QueueSortType.TimeFirst)"
              @update:model-value="
                (val) => {
                  if (val) {
                    store.settings.sortType = Number(val) as QueueSortType
                    void updateSortSetting()
                  }
                }
              "
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
                @update:checked="
                  (val) => {
                    if (store.configCanEdit) {
                      store.settings.isReverse = Boolean(val)
                      void updateSortSetting()
                    } else {
                      store.localIsReverse = Boolean(val)
                    }
                  }
                "
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

          <div class="flex items-center gap-2">
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

    <!-- 正在进行中焦点卡 -->
    <LiveActiveFocusCard
      v-for="item in progressingItems"
      :key="`progressing-${item.id}`"
      badge-label="正在进行"
      :badge-icon="ClipboardTextLtr24Filled"
      :title="item.user?.name || '未知用户'"
    >
      <template #meta>
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
          网页排队
        </Badge>
        <Badge
          v-if="item.pointCost && item.pointCost > 0"
          variant="secondary"
          size="xs"
        >
          {{ item.pointCost }} 积分
        </Badge>
        <span
          v-if="item.content"
          class="text-xs text-muted-foreground truncate max-w-sm"
        >
          「{{ item.content }}」
        </span>
      </template>

      <template #actions>
        <Button
          size="xs"
          variant="outline"
          :disabled="store.isBatchLoading || store.isQueueOperating(item.id)"
          @click="store.updateStatus(item, QueueStatus.Waiting)"
        >
          暂停退回
        </Button>
        <Button
          size="xs"
          class="bg-emerald-600 hover:bg-emerald-700 text-white"
          :disabled="store.isBatchLoading || store.isQueueOperating(item.id)"
          @click="store.updateStatus(item, QueueStatus.Finish)"
        >
          <Checkmark12Regular class="size-3.5 mr-1" />
          标记完成
        </Button>
      </template>
    </LiveActiveFocusCard>

    <Card>
      <CardContent class="p-3">
        <div
          v-if="waitingItems.length > 0"
          class="space-y-2"
        >
          <QueueItem
            v-for="(queueData, index) in waitingItems"
            :key="queueData.id"
            :queue-data="queueData"
            :index="index + 1"
            :can-move-up="!store.activeFilterName.trim() && waitingIndex(queueData.id) > 0"
            :can-move-down="
              !store.activeFilterName.trim() &&
              waitingIndex(queueData.id) >= 0 &&
              waitingIndex(queueData.id) < waitingItems.length - 1
            "
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
