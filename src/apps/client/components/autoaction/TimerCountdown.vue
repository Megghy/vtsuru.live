<script setup lang="ts">
import { NTooltip, NTag, NIcon } from 'naive-ui';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { TriggerType, useAutoAction } from '@/apps/client/store/useAutoAction'
import { Clock16Regular } from '@vicons/fluent'

const props = defineProps({
  actionId: {
    type: String,
    required: true,
  },
})

const autoActionStore = useAutoAction()

const remainingSecondsDisplay = ref<string>('...') 
const intervalId = ref<any | null>(null)

// 获取目标 action 的基本信息
const targetAction = computed(() => autoActionStore.autoActions.find(a => a.id === props.actionId))

// 获取当前计时器信息
function getTimerInfo() {
  return autoActionStore.getScheduledTimerInfo(props.actionId)
}

// 格式化函数
function formatDuration(totalSeconds: number): string {
  if (Number.isNaN(totalSeconds) || totalSeconds < 0) return '00:00'
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// 更新显示的函数
function updateDisplay() {
  const timerInfo = getTimerInfo()
  if (timerInfo && timerInfo.remainingMs > 0) {
    remainingSecondsDisplay.value = formatDuration(timerInfo.remainingMs / 1000)
  } else {
    // 如果没有计时器信息或时间已到，显示状态标识
    const isGlobal = targetAction.value?.triggerConfig.useGlobalTimer
    remainingSecondsDisplay.value = isGlobal ? '全局计时' : '独立计时'
    if (intervalId.value) {
      clearInterval(intervalId.value)
      intervalId.value = null
    }
  }
}

// 启动定时更新
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

// 停止定时更新
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

// 监听计时器状态变化
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

    const newTimerInfo = newValues[2] as any
    const oldTimerInfo = oldValues ? oldValues[2] as any : null

    const isActiveNow = newTimerInfo !== null && newTimerInfo.remainingMs > 0
    const wasActiveBefore = oldTimerInfo !== null && oldTimerInfo.remainingMs > 0

    if (isActiveNow && !wasActiveBefore) {
      startInterval()
    } else if (!isActiveNow && wasActiveBefore) {
      stopInterval()
      updateDisplay()
    } else if (isActiveNow && wasActiveBefore) {
      // 检查是否重置
      if (newTimerInfo.remainingMs > oldTimerInfo.remainingMs + 1500) {
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
  return !!(timerInfo && timerInfo.remainingMs > 0)
})
</script>

<template>
  <div class="timer-countdown">
    <NTooltip trigger="hover">
      <template #trigger>
        <NTag 
          :type="isCountingDown ? 'primary' : 'default'" 
          size="small" 
          round 
          :bordered="false"
          class="countdown-tag"
        >
          <template #icon>
            <NIcon :component="Clock16Regular" />
          </template>
          <span class="timer-text">{{ remainingSecondsDisplay }}</span>
        </NTag>
      </template>
      <div v-if="isCountingDown">
        距离下次触发还剩 {{ remainingSecondsDisplay }}
      </div>
      <div v-else>
        {{ targetAction?.triggerConfig.useGlobalTimer ? '正在等待全局计时器触发' : '独立计时器未启动或已停止' }}
      </div>
    </NTooltip>
  </div>
</template>

<style scoped>
.timer-countdown {
  display: inline-flex;
  align-items: center;
}

.countdown-tag {
  min-width: 80px;
  justify-content: center;
  font-family: monospace;
}

.timer-text {
  font-weight: bold;
}
</style>
