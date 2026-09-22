// 倒计时工具。后端 Utils.ToUnix() 返回的是毫秒时间戳（Ticks / 10000），
// 所有以 endTime 计算的倒计时统一在这里按毫秒处理，禁止再自行乘算秒/毫秒。

/** 剩余毫秒数，endTime 缺失时返回 null */
export function remainingMs(endTimeMs: number | null | undefined, nowMs: number): number | null {
  if (!endTimeMs) return null
  return Math.max(0, endTimeMs - nowMs)
}

/** 剩余毫秒 → mm:ss */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, '0')
  const ss = (total % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}
