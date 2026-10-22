<script setup lang="ts">
import {
  Checkmark12Regular,
  ClipboardTextLtr24Filled,
  Dismiss16Filled,
  Info24Filled,
  PresenceBlocked16Regular,
} from '@vicons/fluent'
import { computed } from 'vue'

import type { ResponseQueueModel } from '@/api/api-models'
import { QueueFrom, QueueStatus } from '@/api/api-models'
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
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{
  queueData: ResponseQueueModel
  index: number
}>()

const store = useQueue()

const isProcessing = computed(() => props.queueData.status === QueueStatus.Progressing)
const isManaging = computed(() => store.queueDataBeingManaged === props.queueData.id)
const hasOtherProcessing = computed(() =>
  store.queue.some((s) => s.id !== props.queueData.id && s.status === QueueStatus.Progressing),
)
const paymentMeta = computed(() => getQueuePaymentMeta(props.queueData))
const canBlock = computed(
  () =>
    store.configCanEdit &&
    (props.queueData.from === QueueFrom.Danmaku || props.queueData.from === QueueFrom.Gift) &&
    Boolean(props.queueData.user?.uid),
)

function manage(status: QueueStatus) {
  store.queueDataBeingManaged = props.queueData.id
  store.updateStatus(props.queueData, status)
}

function formatRelativeTime(timestamp: number) {
  const ts = typeof timestamp === 'number' && timestamp < 1e12 ? timestamp * 1000 : timestamp
  const diffSec = Math.floor((Date.now() - ts) / 1000)
  if (diffSec < 60) return '刚刚'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`
  return `${Math.floor(diffSec / 86400)}天前`
}
</script>

<template>
  <div
    class="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-card/60 hover:bg-card transition-all"
    :class="{
      'border-l-4 border-l-emerald-500 bg-emerald-500/5': isProcessing,
      'hover:border-brand/40': !isProcessing,
    }"
  >
    <!-- 左侧信息 -->
    <div class="flex items-center gap-2.5 min-w-0">
      <span
        class="inline-flex items-center justify-center font-bold w-6 h-6 rounded-full text-xs shrink-0 font-mono"
        :class="{
          'bg-emerald-500 text-white animate-pulse': isProcessing,
          'bg-muted text-muted-foreground': queueData.status === QueueStatus.Finish,
          'bg-destructive text-destructive-foreground': queueData.status === QueueStatus.Cancel,
          'bg-brand/10 text-brand': queueData.status === QueueStatus.Waiting,
        }"
      >
        {{ index }}
      </span>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <span class="font-medium text-sm text-foreground truncate max-w-[140px] sm:max-w-[220px] cursor-pointer">
              {{ queueData.user?.name || '未知用户' }}
            </span>
          </TooltipTrigger>
          <TooltipContent class="text-xs">
            {{ queueData.user?.uid ? `UID: ${queueData.user?.uid}` : `OpenID: ${queueData.user?.oid}` }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <UserBadges
        :user="queueData.user"
        :show-fan-medal="store.settings.showFanMadelInfo"
        size="tiny"
      />

      <!-- 付费信息 -->
      <TooltipProvider v-if="store.settings.showPayment && paymentMeta.hasMysteryBoxPayment">
        <Tooltip>
          <TooltipTrigger as-child>
            <Badge
              variant="warning"
              class="text-[10px] px-1.5 py-0 h-4"
            >
              {{ paymentMeta.shortText }}
            </Badge>
          </TooltipTrigger>
          <TooltipContent class="text-xs">
            {{ paymentMeta.detailText }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Badge
        v-if="store.settings.showPayment && paymentMeta.giftPriceText"
        variant="destructive"
        class="text-[10px] px-1.5 py-0 h-4"
      >
        ￥ {{ paymentMeta.giftPriceText }}
      </Badge>

      <!-- 附加弹幕/留言内容 -->
      <TooltipProvider v-if="queueData.content">
        <Tooltip>
          <TooltipTrigger as-child>
            <component
              :is="Info24Filled"
              class="h-3.5 w-3.5 text-muted-foreground cursor-help"
            />
          </TooltipTrigger>
          <TooltipContent class="text-xs max-w-xs">
            <div class="text-[10px] text-muted-foreground mb-0.5">
              {{ `来自${queueData?.from === QueueFrom.Gift ? '礼物' : '弹幕'}:` }}
            </div>
            <div>{{ queueData?.content }}</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <span class="text-xs text-muted-foreground hidden sm:inline font-mono">
        {{ formatRelativeTime(queueData.createAt) }}
      </span>
    </div>

    <!-- 右侧操作 -->
    <div class="flex items-center gap-1 shrink-0">
      <TooltipProvider>
        <!-- 开始/暂停处理 -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button size="icon-xs" :variant="isProcessing ? 'outline' : 'brand'" :class="{ 'border-amber-500 text-amber-500 hover:bg-amber-500/10': isProcessing }" :disabled="hasOtherProcessing" :loading="store.isLoading && isManaging" @click="manage(isProcessing ? QueueStatus.Waiting : QueueStatus.Progressing)">
              <component
                :is="ClipboardTextLtr24Filled"
                class="h-3.5 w-3.5"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="text-xs">
            {{ hasOtherProcessing ? '已有其他用户正在处理中' : isProcessing ? '暂停处理 (返回等待)' : '开始处理' }}
          </TooltipContent>
        </Tooltip>

        <!-- 标记完成 -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button size="icon-xs" variant="ghost" class="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10" :loading="store.isLoading && isManaging" @click="manage(QueueStatus.Finish)">
              <component
                :is="Checkmark12Regular"
                class="h-4 w-4"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="text-xs">
            标记为已完成
          </TooltipContent>
        </Tooltip>

        <!-- 拉黑用户 -->
        <AlertDialog v-if="canBlock">
          <AlertDialogTrigger as-child>
            <Button size="icon-xs" variant="ghost" class="text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" :loading="store.isLoading && isManaging" @click="store.queueDataBeingManaged = queueData.id">
              <component
                :is="PresenceBlocked16Regular"
                class="h-3.5 w-3.5"
              />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent class="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>拉黑用户？</AlertDialogTitle>
              <AlertDialogDescription class="text-xs">
                确定要将 {{ queueData.user?.name }} 加入黑名单并取消当前排队吗？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                @click="store.blockUser(queueData)"
              >
                确认拉黑
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <!-- 取消排队 -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button size="icon-xs" variant="ghost" class="text-muted-foreground hover:text-destructive hover:bg-destructive/10" :loading="store.isLoading && isManaging" @click="manage(QueueStatus.Cancel)">
              <component
                :is="Dismiss16Filled"
                class="h-3.5 w-3.5"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="text-xs">
            取消此排队
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
</template>
