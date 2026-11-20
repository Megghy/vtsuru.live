<script setup lang="ts">
import ArrowDown24Regular from '@vicons/fluent/es/ArrowDown24Regular'
import ArrowUp24Regular from '@vicons/fluent/es/ArrowUp24Regular'
import Checkmark12Regular from '@vicons/fluent/es/Checkmark12Regular'
import ClipboardTextLtr24Filled from '@vicons/fluent/es/ClipboardTextLtr24Filled'
import Dismiss16Filled from '@vicons/fluent/es/Dismiss16Filled'
import Pin24Regular from '@vicons/fluent/es/Pin24Regular'
import PresenceBlocked16Regular from '@vicons/fluent/es/PresenceBlocked16Regular'
import { computed, ref } from 'vue'

import type { ResponseQueueModel } from '@/api/client-types'
import { QueueFrom, QueueStatus } from '@/api/generated/model'
import LiveQueueRowShell from '@/apps/open-live/components/shared/LiveQueueRowShell.vue'
import UserBadges from '@/apps/open-live/components/UserBadges.vue'
import { getQueuePaymentMeta, useQueue } from '@/composables/useQueue'
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
import { Checkbox } from '@/shared/ui/checkbox'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { normalizeTimestampMs } from '@/shared/utils/queue'

const props = defineProps<{
  queueData: ResponseQueueModel
  index: number
  canMoveUp?: boolean
  canMoveDown?: boolean
  selectionMode?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-select', checked: boolean): void
}>()

const store = useQueue()

const showCancelDialog = ref(false)
const showBlockDialog = ref(false)
const refundPointOnCancel = ref(false)

const isProcessing = computed(() => props.queueData.status === QueueStatus.Progressing)
const isWaiting = computed(() => props.queueData.status === QueueStatus.Waiting)
const isItemBusy = computed(() => store.isBatchLoading || store.isQueueOperating(props.queueData.id))
const hasOtherProcessing = computed(() =>
  store.unfilteredQueue.some((s) => s.id !== props.queueData.id && s.status === QueueStatus.Progressing),
)
const paymentMeta = computed(() => getQueuePaymentMeta(props.queueData))
const canRefundPoint = computed(() =>
  Boolean(props.queueData.pointCost && props.queueData.pointCost > 0 && !props.queueData.pointRefunded),
)
const canBlock = computed(
  () =>
    store.configCanEdit &&
    (props.queueData.from === QueueFrom.Danmaku || props.queueData.from === QueueFrom.Gift) &&
    Boolean(props.queueData.user?.uid),
)

const indexBadgeClass = computed(() => {
  if (isProcessing.value) return 'bg-emerald-600 text-white'
  if (props.queueData.status === QueueStatus.Finish) return 'bg-muted text-muted-foreground'
  if (props.queueData.status === QueueStatus.Cancel) return 'bg-destructive text-destructive-foreground'
  return 'bg-sky-600/15 text-sky-600'
})

function manage(status: QueueStatus) {
  void store.updateStatus(props.queueData, status)
}

function openCancelDialog() {
  refundPointOnCancel.value = canRefundPoint.value
  showCancelDialog.value = true
}

async function confirmCancel() {
  await store.updateStatus(props.queueData, QueueStatus.Cancel, canRefundPoint.value && refundPointOnCancel.value)
  showCancelDialog.value = false
}

async function confirmBlock() {
  await store.blockUser(props.queueData)
  showBlockDialog.value = false
}

function formatRelativeTime(timestamp: number) {
  const ts = normalizeTimestampMs(timestamp)
  const diffSec = Math.floor((Date.now() - ts) / 1000)
  if (diffSec < 60) return '刚刚'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`
  return `${Math.floor(diffSec / 86400)}天前`
}
</script>

<template>
  <LiveQueueRowShell
    :index="index"
    :index-class="indexBadgeClass"
    :highlighted="isProcessing"
    :selection-mode="selectionMode"
    :selected="selected"
    select-label="选择排队记录"
    @toggle-select="(val) => emit('toggle-select', val)"
  >
    <template #primary>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <span class="font-medium text-sm text-foreground truncate min-w-0 cursor-help">
              {{ queueData.user?.name || '未知用户' }}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {{ queueData.user?.uid ? `UID: ${queueData.user?.uid}` : `OpenID: ${queueData.user?.oid}` }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </template>

    <template #context>
      <UserBadges
        :user="queueData.user"
        :show-fan-medal="store.settings.showFanMadelInfo"
        size="tiny"
      />

      <TooltipProvider v-if="store.settings.showPayment && paymentMeta.hasMysteryBoxPayment">
        <Tooltip>
          <TooltipTrigger as-child>
            <Badge
              variant="warning"
              size="xs"
            >
              {{ paymentMeta.shortText }}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {{ paymentMeta.detailText }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Badge
        v-if="store.settings.showPayment && paymentMeta.giftPriceText"
        variant="destructive"
        size="xs"
      >
        ¥{{ paymentMeta.giftPriceText }}
      </Badge>

      <Badge
        v-if="queueData.from === QueueFrom.Web"
        variant="outline"
        size="xs"
        class="border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
      >
        网页排队
      </Badge>
      <Badge
        v-else-if="queueData.from === QueueFrom.Manual"
        variant="secondary"
        size="xs"
      >
        手动添加
      </Badge>

      <Badge
        v-if="queueData.priorityLevel > 0"
        variant="default"
        size="xs"
      >
        插队{{ queueData.priorityLevel > 1 ? ` ×${queueData.priorityLevel}` : '' }}
      </Badge>

      <Badge
        v-if="queueData.pointCost && queueData.pointCost > 0"
        variant="secondary"
        size="xs"
      >
        {{ queueData.pointCost }} 积分
      </Badge>

      <Badge
        v-if="queueData.pointRefunded"
        variant="outline"
        size="xs"
        class="border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
      >
        已退积分
      </Badge>

      <TooltipProvider v-if="queueData.content">
        <Tooltip>
          <TooltipTrigger as-child>
            <span class="text-xs text-muted-foreground truncate min-w-0 cursor-help">
              「{{ queueData.content }}」
            </span>
          </TooltipTrigger>
          <TooltipContent class="max-w-xs">
            <div class="text-muted-foreground mb-0.5">
              {{
                `来自${queueData?.from === QueueFrom.Gift ? '礼物' : queueData?.from === QueueFrom.Web ? '网页留言' : '弹幕'}:`
              }}
            </div>
            <div>{{ queueData?.content }}</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </template>

    <template #meta>
      <span class="text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap">
        {{ formatRelativeTime(queueData.createAt) }}
      </span>
    </template>

    <template #actions>
      <TooltipProvider>
        <template v-if="isWaiting">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-xs"
                variant="ghost"
                :disabled="!canMoveUp || isItemBusy"
                aria-label="置顶"
                @click="store.pinQueue(queueData)"
              >
                <Pin24Regular class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>置顶到等待首位</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-xs"
                variant="ghost"
                :disabled="!canMoveUp || isItemBusy"
                aria-label="上移"
                @click="store.moveQueue(queueData, 'up')"
              >
                <ArrowUp24Regular class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>上移一位</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon-xs"
                variant="ghost"
                :disabled="!canMoveDown || isItemBusy"
                aria-label="下移"
                @click="store.moveQueue(queueData, 'down')"
              >
                <ArrowDown24Regular class="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>下移一位</TooltipContent>
          </Tooltip>
        </template>

        <!-- 开始/暂停处理 -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              :variant="isProcessing ? 'outline' : 'default'"
              :class="{ 'border-amber-500 text-amber-600 hover:bg-amber-500/10': isProcessing }"
              :disabled="hasOtherProcessing || isItemBusy"
              aria-label="开始或暂停处理"
              @click="manage(isProcessing ? QueueStatus.Waiting : QueueStatus.Progressing)"
            >
              <ClipboardTextLtr24Filled class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ hasOtherProcessing ? '已有其他用户正在处理中' : isProcessing ? '暂停处理 (返回等待)' : '开始处理' }}
          </TooltipContent>
        </Tooltip>

        <!-- 标记完成 -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              variant="ghost"
              class="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
              :disabled="isItemBusy"
              aria-label="标记已完成"
              @click="manage(QueueStatus.Finish)"
            >
              <Checkmark12Regular class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>标记为已完成</TooltipContent>
        </Tooltip>

        <!-- 拉黑用户 -->
        <Tooltip v-if="canBlock">
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              variant="ghost"
              class="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
              :disabled="isItemBusy"
              aria-label="拉黑观众"
              @click="showBlockDialog = true"
            >
              <PresenceBlocked16Regular class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>拉黑用户并取消</TooltipContent>
        </Tooltip>

        <!-- 取消排队 -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="icon-xs"
              variant="ghost"
              class="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              :disabled="isItemBusy"
              aria-label="取消排队"
              @click="openCancelDialog"
            >
              <Dismiss16Filled class="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>取消此排队</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </template>
  </LiveQueueRowShell>

  <!-- 取消排队确认弹窗 -->
  <AlertDialog v-model:open="showCancelDialog">
    <AlertDialogContent class="sm:max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>取消此排队？</AlertDialogTitle>
        <AlertDialogDescription class="text-xs">
          确定要将「{{ queueData.user?.name || '该观众' }}」从当前队列中取消吗？
        </AlertDialogDescription>
      </AlertDialogHeader>

      <label
        v-if="canRefundPoint"
        class="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-xs cursor-pointer select-none"
      >
        <Checkbox v-model:checked="refundPointOnCancel" />
        <span>同时退回观众消耗的 {{ queueData.pointCost }} 积分</span>
      </label>

      <AlertDialogFooter>
        <AlertDialogCancel>保留</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          @click="confirmCancel"
        >
          确认取消
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>

  <!-- 拉黑确认弹窗 -->
  <AlertDialog v-model:open="showBlockDialog">
    <AlertDialogContent class="sm:max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>拉黑用户？</AlertDialogTitle>
        <AlertDialogDescription class="text-xs">
          确定要将「{{ queueData.user?.name }}」加入 B站黑名单并取消其当前排队吗？
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          @click="confirmBlock"
        >
          确认拉黑
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
