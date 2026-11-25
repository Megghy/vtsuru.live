import type { DashboardEvent } from './types'

export interface DanmakuPulseSnapshot {
  /** 近 3 分钟按 10 秒分桶的弹幕数量（长度 18） */
  buckets: number[]
  /** 当前最近 30 秒换算的每分钟速率 */
  currentPerMin: number
  /** 窗口内峰值桶 */
  peakBucket: number
  /** 是否检测到显著波峰（最近 20 秒显著高于均值） */
  isSpike: boolean
  /** 最近 60 秒内高频重复词条（≥3 次） */
  hotWords: { text: string; count: number; isAlert: boolean }[]
}

const BUCKET_MS = 10_000
const BUCKET_COUNT = 18 // 3 分钟
const HOT_WINDOW_MS = 60_000
const ALERT_RE = /(?:没声音|没声|静音|无声|麦炸|爆音|卡了|好卡|掉帧|黑屏|花屏|糊了|回音|重音|画音不同步)/

function normalizePhrase(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[!！?？~～.。…]+$/g, '')
    .toLowerCase()
}

export function computeDanmakuPulse(events: readonly DashboardEvent[], now = Date.now()): DanmakuPulseSnapshot {
  const buckets = new Array<number>(BUCKET_COUNT).fill(0)
  const windowStart = now - BUCKET_COUNT * BUCKET_MS
  const hotStart = now - HOT_WINDOW_MS
  const counts = new Map<string, { display: string; count: number }>()

  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i]
    if (ev.time < windowStart) break
    const idx = Math.min(BUCKET_COUNT - 1, Math.max(0, Math.floor((ev.time - windowStart) / BUCKET_MS)))
    buckets[idx]++

    if (ev.time >= hotStart && !ev.emoji) {
      const display = ev.msg.trim()
      if (display.length >= 2 && display.length <= 24) {
        const key = normalizePhrase(display)
        if (key.length >= 2) {
          const prev = counts.get(key)
          if (prev) prev.count++
          else counts.set(key, { display, count: 1 })
        }
      }
    }
  }

  const peakBucket = buckets.reduce((m, v) => (v > m ? v : m), 0)
  const recent30s = buckets[BUCKET_COUNT - 1] + buckets[BUCKET_COUNT - 2] + buckets[BUCKET_COUNT - 3]
  const currentPerMin = recent30s * 2
  const baselineBuckets = buckets.slice(0, BUCKET_COUNT - 2)
  const baselineAvg =
    baselineBuckets.reduce((s, v) => s + v, 0) / Math.max(1, baselineBuckets.length)
  const recentMax = Math.max(buckets[BUCKET_COUNT - 1], buckets[BUCKET_COUNT - 2])
  const isSpike = recentMax >= 8 && recentMax >= Math.max(baselineAvg * 2.2, 8)

  const hotWords = [...counts.values()]
    .filter((entry) => entry.count >= 3 || (entry.count >= 2 && ALERT_RE.test(entry.display)))
    .sort((a, b) => {
      const aAlert = ALERT_RE.test(a.display) ? 1 : 0
      const bAlert = ALERT_RE.test(b.display) ? 1 : 0
      return bAlert - aAlert || b.count - a.count
    })
    .slice(0, 4)
    .map((entry) => ({
      text: entry.display,
      count: entry.count,
      isAlert: ALERT_RE.test(entry.display),
    }))

  return {
    buckets,
    currentPerMin,
    peakBucket,
    isSpike,
    hotWords,
  }
}
