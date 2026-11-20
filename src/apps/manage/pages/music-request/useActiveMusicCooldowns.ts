import { computed, onUnmounted, ref, watch } from 'vue'
import { clearInterval, setInterval } from 'worker-timers'

import { useMusicRequestProvider } from '@/store/useMusicRequest'

export function useActiveMusicCooldowns() {
  const musicRequestStore = useMusicRequestProvider()
  const nowTick = ref(Date.now())
  let cooldownTimer: ReturnType<typeof setInterval> | null = null

  const activeCooldowns = computed(() => {
    const cd = musicRequestStore.settings.orderCooldown ?? 0
    if (!cd) return []
    const cooldownMs = cd * 1000
    return Object.entries(musicRequestStore.cooldownMap)
      .map(([userKey, last]) => {
        const remain = Math.ceil((last + cooldownMs - nowTick.value) / 1000)
        return {
          userKey,
          name: musicRequestStore.cooldownNames[userKey] || `UID ${userKey}`,
          remain,
        }
      })
      .filter((item) => item.remain > 0)
      .toSorted((a, b) => b.remain - a.remain)
  })

  watch(
    [() => musicRequestStore.cooldownMap, () => musicRequestStore.settings.orderCooldown],
    () => {
      nowTick.value = Date.now()
    },
    { deep: true },
  )

  watch(
    () => activeCooldowns.value.length > 0,
    (hasActive) => {
      if (hasActive && !cooldownTimer) {
        nowTick.value = Date.now()
        cooldownTimer = setInterval(() => {
          nowTick.value = Date.now()
        }, 1000)
      } else if (!hasActive && cooldownTimer) {
        clearInterval(cooldownTimer)
        cooldownTimer = null
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    if (cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  })

  return activeCooldowns
}
