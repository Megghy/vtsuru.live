import type { ResponseVideoCollectModel } from '@/api/generated/model'

/** 秒数 → HH:MM:SS 或 MM:SS（向下取整，防止浮点数和超 1 小时错误） */
export function formatVideoDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/** 秒数规则文案，精确到秒，避免向上取整误导 */
export function formatDurationLimitText(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0))
  if (safe < 60) return `${safe} 秒`
  const minutes = Math.floor(safe / 60)
  const rem = safe % 60
  return rem === 0 ? `${minutes} 分钟` : `${minutes} 分 ${rem} 秒`
}

/** 将秒/毫秒/ISO 字符串/Date 统一转换为毫秒时间戳 */
export function normalizeTimestamp(time: unknown): number {
  if (typeof time === 'number') {
    return time < 1e11 ? time * 1000 : time
  }
  if (typeof time === 'string') {
    const parsed = new Date(time).getTime()
    return Number.isNaN(parsed) ? Date.now() : parsed
  }
  if (time instanceof Date) return time.getTime()
  return Date.now()
}

/** 规范化 B 站封面地址为 https:// */
export function normalizeBiliCoverUrl(url?: string | null): string {
  if (!url) return ''
  const trimmed = url.trim()
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return trimmed.replace(/^http:\/\//i, 'https://')
}

/** 构造 B 站视频跳转链接（自动附带分 P 参数） */
export function buildBiliVideoUrl(bvid?: string | null, page?: number | null): string {
  const clean = (bvid ?? '').trim()
  if (!clean) return 'https://www.bilibili.com'
  const p = page && page > 1 ? `?p=${Math.floor(page)}` : ''
  return `https://www.bilibili.com/video/${encodeURIComponent(clean)}${p}`
}

/** 构造 B 站内嵌播放器 URL（仅接受合法 BV 号，防止注入） */
export function buildBiliPlayerUrl(bvid?: string | null, page = 1): string {
  const clean = (bvid ?? '').trim()
  if (!/^BV[0-9A-Za-z]{10}$/i.test(clean)) return ''
  const safePage = Math.max(1, Math.floor(page || 1))
  return `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(clean)}&page=${safePage}&as_wide=1&high_quality=1&danmaku=0&autoplay=1`
}

/** 客户端快速判断是否为可能的 B 站视频输入（支持 BV、AV、完整链接、b23.tv/bili2233.cn 短链） */
export function isValidBiliVideoInput(raw: string): boolean {
  const text = raw.trim()
  if (!text) return false
  return (
    /BV[0-9A-Za-z]{10}/i.test(text) ||
    /(?:^|[^0-9A-Za-z])av\d+(?:$|[^0-9])/i.test(text) ||
    /https?:\/\/(?:www\.)?(?:b23\.tv|bili2233\.cn)\//i.test(text)
  )
}

export type VideoCollectLifecycleState = 'upcoming' | 'active' | 'full' | 'finished'

export function getVideoCollectLifecycleState(
  table: Pick<ResponseVideoCollectModel, 'isFinish' | 'startAt' | 'endAt' | 'videoCount' | 'maxVideoCount'>,
  nowMs = Date.now(),
): VideoCollectLifecycleState {
  const startMs = normalizeTimestamp(table.startAt)
  const endMs = normalizeTimestamp(table.endAt)
  if (table.isFinish || endMs <= nowMs) return 'finished'
  if (startMs > nowMs) return 'upcoming'
  if (table.videoCount >= table.maxVideoCount) return 'full'
  return 'active'
}

export function getVideoCollectLifecycleLabel(state: VideoCollectLifecycleState): string {
  switch (state) {
    case 'upcoming':
      return '未开始'
    case 'full':
      return '名额已满'
    case 'finished':
      return '已结束'
    default:
      return '进行中'
  }
}
