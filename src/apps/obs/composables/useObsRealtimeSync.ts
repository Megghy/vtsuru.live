import type { MaybeRefOrGetter } from 'vue'
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, toValue, watch } from 'vue'

import { getRealtimeBus, useRealtimeTopic } from '@/shared/realtime'

export interface UseObsRealtimeSyncOptions {
  topic: MaybeRefOrGetter<string>
  active?: MaybeRefOrGetter<boolean>
  visible?: MaybeRefOrGetter<boolean>
  onSync: () => void | Promise<void>
  disconnectedFallbackMs?: number
  connectedSafetyMs?: number
}

export function useObsRealtimeSync(options: UseObsRealtimeSyncOptions) {
  const bus = getRealtimeBus()
  const status = bus.getStatus()
  const reconnectedCount = bus.getReconnectedCount()

  const mounted = ref(false)
  const isActive = computed(() => (options.active === undefined ? true : toValue(options.active)))
  const isVisible = computed(() => (options.visible === undefined ? true : toValue(options.visible)))
  const rawTopic = computed(() => toValue(options.topic).trim())
  const shouldRun = computed(() => mounted.value && isActive.value && isVisible.value)

  const { on } = useRealtimeTopic(() => (mounted.value ? rawTopic.value : ''))

  const disconnectedFallbackMs = options.disconnectedFallbackMs ?? 5000
  const connectedSafetyMs = options.connectedSafetyMs ?? 0
  let fallbackTimer: number | undefined

  function clearFallbackTimer() {
    if (fallbackTimer !== undefined) {
      window.clearTimeout(fallbackTimer)
      fallbackTimer = undefined
    }
  }

  function scheduleFallback() {
    clearFallbackTimer()
    if (!shouldRun.value) return
    const delay = status.value.connected && rawTopic.value ? connectedSafetyMs : disconnectedFallbackMs
    if (delay <= 0) return
    fallbackTimer = window.setTimeout(() => {
      void runSync()
    }, delay)
  }

  async function runSync() {
    clearFallbackTimer()
    if (!shouldRun.value) return
    try {
      await options.onSync()
    } finally {
      scheduleFallback()
    }
  }

  watch(
    [shouldRun, rawTopic],
    ([running]) => {
      if (running) {
        void runSync()
      } else {
        clearFallbackTimer()
      }
    },
    { immediate: true },
  )

  watch(reconnectedCount, () => {
    if (shouldRun.value) {
      void runSync()
    }
  })

  watch(
    () => status.value.connected,
    () => {
      scheduleFallback()
    },
  )

  onMounted(() => {
    mounted.value = true
  })
  onActivated(() => {
    mounted.value = true
  })
  onDeactivated(() => {
    mounted.value = false
    clearFallbackTimer()
  })
  onUnmounted(() => {
    mounted.value = false
    clearFallbackTimer()
  })

  return {
    on,
    status,
    sync: runSync,
  }
}
