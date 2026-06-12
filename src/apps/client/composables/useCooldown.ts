import { onUnmounted, ref } from 'vue'

/**
 * 操作冷却计时器。
 * - 仅在冷却进行时运行单个定时器, 结束后自动清除 (避免常驻空转定时器)。
 * - trigger() 启动冷却并立即刷新剩余时间, 调用方可直接读取最新的 remaining 值。
 * @param durationMs 冷却时长 (毫秒)
 */
export function useCooldown(durationMs: number) {
  const remaining = ref(0) // 剩余秒数
  let timer: number | undefined
  let endAt = 0

  function tick() {
    const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
    remaining.value = left
    if (left <= 0 && timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }

  /** 启动冷却, 立即刷新剩余时间 */
  function trigger() {
    endAt = Date.now() + durationMs
    tick()
    if (timer === undefined) {
      timer = window.setInterval(tick, 1000)
    }
  }

  /** 当前是否处于冷却中 */
  function isCoolingDown() {
    return remaining.value > 0
  }

  function stop() {
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
    remaining.value = 0
  }

  onUnmounted(stop)

  return { remaining, isCoolingDown, trigger, stop }
}
