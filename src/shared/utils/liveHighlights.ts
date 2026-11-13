import type { DanmakuModel } from '@/api/client-types'
import { EventDataTypes } from '@/api/generated/model'

import { formatBiliOffset } from './songTimeline'

export type HighlightSource = 'manual' | 'shortcut' | 'danmaku' | 'auto-peak' | 'auto-sc' | 'auto-guard'

export interface HighlightEntry {
  id: string
  timeMs: number
  label: string
  source: HighlightSource
  author?: string
}

export interface DetectAutoHighlightsOptions {
  /** SC 金额阈值（元），默认 30 */
  minScPrice?: number
  /** 弹幕峰值检测：高于均值多少倍算峰值，默认 2.2 */
  peakMultiplier?: number
  /** 弹幕峰值最小桶条数门槛，默认 8 */
  minPeakDanmaku?: number
  /** 是否包含上舰事件，默认 true */
  includeGuard?: boolean
}

/** 从本场弹幕/打赏记录中自动识别候选高光时刻（弹幕峰值、高额 SC、上舰） */
export function detectAutoHighlights(
  danmakus: readonly DanmakuModel[],
  liveStartAtMs: number,
  liveEndAtMs?: number | null,
  options: DetectAutoHighlightsOptions = {},
): HighlightEntry[] {
  const minScPrice = options.minScPrice ?? 30
  const peakMultiplier = options.peakMultiplier ?? 2.2
  const minPeakDanmaku = options.minPeakDanmaku ?? 8
  const includeGuard = options.includeGuard ?? true

  if (!liveStartAtMs || danmakus.length === 0) return []

  const results: HighlightEntry[] = []
  const msgTimes: number[] = []

  for (let i = 0; i < danmakus.length; i++) {
    const d = danmakus[i]
    const time = Number(d.time) || 0
    if (time < liveStartAtMs) continue
    if (liveEndAtMs && liveEndAtMs > liveStartAtMs && time > liveEndAtMs) continue

    if (d.type === EventDataTypes.Message) {
      msgTimes.push(time)
    } else if (d.type === EventDataTypes.SC && (d.price ?? 0) >= minScPrice) {
      results.push({
        id: `auto-sc-${time}-${i}`,
        timeMs: time,
        label: `[SC ¥${d.price}] ${d.uName || '观众'}: ${(d.msg || '').slice(0, 28)}`,
        source: 'auto-sc',
        author: d.uName || undefined,
      })
    } else if (includeGuard && d.type === EventDataTypes.Guard) {
      results.push({
        id: `auto-guard-${time}-${i}`,
        timeMs: time,
        label: `[上舰] ${d.uName || '观众'} 开通大航海`,
        source: 'auto-guard',
        author: d.uName || undefined,
      })
    }
  }

  // 每 30 秒分桶检测弹幕密集峰值
  if (msgTimes.length >= minPeakDanmaku) {
    const bucketMs = 30_000
    const bucketMap = new Map<number, number>()
    for (const t of msgTimes) {
      const idx = Math.floor((t - liveStartAtMs) / bucketMs)
      bucketMap.set(idx, (bucketMap.get(idx) ?? 0) + 1)
    }
    const counts = [...bucketMap.values()]
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length
    const threshold = Math.max(minPeakDanmaku, avg * peakMultiplier)

    const sortedBuckets = [...bucketMap.entries()].sort((a, b) => a[0] - b[0])
    let lastPeakBucket = -99
    for (const [bucketIdx, count] of sortedBuckets) {
      if (count >= threshold && bucketIdx - lastPeakBucket >= 2) {
        lastPeakBucket = bucketIdx
        results.push({
          id: `auto-peak-${bucketIdx}`,
          timeMs: liveStartAtMs + bucketIdx * bucketMs,
          label: `[弹幕高能] 30秒内 ${count} 条弹幕`,
          source: 'auto-peak',
        })
      }
    }
  }

  return results.sort((a, b) => a.timeMs - b.timeMs)
}

/** 生成 B 站录播评论区时间戳文本 */
export function buildHighlightCommentText(
  entries: readonly HighlightEntry[],
  liveStartAtMs: number,
  offsetAdjustSec = 0,
): string {
  const adjustMs = offsetAdjustSec * 1000
  return [...entries]
    .filter((e) => Number.isFinite(e.timeMs) && e.timeMs >= liveStartAtMs)
    .sort((a, b) => a.timeMs - b.timeMs)
    .map((e) => `${formatBiliOffset(e.timeMs - liveStartAtMs + adjustMs)} ${e.label.trim() || '高光时刻'}`)
    .join('\n')
}

function formatSrtTimestamp(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms))
  const hours = Math.floor(clamped / 3600_000)
  const minutes = Math.floor((clamped % 3600_000) / 60_000)
  const seconds = Math.floor((clamped % 60_000) / 1000)
  const millis = clamped % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`
}

/** 导出可用于剪映 / PR 轨道快速定位片段的 .srt 时间标记字幕 */
export function buildHighlightSrtText(
  entries: readonly HighlightEntry[],
  liveStartAtMs: number,
  offsetAdjustSec = 0,
  clipDurationSec = 5,
): string {
  const adjustMs = offsetAdjustSec * 1000
  const durationMs = Math.max(1000, clipDurationSec * 1000)
  const sorted = [...entries]
    .filter((e) => Number.isFinite(e.timeMs) && e.timeMs >= liveStartAtMs)
    .sort((a, b) => a.timeMs - b.timeMs)

  return sorted
    .map((entry, idx) => {
      const startMs = Math.max(0, entry.timeMs - liveStartAtMs + adjustMs)
      const endMs = startMs + durationMs
      return `${idx + 1}\n${formatSrtTimestamp(startMs)} --> ${formatSrtTimestamp(endMs)}\n${entry.label.trim() || '高光时刻'}`
    })
    .join('\n\n')
}
