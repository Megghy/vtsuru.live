<script setup lang="ts">
import { Clock } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { TriggerType, useAutoAction } from '@/apps/client/store/useAutoAction'
import { Badge } from '@/shared/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{
  actionId: string
}>()

const autoActionStore = useAutoAction()

const remainingSecondsDisplay = ref<string>('...')
const intervalId = ref<ReturnType<typeof setInterval> | null>(null)

const targetAction = computed(() => autoActionStore.autoActions.find((a) => a.id === props.actionId))

function getTimerInfo() {
  return autoActionStore.getScheduledTimerInfo(props.actionId)
}

function formatDuration(totalSeconds: number): string {
  if (Number.isNaN(totalSeconds) || totalSeconds < 0) return '00:00'
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function updateDisplay() {
  const timerInfo = getTimerInfo()
  if (timerInfo && timerInfo.remainingMs > 0) {
    remainingSecondsDisplay.value = formatDuration(timerInfo.remainingMs / 1000)
  } else {
    const isGlobal = targetAction.value?.triggerConfig.useGlobalTimer
    remainingSecondsDisplay.value = isGlobal ? '全局计时' : '独立计时'
    stopInterval()
  }
}

function startInterval() {
  stopInterval()
  const timerInfo = getTimerInfo()
  if (timerInfo && timerInfo.remainingMs > 0) {
    updateDisplay()
    intervalId.value = setInterval(updateDisplay, 1000)
  } else {
    updateDisplay()
  }
}

function stopInterval() {
  if (intervalId.value) {
    clearInterval(intervalId.value)
    intervalId.value = null
  }
}

onMounted(() => {
  if (targetAction.value?.triggerType === TriggerType.SCHEDULED) {
    startInterval()
  } else {
    remainingSecondsDisplay.value = '-'
  }
})

onUnmounted(() => {
  stopInterval()
})

watch(
  () => [
    targetAction.value?.triggerConfig.useGlobalTimer,
    targetAction.value?.enabled,
    autoActionStore.getScheduledTimerInfo(props.actionId),
  ],
  (newValues, oldValues) => {
    if (targetAction.value?.triggerType !== TriggerType.SCHEDULED) {
      stopInterval()
      remainingSecondsDisplay.value = '-'
      return
    }

    const newTimerInfo = newValues[2] as ReturnType<typeof getTimerInfo>
    const oldTimerInfo = oldValues ? (oldValues[2] as ReturnType<typeof getTimerInfo>) : null

    const isActiveNow = newTimerInfo !== null && newTimerInfo.remainingMs > 0
    const wasActiveBefore = oldTimerInfo !== null && oldTimerInfo.remainingMs > 0

    if (isActiveNow && !wasActiveBefore) {
      startInterval()
    } else if (!isActiveNow && wasActiveBefore) {
      stopInterval()
      updateDisplay()
    } else if (isActiveNow && wasActiveBefore) {
      if (newTimerInfo.remainingMs > (oldTimerInfo?.remainingMs ?? 0) + 1500) {
        startInterval()
      } else if (newValues[0] !== oldValues?.[0] || newValues[1] !== oldValues?.[1]) {
        startInterval()
      }
    } else {
      stopInterval()
      updateDisplay()
    }
  },
  { deep: true },
)

const isCountingDown = computed(() => {
  const timerInfo = getTimerInfo()
  return Boolean(timerInfo && timerInfo.remainingMs > 0)
})
</script>

<template>
  <div class="timer-countdown inline-flex items-center">
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger as-child>
          <Badge
            :variant="isCountingDown ? 'default' : 'secondary'"
            size="sm"
            class="min-w-[78px] font-mono tabular-nums flex-center gap-1 cursor-default"
          >
            <Clock class="size-3.5" />
            <span class="font-bold">{{ remainingSecondsDisplay }}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div v-if="isCountingDown">距离下次触发还剩 {{ remainingSecondsDisplay }}</div>
          <div v-else>
            {{ targetAction?.triggerConfig.useGlobalTimer ? '正在等待全局计时器触发' : '独立计时器未启动或已停止' }}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>
