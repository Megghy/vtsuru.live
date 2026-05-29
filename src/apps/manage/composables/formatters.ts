// manage 模块共享格式化函数。纯函数，无副作用。

/** 时间戳(毫秒)→ 本地完整日期时间，24 小时制 */
export function formatTime(unixMs: number): string {
  return new Date(unixMs).toLocaleString('zh-CN', { hour12: false })
}

/** 时间戳 → 年/月/日，自动识别秒或毫秒 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp > 1e10 ? timestamp : timestamp * 1000)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

/** 整数千位符 */
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN')
}

/** 积分：千位符，最多两位小数 */
export function formatPoints(value: number): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

/** 金额：¥ + 两位小数 */
export function formatCurrency(value: number): string {
  return `¥${value.toFixed(2)}`
}

/** 字节 → B / KB / MB */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** 秒数 → mm:ss */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}
