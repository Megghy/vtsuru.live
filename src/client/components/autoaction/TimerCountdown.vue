<script setup lang="ts">
import { NText } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { TriggerType, useAutoAction } from '@/client/store/useAutoAction'
// 确保导入 TriggerType
const props = defineProps({
  actionId: {
    type: String,
    required: true,
  },
})

// import { formatDuration } from '@/utils/time'; // 移除不存在的导入

// 在组件内部实现简单的格式化函数
function formatDuration(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) {
    return '00:00'
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const paddedMinutes = String(minutes).padStart(2, '0')
  const paddedSeconds = String(seconds).padStart(2, '0')
  return `${paddedMinutes}:${paddedSeconds}`
}

const autoActionStore = useAutoAction()

const remainingSecondsDisplay = ref<string>('...') // 用于显示格式化后的剩余时间
const intervalId = ref<any | null>(null)

// 获取目标 action 的基本信息，用于判断是否是有效的定时任务
const targetAction = computed(() => autoActionStore.autoActions.find(a => a.id === props.actionId))

// 获取当前计时器信息
function getTimerInfo() {
  return autoActionStore.getScheduledTimerInfo(props.actionId)
}

// 更新显示的函数
function updateDisplay() {
  const timerInfo = getTimerInfo()
  if (timerInfo && timerInfo.remainingMs > 0) {
    remainingSecondsDisplay.value = formatDuration(timerInfo.remainingMs / 1000) // 使用内部的 formatDuration
  } else {
    // 如果没有计时器信息或时间已到，显示默认文本并停止更新
    remainingSecondsDisplay.value = targetAction.value?.triggerConfig.useGlobalTimer ? '全局' : '独立'
    if (intervalId.value) {
      clearInterval(intervalId.value)
      intervalId.value = null
    }
  }
}

// 启动定时更新
function startInterval() {
  stopInterval() // 先清除旧的定时器
  const timerInfo = getTimerInfo()
  // 只有在获取到有效的计时器信息时才启动
  if (timerInfo && timerInfo.remainingMs > 0) {
    updateDisplay() // 先立即更新一次
    intervalId.value = setInterval(updateDisplay, 1000) // 每秒更新
  } else {
    // 如果初始状态就无效，直接显示默认文本
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
  // 仅当 action 是 SCHEDULED 类型时才尝试启动计时器
  if (targetAction.value?.triggerType === TriggerType.SCHEDULED) {
    startInterval()
  } else {
    remainingSecondsDisplay.value = '非定时'
  }
})

onUnmounted(() => {
  stopInterval() // 组件卸载时清除定时器
})

// 监听计时器状态变化（例如从独立切换到全局，或者反之，以及全局定时器的启动/停止）
// 一个简化的方法是监听 getScheduledTimerInfo 的返回值，但这可能频繁触发
// 更精确的方法是监听相关的响应式状态
watch(
  () => [
    targetAction.value?.triggerConfig.useGlobalTimer,
    targetAction.value?.enabled,
    // autoActionStore.runtimeState.globalTimerStartTime, // 监听全局启动时间
    // autoActionStore.runtimeState.timerStartTimes[props.actionId] // 监听独立启动时间
    // 监听 getTimerInfo 返回的对象的引用可能更稳定，仅当对象本身改变时触发
    autoActionStore.getScheduledTimerInfo(props.actionId),
  ],
  (newValues, oldValues) => {
    // 只有 action 是 SCHEDULED 类型时才处理
    if (targetAction.value?.triggerType !== TriggerType.SCHEDULED) {
      stopInterval()
      remainingSecondsDisplay.value = '非定时'
      return
    }

    const newTimerInfo = newValues[2] as ReturnType<typeof getTimerInfo> // 获取新的 timerInfo
    const oldTimerInfo = oldValues ? oldValues[2] as ReturnType<typeof getTimerInfo> : null

    // 检查计时器状态是否实际改变 (从有到无，从无到有，或者时间重置)
    const isActiveNow = newTimerInfo !== null && newTimerInfo.remainingMs > 0
    const wasActiveBefore = oldTimerInfo !== null && oldTimerInfo.remainingMs > 0

    if (isActiveNow && !wasActiveBefore) {
      // 从不活动变为活动 -> 启动计时器
      startInterval()
    } else if (!isActiveNow && wasActiveBefore) {
      // 从活动变为不活动 -> 停止计时器并更新显示
      stopInterval()
      updateDisplay() // 显示 "全局" 或 "独立"
    } else if (isActiveNow && wasActiveBefore) {
      // 如果一直活动，但 timerInfo 对象改变了 (可能意味着时间重置了)，也重启一下 interval 确保时间准确
      // 简单的判断：如果 startTime 变了 (需要 getScheduledTimerInfo 返回 startTime)
      // 或者简单粗暴点：只要 timerInfo 变了就重启
      // 但由于 getScheduledTimerInfo 每次计算 remainingMs，可能导致不必要的重启
      // 优化：如果 remainingMs 突然大幅增加 (意味着重置)，可以重启
      if (newTimerInfo && oldTimerInfo && newTimerInfo.remainingMs > oldTimerInfo.remainingMs + 1500) { // 增加超过1.5秒，认为是重置
        startInterval()
      } else {
        // 否则，让现有的 interval 继续运行更新就好
        // 但为了保险，可以考虑在启用状态或定时器类型切换时强制重启
        if (newValues[0] !== oldValues?.[0] || newValues[1] !== oldValues?.[1]) {
          startInterval()
        }
      }
    } else {
      // 都不是活动状态，确保停止
      stopInterval()
      updateDisplay()
    }
  },
  { deep: true }, // 使用 deep watch 可能性能消耗稍大，但能更好地捕捉嵌套变化
)
</script>

<template>
  <NText>{{ remainingSecondsDisplay }}</NText>
</template>
